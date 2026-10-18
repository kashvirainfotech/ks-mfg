import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../../database/database.module';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { DependencyCheckService } from '../../../common/services/dependency-check.service';
import type {
  ApproveGrnDto,
  CancelGrnDto,
  CreateGrnDto,
  GrnFilterParams,
  QuarantinePutAwayDto,
  UpdateGrnDto,
} from './grn.dto';

@Injectable()
export class GrnService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  // --------------------------------------------------------------------------
  // KPI Summary
  // --------------------------------------------------------------------------
  async getGrnSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const sql = `
      SELECT
        COUNT(*)::INT AS total_grns,
        COUNT(CASE WHEN status IN ('SUBMITTED', 'QC_IN_PROGRESS') THEN 1 END)::INT AS qc_pending_count,
        COUNT(CASE WHEN status = 'APPROVED' THEN 1 END)::INT AS approved_count,
        COUNT(CASE WHEN status = 'DRAFT' THEN 1 END)::INT AS draft_count,
        COALESCE(SUM(CASE WHEN is_active = TRUE AND status != 'CANCELLED' THEN total_received_amount ELSE 0 END), 0)::FLOAT AS total_received_valuation
      FROM tbl_inv_grn_header
      WHERE comp_id = $1 AND is_active = TRUE
        AND ($2::BIGINT IS NULL OR branch_id = $2::BIGINT);
    `;

    const res = await this.pool.query(sql, [compId, branchId]);
    const r = res.rows[0] || {};
    return {
      totalGrns: Number(r.total_grns || 0),
      qcPendingCount: Number(r.qc_pending_count || 0),
      approvedCount: Number(r.approved_count || 0),
      draftCount: Number(r.draft_count || 0),
      totalReceivedValuation: Number(r.total_received_valuation || 0),
    };
  }

  // --------------------------------------------------------------------------
  // Document Number Generation (GRN-AHM-YYNextYY-XXXX)
  // --------------------------------------------------------------------------
  private async generateGrnNumber(
    compId: number,
    branchId: number,
  ): Promise<string> {
    const bRes = await this.pool.query(
      `SELECT branch_code FROM tbl_org_branch WHERE branch_id = $1 AND comp_id = $2;`,
      [branchId, compId],
    );
    const branchCode = bRes.rows[0]?.branch_code || 'HO';

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    let startYear = curYear;
    if (curMonth < 4) startYear = curYear - 1;
    const nextYear = startYear + 1;
    const fyearCode = `${String(startYear).slice(-2)}${String(nextYear).slice(-2)}`;

    const seqRes = await this.pool.query(
      `SELECT nextval('seq_grn_id') AS next_val;`,
    );
    const seq = String(seqRes.rows[0].next_val).padStart(4, '0');
    return `GRN-${branchCode}-${fyearCode}-${seq}`;
  }

  // --------------------------------------------------------------------------
  // Find All (Register Listing)
  // --------------------------------------------------------------------------
  async findAllGrns(filters: GrnFilterParams, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const conditions: string[] = [
      `g.comp_id = $1`,
      `g.is_active = TRUE`,
      `($2::BIGINT IS NULL OR g.branch_id = $2::BIGINT)`,
    ];
    const params: any[] = [compId, branchId];
    let idx = 3;

    if (filters.status) {
      conditions.push(`g.status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters.warehouseId) {
      conditions.push(`g.warehouse_id = $${idx++}`);
      params.push(filters.warehouseId);
    }
    if (filters.vendorId) {
      conditions.push(`g.vendor_id = $${idx++}`);
      params.push(filters.vendorId);
    }
    if (filters.poId) {
      conditions.push(`g.po_id = $${idx++}`);
      params.push(filters.poId);
    }
    if (filters.gateInwardId) {
      conditions.push(`g.gate_inward_id = $${idx++}`);
      params.push(filters.gateInwardId);
    }
    if (filters.startDate) {
      conditions.push(`g.grn_date >= $${idx++}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`g.grn_date <= $${idx++}`);
      params.push(filters.endDate);
    }
    if (filters.search) {
      conditions.push(`(
        g.grn_no ILIKE $${idx} OR
        g.challan_no ILIKE $${idx} OR
        g.invoice_no ILIKE $${idx} OR
        g.vehicle_no ILIKE $${idx} OR
        p.party_name ILIKE $${idx} OR
        w.warehouse_name ILIKE $${idx}
      )`);
      params.push(`%${filters.search}%`);
      idx++;
    }

    const sql = `
      SELECT
        g.grn_id AS "grnId",
        g.grn_no AS "grnNo",
        TO_CHAR(g.grn_date, 'YYYY-MM-DD') AS "grnDate",
        g.warehouse_id AS "warehouseId",
        w.warehouse_code AS "warehouseCode",
        w.warehouse_name AS "warehouseName",
        g.vendor_id AS "vendorId",
        p.party_code AS "vendorCode",
        p.party_name AS "vendorName",
        g.po_id AS "poId",
        po.po_no AS "poNo",
        g.gate_inward_id AS "gateInwardId",
        gin.gate_inward_no AS "gateInwardNo",
        g.challan_no AS "challanNo",
        TO_CHAR(g.challan_date, 'YYYY-MM-DD') AS "challanDate",
        g.invoice_no AS "invoiceNo",
        TO_CHAR(g.invoice_date, 'YYYY-MM-DD') AS "invoiceDate",
        g.vehicle_no AS "vehicleNo",
        g.eway_bill_no AS "ewayBillNo",
        g.lr_no AS "lrNo",
        TO_CHAR(g.lr_date, 'YYYY-MM-DD') AS "lrDate",
        ROUND(g.total_received_amount, 2)::FLOAT AS "totalReceivedAmount",
        g.status,
        g.store_remarks AS "storeRemarks",
        g.inspected_by AS "inspectedBy",
        u_ins.full_name AS "inspectedByName",
        TO_CHAR(g.inspection_date, 'YYYY-MM-DD HH24:MI:SS') AS "inspectionDate",
        g.approved_by AS "approvedBy",
        u_app.full_name AS "approvedByName",
        TO_CHAR(g.approval_date, 'YYYY-MM-DD HH24:MI:SS') AS "approvalDate",
        g.approval_remarks AS "approvalRemarks",
        g.cancel_reason AS "cancelReason",
        g.is_active AS "isActive",
        TO_CHAR(g.created_date, 'YYYY-MM-DD HH24:MI:SS') AS "createdDate",
        COALESCE(items.item_count, 0)::INT AS "itemCount",
        ROUND(COALESCE(items.total_received_qty, 0), 3)::FLOAT AS "totalReceivedQty"
      FROM tbl_inv_grn_header g
      LEFT JOIN tbl_inv_warehouse w ON g.warehouse_id = w.warehouse_id
      LEFT JOIN tbl_crm_party p ON g.vendor_id = p.party_id
      LEFT JOIN tbl_po_header po ON g.po_id = po.po_id
      LEFT JOIN tbl_gate_inward_header gin ON g.gate_inward_id = gin.gate_inward_id
      LEFT JOIN tbl_sec_user u_ins ON g.inspected_by = u_ins.user_id
      LEFT JOIN tbl_sec_user u_app ON g.approved_by = u_app.user_id
      LEFT JOIN (
        SELECT grn_id, COUNT(*) AS item_count, SUM(received_qty) AS total_received_qty
        FROM tbl_inv_grn_item
        WHERE is_active = TRUE
        GROUP BY grn_id
      ) items ON g.grn_id = items.grn_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY g.grn_date DESC, g.grn_id DESC;
    `;

    const res = await this.pool.query(sql, params);
    return res.rows;
  }

  // --------------------------------------------------------------------------
  // Find By ID (with Item Lines)
  // --------------------------------------------------------------------------
  async findGrnById(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const headSql = `
      SELECT
        g.grn_id AS "grnId",
        g.grn_no AS "grnNo",
        TO_CHAR(g.grn_date, 'YYYY-MM-DD') AS "grnDate",
        g.warehouse_id AS "warehouseId",
        w.warehouse_code AS "warehouseCode",
        w.warehouse_name AS "warehouseName",
        g.vendor_id AS "vendorId",
        p.party_code AS "vendorCode",
        p.party_name AS "vendorName",
        p.gstin AS "vendorGstin",
        p.address_line1 AS "vendorAddress",
        p.city AS "vendorCity",
        p.state_name AS "vendorState",
        g.po_id AS "poId",
        po.po_no AS "poNo",
        TO_CHAR(po.po_date, 'YYYY-MM-DD') AS "poDate",
        g.gate_inward_id AS "gateInwardId",
        gin.gate_inward_no AS "gateInwardNo",
        g.challan_no AS "challanNo",
        TO_CHAR(g.challan_date, 'YYYY-MM-DD') AS "challanDate",
        g.invoice_no AS "invoiceNo",
        TO_CHAR(g.invoice_date, 'YYYY-MM-DD') AS "invoiceDate",
        g.vehicle_no AS "vehicleNo",
        g.eway_bill_no AS "ewayBillNo",
        g.lr_no AS "lrNo",
        TO_CHAR(g.lr_date, 'YYYY-MM-DD') AS "lrDate",
        ROUND(g.total_received_amount, 2)::FLOAT AS "totalReceivedAmount",
        g.status,
        g.store_remarks AS "storeRemarks",
        g.inspected_by AS "inspectedBy",
        u_ins.full_name AS "inspectedByName",
        TO_CHAR(g.inspection_date, 'YYYY-MM-DD HH24:MI:SS') AS "inspectionDate",
        g.approved_by AS "approvedBy",
        u_app.full_name AS "approvedByName",
        TO_CHAR(g.approval_date, 'YYYY-MM-DD HH24:MI:SS') AS "approvalDate",
        g.approval_remarks AS "approvalRemarks",
        g.cancel_reason AS "cancelReason",
        g.is_active AS "isActive",
        TO_CHAR(g.created_date, 'YYYY-MM-DD HH24:MI:SS') AS "createdDate"
      FROM tbl_inv_grn_header g
      LEFT JOIN tbl_inv_warehouse w ON g.warehouse_id = w.warehouse_id
      LEFT JOIN tbl_crm_party p ON g.vendor_id = p.party_id
      LEFT JOIN tbl_po_header po ON g.po_id = po.po_id
      LEFT JOIN tbl_gate_inward_header gin ON g.gate_inward_id = gin.gate_inward_id
      LEFT JOIN tbl_sec_user u_ins ON g.inspected_by = u_ins.user_id
      LEFT JOIN tbl_sec_user u_app ON g.approved_by = u_app.user_id
      WHERE g.grn_id = $1 AND g.comp_id = $2;
    `;
    const hRes = await this.pool.query(headSql, [id, compId]);
    if (hRes.rows.length === 0) {
      throw new NotFoundException(`GRN #${id} not found.`);
    }
    const header = hRes.rows[0];

    const itemsSql = `
      SELECT
        gi.grn_item_id AS "grnItemId",
        gi.grn_id AS "grnId",
        gi.po_item_id AS "poItemId",
        gi.gate_inward_item_id AS "gateInwardItemId",
        gi.item_id AS "itemId",
        i.item_code AS "itemCode",
        COALESCE(gi.item_description, i.item_name) AS "itemDescription",
        gi.uom_id AS "uomId",
        u.uom_code AS "uomCode",
        u.uom_name AS "uomName",
        ROUND(gi.order_qty, 3)::FLOAT AS "orderQty",
        ROUND(gi.challan_qty, 3)::FLOAT AS "challanQty",
        ROUND(gi.received_qty, 3)::FLOAT AS "receivedQty",
        ROUND(gi.accepted_qty, 3)::FLOAT AS "acceptedQty",
        ROUND(gi.rejected_qty, 3)::FLOAT AS "rejectedQty",
        ROUND(gi.quarantine_qty, 3)::FLOAT AS "quarantineQty",
        ROUND(gi.shortage_qty, 3)::FLOAT AS "shortageQty",
        ROUND(gi.excess_qty, 3)::FLOAT AS "excessQty",
        ROUND(gi.unit_rate, 4)::FLOAT AS "unitRate",
        ROUND(gi.received_amount, 2)::FLOAT AS "receivedAmount",
        gi.batch_no AS "batchNo",
        TO_CHAR(gi.mfg_date, 'YYYY-MM-DD') AS "mfgDate",
        TO_CHAR(gi.expiry_date, 'YYYY-MM-DD') AS "expiryDate",
        gi.quarantine_bin_id AS "quarantineBinId",
        qb.bin_code AS "quarantineBinCode",
        qb.bin_name AS "quarantineBinName",
        gi.storage_bin_id AS "storageBinId",
        sb.bin_code AS "storageBinCode",
        sb.bin_name AS "storageBinName",
        gi.is_qc_required AS "isQcRequired",
        gi.remarks,
        gi.is_active AS "isActive"
      FROM tbl_inv_grn_item gi
      LEFT JOIN tbl_inv_item i ON gi.item_id = i.item_id
      LEFT JOIN tbl_inv_uom u ON gi.uom_id = u.uom_id
      LEFT JOIN tbl_inv_storage_bin qb ON gi.quarantine_bin_id = qb.bin_id
      LEFT JOIN tbl_inv_storage_bin sb ON gi.storage_bin_id = sb.bin_id
      WHERE gi.grn_id = $1 AND gi.is_active = TRUE
      ORDER BY gi.grn_item_id ASC;
    `;
    const iRes = await this.pool.query(itemsSql, [id]);

    return {
      ...header,
      items: iRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // Create GRN
  // --------------------------------------------------------------------------
  async createGrn(
    dto: CreateGrnDto,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item line is required for GRN.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const grnNo =
        dto.grnNo || (await this.generateGrnNumber(compId, branchId));

      let totalReceivedAmount = 0;
      for (const item of dto.items) {
        const lineAmount =
          Number(item.receivedQty || 0) * Number(item.unitRate || 0);
        totalReceivedAmount += lineAmount;
      }

      const initialStatus = dto.status || 'DRAFT';

      const insHeadSql = `
        INSERT INTO tbl_inv_grn_header (
          grn_no, grn_date, warehouse_id, vendor_id, po_id, gate_inward_id,
          challan_no, challan_date, invoice_no, invoice_date, vehicle_no,
          eway_bill_no, lr_no, lr_date, total_received_amount, status,
          store_remarks, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16,
          $17, TRUE,
          $18, $19, $20, $21
        )
        RETURNING grn_id;
      `;
      const headRes = await client.query(insHeadSql, [
        grnNo,
        dto.grnDate,
        dto.warehouseId,
        dto.vendorId,
        dto.poId || null,
        dto.gateInwardId || null,
        dto.challanNo.trim(),
        dto.challanDate,
        dto.invoiceNo?.trim() || null,
        dto.invoiceDate || null,
        dto.vehicleNo?.trim() || null,
        dto.ewayBillNo?.trim() || null,
        dto.lrNo?.trim() || null,
        dto.lrDate || null,
        totalReceivedAmount,
        initialStatus,
        dto.storeRemarks?.trim() || null,
        compId,
        branchId,
        fyearId,
        userId,
      ]);

      const grnId = headRes.rows[0].grn_id;

      for (const item of dto.items) {
        const cQty = Number(item.challanQty || 0);
        const rQty = Number(item.receivedQty || 0);
        const shortage = Math.max(0, cQty - rQty);
        const excess = Math.max(0, rQty - cQty);
        const lineAmount = rQty * Number(item.unitRate || 0);
        const isQc = item.isQcRequired !== false;
        const qQty = item.quarantineQty !== undefined ? Number(item.quarantineQty) : (isQc ? rQty : 0);
        const aQty = item.acceptedQty !== undefined ? Number(item.acceptedQty) : (isQc ? 0 : rQty);
        const rejQty = Number(item.rejectedQty || 0);

        const insItemSql = `
          INSERT INTO tbl_inv_grn_item (
            grn_id, po_item_id, gate_inward_item_id, item_id, item_description, uom_id,
            order_qty, challan_qty, received_qty, accepted_qty, rejected_qty,
            quarantine_qty, shortage_qty, excess_qty, unit_rate, received_amount,
            batch_no, mfg_date, expiry_date, quarantine_bin_id, storage_bin_id,
            is_qc_required, remarks, is_active,
            comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11,
            $12, $13, $14, $15, $16,
            $17, $18, $19, $20, $21,
            $22, $23, TRUE,
            $24, $25, $26, $27
          );
        `;
        await client.query(insItemSql, [
          grnId,
          item.poItemId || null,
          item.gateInwardItemId || null,
          item.itemId,
          item.itemDescription?.trim() || null,
          item.uomId,
          Number(item.orderQty || 0),
          cQty,
          rQty,
          aQty,
          rejQty,
          qQty,
          shortage,
          excess,
          Number(item.unitRate || 0),
          lineAmount,
          item.batchNo?.trim() || null,
          item.mfgDate || null,
          item.expiryDate || null,
          item.quarantineBinId || null,
          item.storageBinId || null,
          isQc,
          item.remarks?.trim() || null,
          compId,
          branchId,
          fyearId,
          userId,
        ]);
      }

      // If tied to Gate Inward, update status to GRN_PENDING if it was INWARDED or UNLOADED
      if (dto.gateInwardId) {
        await client.query(
          `UPDATE tbl_gate_inward_header
           SET status = 'GRN_PENDING', updated_by = $1, updated_date = CURRENT_TIMESTAMP
           WHERE gate_inward_id = $2 AND status IN ('INWARDED', 'UNLOADED');`,
          [userId, dto.gateInwardId],
        );
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PURCHASE_GRN',
        actionType: 'ADD',
        entityTable: 'tbl_inv_grn_header',
        recordId: grnId,
        newValue: { grnNo, challanNo: dto.challanNo, totalReceivedAmount },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findGrnById(grnId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Update GRN (Draft only)
  // --------------------------------------------------------------------------
  async updateGrn(
    id: number,
    dto: UpdateGrnDto,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    const existing = await this.pool.query(
      `SELECT status, grn_no FROM tbl_inv_grn_header WHERE grn_id = $1 AND comp_id = $2;`,
      [id, compId],
    );
    if (existing.rows.length === 0) {
      throw new NotFoundException(`GRN #${id} not found.`);
    }
    if (existing.rows[0].status !== 'DRAFT') {
      throw new BadRequestException(
        `Cannot edit GRN #${id} in '${existing.rows[0].status}' status. Only DRAFT GRNs can be modified.`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      let totalReceivedAmount: number | undefined = undefined;
      if (dto.items && dto.items.length > 0) {
        totalReceivedAmount = dto.items.reduce(
          (sum, item) =>
            sum + Number(item.receivedQty || 0) * Number(item.unitRate || 0),
          0,
        );
      }

      const updSql = `
        UPDATE tbl_inv_grn_header
        SET
          grn_date = COALESCE($1, grn_date),
          warehouse_id = COALESCE($2, warehouse_id),
          vendor_id = COALESCE($3, vendor_id),
          po_id = COALESCE($4, po_id),
          gate_inward_id = COALESCE($5, gate_inward_id),
          challan_no = COALESCE($6, challan_no),
          challan_date = COALESCE($7, challan_date),
          invoice_no = COALESCE($8, invoice_no),
          invoice_date = COALESCE($9, invoice_date),
          vehicle_no = COALESCE($10, vehicle_no),
          eway_bill_no = COALESCE($11, eway_bill_no),
          lr_no = COALESCE($12, lr_no),
          lr_date = COALESCE($13, lr_date),
          store_remarks = COALESCE($14, store_remarks),
          total_received_amount = COALESCE($15, total_received_amount),
          updated_by = $16,
          updated_date = CURRENT_TIMESTAMP
        WHERE grn_id = $17 AND comp_id = $18;
      `;
      await client.query(updSql, [
        dto.grnDate || null,
        dto.warehouseId || null,
        dto.vendorId || null,
        dto.poId || null,
        dto.gateInwardId || null,
        dto.challanNo?.trim() || null,
        dto.challanDate || null,
        dto.invoiceNo?.trim() || null,
        dto.invoiceDate || null,
        dto.vehicleNo?.trim() || null,
        dto.ewayBillNo?.trim() || null,
        dto.lrNo?.trim() || null,
        dto.lrDate || null,
        dto.storeRemarks?.trim() || null,
        totalReceivedAmount !== undefined ? totalReceivedAmount : null,
        userId,
        id,
        compId,
      ]);

      if (dto.items && dto.items.length > 0) {
        await client.query(
          `DELETE FROM tbl_inv_grn_item WHERE grn_id = $1;`,
          [id],
        );

        for (const item of dto.items) {
          const cQty = Number(item.challanQty || 0);
          const rQty = Number(item.receivedQty || 0);
          const shortage = Math.max(0, cQty - rQty);
          const excess = Math.max(0, rQty - cQty);
          const lineAmount = rQty * Number(item.unitRate || 0);
          const isQc = item.isQcRequired !== false;
          const qQty = item.quarantineQty !== undefined ? Number(item.quarantineQty) : (isQc ? rQty : 0);
          const aQty = item.acceptedQty !== undefined ? Number(item.acceptedQty) : (isQc ? 0 : rQty);
          const rejQty = Number(item.rejectedQty || 0);

          const insItemSql = `
            INSERT INTO tbl_inv_grn_item (
              grn_id, po_item_id, gate_inward_item_id, item_id, item_description, uom_id,
              order_qty, challan_qty, received_qty, accepted_qty, rejected_qty,
              quarantine_qty, shortage_qty, excess_qty, unit_rate, received_amount,
              batch_no, mfg_date, expiry_date, quarantine_bin_id, storage_bin_id,
              is_qc_required, remarks, is_active,
              comp_id, branch_id, fyear_id, created_by
            ) VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9, $10, $11,
              $12, $13, $14, $15, $16,
              $17, $18, $19, $20, $21,
              $22, $23, TRUE,
              $24, $25, $26, $27
            );
          `;
          await client.query(insItemSql, [
            id,
            item.poItemId || null,
            item.gateInwardItemId || null,
            item.itemId,
            item.itemDescription?.trim() || null,
            item.uomId,
            Number(item.orderQty || 0),
            cQty,
            rQty,
            aQty,
            rejQty,
            qQty,
            shortage,
            excess,
            Number(item.unitRate || 0),
            lineAmount,
            item.batchNo?.trim() || null,
            item.mfgDate || null,
            item.expiryDate || null,
            item.quarantineBinId || null,
            item.storageBinId || null,
            isQc,
            item.remarks?.trim() || null,
            compId,
            branchId,
            fyearId,
            userId,
          ]);
        }
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PURCHASE_GRN',
        actionType: 'EDIT',
        entityTable: 'tbl_inv_grn_header',
        recordId: id,
        oldValue: existing.rows[0],
        newValue: dto,
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findGrnById(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Submit GRN (DRAFT -> SUBMITTED)
  // --------------------------------------------------------------------------
  async submitGrn(
    id: number,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    const grnRes = await this.pool.query(
      `SELECT grn_id, grn_no, status FROM tbl_inv_grn_header WHERE grn_id = $1 AND comp_id = $2;`,
      [id, compId],
    );
    if (grnRes.rows.length === 0) {
      throw new NotFoundException(`GRN #${id} not found.`);
    }
    const current = grnRes.rows[0];
    if (current.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only DRAFT GRNs can be submitted. Current status: '${current.status}'.`,
      );
    }

    await this.pool.query(
      `UPDATE tbl_inv_grn_header
       SET status = 'SUBMITTED', updated_by = $1, updated_date = CURRENT_TIMESTAMP
       WHERE grn_id = $2;`,
      [userId, id],
    );

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'PURCHASE_GRN',
      actionType: 'SUBMIT',
      entityTable: 'tbl_inv_grn_header',
      recordId: id,
      oldValue: { status: 'DRAFT' },
      newValue: { status: 'SUBMITTED' },
      compId,
      branchId,
      fyearId,
      ...meta,
    });

    return this.findGrnById(id, user);
  }

  // --------------------------------------------------------------------------
  // Move to Quarantine & Put-Away (SUBMITTED / DRAFT -> QC_IN_PROGRESS)
  // --------------------------------------------------------------------------
  async putAwayQuarantine(
    id: number,
    dto: QuarantinePutAwayDto,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    const grnRes = await this.pool.query(
      `SELECT grn_id, grn_no, status FROM tbl_inv_grn_header WHERE grn_id = $1 AND comp_id = $2;`,
      [id, compId],
    );
    if (grnRes.rows.length === 0) {
      throw new NotFoundException(`GRN #${id} not found.`);
    }
    const current = grnRes.rows[0];
    if (['APPROVED', 'CANCELLED'].includes(current.status)) {
      throw new BadRequestException(
        `Cannot put away GRN in '${current.status}' status.`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE tbl_inv_grn_header
         SET
           status = 'QC_IN_PROGRESS',
           inspected_by = $1,
           inspection_date = CURRENT_TIMESTAMP,
           store_remarks = COALESCE($2, store_remarks),
           updated_by = $1,
           updated_date = CURRENT_TIMESTAMP
         WHERE grn_id = $3;`,
        [userId, dto.inspectionRemarks?.trim() || null, id],
      );

      if (dto.items && dto.items.length > 0) {
        for (const it of dto.items) {
          await client.query(
            `UPDATE tbl_inv_grn_item
             SET
               quarantine_bin_id = COALESCE($1, quarantine_bin_id),
               quarantine_qty = COALESCE($2, quarantine_qty),
               batch_no = COALESCE($3, batch_no),
               updated_by = $4,
               updated_date = CURRENT_TIMESTAMP
             WHERE grn_item_id = $5 AND grn_id = $6;`,
            [
              it.quarantineBinId || dto.quarantineBinId || null,
              it.quarantineQty !== undefined ? Number(it.quarantineQty) : null,
              it.batchNo?.trim() || null,
              userId,
              it.grnItemId,
              id,
            ],
          );
        }
      } else if (dto.quarantineBinId) {
        await client.query(
          `UPDATE tbl_inv_grn_item
           SET quarantine_bin_id = $1, updated_by = $2, updated_date = CURRENT_TIMESTAMP
           WHERE grn_id = $3 AND is_qc_required = TRUE;`,
          [dto.quarantineBinId, userId, id],
        );
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PURCHASE_GRN',
        actionType: 'EDIT',
        entityTable: 'tbl_inv_grn_header',
        recordId: id,
        oldValue: { status: current.status },
        newValue: { status: 'QC_IN_PROGRESS', ...dto },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findGrnById(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Approve GRN (Store Inward Clearance & Upstream PO / Gate Sync)
  // --------------------------------------------------------------------------
  async approveGrn(
    id: number,
    dto: ApproveGrnDto,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    const grnRes = await this.pool.query(
      `SELECT grn_id, grn_no, po_id, gate_inward_id, status FROM tbl_inv_grn_header WHERE grn_id = $1 AND comp_id = $2;`,
      [id, compId],
    );
    if (grnRes.rows.length === 0) {
      throw new NotFoundException(`GRN #${id} not found.`);
    }
    const current = grnRes.rows[0];
    if (current.status === 'APPROVED') {
      throw new BadRequestException(`GRN #${id} is already approved.`);
    }
    if (current.status === 'CANCELLED') {
      throw new BadRequestException(`Cancelled GRN cannot be approved.`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Update items disposition if passed, else auto-clear
      if (dto.items && dto.items.length > 0) {
        for (const it of dto.items) {
          await client.query(
            `UPDATE tbl_inv_grn_item
             SET
               accepted_qty = COALESCE($1, accepted_qty),
               rejected_qty = COALESCE($2, rejected_qty),
               storage_bin_id = COALESCE($3, storage_bin_id),
               quarantine_qty = 0,
               remarks = COALESCE($4, remarks),
               updated_by = $5,
               updated_date = CURRENT_TIMESTAMP
             WHERE grn_item_id = $6 AND grn_id = $7;`,
            [
              it.acceptedQty !== undefined ? Number(it.acceptedQty) : null,
              it.rejectedQty !== undefined ? Number(it.rejectedQty) : null,
              it.storageBinId || null,
              it.remarks?.trim() || null,
              userId,
              it.grnItemId,
              id,
            ],
          );
        }
      } else {
        // Auto-accept all items: accepted_qty = received_qty - rejected_qty, quarantine_qty = 0
        await client.query(
          `UPDATE tbl_inv_grn_item
           SET
             accepted_qty = GREATEST(0, received_qty - rejected_qty),
             quarantine_qty = 0,
             updated_by = $1,
             updated_date = CURRENT_TIMESTAMP
           WHERE grn_id = $2;`,
          [userId, id],
        );
      }

      // 2. Mark GRN Header as APPROVED
      await client.query(
        `UPDATE tbl_inv_grn_header
         SET
           status = 'APPROVED',
           approved_by = $1,
           approval_date = CURRENT_TIMESTAMP,
           approval_remarks = $2,
           updated_by = $1,
           updated_date = CURRENT_TIMESTAMP
         WHERE grn_id = $3;`,
        [userId, dto.approvalRemarks?.trim() || null, id],
      );

      // 3. Update upstream PO items received quantities
      const itemsRes = await client.query(
        `SELECT po_item_id, received_qty FROM tbl_inv_grn_item WHERE grn_id = $1 AND po_item_id IS NOT NULL AND is_active = TRUE;`,
        [id],
      );
      for (const item of itemsRes.rows) {
        await client.query(
          `UPDATE tbl_po_item
           SET received_qty = COALESCE(received_qty, 0) + $1, updated_by = $2, updated_date = CURRENT_TIMESTAMP
           WHERE po_item_id = $3;`,
          [Number(item.received_qty), userId, item.po_item_id],
        );
      }

      // 4. Update upstream PO status if applicable
      if (current.po_id) {
        const poCheck = await client.query(
          `SELECT
             COUNT(*)::INT AS total_items,
             COUNT(CASE WHEN received_qty >= order_qty THEN 1 END)::INT AS fulfilled_items,
             COALESCE(SUM(received_qty), 0)::FLOAT AS total_rec
           FROM tbl_po_item
           WHERE po_id = $1 AND is_active = TRUE;`,
          [current.po_id],
        );
        const { total_items, fulfilled_items, total_rec } = poCheck.rows[0];
        if (total_items > 0 && fulfilled_items === total_items) {
          await client.query(
            `UPDATE tbl_po_header
             SET status = 'COMPLETED', updated_by = $1, updated_date = CURRENT_TIMESTAMP
             WHERE po_id = $2;`,
            [userId, current.po_id],
          );
        } else if (total_rec > 0) {
          await client.query(
            `UPDATE tbl_po_header
             SET status = 'PARTIALLY_RECEIVED', updated_by = $1, updated_date = CURRENT_TIMESTAMP
             WHERE po_id = $2 AND status != 'COMPLETED';`,
            [userId, current.po_id],
          );
        }
      }

      // 5. Update upstream Gate Inward status to COMPLETED
      if (current.gate_inward_id) {
        await client.query(
          `UPDATE tbl_gate_inward_header
           SET status = 'COMPLETED', updated_by = $1, updated_date = CURRENT_TIMESTAMP
           WHERE gate_inward_id = $2;`,
          [userId, current.gate_inward_id],
        );
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PURCHASE_GRN',
        actionType: 'APPROVE',
        entityTable: 'tbl_inv_grn_header',
        recordId: id,
        oldValue: { status: current.status },
        newValue: { status: 'APPROVED', remarks: dto.approvalRemarks },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findGrnById(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Cancel GRN
  // --------------------------------------------------------------------------
  async cancelGrn(
    id: number,
    dto: CancelGrnDto,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    if (!dto.cancelReason || dto.cancelReason.trim() === '') {
      throw new BadRequestException('A cancellation reason is required.');
    }

    const grnRes = await this.pool.query(
      `SELECT grn_id, grn_no, po_id, gate_inward_id, status FROM tbl_inv_grn_header WHERE grn_id = $1 AND comp_id = $2;`,
      [id, compId],
    );
    if (grnRes.rows.length === 0) {
      throw new NotFoundException(`GRN #${id} not found.`);
    }
    const current = grnRes.rows[0];
    if (current.status === 'CANCELLED') {
      throw new BadRequestException(`GRN #${id} is already cancelled.`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // If it was APPROVED, reverse the PO item quantities
      if (current.status === 'APPROVED') {
        const itemsRes = await client.query(
          `SELECT po_item_id, received_qty FROM tbl_inv_grn_item WHERE grn_id = $1 AND po_item_id IS NOT NULL AND is_active = TRUE;`,
          [id],
        );
        for (const item of itemsRes.rows) {
          await client.query(
            `UPDATE tbl_po_item
             SET received_qty = GREATEST(0, COALESCE(received_qty, 0) - $1), updated_by = $2, updated_date = CURRENT_TIMESTAMP
             WHERE po_item_id = $3;`,
            [Number(item.received_qty), userId, item.po_item_id],
          );
        }

        if (current.po_id) {
          const poCheck = await client.query(
            `SELECT
               COUNT(*)::INT AS total_items,
               COUNT(CASE WHEN received_qty >= order_qty THEN 1 END)::INT AS fulfilled_items,
               COALESCE(SUM(received_qty), 0)::FLOAT AS total_rec
             FROM tbl_po_item
             WHERE po_id = $1 AND is_active = TRUE;`,
            [current.po_id],
          );
          const { total_items, fulfilled_items, total_rec } = poCheck.rows[0];
          let nextPoStatus = 'RELEASED';
          if (total_items > 0 && fulfilled_items === total_items) {
            nextPoStatus = 'COMPLETED';
          } else if (total_rec > 0) {
            nextPoStatus = 'PARTIALLY_RECEIVED';
          }
          await client.query(
            `UPDATE tbl_po_header
             SET status = $1, updated_by = $2, updated_date = CURRENT_TIMESTAMP
             WHERE po_id = $3;`,
            [nextPoStatus, userId, current.po_id],
          );
        }
      }

      await client.query(
        `UPDATE tbl_inv_grn_header
         SET
           status = 'CANCELLED',
           cancel_reason = $1,
           updated_by = $2,
           updated_date = CURRENT_TIMESTAMP
         WHERE grn_id = $3;`,
        [dto.cancelReason.trim(), userId, id],
      );

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PURCHASE_GRN',
        actionType: 'CANCEL',
        entityTable: 'tbl_inv_grn_header',
        recordId: id,
        oldValue: { status: current.status },
        newValue: { status: 'CANCELLED', cancelReason: dto.cancelReason },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findGrnById(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Delete GRN (DRAFT only)
  // --------------------------------------------------------------------------
  async deleteGrn(
    id: number,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    const grnRes = await this.pool.query(
      `SELECT grn_id, grn_no, status FROM tbl_inv_grn_header WHERE grn_id = $1 AND comp_id = $2;`,
      [id, compId],
    );
    if (grnRes.rows.length === 0) {
      throw new NotFoundException(`GRN #${id} not found.`);
    }
    const current = grnRes.rows[0];
    if (current.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only DRAFT GRNs can be permanently deleted. Current status: '${current.status}'.`,
      );
    }

    await this.dependencyCheckService.verifyCanDelete({
      entity: 'Goods Receipt Note',
      entityId: id,
      relations: [],
    });

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM tbl_inv_grn_item WHERE grn_id = $1;`, [id]);
      await client.query(`DELETE FROM tbl_inv_grn_header WHERE grn_id = $1;`, [id]);
      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PURCHASE_GRN',
        actionType: 'DELETE',
        entityTable: 'tbl_inv_grn_header',
        recordId: id,
        oldValue: current,
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return { success: true, message: `GRN ${current.grn_no} deleted successfully.` };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Helpers: Pending Gate Inwards for GRN
  // --------------------------------------------------------------------------
  async getPendingGateInwards(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const sql = `
      SELECT
        g.gate_inward_id AS "gateInwardId",
        g.gate_inward_no AS "gateInwardNo",
        TO_CHAR(g.inward_date, 'YYYY-MM-DD') AS "inwardDate",
        g.warehouse_id AS "warehouseId",
        w.warehouse_name AS "warehouseName",
        g.vendor_id AS "vendorId",
        p.party_name AS "vendorName",
        g.po_id AS "poId",
        po.po_no AS "poNo",
        g.challan_no AS "challanNo",
        TO_CHAR(g.challan_date, 'YYYY-MM-DD') AS "challanDate",
        g.vehicle_no AS "vehicleNo",
        g.eway_bill_no AS "ewayBillNo",
        g.lr_no AS "lrNo",
        TO_CHAR(g.lr_date, 'YYYY-MM-DD') AS "lrDate",
        g.status
      FROM tbl_gate_inward_header g
      LEFT JOIN tbl_inv_warehouse w ON g.warehouse_id = w.warehouse_id
      LEFT JOIN tbl_crm_party p ON g.vendor_id = p.party_id
      LEFT JOIN tbl_po_header po ON g.po_id = po.po_id
      WHERE g.comp_id = $1 AND g.is_active = TRUE
        AND ($2::BIGINT IS NULL OR g.branch_id = $2::BIGINT)
        AND g.status IN ('INWARDED', 'UNLOADED', 'GRN_PENDING')
      ORDER BY g.inward_date DESC, g.gate_inward_id DESC;
    `;
    const res = await this.pool.query(sql, [compId, branchId]);
    return res.rows;
  }

  // --------------------------------------------------------------------------
  // Helpers: Purchase Orders for GRN
  // --------------------------------------------------------------------------
  async getApprovedPurchaseOrders(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const sql = `
      SELECT
        po.po_id AS "poId",
        po.po_no AS "poNo",
        TO_CHAR(po.po_date, 'YYYY-MM-DD') AS "poDate",
        po.vendor_id AS "vendorId",
        p.party_name AS "vendorName",
        po.status,
        ROUND(po.total_amount, 2)::FLOAT AS "totalAmount"
      FROM tbl_po_header po
      LEFT JOIN tbl_crm_party p ON po.vendor_id = p.party_id
      WHERE po.comp_id = $1 AND po.is_active = TRUE
        AND ($2::BIGINT IS NULL OR po.branch_id = $2::BIGINT)
        AND po.status IN ('APPROVED', 'RELEASED', 'PARTIALLY_RECEIVED')
      ORDER BY po.po_date DESC, po.po_id DESC;
    `;
    const res = await this.pool.query(sql, [compId, branchId]);
    return res.rows;
  }

  // --------------------------------------------------------------------------
  // Helpers: Purchase Order Items by PO ID
  // --------------------------------------------------------------------------
  async getPoItems(poId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const sql = `
      SELECT
        poi.po_item_id AS "poItemId",
        poi.po_id AS "poId",
        poi.item_id AS "itemId",
        i.item_code AS "itemCode",
        i.item_name AS "itemName",
        COALESCE(poi.technical_specs, i.description, i.item_name) AS "itemDescription",
        poi.uom_id AS "uomId",
        u.uom_code AS "uomCode",
        ROUND(poi.order_qty, 3)::FLOAT AS "orderQty",
        ROUND(poi.received_qty, 3)::FLOAT AS "receivedQty",
        ROUND(GREATEST(0, poi.order_qty - poi.received_qty), 3)::FLOAT AS "pendingQty",
        ROUND(poi.unit_rate, 4)::FLOAT AS "unitRate",
        i.is_qc_inspection_required AS "isQcRequired",
        i.default_bin_id AS "defaultBinId"
      FROM tbl_po_item poi
      LEFT JOIN tbl_inv_item i ON poi.item_id = i.item_id
      LEFT JOIN tbl_inv_uom u ON poi.uom_id = u.uom_id
      WHERE poi.po_id = $1 AND poi.comp_id = $2 AND poi.is_active = TRUE
      ORDER BY poi.po_item_id ASC;
    `;
    const res = await this.pool.query(sql, [poId, compId]);
    return res.rows;
  }

  // --------------------------------------------------------------------------
  // Helpers: Storage Bins by Warehouse
  // --------------------------------------------------------------------------
  async getStorageBins(warehouseId?: number, user?: AuthenticatedUserContext) {
    const compId = user?.compId || 1001;

    const conditions: string[] = [`b.comp_id = $1`, `b.is_active = TRUE`];
    const params: any[] = [compId];

    if (warehouseId) {
      conditions.push(`b.warehouse_id = $2`);
      params.push(warehouseId);
    }

    const sql = `
      SELECT
        b.bin_id AS "binId",
        b.warehouse_id AS "warehouseId",
        w.warehouse_name AS "warehouseName",
        b.bin_code AS "binCode",
        b.bin_name AS "binName",
        b.bin_type AS "binType",
        b.is_receiving_staging AS "isReceivingStaging",
        b.is_blocked_for_putaway AS "isBlockedForPutaway"
      FROM tbl_inv_storage_bin b
      LEFT JOIN tbl_inv_warehouse w ON b.warehouse_id = w.warehouse_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY b.warehouse_id ASC, b.bin_code ASC;
    `;
    const res = await this.pool.query(sql, params);
    return res.rows;
  }
}
