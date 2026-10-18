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
  ConvertPlannedOrderDto,
  MrpFilterParams,
  RunMrpDto,
  UpdatePlannedOrderStatusDto,
} from './mrp.dto';

interface RawItem {
  item_id: number;
  item_code: string;
  item_name: string;
  item_type: string;
  base_uom_id: number;
  uom_name: string;
  uom_code: string;
  standard_cost: number;
  purchase_rate: number;
  min_stock_level: number;
  reorder_point: number;
  safety_stock: number;
  lead_time_days: number;
  inspection_lead_time_days: number;
  is_bom_allowed: boolean;
}

interface BomHeaderRow {
  bom_id: number;
  bom_code: string;
  bom_name: string;
  item_id: number;
  routing_id: number | null;
  batch_size: number;
  status: string;
  is_default: boolean;
}

interface BomItemRow {
  bom_item_id: number;
  bom_id: number;
  item_id: number;
  uom_id: number;
  quantity: number;
  scrap_factor_percent: number;
  gross_quantity: number;
  child_bom_id: number | null;
  source_type: string;
  unit_cost: number;
}

interface RoutingRow {
  routing_id: number;
  routing_code: string;
  routing_name: string;
  item_id: number;
  total_run_time_mins: number;
  total_cost_per_unit: number;
}

interface PlannedOrderEntry {
  planned_order_no: string;
  item_id: number;
  bom_id: number | null;
  routing_id: number | null;
  order_type: 'MAKE' | 'BUY' | 'SUBCONTRACT';
  source_demand_type: string;
  parent_temp_id: number | null; // index or temporary ID for linking
  bom_level: number;
  gross_requirement_qty: number;
  on_hand_stock_qty: number;
  scheduled_receipts_qty: number;
  safety_stock_qty: number;
  net_requirement_qty: number;
  planned_order_qty: number;
  uom_id: number;
  lead_time_days: number;
  required_by_date: string;
  order_release_date: string;
  estimated_unit_cost: number;
  estimated_total_cost: number;
  status: string;
  remarks: string;
}

