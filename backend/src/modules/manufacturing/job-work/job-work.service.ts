import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Pool } from 'pg';
import { DRIZZLE_DB, PG_POOL } from '../../../database/database.module';
import type { DrizzleDb } from '../../../database/database.module';
import { AuditLogService } from '../../../common/services/audit-log.service';
import {
  CreateJobWorkChallanDto,
  UpdateJobWorkChallanDto,
  DispatchJobWorkChallanDto,
  CreateJobWorkReceiptDto,
  ReconcileJobWorkChallanDto,
} from './job-work.dto';

interface AuthenticatedUserContext {
  userId: number;
  username?: string;
  compId: number;
  branchId: number;
  fyearId?: number;
}

@Injectable()
export class JobWorkService {
  private readonly logger = new Logger(JobWorkService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly drizzle: DrizzleDb,
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
  ) {}

  // --------------------------------------------------------------------------
  // 1. Executive Summary & KPIs
  // --------------------------------------------------------------------------
  async getSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const res = await this.pool.query(
      `SELECT
         COUNT(*)::INT AS total_challans,
         COUNT(CASE WHEN status IN ('DISPATCHED', 'PARTIALLY_RECEIVED') THEN 1 END)::INT AS active_challans,
         COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END)::INT AS completed_challans,
         COUNT(CASE WHEN status = 'DRAFT' THEN 1 END)::INT AS draft_challans,
         COALESCE(SUM(total_estimated_value), 0)::FLOAT AS total_estimated_value,
         COALESCE(SUM(total_sent_qty), 0)::FLOAT AS total_sent_qty,
         (SELECT COUNT(*)::INT FROM tbl_mfg_job_work_receipt r WHERE r.comp_id = $1 AND r.is_active = TRUE) AS total_receipts
       FROM tbl_mfg_job_work_challan
       WHERE comp_id = $1 AND is_active = TRUE;`,
      [compId],
    );

