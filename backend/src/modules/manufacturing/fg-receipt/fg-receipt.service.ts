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
  CreateFgReceiptDto,
  UpdateFgReceiptDto,
  QcInspectionFgReceiptDto,
  PostFgReceiptDto,
} from './fg-receipt.dto';

interface AuthenticatedUserContext {
  userId: number;
  username?: string;
  compId: number;
  branchId: number;
  fyearId?: number;
}

@Injectable()
export class FgReceiptService {
  private readonly logger = new Logger(FgReceiptService.name);

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
         COUNT(*)::INT AS total_receipts,
         COUNT(CASE WHEN status = 'POSTED' THEN 1 END)::INT AS posted_receipts,
         COUNT(CASE WHEN status = 'DRAFT' THEN 1 END)::INT AS draft_receipts,
         COALESCE(SUM(accepted_qty), 0)::FLOAT AS total_accepted_qty,
         COALESCE(SUM(CASE WHEN status = 'POSTED' THEN total_cost ELSE 0 END), 0)::FLOAT AS total_absorbed_cost,
         COALESCE(SUM(byproduct_credit), 0)::FLOAT AS total_byproduct_credit
       FROM tbl_mfg_fg_receipt_header
       WHERE comp_id = $1 AND is_active = TRUE;`,
      [compId],
    );

    const row = res.rows[0];
    return {
      totalReceipts: row.total_receipts || 0,
      postedReceipts: row.posted_receipts || 0,
      draftReceipts: row.draft_receipts || 0,
      totalAcceptedQty: row.total_accepted_qty || 0,
      totalAbsorbedCost: row.total_absorbed_cost || 0,
      totalByproductCredit: row.total_byproduct_credit || 0,
    };
  }

  // --------------------------------------------------------------------------
  // 2. Dropdown Lookups
  // --------------------------------------------------------------------------
  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const [wosRes, whRes, binsRes, itemsRes, uomsRes] = await Promise.all([
      // 1. Active Work Orders with Item, BOM, Target Warehouse & Absorbed Costs
      this.pool.query(
        `SELECT
           wo.wo_id, wo.wo_no, wo.item_id, wo.bom_id, wo.routing_id,
           wo.planned_qty::FLOAT AS planned_qty,
           wo.completed_qty::FLOAT AS completed_qty,
           wo.scrapped_qty::FLOAT AS scrapped_qty,
           wo.batch_no, wo.target_warehouse_id, wo.status,
           wo.actual_material_cost::FLOAT AS actual_material_cost,
           wo.actual_operation_cost::FLOAT AS actual_operation_cost,
           wo.actual_total_cost::FLOAT AS actual_total_cost,
           i.item_code, i.item_name, i.drawing_no, i.revision_no,
           u.uom_id, u.uom_code, u.uom_name,
           wh.warehouse_code AS target_warehouse_code, wh.warehouse_name AS target_warehouse_name
         FROM tbl_mfg_wo_header wo
         JOIN tbl_inv_item i ON wo.item_id = i.item_id
         JOIN tbl_inv_uom u ON wo.uom_id = u.uom_id
         LEFT JOIN tbl_inv_warehouse wh ON wo.target_warehouse_id = wh.warehouse_id
         WHERE wo.comp_id = $1 AND wo.is_active = TRUE AND wo.status IN ('RELEASED', 'IN_PROGRESS', 'COMPLETED')
         ORDER BY wo.wo_no DESC;`,
        [compId],
      ),
      // 2. Warehouses (FG and Scrap)
      this.pool.query(
        `SELECT warehouse_id, warehouse_code, warehouse_name, warehouse_type
         FROM tbl_inv_warehouse
         WHERE comp_id = $1 AND is_active = TRUE
         ORDER BY warehouse_name ASC;`,
        [compId],
      ),
      // 3. Storage Bins
      this.pool.query(
        `SELECT bin_id, warehouse_id, bin_code, bin_name, zone_code
         FROM tbl_inv_storage_bin
         WHERE comp_id = $1 AND is_active = TRUE
         ORDER BY bin_code ASC;`,
        [compId],
      ),
      // 4. Items (Scrap & By-Product candidates or all active items)
      this.pool.query(
        `SELECT
           i.item_id, i.item_code, i.item_name, i.item_type,
           i.standard_cost::FLOAT AS standard_cost,
           u.uom_id, u.uom_code, u.uom_name
         FROM tbl_inv_item i
         JOIN tbl_inv_uom u ON i.base_uom_id = u.uom_id
         WHERE i.comp_id = $1 AND i.is_active = TRUE
         ORDER BY i.item_code ASC;`,
        [compId],
      ),
      // 5. Units of Measure
      this.pool.query(
        `SELECT uom_id, uom_code, uom_name, uom_type
         FROM tbl_inv_uom
         WHERE comp_id = $1 AND is_active = TRUE
         ORDER BY uom_code ASC;`,
        [compId],
      ),
    ]);

    return {
      workOrders: wosRes.rows,
      warehouses: whRes.rows,
      bins: binsRes.rows,
      items: itemsRes.rows,
      uoms: uomsRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // 3. BOM By-Product Suggestion Helper for a Work Order
  // --------------------------------------------------------------------------
  async getWoBomByproducts(woId: number, receivedQty: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    // Fetch parent BOM ID from Work Order
    const woRes = await this.pool.query(
      `SELECT wo.bom_id, b.output_qty::FLOAT AS bom_output_qty
       FROM tbl_mfg_wo_header wo
       LEFT JOIN tbl_mfg_bom_header b ON wo.bom_id = b.bom_id
       WHERE wo.wo_id = $1 AND wo.comp_id = $2;`,
      [woId, compId],
    );

    if (woRes.rows.length === 0 || !woRes.rows[0].bom_id) {
      return [];
    }

    const bomId = woRes.rows[0].bom_id;
    const bomOutputQty = woRes.rows[0].bom_output_qty || 1.0;
    const scaleRatio = receivedQty > 0 ? receivedQty / bomOutputQty : 1.0;

    // Fetch default scrap warehouse if available
    const whRes = await this.pool.query(
      `SELECT warehouse_id FROM tbl_inv_warehouse
       WHERE comp_id = $1 AND is_active = TRUE AND warehouse_type = 'SCRAP_REJECTION'
       LIMIT 1;`,
      [compId],
    );
    const defaultScrapWhId = whRes.rows[0]?.warehouse_id || null;

    const bpRes = await this.pool.query(
      `SELECT
         bp.bom_byproduct_id, bp.item_id, bp.uom_id, bp.product_type,
         (bp.quantity::FLOAT * $3)::FLOAT AS quantity,
         bp.estimated_recovery_rate::FLOAT AS recovery_rate,
         ((bp.quantity::FLOAT * $3) * bp.estimated_recovery_rate::FLOAT)::FLOAT AS total_recovery_value,
         i.item_code, i.item_name,
         u.uom_code, u.uom_name
       FROM tbl_mfg_bom_byproduct bp
       JOIN tbl_inv_item i ON bp.item_id = i.item_id
       JOIN tbl_inv_uom u ON bp.uom_id = u.uom_id
       WHERE bp.bom_id = $1 AND bp.comp_id = $2 AND bp.is_active = TRUE;`,
      [bomId, compId, scaleRatio],
    );

    return bpRes.rows.map((row) => ({
      itemId: row.item_id,
      itemCode: row.item_code,
      itemName: row.item_name,
      uomId: row.uom_id,
      uomCode: row.uom_code,
      productType: row.product_type,
      quantity: Number(row.quantity.toFixed(3)),
      recoveryRate: Number(row.recovery_rate.toFixed(4)),
      totalRecoveryValue: Number(row.total_recovery_value.toFixed(2)),
      toWarehouseId: defaultScrapWhId,
      toBinId: null,
      remarks: `Suggested from BOM #${bomId} for production batch ${receivedQty}`,
    }));
  }

  // --------------------------------------------------------------------------
  // 4. Work Order Absorption Cost Estimator
  // --------------------------------------------------------------------------
  async getWoAbsorptionCostEstimate(woId: number, receivedQty: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const woRes = await this.pool.query(
      `SELECT
         wo.planned_qty::FLOAT AS planned_qty,
         wo.completed_qty::FLOAT AS completed_qty,
         wo.actual_material_cost::FLOAT AS actual_material_cost,
         wo.actual_operation_cost::FLOAT AS actual_operation_cost,
         wo.actual_total_cost::FLOAT AS actual_total_cost
       FROM tbl_mfg_wo_header wo
       WHERE wo.wo_id = $1 AND wo.comp_id = $2;`,
      [woId, compId],
    );

    if (woRes.rows.length === 0) {
      throw new NotFoundException(`Work Order #${woId} not found.`);
    }

    const wo = woRes.rows[0];
    const plannedQty = wo.planned_qty > 0 ? wo.planned_qty : 1.0;
    const ratio = receivedQty > 0 ? receivedQty / plannedQty : 1.0;

    const estimatedMaterialCost = Number((wo.actual_material_cost * ratio).toFixed(2));
    const estimatedOperationCost = Number((wo.actual_operation_cost * ratio).toFixed(2));
    const estimatedTotalCost = Number((estimatedMaterialCost + estimatedOperationCost).toFixed(2));
    const estimatedUnitCost = receivedQty > 0 ? Number((estimatedTotalCost / receivedQty).toFixed(4)) : 0;

    return {
      plannedQty: wo.planned_qty,
      completedQty: wo.completed_qty,
      woActualMaterialCost: wo.actual_material_cost,
      woActualOperationCost: wo.actual_operation_cost,
      estimatedMaterialCost,
      estimatedOperationCost,
      estimatedTotalCost,
      estimatedUnitCost,
    };
  }

  // --------------------------------------------------------------------------
  // 5. Listing with Filters & Pagination
  // --------------------------------------------------------------------------
  async findAll(
    filters: {
      status?: string;
      woId?: number;
      itemId?: number;
      warehouseId?: number;
      startDate?: string;
      endDate?: string;
      search?: string;
      page?: number;
      limit?: number;
    },
    user: AuthenticatedUserContext,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filters.limit) || 25));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['r.comp_id = $1', 'r.is_active = TRUE'];
    const params: any[] = [compId];
    let paramIndex = 2;

    if (filters.status) {
      conditions.push(`r.status = $${paramIndex}`);
      params.push(filters.status);
      paramIndex++;
    }

    if (filters.woId) {
      conditions.push(`r.wo_id = $${paramIndex}`);
      params.push(filters.woId);
      paramIndex++;
    }

    if (filters.itemId) {
      conditions.push(`r.item_id = $${paramIndex}`);
      params.push(filters.itemId);
      paramIndex++;
    }

    if (filters.warehouseId) {
      conditions.push(`r.to_warehouse_id = $${paramIndex}`);
      params.push(filters.warehouseId);
      paramIndex++;
    }

    if (filters.startDate) {
      conditions.push(`r.receipt_date >= $${paramIndex}`);
      params.push(filters.startDate);
      paramIndex++;
    }

    if (filters.endDate) {
      conditions.push(`r.receipt_date <= $${paramIndex}`);
      params.push(filters.endDate);
      paramIndex++;
    }

    if (filters.search) {
      conditions.push(
        `(r.receipt_no ILIKE $${paramIndex} OR r.batch_no ILIKE $${paramIndex} OR r.heat_no ILIKE $${paramIndex} OR wo.wo_no ILIKE $${paramIndex} OR i.item_code ILIKE $${paramIndex} OR i.item_name ILIKE $${paramIndex})`,
      );
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*)::INT AS total
      FROM tbl_mfg_fg_receipt_header r
      JOIN tbl_mfg_wo_header wo ON r.wo_id = wo.wo_id
      JOIN tbl_inv_item i ON r.item_id = i.item_id
      ${whereClause};
    `;

    const dataSql = `
      SELECT
        r.fg_receipt_id, r.receipt_no, r.receipt_date, r.wo_id, r.item_id, r.uom_id,
        r.to_warehouse_id, r.to_bin_id, r.batch_no, r.heat_no, r.manufacturing_date, r.expiry_date,
        r.received_qty::FLOAT AS received_qty,
        r.accepted_qty::FLOAT AS accepted_qty,
        r.rejected_qty::FLOAT AS rejected_qty,
        r.rework_qty::FLOAT AS rework_qty,
        r.qc_status, r.qc_inspected_by, r.qc_inspected_at, r.qc_remarks,
        r.material_cost::FLOAT AS material_cost,
        r.operation_cost::FLOAT AS operation_cost,
        r.byproduct_credit::FLOAT AS byproduct_credit,
        r.total_cost::FLOAT AS total_cost,
        r.unit_cost::FLOAT AS unit_cost,
        r.status, r.posted_by, r.posted_at, r.remarks, r.created_date,
        wo.wo_no, wo.planned_qty::FLOAT AS wo_planned_qty, wo.completed_qty::FLOAT AS wo_completed_qty,
        i.item_code, i.item_name, i.drawing_no,
        u.uom_code, u.uom_name,
        wh.warehouse_code, wh.warehouse_name,
        bin.bin_code,
        qc_u.full_name AS qc_inspector_name,
        post_u.full_name AS posted_by_name,
        (SELECT COUNT(*)::INT FROM tbl_mfg_fg_receipt_byproduct bp WHERE bp.fg_receipt_id = r.fg_receipt_id AND bp.is_active = TRUE) AS byproduct_count
      FROM tbl_mfg_fg_receipt_header r
      JOIN tbl_mfg_wo_header wo ON r.wo_id = wo.wo_id
      JOIN tbl_inv_item i ON r.item_id = i.item_id
      JOIN tbl_inv_uom u ON r.uom_id = u.uom_id
      JOIN tbl_inv_warehouse wh ON r.to_warehouse_id = wh.warehouse_id
      LEFT JOIN tbl_inv_storage_bin bin ON r.to_bin_id = bin.bin_id
      LEFT JOIN tbl_sec_user qc_u ON r.qc_inspected_by = qc_u.user_id
      LEFT JOIN tbl_sec_user post_u ON r.posted_by = post_u.user_id
      ${whereClause}
      ORDER BY r.fg_receipt_id DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1};
    `;

    const [countRes, dataRes] = await Promise.all([
      this.pool.query(countSql, params),
      this.pool.query(dataSql, [...params, limit, offset]),
    ]);

    const total = countRes.rows[0]?.total || 0;

    return {
      data: dataRes.rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // --------------------------------------------------------------------------
  // 6. Get Single Receipt with By-Products
  // --------------------------------------------------------------------------
  async findOne(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const res = await this.pool.query(
      `SELECT
        r.fg_receipt_id, r.receipt_no, r.receipt_date, r.wo_id, r.item_id, r.uom_id,
        r.to_warehouse_id, r.to_bin_id, r.batch_no, r.heat_no, r.manufacturing_date, r.expiry_date,
        r.received_qty::FLOAT AS received_qty,
        r.accepted_qty::FLOAT AS accepted_qty,
        r.rejected_qty::FLOAT AS rejected_qty,
        r.rework_qty::FLOAT AS rework_qty,
        r.qc_status, r.qc_inspected_by, r.qc_inspected_at, r.qc_remarks,
        r.material_cost::FLOAT AS material_cost,
        r.operation_cost::FLOAT AS operation_cost,
        r.byproduct_credit::FLOAT AS byproduct_credit,
        r.total_cost::FLOAT AS total_cost,
        r.unit_cost::FLOAT AS unit_cost,
        r.status, r.posted_by, r.posted_at, r.remarks, r.created_date,
        wo.wo_no, wo.planned_qty::FLOAT AS wo_planned_qty, wo.completed_qty::FLOAT AS wo_completed_qty,
        wo.batch_no AS wo_batch_no,
        i.item_code, i.item_name, i.drawing_no, i.revision_no,
        u.uom_code, u.uom_name,
        wh.warehouse_code, wh.warehouse_name,
        bin.bin_code, bin.bin_name,
        qc_u.full_name AS qc_inspector_name,
        post_u.full_name AS posted_by_name
      FROM tbl_mfg_fg_receipt_header r
      JOIN tbl_mfg_wo_header wo ON r.wo_id = wo.wo_id
      JOIN tbl_inv_item i ON r.item_id = i.item_id
      JOIN tbl_inv_uom u ON r.uom_id = u.uom_id
      JOIN tbl_inv_warehouse wh ON r.to_warehouse_id = wh.warehouse_id
      LEFT JOIN tbl_inv_storage_bin bin ON r.to_bin_id = bin.bin_id
      LEFT JOIN tbl_sec_user qc_u ON r.qc_inspected_by = qc_u.user_id
      LEFT JOIN tbl_sec_user post_u ON r.posted_by = post_u.user_id
      WHERE r.fg_receipt_id = $1 AND r.comp_id = $2 AND r.is_active = TRUE;`,
      [id, compId],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Finished Goods Receipt #${id} not found.`);
    }

    const header = res.rows[0];

    // Fetch By-Products
    const bpRes = await this.pool.query(
      `SELECT
         bp.receipt_byproduct_id, bp.fg_receipt_id, bp.item_id, bp.uom_id, bp.product_type,
         bp.quantity::FLOAT AS quantity,
         bp.recovery_rate::FLOAT AS recovery_rate,
         bp.total_recovery_value::FLOAT AS total_recovery_value,
         bp.to_warehouse_id, bp.to_bin_id, bp.remarks,
         i.item_code, i.item_name,
         u.uom_code, u.uom_name,
         wh.warehouse_code, wh.warehouse_name,
         bin.bin_code
       FROM tbl_mfg_fg_receipt_byproduct bp
       JOIN tbl_inv_item i ON bp.item_id = i.item_id
       JOIN tbl_inv_uom u ON bp.uom_id = u.uom_id
       JOIN tbl_inv_warehouse wh ON bp.to_warehouse_id = wh.warehouse_id
       LEFT JOIN tbl_inv_storage_bin bin ON bp.to_bin_id = bin.bin_id
       WHERE bp.fg_receipt_id = $1 AND bp.comp_id = $2 AND bp.is_active = TRUE
       ORDER BY bp.receipt_byproduct_id ASC;`,
      [id, compId],
    );

    return {
      ...header,
      byproducts: bpRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // 7. Create FG Receipt (Draft)
  // --------------------------------------------------------------------------
  async create(dto: CreateFgReceiptDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    // Validate Work Order
    const woRes = await this.pool.query(
      `SELECT wo_id, wo_no, item_id, uom_id, target_warehouse_id, batch_no, status
       FROM tbl_mfg_wo_header
       WHERE wo_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [dto.woId, compId],
    );

    if (woRes.rows.length === 0) {
      throw new BadRequestException(`Invalid Work Order #${dto.woId}.`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Auto-generate receipt_no: FGR-{BRANCH}-{FYEAR}-XXXX
      let receiptNo = dto.receiptNo;
      if (!receiptNo) {
        const branchCodeRes = await client.query(
          `SELECT branch_code FROM tbl_org_branch WHERE branch_id = $1;`,
          [branchId],
        );
        const branchCode = branchCodeRes.rows[0]?.branch_code?.replace('PLT-', '') || 'AHM';
        const countRes = await client.query(
          `SELECT COUNT(*)::INT AS seq FROM tbl_mfg_fg_receipt_header WHERE comp_id = $1 AND branch_id = $2;`,
          [compId, branchId],
        );
        const seq = (countRes.rows[0]?.seq || 0) + 1;
        receiptNo = `FGR-${branchCode}-2627-${String(seq).padStart(4, '0')}`;
      }

      // Calculate totals
      const receivedQty = dto.receivedQty || 0;
      const acceptedQty = dto.acceptedQty !== undefined ? dto.acceptedQty : receivedQty;
      const rejectedQty = dto.rejectedQty || 0;
      const reworkQty = dto.reworkQty || 0;

      const materialCost = dto.materialCost || 0;
      const operationCost = dto.operationCost || 0;

      // By-products recovery credit
      let byproductCredit = 0;
      if (dto.byproducts && dto.byproducts.length > 0) {
        byproductCredit = dto.byproducts.reduce(
          (sum, bp) => sum + (bp.quantity || 0) * (bp.recoveryRate || 0),
          0,
        );
      }

      const totalCost = Math.max(0, Number((materialCost + operationCost - byproductCredit).toFixed(2)));
      const unitCost = acceptedQty > 0 ? Number((totalCost / acceptedQty).toFixed(4)) : 0;

      const qcStatus = dto.qcStatus || (acceptedQty === receivedQty && acceptedQty > 0 ? 'ACCEPTED' : 'PENDING');
      const qcInspectedBy = qcStatus === 'ACCEPTED' ? user.userId : null;
      const qcInspectedAt = qcStatus === 'ACCEPTED' ? new Date() : null;

      const insertHeaderSql = `
        INSERT INTO tbl_mfg_fg_receipt_header (
          receipt_no, receipt_date, wo_id, item_id, uom_id,
          to_warehouse_id, to_bin_id, batch_no, heat_no, manufacturing_date, expiry_date,
          received_qty, accepted_qty, rejected_qty, rework_qty,
          qc_status, qc_inspected_by, qc_inspected_at, qc_remarks,
          material_cost, operation_cost, byproduct_credit, total_cost, unit_cost,
          status, remarks, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, COALESCE($2::DATE, CURRENT_DATE), $3, $4, $5,
          $6, $7, $8, $9, COALESCE($10::DATE, CURRENT_DATE), $11,
          $12, $13, $14, $15,
          $16, $17, $18, $19,
          $20, $21, $22, $23, $24,
          'DRAFT', $25, TRUE,
          $26, $27, $28, $29
        ) RETURNING fg_receipt_id, receipt_no;
      `;

      const headerRes = await client.query(insertHeaderSql, [
        receiptNo,
        dto.receiptDate || null,
        dto.woId,
        dto.itemId,
        dto.uomId,
        dto.toWarehouseId,
        dto.toBinId || null,
        dto.batchNo || null,
        dto.heatNo || null,
        dto.manufacturingDate || null,
        dto.expiryDate || null,
        receivedQty,
        acceptedQty,
        rejectedQty,
        reworkQty,
        qcStatus,
        qcInspectedBy,
        qcInspectedAt,
        dto.qcRemarks || null,
        materialCost,
        operationCost,
        byproductCredit,
        totalCost,
        unitCost,
        dto.remarks || null,
        compId,
        branchId,
        fyearId,
        user.userId,
      ]);

      const fgReceiptId = headerRes.rows[0].fg_receipt_id;

      // Insert By-Products
      if (dto.byproducts && dto.byproducts.length > 0) {
        for (const bp of dto.byproducts) {
          const qty = bp.quantity || 0;
          const rate = bp.recoveryRate || 0;
          const val = Number((qty * rate).toFixed(2));

          await client.query(
            `INSERT INTO tbl_mfg_fg_receipt_byproduct (
               fg_receipt_id, item_id, uom_id, product_type,
               quantity, recovery_rate, total_recovery_value,
               to_warehouse_id, to_bin_id, remarks, is_active,
               comp_id, branch_id, fyear_id, created_by
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11, $12, $13, $14);`,
            [
              fgReceiptId,
              bp.itemId,
              bp.uomId,
              bp.productType || 'RECOVERABLE_SCRAP',
              qty,
              rate,
              val,
              bp.toWarehouseId,
              bp.toBinId || null,
              bp.remarks || null,
              compId,
              branchId,
              fyearId,
              user.userId,
            ],
          );
        }
      }

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId: user.userId,
        username: user.username,
        screenCode: 'MFG_FG_RECEIPT',
        actionType: 'ADD',
        entityTable: 'tbl_mfg_fg_receipt_header',
        recordId: fgReceiptId,
        oldValue: null,
        newValue: { receiptNo, woId: dto.woId, receivedQty, acceptedQty, totalCost },
        compId,
        branchId,
        fyearId,
      });

      return this.findOne(fgReceiptId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to create FG receipt: ${err.message}`, err.stack);
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 8. Update FG Receipt (Draft)
  // --------------------------------------------------------------------------
  async update(id: number, dto: UpdateFgReceiptDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    const existing = await this.findOne(id, user);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(`Only DRAFT receipts can be modified. Current status is ${existing.status}.`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const receivedQty = dto.receivedQty !== undefined ? dto.receivedQty : existing.received_qty;
      const acceptedQty = dto.acceptedQty !== undefined ? dto.acceptedQty : existing.accepted_qty;
      const rejectedQty = dto.rejectedQty !== undefined ? dto.rejectedQty : existing.rejected_qty;
      const reworkQty = dto.reworkQty !== undefined ? dto.reworkQty : existing.rework_qty;

      const materialCost = dto.materialCost !== undefined ? dto.materialCost : existing.material_cost;
      const operationCost = dto.operationCost !== undefined ? dto.operationCost : existing.operation_cost;

      let byproductCredit = existing.byproduct_credit;
      if (dto.byproducts !== undefined) {
        byproductCredit = dto.byproducts.reduce(
          (sum, bp) => sum + (bp.quantity || 0) * (bp.recoveryRate || 0),
          0,
        );
      }

      const totalCost = Math.max(0, Number((materialCost + operationCost - byproductCredit).toFixed(2)));
      const unitCost = acceptedQty > 0 ? Number((totalCost / acceptedQty).toFixed(4)) : 0;

      await client.query(
        `UPDATE tbl_mfg_fg_receipt_header
         SET
           receipt_date = COALESCE($1::DATE, receipt_date),
           wo_id = COALESCE($2, wo_id),
           item_id = COALESCE($3, item_id),
           uom_id = COALESCE($4, uom_id),
           to_warehouse_id = COALESCE($5, to_warehouse_id),
           to_bin_id = $6,
           batch_no = COALESCE($7, batch_no),
           heat_no = COALESCE($8, heat_no),
           manufacturing_date = COALESCE($9::DATE, manufacturing_date),
           expiry_date = $10,
           received_qty = $11,
           accepted_qty = $12,
           rejected_qty = $13,
           rework_qty = $14,
           qc_status = COALESCE($15, qc_status),
           qc_remarks = COALESCE($16, qc_remarks),
           material_cost = $17,
           operation_cost = $18,
           byproduct_credit = $19,
           total_cost = $20,
           unit_cost = $21,
           remarks = COALESCE($22, remarks),
           updated_by = $23,
           updated_date = CURRENT_TIMESTAMP
         WHERE fg_receipt_id = $24 AND comp_id = $25;`,
        [
          dto.receiptDate || null,
          dto.woId || null,
          dto.itemId || null,
          dto.uomId || null,
          dto.toWarehouseId || null,
          dto.toBinId !== undefined ? dto.toBinId : existing.to_bin_id,
          dto.batchNo || null,
          dto.heatNo || null,
          dto.manufacturingDate || null,
          dto.expiryDate !== undefined ? dto.expiryDate : existing.expiry_date,
          receivedQty,
          acceptedQty,
          rejectedQty,
          reworkQty,
          dto.qcStatus || null,
          dto.qcRemarks || null,
          materialCost,
          operationCost,
          byproductCredit,
          totalCost,
          unitCost,
          dto.remarks || null,
          user.userId,
          id,
          compId,
        ],
      );

      // Replace By-Products if provided
      if (dto.byproducts !== undefined) {
        await client.query(
          `DELETE FROM tbl_mfg_fg_receipt_byproduct WHERE fg_receipt_id = $1;`,
          [id],
        );

        for (const bp of dto.byproducts) {
          const qty = bp.quantity || 0;
          const rate = bp.recoveryRate || 0;
          const val = Number((qty * rate).toFixed(2));

          await client.query(
            `INSERT INTO tbl_mfg_fg_receipt_byproduct (
               fg_receipt_id, item_id, uom_id, product_type,
               quantity, recovery_rate, total_recovery_value,
               to_warehouse_id, to_bin_id, remarks, is_active,
               comp_id, branch_id, fyear_id, created_by
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, $11, $12, $13, $14);`,
            [
              id,
              bp.itemId,
              bp.uomId,
              bp.productType || 'RECOVERABLE_SCRAP',
              qty,
              rate,
              val,
              bp.toWarehouseId,
              bp.toBinId || null,
              bp.remarks || null,
              compId,
              branchId,
              fyearId,
              user.userId,
            ],
          );
        }
      }

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId: user.userId,
        username: user.username,
        screenCode: 'MFG_FG_RECEIPT',
        actionType: 'EDIT',
        entityTable: 'tbl_mfg_fg_receipt_header',
        recordId: id,
        oldValue: existing,
        newValue: { receivedQty, acceptedQty, totalCost, unitCost },
        compId,
        branchId,
        fyearId,
      });

      return this.findOne(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to update FG receipt #${id}: ${err.message}`, err.stack);
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 9. Delete FG Receipt (Draft Only)
  // --------------------------------------------------------------------------
  async remove(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const existing = await this.findOne(id, user);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(`Only DRAFT receipts can be deleted. Current status is ${existing.status}.`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `DELETE FROM tbl_mfg_fg_receipt_byproduct WHERE fg_receipt_id = $1;`,
        [id],
      );

      await client.query(
        `DELETE FROM tbl_mfg_fg_receipt_header WHERE fg_receipt_id = $1 AND comp_id = $2;`,
        [id, compId],
      );

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId: user.userId,
        username: user.username,
        screenCode: 'MFG_FG_RECEIPT',
        actionType: 'DELETE',
        entityTable: 'tbl_mfg_fg_receipt_header',
        recordId: id,
        oldValue: existing,
        newValue: null,
        compId,
        branchId,
      });

      return { success: true, message: `Finished Goods Receipt #${existing.receipt_no} deleted successfully.` };
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to delete FG receipt #${id}: ${err.message}`, err.stack);
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 10. In-Process / Post-Production QC Inspection Clearance
  // --------------------------------------------------------------------------
  async qcInspection(id: number, dto: QcInspectionFgReceiptDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const existing = await this.findOne(id, user);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(`QC inspection can only be recorded on DRAFT receipts.`);
    }

    const acceptedQty = dto.acceptedQty;
    const rejectedQty = dto.rejectedQty !== undefined ? dto.rejectedQty : existing.rejected_qty;
    const reworkQty = dto.reworkQty !== undefined ? dto.reworkQty : existing.rework_qty;

    if (acceptedQty + rejectedQty + reworkQty > existing.received_qty) {
      throw new BadRequestException(
        `Sum of accepted (${acceptedQty}), rejected (${rejectedQty}), and rework (${reworkQty}) cannot exceed received quantity (${existing.received_qty}).`,
      );
    }

    const unitCost = acceptedQty > 0 ? Number((existing.total_cost / acceptedQty).toFixed(4)) : 0;

    await this.pool.query(
      `UPDATE tbl_mfg_fg_receipt_header
       SET
         accepted_qty = $1,
         rejected_qty = $2,
         rework_qty = $3,
         qc_status = $4,
         qc_inspected_by = $5,
         qc_inspected_at = CURRENT_TIMESTAMP,
         qc_remarks = $6,
         unit_cost = $7,
         updated_by = $5,
         updated_date = CURRENT_TIMESTAMP
       WHERE fg_receipt_id = $8 AND comp_id = $9;`,
      [
        acceptedQty,
        rejectedQty,
        reworkQty,
        dto.qcStatus,
        user.userId,
        dto.qcRemarks || null,
        unitCost,
        id,
        compId,
      ],
    );

    // Audit Log
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'MFG_FG_RECEIPT',
      actionType: 'APPROVE',
      entityTable: 'tbl_mfg_fg_receipt_header',
      recordId: id,
      oldValue: { qcStatus: existing.qc_status, acceptedQty: existing.accepted_qty },
      newValue: { qcStatus: dto.qcStatus, acceptedQty, rejectedQty, reworkQty },
      compId,
      branchId,
    });

    return this.findOne(id, user);
  }

  // --------------------------------------------------------------------------
  // 11. Post FG Receipt: Post Stock Ledger & Update Work Order Header
  // --------------------------------------------------------------------------
  async post(id: number, dto: PostFgReceiptDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    const receipt = await this.findOne(id, user);
    if (receipt.status !== 'DRAFT') {
      throw new BadRequestException(`Only DRAFT receipts can be posted. Current status is ${receipt.status}.`);
    }

    if (receipt.qc_status !== 'ACCEPTED' && receipt.qc_status !== 'DEVIATION_ACCEPTED') {
      throw new BadRequestException(
        `Receipt #${receipt.receipt_no} cannot be posted without QC clearance. Current QC status is ${receipt.qc_status}.`,
      );
    }

    if (receipt.accepted_qty <= 0) {
      throw new BadRequestException(
        `Cannot post receipt #${receipt.receipt_no} with zero accepted quantity.`,
      );
    }

    const targetWarehouseId = dto.toWarehouseId || receipt.to_warehouse_id;
    const targetBinId = dto.toBinId !== undefined ? dto.toBinId : receipt.to_bin_id;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Post Finished Good into Stock Ledger
      await client.query(
        `INSERT INTO tbl_inv_stock_ledger (
           comp_id, branch_id, fyear_id, transaction_date, transaction_type,
           reference_doc_type, reference_doc_id, reference_doc_no,
           warehouse_id, to_bin_id, item_id, uom_id, batch_no, heat_no,
           qty_in, qty_out, unit_cost, total_cost, closing_balance, remarks, is_active, created_by
         ) VALUES (
           $1, $2, $3, CURRENT_TIMESTAMP, 'PUTAWAY_INWARD',
           'WORK_ORDER', $4, $5,
           $6, $7, $8, $9, $10, $11,
           $12, 0.000, $13, $14,
           COALESCE((SELECT closing_balance FROM tbl_inv_stock_ledger WHERE comp_id = $1 AND warehouse_id = $6 AND item_id = $8 ORDER BY ledger_id DESC LIMIT 1), 0.000) + $12,
           $15, TRUE, $16
         );`,
        [
          compId,
          branchId,
          fyearId,
          id,
          receipt.receipt_no,
          targetWarehouseId,
          targetBinId,
          receipt.item_id,
          receipt.uom_id,
          receipt.batch_no,
          receipt.heat_no,
          receipt.accepted_qty,
          receipt.unit_cost,
          receipt.total_cost,
          `Production receipt for Work Order #${receipt.wo_no} [Lot: ${receipt.batch_no || 'NA'}]`,
          user.userId,
        ],
      );

      // 2. Update / Insert Bin Stock if bin specified
      if (targetBinId) {
        await client.query(
          `INSERT INTO tbl_inv_bin_stock (
             warehouse_id, bin_id, item_id, uom_id, batch_no, heat_no,
             on_hand_qty, reserved_qty, available_qty, unit_cost, total_valuation,
             last_stock_date, is_active, comp_id, branch_id, fyear_id, created_by
           ) VALUES (
             $1, $2, $3, $4, $5, $6,
             $7, 0.000, $7, $8, $9,
             CURRENT_TIMESTAMP, TRUE, $10, $11, $12, $13
           )
           ON CONFLICT (warehouse_id, bin_id, item_id, batch_no) DO UPDATE
           SET
             on_hand_qty = tbl_inv_bin_stock.on_hand_qty + EXCLUDED.on_hand_qty,
             available_qty = tbl_inv_bin_stock.available_qty + EXCLUDED.on_hand_qty,
             unit_cost = EXCLUDED.unit_cost,
             total_valuation = tbl_inv_bin_stock.total_valuation + EXCLUDED.total_valuation,
             last_stock_date = CURRENT_TIMESTAMP,
             updated_by = EXCLUDED.created_by,
             updated_date = CURRENT_TIMESTAMP;`,
          [
            targetWarehouseId,
            targetBinId,
            receipt.item_id,
            receipt.uom_id,
            receipt.batch_no || 'DEFAULT',
            receipt.heat_no,
            receipt.accepted_qty,
            receipt.unit_cost,
            receipt.total_cost,
            compId,
            branchId,
            fyearId,
            user.userId,
          ],
        );
      }

      // 3. Post By-Products into Stock Ledger
      if (receipt.byproducts && receipt.byproducts.length > 0) {
        for (const bp of receipt.byproducts) {
          if (bp.quantity > 0) {
            await client.query(
              `INSERT INTO tbl_inv_stock_ledger (
                 comp_id, branch_id, fyear_id, transaction_date, transaction_type,
                 reference_doc_type, reference_doc_id, reference_doc_no,
                 warehouse_id, to_bin_id, item_id, uom_id,
                 qty_in, qty_out, unit_cost, total_cost, closing_balance, remarks, is_active, created_by
               ) VALUES (
                 $1, $2, $3, CURRENT_TIMESTAMP, 'PUTAWAY_INWARD',
                 'WORK_ORDER', $4, $5,
                 $6, $7, $8, $9,
                 $10, 0.000, $11, $12,
                 COALESCE((SELECT closing_balance FROM tbl_inv_stock_ledger WHERE comp_id = $1 AND warehouse_id = $6 AND item_id = $8 ORDER BY ledger_id DESC LIMIT 1), 0.000) + $10,
                 $13, TRUE, $14
               );`,
              [
                compId,
                branchId,
                fyearId,
                id,
                receipt.receipt_no,
                bp.to_warehouse_id,
                bp.to_bin_id || null,
                bp.item_id,
                bp.uom_id,
                bp.quantity,
                bp.recovery_rate,
                bp.total_recovery_value,
                `Recoverable by-product / scrap from production receipt #${receipt.receipt_no}`,
                user.userId,
              ],
            );
          }
        }
      }

      // 4. Update Parent Work Order Header: increment completed_qty and scrapped_qty
      const woRes = await client.query(
        `SELECT planned_qty::FLOAT AS planned_qty, completed_qty::FLOAT AS completed_qty
         FROM tbl_mfg_wo_header
         WHERE wo_id = $1 AND comp_id = $2;`,
        [receipt.wo_id, compId],
      );

      const currentCompleted = woRes.rows[0]?.completed_qty || 0;
      const plannedQty = woRes.rows[0]?.planned_qty || 0;
      const newCompleted = Number((currentCompleted + receipt.accepted_qty).toFixed(3));
      const newStatus = newCompleted >= plannedQty ? 'COMPLETED' : 'IN_PROGRESS';
      const actualEndDateClause = newCompleted >= plannedQty ? ', actual_end_date = CURRENT_TIMESTAMP' : '';

      await client.query(
        `UPDATE tbl_mfg_wo_header
         SET
           completed_qty = $1,
           scrapped_qty = scrapped_qty + $2,
           status = $3,
           updated_by = $4,
           updated_date = CURRENT_TIMESTAMP
           ${actualEndDateClause}
         WHERE wo_id = $5 AND comp_id = $6;`,
        [newCompleted, receipt.rejected_qty, newStatus, user.userId, receipt.wo_id, compId],
      );

      // 5. Update Receipt Header Status to POSTED
      await client.query(
        `UPDATE tbl_mfg_fg_receipt_header
         SET
           status = 'POSTED',
           to_warehouse_id = $1,
           to_bin_id = $2,
           posted_by = $3,
           posted_at = CURRENT_TIMESTAMP,
           updated_by = $3,
           updated_date = CURRENT_TIMESTAMP
         WHERE fg_receipt_id = $4 AND comp_id = $5;`,
        [targetWarehouseId, targetBinId, user.userId, id, compId],
      );

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId: user.userId,
        username: user.username,
        screenCode: 'MFG_FG_RECEIPT',
        actionType: 'POST',
        entityTable: 'tbl_mfg_fg_receipt_header',
        recordId: id,
        oldValue: { status: 'DRAFT' },
        newValue: {
          status: 'POSTED',
          acceptedQty: receipt.accepted_qty,
          totalCost: receipt.total_cost,
          woNewCompletedQty: newCompleted,
          woNewStatus: newStatus,
        },
        compId,
        branchId,
        fyearId,
      });

      return this.findOne(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to post FG receipt #${id}: ${err.message}`, err.stack);
      throw err;
    } finally {
      client.release();
    }
  }
}