@Injectable()
export class MrpService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  // --------------------------------------------------------------------------
  // KPI Summary
  // --------------------------------------------------------------------------
  async getMrpSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const sql = `
      SELECT
        (SELECT COUNT(*)::INT FROM tbl_mfg_mrp_run_header WHERE comp_id = $1 AND is_active = TRUE) AS total_runs,
        (SELECT COUNT(*)::INT FROM tbl_mfg_mrp_planned_order WHERE comp_id = $1 AND is_active = TRUE) AS total_planned_orders,
        (SELECT COALESCE(SUM(estimated_total_cost), 0)::FLOAT FROM tbl_mfg_mrp_planned_order WHERE comp_id = $1 AND order_type = 'BUY' AND is_active = TRUE) AS total_buy_spend,
        (SELECT COUNT(*)::INT FROM tbl_mfg_mrp_planned_order WHERE comp_id = $1 AND order_type = 'MAKE' AND is_active = TRUE) AS total_make_orders,
        (SELECT COUNT(*)::INT FROM tbl_mfg_mrp_planned_order WHERE comp_id = $1 AND status IN ('SUGGESTED', 'CONFIRMED') AND order_release_date < CURRENT_DATE AND is_active = TRUE) AS critical_past_due
    `;

    const res = await this.pool.query(sql, [compId]);
    const r = res.rows[0] || {};
    return {
      totalRuns: Number(r.total_runs || 0),
      totalPlannedOrders: Number(r.total_planned_orders || 0),
      totalPlannedBuySpend: Math.round(Number(r.total_buy_spend || 0) * 100) / 100,
      totalPlannedMakeOrders: Number(r.total_make_orders || 0),
      criticalPastDueCount: Number(r.critical_past_due || 0),
    };
  }

  // --------------------------------------------------------------------------
  // Lookups
  // --------------------------------------------------------------------------
  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const [itemsRes, whRes, deptRes, vendorRes] = await Promise.all([
      this.pool.query(
        `SELECT
           i.item_id,
           i.item_code,
           i.item_name,
           i.item_type,
           i.base_uom_id,
           u.uom_name,
           u.uom_code,
           COALESCE(i.standard_cost, 0)::FLOAT AS standard_cost,
           COALESCE(i.purchase_rate, 0)::FLOAT AS purchase_rate,
           COALESCE(i.min_stock_level, 0)::FLOAT AS min_stock_level,
           COALESCE(i.reorder_point, 0)::FLOAT AS reorder_point,
           COALESCE(i.safety_stock, 0)::FLOAT AS safety_stock,
           COALESCE(i.lead_time_days, 1)::INT AS lead_time_days,
           COALESCE(i.inspection_lead_time_days, 0)::INT AS inspection_lead_time_days,
           i.is_bom_allowed
         FROM tbl_inv_item i
         JOIN tbl_inv_uom u ON i.base_uom_id = u.uom_id
         WHERE i.comp_id = $1 AND i.is_active = TRUE
         ORDER BY i.item_name ASC`,
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
        `SELECT dept_id, dept_code, dept_name, dept_category
         FROM tbl_hr_department
         WHERE comp_id = $1 AND is_active = TRUE
         ORDER BY dept_name ASC`,
        [compId],
      ),
      this.pool.query(
        `SELECT party_id, party_code, party_name
         FROM tbl_crm_party
         WHERE comp_id = $1 AND party_type = 'VENDOR' AND is_active = TRUE
         ORDER BY party_name ASC`,
        [compId],
      ),
    ]);

    return {
      items: itemsRes.rows,
      warehouses: whRes.rows,
      departments: deptRes.rows,
      vendors: vendorRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // Find All MRP Runs (Paginated)
  // --------------------------------------------------------------------------
  async findAllRuns(params: MrpFilterParams, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['r.comp_id = $1', 'r.is_active = TRUE'];
    const values: any[] = [compId];
    let idx = 2;

    if (params.search?.trim()) {
      conditions.push(
        `(r.mrp_run_no ILIKE $${idx} OR r.remarks ILIKE $${idx})`,
      );
      values.push(`%${params.search.trim()}%`);
      idx++;
    }

    if (params.status?.trim()) {
      conditions.push(`r.status = $${idx}`);
      values.push(params.status.trim());
      idx++;
    }

    if (params.demandSource?.trim()) {
      conditions.push(`r.demand_source = $${idx}`);
      values.push(params.demandSource.trim());
      idx++;
    }

    if (params.startDate) {
      conditions.push(`r.run_date >= $${idx}::TIMESTAMPTZ`);
      values.push(params.startDate);
      idx++;
    }

    if (params.endDate) {
      conditions.push(`r.run_date <= $${idx}::TIMESTAMPTZ`);
      values.push(params.endDate);
      idx++;
    }

    const whereClause = conditions.join(' AND ');

    const countSql = `SELECT COUNT(*)::INT AS total FROM tbl_mfg_mrp_run_header r WHERE ${whereClause};`;
    const countRes = await this.pool.query(countSql, values);
    const total = Number(countRes.rows[0]?.total || 0);

    const dataSql = `
      SELECT
        r.mrp_run_id,
        r.mrp_run_no,
        r.run_date,
        r.planning_horizon_days,
        r.demand_source,
        r.status,
        r.total_items_analyzed,
        r.total_planned_orders,
        r.total_planned_buy_qty::FLOAT AS total_planned_buy_qty,
        r.total_planned_make_qty::FLOAT AS total_planned_make_qty,
        r.total_estimated_spend::FLOAT AS total_estimated_spend,
        r.execution_time_ms,
        r.run_by,
        u.full_name AS run_by_name,
        r.remarks,
        r.comp_id,
        r.branch_id,
        r.created_date,
        (SELECT COUNT(*)::INT FROM tbl_mfg_mrp_planned_order po WHERE po.mrp_run_id = r.mrp_run_id AND po.status IN ('SUGGESTED', 'CONFIRMED') AND po.order_release_date < CURRENT_DATE AND po.is_active = TRUE) AS past_due_order_count
      FROM tbl_mfg_mrp_run_header r
      LEFT JOIN tbl_sec_user u ON r.run_by = u.user_id
      WHERE ${whereClause}
      ORDER BY r.run_date DESC, r.mrp_run_id DESC
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
  // Find Run Detail & Associated Planned Orders
  // --------------------------------------------------------------------------
  async findRunDetail(runId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const runRes = await this.pool.query(
      `SELECT
         r.mrp_run_id,
         r.mrp_run_no,
         r.run_date,
         r.planning_horizon_days,
         r.demand_source,
         r.status,
         r.total_items_analyzed,
         r.total_planned_orders,
         r.total_planned_buy_qty::FLOAT AS total_planned_buy_qty,
         r.total_planned_make_qty::FLOAT AS total_planned_make_qty,
         r.total_estimated_spend::FLOAT AS total_estimated_spend,
         r.execution_time_ms,
         r.run_by,
         u.full_name AS run_by_name,
         r.remarks,
         r.comp_id,
         r.branch_id,
         r.created_date
       FROM tbl_mfg_mrp_run_header r
       LEFT JOIN tbl_sec_user u ON r.run_by = u.user_id
       WHERE r.mrp_run_id = $1 AND r.comp_id = $2 AND r.is_active = TRUE;`,
      [runId, compId],
    );

    if (runRes.rows.length === 0) {
      throw new NotFoundException(`MRP Run #${runId} not found`);
    }

    const run = runRes.rows[0];

    const ordersRes = await this.pool.query(
      `SELECT
         po.planned_order_id,
         po.mrp_run_id,
         po.planned_order_no,
         po.item_id,
         i.item_code,
         i.item_name,
         i.item_type,
         po.bom_id,
         b.bom_code,
         b.bom_name,
         po.routing_id,
         rt.routing_code,
         rt.routing_name,
         po.order_type,
         po.source_demand_type,
         po.parent_planned_order_id,
         ppo.planned_order_no AS parent_planned_order_no,
         po.bom_level,
         po.gross_requirement_qty::FLOAT AS gross_requirement_qty,
         po.on_hand_stock_qty::FLOAT AS on_hand_stock_qty,
         po.scheduled_receipts_qty::FLOAT AS scheduled_receipts_qty,
         po.safety_stock_qty::FLOAT AS safety_stock_qty,
         po.net_requirement_qty::FLOAT AS net_requirement_qty,
         po.planned_order_qty::FLOAT AS planned_order_qty,
         po.uom_id,
         u.uom_code,
         u.uom_name,
         po.lead_time_days,
         po.required_by_date::TEXT AS required_by_date,
         po.order_release_date::TEXT AS order_release_date,
         po.estimated_unit_cost::FLOAT AS estimated_unit_cost,
         po.estimated_total_cost::FLOAT AS estimated_total_cost,
         po.status,
         po.converted_pr_id,
         pr.pr_no AS converted_pr_no,
         pr.status AS converted_pr_status,
         po.converted_wo_id,
         po.remarks,
         (po.order_release_date < CURRENT_DATE AND po.status IN ('SUGGESTED', 'CONFIRMED')) AS is_past_due
       FROM tbl_mfg_mrp_planned_order po
       JOIN tbl_inv_item i ON po.item_id = i.item_id
       JOIN tbl_inv_uom u ON po.uom_id = u.uom_id
       LEFT JOIN tbl_mfg_bom_header b ON po.bom_id = b.bom_id
       LEFT JOIN tbl_mfg_routing_header rt ON po.routing_id = rt.routing_id
       LEFT JOIN tbl_mfg_mrp_planned_order ppo ON po.parent_planned_order_id = ppo.planned_order_id
       LEFT JOIN tbl_pr_header pr ON po.converted_pr_id = pr.pr_id
       WHERE po.mrp_run_id = $1 AND po.is_active = TRUE
       ORDER BY po.bom_level ASC, po.required_by_date ASC, po.planned_order_id ASC;`,
      [runId],
    );

    return {
      ...run,
      plannedOrders: ordersRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // Find All Planned Orders (Cross-Run Filterable)
  // --------------------------------------------------------------------------
  async findAllPlannedOrders(
    params: MrpFilterParams,
    user: AuthenticatedUserContext,
  ) {
    const compId = user.compId || 1001;
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 20));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['po.comp_id = $1', 'po.is_active = TRUE'];
    const values: any[] = [compId];
    let idx = 2;

    if (params.mrpRunId) {
      conditions.push(`po.mrp_run_id = $${idx}`);
      values.push(params.mrpRunId);
      idx++;
    }

    if (params.search?.trim()) {
      conditions.push(
        `(po.planned_order_no ILIKE $${idx} OR i.item_code ILIKE $${idx} OR i.item_name ILIKE $${idx} OR po.remarks ILIKE $${idx})`,
      );
      values.push(`%${params.search.trim()}%`);
      idx++;
    }

    if (params.orderType?.trim()) {
      conditions.push(`po.order_type = $${idx}`);
      values.push(params.orderType.trim());
      idx++;
    }

    if (params.status?.trim()) {
      conditions.push(`po.status = $${idx}`);
      values.push(params.status.trim());
      idx++;
    }

    if (params.bomLevel !== undefined && params.bomLevel !== null) {
      conditions.push(`po.bom_level = $${idx}`);
      values.push(params.bomLevel);
      idx++;
    }

    if (params.isPastDue === 'true') {
      conditions.push(
        `po.order_release_date < CURRENT_DATE AND po.status IN ('SUGGESTED', 'CONFIRMED')`,
      );
    } else if (params.isPastDue === 'false') {
      conditions.push(
        `po.order_release_date >= CURRENT_DATE OR po.status NOT IN ('SUGGESTED', 'CONFIRMED')`,
      );
    }

    const whereClause = conditions.join(' AND ');

    const countSql = `
      SELECT COUNT(*)::INT AS total
      FROM tbl_mfg_mrp_planned_order po
      JOIN tbl_inv_item i ON po.item_id = i.item_id
      WHERE ${whereClause};
    `;
    const countRes = await this.pool.query(countSql, values);
    const total = Number(countRes.rows[0]?.total || 0);

    const dataSql = `
      SELECT
        po.planned_order_id,
        po.mrp_run_id,
        r.mrp_run_no,
        po.planned_order_no,
        po.item_id,
        i.item_code,
        i.item_name,
        i.item_type,
        po.bom_id,
        b.bom_code,
        b.bom_name,
        po.routing_id,
        rt.routing_code,
        rt.routing_name,
        po.order_type,
        po.source_demand_type,
        po.parent_planned_order_id,
        ppo.planned_order_no AS parent_planned_order_no,
        po.bom_level,
        po.gross_requirement_qty::FLOAT AS gross_requirement_qty,
        po.on_hand_stock_qty::FLOAT AS on_hand_stock_qty,
        po.scheduled_receipts_qty::FLOAT AS scheduled_receipts_qty,
        po.safety_stock_qty::FLOAT AS safety_stock_qty,
        po.net_requirement_qty::FLOAT AS net_requirement_qty,
        po.planned_order_qty::FLOAT AS planned_order_qty,
        po.uom_id,
        u.uom_code,
        u.uom_name,
        po.lead_time_days,
        po.required_by_date::TEXT AS required_by_date,
        po.order_release_date::TEXT AS order_release_date,
        po.estimated_unit_cost::FLOAT AS estimated_unit_cost,
        po.estimated_total_cost::FLOAT AS estimated_total_cost,
        po.status,
        po.converted_pr_id,
        pr.pr_no AS converted_pr_no,
        pr.status AS converted_pr_status,
        po.converted_wo_id,
        po.remarks,
        (po.order_release_date < CURRENT_DATE AND po.status IN ('SUGGESTED', 'CONFIRMED')) AS is_past_due
      FROM tbl_mfg_mrp_planned_order po
      JOIN tbl_mfg_mrp_run_header r ON po.mrp_run_id = r.mrp_run_id
      JOIN tbl_inv_item i ON po.item_id = i.item_id
      JOIN tbl_inv_uom u ON po.uom_id = u.uom_id
      LEFT JOIN tbl_mfg_bom_header b ON po.bom_id = b.bom_id
      LEFT JOIN tbl_mfg_routing_header rt ON po.routing_id = rt.routing_id
      LEFT JOIN tbl_mfg_mrp_planned_order ppo ON po.parent_planned_order_id = ppo.planned_order_id
      LEFT JOIN tbl_pr_header pr ON po.converted_pr_id = pr.pr_id
      WHERE ${whereClause}
      ORDER BY po.bom_level ASC, po.required_by_date ASC, po.planned_order_id ASC
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
  // Execute Gross-to-Net MRP Calculation Engine
  // --------------------------------------------------------------------------
  async runMrp(dto: RunMrpDto, user: AuthenticatedUserContext) {
    const startTime = Date.now();
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;
    const planningHorizonDays = dto.planningHorizonDays || 30;
    const demandSource = dto.demandSource || 'BUFFER_DEFICIT';
    const includeSafetyStock = dto.includeSafetyStock !== false;

    // 1. Fetch Items
    let itemsQuery = `
      SELECT
        i.item_id,
        i.item_code,
        i.item_name,
        i.item_type,
        i.base_uom_id,
        u.uom_name,
        u.uom_code,
        COALESCE(i.standard_cost, 0)::FLOAT AS standard_cost,
        COALESCE(i.purchase_rate, 0)::FLOAT AS purchase_rate,
        COALESCE(i.min_stock_level, 0)::FLOAT AS min_stock_level,
        COALESCE(i.reorder_point, 0)::FLOAT AS reorder_point,
        COALESCE(i.safety_stock, 0)::FLOAT AS safety_stock,
        COALESCE(i.lead_time_days, 1)::INT AS lead_time_days,
        COALESCE(i.inspection_lead_time_days, 0)::INT AS inspection_lead_time_days,
        i.is_bom_allowed
      FROM tbl_inv_item i
      JOIN tbl_inv_uom u ON i.base_uom_id = u.uom_id
      WHERE i.comp_id = $1 AND i.is_active = TRUE
    `;
    const itemsParams: any[] = [compId];

    if (dto.specificItemIds && dto.specificItemIds.length > 0) {
      itemsQuery += ` AND i.item_id = ANY($2::BIGINT[])`;
      itemsParams.push(dto.specificItemIds);
    }
    itemsQuery += ` ORDER BY i.item_type DESC, i.item_id ASC;`;

    const itemsRes = await this.pool.query<RawItem>(itemsQuery, itemsParams);
    const allItems = itemsRes.rows;
    const itemMap = new Map<number, RawItem>();
    allItems.forEach((itm) => itemMap.set(itm.item_id, itm));

    // 2. Query On-Hand Stock from tbl_inv_bin_stock
    const stockRes = await this.pool.query(
      `SELECT item_id, COALESCE(SUM(quantity), 0)::FLOAT AS total_qty
       FROM tbl_inv_bin_stock
       WHERE comp_id = $1 AND is_active = TRUE
       GROUP BY item_id;`,
      [compId],
    );
    const stockMap = new Map<number, number>();
    stockRes.rows.forEach((r) => stockMap.set(Number(r.item_id), Number(r.total_qty)));

    // 3. Query Open Purchase Orders (Scheduled Receipts)
    const poRes = await this.pool.query(
      `SELECT pi.item_id, COALESCE(SUM(pi.order_qty - pi.received_qty), 0)::FLOAT AS scheduled_qty
       FROM tbl_po_item pi
       JOIN tbl_po_header ph ON pi.po_id = ph.po_id
       WHERE ph.comp_id = $1 AND ph.status IN ('APPROVED', 'RELEASED')
         AND pi.order_qty > pi.received_qty AND pi.is_active = TRUE
       GROUP BY pi.item_id;`,
      [compId],
    );
    const poMap = new Map<number, number>();
    poRes.rows.forEach((r) => poMap.set(Number(r.item_id), Number(r.scheduled_qty)));

    // 4. Query Active BOM Headers and Line Items
    const bomHeadersRes = await this.pool.query<BomHeaderRow>(
      `SELECT bom_id, bom_code, bom_name, item_id, routing_id, batch_size::FLOAT AS batch_size, status, is_default
       FROM tbl_mfg_bom_header
       WHERE comp_id = $1 AND status = 'ACTIVE' AND is_active = TRUE;`,
      [compId],
    );
    const defaultBomByItem = new Map<number, BomHeaderRow>();
    bomHeadersRes.rows.forEach((b) => {
      if (!defaultBomByItem.has(b.item_id) || b.is_default) {
        defaultBomByItem.set(b.item_id, b);
      }
    });

    const bomItemsRes = await this.pool.query<BomItemRow>(
      `SELECT bom_item_id, bom_id, item_id, uom_id,
              quantity::FLOAT AS quantity,
              scrap_factor_percent::FLOAT AS scrap_factor_percent,
              gross_quantity::FLOAT AS gross_quantity,
              child_bom_id, source_type,
              unit_cost::FLOAT AS unit_cost
       FROM tbl_mfg_bom_item
       WHERE comp_id = $1 AND is_active = TRUE;`,
      [compId],
    );
    const bomItemsByBomId = new Map<number, BomItemRow[]>();
    bomItemsRes.rows.forEach((bi) => {
      if (!bomItemsByBomId.has(bi.bom_id)) {
        bomItemsByBomId.set(bi.bom_id, []);
      }
      bomItemsByBomId.get(bi.bom_id)!.push(bi);
    });

    // 5. Query Active Routings
    const routingRes = await this.pool.query<RoutingRow>(
      `SELECT routing_id, routing_code, routing_name, item_id,
              total_run_time_mins::FLOAT AS total_run_time_mins,
              total_cost_per_unit::FLOAT AS total_cost_per_unit
       FROM tbl_mfg_routing_header
       WHERE comp_id = $1 AND status = 'ACTIVE' AND is_active = TRUE;`,
      [compId],
    );
    const routingByItem = new Map<number, RoutingRow>();
    routingRes.rows.forEach((rt) => routingByItem.set(rt.item_id, rt));

    // Helper: date arithmetic
    const addDays = (date: Date, days: number): Date => {
      const result = new Date(date);
      result.setDate(result.getDate() + days);
      return result;
    };
    const formatDate = (date: Date): string => {
      return date.toISOString().split('T')[0];
    };

    const plannedOrders: PlannedOrderEntry[] = [];
    let orderSeq = 1;

    // Helper: Explode BOM recursively
    const explodeBom = (
      parentOrderIndex: number,
      parentItemId: number,
      parentOrderQty: number,
      parentReleaseDateStr: string,
      currentLevel: number,
    ) => {
      if (currentLevel > 4) return; // Cycle and depth guard

      const activeBom = defaultBomByItem.get(parentItemId);
      if (!activeBom) return;

      const components = bomItemsByBomId.get(activeBom.bom_id) || [];
      const parentReleaseDate = new Date(parentReleaseDateStr);

      for (const comp of components) {
        const childItem = itemMap.get(comp.item_id);
        if (!childItem) continue;

        // Gross requirement = parent_order_qty * (comp.gross_quantity / activeBom.batch_size)
        const batchRatio = comp.gross_quantity / (activeBom.batch_size || 1);
        const childGrossReq = Math.round(parentOrderQty * batchRatio * 1000) / 1000;

        const childOnHand = stockMap.get(childItem.item_id) || 0;
        const childScheduled = poMap.get(childItem.item_id) || 0;
        const childSafety = includeSafetyStock ? childItem.safety_stock : 0;

        // Net Requirement = Gross + Safety - OnHand - Scheduled
        let childNetReq = childGrossReq + childSafety - (childOnHand + childScheduled);
        if (childNetReq < 0) childNetReq = 0;

        // Even if net requirement is 0, if gross requirement is significant and on-hand covers it,
        // we can still suggest an order if on_hand is depleted below safety stock.
        const childOrderQty = Math.max(childNetReq, childGrossReq);
        if (childOrderQty <= 0) continue;

        // Deduct from temporary on-hand so subsequent components see the consumption
        stockMap.set(childItem.item_id, Math.max(0, childOnHand - childGrossReq));

        const isChildMfg =
          childItem.item_type === 'FINISHED_GOODS' ||
          childItem.item_type === 'WIP_SEMI_FINISHED' ||
          defaultBomByItem.has(childItem.item_id);

        const childOrderType: 'MAKE' | 'BUY' | 'SUBCONTRACT' = isChildMfg
          ? 'MAKE'
          : comp.source_type === 'SUBCONTRACT'
            ? 'SUBCONTRACT'
            : 'BUY';

        const childLeadTime =
          childOrderType === 'MAKE'
            ? childItem.lead_time_days
            : childItem.lead_time_days + childItem.inspection_lead_time_days;

        const childRequiredDate = new Date(parentReleaseDate);
        const childReleaseDate = addDays(childRequiredDate, -childLeadTime);

        const childBom = isChildMfg ? defaultBomByItem.get(childItem.item_id) : null;
        const childRouting = isChildMfg ? routingByItem.get(childItem.item_id) : null;

        const unitCost =
          childOrderType === 'MAKE'
            ? childItem.standard_cost || (childBom ? 500 : 100)
            : childItem.purchase_rate || childItem.standard_cost || 100;

        const plannedNo = `PLN-ORD-${String(orderSeq++).padStart(4, '0')}`;
        const childOrderIndex = plannedOrders.length;

        plannedOrders.push({
          planned_order_no: plannedNo,
          item_id: childItem.item_id,
          bom_id: childBom ? childBom.bom_id : null,
          routing_id: childRouting ? childRouting.routing_id : null,
          order_type: childOrderType,
          source_demand_type: 'PARENT_BOM_EXPLOSION',
          parent_temp_id: parentOrderIndex,
          bom_level: currentLevel,
          gross_requirement_qty: childGrossReq,
          on_hand_stock_qty: childOnHand,
          scheduled_receipts_qty: childScheduled,
          safety_stock_qty: childSafety,
          net_requirement_qty: childNetReq,
          planned_order_qty: childOrderQty,
          uom_id: childItem.base_uom_id,
          lead_time_days: childLeadTime,
          required_by_date: formatDate(childRequiredDate),
          order_release_date: formatDate(childReleaseDate),
          estimated_unit_cost: unitCost,
          estimated_total_cost: Math.round(childOrderQty * unitCost * 100) / 100,
          status: 'SUGGESTED',
          remarks: `Exploded component (Level ${currentLevel}) from parent planned order. Lead time ${childLeadTime}d.`,
        });

        // If this child is manufactured, recurse to explode its children!
        if (isChildMfg) {
          explodeBom(
            childOrderIndex,
            childItem.item_id,
            childOrderQty,
            formatDate(childReleaseDate),
            currentLevel + 1,
          );
        }
      }
    };

    // 6. Level 0 Identification: Check Buffer Deficits
    const today = new Date();
    const horizonEndDate = addDays(today, planningHorizonDays);

    // Prioritize manufactured goods first so BOM explosion happens, then direct raw materials
    const sortedItems = [...allItems].sort((a, b) => {
      const aMfg = a.item_type === 'FINISHED_GOODS' || a.item_type === 'WIP_SEMI_FINISHED' ? 1 : 0;
      const bMfg = b.item_type === 'FINISHED_GOODS' || b.item_type === 'WIP_SEMI_FINISHED' ? 1 : 0;
      return bMfg - aMfg;
    });

    for (const item of sortedItems) {
      const onHand = stockMap.get(item.item_id) || 0;
      const scheduled = poMap.get(item.item_id) || 0;
      const safetyStock = includeSafetyStock ? item.safety_stock : 0;
      const targetBuffer =
        item.reorder_point > 0
          ? item.reorder_point
          : safetyStock > 0
            ? safetyStock
            : item.min_stock_level;

      const totalProjected = onHand + scheduled;

      // Deficit condition: Projected stock < targetBuffer (or if on_hand is below safety stock)
      if (totalProjected < targetBuffer || (safetyStock > 0 && onHand < safetyStock)) {
        const grossDeficit = Math.max(0, targetBuffer - totalProjected);
        const netDeficit = Math.round((grossDeficit + safetyStock) * 1000) / 1000;
        const plannedQty = Math.max(netDeficit, grossDeficit, item.min_stock_level || 10);

        if (plannedQty <= 0) continue;

        const isMfg =
          item.item_type === 'FINISHED_GOODS' ||
          item.item_type === 'WIP_SEMI_FINISHED' ||
          defaultBomByItem.has(item.item_id);

        const orderType: 'MAKE' | 'BUY' | 'SUBCONTRACT' = isMfg ? 'MAKE' : 'BUY';
        const bom = isMfg ? defaultBomByItem.get(item.item_id) : null;
        const routing = isMfg ? routingByItem.get(item.item_id) : null;

        const leadTime =
          orderType === 'MAKE'
            ? item.lead_time_days
            : item.lead_time_days + item.inspection_lead_time_days;

        // Level 0 Required date = today + 15..25 days (within horizon)
        const requiredDate = addDays(today, Math.min(planningHorizonDays, Math.max(14, leadTime + 5)));
        const releaseDate = addDays(requiredDate, -leadTime);

        const unitCost =
          orderType === 'MAKE'
            ? item.standard_cost || 1500
            : item.purchase_rate || item.standard_cost || 150;

        const plannedNo = `PLN-ORD-${String(orderSeq++).padStart(4, '0')}`;
        const parentOrderIndex = plannedOrders.length;

        plannedOrders.push({
          planned_order_no: plannedNo,
          item_id: item.item_id,
          bom_id: bom ? bom.bom_id : null,
          routing_id: routing ? routing.routing_id : null,
          order_type: orderType,
          source_demand_type: 'BUFFER_DEFICIT',
          parent_temp_id: null,
          bom_level: 0,
          gross_requirement_qty: grossDeficit,
          on_hand_stock_qty: onHand,
          scheduled_receipts_qty: scheduled,
          safety_stock_qty: safetyStock,
          net_requirement_qty: netDeficit,
          planned_order_qty: plannedQty,
          uom_id: item.base_uom_id,
          lead_time_days: leadTime,
          required_by_date: formatDate(requiredDate),
          order_release_date: formatDate(releaseDate),
          estimated_unit_cost: unitCost,
          estimated_total_cost: Math.round(plannedQty * unitCost * 100) / 100,
          status: 'SUGGESTED',
          remarks: `Buffer deficit replenishment (Level 0). On-hand: ${onHand}, ROP: ${item.reorder_point}, Safety: ${safetyStock}.`,
        });

        // Deduct from virtual stock
        stockMap.set(item.item_id, onHand + plannedQty);

        // If manufactured, explode BOM items
        if (isMfg && bom) {
          explodeBom(
            parentOrderIndex,
            item.item_id,
            plannedQty,
            formatDate(releaseDate),
            1,
          );
        }
      }
    }

    // 7. Calculate Aggregates
    let totalPlannedBuyQty = 0;
    let totalPlannedMakeQty = 0;
    let totalEstimatedSpend = 0;

    for (const po of plannedOrders) {
      if (po.order_type === 'BUY') {
        totalPlannedBuyQty += po.planned_order_qty;
        totalEstimatedSpend += po.estimated_total_cost;
      } else if (po.order_type === 'MAKE') {
        totalPlannedMakeQty += po.planned_order_qty;
      }
    }

    const executionTimeMs = Date.now() - startTime;

    // 8. Generate Next MRP Run No e.g. MRP-AHM-2627-0003
    const branchRes = await this.pool.query(
      `SELECT b.branch_code, fy.fyear_code
       FROM tbl_org_branch b
       LEFT JOIN tbl_org_financial_year fy ON fy.comp_id = b.comp_id AND fy.is_current = TRUE
       WHERE b.branch_id = $1;`,
      [branchId],
    );
    const branchCode = branchRes.rows[0]?.branch_code || 'AHM';
    const fyearCode = (branchRes.rows[0]?.fyear_code || '2627').replace(/[^0-9]/g, '');

    const runCountRes = await this.pool.query(
      `SELECT COUNT(*)::INT AS count FROM tbl_mfg_mrp_run_header WHERE comp_id = $1;`,
      [compId],
    );
    const nextRunSeq = Number(runCountRes.rows[0]?.count || 0) + 1;
    const mrpRunNo = `MRP-${branchCode}-${fyearCode}-${String(nextRunSeq).padStart(4, '0')}`;

    // 9. Database Transaction
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const insertRunSql = `
        INSERT INTO tbl_mfg_mrp_run_header (
          mrp_run_no, run_date, planning_horizon_days, demand_source,
          status, total_items_analyzed, total_planned_orders,
          total_planned_buy_qty, total_planned_make_qty, total_estimated_spend,
          execution_time_ms, run_by, remarks, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, CURRENT_TIMESTAMP, $2, $3,
          'COMPLETED', $4, $5,
          $6, $7, $8,
          $9, $10, $11, TRUE,
          $12, $13, (SELECT fyear_id FROM tbl_org_financial_year WHERE comp_id = $12 AND is_current = TRUE LIMIT 1), $10
        ) RETURNING mrp_run_id, mrp_run_no, run_date, status;
      `;

      const runInsertRes = await client.query(insertRunSql, [
        mrpRunNo,
        planningHorizonDays,
        demandSource,
        allItems.length,
        plannedOrders.length,
        totalPlannedBuyQty,
        totalPlannedMakeQty,
        totalEstimatedSpend,
        executionTimeMs,
        userId,
        dto.remarks || `Gross-to-net MRP calculation for horizon of ${planningHorizonDays} days.`,
        compId,
        branchId,
      ]);

      const createdRun = runInsertRes.rows[0];
      const mrpRunId = createdRun.mrp_run_id;

      // Map temporary indices to generated planned_order_id in DB
      const indexToDbIdMap = new Map<number, number>();

      for (let i = 0; i < plannedOrders.length; i++) {
        const po = plannedOrders[i];
        const parentDbId =
          po.parent_temp_id !== null ? indexToDbIdMap.get(po.parent_temp_id) || null : null;

        const insertPoSql = `
          INSERT INTO tbl_mfg_mrp_planned_order (
            mrp_run_id, planned_order_no, item_id, bom_id, routing_id,
            order_type, source_demand_type, parent_planned_order_id, bom_level,
            gross_requirement_qty, on_hand_stock_qty, scheduled_receipts_qty, safety_stock_qty,
            net_requirement_qty, planned_order_qty, uom_id, lead_time_days,
            required_by_date, order_release_date, estimated_unit_cost, estimated_total_cost,
            status, remarks, is_active,
            comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12, $13,
            $14, $15, $16, $17,
            $18::DATE, $19::DATE, $20, $21,
            $22, $23, TRUE,
            $24, $25, (SELECT fyear_id FROM tbl_org_financial_year WHERE comp_id = $24 AND is_current = TRUE LIMIT 1), $26
          ) RETURNING planned_order_id;
        `;

        const poInsertRes = await client.query(insertPoSql, [
          mrpRunId,
          po.planned_order_no,
          po.item_id,
          po.bom_id,
          po.routing_id,
          po.order_type,
          po.source_demand_type,
          parentDbId,
          po.bom_level,
          po.gross_requirement_qty,
          po.on_hand_stock_qty,
          po.scheduled_receipts_qty,
          po.safety_stock_qty,
          po.net_requirement_qty,
          po.planned_order_qty,
          po.uom_id,
          po.lead_time_days,
          po.required_by_date,
          po.order_release_date,
          po.estimated_unit_cost,
          po.estimated_total_cost,
          po.status,
          po.remarks,
          compId,
          branchId,
          userId,
        ]);

        indexToDbIdMap.set(i, poInsertRes.rows[0].planned_order_id);
      }

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'MFG_MRP',
        actionType: 'RUN_MRP',
        entityTable: 'tbl_mfg_mrp_run_header',
        recordId: mrpRunId,
        newValue: {
          mrpRunNo,
          totalPlannedOrders: plannedOrders.length,
          totalPlannedBuyQty,
          totalPlannedMakeQty,
          totalEstimatedSpend,
          executionTimeMs,
        },
        compId,
        branchId,
      });

      return this.findRunDetail(mrpRunId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 1-Click Convert Planned BUY Orders into Purchase Requisition (PR)
  // --------------------------------------------------------------------------
  async convertPlannedOrdersToPr(
    dto: ConvertPlannedOrderDto,
    user: AuthenticatedUserContext,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;

    if (!dto.plannedOrderIds || dto.plannedOrderIds.length === 0) {
      throw new BadRequestException('At least one planned order ID must be provided');
    }

    // Verify orders: must exist, be BUY orders, and status SUGGESTED or CONFIRMED
    const ordersRes = await this.pool.query(
      `SELECT
         po.planned_order_id,
         po.planned_order_no,
         po.item_id,
         po.order_type,
         po.planned_order_qty::FLOAT AS planned_order_qty,
         po.uom_id,
         po.estimated_unit_cost::FLOAT AS estimated_unit_cost,
         po.estimated_total_cost::FLOAT AS estimated_total_cost,
         po.required_by_date::TEXT AS required_by_date,
         po.status,
         i.item_code,
         i.item_name,
         i.default_warehouse_id
       FROM tbl_mfg_mrp_planned_order po
       JOIN tbl_inv_item i ON po.item_id = i.item_id
       WHERE po.planned_order_id = ANY($1::BIGINT[]) AND po.comp_id = $2 AND po.is_active = TRUE;`,
      [dto.plannedOrderIds, compId],
    );

    if (ordersRes.rows.length !== dto.plannedOrderIds.length) {
      throw new NotFoundException('One or more planned orders not found or belong to another company');
    }

    const invalidType = ordersRes.rows.filter((o) => o.order_type !== 'BUY');
    if (invalidType.length > 0) {
      throw new BadRequestException(
        `Only 'BUY' orders can be converted to Purchase Requisitions. Invalid: ${invalidType.map((o) => o.planned_order_no).join(', ')}`,
      );
    }

    const alreadyConverted = ordersRes.rows.filter((o) => o.status === 'CONVERTED_TO_PR');
    if (alreadyConverted.length > 0) {
      throw new ConflictException(
        `Order(s) already converted to PR: ${alreadyConverted.map((o) => o.planned_order_no).join(', ')}`,
      );
    }

    // Resolve warehouse and department
    let warehouseId = dto.warehouseId;
    if (!warehouseId) {
      warehouseId = ordersRes.rows[0].default_warehouse_id;
    }
    if (!warehouseId) {
      const whRes = await this.pool.query(
        `SELECT warehouse_id FROM tbl_inv_warehouse WHERE comp_id = $1 AND is_active = TRUE LIMIT 1;`,
        [compId],
      );
      warehouseId = whRes.rows[0]?.warehouse_id || 1001;
    }

    let departmentId = dto.departmentId;
    if (!departmentId) {
      const deptRes = await this.pool.query(
        `SELECT dept_id FROM tbl_hr_department WHERE comp_id = $1 AND dept_category = 'SUPPLY_CHAIN' AND is_active = TRUE LIMIT 1;`,
        [compId],
      );
      departmentId = deptRes.rows[0]?.dept_id || 1004;
    }

    // Earliest required date among selected orders
    let requiredByDate = dto.requiredByDate;
    if (!requiredByDate) {
      const dates = ordersRes.rows.map((o) => o.required_by_date).sort();
      requiredByDate = dates[0] || new Date().toISOString().split('T')[0];
    }

    // Total Estimated Amount
    const totalEstimatedAmount = ordersRes.rows.reduce(
      (sum, o) => sum + Number(o.estimated_total_cost || 0),
      0,
    );

    // Next PR No e.g. PR-AHM-2627-0002
    const prCountRes = await this.pool.query(
      `SELECT COUNT(*)::INT AS count FROM tbl_pr_header WHERE comp_id = $1;`,
      [compId],
    );
    const nextPrSeq = Number(prCountRes.rows[0]?.count || 0) + 1;
    const branchRes = await this.pool.query(
      `SELECT b.branch_code, fy.fyear_code
       FROM tbl_org_branch b
       LEFT JOIN tbl_org_financial_year fy ON fy.comp_id = b.comp_id AND fy.is_current = TRUE
       WHERE b.branch_id = $1;`,
      [branchId],
    );
    const branchCode = branchRes.rows[0]?.branch_code || 'AHM';
    const fyearCode = (branchRes.rows[0]?.fyear_code || '2627').replace(/[^0-9]/g, '');
    const prNo = `PR-${branchCode}-${fyearCode}-${String(nextPrSeq).padStart(4, '0')}`;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Create PR Header
      const insertPrHeaderSql = `
        INSERT INTO tbl_pr_header (
          pr_no, pr_date, required_by_date, department_id, requester_user_id,
          warehouse_id, priority, pr_type, status, total_estimated_amount,
          purpose, is_active, comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, CURRENT_DATE, $2::DATE, $3, $4,
          $5, $6, 'RAW_MATERIAL', 'DRAFT', $7,
          $8, TRUE, $9, $10,
          (SELECT fyear_id FROM tbl_org_financial_year WHERE comp_id = $9 AND is_current = TRUE LIMIT 1),
          $4
        ) RETURNING pr_id, pr_no, pr_date, status, total_estimated_amount;
      `;

      const purpose =
        dto.purpose ||
        `Auto-generated PR from MRP Planned Orders: ${ordersRes.rows.map((o) => o.planned_order_no).join(', ')}`;

      const prHeaderRes = await client.query(insertPrHeaderSql, [
        prNo,
        requiredByDate,
        departmentId,
        userId,
        warehouseId,
        dto.priority || 'MEDIUM',
        totalEstimatedAmount,
        purpose,
        compId,
        branchId,
      ]);

      const createdPr = prHeaderRes.rows[0];
      const prId = createdPr.pr_id;

      // Insert PR Items
      for (const order of ordersRes.rows) {
        const insertPrItemSql = `
          INSERT INTO tbl_pr_item (
            pr_id, item_id, uom_id, required_qty, approved_qty, ordered_qty,
            estimated_rate, estimated_amount, remarks, is_active,
            comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, $2, $3, $4, 0.000, 0.000,
            $5, $6, $7, TRUE,
            $8, $9,
            (SELECT fyear_id FROM tbl_org_financial_year WHERE comp_id = $8 AND is_current = TRUE LIMIT 1),
            $10
          );
        `;

        await client.query(insertPrItemSql, [
          prId,
          order.item_id,
          order.uom_id,
          order.planned_order_qty,
          order.estimated_unit_cost,
          order.estimated_total_cost,
          `Generated from MRP Order ${order.planned_order_no}`,
          compId,
          branchId,
          userId,
        ]);

        // Update Planned Order Status
        await client.query(
          `UPDATE tbl_mfg_mrp_planned_order
           SET status = 'CONVERTED_TO_PR', converted_pr_id = $1, updated_by = $2, updated_date = CURRENT_TIMESTAMP
           WHERE planned_order_id = $3;`,
          [prId, userId, order.planned_order_id],
        );
      }

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'MFG_MRP',
        actionType: 'CONVERT',
        entityTable: 'tbl_pr_header',
        recordId: prId,
        newValue: {
          prNo,
          convertedOrderIds: dto.plannedOrderIds,
          itemCount: ordersRes.rows.length,
          totalEstimatedAmount,
        },
        compId,
        branchId,
      });

      return {
        prId,
        prNo,
        totalEstimatedAmount,
        convertedOrderCount: ordersRes.rows.length,
        message: `Successfully converted ${ordersRes.rows.length} planned order(s) into Purchase Requisition ${prNo}`,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Update Planned Order Status
  // --------------------------------------------------------------------------
  async updatePlannedOrderStatus(
    id: number,
    dto: UpdatePlannedOrderStatusDto,
    user: AuthenticatedUserContext,
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;

    const existRes = await this.pool.query(
      `SELECT planned_order_id, planned_order_no, status, order_type
       FROM tbl_mfg_mrp_planned_order
       WHERE planned_order_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [id, compId],
    );

    if (existRes.rows.length === 0) {
      throw new NotFoundException(`Planned Order #${id} not found`);
    }

    const current = existRes.rows[0];
    if (current.status === 'CONVERTED_TO_PR' || current.status === 'CONVERTED_TO_WO') {
      throw new BadRequestException(
        `Cannot change status of an order already converted (${current.status})`,
      );
    }

    const updateSql = `
      UPDATE tbl_mfg_mrp_planned_order
      SET status = $1,
          remarks = COALESCE($2, remarks),
          updated_by = $3,
          updated_date = CURRENT_TIMESTAMP
      WHERE planned_order_id = $4
      RETURNING planned_order_id, planned_order_no, status, remarks;
    `;

    const res = await this.pool.query(updateSql, [
      dto.status,
      dto.remarks || null,
      userId,
      id,
    ]);

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'MFG_MRP',
      actionType: 'RUN_MRP',
      entityTable: 'tbl_mfg_mrp_planned_order',
      recordId: id,
      oldValue: { status: current.status },
      newValue: { status: dto.status, remarks: dto.remarks },
      compId,
      branchId: user.branchId || 1001,
    });

    return res.rows[0];
  }

  // --------------------------------------------------------------------------
  // Delete MRP Run & Cascade Planned Orders
  // --------------------------------------------------------------------------
  async deleteRun(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const runRes = await this.pool.query(
      `SELECT mrp_run_id, mrp_run_no, status
       FROM tbl_mfg_mrp_run_header
       WHERE mrp_run_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [id, compId],
    );

    if (runRes.rows.length === 0) {
      throw new NotFoundException(`MRP Run #${id} not found`);
    }

    const run = runRes.rows[0];

    // Check if any planned order was already converted to PR
    const convertedRes = await this.pool.query(
      `SELECT COUNT(*)::INT AS converted_count
       FROM tbl_mfg_mrp_planned_order
       WHERE mrp_run_id = $1 AND status IN ('CONVERTED_TO_PR', 'CONVERTED_TO_WO') AND is_active = TRUE;`,
      [id],
    );

    if (Number(convertedRes.rows[0]?.converted_count || 0) > 0) {
      throw new BadRequestException(
        `Cannot delete MRP Run ${run.mrp_run_no} because some planned orders have already been converted to official PRs/WOs.`,
      );
    }

    // Cascade delete in transaction
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM tbl_mfg_mrp_planned_order WHERE mrp_run_id = $1;`,
        [id],
      );
      await client.query(
        `DELETE FROM tbl_mfg_mrp_run_header WHERE mrp_run_id = $1;`,
        [id],
      );
      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId: user.userId || 1001,
        username: user.username,
        screenCode: 'MFG_MRP',
        actionType: 'DELETE',
        entityTable: 'tbl_mfg_mrp_run_header',
        recordId: id,
        oldValue: { mrpRunNo: run.mrp_run_no },
        compId,
        branchId: user.branchId || 1001,
      });

      return {
        message: `MRP Run ${run.mrp_run_no} and its planned orders successfully deleted.`,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