    const row = res.rows[0];
    return {
      totalChallans: row.total_challans || 0,
      activeChallans: row.active_challans || 0,
      completedChallans: row.completed_challans || 0,
      draftChallans: row.draft_challans || 0,
      totalEstimatedValue: row.total_estimated_value || 0,
      totalSentQty: row.total_sent_qty || 0,
      totalReceipts: row.total_receipts || 0,
    };
  }

  // --------------------------------------------------------------------------
  // 2. Dropdown Lookups
  // --------------------------------------------------------------------------
  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const [vendorsRes, wosRes, warehousesRes, itemsRes, opsRes] = await Promise.all([
      // 1. Subcontractor Parties
      this.pool.query(
        `SELECT party_id, party_code, party_name, gst_treatment_type
         FROM tbl_crm_party
         WHERE comp_id = $1 AND is_active = TRUE AND (is_job_worker = TRUE OR is_supplier = TRUE)
         ORDER BY party_name ASC;`,
        [compId],
      ),
      // 2. Active Work Orders
      this.pool.query(
        `SELECT
           wo.wo_id, wo.wo_no, wo.item_id, wo.planned_qty::FLOAT AS planned_qty,
           wo.status, i.item_code, i.item_name
         FROM tbl_mfg_wo_header wo
         JOIN tbl_inv_item i ON wo.item_id = i.item_id
         WHERE wo.comp_id = $1 AND wo.is_active = TRUE AND wo.status IN ('RELEASED', 'IN_PROGRESS')
         ORDER BY wo.wo_no DESC;`,
        [compId],
      ),
      // 3. Warehouses
      this.pool.query(
        `SELECT warehouse_id, warehouse_code, warehouse_name, warehouse_type
         FROM tbl_inv_warehouse
         WHERE comp_id = $1 AND is_active = TRUE
         ORDER BY warehouse_name ASC;`,
        [compId],
      ),
      // 4. Raw Material / Component Items
      this.pool.query(
        `SELECT
           i.item_id, i.item_code, i.item_name, i.hsn_code,
           i.standard_rate::FLOAT AS standard_rate,
           u.uom_id, u.uom_code, u.uom_name
         FROM tbl_inv_item i
         JOIN tbl_inv_uom u ON i.base_uom_id = u.uom_id
         WHERE i.comp_id = $1 AND i.is_active = TRUE
         ORDER BY i.item_code ASC;`,
        [compId],
      ),
      // 5. Active Subcontracted Routing Operations
      this.pool.query(
        `SELECT
           ro.wo_routing_op_id, ro.wo_id, ro.op_sequence, ro.operation_name,
           ro.work_center_id, wc.work_center_name, wc.work_center_type
         FROM tbl_mfg_wo_routing_op ro
         JOIN tbl_mfg_work_center wc ON ro.work_center_id = wc.work_center_id
         WHERE ro.comp_id = $1 AND ro.is_active = TRUE
         ORDER BY ro.op_sequence ASC;`,
        [compId],
      ),
    ]);

    return {
      subcontractors: vendorsRes.rows,
      workOrders: wosRes.rows,
      warehouses: warehousesRes.rows,
      items: itemsRes.rows,
      routingOperations: opsRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // 3. Outward Job-Work Challans List
  // --------------------------------------------------------------------------
  async getChallans(query: any, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const { status, vendorId, woId, search } = query;

    let sql = `
      SELECT
        c.challan_id,
        c.challan_no,
        c.challan_date,
        c.vendor_id,
        p.party_name AS vendor_name,
        p.party_code AS vendor_code,
        c.wo_id,
        wo.wo_no,
        c.nature_of_processing,
        c.from_warehouse_id,
        wh.warehouse_name AS from_warehouse_name,
        c.expected_return_date,
        c.transporter_name,
        c.vehicle_no,
        c.eway_bill_no,
        c.status,
        c.total_items,
        c.total_sent_qty::FLOAT AS total_sent_qty,
        c.total_estimated_value::FLOAT AS total_estimated_value,
        c.dispatched_at,
        u.full_name AS dispatched_by_name,
        c.remarks,
        c.created_date,
        COALESCE((
          SELECT SUM(ci.received_qty)::FLOAT
          FROM tbl_mfg_job_work_challan_item ci
          WHERE ci.challan_id = c.challan_id AND ci.is_active = TRUE
        ), 0) AS total_received_qty,
        COALESCE((
          SELECT SUM(ci.pending_qty)::FLOAT
          FROM tbl_mfg_job_work_challan_item ci
          WHERE ci.challan_id = c.challan_id AND ci.is_active = TRUE
        ), 0) AS total_pending_qty
      FROM tbl_mfg_job_work_challan c
      JOIN tbl_crm_party p ON c.vendor_id = p.party_id
      LEFT JOIN tbl_mfg_wo_header wo ON c.wo_id = wo.wo_id
      JOIN tbl_inv_warehouse wh ON c.from_warehouse_id = wh.warehouse_id
      LEFT JOIN tbl_sec_user u ON c.dispatched_by = u.user_id
      WHERE c.comp_id = $1 AND c.is_active = TRUE
    `;

    const params: any[] = [compId];
    let pIdx = 2;

    if (status) {
      sql += ` AND c.status = $${pIdx++}`;
      params.push(status);
    }
    if (vendorId) {
      sql += ` AND c.vendor_id = $${pIdx++}`;
      params.push(vendorId);
    }
    if (woId) {
      sql += ` AND c.wo_id = $${pIdx++}`;
      params.push(woId);
    }
    if (search) {
      sql += ` AND (c.challan_no ILIKE $${pIdx} OR p.party_name ILIKE $${pIdx} OR c.nature_of_processing ILIKE $${pIdx} OR c.eway_bill_no ILIKE $${pIdx})`;
      params.push(`%${search}%`);
      pIdx++;
    }

    sql += ` ORDER BY c.challan_id DESC;`;

    const res = await this.pool.query(sql, params);
    return res.rows;
  }

  // --------------------------------------------------------------------------
  // 4. Single Challan Details with Lines & Inward Receipts
  // --------------------------------------------------------------------------
  async getChallanById(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const res = await this.pool.query(
      `SELECT
         c.*,
         c.total_sent_qty::FLOAT AS total_sent_qty,
         c.total_estimated_value::FLOAT AS total_estimated_value,
         p.party_name AS vendor_name,
         p.party_code AS vendor_code,
         wo.wo_no,
         wh.warehouse_name AS from_warehouse_name,
         u.full_name AS dispatched_by_name
       FROM tbl_mfg_job_work_challan c
       JOIN tbl_crm_party p ON c.vendor_id = p.party_id
       LEFT JOIN tbl_mfg_wo_header wo ON c.wo_id = wo.wo_id
       JOIN tbl_inv_warehouse wh ON c.from_warehouse_id = wh.warehouse_id
       LEFT JOIN tbl_sec_user u ON c.dispatched_by = u.user_id
       WHERE c.challan_id = $1 AND c.comp_id = $2 AND c.is_active = TRUE;`,
      [id, compId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Job-Work Challan #${id} not found.`);
    }

    const challan = res.rows[0];

    // Load Items
    const itemsRes = await this.pool.query(
      `SELECT
         ci.challan_item_id,
         ci.challan_id,
         ci.item_id,
         i.item_code,
         COALESCE(ci.item_description, i.item_name) AS item_description,
         ci.uom_id,
         u.uom_code,
         ci.sent_qty::FLOAT AS sent_qty,
         ci.unit_rate::FLOAT AS unit_rate,
         ci.total_value::FLOAT AS total_value,
         ci.hsn_code,
         ci.batch_no,
         ci.heat_no,
         ci.received_qty::FLOAT AS received_qty,
         ci.scrap_returned_qty::FLOAT AS scrap_returned_qty,
         ci.loss_qty::FLOAT AS loss_qty,
         ci.pending_qty::FLOAT AS pending_qty,
         ci.remarks
       FROM tbl_mfg_job_work_challan_item ci
       JOIN tbl_inv_item i ON ci.item_id = i.item_id
       JOIN tbl_inv_uom u ON ci.uom_id = u.uom_id
       WHERE ci.challan_id = $1 AND ci.is_active = TRUE
       ORDER BY ci.challan_item_id ASC;`,
      [id],
    );

    // Load Linked Receipts
    const receiptsRes = await this.pool.query(
      `SELECT
         r.receipt_id,
         r.receipt_no,
         r.receipt_date,
         r.vendor_dc_no,
         r.vendor_invoice_no,
         wh.warehouse_name AS to_warehouse_name,
         r.service_charges::FLOAT AS service_charges,
         r.tax_amount::FLOAT AS tax_amount,
         r.total_amount::FLOAT AS total_amount,
         r.status,
         r.qc_status,
         r.created_date
       FROM tbl_mfg_job_work_receipt r
       JOIN tbl_inv_warehouse wh ON r.to_warehouse_id = wh.warehouse_id
       WHERE r.challan_id = $1 AND r.is_active = TRUE
       ORDER BY r.receipt_id DESC;`,
      [id],
    );

    return {
      ...challan,
      items: itemsRes.rows,
      receipts: receiptsRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // 5. Create Outward Job-Work Challan
  // --------------------------------------------------------------------------
  async createChallan(dto: CreateJobWorkChallanDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    let challanNo = dto.challanNo;
    if (!challanNo) {
      const seqRes = await this.pool.query(
        `SELECT COALESCE(MAX(challan_id), 1000) + 1 AS next_seq FROM tbl_mfg_job_work_challan;`,
      );
      const nextSeq = String(seqRes.rows[0].next_seq).padStart(4, '0');
      challanNo = `JW-OUT-AHM-2627-${nextSeq}`;
    }

    let totalSentQty = 0;
    let totalEstimatedValue = 0;
    for (const it of dto.items) {
      totalSentQty += Number(it.sentQty);
      totalEstimatedValue += Number(it.sentQty) * Number(it.unitRate);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const insRes = await client.query(
        `INSERT INTO tbl_mfg_job_work_challan (
           challan_no, challan_date, vendor_id, wo_id, wo_routing_op_id, job_card_id,
           nature_of_processing, from_warehouse_id, expected_return_date,
           transporter_name, vehicle_no, eway_bill_no, status,
           total_items, total_sent_qty, total_estimated_value,
           remarks, is_active,
           comp_id, branch_id, fyear_id, created_by
         ) VALUES (
           $1, COALESCE($2, CURRENT_DATE), $3, $4, $5, $6,
           $7, $8, $9,
           $10, $11, $12, 'DRAFT',
           $13, $14, $15,
           $16, TRUE,
           $17, $18, $19, $20
         ) RETURNING challan_id, challan_no;`,
        [
          challanNo,
          dto.challanDate || null,
          dto.vendorId,
          dto.woId || null,
          dto.woRoutingOpId || null,
          dto.jobCardId || null,
          dto.natureOfProcessing,
          dto.fromWarehouseId,
          dto.expectedReturnDate || null,
          dto.transporterName || null,
          dto.vehicleNo || null,
          dto.ewayBillNo || null,
          dto.items.length,
          totalSentQty,
          totalEstimatedValue,
          dto.remarks || null,
          compId,
          branchId,
          user.fyearId || null,
          user.userId || 1001,
        ],
      );

      const challanId = insRes.rows[0].challan_id;

      for (const it of dto.items) {
        const itemVal = Number(it.sentQty) * Number(it.unitRate);
        await client.query(
          `INSERT INTO tbl_mfg_job_work_challan_item (
             challan_id, item_id, item_description, uom_id,
             sent_qty, unit_rate, total_value, hsn_code, batch_no, heat_no,
             received_qty, scrap_returned_qty, loss_qty, pending_qty, remarks, is_active,
             comp_id, branch_id, fyear_id, created_by
           ) VALUES (
             $1, $2, $3, $4,
             $5, $6, $7, $8, $9, $10,
             0.000, 0.000, 0.000, $5, $11, TRUE,
             $12, $13, $14, $15
           );`,
          [
            challanId,
            it.itemId,
            it.itemDescription || null,
            it.uomId,
            it.sentQty,
            it.unitRate,
            itemVal,
            it.hsnCode || null,
            it.batchNo || null,
            it.heatNo || null,
            it.remarks || null,
            compId,
            branchId,
            user.fyearId || null,
            user.userId || 1001,
          ],
        );
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId: user.userId || 1001,
        username: user.username,
        compId,
        branchId,
        fyearId: user.fyearId || null,
        screenCode: 'MFG_JOB_WORK',
        actionType: 'ADD',
        entityTable: 'tbl_mfg_job_work_challan',
        recordId: challanId,
        newValue: { challanNo, vendorId: dto.vendorId, totalSentQty, totalEstimatedValue },
      });

      return { challanId, challanNo, message: 'Job-Work Challan created successfully in DRAFT status.' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 6. Update Outward Job-Work Challan
  // --------------------------------------------------------------------------
  async updateChallan(id: number, dto: UpdateJobWorkChallanDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const existRes = await this.pool.query(
      `SELECT challan_id, challan_no, status FROM tbl_mfg_job_work_challan WHERE challan_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [id, compId],
    );

    if (existRes.rows.length === 0) {
      throw new NotFoundException(`Job-Work Challan #${id} not found.`);
    }

    const challan = existRes.rows[0];
    if (challan.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot edit challan #${challan.challan_no} as it is in ${challan.status} status.`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE tbl_mfg_job_work_challan
         SET vendor_id = COALESCE($1, vendor_id),
             wo_id = COALESCE($2, wo_id),
             nature_of_processing = COALESCE($3, nature_of_processing),
             from_warehouse_id = COALESCE($4, from_warehouse_id),
             expected_return_date = COALESCE($5, expected_return_date),
             transporter_name = COALESCE($6, transporter_name),
             vehicle_no = COALESCE($7, vehicle_no),
             eway_bill_no = COALESCE($8, eway_bill_no),
             remarks = COALESCE($9, remarks),
             updated_by = $10,
             updated_date = CURRENT_TIMESTAMP
         WHERE challan_id = $11;`,
        [
          dto.vendorId,
          dto.woId,
          dto.natureOfProcessing,
          dto.fromWarehouseId,
          dto.expectedReturnDate,
          dto.transporterName,
          dto.vehicleNo,
          dto.ewayBillNo,
          dto.remarks,
          user.userId || 1001,
          id,
        ],
      );

      if (dto.items && dto.items.length > 0) {
        await client.query(`DELETE FROM tbl_mfg_job_work_challan_item WHERE challan_id = $1;`, [id]);

        let totalSentQty = 0;
        let totalEstimatedValue = 0;
        for (const it of dto.items) {
          totalSentQty += Number(it.sentQty);
          totalEstimatedValue += Number(it.sentQty) * Number(it.unitRate);
          await client.query(
            `INSERT INTO tbl_mfg_job_work_challan_item (
               challan_id, item_id, item_description, uom_id,
               sent_qty, unit_rate, total_value, hsn_code, batch_no, heat_no,
               received_qty, scrap_returned_qty, loss_qty, pending_qty, remarks, is_active,
               comp_id, branch_id, fyear_id, created_by
             ) VALUES (
               $1, $2, $3, $4,
               $5, $6, $7, $8, $9, $10,
               0.000, 0.000, 0.000, $5, $11, TRUE,
               $12, $13, $14, $15
             );`,
            [
              id,
              it.itemId,
              it.itemDescription || null,
              it.uomId,
              it.sentQty,
              it.unitRate,
              Number(it.sentQty) * Number(it.unitRate),
              it.hsnCode || null,
              it.batchNo || null,
              it.heatNo || null,
              it.remarks || null,
              compId,
              user.branchId || 1001,
              user.fyearId || null,
              user.userId || 1001,
            ],
          );
        }

        await client.query(
          `UPDATE tbl_mfg_job_work_challan
           SET total_items = $1, total_sent_qty = $2, total_estimated_value = $3
           WHERE challan_id = $4;`,
          [dto.items.length, totalSentQty, totalEstimatedValue, id],
        );
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId: user.userId || 1001,
        username: user.username,
        compId,
        branchId: user.branchId || 1001,
        fyearId: user.fyearId || null,
        screenCode: 'MFG_JOB_WORK',
        actionType: 'EDIT',
        entityTable: 'tbl_mfg_job_work_challan',
        recordId: id,
        newValue: dto,
      });

      return { message: 'Challan updated successfully.' };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 7. Dispatch Outward Challan (Stock Debit + State -> DISPATCHED)
  // --------------------------------------------------------------------------
  async dispatchChallan(id: number, dto: DispatchJobWorkChallanDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const existRes = await this.pool.query(
      `SELECT
         c.challan_id, c.challan_no, c.status, c.from_warehouse_id, c.wo_id, c.job_card_id
       FROM tbl_mfg_job_work_challan c
       WHERE c.challan_id = $1 AND c.comp_id = $2 AND c.is_active = TRUE;`,
      [id, compId],
    );

    if (existRes.rows.length === 0) {
      throw new NotFoundException(`Job-Work Challan #${id} not found.`);
    }

    const challan = existRes.rows[0];
    if (challan.status !== 'DRAFT') {
      throw new BadRequestException(`Challan #${challan.challan_no} cannot be dispatched because status is ${challan.status}.`);
    }

    const itemsRes = await this.pool.query(
      `SELECT
         challan_item_id, item_id, uom_id, sent_qty::FLOAT AS sent_qty,
         unit_rate::FLOAT AS unit_rate, total_value::FLOAT AS total_value,
         batch_no, heat_no
       FROM tbl_mfg_job_work_challan_item
       WHERE challan_id = $1 AND is_active = TRUE;`,
      [id],
    );

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Update Challan Header
      await client.query(
        `UPDATE tbl_mfg_job_work_challan
         SET status = 'DISPATCHED',
             dispatched_by = $1,
             dispatched_at = CURRENT_TIMESTAMP,
             transporter_name = COALESCE($2, transporter_name),
             vehicle_no = COALESCE($3, vehicle_no),
             eway_bill_no = COALESCE($4, eway_bill_no),
             remarks = COALESCE($5, remarks),
             updated_by = $1,
             updated_date = CURRENT_TIMESTAMP
         WHERE challan_id = $6;`,
        [
          user.userId || 1001,
          dto.transporterName || null,
          dto.vehicleNo || null,
          dto.ewayBillNo || null,
          dto.remarks || null,
          id,
        ],
      );

      // 2. Post Outward movements to Stock Ledger
      for (const it of itemsRes.rows) {
        await client.query(
          `INSERT INTO tbl_inv_stock_ledger (
             comp_id, branch_id, fyear_id, transaction_date, transaction_type,
             reference_doc_type, reference_doc_id, reference_doc_no,
             warehouse_id, item_id, uom_id, batch_no, heat_no,
             qty_in, qty_out, unit_cost, total_cost, closing_balance, remarks,
             is_active, created_by
           ) VALUES (
             $1, $2, $3, CURRENT_TIMESTAMP, 'PRODUCTION_ISSUE',
             'JOB_WORK_CHALLAN', $4, $5,
             $6, $7, $8, $9, $10,
             0.000, $11, $12, $13, 0.000, 'Job-Work Outward Dispatch under GST Section 143',
             TRUE, $14
           );`,
          [
            compId,
            user.branchId || 1001,
            user.fyearId || null,
            id,
            challan.challan_no,
            challan.from_warehouse_id,
            it.item_id,
            it.uom_id,
            it.batch_no || null,
            it.heat_no || null,
            it.sent_qty,
            it.unit_rate,
            it.total_value,
            user.userId || 1001,
          ],
        );
      }

      // 3. If linked to a Job Card, transition Job Card to IN_PROGRESS
      if (challan.job_card_id) {
        await client.query(
          `UPDATE tbl_mfg_job_card
           SET status = 'IN_PROGRESS',
               actual_start_time = COALESCE(actual_start_time, CURRENT_TIMESTAMP),
               updated_by = $1,
               updated_date = CURRENT_TIMESTAMP
           WHERE job_card_id = $2 AND status = 'PENDING';`,
          [user.userId || 1001, challan.job_card_id],
        );
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId: user.userId || 1001,
        username: user.username,
        compId,
        branchId: user.branchId || 1001,
        fyearId: user.fyearId || null,
        screenCode: 'MFG_JOB_WORK',
        actionType: 'DISPATCH',
        entityTable: 'tbl_mfg_job_work_challan',
        recordId: id,
        newValue: { status: 'DISPATCHED', dispatchedBy: user.userId },
      });

      return { message: `Challan #${challan.challan_no} successfully dispatched to subcontractor.` };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 8. Delete Outward Challan
  // --------------------------------------------------------------------------
  async deleteChallan(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const res = await this.pool.query(
      `SELECT challan_id, challan_no, status FROM tbl_mfg_job_work_challan WHERE challan_id = $1 AND comp_id = $2;`,
      [id, compId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Challan #${id} not found.`);
    }

    const challan = res.rows[0];
    if (challan.status !== 'DRAFT' && challan.status !== 'CANCELLED') {
      throw new BadRequestException(`Cannot delete challan #${challan.challan_no} in ${challan.status} status. Only DRAFT or CANCELLED allowed.`);
    }

    await this.pool.query(`DELETE FROM tbl_mfg_job_work_challan WHERE challan_id = $1;`, [id]);

    await this.auditLogService.logAction({
      userId: user.userId || 1001,
      username: user.username,
      compId,
      branchId: user.branchId || 1001,
      fyearId: user.fyearId || null,
      screenCode: 'MFG_JOB_WORK',
      actionType: 'DELETE',
      entityTable: 'tbl_mfg_job_work_challan',
      recordId: id,
      oldValue: challan,
    });

    return { message: `Job-Work Challan #${challan.challan_no} deleted successfully.` };
  }

  // --------------------------------------------------------------------------
  // 9. Inward Job-Work Receipts List
  // --------------------------------------------------------------------------
  async getReceipts(query: any, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const { challanId, vendorId, status, search } = query;

    let sql = `
      SELECT
        r.receipt_id,
        r.receipt_no,
        r.receipt_date,
        r.challan_id,
        c.challan_no,
        r.vendor_id,
        p.party_name AS vendor_name,
        r.wo_id,
        wo.wo_no,
        r.vendor_dc_no,
        r.vendor_dc_date,
        r.vendor_invoice_no,
        r.to_warehouse_id,
        wh.warehouse_name AS to_warehouse_name,
        r.service_charges::FLOAT AS service_charges,
        r.tax_amount::FLOAT AS tax_amount,
        r.total_amount::FLOAT AS total_amount,
        r.status,
        r.qc_status,
        u.full_name AS received_by_name,
        r.remarks,
        r.created_date,
        (SELECT COUNT(*)::INT FROM tbl_mfg_job_work_receipt_item ri WHERE ri.receipt_id = r.receipt_id AND ri.is_active = TRUE) AS total_items,
        COALESCE((SELECT SUM(ri.received_qty)::FLOAT FROM tbl_mfg_job_work_receipt_item ri WHERE ri.receipt_id = r.receipt_id AND ri.is_active = TRUE), 0) AS total_received_qty,
        COALESCE((SELECT SUM(ri.accepted_qty)::FLOAT FROM tbl_mfg_job_work_receipt_item ri WHERE ri.receipt_id = r.receipt_id AND ri.is_active = TRUE), 0) AS total_accepted_qty,
        COALESCE((SELECT SUM(ri.scrap_qty)::FLOAT FROM tbl_mfg_job_work_receipt_item ri WHERE ri.receipt_id = r.receipt_id AND ri.is_active = TRUE), 0) AS total_scrap_qty
      FROM tbl_mfg_job_work_receipt r
      JOIN tbl_mfg_job_work_challan c ON r.challan_id = c.challan_id
      JOIN tbl_crm_party p ON r.vendor_id = p.party_id
      LEFT JOIN tbl_mfg_wo_header wo ON r.wo_id = wo.wo_id
      JOIN tbl_inv_warehouse wh ON r.to_warehouse_id = wh.warehouse_id
      LEFT JOIN tbl_sec_user u ON r.received_by = u.user_id
      WHERE r.comp_id = $1 AND r.is_active = TRUE
    `;

    const params: any[] = [compId];
    let pIdx = 2;

    if (challanId) {
      sql += ` AND r.challan_id = $${pIdx++}`;
      params.push(challanId);
    }
    if (vendorId) {
      sql += ` AND r.vendor_id = $${pIdx++}`;
      params.push(vendorId);
    }
    if (status) {
      sql += ` AND r.status = $${pIdx++}`;
      params.push(status);
    }
    if (search) {
      sql += ` AND (r.receipt_no ILIKE $${pIdx} OR c.challan_no ILIKE $${pIdx} OR p.party_name ILIKE $${pIdx} OR r.vendor_dc_no ILIKE $${pIdx})`;
      params.push(`%${search}%`);
      pIdx++;
    }

    sql += ` ORDER BY r.receipt_id DESC;`;

    const res = await this.pool.query(sql, params);
    return res.rows;
  }

  // --------------------------------------------------------------------------
  // 10. Single Inward Receipt with Line Items
  // --------------------------------------------------------------------------
  async getReceiptById(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const res = await this.pool.query(
      `SELECT
         r.*,
         r.service_charges::FLOAT AS service_charges,
         r.tax_amount::FLOAT AS tax_amount,
         r.total_amount::FLOAT AS total_amount,
         c.challan_no,
         c.nature_of_processing,
         p.party_name AS vendor_name,
         p.party_code AS vendor_code,
         wo.wo_no,
         wh.warehouse_name AS to_warehouse_name,
         u.full_name AS received_by_name
       FROM tbl_mfg_job_work_receipt r
       JOIN tbl_mfg_job_work_challan c ON r.challan_id = c.challan_id
       JOIN tbl_crm_party p ON r.vendor_id = p.party_id
       LEFT JOIN tbl_mfg_wo_header wo ON r.wo_id = wo.wo_id
       JOIN tbl_inv_warehouse wh ON r.to_warehouse_id = wh.warehouse_id
       LEFT JOIN tbl_sec_user u ON r.received_by = u.user_id
       WHERE r.receipt_id = $1 AND r.comp_id = $2 AND r.is_active = TRUE;`,
      [id, compId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Job-Work Receipt #${id} not found.`);
    }

    const receipt = res.rows[0];

    const itemsRes = await this.pool.query(
      `SELECT
         ri.receipt_item_id,
         ri.receipt_id,
         ri.challan_item_id,
         ri.received_item_id,
         i.item_code,
         i.item_name,
         ri.uom_id,
         u.uom_code,
         ri.received_qty::FLOAT AS received_qty,
         ri.accepted_qty::FLOAT AS accepted_qty,
         ri.rejected_qty::FLOAT AS rejected_qty,
         ri.rework_qty::FLOAT AS rework_qty,
         ri.scrap_qty::FLOAT AS scrap_qty,
         ri.loss_qty::FLOAT AS loss_qty,
         ri.processing_rate::FLOAT AS processing_rate,
         ri.processing_amount::FLOAT AS processing_amount,
         ri.batch_no,
         ri.heat_no,
         ri.remarks
       FROM tbl_mfg_job_work_receipt_item ri
       JOIN tbl_inv_item i ON ri.received_item_id = i.item_id
       JOIN tbl_inv_uom u ON ri.uom_id = u.uom_id
       WHERE ri.receipt_id = $1 AND ri.is_active = TRUE
       ORDER BY ri.receipt_item_id ASC;`,
      [id],
    );

    return {
      ...receipt,
      items: itemsRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // 11. Create Inward Receipt (Receive Goods, Update Balances & Ledger)
  // --------------------------------------------------------------------------
  async createReceipt(dto: CreateJobWorkReceiptDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    // Verify Challan
    const challanRes = await this.pool.query(
      `SELECT
         challan_id, challan_no, status, wo_id, job_card_id, vendor_id, from_warehouse_id
       FROM tbl_mfg_job_work_challan
       WHERE challan_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [dto.challanId, compId],
    );

    if (challanRes.rows.length === 0) {
      throw new NotFoundException(`Outward Challan #${dto.challanId} not found.`);
    }

    const challan = challanRes.rows[0];
    if (challan.status === 'COMPLETED' || challan.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot receive goods against challan #${challan.challan_no} as it is in ${challan.status} status.`);
    }

    let receiptNo = dto.receiptNo;
    if (!receiptNo) {
      const seqRes = await this.pool.query(
        `SELECT COALESCE(MAX(receipt_id), 1000) + 1 AS next_seq FROM tbl_mfg_job_work_receipt;`,
      );
      const nextSeq = String(seqRes.rows[0].next_seq).padStart(4, '0');
      receiptNo = `JW-IN-AHM-2627-${nextSeq}`;
    }

    let totalServiceCharges = 0;
    for (const it of dto.items) {
      totalServiceCharges += Number(it.receivedQty) * Number(it.processingRate);
    }
    const taxAmount = Number(dto.taxAmount) || Math.round(totalServiceCharges * 0.18 * 100) / 100;
    const totalAmount = totalServiceCharges + taxAmount;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert Inward Receipt Header
      const insRes = await client.query(
        `INSERT INTO tbl_mfg_job_work_receipt (
           receipt_no, receipt_date, challan_id, vendor_id, wo_id,
           vendor_dc_no, vendor_dc_date, vendor_invoice_no, to_warehouse_id,
           service_charges, tax_amount, total_amount, status,
           received_by, qc_inspected_by, qc_status, remarks, is_active,
           comp_id, branch_id, fyear_id, created_by
         ) VALUES (
           $1, COALESCE($2, CURRENT_DATE), $3, $4, $5,
           $6, $7, $8, $9,
           $10, $11, $12, 'SUBMITTED',
           $13, $14, $15, $16, TRUE,
           $17, $18, $19, $20
         ) RETURNING receipt_id, receipt_no;`,
        [
          receiptNo,
          dto.receiptDate || null,
          dto.challanId,
          dto.vendorId || challan.vendor_id,
          dto.woId || challan.wo_id || null,
          dto.vendorDcNo || null,
          dto.vendorDcDate || null,
          dto.vendorInvoiceNo || null,
          dto.toWarehouseId,
          totalServiceCharges,
          taxAmount,
          totalAmount,
          user.userId || 1001,
          dto.qcStatus === 'ACCEPTED' ? (user.userId || 1001) : null,
          dto.qcStatus || 'ACCEPTED',
          dto.remarks || null,
          compId,
          branchId,
          user.fyearId || null,
          user.userId || 1001,
        ],
      );

      const receiptId = insRes.rows[0].receipt_id;

      // 2. Insert Inward Receipt Items & Update Challan Lines
      for (const it of dto.items) {
        const itemProcAmount = Number(it.receivedQty) * Number(it.processingRate);
        await client.query(
          `INSERT INTO tbl_mfg_job_work_receipt_item (
             receipt_id, challan_item_id, received_item_id, uom_id,
             received_qty, accepted_qty, rejected_qty, rework_qty, scrap_qty, loss_qty,
             processing_rate, processing_amount, batch_no, heat_no, remarks, is_active,
             comp_id, branch_id, fyear_id, created_by
           ) VALUES (
             $1, $2, $3, $4,
             $5, $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15, TRUE,
             $16, $17, $18, $19
           );`,
          [
            receiptId,
            it.challanItemId || null,
            it.receivedItemId,
            it.uomId,
            it.receivedQty,
            it.acceptedQty,
            it.rejectedQty || 0,
            it.reworkQty || 0,
            it.scrapQty || 0,
            it.lossQty || 0,
            it.processingRate,
            itemProcAmount,
            it.batchNo || null,
            it.heatNo || null,
            it.remarks || null,
            compId,
            branchId,
            user.fyearId || null,
            user.userId || 1001,
          ],
        );

        // Update Challan Item Cumulative Balances
        if (it.challanItemId) {
          await client.query(
            `UPDATE tbl_mfg_job_work_challan_item
             SET received_qty = received_qty + $1,
                 scrap_returned_qty = scrap_returned_qty + $2,
                 loss_qty = loss_qty + $3,
                 pending_qty = GREATEST(0, sent_qty - (received_qty + $1 + scrap_returned_qty + $2 + loss_qty + $3)),
                 updated_by = $4,
                 updated_date = CURRENT_TIMESTAMP
             WHERE challan_item_id = $5;`,
            [
              it.acceptedQty,
              it.scrapQty || 0,
              it.lossQty || 0,
              user.userId || 1001,
              it.challanItemId,
            ],
          );
        }

        // Post Inward stock ledger credit movement
        await client.query(
          `INSERT INTO tbl_inv_stock_ledger (
             comp_id, branch_id, fyear_id, transaction_date, transaction_type,
             reference_doc_type, reference_doc_id, reference_doc_no,
             warehouse_id, item_id, uom_id, batch_no, heat_no,
             qty_in, qty_out, unit_cost, total_cost, closing_balance, remarks,
             is_active, created_by
           ) VALUES (
             $1, $2, $3, CURRENT_TIMESTAMP, 'PUTAWAY_INWARD',
             'JOB_WORK_RECEIPT', $4, $5,
             $6, $7, $8, $9, $10,
             $11, 0.000, $12, $13, 0.000, 'Subcontracted Goods Inward Receipt & QC Acceptance',
             TRUE, $14
           );`,
          [
            compId,
            branchId,
            user.fyearId || null,
            receiptId,
            receiptNo,
            dto.toWarehouseId,
            it.receivedItemId,
            it.uomId,
            it.batchNo || null,
            it.heatNo || null,
            it.acceptedQty,
            it.processingRate,
            itemProcAmount,
            user.userId || 1001,
          ],
        );
      }

      // 3. Check if all items in Challan are completed
      const pendingCheck = await client.query(
        `SELECT COALESCE(SUM(pending_qty), 0)::FLOAT AS total_pending
         FROM tbl_mfg_job_work_challan_item
         WHERE challan_id = $1 AND is_active = TRUE;`,
        [dto.challanId],
      );

      const totalPending = pendingCheck.rows[0].total_pending;
      const newChallanStatus = totalPending <= 0 ? 'COMPLETED' : 'PARTIALLY_RECEIVED';

      await client.query(
        `UPDATE tbl_mfg_job_work_challan
         SET status = $1,
             updated_by = $2,
             updated_date = CURRENT_TIMESTAMP
         WHERE challan_id = $3;`,
        [newChallanStatus, user.userId || 1001, dto.challanId],
      );

      // 4. If linked to Work Order, accumulate subcontracting processing cost
      if (challan.wo_id) {
        await client.query(
          `UPDATE tbl_mfg_wo_header
           SET actual_operation_cost = actual_operation_cost + $1,
               updated_by = $2,
               updated_date = CURRENT_TIMESTAMP
           WHERE wo_id = $3;`,
          [totalServiceCharges, user.userId || 1001, challan.wo_id],
        );
      }

      // 5. If linked to Job Card, accumulate completed pieces
      if (challan.job_card_id) {
        const totalAccepted = dto.items.reduce((acc, it) => acc + Number(it.acceptedQty), 0);
        const totalScrap = dto.items.reduce((acc, it) => acc + Number(it.scrapQty || 0), 0);
        await client.query(
          `UPDATE tbl_mfg_job_card
           SET completed_qty = completed_qty + $1,
               scrapped_qty = scrapped_qty + $2,
               actual_cost = actual_cost + $3,
               in_process_qc_status = 'ACCEPTED',
               updated_by = $4,
               updated_date = CURRENT_TIMESTAMP
           WHERE job_card_id = $5;`,
          [totalAccepted, totalScrap, totalServiceCharges, user.userId || 1001, challan.job_card_id],
        );
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId: user.userId || 1001,
        username: user.username,
        compId,
        branchId,
        fyearId: user.fyearId || null,
        screenCode: 'MFG_JOB_WORK',
        actionType: 'RECEIVE',
        entityTable: 'tbl_mfg_job_work_receipt',
        recordId: receiptId,
        newValue: { receiptNo, challanId: dto.challanId, totalServiceCharges, newChallanStatus },
      });

      return {
        receiptId,
        receiptNo,
        newChallanStatus,
        message: `Inward Receipt #${receiptNo} recorded successfully. Challan status: ${newChallanStatus}.`,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 12. Reconcile & Close Challan
  // --------------------------------------------------------------------------
  async reconcileChallan(id: number, dto: ReconcileJobWorkChallanDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const existRes = await this.pool.query(
      `SELECT challan_id, challan_no, status FROM tbl_mfg_job_work_challan WHERE challan_id = $1 AND comp_id = $2;`,
      [id, compId],
    );

    if (existRes.rows.length === 0) {
      throw new NotFoundException(`Job-Work Challan #${id} not found.`);
    }

    const challan = existRes.rows[0];

    await this.pool.query(
      `UPDATE tbl_mfg_job_work_challan
       SET status = 'COMPLETED',
           remarks = CASE WHEN $1::TEXT IS NOT NULL THEN COALESCE(remarks, '') || ' [Reconciled: ' || $1 || ']' ELSE remarks END,
           updated_by = $2,
           updated_date = CURRENT_TIMESTAMP
       WHERE challan_id = $3;`,
      [dto.remarks || null, user.userId || 1001, id],
    );

    await this.auditLogService.logAction({
      userId: user.userId || 1001,
      username: user.username,
      compId,
      branchId: user.branchId || 1001,
      fyearId: user.fyearId || null,
      screenCode: 'MFG_JOB_WORK',
      actionType: 'RECONCILE',
      entityTable: 'tbl_mfg_job_work_challan',
      recordId: id,
      newValue: { status: 'COMPLETED', remarks: dto.remarks },
    });

    return { message: `Challan #${challan.challan_no} successfully reconciled and closed.` };
  }
}
