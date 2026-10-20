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
import { StockBalanceFilterDto, StockRevaluationDto } from './stock-balance.dto';

@Injectable()
export class StockBalanceService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
  ) {}

  /**
   * Executive KPI Summary for Inventory Valuation & Stock Health
   */
  async getSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    // Aggregate metrics
    const aggRes = await this.pool.query(
      `SELECT
        COUNT(*)::int AS total_lines,
        COALESCE(SUM(bs.total_valuation), 0)::numeric(16, 2) AS total_valuation,
        COALESCE(SUM(bs.on_hand_qty), 0)::numeric(16, 3) AS total_on_hand_units,
        COALESCE(SUM(bs.available_qty), 0)::numeric(16, 3) AS total_available_units,
        COALESCE(SUM(bs.reserved_qty), 0)::numeric(16, 3) AS total_reserved_units,
        COUNT(CASE WHEN bs.on_hand_qty <= COALESCE(i.safety_stock, 0) AND bs.on_hand_qty > 0 THEN 1 END)::int AS low_stock_count,
        COUNT(CASE WHEN bs.on_hand_qty <= 0 THEN 1 END)::int AS out_of_stock_count
      FROM tbl_inv_bin_stock bs
      JOIN tbl_inv_item i ON bs.item_id = i.item_id
      WHERE bs.comp_id = $1 AND bs.branch_id = $2 AND bs.is_active = TRUE`,
      [compId, branchId],
    );

    // Valuation by Warehouse
    const whRes = await this.pool.query(
      `SELECT
        w.warehouse_id,
        w.warehouse_code,
        w.warehouse_name,
        w.warehouse_type,
        COUNT(bs.bin_stock_id)::int AS line_count,
        COALESCE(SUM(bs.total_valuation), 0)::numeric(16, 2) AS total_valuation
      FROM tbl_inv_warehouse w
      LEFT JOIN tbl_inv_bin_stock bs ON w.warehouse_id = bs.warehouse_id 
        AND bs.comp_id = $1 AND bs.branch_id = $2 AND bs.is_active = TRUE
      WHERE w.comp_id = $1 AND w.branch_id = $2 AND w.is_active = TRUE
      GROUP BY w.warehouse_id, w.warehouse_code, w.warehouse_name, w.warehouse_type
      ORDER BY total_valuation DESC, w.warehouse_name ASC`,
      [compId, branchId],
    );

    // Valuation by Item Category / Type
    const catRes = await this.pool.query(
      `SELECT
        i.item_type,
        COUNT(bs.bin_stock_id)::int AS line_count,
        COALESCE(SUM(bs.total_valuation), 0)::numeric(16, 2) AS total_valuation
      FROM tbl_inv_bin_stock bs
      JOIN tbl_inv_item i ON bs.item_id = i.item_id
      WHERE bs.comp_id = $1 AND bs.branch_id = $2 AND bs.is_active = TRUE
      GROUP BY i.item_type
      ORDER BY total_valuation DESC`,
      [compId, branchId],
    );

    const agg = aggRes.rows[0] || {
      total_lines: 0,
      total_valuation: 0,
      total_on_hand_units: 0,
      total_available_units: 0,
      total_reserved_units: 0,
      low_stock_count: 0,
      out_of_stock_count: 0,
    };

    return {
      totalValuation: Number(agg.total_valuation),
      totalLines: Number(agg.total_lines),
      totalOnHandUnits: Number(agg.total_on_hand_units),
      totalAvailableUnits: Number(agg.total_available_units),
      totalReservedUnits: Number(agg.total_reserved_units),
      lowStockCount: Number(agg.low_stock_count),
      outOfStockCount: Number(agg.out_of_stock_count),
      valuationByWarehouse: whRes.rows.map((r) => ({
        warehouseId: Number(r.warehouse_id),
        warehouseCode: r.warehouse_code,
        warehouseName: r.warehouse_name,
        warehouseType: r.warehouse_type,
        lineCount: Number(r.line_count),
        totalValuation: Number(r.total_valuation),
      })),
      valuationByCategory: catRes.rows.map((r) => ({
        itemType: r.item_type,
        lineCount: Number(r.line_count),
        totalValuation: Number(r.total_valuation),
      })),
    };
  }

  /**
   * Reference lookups for filtering stock balances
   */
  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const [whRes, binRes, catRes, uomRes] = await Promise.all([
      this.pool.query(
        `SELECT warehouse_id, warehouse_code, warehouse_name, warehouse_type
         FROM tbl_inv_warehouse
         WHERE comp_id = $1 AND branch_id = $2 AND is_active = TRUE
         ORDER BY warehouse_name ASC`,
        [compId, branchId],
      ),
      this.pool.query(
        `SELECT bin_id, warehouse_id, bin_code, bin_name, bin_type
         FROM tbl_inv_storage_bin
         WHERE comp_id = $1 AND branch_id = $2 AND is_active = TRUE
         ORDER BY bin_code ASC`,
        [compId, branchId],
      ),
      this.pool.query(
        `SELECT DISTINCT item_type FROM tbl_inv_item WHERE comp_id = $1 ORDER BY item_type ASC`,
        [compId],
      ),
      this.pool.query(
        `SELECT uom_id, uom_code, uom_name FROM tbl_inv_uom WHERE is_active = TRUE ORDER BY uom_code ASC`,
      ),
    ]);

    return {
      warehouses: whRes.rows.map((w) => ({
        warehouseId: Number(w.warehouse_id),
        warehouseCode: w.warehouse_code,
        warehouseName: w.warehouse_name,
        warehouseType: w.warehouse_type,
      })),
      bins: binRes.rows.map((b) => ({
        binId: Number(b.bin_id),
        warehouseId: Number(b.warehouse_id),
        binCode: b.bin_code,
        binName: b.bin_name,
        binType: b.bin_type,
      })),
      itemTypes: catRes.rows.map((c) => c.item_type),
      uoms: uomRes.rows.map((u) => ({
        uomId: Number(u.uom_id),
        uomCode: u.uom_code,
        uomName: u.uom_name,
      })),
    };
  }

  /**
   * Paginated and Filtered Stock Balance Register
   */
  async getStockBalances(
    user: AuthenticatedUserContext,
    filter: StockBalanceFilterDto,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(filter.limit) || 50));
    const offset = (page - 1) * limit;

    const conditions: string[] = [
      `bs.comp_id = $1`,
      `bs.branch_id = $2`,
      `bs.is_active = TRUE`,
    ];
    const params: any[] = [compId, branchId];
    let pIdx = 3;

    if (filter.warehouseId) {
      conditions.push(`bs.warehouse_id = $${pIdx++}`);
      params.push(filter.warehouseId);
    }

    if (filter.binId) {
      conditions.push(`bs.bin_id = $${pIdx++}`);
      params.push(filter.binId);
    }

    if (filter.itemType && filter.itemType !== 'ALL') {
      conditions.push(`i.item_type = $${pIdx++}`);
      params.push(filter.itemType);
    }

    if (filter.stockStatus && filter.stockStatus !== 'ALL') {
      if (filter.stockStatus === 'IN_STOCK') {
        conditions.push(`bs.on_hand_qty > 0`);
      } else if (filter.stockStatus === 'LOW_STOCK') {
        conditions.push(`bs.on_hand_qty <= COALESCE(i.safety_stock, 0) AND bs.on_hand_qty > 0`);
      } else if (filter.stockStatus === 'OUT_OF_STOCK') {
        conditions.push(`bs.on_hand_qty <= 0`);
      } else if (filter.stockStatus === 'RESERVED') {
        conditions.push(`bs.reserved_qty > 0`);
      }
    }

    if (filter.search && filter.search.trim()) {
      const q = `%${filter.search.trim().toLowerCase()}%`;
      conditions.push(
        `(LOWER(i.item_code) LIKE $${pIdx} OR LOWER(i.item_name) LIKE $${pIdx} OR LOWER(COALESCE(bs.batch_no, '')) LIKE $${pIdx} OR LOWER(COALESCE(bs.heat_no, '')) LIKE $${pIdx} OR LOWER(w.warehouse_name) LIKE $${pIdx} OR LOWER(b.bin_code) LIKE $${pIdx})`,
      );
      params.push(q);
      pIdx++;
    }

    const whereClause = conditions.join(' AND ');

    // Count Total
    const countRes = await this.pool.query(
      `SELECT COUNT(*)::int as total
       FROM tbl_inv_bin_stock bs
       JOIN tbl_inv_item i ON bs.item_id = i.item_id
       JOIN tbl_inv_warehouse w ON bs.warehouse_id = w.warehouse_id
       JOIN tbl_inv_storage_bin b ON bs.bin_id = b.bin_id
       WHERE ${whereClause}`,
      params,
    );
    const total = countRes.rows[0]?.total || 0;

    // Sorting map
    const sortFieldMap: Record<string, string> = {
      itemCode: 'i.item_code',
      itemName: 'i.item_name',
      warehouseName: 'w.warehouse_name',
      binCode: 'b.bin_code',
      onHandQty: 'bs.on_hand_qty',
      availableQty: 'bs.available_qty',
      reservedQty: 'bs.reserved_qty',
      unitCost: 'bs.unit_cost',
      totalValuation: 'bs.total_valuation',
      lastStockDate: 'bs.last_stock_date',
    };
    const sortCol = sortFieldMap[filter.sortBy || 'itemCode'] || 'i.item_code';
    const sortDirection = filter.sortOrder?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const dataRes = await this.pool.query(
      `SELECT
        bs.bin_stock_id,
        bs.comp_id,
        bs.branch_id,
        bs.warehouse_id,
        w.warehouse_code,
        w.warehouse_name,
        w.warehouse_type,
        bs.bin_id,
        b.bin_code,
        b.bin_name,
        b.bin_type,
        bs.item_id,
        i.item_code,
        i.item_name,
        i.item_type,
        i.hsn_code,
        COALESCE(i.safety_stock, 0)::numeric(14, 3) AS safety_stock,
        COALESCE(i.standard_cost, 0)::numeric(14, 4) AS item_standard_cost,
        bs.uom_id,
        u.uom_code,
        u.uom_name,
        bs.batch_no,
        bs.heat_no,
        bs.on_hand_qty::numeric(14, 3) AS on_hand_qty,
        bs.reserved_qty::numeric(14, 3) AS reserved_qty,
        bs.available_qty::numeric(14, 3) AS available_qty,
        COALESCE(bs.unit_cost, 0)::numeric(14, 4) AS unit_cost,
        COALESCE(bs.total_valuation, 0)::numeric(16, 2) AS total_valuation,
        bs.last_stock_date,
        CASE WHEN bs.on_hand_qty <= COALESCE(i.safety_stock, 0) AND bs.on_hand_qty > 0 THEN TRUE ELSE FALSE END AS is_low_stock,
        CASE WHEN bs.on_hand_qty <= 0 THEN TRUE ELSE FALSE END AS is_out_of_stock
      FROM tbl_inv_bin_stock bs
      JOIN tbl_inv_item i ON bs.item_id = i.item_id
      JOIN tbl_inv_warehouse w ON bs.warehouse_id = w.warehouse_id
      JOIN tbl_inv_storage_bin b ON bs.bin_id = b.bin_id
      JOIN tbl_inv_uom u ON bs.uom_id = u.uom_id
      WHERE ${whereClause}
      ORDER BY ${sortCol} ${sortDirection}
      LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
      [...params, limit, offset],
    );

    return {
      data: dataRes.rows.map((r) => ({
        binStockId: Number(r.bin_stock_id),
        compId: Number(r.comp_id),
        branchId: Number(r.branch_id),
        warehouseId: Number(r.warehouse_id),
        warehouseCode: r.warehouse_code,
        warehouseName: r.warehouse_name,
        warehouseType: r.warehouse_type,
        binId: Number(r.bin_id),
        binCode: r.bin_code,
        binName: r.bin_name,
        binType: r.bin_type,
        itemId: Number(r.item_id),
        itemCode: r.item_code,
        itemName: r.item_name,
        itemType: r.item_type,
        hsnCode: r.hsn_code,
        safetyStock: Number(r.safety_stock),
        itemStandardCost: Number(r.item_standard_cost),
        uomId: Number(r.uom_id),
        uomCode: r.uom_code,
        uomName: r.uom_name,
        batchNo: r.batch_no,
        heatNo: r.heat_no,
        onHandQty: Number(r.on_hand_qty),
        reservedQty: Number(r.reserved_qty),
        availableQty: Number(r.available_qty),
        unitCost: Number(r.unit_cost),
        totalValuation: Number(r.total_valuation),
        lastStockDate: r.last_stock_date,
        isLowStock: Boolean(r.is_low_stock),
        isOutOfStock: Boolean(r.is_out_of_stock),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Movement History & Stock Ledger Audit Trail Drilldown
   */
  async getStockLedgerDrilldown(
    user: AuthenticatedUserContext,
    binStockId: number,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    // Get the bin stock details
    const bsRes = await this.pool.query(
      `SELECT
        bs.bin_stock_id, bs.warehouse_id, bs.bin_id, bs.item_id, bs.batch_no, bs.heat_no,
        i.item_code, i.item_name, w.warehouse_name, b.bin_code, u.uom_code,
        bs.on_hand_qty, bs.unit_cost, bs.total_valuation
       FROM tbl_inv_bin_stock bs
       JOIN tbl_inv_item i ON bs.item_id = i.item_id
       JOIN tbl_inv_warehouse w ON bs.warehouse_id = w.warehouse_id
       JOIN tbl_inv_storage_bin b ON bs.bin_id = b.bin_id
       JOIN tbl_inv_uom u ON bs.uom_id = u.uom_id
       WHERE bs.bin_stock_id = $1 AND bs.comp_id = $2 AND bs.branch_id = $3`,
      [binStockId, compId, branchId],
    );

    if (bsRes.rowCount === 0) {
      throw new NotFoundException(`Bin stock record #${binStockId} not found`);
    }

    const bs = bsRes.rows[0];

    // Query ledger history for this item and warehouse
    const ledgerRes = await this.pool.query(
      `SELECT
        sl.ledger_id,
        sl.transaction_date,
        sl.transaction_type,
        sl.reference_doc_type,
        sl.reference_doc_id,
        sl.reference_doc_no,
        sl.warehouse_id,
        w.warehouse_name,
        sl.from_bin_id,
        fb.bin_code AS from_bin_code,
        sl.to_bin_id,
        tb.bin_code AS to_bin_code,
        sl.batch_no,
        sl.heat_no,
        sl.qty_in::numeric(14, 3) AS qty_in,
        sl.qty_out::numeric(14, 3) AS qty_out,
        COALESCE(sl.unit_cost, 0)::numeric(14, 4) AS unit_cost,
        COALESCE(sl.total_cost, 0)::numeric(16, 2) AS total_cost,
        sl.closing_balance::numeric(14, 3) AS closing_balance,
        sl.remarks,
        u.username AS created_by_user
      FROM tbl_inv_stock_ledger sl
      LEFT JOIN tbl_inv_warehouse w ON sl.warehouse_id = w.warehouse_id
      LEFT JOIN tbl_inv_storage_bin fb ON sl.from_bin_id = fb.bin_id
      LEFT JOIN tbl_inv_storage_bin tb ON sl.to_bin_id = tb.bin_id
      LEFT JOIN tbl_sec_user u ON sl.created_by = u.user_id
      WHERE sl.comp_id = $1 AND sl.branch_id = $2 AND sl.item_id = $3
        AND (sl.warehouse_id = $4 OR sl.to_bin_id = $5 OR sl.from_bin_id = $5)
        AND ($6::text IS NULL OR sl.batch_no = $6)
      ORDER BY sl.transaction_date DESC, sl.ledger_id DESC`,
      [
        compId,
        branchId,
        bs.item_id,
        bs.warehouse_id,
        bs.bin_id,
        bs.batch_no || null,
      ],
    );

    return {
      stockInfo: {
        binStockId: Number(bs.bin_stock_id),
        itemId: Number(bs.item_id),
        itemCode: bs.item_code,
        itemName: bs.item_name,
        warehouseName: bs.warehouse_name,
        binCode: bs.bin_code,
        uomCode: bs.uom_code,
        batchNo: bs.batch_no,
        heatNo: bs.heat_no,
        onHandQty: Number(bs.on_hand_qty),
        unitCost: Number(bs.unit_cost),
        totalValuation: Number(bs.total_valuation),
      },
      ledgerEntries: ledgerRes.rows.map((r) => ({
        ledgerId: Number(r.ledger_id),
        transactionDate: r.transaction_date,
        transactionType: r.transaction_type,
        referenceDocType: r.reference_doc_type,
        referenceDocId: Number(r.reference_doc_id),
        referenceDocNo: r.reference_doc_no,
        warehouseName: r.warehouse_name,
        fromBinCode: r.from_bin_code,
        toBinCode: r.to_bin_code,
        batchNo: r.batch_no,
        heatNo: r.heat_no,
        qtyIn: Number(r.qty_in),
        qtyOut: Number(r.qty_out),
        unitCost: Number(r.unit_cost),
        totalCost: Number(r.total_cost),
        closingBalance: Number(r.closing_balance),
        remarks: r.remarks,
        createdByUser: r.created_by_user,
      })),
    };
  }

  /**
   * Recalculate Inventory Valuation & Update Unit Cost
   */
  async revalueStock(
    user: AuthenticatedUserContext,
    binStockId: number,
    dto: StockRevaluationDto,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;

    if (dto.newUnitCost < 0) {
      throw new BadRequestException('Unit cost cannot be negative');
    }

    const currentRes = await this.pool.query(
      `SELECT bs.*, i.item_code, i.item_name, i.standard_cost
       FROM tbl_inv_bin_stock bs
       JOIN tbl_inv_item i ON bs.item_id = i.item_id
       WHERE bs.bin_stock_id = $1 AND bs.comp_id = $2 AND bs.branch_id = $3`,
      [binStockId, compId, branchId],
    );

    if (currentRes.rowCount === 0) {
      throw new NotFoundException(`Bin stock record #${binStockId} not found`);
    }

    const current = currentRes.rows[0];
    const onHandQty = Number(current.on_hand_qty);
    const oldUnitCost = Number(current.unit_cost);
    const oldValuation = Number(current.total_valuation);

    const newUnitCost = Number(dto.newUnitCost);
    const newValuation = Math.round(onHandQty * newUnitCost * 100) / 100;

    // Update bin stock
    const updateRes = await this.pool.query(
      `UPDATE tbl_inv_bin_stock
       SET unit_cost = $1,
           total_valuation = $2,
           updated_by = $3,
           updated_date = CURRENT_TIMESTAMP
       WHERE bin_stock_id = $4
       RETURNING *`,
      [newUnitCost, newValuation, userId, binStockId],
    );

    // Optionally update item master standard cost
    if (dto.updateItemStandardCost) {
      await this.pool.query(
        `UPDATE tbl_inv_item
         SET standard_cost = $1,
             updated_by = $2,
             updated_date = CURRENT_TIMESTAMP
         WHERE item_id = $3`,
        [newUnitCost, userId, current.item_id],
      );
    }

    // Record audit log
    await this.auditLogService.logAction({
      userId,
      screenCode: 'STOCK_BALANCE',
      actionType: 'REVALUE',
      entityTable: 'tbl_inv_bin_stock',
      recordId: binStockId,
      oldValue: {
        unitCost: oldUnitCost,
        totalValuation: oldValuation,
      },
      newValue: {
        unitCost: newUnitCost,
        totalValuation: newValuation,
        revaluationReason: dto.revaluationReason,
        updateItemStandardCost: dto.updateItemStandardCost || false,
      },
      compId,
      branchId,
    });

    const updated = updateRes.rows[0];
    return {
      binStockId: Number(updated.bin_stock_id),
      itemCode: current.item_code,
      itemName: current.item_name,
      oldUnitCost,
      newUnitCost,
      oldValuation,
      newValuation,
      valuationDelta: newValuation - oldValuation,
      revaluationReason: dto.revaluationReason,
    };
  }
}
