import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../../database/database.module';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { DependencyCheckService } from '../../../common/services/dependency-check.service';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import { CreateItemDto, ItemFilterDto, UpdateItemDto } from './item.dto';

export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

@Injectable()
export class ItemService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  // ==========================================================================
  // KPI / SUMMARY METRICS
  // ==========================================================================

  async getItemSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const { rows } = await this.pool.query(
      `
      SELECT
        COUNT(*)::int AS "totalItems",
        COUNT(CASE WHEN is_active = true AND item_type = 'FINISHED_GOODS' THEN 1 END)::int AS "activeFinishedGoods",
        COUNT(CASE WHEN is_active = true AND item_type = 'RAW_MATERIAL' THEN 1 END)::int AS "rawMaterialsCount",
        COUNT(CASE WHEN is_active = true AND item_type = 'WIP_SEMI_FINISHED' THEN 1 END)::int AS "wipItemsCount",
        COUNT(CASE WHEN is_active = true AND (is_batch_managed = true OR is_qc_inspection_required = true) THEN 1 END)::int AS "batchQcCount"
      FROM tbl_inv_item
      WHERE comp_id = $1
      `,
      [compId],
    );

    const r = rows[0] || {};
    return {
      totalItems: Number(r.totalItems) || 0,
      activeFinishedGoods: Number(r.activeFinishedGoods) || 0,
      rawMaterialsCount: Number(r.rawMaterialsCount) || 0,
      wipItemsCount: Number(r.wipItemsCount) || 0,
      batchQcCount: Number(r.batchQcCount) || 0,
    };
  }

  // ==========================================================================
  // QUERY / RETRIEVAL
  // ==========================================================================

  async findAllItems(filters: ItemFilterDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const conditions: string[] = ['i.comp_id = $1'];
    const params: unknown[] = [compId];

    if (filters.categoryId) {
      params.push(filters.categoryId);
      conditions.push(`i.category_id = $${params.length}`);
    }

    if (filters.itemType) {
      params.push(filters.itemType);
      conditions.push(`i.item_type = $${params.length}`);
    }

    if (filters.isActive !== undefined) {
      params.push(filters.isActive);
      conditions.push(`i.is_active = $${params.length}`);
    }

    if (filters.warehouseId) {
      params.push(filters.warehouseId);
      conditions.push(`i.default_warehouse_id = $${params.length}`);
    }

    if (filters.search && filters.search.trim()) {
      params.push(`%${filters.search.trim()}%`);
      const pIdx = params.length;
      conditions.push(
        `(i.item_code ILIKE $${pIdx} OR i.item_name ILIKE $${pIdx} OR i.drawing_no ILIKE $${pIdx} OR i.hsn_sac_code ILIKE $${pIdx})`,
      );
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `
      SELECT
        i.item_id                     AS "itemId",
        i.item_code                   AS "itemCode",
        i.item_name                   AS "itemName",
        i.category_id                 AS "categoryId",
        c.category_code               AS "categoryCode",
        c.category_name               AS "categoryName",
        c.hierarchy_path              AS "categoryHierarchyPath",
        i.item_type                   AS "itemType",
        i.description                 AS "description",
        i.base_uom_id                 AS "baseUomId",
        bu.uom_code                   AS "baseUomCode",
        bu.uom_name                   AS "baseUomName",
        i.purchase_uom_id             AS "purchaseUomId",
        pu.uom_code                   AS "purchaseUomCode",
        pu.uom_name                   AS "purchaseUomName",
        i.sales_uom_id                AS "salesUomId",
        su.uom_code                   AS "salesUomCode",
        su.uom_name                   AS "salesUomName",
        i.hsn_sac_code                AS "hsnSacCode",
        i.tax_rate                    AS "taxRate",
        i.standard_cost               AS "standardCost",
        i.purchase_rate               AS "purchaseRate",
        i.sales_rate                  AS "salesRate",
        i.min_stock_level             AS "minStockLevel",
        i.max_stock_level             AS "maxStockLevel",
        i.reorder_point               AS "reorderPoint",
        i.safety_stock                AS "safetyStock",
        i.lead_time_days              AS "leadTimeDays",
        i.valuation_method            AS "valuationMethod",
        i.is_batch_managed            AS "isBatchManaged",
        i.is_serial_managed           AS "isSerialManaged",
        i.is_qc_inspection_required   AS "isQcInspectionRequired",
        i.shelf_life_days             AS "shelfLifeDays",
        i.default_warehouse_id        AS "defaultWarehouseId",
        w.warehouse_code              AS "defaultWarehouseCode",
        w.warehouse_name              AS "defaultWarehouseName",
        i.default_bin_id              AS "defaultBinId",
        b.bin_code                    AS "defaultBinCode",
        b.bin_name                    AS "defaultBinName",
        i.drawing_no                  AS "drawingNo",
        i.revision_no                 AS "revisionNo",
        i.weight_per_unit_kg          AS "weightPerUnitKg",
        i.is_bom_allowed              AS "isBomAllowed",
        i.yield_percentage            AS "yieldPercentage",
        i.inspection_lead_time_days   AS "inspectionLeadTimeDays",
        i.is_active                   AS "isActive",
        i.comp_id                     AS "compId",
        i.branch_id                   AS "branchId",
        i.created_date                AS "createdDate",
        i.updated_date                AS "updatedDate"
      FROM tbl_inv_item i
      JOIN tbl_inv_item_category c ON c.category_id = i.category_id
      JOIN tbl_inv_uom bu ON bu.uom_id = i.base_uom_id
      JOIN tbl_inv_uom pu ON pu.uom_id = i.purchase_uom_id
      JOIN tbl_inv_uom su ON su.uom_id = i.sales_uom_id
      LEFT JOIN tbl_inv_warehouse w ON w.warehouse_id = i.default_warehouse_id
      LEFT JOIN tbl_inv_storage_bin b ON b.bin_id = i.default_bin_id
      ${whereSql}
      ORDER BY i.item_type ASC, i.item_code ASC
      `,
      params,
    );

    return rows.map((r) => this.mapItemRow(r));
  }

  async findItemById(itemId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const { rows } = await this.pool.query(
      `
      SELECT
        i.item_id                     AS "itemId",
        i.item_code                   AS "itemCode",
        i.item_name                   AS "itemName",
        i.category_id                 AS "categoryId",
        c.category_code               AS "categoryCode",
        c.category_name               AS "categoryName",
        c.hierarchy_path              AS "categoryHierarchyPath",
        i.item_type                   AS "itemType",
        i.description                 AS "description",
        i.base_uom_id                 AS "baseUomId",
        bu.uom_code                   AS "baseUomCode",
        bu.uom_name                   AS "baseUomName",
        i.purchase_uom_id             AS "purchaseUomId",
        pu.uom_code                   AS "purchaseUomCode",
        pu.uom_name                   AS "purchaseUomName",
        i.sales_uom_id                AS "salesUomId",
        su.uom_code                   AS "salesUomCode",
        su.uom_name                   AS "salesUomName",
        i.hsn_sac_code                AS "hsnSacCode",
        i.tax_rate                    AS "taxRate",
        i.standard_cost               AS "standardCost",
        i.purchase_rate               AS "purchaseRate",
        i.sales_rate                  AS "salesRate",
        i.min_stock_level             AS "minStockLevel",
        i.max_stock_level             AS "maxStockLevel",
        i.reorder_point               AS "reorderPoint",
        i.safety_stock                AS "safetyStock",
        i.lead_time_days              AS "leadTimeDays",
        i.valuation_method            AS "valuationMethod",
        i.is_batch_managed            AS "isBatchManaged",
        i.is_serial_managed           AS "isSerialManaged",
        i.is_qc_inspection_required   AS "isQcInspectionRequired",
        i.shelf_life_days             AS "shelfLifeDays",
        i.default_warehouse_id        AS "defaultWarehouseId",
        w.warehouse_code              AS "defaultWarehouseCode",
        w.warehouse_name              AS "defaultWarehouseName",
        i.default_bin_id              AS "defaultBinId",
        b.bin_code                    AS "defaultBinCode",
        b.bin_name                    AS "defaultBinName",
        i.drawing_no                  AS "drawingNo",
        i.revision_no                 AS "revisionNo",
        i.weight_per_unit_kg          AS "weightPerUnitKg",
        i.is_bom_allowed              AS "isBomAllowed",
        i.yield_percentage            AS "yieldPercentage",
        i.inspection_lead_time_days   AS "inspectionLeadTimeDays",
        i.is_active                   AS "isActive",
        i.comp_id                     AS "compId",
        i.branch_id                   AS "branchId",
        i.created_date                AS "createdDate",
        i.updated_date                AS "updatedDate"
      FROM tbl_inv_item i
      JOIN tbl_inv_item_category c ON c.category_id = i.category_id
      JOIN tbl_inv_uom bu ON bu.uom_id = i.base_uom_id
      JOIN tbl_inv_uom pu ON pu.uom_id = i.purchase_uom_id
      JOIN tbl_inv_uom su ON su.uom_id = i.sales_uom_id
      LEFT JOIN tbl_inv_warehouse w ON w.warehouse_id = i.default_warehouse_id
      LEFT JOIN tbl_inv_storage_bin b ON b.bin_id = i.default_bin_id
      WHERE i.item_id = $1 AND i.comp_id = $2
      `,
      [itemId, compId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Item with ID ${itemId} not found`);
    }

    return this.mapItemRow(rows[0]);
  }

  // ==========================================================================
  // CREATE / INSERT
  // ==========================================================================

  async createItem(
    dto: CreateItemDto,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const trimmedCode = dto.itemCode.trim().toUpperCase();
    const trimmedName = dto.itemName.trim();

    if (!trimmedCode) {
      throw new BadRequestException('Item code is required');
    }
    if (!trimmedName) {
      throw new BadRequestException('Item name is required');
    }
    if (!dto.categoryId) {
      throw new BadRequestException('Category is required');
    }
    if (!dto.baseUomId) {
      throw new BadRequestException('Base UOM is required');
    }

    // Check duplicate code in company
    const { rows: dupRows } = await this.pool.query(
      `SELECT item_id FROM tbl_inv_item WHERE comp_id = $1 AND item_code = $2`,
      [compId, trimmedCode],
    );
    if (dupRows.length > 0) {
      throw new ConflictException(
        `Item code '${trimmedCode}' already exists in this company`,
      );
    }

    const purchaseUomId = dto.purchaseUomId || dto.baseUomId;
    const salesUomId = dto.salesUomId || dto.baseUomId;

    const query = `
      INSERT INTO tbl_inv_item (
        item_code, item_name, category_id, item_type, description,
        base_uom_id, purchase_uom_id, sales_uom_id, hsn_sac_code, tax_rate,
        standard_cost, purchase_rate, sales_rate,
        min_stock_level, max_stock_level, reorder_point, safety_stock,
        lead_time_days, valuation_method,
        is_batch_managed, is_serial_managed, is_qc_inspection_required, shelf_life_days,
        default_warehouse_id, default_bin_id,
        drawing_no, revision_no, weight_per_unit_kg, is_bom_allowed, yield_percentage, inspection_lead_time_days,
        is_active, comp_id, branch_id, fyear_id, created_by
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16, $17,
        $18, $19,
        $20, $21, $22, $23,
        $24, $25,
        $26, $27, $28, $29, $30, $31,
        $32, $33, $34, $35, $36
      )
      RETURNING item_id AS "itemId"
    `;

    const values = [
      trimmedCode,
      trimmedName,
      dto.categoryId,
      dto.itemType || 'RAW_MATERIAL',
      dto.description || null,
      dto.baseUomId,
      purchaseUomId,
      salesUomId,
      dto.hsnSacCode || null,
      dto.taxRate !== undefined ? dto.taxRate : 18.0,
      dto.standardCost !== undefined ? dto.standardCost : 0,
      dto.purchaseRate !== undefined ? dto.purchaseRate : 0,
      dto.salesRate !== undefined ? dto.salesRate : 0,
      dto.minStockLevel !== undefined ? dto.minStockLevel : 0,
      dto.maxStockLevel !== undefined ? dto.maxStockLevel : null,
      dto.reorderPoint !== undefined ? dto.reorderPoint : 0,
      dto.safetyStock !== undefined ? dto.safetyStock : 0,
      dto.leadTimeDays !== undefined ? dto.leadTimeDays : 7,
      dto.valuationMethod || 'FIFO',
      dto.isBatchManaged !== undefined ? dto.isBatchManaged : true,
      dto.isSerialManaged !== undefined ? dto.isSerialManaged : false,
      dto.isQcInspectionRequired !== undefined ? dto.isQcInspectionRequired : true,
      dto.shelfLifeDays !== undefined ? dto.shelfLifeDays : null,
      dto.defaultWarehouseId || null,
      dto.defaultBinId || null,
      dto.drawingNo || null,
      dto.revisionNo || null,
      dto.weightPerUnitKg !== undefined ? dto.weightPerUnitKg : null,
      dto.isBomAllowed !== undefined ? dto.isBomAllowed : true,
      dto.yieldPercentage !== undefined ? dto.yieldPercentage : 100.0,
      dto.inspectionLeadTimeDays !== undefined ? dto.inspectionLeadTimeDays : 1,
      dto.isActive !== undefined ? dto.isActive : true,
      compId,
      branchId,
      fyearId,
      userId,
    ];

    const { rows: inserted } = await this.pool.query(query, values);
    const newId = Number(inserted[0].itemId);

    const record = await this.findItemById(newId, user);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'ITEM_MASTER',
      actionType: 'ADD',
      entityTable: 'tbl_inv_item',
      recordId: newId,
      oldValue: null,
      newValue: record as unknown as Record<string, unknown>,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return record;
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  async updateItem(
    itemId: number,
    dto: UpdateItemDto,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const existing = await this.findItemById(itemId, user);
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;

    const trimmedCode = dto.itemCode !== undefined ? dto.itemCode.trim().toUpperCase() : existing.itemCode;
    const trimmedName = dto.itemName !== undefined ? dto.itemName.trim() : existing.itemName;

    if (dto.itemCode && trimmedCode !== existing.itemCode) {
      const { rows: dupRows } = await this.pool.query(
        `SELECT item_id FROM tbl_inv_item WHERE comp_id = $1 AND item_code = $2 AND item_id <> $3`,
        [compId, trimmedCode, itemId],
      );
      if (dupRows.length > 0) {
        throw new ConflictException(
          `Item code '${trimmedCode}' already exists in this company`,
        );
      }
    }

    const query = `
      UPDATE tbl_inv_item SET
        item_code                   = $1,
        item_name                   = $2,
        category_id                 = $3,
        item_type                   = $4,
        description                 = $5,
        base_uom_id                 = $6,
        purchase_uom_id             = $7,
        sales_uom_id                = $8,
        hsn_sac_code                = $9,
        tax_rate                    = $10,
        standard_cost               = $11,
        purchase_rate               = $12,
        sales_rate                  = $13,
        min_stock_level             = $14,
        max_stock_level             = $15,
        reorder_point               = $16,
        safety_stock                = $17,
        lead_time_days              = $18,
        valuation_method            = $19,
        is_batch_managed            = $20,
        is_serial_managed           = $21,
        is_qc_inspection_required   = $22,
        shelf_life_days             = $23,
        default_warehouse_id        = $24,
        default_bin_id              = $25,
        drawing_no                  = $26,
        revision_no                 = $27,
        weight_per_unit_kg          = $28,
        is_bom_allowed              = $29,
        yield_percentage            = $30,
        inspection_lead_time_days   = $31,
        is_active                   = $32,
        updated_by                  = $33,
        updated_date                = CURRENT_TIMESTAMP
      WHERE item_id = $34 AND comp_id = $35
      RETURNING item_id AS "itemId"
    `;

    const values = [
      trimmedCode,
      trimmedName,
      dto.categoryId !== undefined ? dto.categoryId : existing.categoryId,
      dto.itemType !== undefined ? dto.itemType : existing.itemType,
      dto.description !== undefined ? dto.description : existing.description,
      dto.baseUomId !== undefined ? dto.baseUomId : existing.baseUomId,
      dto.purchaseUomId !== undefined ? dto.purchaseUomId : existing.purchaseUomId,
      dto.salesUomId !== undefined ? dto.salesUomId : existing.salesUomId,
      dto.hsnSacCode !== undefined ? dto.hsnSacCode : existing.hsnSacCode,
      dto.taxRate !== undefined ? dto.taxRate : existing.taxRate,
      dto.standardCost !== undefined ? dto.standardCost : existing.standardCost,
      dto.purchaseRate !== undefined ? dto.purchaseRate : existing.purchaseRate,
      dto.salesRate !== undefined ? dto.salesRate : existing.salesRate,
      dto.minStockLevel !== undefined ? dto.minStockLevel : existing.minStockLevel,
      dto.maxStockLevel !== undefined ? dto.maxStockLevel : existing.maxStockLevel,
      dto.reorderPoint !== undefined ? dto.reorderPoint : existing.reorderPoint,
      dto.safetyStock !== undefined ? dto.safetyStock : existing.safetyStock,
      dto.leadTimeDays !== undefined ? dto.leadTimeDays : existing.leadTimeDays,
      dto.valuationMethod !== undefined ? dto.valuationMethod : existing.valuationMethod,
      dto.isBatchManaged !== undefined ? dto.isBatchManaged : existing.isBatchManaged,
      dto.isSerialManaged !== undefined ? dto.isSerialManaged : existing.isSerialManaged,
      dto.isQcInspectionRequired !== undefined ? dto.isQcInspectionRequired : existing.isQcInspectionRequired,
      dto.shelfLifeDays !== undefined ? dto.shelfLifeDays : existing.shelfLifeDays,
      dto.defaultWarehouseId !== undefined ? dto.defaultWarehouseId : existing.defaultWarehouseId,
      dto.defaultBinId !== undefined ? dto.defaultBinId : existing.defaultBinId,
      dto.drawingNo !== undefined ? dto.drawingNo : existing.drawingNo,
      dto.revisionNo !== undefined ? dto.revisionNo : existing.revisionNo,
      dto.weightPerUnitKg !== undefined ? dto.weightPerUnitKg : existing.weightPerUnitKg,
      dto.isBomAllowed !== undefined ? dto.isBomAllowed : existing.isBomAllowed,
      dto.yieldPercentage !== undefined ? dto.yieldPercentage : existing.yieldPercentage,
      dto.inspectionLeadTimeDays !== undefined ? dto.inspectionLeadTimeDays : existing.inspectionLeadTimeDays,
      dto.isActive !== undefined ? dto.isActive : existing.isActive,
      userId,
      itemId,
      compId,
    ];

    await this.pool.query(query, values);
    const updated = await this.findItemById(itemId, user);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'ITEM_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_inv_item',
      recordId: itemId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: updated as unknown as Record<string, unknown>,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return updated;
  }

  // ==========================================================================
  // DELETE
  // ==========================================================================

  async deleteItem(
    itemId: number,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const existing = await this.findItemById(itemId, user);
    const compId = user.compId || 1001;

    // Check references in child/operational tables
    await this.dependencyCheckService.verifyCanDelete({
      entity: 'Item / Material Master',
      entityId: itemId,
      relations: [
        { table: 'tbl_bom_header', column: 'item_id', label: 'Bill of Materials (Parent SKU)' },
        { table: 'tbl_bom_item', column: 'component_item_id', label: 'BOM Component Entries' },
        { table: 'tbl_inv_stock_balance', column: 'item_id', label: 'Warehouse Stock Balance' },
        { table: 'tbl_pr_item', column: 'item_id', label: 'Purchase Requisition Items' },
        { table: 'tbl_po_item', column: 'item_id', label: 'Purchase Order Items' },
        { table: 'tbl_grn_item', column: 'item_id', label: 'Goods Receipt Items' },
        { table: 'tbl_so_item', column: 'item_id', label: 'Sales Order Items' },
        { table: 'tbl_prod_work_order', column: 'item_id', label: 'Shopfloor Work Orders' },
      ],
    });

    await this.pool.query(
      `DELETE FROM tbl_inv_item WHERE item_id = $1 AND comp_id = $2`,
      [itemId, compId],
    );

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'ITEM_MASTER',
      actionType: 'DELETE',
      entityTable: 'tbl_inv_item',
      recordId: itemId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: null,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return { success: true, message: `Item ${existing.itemCode} deleted successfully` };
  }

  async recordScreenAction(
    actionType: 'PRINT' | 'EXPORT',
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'ITEM_MASTER',
      actionType,
      entityTable: 'tbl_inv_item',
      recordId: 0,
      oldValue: null,
      newValue: { actionType, screenCode: 'ITEM_MASTER' },
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });
    return { logged: true };
  }


  // ==========================================================================
  // HELPER: ROW MAPPER
  // ==========================================================================

  private mapItemRow(r: any) {
    return {
      itemId: Number(r.itemId),
      itemCode: r.itemCode,
      itemName: r.itemName,
      categoryId: Number(r.categoryId),
      categoryCode: r.categoryCode,
      categoryName: r.categoryName,
      categoryHierarchyPath: r.categoryHierarchyPath,
      itemType: r.itemType,
      description: r.description || null,
      baseUomId: Number(r.baseUomId),
      baseUomCode: r.baseUomCode,
      baseUomName: r.baseUomName,
      purchaseUomId: Number(r.purchaseUomId),
      purchaseUomCode: r.purchaseUomCode,
      purchaseUomName: r.purchaseUomName,
      salesUomId: Number(r.salesUomId),
      salesUomCode: r.salesUomCode,
      salesUomName: r.salesUomName,
      hsnSacCode: r.hsnSacCode || null,
      taxRate: Number(r.taxRate) || 0,
      standardCost: Number(r.standardCost) || 0,
      purchaseRate: Number(r.purchaseRate) || 0,
      salesRate: Number(r.salesRate) || 0,
      minStockLevel: Number(r.minStockLevel) || 0,
      maxStockLevel: r.maxStockLevel !== null && r.maxStockLevel !== undefined ? Number(r.maxStockLevel) : null,
      reorderPoint: Number(r.reorderPoint) || 0,
      safetyStock: Number(r.safetyStock) || 0,
      leadTimeDays: Number(r.leadTimeDays) || 0,
      valuationMethod: r.valuationMethod,
      isBatchManaged: Boolean(r.isBatchManaged),
      isSerialManaged: Boolean(r.isSerialManaged),
      isQcInspectionRequired: Boolean(r.isQcInspectionRequired),
      shelfLifeDays: r.shelfLifeDays !== null && r.shelfLifeDays !== undefined ? Number(r.shelfLifeDays) : null,
      defaultWarehouseId: r.defaultWarehouseId ? Number(r.defaultWarehouseId) : null,
      defaultWarehouseCode: r.defaultWarehouseCode || null,
      defaultWarehouseName: r.defaultWarehouseName || null,
      defaultBinId: r.defaultBinId ? Number(r.defaultBinId) : null,
      defaultBinCode: r.defaultBinCode || null,
      defaultBinName: r.defaultBinName || null,
      drawingNo: r.drawingNo || null,
      revisionNo: r.revisionNo || null,
      weightPerUnitKg: r.weightPerUnitKg !== null && r.weightPerUnitKg !== undefined ? Number(r.weightPerUnitKg) : null,
      isBomAllowed: Boolean(r.isBomAllowed),
      yieldPercentage: Number(r.yieldPercentage) || 100,
      inspectionLeadTimeDays: Number(r.inspectionLeadTimeDays) || 1,
      isActive: Boolean(r.isActive),
      compId: Number(r.compId),
      branchId: Number(r.branchId),
      createdDate: r.createdDate,
      updatedDate: r.updatedDate,
    };
  }
}
