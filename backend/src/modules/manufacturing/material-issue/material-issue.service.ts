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
  CreateMaterialIssueDto,
  MaterialIssueFilterParams,
  ReturnToStoreDto,
  SubmitMaterialIssueDto,
  UpdateMaterialIssueDto,
} from './material-issue.dto';

@Injectable()
export class MaterialIssueService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  // --------------------------------------------------------------------------
  // KPI Summary
  // --------------------------------------------------------------------------
  async getMaterialIssueSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const sql = `
      SELECT
        COUNT(*)::INT AS total_issues,
        COUNT(CASE WHEN status = 'POSTED' THEN 1 END)::INT AS posted_issues,
        COUNT(CASE WHEN status = 'DRAFT' THEN 1 END)::INT AS draft_issues,
        COALESCE(SUM(CASE WHEN status = 'POSTED' THEN total_cost ELSE 0 END), 0)::FLOAT AS total_material_value,
        (
          SELECT COUNT(*)::INT
          FROM tbl_mfg_wo_header
          WHERE comp_id = $1 AND is_active = TRUE AND status IN ('RELEASED', 'IN_PROGRESS')
            AND ($2::BIGINT IS NULL OR branch_id = $2::BIGINT)
        ) AS active_wip_orders,
        (
          SELECT COUNT(*)::INT
          FROM tbl_mfg_wo_header wo
          WHERE wo.comp_id = $1 AND wo.is_active = TRUE AND wo.status = 'RELEASED'
            AND ($2::BIGINT IS NULL OR wo.branch_id = $2::BIGINT)
            AND EXISTS (
              SELECT 1 FROM tbl_mfg_wo_bom_item bi
              WHERE bi.wo_id = wo.wo_id AND bi.is_active = TRUE AND (bi.required_qty - bi.issued_qty) > 0
            )
        ) AS pending_picking_orders
      FROM tbl_mfg_material_issue_header
      WHERE comp_id = $1 AND is_active = TRUE
        AND ($2::BIGINT IS NULL OR branch_id = $2::BIGINT);
    `;

    const res = await this.pool.query(sql, [compId, branchId]);
    const r = res.rows[0] || {};
    return {
      totalIssues: Number(r.total_issues || 0),
      postedIssues: Number(r.posted_issues || 0),
      draftIssues: Number(r.draft_issues || 0),
      totalMaterialValue: Math.round(Number(r.total_material_value || 0) * 100) / 100,
      activeWipOrders: Number(r.active_wip_orders || 0),
      pendingPickingOrders: Number(r.pending_picking_orders || 0),
    };
  }

  // --------------------------------------------------------------------------
  // Lookups
  // --------------------------------------------------------------------------
  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const [woRes, whRes, itemsRes, usersRes] = await Promise.all([
      this.pool.query(
        `SELECT
           wo.wo_id,
           wo.wo_no,
           wo.wo_date::TEXT AS wo_date,
           wo.item_id,
           i.item_code,
           i.item_name,
           wo.planned_qty::FLOAT AS planned_qty,
           wo.completed_qty::FLOAT AS completed_qty,
           wo.uom_id,
           u.uom_code,
           wo.target_warehouse_id,
           wh_t.warehouse_name AS target_warehouse_name,
           wo.wip_warehouse_id,
           COALESCE(wh_w.warehouse_name, 'Lineside Production Floor') AS wip_warehouse_name,
           wo.priority,
           wo.status,
           wo.batch_no
         FROM tbl_mfg_wo_header wo
         JOIN tbl_inv_item i ON wo.item_id = i.item_id
         JOIN tbl_inv_uom u ON wo.uom_id = u.uom_id
         JOIN tbl_inv_warehouse wh_t ON wo.target_warehouse_id = wh_t.warehouse_id
         LEFT JOIN tbl_inv_warehouse wh_w ON wo.wip_warehouse_id = wh_w.warehouse_id
         WHERE wo.comp_id = $1 AND wo.is_active = TRUE
           AND wo.status IN ('RELEASED', 'IN_PROGRESS')
           AND ($2::BIGINT IS NULL OR wo.branch_id = $2::BIGINT)
         ORDER BY wo.wo_id DESC;`,
        [compId, branchId],
      ),
      this.pool.query(
        `SELECT warehouse_id, warehouse_code, warehouse_name, warehouse_type
         FROM tbl_inv_warehouse
         WHERE comp_id = $1 AND is_active = TRUE
         ORDER BY warehouse_name ASC;`,
        [compId],
      ),
      this.pool.query(
        `SELECT
           i.item_id,
           i.item_code,
           i.item_name,
           i.item_type,
           i.base_uom_id,
           u.uom_code,
           COALESCE(i.standard_cost, 0)::FLOAT AS standard_cost,
           i.default_warehouse_id
         FROM tbl_inv_item i
         JOIN tbl_inv_uom u ON i.base_uom_id = u.uom_id
         WHERE i.comp_id = $1 AND i.is_active = TRUE
         ORDER BY i.item_name ASC;`,
        [compId],
      ),
      this.pool.query(
        `SELECT user_id, username, full_name, email
         FROM tbl_sec_user
         WHERE comp_id = $1 AND is_active = TRUE
         ORDER BY full_name ASC;`,
        [compId],
      ),
    ]);

    return {
      activeWorkOrders: woRes.rows,
      warehouses: whRes.rows,
      items: itemsRes.rows,
      users: usersRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // Get Work Order Frozen BOM Items (for Auto-Issue Pre-population)
  // --------------------------------------------------------------------------
  async getWoBomItems(woId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const sql = `
      SELECT
        bi.wo_bom_item_id,
        bi.wo_id,
        bi.item_id,
        i.item_code,
        i.item_name,
        i.item_type,
        bi.uom_id,
        u.uom_code,
        u.uom_name,
        bi.standard_qty_per_unit::FLOAT AS standard_qty_per_unit,
        bi.scrap_factor_percent::FLOAT AS scrap_factor_percent,
        bi.required_qty::FLOAT AS required_qty,
        bi.issued_qty::FLOAT AS issued_qty,
        bi.consumed_qty::FLOAT AS consumed_qty,
        GREATEST(0, bi.required_qty - bi.issued_qty)::FLOAT AS pending_issue_qty,
        bi.unit_cost::FLOAT AS unit_cost,
        bi.estimated_cost::FLOAT AS estimated_cost,
        bi.source_type,
        bi.operation_seq,
        bi.is_critical,
        (
          SELECT COALESCE(SUM(bs.available_qty), 0)::FLOAT
          FROM tbl_inv_bin_stock bs
          WHERE bs.item_id = bi.item_id AND bs.is_active = TRUE
        ) AS current_stock_qty
      FROM tbl_mfg_wo_bom_item bi
      JOIN tbl_mfg_wo_header wo ON bi.wo_id = wo.wo_id
      JOIN tbl_inv_item i ON bi.item_id = i.item_id
      JOIN tbl_inv_uom u ON bi.uom_id = u.uom_id
      WHERE bi.wo_id = $1 AND wo.comp_id = $2 AND bi.is_active = TRUE
      ORDER BY bi.operation_seq ASC, bi.wo_bom_item_id ASC;
    `;

    const res = await this.pool.query(sql, [woId, compId]);
    return res.rows;
  }

  // --------------------------------------------------------------------------
  // Auto Document Number Generation
  // --------------------------------------------------------------------------
  private async generateIssueNo(branchId: number, compId: number): Promise<string> {
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
      `SELECT COUNT(*)::INT AS count FROM tbl_mfg_material_issue_header WHERE comp_id = $1;`,
      [compId],
    );
    const nextSeq = Number(countRes.rows[0]?.count || 0) + 1;
    return `MI-${branchCode}-${fyearCode}-${String(nextSeq).padStart(4, '0')}`;
  }

  // --------------------------------------------------------------------------
  // Find All (Paginated & Filtered)
  // --------------------------------------------------------------------------
  async findAll(params: MaterialIssueFilterParams, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(params.limit) || 10));
    const offset = (page - 1) * limit;

    const conditions: string[] = ['mi.comp_id = $1', 'mi.is_active = TRUE'];
    const values: any[] = [compId];
    let idx = 2;

    if (params.search?.trim()) {
      conditions.push(
        `(mi.issue_no ILIKE $${idx} OR wo.wo_no ILIKE $${idx} OR fg.item_code ILIKE $${idx} OR fg.item_name ILIKE $${idx} OR mi.remarks ILIKE $${idx})`,
      );
      values.push(`%${params.search.trim()}%`);
      idx++;
    }

    if (params.status?.trim()) {
      conditions.push(`mi.status = $${idx}`);
      values.push(params.status.trim());
      idx++;
    }

    if (params.issueType?.trim()) {
      conditions.push(`mi.issue_type = $${idx}`);
      values.push(params.issueType.trim());
      idx++;
    }

    if (params.woId) {
      conditions.push(`mi.wo_id = $${idx}`);
      values.push(params.woId);
      idx++;
    }

    if (params.fromWarehouseId) {
      conditions.push(`mi.from_warehouse_id = $${idx}`);
      values.push(params.fromWarehouseId);
      idx++;
    }

    if (params.toWarehouseId) {
      conditions.push(`mi.to_warehouse_id = $${idx}`);
      values.push(params.toWarehouseId);
      idx++;
    }

    if (params.startDate) {
      conditions.push(`mi.issue_date >= $${idx}::DATE`);
      values.push(params.startDate);
      idx++;
    }

    if (params.endDate) {
      conditions.push(`mi.issue_date <= $${idx}::DATE`);
      values.push(params.endDate);
      idx++;
    }

    const whereClause = conditions.join(' AND ');

    const countSql = `
      SELECT COUNT(*)::INT AS total
      FROM tbl_mfg_material_issue_header mi
      JOIN tbl_mfg_wo_header wo ON mi.wo_id = wo.wo_id
      JOIN tbl_inv_item fg ON wo.item_id = fg.item_id
      WHERE ${whereClause};
    `;
    const countRes = await this.pool.query(countSql, values);
    const total = Number(countRes.rows[0]?.total || 0);

    const dataSql = `
      SELECT
        mi.issue_id,
        mi.issue_no,
        mi.issue_date::TEXT AS issue_date,
        mi.wo_id,
        wo.wo_no,
        wo.item_id AS wo_item_id,
        fg.item_code AS wo_item_code,
        fg.item_name AS wo_item_name,
        wo.planned_qty::FLOAT AS wo_planned_qty,
        u_wo.uom_code AS wo_uom_code,
        mi.issue_type,
        mi.from_warehouse_id,
        wh_f.warehouse_name AS from_warehouse_name,
        wh_f.warehouse_code AS from_warehouse_code,
        mi.to_warehouse_id,
        wh_t.warehouse_name AS to_warehouse_name,
        wh_t.warehouse_code AS to_warehouse_code,
        mi.status,
        mi.total_items,
        mi.total_quantity::FLOAT AS total_quantity,
        mi.total_cost::FLOAT AS total_cost,
        mi.issued_by,
        u_iss.full_name AS issued_by_name,
        mi.received_by,
        u_rec.full_name AS received_by_name,
        mi.remarks,
        mi.created_date,
        (SELECT COUNT(*)::INT FROM tbl_mfg_material_issue_item mii WHERE mii.issue_id = mi.issue_id AND mii.is_active = TRUE) AS line_item_count
      FROM tbl_mfg_material_issue_header mi
      JOIN tbl_mfg_wo_header wo ON mi.wo_id = wo.wo_id
      JOIN tbl_inv_item fg ON wo.item_id = fg.item_id
      JOIN tbl_inv_uom u_wo ON wo.uom_id = u_wo.uom_id
      JOIN tbl_inv_warehouse wh_f ON mi.from_warehouse_id = wh_f.warehouse_id
      LEFT JOIN tbl_inv_warehouse wh_t ON mi.to_warehouse_id = wh_t.warehouse_id
      LEFT JOIN tbl_sec_user u_iss ON mi.issued_by = u_iss.user_id
      LEFT JOIN tbl_sec_user u_rec ON mi.received_by = u_rec.user_id
      WHERE ${whereClause}
      ORDER BY mi.issue_id DESC
      LIMIT $${idx} OFFSET $${idx + 1};
    `;

    values.push(limit, offset);
    const dataRes = await this.pool.query(dataSql, values);

    return {
      data: dataRes.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // --------------------------------------------------------------------------
  // Find One (Detail View with Line Items)
  // --------------------------------------------------------------------------
  async findOne(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const headSql = `
      SELECT
        mi.issue_id,
        mi.issue_no,
        mi.issue_date::TEXT AS issue_date,
        mi.wo_id,
        wo.wo_no,
        wo.item_id AS wo_item_id,
        fg.item_code AS wo_item_code,
        fg.item_name AS wo_item_name,
        fg.item_type AS wo_item_type,
        wo.planned_qty::FLOAT AS wo_planned_qty,
        wo.completed_qty::FLOAT AS wo_completed_qty,
        u_wo.uom_code AS wo_uom_code,
        wo.status AS wo_status,
        wo.batch_no AS wo_batch_no,
        mi.issue_type,
        mi.from_warehouse_id,
        wh_f.warehouse_name AS from_warehouse_name,
        wh_f.warehouse_code AS from_warehouse_code,
        mi.to_warehouse_id,
        wh_t.warehouse_name AS to_warehouse_name,
        wh_t.warehouse_code AS to_warehouse_code,
        mi.status,
        mi.total_items,
        mi.total_quantity::FLOAT AS total_quantity,
        mi.total_cost::FLOAT AS total_cost,
        mi.issued_by,
        u_iss.full_name AS issued_by_name,
        mi.received_by,
        u_rec.full_name AS received_by_name,
        mi.remarks,
        mi.created_date,
        mi.created_by,
        u_cr.full_name AS created_by_name,
        mi.updated_date,
        u_up.full_name AS updated_by_name
      FROM tbl_mfg_material_issue_header mi
      JOIN tbl_mfg_wo_header wo ON mi.wo_id = wo.wo_id
      JOIN tbl_inv_item fg ON wo.item_id = fg.item_id
      JOIN tbl_inv_uom u_wo ON wo.uom_id = u_wo.uom_id
      JOIN tbl_inv_warehouse wh_f ON mi.from_warehouse_id = wh_f.warehouse_id
      LEFT JOIN tbl_inv_warehouse wh_t ON mi.to_warehouse_id = wh_t.warehouse_id
      LEFT JOIN tbl_sec_user u_iss ON mi.issued_by = u_iss.user_id
      LEFT JOIN tbl_sec_user u_rec ON mi.received_by = u_rec.user_id
      LEFT JOIN tbl_sec_user u_cr ON mi.created_by = u_cr.user_id
      LEFT JOIN tbl_sec_user u_up ON mi.updated_by = u_up.user_id
      WHERE mi.issue_id = $1 AND mi.comp_id = $2 AND mi.is_active = TRUE;
    `;

    const headRes = await this.pool.query(headSql, [id, compId]);
    if (headRes.rows.length === 0) {
      throw new NotFoundException(`Material Issue slip #${id} not found.`);
    }

    const header = headRes.rows[0];

    const itemsSql = `
      SELECT
        mii.issue_item_id,
        mii.issue_id,
        mii.wo_bom_item_id,
        mii.item_id,
        i.item_code,
        i.item_name,
        i.item_type,
        mii.uom_id,
        u.uom_code,
        u.uom_name,
        mii.required_qty::FLOAT AS required_qty,
        mii.previously_issued_qty::FLOAT AS previously_issued_qty,
        mii.issue_qty::FLOAT AS issue_qty,
        mii.unit_cost::FLOAT AS unit_cost,
        mii.total_cost::FLOAT AS total_cost,
        mii.batch_no,
        mii.heat_no,
        mii.bin_location,
        mii.remarks
      FROM tbl_mfg_material_issue_item mii
      JOIN tbl_inv_item i ON mii.item_id = i.item_id
      JOIN tbl_inv_uom u ON mii.uom_id = u.uom_id
      WHERE mii.issue_id = $1 AND mii.is_active = TRUE
      ORDER BY mii.issue_item_id ASC;
    `;

    const itemsRes = await this.pool.query(itemsSql, [id]);

    return {
      ...header,
      items: itemsRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // Create Material Issue Slip
  // --------------------------------------------------------------------------
  async create(dto: CreateMaterialIssueDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    if (!dto.woId || !dto.fromWarehouseId || !dto.items || dto.items.length === 0) {
      throw new BadRequestException('Work Order, Source Warehouse, and at least 1 issue item are required.');
    }

    // Verify WO exists
    const woRes = await this.pool.query(
      `SELECT wo_id, wo_no, status, target_warehouse_id, wip_warehouse_id
       FROM tbl_mfg_wo_header
       WHERE wo_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [dto.woId, compId],
    );
    if (woRes.rows.length === 0) {
      throw new NotFoundException(`Work Order #${dto.woId} not found.`);
    }
    const wo = woRes.rows[0];
    if (wo.status === 'CLOSED' || wo.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot issue material to Work Order #${wo.wo_no} in '${wo.status}' status.`);
    }

    const issueNo = dto.issueNo?.trim() || (await this.generateIssueNo(branchId, compId));
    const toWarehouseId = dto.toWarehouseId || wo.wip_warehouse_id || null;

    let totalQuantity = 0;
    let totalCost = 0;
    for (const item of dto.items) {
      const q = Math.max(0, Number(item.issueQty) || 0);
      const c = Math.max(0, Number(item.unitCost) || 0);
      totalQuantity += q;
      totalCost += q * c;
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const insertHeadSql = `
        INSERT INTO tbl_mfg_material_issue_header (
          issue_no, issue_date, wo_id, issue_type, from_warehouse_id, to_warehouse_id,
          status, total_items, total_quantity, total_cost, issued_by, received_by, remarks,
          is_active, comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, COALESCE($2::DATE, CURRENT_DATE), $3, $4, $5, $6,
          'DRAFT', $7, $8, $9, $10, $11, $12,
          TRUE, $13, $14, $15, $16
        ) RETURNING issue_id;
      `;

      const headRes = await client.query(insertHeadSql, [
        issueNo,
        dto.issueDate || null,
        dto.woId,
        dto.issueType || 'STANDARD_ISSUE',
        dto.fromWarehouseId,
        toWarehouseId,
        dto.items.length,
        totalQuantity,
        totalCost,
        dto.issuedBy || user.userId || 1001,
        dto.receivedBy || null,
        dto.remarks || null,
        compId,
        branchId,
        user.fyearId || null,
        user.userId || 1001,
      ]);

      const issueId = headRes.rows[0].issue_id;

      for (const item of dto.items) {
        const q = Math.max(0, Number(item.issueQty) || 0);
        const uCost = Math.max(0, Number(item.unitCost) || 0);
        const lineCost = q * uCost;

        await client.query(
          `INSERT INTO tbl_mfg_material_issue_item (
             issue_id, wo_bom_item_id, item_id, uom_id, required_qty, previously_issued_qty,
             issue_qty, unit_cost, total_cost, batch_no, heat_no, bin_location, remarks,
             is_active, comp_id, branch_id, fyear_id, created_by
           ) VALUES (
             $1, $2, $3, $4, $5, $6,
             $7, $8, $9, $10, $11, $12, $13,
             TRUE, $14, $15, $16, $17
           );`,
          [
            issueId,
            item.woBomItemId || null,
            item.itemId,
            item.uomId,
            item.requiredQty || 0,
            item.previouslyIssuedQty || 0,
            q,
            uCost,
            lineCost,
            item.batchNo || null,
            item.heatNo || null,
            item.binLocation || null,
            item.remarks || null,
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
        screenCode: 'MFG_MATERIAL_ISSUE',
        actionType: 'ADD',
        entityTable: 'tbl_mfg_material_issue_header',
        recordId: issueId,
        newValue: { issueNo, woId: dto.woId, totalQuantity, totalCost },
        compId,
        branchId,
      });

      return this.findOne(issueId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Update Draft Material Issue Slip
  // --------------------------------------------------------------------------
  async update(id: number, dto: UpdateMaterialIssueDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const currentRes = await this.pool.query(
      `SELECT issue_id, issue_no, status, wo_id FROM tbl_mfg_material_issue_header WHERE issue_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [id, compId],
    );
    if (currentRes.rows.length === 0) {
      throw new NotFoundException(`Material Issue slip #${id} not found.`);
    }
    const current = currentRes.rows[0];
    if (current.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot edit Material Issue slip in '${current.status}' status. Only DRAFT slips can be modified.`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      if (dto.items && dto.items.length > 0) {
        let totalQuantity = 0;
        let totalCost = 0;
        for (const item of dto.items) {
          const q = Math.max(0, Number(item.issueQty) || 0);
          const c = Math.max(0, Number(item.unitCost) || 0);
          totalQuantity += q;
          totalCost += q * c;
        }

        await client.query(
          `UPDATE tbl_mfg_material_issue_header
           SET from_warehouse_id = COALESCE($1, from_warehouse_id),
               to_warehouse_id = COALESCE($2, to_warehouse_id),
               issue_date = COALESCE($3::DATE, issue_date),
               issued_by = COALESCE($4, issued_by),
               received_by = COALESCE($5, received_by),
               remarks = COALESCE($6, remarks),
               total_items = $7,
               total_quantity = $8,
               total_cost = $9,
               updated_by = $10,
               updated_date = CURRENT_TIMESTAMP
           WHERE issue_id = $11;`,
          [
            dto.fromWarehouseId || null,
            dto.toWarehouseId || null,
            dto.issueDate || null,
            dto.issuedBy || null,
            dto.receivedBy || null,
            dto.remarks || null,
            dto.items.length,
            totalQuantity,
            totalCost,
            user.userId || 1001,
            id,
          ],
        );

        await client.query(`DELETE FROM tbl_mfg_material_issue_item WHERE issue_id = $1;`, [id]);

        for (const item of dto.items) {
          const q = Math.max(0, Number(item.issueQty) || 0);
          const uCost = Math.max(0, Number(item.unitCost) || 0);
          const lineCost = q * uCost;

          await client.query(
            `INSERT INTO tbl_mfg_material_issue_item (
               issue_id, wo_bom_item_id, item_id, uom_id, required_qty, previously_issued_qty,
               issue_qty, unit_cost, total_cost, batch_no, heat_no, bin_location, remarks,
               is_active, comp_id, branch_id, fyear_id, created_by
             ) VALUES (
               $1, $2, $3, $4, $5, $6,
               $7, $8, $9, $10, $11, $12, $13,
               TRUE, $14, $15, $16, $17
             );`,
            [
              id,
              item.woBomItemId || null,
              item.itemId,
              item.uomId,
              item.requiredQty || 0,
              item.previouslyIssuedQty || 0,
              q,
              uCost,
              lineCost,
              item.batchNo || null,
              item.heatNo || null,
              item.binLocation || null,
              item.remarks || null,
              compId,
              branchId,
              user.fyearId || null,
              user.userId || 1001,
            ],
          );
        }
      } else {
        await client.query(
          `UPDATE tbl_mfg_material_issue_header
           SET from_warehouse_id = COALESCE($1, from_warehouse_id),
               to_warehouse_id = COALESCE($2, to_warehouse_id),
               issue_date = COALESCE($3::DATE, issue_date),
               issued_by = COALESCE($4, issued_by),
               received_by = COALESCE($5, received_by),
               remarks = COALESCE($6, remarks),
               updated_by = $7,
               updated_date = CURRENT_TIMESTAMP
           WHERE issue_id = $8;`,
          [
            dto.fromWarehouseId || null,
            dto.toWarehouseId || null,
            dto.issueDate || null,
            dto.issuedBy || null,
            dto.receivedBy || null,
            dto.remarks || null,
            user.userId || 1001,
            id,
          ],
        );
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId: user.userId || 1001,
        username: user.username,
        screenCode: 'MFG_MATERIAL_ISSUE',
        actionType: 'EDIT',
        entityTable: 'tbl_mfg_material_issue_header',
        recordId: id,
        newValue: dto,
        oldValue: { status: current.status },
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
  // Delete Draft Material Issue
  // --------------------------------------------------------------------------
  async delete(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const existRes = await this.pool.query(
      `SELECT issue_id, issue_no, status FROM tbl_mfg_material_issue_header WHERE issue_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [id, compId],
    );
    if (existRes.rows.length === 0) {
      throw new NotFoundException(`Material Issue slip #${id} not found.`);
    }
    const current = existRes.rows[0];
    if (current.status !== 'DRAFT' && current.status !== 'CANCELLED') {
      throw new BadRequestException(`Cannot delete Material Issue slip in '${current.status}' status. Only DRAFT or CANCELLED slips can be deleted.`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM tbl_mfg_material_issue_item WHERE issue_id = $1;`, [id]);
      await client.query(`DELETE FROM tbl_mfg_material_issue_header WHERE issue_id = $1;`, [id]);
      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId: user.userId || 1001,
        username: user.username,
        screenCode: 'MFG_MATERIAL_ISSUE',
        actionType: 'DELETE',
        entityTable: 'tbl_mfg_material_issue_header',
        recordId: id,
        oldValue: { issueNo: current.issue_no },
        compId,
        branchId,
      });

      return { message: `Material Issue slip ${current.issue_no} deleted successfully.` };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Submit & Post Material Issue (Updates WO BOM Issued Qty, Sets WO In-Progress)
  // --------------------------------------------------------------------------
  async submitAndPost(id: number, dto: SubmitMaterialIssueDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const existRes = await this.pool.query(
      `SELECT
         mi.issue_id,
         mi.issue_no,
         mi.wo_id,
         mi.status,
         mi.from_warehouse_id,
         mi.to_warehouse_id,
         mi.total_cost::FLOAT AS total_cost,
         wo.wo_no,
         wo.status AS wo_status
       FROM tbl_mfg_material_issue_header mi
       JOIN tbl_mfg_wo_header wo ON mi.wo_id = wo.wo_id
       WHERE mi.issue_id = $1 AND mi.comp_id = $2 AND mi.is_active = TRUE;`,
      [id, compId],
    );

    if (existRes.rows.length === 0) {
      throw new NotFoundException(`Material Issue slip #${id} not found.`);
    }

    const mi = existRes.rows[0];
    if (mi.status === 'POSTED') {
      throw new BadRequestException(`Material Issue slip #${mi.issue_no} is already POSTED.`);
    }

    const itemsRes = await this.pool.query(
      `SELECT
         issue_item_id, wo_bom_item_id, item_id, uom_id,
         issue_qty::FLOAT AS issue_qty, unit_cost::FLOAT AS unit_cost, total_cost::FLOAT AS total_cost,
         batch_no, heat_no, bin_location
       FROM tbl_mfg_material_issue_item
       WHERE issue_id = $1 AND is_active = TRUE;`,
      [id],
    );

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Update issue header to POSTED
      await client.query(
        `UPDATE tbl_mfg_material_issue_header
         SET status = 'POSTED',
             issued_by = COALESCE($1, issued_by),
             remarks = COALESCE($2, remarks),
             updated_by = $3,
             updated_date = CURRENT_TIMESTAMP
         WHERE issue_id = $4;`,
        [user.userId || 1001, dto.remarks || null, user.userId || 1001, id],
      );

      // 2. Update WO BOM Items issued_qty
      for (const item of itemsRes.rows) {
        if (item.wo_bom_item_id) {
          await client.query(
            `UPDATE tbl_mfg_wo_bom_item
             SET issued_qty = issued_qty + $1,
                 actual_cost = actual_cost + $2,
                 updated_by = $3,
                 updated_date = CURRENT_TIMESTAMP
             WHERE wo_bom_item_id = $4;`,
            [item.issue_qty, item.total_cost, user.userId || 1001, item.wo_bom_item_id],
          );
        } else {
          // If no wo_bom_item_id directly matching, try matching by wo_id and item_id
          await client.query(
            `UPDATE tbl_mfg_wo_bom_item
             SET issued_qty = issued_qty + $1,
                 actual_cost = actual_cost + $2,
                 updated_by = $3,
                 updated_date = CURRENT_TIMESTAMP
             WHERE wo_id = $4 AND item_id = $5;`,
            [item.issue_qty, item.total_cost, user.userId || 1001, mi.wo_id, item.item_id],
          );
        }

        // 3. Post to stock ledger if inventory ledger exists
        await client.query(
          `INSERT INTO tbl_inv_stock_ledger (
             comp_id, branch_id, fyear_id, transaction_date, transaction_type,
             reference_doc_type, reference_doc_id, reference_doc_no,
             warehouse_id, item_id, uom_id, batch_no, heat_no,
             qty_in, qty_out, unit_cost, total_cost, closing_balance, remarks,
             is_active, created_by
           ) VALUES (
             $1, $2, $3, CURRENT_TIMESTAMP, 'PRODUCTION_ISSUE',
             'WORK_ORDER', $4, $5,
             $6, $7, $8, $9, $10,
             0.000, $11, $12, $13, 0.000, $14,
             TRUE, $15
           );`,
          [
            compId,
            branchId,
            user.fyearId || null,
            mi.wo_id,
            mi.issue_no,
            mi.from_warehouse_id,
            item.item_id,
            item.uom_id,
            item.batch_no || null,
            item.heat_no || null,
            item.issue_qty,
            item.unit_cost,
            item.total_cost,
            `Issued for Work Order ${mi.wo_no}`,
            user.userId || 1001,
          ],
        );
      }

      // 4. Update Work Order actual material cost & state transition
      const newStatus = mi.wo_status === 'RELEASED' ? 'IN_PROGRESS' : mi.wo_status;
      const actualStartDateSql = mi.wo_status === 'RELEASED' ? ', actual_start_date = CURRENT_TIMESTAMP' : '';

      await client.query(
        `UPDATE tbl_mfg_wo_header
         SET actual_material_cost = actual_material_cost + $1,
             actual_total_cost = actual_total_cost + $1,
             status = $2
             ${actualStartDateSql},
             updated_by = $3,
             updated_date = CURRENT_TIMESTAMP
         WHERE wo_id = $4;`,
        [mi.total_cost, newStatus, user.userId || 1001, mi.wo_id],
      );

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId: user.userId || 1001,
        username: user.username,
        screenCode: 'MFG_MATERIAL_ISSUE',
        actionType: 'SUBMIT',
        entityTable: 'tbl_mfg_material_issue_header',
        recordId: id,
        newValue: { status: 'POSTED', woStatusUpdated: newStatus },
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
  // Return Unconsumed Material to Stores
  // --------------------------------------------------------------------------
  async returnToStore(dto: ReturnToStoreDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    if (!dto.woId || !dto.items || dto.items.length === 0) {
      throw new BadRequestException('Work Order and at least one return line item are required.');
    }

    const issueNo = await this.generateIssueNo(branchId, compId);

    let totalQuantity = 0;
    let totalCost = 0;
    for (const item of dto.items) {
      const q = Math.max(0, Number(item.returnQty) || 0);
      const c = Math.max(0, Number(item.unitCost) || 0);
      totalQuantity += q;
      totalCost += q * c;
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const headSql = `
        INSERT INTO tbl_mfg_material_issue_header (
          issue_no, issue_date, wo_id, issue_type, from_warehouse_id, to_warehouse_id,
          status, total_items, total_quantity, total_cost, issued_by, received_by, remarks,
          is_active, comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, CURRENT_DATE, $2, 'RETURN_TO_STORE', $3, $4,
          'POSTED', $5, $6, $7, $8, $8, $9,
          TRUE, $10, $11, $12, $13
        ) RETURNING issue_id;
      `;

      const headRes = await client.query(headSql, [
        issueNo,
        dto.woId,
        dto.fromWarehouseId,
        dto.toWarehouseId,
        dto.items.length,
        totalQuantity,
        totalCost,
        user.userId || 1001,
        dto.remarks || 'Returned unconsumed materials to stores',
        compId,
        branchId,
        user.fyearId || null,
        user.userId || 1001,
      ]);

      const issueId = headRes.rows[0].issue_id;

      for (const item of dto.items) {
        const q = Math.max(0, Number(item.returnQty) || 0);
        const uCost = Math.max(0, Number(item.unitCost) || 0);
        const lineCost = q * uCost;

        await client.query(
          `INSERT INTO tbl_mfg_material_issue_item (
             issue_id, wo_bom_item_id, item_id, uom_id, required_qty, previously_issued_qty,
             issue_qty, unit_cost, total_cost, batch_no, bin_location, remarks,
             is_active, comp_id, branch_id, fyear_id, created_by
           ) VALUES (
             $1, $2, $3, $4, 0.000, 0.000,
             $5, $6, $7, $8, $9, $10,
             TRUE, $11, $12, $13, $14
           );`,
          [
            issueId,
            item.woBomItemId || null,
            item.itemId,
            item.uomId,
            q,
            uCost,
            lineCost,
            item.batchNo || null,
            item.binLocation || null,
            item.remarks || null,
            compId,
            branchId,
            user.fyearId || null,
            user.userId || 1001,
          ],
        );

        // Deduct from WO BOM issued_qty
        if (item.woBomItemId) {
          await client.query(
            `UPDATE tbl_mfg_wo_bom_item
             SET issued_qty = GREATEST(0, issued_qty - $1),
                 actual_cost = GREATEST(0, actual_cost - $2),
                 updated_by = $3,
                 updated_date = CURRENT_TIMESTAMP
             WHERE wo_bom_item_id = $4;`,
            [q, lineCost, user.userId || 1001, item.woBomItemId],
          );
        }

        // Post stock return credit to stock ledger
        await client.query(
          `INSERT INTO tbl_inv_stock_ledger (
             comp_id, branch_id, fyear_id, transaction_date, transaction_type,
             reference_doc_type, reference_doc_id, reference_doc_no,
             warehouse_id, item_id, uom_id, batch_no,
             qty_in, qty_out, unit_cost, total_cost, closing_balance, remarks,
             is_active, created_by
           ) VALUES (
             $1, $2, $3, CURRENT_TIMESTAMP, 'INTERNAL_TRANSFER',
             'WORK_ORDER', $4, $5,
             $6, $7, $8, $9,
             $10, 0.000, $11, $12, 0.000, $13,
             TRUE, $14
           );`,
          [
            compId,
            branchId,
            user.fyearId || null,
            dto.woId,
            issueNo,
            dto.toWarehouseId,
            item.itemId,
            item.uomId,
            item.batchNo || null,
            q,
            uCost,
            lineCost,
            `Returned unconsumed material from WO to stores`,
            user.userId || 1001,
          ],
        );
      }

      // Deduct from WO actual material cost
      await client.query(
        `UPDATE tbl_mfg_wo_header
         SET actual_material_cost = GREATEST(0, actual_material_cost - $1),
             actual_total_cost = GREATEST(0, actual_total_cost - $1),
             updated_by = $2,
             updated_date = CURRENT_TIMESTAMP
         WHERE wo_id = $3;`,
        [totalCost, user.userId || 1001, dto.woId],
      );

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId: user.userId || 1001,
        username: user.username,
        screenCode: 'MFG_MATERIAL_ISSUE',
        actionType: 'SUBMIT',
        entityTable: 'tbl_mfg_material_issue_header',
        recordId: issueId,
        newValue: { issueNo, issueType: 'RETURN_TO_STORE', totalCost },
        compId,
        branchId,
      });

      return this.findOne(issueId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
