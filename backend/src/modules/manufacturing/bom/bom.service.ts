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
  ApproveBomDto,
  BomFilterParams,
  CloneBomDto,
  CreateBomDto,
  UpdateBomDto,
} from './bom.dto';

export interface BomTreeNode {
  level: number;
  bomId?: number;
  bomCode?: string;
  bomItemId?: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  uomCode: string;
  sourceType: string;
  quantityPerUnit: number;
  scrapFactorPercent: number;
  grossQuantity: number;
  cumulativeQuantity: number;
  unitCost: number;
  lineCost: number;
  operationSeq?: number;
  operationName?: string;
  isCritical?: boolean;
  children: BomTreeNode[];
}

@Injectable()
export class BomService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  // --------------------------------------------------------------------------
  // KPI Summary
  // --------------------------------------------------------------------------
  async getBomSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const sql = `
      SELECT
        COUNT(*)::INT AS total_boms,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END)::INT AS active_boms,
        COUNT(DISTINCT item_id)::INT AS distinct_assemblies,
        COALESCE(AVG(CASE WHEN status = 'ACTIVE' THEN net_unit_cost ELSE NULL END), 0)::FLOAT AS avg_unit_cost,
        (
          SELECT COUNT(DISTINCT h.bom_id)::INT
          FROM tbl_mfg_bom_header h
          JOIN tbl_mfg_bom_item i ON h.bom_id = i.bom_id
          WHERE h.comp_id = $1 AND h.is_active = TRUE AND i.child_bom_id IS NOT NULL
        ) AS multi_level_boms
      FROM tbl_mfg_bom_header
      WHERE comp_id = $1 AND is_active = TRUE
        AND ($2::BIGINT IS NULL OR branch_id = $2::BIGINT);
    `;

    const res = await this.pool.query(sql, [compId, branchId]);
    const r = res.rows[0] || {};
    return {
      totalBoms: Number(r.total_boms || 0),
      activeBoms: Number(r.active_boms || 0),
      distinctAssemblies: Number(r.distinct_assemblies || 0),
      avgUnitCost: Number(r.avg_unit_cost || 0),
      multiLevelBoms: Number(r.multi_level_boms || 0),
    };
  }

  // --------------------------------------------------------------------------
  // Document Number Generation (BOM-{ITEM_CODE}-V{VERSION})
  // --------------------------------------------------------------------------
  private async generateBomCode(
    itemId: number,
    versionNo: string,
    compId: number,
  ): Promise<string> {
    const itRes = await this.pool.query(
      `SELECT item_code FROM tbl_inv_item WHERE item_id = $1 AND comp_id = $2;`,
      [itemId, compId],
    );
    const itemCode = itRes.rows[0]?.item_code || `ITM${itemId}`;
    const cleanVer = (versionNo || '1.0').replace(/[^0-9.]/g, '');
    return `BOM-${itemCode}-V${cleanVer}`;
  }

  // --------------------------------------------------------------------------
  // Find All (Register Listing)
  // --------------------------------------------------------------------------
  async findAllBoms(filters: BomFilterParams, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const conditions: string[] = [
      `b.comp_id = $1`,
      `b.is_active = TRUE`,
      `($2::BIGINT IS NULL OR b.branch_id = $2::BIGINT)`,
    ];
    const params: any[] = [compId, branchId];
    let idx = 3;

    if (filters.status) {
      conditions.push(`b.status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters.bomType) {
      conditions.push(`b.bom_type = $${idx++}`);
      params.push(filters.bomType);
    }
    if (filters.itemId) {
      conditions.push(`b.item_id = $${idx++}`);
      params.push(filters.itemId);
    }
    if (filters.isDefault !== undefined) {
      conditions.push(`b.is_default = $${idx++}`);
      params.push(filters.isDefault);
    }
    if (filters.search) {
      conditions.push(
        `(b.bom_code ILIKE $${idx} OR b.bom_name ILIKE $${idx} OR it.item_name ILIKE $${idx} OR it.item_code ILIKE $${idx})`,
      );
      params.push(`%${filters.search}%`);
      idx++;
    }

    const sql = `
      SELECT
        b.bom_id,
        b.comp_id,
        b.branch_id,
        b.fyear_id,
        b.bom_code,
        b.bom_name,
        b.item_id,
        it.item_code,
        it.item_name,
        it.item_type,
        b.uom_id,
        u.uom_code,
        u.uom_name,
        b.output_qty::FLOAT AS output_qty,
        b.version_no,
        b.bom_type,
        b.status,
        b.is_default,
        b.effective_from,
        b.effective_to,
        b.routing_id,
        b.total_material_cost::FLOAT AS total_material_cost,
        b.total_labour_cost::FLOAT AS total_labour_cost,
        b.total_overhead_cost::FLOAT AS total_overhead_cost,
        b.total_byproduct_recovery::FLOAT AS total_byproduct_recovery,
        b.net_unit_cost::FLOAT AS net_unit_cost,
        b.approved_by,
        u_app.full_name AS approved_by_name,
        b.approved_date,
        b.approval_remarks,
        b.remarks,
        b.created_date,
        b.created_by,
        u_cr.full_name AS created_by_name,
        COUNT(DISTINCT i.bom_item_id)::INT AS component_count,
        COUNT(DISTINCT bp.bom_byproduct_id)::INT AS byproduct_count,
        BOOL_OR(i.child_bom_id IS NOT NULL) AS is_multi_level
      FROM tbl_mfg_bom_header b
      JOIN tbl_inv_item it ON b.item_id = it.item_id
      JOIN tbl_inv_uom u ON b.uom_id = u.uom_id
      LEFT JOIN tbl_sec_user u_app ON b.approved_by = u_app.user_id
      LEFT JOIN tbl_sec_user u_cr ON b.created_by = u_cr.user_id
      LEFT JOIN tbl_mfg_bom_item i ON b.bom_id = i.bom_id AND i.is_active = TRUE
      LEFT JOIN tbl_mfg_bom_byproduct bp ON b.bom_id = bp.bom_id AND bp.is_active = TRUE
      WHERE ${conditions.join(' AND ')}
      GROUP BY
        b.bom_id,
        it.item_code,
        it.item_name,
        it.item_type,
        u.uom_code,
        u.uom_name,
        u_app.full_name,
        u_cr.full_name
      ORDER BY b.bom_id DESC;
    `;

    const res = await this.pool.query(sql, params);
    return res.rows;
  }

  // --------------------------------------------------------------------------
  // Find One (Detail View with Line Items & By-Products)
  // --------------------------------------------------------------------------
  async findOneBom(bomId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const headSql = `
      SELECT
        b.bom_id,
        b.comp_id,
        b.branch_id,
        b.fyear_id,
        b.bom_code,
        b.bom_name,
        b.item_id,
        it.item_code,
        it.item_name,
        it.item_type,
        it.drawing_no,
        it.revision_no,
        b.uom_id,
        u.uom_code,
        u.uom_name,
        b.output_qty::FLOAT AS output_qty,
        b.version_no,
        b.bom_type,
        b.status,
        b.is_default,
        b.effective_from,
        b.effective_to,
        b.routing_id,
        b.total_material_cost::FLOAT AS total_material_cost,
        b.total_labour_cost::FLOAT AS total_labour_cost,
        b.total_overhead_cost::FLOAT AS total_overhead_cost,
        b.total_byproduct_recovery::FLOAT AS total_byproduct_recovery,
        b.net_unit_cost::FLOAT AS net_unit_cost,
        b.approved_by,
        u_app.full_name AS approved_by_name,
        b.approved_date,
        b.approval_remarks,
        b.remarks,
        b.created_date,
        b.created_by,
        u_cr.full_name AS created_by_name
      FROM tbl_mfg_bom_header b
      JOIN tbl_inv_item it ON b.item_id = it.item_id
      JOIN tbl_inv_uom u ON b.uom_id = u.uom_id
      LEFT JOIN tbl_sec_user u_app ON b.approved_by = u_app.user_id
      LEFT JOIN tbl_sec_user u_cr ON b.created_by = u_cr.user_id
      WHERE b.bom_id = $1 AND b.comp_id = $2 AND b.is_active = TRUE;
    `;

    const headRes = await this.pool.query(headSql, [bomId, compId]);
    if (headRes.rows.length === 0) {
      throw new NotFoundException(`BOM #${bomId} not found.`);
    }
    const bom = headRes.rows[0];

    // Fetch Components
    const itemSql = `
      SELECT
        i.bom_item_id,
        i.bom_id,
        i.item_id,
        it.item_code,
        it.item_name,
        it.item_type,
        COALESCE(i.item_description, it.item_name) AS item_description,
        i.uom_id,
        u.uom_code,
        u.uom_name,
        i.quantity::FLOAT AS quantity,
        i.scrap_factor_percent::FLOAT AS scrap_factor_percent,
        i.gross_quantity::FLOAT AS gross_quantity,
        i.child_bom_id,
        cb.bom_code AS child_bom_code,
        cb.bom_name AS child_bom_name,
        i.unit_cost::FLOAT AS unit_cost,
        i.line_cost::FLOAT AS line_cost,
        i.source_type,
        i.operation_seq,
        i.operation_name,
        i.is_critical,
        i.remarks
      FROM tbl_mfg_bom_item i
      JOIN tbl_inv_item it ON i.item_id = it.item_id
      JOIN tbl_inv_uom u ON i.uom_id = u.uom_id
      LEFT JOIN tbl_mfg_bom_header cb ON i.child_bom_id = cb.bom_id
      WHERE i.bom_id = $1 AND i.is_active = TRUE
      ORDER BY i.operation_seq ASC, i.bom_item_id ASC;
    `;
    const itemRes = await this.pool.query(itemSql, [bomId]);

    // Fetch By-Products & Scrap
    const byproductSql = `
      SELECT
        bp.bom_byproduct_id,
        bp.bom_id,
        bp.item_id,
        it.item_code,
        it.item_name,
        COALESCE(bp.item_description, it.item_name) AS item_description,
        bp.uom_id,
        u.uom_code,
        u.uom_name,
        bp.quantity::FLOAT AS quantity,
        bp.product_type,
        bp.cost_allocation_percent::FLOAT AS cost_allocation_percent,
        bp.estimated_recovery_rate::FLOAT AS estimated_recovery_rate,
        bp.estimated_recovery_value::FLOAT AS estimated_recovery_value,
        bp.remarks
      FROM tbl_mfg_bom_byproduct bp
      JOIN tbl_inv_item it ON bp.item_id = it.item_id
      JOIN tbl_inv_uom u ON bp.uom_id = u.uom_id
      WHERE bp.bom_id = $1 AND bp.is_active = TRUE
      ORDER BY bp.bom_byproduct_id ASC;
    `;
    const byproductRes = await this.pool.query(byproductSql, [bomId]);

    return {
      ...bom,
      items: itemRes.rows,
      byproducts: byproductRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // Create BOM
  // --------------------------------------------------------------------------
  async createBom(
    dto: CreateBomDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const versionNo = dto.versionNo ? dto.versionNo.trim() : '1.0';

    // Verify unique version for this item
    const verCheck = await this.pool.query(
      `SELECT bom_id, bom_code FROM tbl_mfg_bom_header
       WHERE comp_id = $1 AND item_id = $2 AND version_no = $3 AND is_active = TRUE;`,
      [compId, dto.itemId, versionNo],
    );
    if (verCheck.rows.length > 0) {
      throw new ConflictException(
        `Version ${versionNo} already exists for this item as BOM ${verCheck.rows[0].bom_code}.`,
      );
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one component line item is required.');
    }

    const bomCode =
      dto.bomCode || (await this.generateBomCode(dto.itemId, versionNo, compId));

    // Calculate Costs & Gross Quantities
    let totalMaterialCost = 0;
    const outputQty = Number(dto.outputQty || 1.0);

    const processedItems = dto.items.map((it) => {
      const netQty = Number(it.quantity || 0);
      const scrapPct = Number(it.scrapFactorPercent || 0);
      const grossQty = Math.round(netQty * (1 + scrapPct / 100) * 10000) / 10000;
      const unitCost = Number(it.unitCost || 0);
      const lineCost = Math.round(grossQty * unitCost * 100) / 100;
      totalMaterialCost += lineCost;

      return {
        ...it,
        quantity: netQty,
        scrapFactorPercent: scrapPct,
        grossQuantity: grossQty,
        unitCost,
        lineCost,
      };
    });

    let totalByproductRecovery = 0;
    const processedByproducts = (dto.byproducts || []).map((bp) => {
      const qty = Number(bp.quantity || 0);
      const rate = Number(bp.estimatedRecoveryRate || 0);
      const val = Math.round(qty * rate * 100) / 100;
      totalByproductRecovery += val;
      return {
        ...bp,
        quantity: qty,
        estimatedRecoveryRate: rate,
        estimatedRecoveryValue: val,
      };
    });

    const totalLabourCost = Number(dto.totalLabourCost || 0);
    const totalOverheadCost = Number(dto.totalOverheadCost || 0);
    const netTotal =
      totalMaterialCost +
      totalLabourCost +
      totalOverheadCost -
      totalByproductRecovery;
    const netUnitCost =
      outputQty > 0 ? Math.round((netTotal / outputQty) * 10000) / 10000 : 0;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // If isDefault = true, unset other defaults for this item
      if (dto.isDefault) {
        await client.query(
          `UPDATE tbl_mfg_bom_header SET is_default = FALSE WHERE comp_id = $1 AND item_id = $2;`,
          [compId, dto.itemId],
        );
      }

      const insertHeadSql = `
        INSERT INTO tbl_mfg_bom_header (
          comp_id, branch_id, fyear_id, bom_code, bom_name,
          item_id, uom_id, output_qty, version_no, bom_type,
          status, is_default, effective_from, effective_to,
          routing_id, total_material_cost, total_labour_cost,
          total_overhead_cost, total_byproduct_recovery, net_unit_cost,
          remarks, created_by, created_date
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17,
          $18, $19, $20,
          $21, $22, CURRENT_TIMESTAMP
        ) RETURNING bom_id;
      `;

      const headRes = await client.query(insertHeadSql, [
        compId,
        branchId,
        fyearId,
        bomCode,
        dto.bomName,
        dto.itemId,
        dto.uomId,
        outputQty,
        versionNo,
        dto.bomType || 'MANUFACTURING',
        dto.status || 'DRAFT',
        dto.isDefault !== undefined ? dto.isDefault : true,
        dto.effectiveFrom || new Date().toISOString().split('T')[0],
        dto.effectiveTo || null,
        dto.routingId || null,
        Math.round(totalMaterialCost * 100) / 100,
        totalLabourCost,
        totalOverheadCost,
        Math.round(totalByproductRecovery * 100) / 100,
        netUnitCost,
        dto.remarks || null,
        userId,
      ]);

      const newBomId = headRes.rows[0].bom_id;

      // Insert Components
      const insertItemSql = `
        INSERT INTO tbl_mfg_bom_item (
          bom_id, item_id, item_description, uom_id,
          quantity, scrap_factor_percent, gross_quantity,
          child_bom_id, unit_cost, line_cost, source_type,
          operation_seq, operation_name, is_critical, remarks,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13, $14, $15,
          $16, $17, $18, $19
        );
      `;

      for (const it of processedItems) {
        await client.query(insertItemSql, [
          newBomId,
          it.itemId,
          it.itemDescription || null,
          it.uomId,
          it.quantity,
          it.scrapFactorPercent,
          it.grossQuantity,
          it.childBomId || null,
          it.unitCost,
          it.lineCost,
          it.sourceType || 'PURCHASED',
          it.operationSeq || 10,
          it.operationName || 'Component Assembly',
          it.isCritical || false,
          it.remarks || null,
          compId,
          branchId,
          fyearId,
          userId,
        ]);
      }

      // Insert By-Products
      const insertByproductSql = `
        INSERT INTO tbl_mfg_bom_byproduct (
          bom_id, item_id, item_description, uom_id,
          quantity, product_type, cost_allocation_percent,
          estimated_recovery_rate, estimated_recovery_value, remarks,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10,
          $11, $12, $13, $14
        );
      `;

      for (const bp of processedByproducts) {
        await client.query(insertByproductSql, [
          newBomId,
          bp.itemId,
          bp.itemDescription || null,
          bp.uomId,
          bp.quantity,
          bp.productType || 'RECOVERABLE_SCRAP',
          bp.costAllocationPercent || 0,
          bp.estimatedRecoveryRate,
          bp.estimatedRecoveryValue,
          bp.remarks || null,
          compId,
          branchId,
          fyearId,
          userId,
        ]);
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'MFG_BOM',
        actionType: 'CREATE',
        entityTable: 'tbl_mfg_bom_header',
        recordId: newBomId,
        newValue: { bomCode, versionNo, netUnitCost },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findOneBom(newBomId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Update BOM
  // --------------------------------------------------------------------------
  async updateBom(
    bomId: number,
    dto: UpdateBomDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const currentRes = await this.pool.query(
      `SELECT * FROM tbl_mfg_bom_header WHERE bom_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [bomId, compId],
    );
    if (currentRes.rows.length === 0) {
      throw new NotFoundException(`BOM #${bomId} not found.`);
    }
    const current = currentRes.rows[0];

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      if (dto.isDefault) {
        await client.query(
          `UPDATE tbl_mfg_bom_header SET is_default = FALSE WHERE comp_id = $1 AND item_id = $2 AND bom_id != $3;`,
          [compId, current.item_id, bomId],
        );
      }

      let totalMaterialCost = Number(current.total_material_cost);
      let totalByproductRecovery = Number(current.total_byproduct_recovery);
      const outputQty = Number(dto.outputQty ?? current.output_qty);
      const totalLabourCost = Number(dto.totalLabourCost ?? current.total_labour_cost);
      const totalOverheadCost = Number(dto.totalOverheadCost ?? current.total_overhead_cost);

      // Recreate items if provided
      if (dto.items && dto.items.length > 0) {
        await client.query(`DELETE FROM tbl_mfg_bom_item WHERE bom_id = $1;`, [bomId]);
        totalMaterialCost = 0;

        const insertItemSql = `
          INSERT INTO tbl_mfg_bom_item (
            bom_id, item_id, item_description, uom_id,
            quantity, scrap_factor_percent, gross_quantity,
            child_bom_id, unit_cost, line_cost, source_type,
            operation_seq, operation_name, is_critical, remarks,
            comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7,
            $8, $9, $10, $11,
            $12, $13, $14, $15,
            $16, $17, $18, $19
          );
        `;

        for (const it of dto.items) {
          const netQty = Number(it.quantity || 0);
          const scrapPct = Number(it.scrapFactorPercent || 0);
          const grossQty = Math.round(netQty * (1 + scrapPct / 100) * 10000) / 10000;
          const unitCost = Number(it.unitCost || 0);
          const lineCost = Math.round(grossQty * unitCost * 100) / 100;
          totalMaterialCost += lineCost;

          await client.query(insertItemSql, [
            bomId,
            it.itemId,
            it.itemDescription || null,
            it.uomId,
            netQty,
            scrapPct,
            grossQty,
            it.childBomId || null,
            unitCost,
            lineCost,
            it.sourceType || 'PURCHASED',
            it.operationSeq || 10,
            it.operationName || 'Component Assembly',
            it.isCritical || false,
            it.remarks || null,
            compId,
            branchId,
            fyearId,
            userId,
          ]);
        }
      }

      // Recreate byproducts if provided
      if (dto.byproducts !== undefined) {
        await client.query(`DELETE FROM tbl_mfg_bom_byproduct WHERE bom_id = $1;`, [bomId]);
        totalByproductRecovery = 0;

        const insertByproductSql = `
          INSERT INTO tbl_mfg_bom_byproduct (
            bom_id, item_id, item_description, uom_id,
            quantity, product_type, cost_allocation_percent,
            estimated_recovery_rate, estimated_recovery_value, remarks,
            comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7,
            $8, $9, $10,
            $11, $12, $13, $14
          );
        `;

        for (const bp of dto.byproducts) {
          const qty = Number(bp.quantity || 0);
          const rate = Number(bp.estimatedRecoveryRate || 0);
          const val = Math.round(qty * rate * 100) / 100;
          totalByproductRecovery += val;

          await client.query(insertByproductSql, [
            bomId,
            bp.itemId,
            bp.itemDescription || null,
            bp.uomId,
            qty,
            bp.productType || 'RECOVERABLE_SCRAP',
            bp.costAllocationPercent || 0,
            rate,
            val,
            bp.remarks || null,
            compId,
            branchId,
            fyearId,
            userId,
          ]);
        }
      }

      const netTotal =
        totalMaterialCost +
        totalLabourCost +
        totalOverheadCost -
        totalByproductRecovery;
      const netUnitCost =
        outputQty > 0 ? Math.round((netTotal / outputQty) * 10000) / 10000 : 0;

      const updateHeadSql = `
        UPDATE tbl_mfg_bom_header SET
          bom_name = COALESCE($1, bom_name),
          output_qty = $2,
          version_no = COALESCE($3, version_no),
          bom_type = COALESCE($4, bom_type),
          status = COALESCE($5, status),
          is_default = COALESCE($6, is_default),
          effective_from = COALESCE($7, effective_from),
          effective_to = COALESCE($8, effective_to),
          routing_id = COALESCE($9, routing_id),
          total_material_cost = $10,
          total_labour_cost = $11,
          total_overhead_cost = $12,
          total_byproduct_recovery = $13,
          net_unit_cost = $14,
          remarks = COALESCE($15, remarks),
          updated_by = $16,
          updated_date = CURRENT_TIMESTAMP
        WHERE bom_id = $17 AND comp_id = $18;
      `;

      await client.query(updateHeadSql, [
        dto.bomName || null,
        outputQty,
        dto.versionNo || null,
        dto.bomType || null,
        dto.status || null,
        dto.isDefault ?? null,
        dto.effectiveFrom || null,
        dto.effectiveTo || null,
        dto.routingId || null,
        Math.round(totalMaterialCost * 100) / 100,
        totalLabourCost,
        totalOverheadCost,
        Math.round(totalByproductRecovery * 100) / 100,
        netUnitCost,
        dto.remarks || null,
        userId,
        bomId,
        compId,
      ]);

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'MFG_BOM',
        actionType: 'UPDATE',
        entityTable: 'tbl_mfg_bom_header',
        recordId: bomId,
        oldValue: current,
        newValue: dto,
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findOneBom(bomId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Approve & Release BOM (DRAFT/UNDER_REVIEW -> ACTIVE)
  // --------------------------------------------------------------------------
  async approveBom(
    bomId: number,
    dto: ApproveBomDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const res = await this.pool.query(
      `SELECT bom_id, bom_code, item_id, is_default, status FROM tbl_mfg_bom_header
       WHERE bom_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [bomId, compId],
    );
    if (res.rows.length === 0) {
      throw new NotFoundException(`BOM #${bomId} not found.`);
    }
    const current = res.rows[0];

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // If current is default or sole BOM, mark others obsolete or non-default
      if (current.is_default) {
        await client.query(
          `UPDATE tbl_mfg_bom_header SET is_default = FALSE WHERE comp_id = $1 AND item_id = $2 AND bom_id != $3;`,
          [compId, current.item_id, bomId],
        );
      }

      await client.query(
        `UPDATE tbl_mfg_bom_header SET
          status = 'ACTIVE',
          approved_by = $1,
          approved_date = CURRENT_TIMESTAMP,
          approval_remarks = $2,
          updated_by = $1,
          updated_date = CURRENT_TIMESTAMP
         WHERE bom_id = $3 AND comp_id = $4;`,
        [userId, dto.approvalRemarks || 'BOM Engineering Approved & Released to Production', bomId, compId],
      );

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'MFG_BOM',
        actionType: 'APPROVE',
        entityTable: 'tbl_mfg_bom_header',
        recordId: bomId,
        oldValue: { status: current.status },
        newValue: { status: 'ACTIVE', approvedBy: userId },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findOneBom(bomId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Clone / Copy BOM to New Version
  // --------------------------------------------------------------------------
  async cloneBom(
    bomId: number,
    dto: CloneBomDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const source = await this.findOneBom(bomId, user);
    const newVer = dto.newVersionNo.trim();

    // Verify version doesn't exist
    const verCheck = await this.pool.query(
      `SELECT bom_id, bom_code FROM tbl_mfg_bom_header
       WHERE comp_id = $1 AND item_id = $2 AND version_no = $3 AND is_active = TRUE;`,
      [compId, source.item_id, newVer],
    );
    if (verCheck.rows.length > 0) {
      throw new ConflictException(
        `BOM version ${newVer} already exists for this item as ${verCheck.rows[0].bom_code}.`,
      );
    }

    const newCode =
      dto.newBomCode || (await this.generateBomCode(source.item_id, newVer, compId));
    const newName =
      dto.newBomName || `${source.bom_name} (Rev ${newVer})`;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const insertHeadSql = `
        INSERT INTO tbl_mfg_bom_header (
          comp_id, branch_id, fyear_id, bom_code, bom_name,
          item_id, uom_id, output_qty, version_no, bom_type,
          status, is_default, effective_from, effective_to,
          routing_id, total_material_cost, total_labour_cost,
          total_overhead_cost, total_byproduct_recovery, net_unit_cost,
          remarks, created_by, created_date
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          'DRAFT', FALSE, CURRENT_DATE, NULL,
          $11, $12, $13,
          $14, $15, $16,
          $17, $18, CURRENT_TIMESTAMP
        ) RETURNING bom_id;
      `;

      const headRes = await client.query(insertHeadSql, [
        compId,
        branchId,
        fyearId,
        newCode,
        newName,
        source.item_id,
        source.uom_id,
        source.output_qty,
        newVer,
        source.bom_type,
        source.routing_id,
        source.total_material_cost,
        source.total_labour_cost,
        source.total_overhead_cost,
        source.total_byproduct_recovery,
        source.net_unit_cost,
        dto.remarks || `Cloned from ${source.bom_code} (v${source.version_no})`,
        userId,
      ]);

      const newBomId = headRes.rows[0].bom_id;

      // Duplicate Line Items
      if (source.items && source.items.length > 0) {
        const insertItemSql = `
          INSERT INTO tbl_mfg_bom_item (
            bom_id, item_id, item_description, uom_id,
            quantity, scrap_factor_percent, gross_quantity,
            child_bom_id, unit_cost, line_cost, source_type,
            operation_seq, operation_name, is_critical, remarks,
            comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7,
            $8, $9, $10, $11,
            $12, $13, $14, $15,
            $16, $17, $18, $19
          );
        `;

        for (const it of source.items) {
          await client.query(insertItemSql, [
            newBomId,
            it.item_id,
            it.item_description,
            it.uom_id,
            it.quantity,
            it.scrap_factor_percent,
            it.gross_quantity,
            it.child_bom_id,
            it.unit_cost,
            it.line_cost,
            it.source_type,
            it.operation_seq,
            it.operation_name,
            it.is_critical,
            it.remarks,
            compId,
            branchId,
            fyearId,
            userId,
          ]);
        }
      }

      // Duplicate Byproducts
      if (source.byproducts && source.byproducts.length > 0) {
        const insertByproductSql = `
          INSERT INTO tbl_mfg_bom_byproduct (
            bom_id, item_id, item_description, uom_id,
            quantity, product_type, cost_allocation_percent,
            estimated_recovery_rate, estimated_recovery_value, remarks,
            comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7,
            $8, $9, $10,
            $11, $12, $13, $14
          );
        `;

        for (const bp of source.byproducts) {
          await client.query(insertByproductSql, [
            newBomId,
            bp.item_id,
            bp.item_description,
            bp.uom_id,
            bp.quantity,
            bp.product_type,
            bp.cost_allocation_percent,
            bp.estimated_recovery_rate,
            bp.estimated_recovery_value,
            bp.remarks,
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
        screenCode: 'MFG_BOM',
        actionType: 'CLONE',
        entityTable: 'tbl_mfg_bom_header',
        recordId: newBomId,
        oldValue: { sourceBomId: bomId, sourceBomCode: source.bom_code },
        newValue: { clonedBomId: newBomId, newBomCode: newCode, versionNo: newVer },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findOneBom(newBomId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Explode Indented Multi-Level Tree Hierarchy
  // --------------------------------------------------------------------------
  async explodeBomTree(
    bomId: number,
    user: AuthenticatedUserContext,
  ): Promise<BomTreeNode> {
    const compId = user.compId || 1001;

    // Helper recursive function with cycle detection
    const buildSubTree = async (
      currentBomId: number,
      currentLevel: number,
      parentMultiplier: number,
      visitedBoms: Set<number>,
    ): Promise<BomTreeNode> => {
      if (visitedBoms.has(currentBomId)) {
        throw new BadRequestException(
          `Recursive loop detected in Bill of Materials! BOM #${currentBomId} references itself in the tree.`,
        );
      }
      visitedBoms.add(currentBomId);

      // Fetch head
      const hRes = await this.pool.query(
        `SELECT b.bom_id, b.bom_code, b.bom_name, b.item_id, it.item_code, it.item_name, it.item_type,
                b.uom_id, u.uom_code, b.output_qty::FLOAT AS output_qty, b.net_unit_cost::FLOAT AS net_unit_cost
         FROM tbl_mfg_bom_header b
         JOIN tbl_inv_item it ON b.item_id = it.item_id
         JOIN tbl_inv_uom u ON b.uom_id = u.uom_id
         WHERE b.bom_id = $1 AND b.comp_id = $2;`,
        [currentBomId, compId],
      );
      if (hRes.rows.length === 0) {
        throw new NotFoundException(`BOM #${currentBomId} not found.`);
      }
      const head = hRes.rows[0];

      // Fetch components
      const iRes = await this.pool.query(
        `SELECT i.bom_item_id, i.item_id, it.item_code, it.item_name, it.item_type,
                i.uom_id, u.uom_code, i.quantity::FLOAT AS quantity,
                i.scrap_factor_percent::FLOAT AS scrap_factor_percent,
                i.gross_quantity::FLOAT AS gross_quantity,
                i.child_bom_id, i.unit_cost::FLOAT AS unit_cost,
                i.line_cost::FLOAT AS line_cost, i.source_type,
                i.operation_seq, i.operation_name, i.is_critical
         FROM tbl_mfg_bom_item i
         JOIN tbl_inv_item it ON i.item_id = it.item_id
         JOIN tbl_inv_uom u ON i.uom_id = u.uom_id
         WHERE i.bom_id = $1 AND i.is_active = TRUE
         ORDER BY i.operation_seq ASC, i.bom_item_id ASC;`,
        [currentBomId],
      );

      const childrenNodes: BomTreeNode[] = [];

      for (const it of iRes.rows) {
        const itemQtyPerOutput = Number(it.gross_quantity) / Number(head.output_qty || 1);
        const cumQty = parentMultiplier * itemQtyPerOutput;

        if (it.child_bom_id) {
          // Recursive sub-assembly explosion!
          const subTree = await buildSubTree(
            it.child_bom_id,
            currentLevel + 1,
            cumQty,
            new Set(visitedBoms),
          );
          childrenNodes.push({
            ...subTree,
            bomItemId: it.bom_item_id,
            sourceType: it.source_type,
            quantityPerUnit: it.quantity,
            scrapFactorPercent: it.scrap_factor_percent,
            grossQuantity: it.gross_quantity,
            cumulativeQuantity: Math.round(cumQty * 10000) / 10000,
            operationSeq: it.operation_seq,
            operationName: it.operation_name,
            isCritical: it.is_critical,
          });
        } else {
          // Leaf raw material or purchased part
          childrenNodes.push({
            level: currentLevel + 1,
            bomItemId: it.bom_item_id,
            itemId: it.item_id,
            itemCode: it.item_code,
            itemName: it.item_name,
            itemType: it.item_type,
            uomCode: it.uom_code,
            sourceType: it.source_type,
            quantityPerUnit: it.quantity,
            scrapFactorPercent: it.scrap_factor_percent,
            grossQuantity: it.gross_quantity,
            cumulativeQuantity: Math.round(cumQty * 10000) / 10000,
            unitCost: it.unit_cost,
            lineCost: it.line_cost,
            operationSeq: it.operation_seq,
            operationName: it.operation_name,
            isCritical: it.is_critical,
            children: [],
          });
        }
      }

      return {
        level: currentLevel,
        bomId: head.bom_id,
        bomCode: head.bom_code,
        itemId: head.item_id,
        itemCode: head.item_code,
        itemName: head.item_name,
        itemType: head.item_type,
        uomCode: head.uom_code,
        sourceType: 'ASSEMBLY',
        quantityPerUnit: head.output_qty,
        scrapFactorPercent: 0,
        grossQuantity: head.output_qty,
        cumulativeQuantity: parentMultiplier,
        unitCost: head.net_unit_cost,
        lineCost: head.net_unit_cost * parentMultiplier,
        children: childrenNodes,
      };
    };

    return buildSubTree(bomId, 0, 1.0, new Set());
  }

  // --------------------------------------------------------------------------
  // Delete BOM (DRAFT or Non-Referenced only)
  // --------------------------------------------------------------------------
  async deleteBom(
    bomId: number,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const res = await this.pool.query(
      `SELECT bom_id, bom_code, status FROM tbl_mfg_bom_header
       WHERE bom_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [bomId, compId],
    );
    if (res.rows.length === 0) {
      throw new NotFoundException(`BOM #${bomId} not found.`);
    }
    const current = res.rows[0];

    // Check if this BOM is referenced as a child in any other active BOM item
    const childRefCheck = await this.pool.query(
      `SELECT h.bom_code, h.bom_name
       FROM tbl_mfg_bom_item i
       JOIN tbl_mfg_bom_header h ON i.bom_id = h.bom_id
       WHERE i.child_bom_id = $1 AND h.is_active = TRUE;`,
      [bomId],
    );
    if (childRefCheck.rows.length > 0) {
      const parentCodes = childRefCheck.rows.map((r) => r.bom_code).join(', ');
      throw new ConflictException(
        `Cannot delete BOM ${current.bom_code} because it is referenced as a child assembly in: ${parentCodes}.`,
      );
    }

    await this.dependencyCheckService.verifyCanDelete({
      entity: 'Bill of Materials',
      entityId: bomId,
      relations: [],
    });

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM tbl_mfg_bom_byproduct WHERE bom_id = $1;`, [bomId]);
      await client.query(`DELETE FROM tbl_mfg_bom_item WHERE bom_id = $1;`, [bomId]);
      await client.query(`DELETE FROM tbl_mfg_bom_header WHERE bom_id = $1;`, [bomId]);
      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'MFG_BOM',
        actionType: 'DELETE',
        entityTable: 'tbl_mfg_bom_header',
        recordId: bomId,
        oldValue: current,
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return {
        success: true,
        message: `BOM ${current.bom_code} deleted successfully.`,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Sourcing Lookups
  // --------------------------------------------------------------------------

  // Get Manufactured Assemblies & Sub-Assemblies
  async getManufacturedItems(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const sql = `
      SELECT
        it.item_id,
        it.item_code,
        it.item_name,
        it.item_type,
        it.base_uom_id,
        u.uom_code,
        u.uom_name,
        it.standard_cost::FLOAT AS standard_cost
      FROM tbl_inv_item it
      JOIN tbl_inv_uom u ON it.base_uom_id = u.uom_id
      WHERE it.comp_id = $1
        AND it.is_active = TRUE
        AND (it.is_bom_allowed = TRUE OR it.item_type IN ('FINISHED_GOODS', 'WIP_SEMI_FINISHED'))
      ORDER BY it.item_type DESC, it.item_name ASC;
    `;
    const res = await this.pool.query(sql, [compId]);
    return res.rows;
  }

  // Get All Component Items
  async getComponentItems(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const sql = `
      SELECT
        it.item_id,
        it.item_code,
        it.item_name,
        it.item_type,
        it.base_uom_id,
        u.uom_code,
        u.uom_name,
        COALESCE(it.purchase_rate, it.standard_cost, 0)::FLOAT AS standard_cost
      FROM tbl_inv_item it
      JOIN tbl_inv_uom u ON it.base_uom_id = u.uom_id
      WHERE it.comp_id = $1 AND it.is_active = TRUE
      ORDER BY it.item_name ASC;
    `;
    const res = await this.pool.query(sql, [compId]);
    return res.rows;
  }

  // Get Child BOMs available for sub-assembly linking
  async getChildBoms(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const sql = `
      SELECT
        b.bom_id,
        b.bom_code,
        b.bom_name,
        b.item_id,
        it.item_code,
        it.item_name,
        b.version_no,
        b.output_qty::FLOAT AS output_qty,
        b.net_unit_cost::FLOAT AS net_unit_cost
      FROM tbl_mfg_bom_header b
      JOIN tbl_inv_item it ON b.item_id = it.item_id
      WHERE b.comp_id = $1 AND b.is_active = TRUE AND b.status = 'ACTIVE'
      ORDER BY b.bom_code ASC;
    `;
    const res = await this.pool.query(sql, [compId]);
    return res.rows;
  }

  // Get UOMs
  async getUoms(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const sql = `
      SELECT uom_id, uom_code, uom_name
      FROM tbl_inv_uom
      WHERE comp_id = $1 AND is_active = TRUE
      ORDER BY uom_name ASC;
    `;
    const res = await this.pool.query(sql, [compId]);
    return res.rows;
  }
}
