import {
  BadRequestException,
  ConflictException,
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
  CloseWorkOrderDto,
  ConvertMrpOrderDto,
  CreateWorkOrderDto,
  ReleaseWorkOrderDto,
  UpdateWorkOrderDto,
  WorkOrderFilterParams,
} from './work-order.dto';

@Injectable()
export class WorkOrderService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  // --------------------------------------------------------------------------
  // KPI Summary
  // --------------------------------------------------------------------------
  async getWorkOrderSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const sql = `
      SELECT
        COUNT(*)::INT AS total_work_orders,
        COUNT(CASE WHEN status IN ('RELEASED', 'IN_PROGRESS') THEN 1 END)::INT AS active_jobs,
        COALESCE(SUM(completed_qty), 0)::FLOAT AS completed_qty_total,
        COUNT(CASE WHEN status IN ('DRAFT', 'RELEASED', 'IN_PROGRESS') AND scheduled_end_date < CURRENT_DATE THEN 1 END)::INT AS overdue_count,
        COALESCE(SUM(estimated_total_cost), 0)::FLOAT AS total_estimated_cost
      FROM tbl_mfg_wo_header
      WHERE comp_id = $1 AND is_active = TRUE
        AND ($2::BIGINT IS NULL OR branch_id = $2::BIGINT);
    `;

    const res = await this.pool.query(sql, [compId, branchId]);
    const r = res.rows[0] || {};
    return {
      totalWorkOrders: Number(r.total_work_orders || 0),
      activeJobs: Number(r.active_jobs || 0),
      completedQtyTotal: Math.round(Number(r.completed_qty_total || 0) * 100) / 100,
      overdueCount: Number(r.overdue_count || 0),
      totalEstimatedCost: Math.round(Number(r.total_estimated_cost || 0) * 100) / 100,
    };
  }

  // --------------------------------------------------------------------------
  // Lookups
  // --------------------------------------------------------------------------
  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const [itemsRes, bomsRes, routingsRes, whRes, mrpRes] = await Promise.all([
      this.pool.query(
        `SELECT
           i.item_id,
           i.item_code,
           i.item_name,
           i.item_type,
           i.base_uom_id,
           u.uom_code,
           u.uom_name,
           COALESCE(i.standard_cost, 0)::FLOAT AS standard_cost,
           COALESCE(i.lead_time_days, 1)::INT AS lead_time_days,
           i.default_warehouse_id
         FROM tbl_inv_item i
         JOIN tbl_inv_uom u ON i.base_uom_id = u.uom_id
         WHERE i.comp_id = $1 AND i.is_active = TRUE
           AND (i.is_bom_allowed = TRUE OR i.item_type IN ('FINISHED_GOODS', 'WIP_SEMI_FINISHED'))
         ORDER BY i.item_name ASC`,
        [compId],
      ),
      this.pool.query(
        `SELECT
           b.bom_id,
           b.bom_code,
           b.bom_name,
           b.item_id,
           b.version_no,
           b.batch_size::FLOAT AS batch_size,
           b.is_default,
           b.routing_id
         FROM tbl_mfg_bom_header b
         WHERE b.comp_id = $1 AND b.status = 'ACTIVE' AND b.is_active = TRUE
         ORDER BY b.bom_code ASC`,
        [compId],
      ),
      this.pool.query(
        `SELECT
           rt.routing_id,
           rt.routing_code,
           rt.routing_name,
           rt.item_id,
           rt.version_no,
           rt.batch_size::FLOAT AS batch_size,
           rt.total_cost_per_unit::FLOAT AS total_cost_per_unit,
           rt.is_default
         FROM tbl_mfg_routing_header rt
         WHERE rt.comp_id = $1 AND rt.status = 'ACTIVE' AND rt.is_active = TRUE
         ORDER BY rt.routing_code ASC`,
        [compId],
      ),
      this.pool.query(
        `SELECT warehouse_id, warehouse_code, warehouse_name, warehouse_type
         FROM tbl_inv_warehouse
         WHERE comp_id = $1 AND is_active = TRUE
         ORDER BY warehouse_name ASC`,
        [compId],
      ),
      this.pool.query(
        `SELECT
           po.planned_order_id,
           po.planned_order_no,
           po.item_id,
           i.item_code,
           i.item_name,
           po.bom_id,
           po.routing_id,
           po.planned_order_qty::FLOAT AS planned_order_qty,
           po.uom_id,
           u.uom_code,
           po.required_by_date::TEXT AS required_by_date,
           po.order_release_date::TEXT AS order_release_date,
           po.status
         FROM tbl_mfg_mrp_planned_order po
         JOIN tbl_inv_item i ON po.item_id = i.item_id
         JOIN tbl_inv_uom u ON po.uom_id = u.uom_id
         WHERE po.comp_id = $1 AND po.order_type = 'MAKE'
           AND po.status IN ('SUGGESTED', 'CONFIRMED') AND po.is_active = TRUE
         ORDER BY po.required_by_date ASC, po.planned_order_id ASC`,
        [compId],
      ),
    ]);

    return {
      items: itemsRes.rows,
      boms: bomsRes.rows,
      routings: routingsRes.rows,
      warehouses: whRes.rows,
      openMrpMakeOrders: mrpRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // Auto Document Number Generation
  // --------------------------------------------------------------------------
  private async generateWorkOrderNo(branchId: number, compId: number): Promise<string> {
    const branchRes = await this.pool.query(
      `SELECT b.branch_code, fy.fyear_code
       FROM tbl_org_branch b
       LEFT JOIN tbl_org_financial_year fy ON fy.comp_id = b.comp_id AND fy.is_current = TRUE
       WHERE b.branch_id = $1;`,
      [branchId],
    );
    const branchCode = branchRes.rows[0]?.branch_code || 'AHM';
    const fyearCode = (branchRes.rows[0]?.fyear_code || '2627').replace(/[^0-9]/g, '');

    const countRes = await this.pool.query(
      `SELECT COUNT(*)::INT AS count FROM tbl_mfg_wo_header WHERE comp_id = $1;`,
      [compId],
    );
    const nextSeq = Number(countRes.rows[0]?.count || 0) + 1;
    return `WO-${branchCode}-${fyearCode}-${String(nextSeq).padStart(4, '0')}`;
  }

  // --------------------------------------------------------------------------
  // Find All (Paginated & Filtered)
  // --------------------------------------------------------------------------
  async findAll(params: WorkOrderFilterParams, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['wo.comp_id = $1', 'wo.is_active = TRUE'];
    const values: any[] = [compId];
    let idx = 2;

    if (params.search?.trim()) {
      conditions.push(
        `(wo.wo_no ILIKE $${idx} OR i.item_code ILIKE $${idx} OR i.item_name ILIKE $${idx} OR wo.batch_no ILIKE $${idx} OR wo.remarks ILIKE $${idx})`,
      );
      values.push(`%${params.search.trim()}%`);
      idx++;
    }

    if (params.status?.trim()) {
      conditions.push(`wo.status = $${idx}`);
      values.push(params.status.trim());
      idx++;
    }

    if (params.priority?.trim()) {
      conditions.push(`wo.priority = $${idx}`);
      values.push(params.priority.trim());
      idx++;
    }

    if (params.itemId) {
      conditions.push(`wo.item_id = $${idx}`);
      values.push(params.itemId);
      idx++;
    }

    if (params.targetWarehouseId) {
      conditions.push(`wo.target_warehouse_id = $${idx}`);
      values.push(params.targetWarehouseId);
      idx++;
    }

    if (params.startDate) {
      conditions.push(`wo.scheduled_start_date >= $${idx}::DATE`);
      values.push(params.startDate);
      idx++;
    }

    if (params.endDate) {
      conditions.push(`wo.scheduled_end_date <= $${idx}::DATE`);
      values.push(params.endDate);
      idx++;
    }

    if (params.isOverdue === 'true') {
      conditions.push(
        `wo.status IN ('DRAFT', 'RELEASED', 'IN_PROGRESS') AND wo.scheduled_end_date < CURRENT_DATE`,
      );
    }

    const whereClause = conditions.join(' AND ');

    const countSql = `
      SELECT COUNT(*)::INT AS total
      FROM tbl_mfg_wo_header wo
      JOIN tbl_inv_item i ON wo.item_id = i.item_id
      WHERE ${whereClause};
    `;
    const countRes = await this.pool.query(countSql, values);
    const total = Number(countRes.rows[0]?.total || 0);

    const dataSql = `
      SELECT
        wo.wo_id,
        wo.wo_no,
        wo.wo_date::TEXT AS wo_date,
        wo.item_id,
        i.item_code,
        i.item_name,
        i.item_type,
        wo.bom_id,
        b.bom_code,
        b.version_no AS bom_version,
        wo.routing_id,
        rt.routing_code,
        rt.version_no AS routing_version,
        wo.target_warehouse_id,
        wh.warehouse_name AS target_warehouse_name,
        wo.wip_warehouse_id,
        wwh.warehouse_name AS wip_warehouse_name,
        wo.planned_qty::FLOAT AS planned_qty,
        wo.completed_qty::FLOAT AS completed_qty,
        wo.scrapped_qty::FLOAT AS scrapped_qty,
        wo.uom_id,
        u.uom_code,
        u.uom_name,
        wo.scheduled_start_date::TEXT AS scheduled_start_date,
        wo.scheduled_end_date::TEXT AS scheduled_end_date,
        wo.actual_start_date,
        wo.actual_end_date,
        wo.priority,
        wo.status,
        wo.mrp_planned_order_id,
        mpo.planned_order_no AS mrp_planned_order_no,
        wo.batch_no,
        wo.estimated_material_cost::FLOAT AS estimated_material_cost,
        wo.estimated_operation_cost::FLOAT AS estimated_operation_cost,
        wo.estimated_total_cost::FLOAT AS estimated_total_cost,
        wo.actual_material_cost::FLOAT AS actual_material_cost,
        wo.actual_operation_cost::FLOAT AS actual_operation_cost,
        wo.actual_total_cost::FLOAT AS actual_total_cost,
        wo.released_by,
        u_rel.full_name AS released_by_name,
        wo.released_date,
        wo.remarks,
        (wo.status IN ('DRAFT', 'RELEASED', 'IN_PROGRESS') AND wo.scheduled_end_date < CURRENT_DATE) AS is_overdue,
        (SELECT COUNT(*)::INT FROM tbl_mfg_wo_bom_item bi WHERE bi.wo_id = wo.wo_id AND bi.is_active = TRUE) AS bom_item_count,
        (SELECT COUNT(*)::INT FROM tbl_mfg_wo_routing_op ro WHERE ro.wo_id = wo.wo_id AND ro.is_active = TRUE) AS routing_op_count
      FROM tbl_mfg_wo_header wo
      JOIN tbl_inv_item i ON wo.item_id = i.item_id
      JOIN tbl_inv_uom u ON wo.uom_id = u.uom_id
      JOIN tbl_inv_warehouse wh ON wo.target_warehouse_id = wh.warehouse_id
      LEFT JOIN tbl_inv_warehouse wwh ON wo.wip_warehouse_id = wwh.warehouse_id
      LEFT JOIN tbl_mfg_bom_header b ON wo.bom_id = b.bom_id
      LEFT JOIN tbl_mfg_routing_header rt ON wo.routing_id = rt.routing_id
      LEFT JOIN tbl_mfg_mrp_planned_order mpo ON wo.mrp_planned_order_id = mpo.planned_order_id
      LEFT JOIN tbl_sec_user u_rel ON wo.released_by = u_rel.user_id
      WHERE ${whereClause}
      ORDER BY wo.scheduled_start_date DESC, wo.wo_id DESC
      LIMIT $${idx} OFFSET $${idx + 1};
    `;

    values.push(limit, offset);
    const dataRes = await this.pool.query(dataSql, values);

    return {
      data: dataRes.rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  // --------------------------------------------------------------------------
  // Find One (Complete with BOM & Routing Snapshots)
  // --------------------------------------------------------------------------
  async findOne(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const woRes = await this.pool.query(
      `SELECT
         wo.wo_id,
         wo.wo_no,
         wo.wo_date::TEXT AS wo_date,
         wo.item_id,
         i.item_code,
         i.item_name,
         i.item_type,
         wo.bom_id,
         b.bom_code,
         b.bom_name,
         b.version_no AS bom_version,
         wo.routing_id,
         rt.routing_code,
         rt.routing_name,
         rt.version_no AS routing_version,
         wo.target_warehouse_id,
         wh.warehouse_name AS target_warehouse_name,
         wo.wip_warehouse_id,
         wwh.warehouse_name AS wip_warehouse_name,
         wo.planned_qty::FLOAT AS planned_qty,
         wo.completed_qty::FLOAT AS completed_qty,
         wo.scrapped_qty::FLOAT AS scrapped_qty,
         wo.uom_id,
         u.uom_code,
         u.uom_name,
         wo.scheduled_start_date::TEXT AS scheduled_start_date,
         wo.scheduled_end_date::TEXT AS scheduled_end_date,
         wo.actual_start_date,
         wo.actual_end_date,
         wo.priority,
         wo.status,
         wo.mrp_planned_order_id,
         mpo.planned_order_no AS mrp_planned_order_no,
         wo.batch_no,
         wo.estimated_material_cost::FLOAT AS estimated_material_cost,
         wo.estimated_operation_cost::FLOAT AS estimated_operation_cost,
         wo.estimated_total_cost::FLOAT AS estimated_total_cost,
         wo.actual_material_cost::FLOAT AS actual_material_cost,
         wo.actual_operation_cost::FLOAT AS actual_operation_cost,
         wo.actual_total_cost::FLOAT AS actual_total_cost,
         wo.released_by,
         u_rel.full_name AS released_by_name,
         wo.released_date,
         wo.remarks,
         (wo.status IN ('DRAFT', 'RELEASED', 'IN_PROGRESS') AND wo.scheduled_end_date < CURRENT_DATE) AS is_overdue
       FROM tbl_mfg_wo_header wo
       JOIN tbl_inv_item i ON wo.item_id = i.item_id
       JOIN tbl_inv_uom u ON wo.uom_id = u.uom_id
       JOIN tbl_inv_warehouse wh ON wo.target_warehouse_id = wh.warehouse_id
       LEFT JOIN tbl_inv_warehouse wwh ON wo.wip_warehouse_id = wwh.warehouse_id
       LEFT JOIN tbl_mfg_bom_header b ON wo.bom_id = b.bom_id
       LEFT JOIN tbl_mfg_routing_header rt ON wo.routing_id = rt.routing_id
       LEFT JOIN tbl_mfg_mrp_planned_order mpo ON wo.mrp_planned_order_id = mpo.planned_order_id
       LEFT JOIN tbl_sec_user u_rel ON wo.released_by = u_rel.user_id
       WHERE wo.wo_id = $1 AND wo.comp_id = $2 AND wo.is_active = TRUE;`,
      [id, compId],
    );

    if (woRes.rows.length === 0) {
      throw new NotFoundException(`Work Order #${id} not found`);
    }

    const wo = woRes.rows[0];

    const [bomItemsRes, routingOpsRes] = await Promise.all([
      this.pool.query(
        `SELECT
           bi.wo_bom_item_id,
           bi.wo_id,
           bi.item_id,
           i.item_code,
           i.item_name,
           bi.item_description,
           bi.uom_id,
           u.uom_code,
           bi.standard_qty_per_unit::FLOAT AS standard_qty_per_unit,
           bi.scrap_factor_percent::FLOAT AS scrap_factor_percent,
           bi.required_qty::FLOAT AS required_qty,
           bi.issued_qty::FLOAT AS issued_qty,
           bi.consumed_qty::FLOAT AS consumed_qty,
           bi.returned_qty::FLOAT AS returned_qty,
           bi.unit_cost::FLOAT AS unit_cost,
           bi.estimated_cost::FLOAT AS estimated_cost,
           bi.actual_cost::FLOAT AS actual_cost,
           bi.source_type,
           bi.operation_seq,
           bi.is_critical,
           bi.remarks
         FROM tbl_mfg_wo_bom_item bi
         JOIN tbl_inv_item i ON bi.item_id = i.item_id
         JOIN tbl_inv_uom u ON bi.uom_id = u.uom_id
         WHERE bi.wo_id = $1 AND bi.is_active = TRUE
         ORDER BY bi.operation_seq ASC NULLS LAST, bi.wo_bom_item_id ASC;`,
        [id],
      ),
      this.pool.query(
        `SELECT
           ro.wo_routing_op_id,
           ro.wo_id,
           ro.op_sequence,
           ro.op_code,
           ro.op_name,
           ro.work_center_id,
           wc.work_center_code,
           wc.work_center_name,
           ro.machine_id,
           m.machine_code,
           m.machine_name,
           ro.planned_setup_time_mins::FLOAT AS planned_setup_time_mins,
           ro.planned_run_time_mins::FLOAT AS planned_run_time_mins,
           ro.actual_setup_time_mins::FLOAT AS actual_setup_time_mins,
           ro.actual_run_time_mins::FLOAT AS actual_run_time_mins,
           ro.planned_cost::FLOAT AS planned_cost,
           ro.actual_cost::FLOAT AS actual_cost,
           ro.planned_qty::FLOAT AS planned_qty,
           ro.completed_qty::FLOAT AS completed_qty,
           ro.scrapped_qty::FLOAT AS scrapped_qty,
           ro.rework_qty::FLOAT AS rework_qty,
           ro.status,
           ro.scheduled_start_date::TEXT AS scheduled_start_date,
           ro.scheduled_end_date::TEXT AS scheduled_end_date,
           ro.is_inspection_required,
           ro.is_subcontracted,
           ro.subcontract_vendor_id,
           p.party_name AS subcontract_vendor_name,
           ro.remarks
         FROM tbl_mfg_wo_routing_op ro
         JOIN tbl_mfg_work_center wc ON ro.work_center_id = wc.work_center_id
         LEFT JOIN tbl_mfg_work_center_machine m ON ro.machine_id = m.wc_machine_id
         LEFT JOIN tbl_crm_party p ON ro.subcontract_vendor_id = p.party_id
         WHERE ro.wo_id = $1 AND ro.is_active = TRUE
         ORDER BY ro.op_sequence ASC;`,
        [id],
      ),
    ]);

    return {
      ...wo,
      bomItems: bomItemsRes.rows,
      routingOperations: routingOpsRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // Create Work Order (with dynamic BOM & Routing snapshotting)
  // --------------------------------------------------------------------------
  async create(dto: CreateWorkOrderDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;

    // Validate Item
    const itemRes = await this.pool.query(
      `SELECT item_id, item_code, item_name, base_uom_id, standard_cost, default_warehouse_id
       FROM tbl_inv_item WHERE item_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [dto.itemId, compId],
    );
    if (itemRes.rows.length === 0) {
      throw new NotFoundException(`Item #${dto.itemId} not found`);
    }
    const item = itemRes.rows[0];

    // Find Active BOM if not explicitly provided
    let bomId = dto.bomId;
    let batchSize = 1;
    if (!bomId) {
      const bomRes = await this.pool.query(
        `SELECT bom_id, batch_size::FLOAT AS batch_size, routing_id
         FROM tbl_mfg_bom_header
         WHERE item_id = $1 AND comp_id = $2 AND status = 'ACTIVE' AND is_active = TRUE
         ORDER BY is_default DESC, bom_id DESC LIMIT 1;`,
        [dto.itemId, compId],
      );
      if (bomRes.rows.length > 0) {
        bomId = bomRes.rows[0].bom_id;
        batchSize = Number(bomRes.rows[0].batch_size || 1);
        if (!dto.routingId && bomRes.rows[0].routing_id) {
          dto.routingId = bomRes.rows[0].routing_id;
        }
      }
    } else {
      const bRes = await this.pool.query(
        `SELECT batch_size::FLOAT AS batch_size FROM tbl_mfg_bom_header WHERE bom_id = $1;`,
        [bomId],
      );
      batchSize = Number(bRes.rows[0]?.batch_size || 1);
    }

    // Find Active Routing if not explicitly provided
    let routingId = dto.routingId;
    if (!routingId) {
      const rtRes = await this.pool.query(
        `SELECT routing_id FROM tbl_mfg_routing_header
         WHERE item_id = $1 AND comp_id = $2 AND status = 'ACTIVE' AND is_active = TRUE
         ORDER BY is_default DESC, routing_id DESC LIMIT 1;`,
        [dto.itemId, compId],
      );
      if (rtRes.rows.length > 0) {
        routingId = rtRes.rows[0].routing_id;
      }
    }

    // Generate WO No
    const woNo = dto.woNo?.trim() || (await this.generateWorkOrderNo(branchId, compId));

    // Client transaction
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const insertWoSql = `
        INSERT INTO tbl_mfg_wo_header (
          wo_no, wo_date, item_id, bom_id, routing_id,
          target_warehouse_id, wip_warehouse_id, planned_qty, completed_qty, scrapped_qty,
          uom_id, scheduled_start_date, scheduled_end_date,
          priority, status, sales_order_id, mrp_planned_order_id, batch_no,
          estimated_material_cost, estimated_operation_cost, estimated_total_cost,
          remarks, is_active, comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, COALESCE($2::DATE, CURRENT_DATE), $3, $4, $5,
          $6, $7, $8, 0.000, 0.000,
          $9, $10::DATE, $11::DATE,
          $12, 'DRAFT', $13, $14, $15,
          0.00, 0.00, 0.00,
          $16, TRUE, $17, $18,
          (SELECT fyear_id FROM tbl_org_financial_year WHERE comp_id = $17 AND is_current = TRUE LIMIT 1),
          $19
        ) RETURNING wo_id;
      `;

      const targetWh = dto.targetWarehouseId || item.default_warehouse_id || 1004;
      const wipWh = dto.wipWarehouseId || 1003;

      const woInsertRes = await client.query(insertWoSql, [
        woNo,
        dto.woDate || null,
        dto.itemId,
        bomId || null,
        routingId || null,
        targetWh,
        wipWh,
        dto.plannedQty,
        dto.uomId || item.base_uom_id,
        dto.scheduledStartDate,
        dto.scheduledEndDate,
        dto.priority || 'MEDIUM',
        dto.salesOrderId || null,
        dto.mrpPlannedOrderId || null,
        dto.batchNo || `BAT-${new Date().getFullYear()}-${woNo.slice(-4)}`,
        dto.remarks || null,
        compId,
        branchId,
        userId,
      ]);

      const woId = woInsertRes.rows[0].wo_id;

      let estimatedMaterialCost = 0;
      let estimatedOperationCost = 0;

      // 1. Snapshot BOM Items
      if (dto.customBomItems && dto.customBomItems.length > 0) {
        for (const bi of dto.customBomItems) {
          const lineCost = Math.round(Number(bi.requiredQty * (bi.unitCost || 0)) * 100) / 100;
          estimatedMaterialCost += lineCost;

          await client.query(
            `INSERT INTO tbl_mfg_wo_bom_item (
               wo_id, item_id, item_description, uom_id, standard_qty_per_unit,
               scrap_factor_percent, required_qty, issued_qty, consumed_qty, returned_qty,
               unit_cost, estimated_cost, actual_cost, source_type, operation_seq,
               is_critical, remarks, is_active, comp_id, branch_id, fyear_id, created_by
             ) VALUES (
               $1, $2, $3, $4, $5,
               $6, $7, 0.000, 0.000, 0.000,
               $8, $9, 0.00, $10, $11,
               $12, $13, TRUE, $14, $15,
               (SELECT fyear_id FROM tbl_org_financial_year WHERE comp_id = $14 AND is_current = TRUE LIMIT 1),
               $16
             );`,
            [
              woId,
              bi.itemId,
              bi.itemDescription || null,
              bi.uomId,
              bi.standardQtyPerUnit,
              bi.scrapFactorPercent || 0,
              bi.requiredQty,
              bi.unitCost || 0,
              lineCost,
              bi.sourceType || 'PURCHASED',
              bi.operationSeq || null,
              bi.isCritical || false,
              bi.remarks || null,
              compId,
              branchId,
              userId,
            ],
          );
        }
      } else if (bomId) {
        // Auto snapshot from active BOM
        const bomItemsRes = await client.query(
          `SELECT bi.item_id, bi.item_description, bi.uom_id, bi.quantity::FLOAT AS quantity,
                  bi.scrap_factor_percent::FLOAT AS scrap_factor_percent,
                  bi.gross_quantity::FLOAT AS gross_quantity,
                  bi.unit_cost::FLOAT AS unit_cost,
                  bi.source_type, bi.operation_seq, bi.is_critical, bi.remarks
           FROM tbl_mfg_bom_item bi
           WHERE bi.bom_id = $1 AND bi.is_active = TRUE;`,
          [bomId],
        );

        for (const bi of bomItemsRes.rows) {
          const ratio = (bi.gross_quantity || bi.quantity) / (batchSize || 1);
          const requiredQty = Math.round(Number(dto.plannedQty * ratio) * 1000) / 1000;
          const lineCost = Math.round(Number(requiredQty * bi.unit_cost) * 100) / 100;
          estimatedMaterialCost += lineCost;

          await client.query(
            `INSERT INTO tbl_mfg_wo_bom_item (
               wo_id, item_id, item_description, uom_id, standard_qty_per_unit,
               scrap_factor_percent, required_qty, issued_qty, consumed_qty, returned_qty,
               unit_cost, estimated_cost, actual_cost, source_type, operation_seq,
               is_critical, remarks, is_active, comp_id, branch_id, fyear_id, created_by
             ) VALUES (
               $1, $2, $3, $4, $5,
               $6, $7, 0.000, 0.000, 0.000,
               $8, $9, 0.00, $10, $11,
               $12, $13, TRUE, $14, $15,
               (SELECT fyear_id FROM tbl_org_financial_year WHERE comp_id = $14 AND is_current = TRUE LIMIT 1),
               $16
             );`,
            [
              woId,
              bi.item_id,
              bi.item_description,
              bi.uom_id,
              bi.quantity,
              bi.scrap_factor_percent || 0,
              requiredQty,
              bi.unit_cost,
              lineCost,
              bi.source_type || 'PURCHASED',
              bi.operation_seq || null,
              bi.is_critical || false,
              bi.remarks || null,
              compId,
              branchId,
              userId,
            ],
          );
        }
      }

      // 2. Snapshot Routing Operations
      if (dto.customRoutingOps && dto.customRoutingOps.length > 0) {
        for (const ro of dto.customRoutingOps) {
          estimatedOperationCost += Number(ro.plannedCost || 0);

          await client.query(
            `INSERT INTO tbl_mfg_wo_routing_op (
               wo_id, op_sequence, op_code, op_name, work_center_id, machine_id,
               planned_setup_time_mins, planned_run_time_mins, actual_setup_time_mins, actual_run_time_mins,
               planned_cost, actual_cost, planned_qty, completed_qty, scrapped_qty, rework_qty,
               status, scheduled_start_date, scheduled_end_date, is_inspection_required,
               is_subcontracted, subcontract_vendor_id, remarks, is_active,
               comp_id, branch_id, fyear_id, created_by
             ) VALUES (
               $1, $2, $3, $4, $5, $6,
               $7, $8, 0.00, 0.00,
               $9, 0.00, $10, 0.000, 0.000, 0.000,
               'PENDING', $11::DATE, $12::DATE, $13,
               $14, $15, $16, TRUE, $17, $18,
               (SELECT fyear_id FROM tbl_org_financial_year WHERE comp_id = $17 AND is_current = TRUE LIMIT 1),
               $19
             );`,
            [
              woId,
              ro.opSequence,
              ro.opCode,
              ro.opName,
              ro.workCenterId,
              ro.machineId || null,
              ro.plannedSetupTimeMins || 0,
              ro.plannedRunTimeMins || 0,
              ro.plannedCost || 0,
              ro.plannedQty || dto.plannedQty,
              ro.scheduledStartDate || dto.scheduledStartDate,
              ro.scheduledEndDate || dto.scheduledEndDate,
              ro.isInspectionRequired || false,
              ro.isSubcontracted || false,
              ro.subcontractVendorId || null,
              ro.remarks || null,
              compId,
              branchId,
              userId,
            ],
          );
        }
      } else if (routingId) {
        // Auto snapshot from active Routing
        const opsRes = await client.query(
          `SELECT ro.op_sequence, ro.op_code, ro.op_name, ro.work_center_id, ro.machine_id,
                  ro.setup_time_mins::FLOAT AS setup_time_mins,
                  ro.run_time_mins::FLOAT AS run_time_mins,
                  ro.total_cost_per_unit::FLOAT AS total_cost_per_unit,
                  ro.is_inspection_required, ro.is_subcontracted, ro.subcontract_vendor_id, ro.remarks
           FROM tbl_mfg_routing_operation ro
           WHERE ro.routing_id = $1 AND ro.is_active = TRUE
           ORDER BY ro.op_sequence ASC;`,
          [routingId],
        );

        for (const ro of opsRes.rows) {
          const plannedOpCost =
            Math.round(Number(dto.plannedQty * ro.total_cost_per_unit) * 100) / 100;
          estimatedOperationCost += plannedOpCost;

          await client.query(
            `INSERT INTO tbl_mfg_wo_routing_op (
               wo_id, op_sequence, op_code, op_name, work_center_id, machine_id,
               planned_setup_time_mins, planned_run_time_mins, actual_setup_time_mins, actual_run_time_mins,
               planned_cost, actual_cost, planned_qty, completed_qty, scrapped_qty, rework_qty,
               status, scheduled_start_date, scheduled_end_date, is_inspection_required,
               is_subcontracted, subcontract_vendor_id, remarks, is_active,
               comp_id, branch_id, fyear_id, created_by
             ) VALUES (
               $1, $2, $3, $4, $5, $6,
               $7, $8, 0.00, 0.00,
               $9, 0.00, $10, 0.000, 0.000, 0.000,
               'PENDING', $11::DATE, $12::DATE, $13,
               $14, $15, $16, TRUE, $17, $18,
               (SELECT fyear_id FROM tbl_org_financial_year WHERE comp_id = $17 AND is_current = TRUE LIMIT 1),
               $19
             );`,
            [
              woId,
              ro.op_sequence,
              ro.op_code,
              ro.op_name,
              ro.work_center_id,
              ro.machine_id || null,
              ro.setup_time_mins || 0,
              ro.run_time_mins || 0,
              plannedOpCost,
              dto.plannedQty,
              dto.scheduledStartDate,
              dto.scheduledEndDate,
              ro.is_inspection_required || false,
              ro.is_subcontracted || false,
              ro.subcontract_vendor_id || null,
              ro.remarks || null,
              compId,
              branchId,
              userId,
            ],
          );
        }
      }

      // 3. Update Totals on WO Header
      const estimatedTotalCost =
        Math.round((estimatedMaterialCost + estimatedOperationCost) * 100) / 100;

      await client.query(
        `UPDATE tbl_mfg_wo_header
         SET estimated_material_cost = $1,
             estimated_operation_cost = $2,
             estimated_total_cost = $3
         WHERE wo_id = $4;`,
        [estimatedMaterialCost, estimatedOperationCost, estimatedTotalCost, woId],
      );

      // If created from MRP Planned Order, mark order as converted
      if (dto.mrpPlannedOrderId) {
        await client.query(
          `UPDATE tbl_mfg_mrp_planned_order
           SET status = 'CONVERTED_TO_WO', converted_wo_id = $1, updated_by = $2, updated_date = CURRENT_TIMESTAMP
           WHERE planned_order_id = $3;`,
          [woId, userId, dto.mrpPlannedOrderId],
        );
      }

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'MFG_WORK_ORDER',
        actionType: 'ADD',
        entityTable: 'tbl_mfg_wo_header',
        recordId: woId,
        newValue: {
          woNo,
          itemId: dto.itemId,
          plannedQty: dto.plannedQty,
          estimatedTotalCost,
        },
        compId,
        branchId,
      });

      return this.findOne(woId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Update Work Order (Draft only)
  // --------------------------------------------------------------------------
  async update(id: number, dto: UpdateWorkOrderDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;

    const existRes = await this.pool.query(
      `SELECT wo_id, wo_no, status, planned_qty, bom_id, routing_id
       FROM tbl_mfg_wo_header WHERE wo_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [id, compId],
    );

    if (existRes.rows.length === 0) {
      throw new NotFoundException(`Work Order #${id} not found`);
    }

    const current = existRes.rows[0];
    if (current.status !== 'DRAFT') {
      throw new BadRequestException(
        `Cannot edit Work Order in status '${current.status}'. Only 'DRAFT' orders may be modified.`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE tbl_mfg_wo_header
         SET target_warehouse_id = COALESCE($1, target_warehouse_id),
             wip_warehouse_id = COALESCE($2, wip_warehouse_id),
             planned_qty = COALESCE($3, planned_qty),
             scheduled_start_date = COALESCE($4::DATE, scheduled_start_date),
             scheduled_end_date = COALESCE($5::DATE, scheduled_end_date),
             priority = COALESCE($6, priority),
             batch_no = COALESCE($7, batch_no),
             remarks = COALESCE($8, remarks),
             updated_by = $9,
             updated_date = CURRENT_TIMESTAMP
         WHERE wo_id = $10;`,
        [
          dto.targetWarehouseId || null,
          dto.wipWarehouseId || null,
          dto.plannedQty || null,
          dto.scheduledStartDate || null,
          dto.scheduledEndDate || null,
          dto.priority || null,
          dto.batchNo || null,
          dto.remarks || null,
          userId,
          id,
        ],
      );

      // Re-reconcile BOM items if plannedQty changed
      if (dto.plannedQty && Number(dto.plannedQty) !== Number(current.planned_qty)) {
        await client.query(
          `UPDATE tbl_mfg_wo_bom_item
           SET required_qty = standard_qty_per_unit * $1 * (1 + scrap_factor_percent / 100),
               estimated_cost = (standard_qty_per_unit * $1 * (1 + scrap_factor_percent / 100)) * unit_cost
           WHERE wo_id = $2;`,
          [dto.plannedQty, id],
        );

        await client.query(
          `UPDATE tbl_mfg_wo_routing_op
           SET planned_qty = $1
           WHERE wo_id = $2;`,
          [dto.plannedQty, id],
        );

        // Recalculate header costs
        await client.query(
          `UPDATE tbl_mfg_wo_header
           SET estimated_material_cost = COALESCE((SELECT SUM(estimated_cost) FROM tbl_mfg_wo_bom_item WHERE wo_id = $1), 0),
               estimated_operation_cost = COALESCE((SELECT SUM(planned_cost) FROM tbl_mfg_wo_routing_op WHERE wo_id = $1), 0),
               estimated_total_cost = COALESCE((SELECT SUM(estimated_cost) FROM tbl_mfg_wo_bom_item WHERE wo_id = $1), 0) +
                                      COALESCE((SELECT SUM(planned_cost) FROM tbl_mfg_wo_routing_op WHERE wo_id = $1), 0)
           WHERE wo_id = $1;`,
          [id],
        );
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'MFG_WORK_ORDER',
        actionType: 'EDIT',
        entityTable: 'tbl_mfg_wo_header',
        recordId: id,
        oldValue: current,
        newValue: dto,
        compId,
        branchId,
      });

      return this.findOne(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Release to Shopfloor
  // --------------------------------------------------------------------------
  async release(id: number, dto: ReleaseWorkOrderDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;

    const existRes = await this.pool.query(
      `SELECT wo_id, wo_no, status FROM tbl_mfg_wo_header WHERE wo_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [id, compId],
    );

    if (existRes.rows.length === 0) {
      throw new NotFoundException(`Work Order #${id} not found`);
    }

    const current = existRes.rows[0];
    if (current.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only 'DRAFT' work orders can be released to the shopfloor. Current status is '${current.status}'.`,
      );
    }

    const res = await this.pool.query(
      `UPDATE tbl_mfg_wo_header
       SET status = 'RELEASED',
           released_by = $1,
           released_date = CURRENT_TIMESTAMP,
           remarks = COALESCE($2, remarks),
           updated_by = $1,
           updated_date = CURRENT_TIMESTAMP
       WHERE wo_id = $3
       RETURNING wo_id, wo_no, status, released_date;`,
      [userId, dto.releaseRemarks || null, id],
    );

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'MFG_WORK_ORDER',
      actionType: 'RELEASE',
      entityTable: 'tbl_mfg_wo_header',
      recordId: id,
      oldValue: { status: 'DRAFT' },
      newValue: { status: 'RELEASED', remarks: dto.releaseRemarks },
      compId,
      branchId,
    });

    return res.rows[0];
  }

  // --------------------------------------------------------------------------
  // Complete / Close Work Order
  // --------------------------------------------------------------------------
  async close(id: number, dto: CloseWorkOrderDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;

    const existRes = await this.pool.query(
      `SELECT wo_id, wo_no, status, planned_qty FROM tbl_mfg_wo_header WHERE wo_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [id, compId],
    );

    if (existRes.rows.length === 0) {
      throw new NotFoundException(`Work Order #${id} not found`);
    }

    const current = existRes.rows[0];
    if (current.status === 'CLOSED' || current.status === 'CANCELLED') {
      throw new BadRequestException(`Work Order is already ${current.status}.`);
    }

    const res = await this.pool.query(
      `UPDATE tbl_mfg_wo_header
       SET status = 'COMPLETED',
           completed_qty = $1,
           scrapped_qty = COALESCE($2, scrapped_qty),
           actual_end_date = CURRENT_TIMESTAMP,
           remarks = COALESCE($3, remarks),
           updated_by = $4,
           updated_date = CURRENT_TIMESTAMP
       WHERE wo_id = $5
       RETURNING wo_id, wo_no, status, completed_qty, scrapped_qty;`,
      [dto.completedQty, dto.scrappedQty || 0, dto.closeRemarks || null, userId, id],
    );

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'MFG_WORK_ORDER',
      actionType: 'CLOSE',
      entityTable: 'tbl_mfg_wo_header',
      recordId: id,
      oldValue: { status: current.status },
      newValue: { status: 'COMPLETED', completedQty: dto.completedQty, scrappedQty: dto.scrappedQty },
      compId,
      branchId,
    });

    return res.rows[0];
  }

  // --------------------------------------------------------------------------
  // 1-Click Convert MRP Planned Order to Work Order
  // --------------------------------------------------------------------------
  async convertFromMrpPlannedOrder(dto: ConvertMrpOrderDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const mpoRes = await this.pool.query(
      `SELECT
         po.planned_order_id,
         po.planned_order_no,
         po.item_id,
         po.bom_id,
         po.routing_id,
         po.order_type,
         po.planned_order_qty::FLOAT AS planned_order_qty,
         po.uom_id,
         po.required_by_date::TEXT AS required_by_date,
         po.order_release_date::TEXT AS order_release_date,
         po.status,
         i.default_warehouse_id
       FROM tbl_mfg_mrp_planned_order po
       JOIN tbl_inv_item i ON po.item_id = i.item_id
       WHERE po.planned_order_id = $1 AND po.comp_id = $2 AND po.is_active = TRUE;`,
      [dto.plannedOrderId, compId],
    );

    if (mpoRes.rows.length === 0) {
      throw new NotFoundException(`MRP Planned Order #${dto.plannedOrderId} not found`);
    }

    const mpo = mpoRes.rows[0];
    if (mpo.order_type !== 'MAKE') {
      throw new BadRequestException(`Only 'MAKE' orders can be converted into Work Orders.`);
    }

    if (mpo.status === 'CONVERTED_TO_WO') {
      throw new ConflictException(`Order ${mpo.planned_order_no} has already been converted to a Work Order.`);
    }

    return this.create(
      {
        itemId: mpo.item_id,
        bomId: mpo.bom_id,
        routingId: mpo.routing_id,
        targetWarehouseId: dto.targetWarehouseId || mpo.default_warehouse_id || 1004,
        wipWarehouseId: dto.wipWarehouseId || 1003,
        plannedQty: mpo.planned_order_qty,
        uomId: mpo.uom_id,
        scheduledStartDate: dto.scheduledStartDate || mpo.order_release_date,
        scheduledEndDate: dto.scheduledEndDate || mpo.required_by_date,
        priority: dto.priority || 'HIGH',
        mrpPlannedOrderId: mpo.planned_order_id,
        batchNo: dto.batchNo,
        remarks: dto.remarks || `Generated from MRP Planned Order ${mpo.planned_order_no}`,
      },
      user,
    );
  }

  // --------------------------------------------------------------------------
  // Delete Work Order (Draft only)
  // --------------------------------------------------------------------------
  async delete(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const existRes = await this.pool.query(
      `SELECT wo_id, wo_no, status FROM tbl_mfg_wo_header WHERE wo_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [id, compId],
    );

    if (existRes.rows.length === 0) {
      throw new NotFoundException(`Work Order #${id} not found`);
    }

    const current = existRes.rows[0];
    if (current.status !== 'DRAFT' && current.status !== 'CANCELLED') {
      throw new BadRequestException(
        `Cannot delete Work Order in '${current.status}' status. Only 'DRAFT' or 'CANCELLED' orders can be removed.`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM tbl_mfg_wo_routing_op WHERE wo_id = $1;`, [id]);
      await client.query(`DELETE FROM tbl_mfg_wo_bom_item WHERE wo_id = $1;`, [id]);
      await client.query(`DELETE FROM tbl_mfg_wo_header WHERE wo_id = $1;`, [id]);
      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId: user.userId || 1001,
        username: user.username,
        screenCode: 'MFG_WORK_ORDER',
        actionType: 'DELETE',
        entityTable: 'tbl_mfg_wo_header',
        recordId: id,
        oldValue: { woNo: current.wo_no },
        compId,
        branchId,
      });

      return { message: `Work Order ${current.wo_no} deleted successfully.` };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
