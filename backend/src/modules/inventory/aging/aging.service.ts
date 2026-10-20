import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { sql, eq, and, desc, asc, ilike, or } from 'drizzle-orm';
import { DRIZZLE_DB, type DrizzleDb } from '../../../database/database.module';
import {
  tblInvBinStock,
  tblInvItem,
  tblInvWarehouse,
  tblInvStorageBin,
  tblInvUom,
  tblInvItemCategory,
  tblInvStockLedger,
  tblInvStockProvisionHeader,
  tblInvStockProvisionItem,
  tblPrHeader,
  tblPrItem,
  tblCrmParty,
  tblSecUser,
  tblHrDepartment,
} from '../../../database/schema/core.schema';
import { AuditLogService } from '../../../common/services/audit-log.service';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import type {
  AgingFilterDto,
  CreateProvisionProposalDto,
  TriggerPurchaseRequisitionDto,
} from './aging.dto';

@Injectable()
export class StockAgingService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly auditLogService: AuditLogService,
  ) {}

  // --------------------------------------------------------------------------
  // 1. Executive Summary & KPIs
  // --------------------------------------------------------------------------
  async getSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    // Fetch all on-hand stock lines
    const stockLines = await this.db
      .select({
        binStockId: tblInvBinStock.binStockId,
        itemId: tblInvBinStock.itemId,
        onHandQty: tblInvBinStock.onHandQty,
        unitCost: tblInvBinStock.unitCost,
        totalValuation: tblInvBinStock.totalValuation,
        lastStockDate: tblInvBinStock.lastStockDate,
        minStockLevel: tblInvItem.minStockLevel,
        reorderPoint: tblInvItem.reorderPoint,
        safetyStock: tblInvItem.safetyStock,
      })
      .from(tblInvBinStock)
      .innerJoin(tblInvItem, eq(tblInvBinStock.itemId, tblInvItem.itemId))
      .where(
        and(
          eq(tblInvBinStock.compId, compId),
          eq(tblInvBinStock.branchId, branchId),
          eq(tblInvBinStock.isActive, true),
        ),
      );

    const now = new Date();
    let totalGrossValuation = 0;
    let freshStockValue = 0; // 0-30 days
    let normalStockValue = 0; // 31-60 days
    let slowMovingValue = 0; // 61-90 days
    let stagnantStockValue = 0; // 91-180 days
    let dormantStockValue = 0; // 181-365 days
    let deadStockValue = 0; // >365 days

    let fastMovingCount = 0;
    let slowMovingCount = 0;
    let nonMovingCount = 0;

    let fastMovingValue = 0;
    let slowMovingVal = 0;
    let nonMovingVal = 0;

    const itemAggregates = new Map<number, { onHand: number; rpo: number; min: number; safety: number }>();

    for (const line of stockLines) {
      const qty = parseFloat(line.onHandQty || '0');
      const cost = parseFloat(line.unitCost || '0');
      const val = parseFloat(line.totalValuation || (qty * cost).toFixed(2));
      totalGrossValuation += val;

      // Age calculation
      const refDate = line.lastStockDate ? new Date(line.lastStockDate) : now;
      const ageDays = Math.max(0, Math.floor((now.getTime() - refDate.getTime()) / (1000 * 3600 * 24)));

      if (ageDays <= 30) {
        freshStockValue += val;
      } else if (ageDays <= 60) {
        normalStockValue += val;
      } else if (ageDays <= 90) {
        slowMovingValue += val;
      } else if (ageDays <= 180) {
        stagnantStockValue += val;
      } else if (ageDays <= 365) {
        dormantStockValue += val;
      } else {
        deadStockValue += val;
      }

      // FSN Classification
      if (ageDays <= 60) {
        fastMovingCount++;
        fastMovingValue += val;
      } else if (ageDays <= 180) {
        slowMovingCount++;
        slowMovingVal += val;
      } else {
        nonMovingCount++;
        nonMovingVal += val;
      }

      // Reorder tracking
      const existing = itemAggregates.get(line.itemId) || {
        onHand: 0,
        rpo: parseFloat(line.reorderPoint || '0'),
        min: parseFloat(line.minStockLevel || '0'),
        safety: parseFloat(line.safetyStock || '0'),
      };
      existing.onHand += qty;
      itemAggregates.set(line.itemId, existing);
    }

    // Reorder alert counts
    let stockoutCount = 0;
    let belowSafetyCount = 0;
    let belowRopCount = 0;

    for (const [, agg] of itemAggregates.entries()) {
      if (agg.onHand <= 0) {
        stockoutCount++;
      } else if (agg.onHand < agg.safety) {
        belowSafetyCount++;
      } else if (agg.onHand <= agg.rpo) {
        belowRopCount++;
      }
    }

    // Recommended provision based on standard matrix:
    // 0-90: 0%, 91-180: 10%, 181-365: 30%, >365: 100%
    const recommendedProvision =
      stagnantStockValue * 0.1 + dormantStockValue * 0.3 + deadStockValue * 1.0;

    return {
      totalInventoryValuation: Math.round(totalGrossValuation * 100) / 100,
      totalTrackedLines: stockLines.length,
      totalTrackedSkus: itemAggregates.size,
      agingBrackets: {
        freshStockValue: Math.round(freshStockValue * 100) / 100,
        normalStockValue: Math.round(normalStockValue * 100) / 100,
        slowMovingValue: Math.round(slowMovingValue * 100) / 100,
        stagnantStockValue: Math.round(stagnantStockValue * 100) / 100,
        dormantStockValue: Math.round(dormantStockValue * 100) / 100,
        deadStockValue: Math.round(deadStockValue * 100) / 100,
      },
      fsnAnalysis: {
        fastMovingCount,
        fastMovingValue: Math.round(fastMovingValue * 100) / 100,
        slowMovingCount,
        slowMovingValue: Math.round(slowMovingVal * 100) / 100,
        nonMovingCount,
        nonMovingValue: Math.round(nonMovingVal * 100) / 100,
      },
      reorderAlerts: {
        stockoutCount,
        belowSafetyCount,
        belowRopCount,
        totalCriticalSkus: stockoutCount + belowSafetyCount + belowRopCount,
      },
      provisioning: {
        recommendedProvision: Math.round(recommendedProvision * 100) / 100,
        deadStockValuation: Math.round(deadStockValue * 100) / 100,
        stagnantValuation: Math.round((stagnantStockValue + dormantStockValue) * 100) / 100,
      },
    };
  }

  // --------------------------------------------------------------------------
  // 2. Lookups
  // --------------------------------------------------------------------------
  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const [warehouses, categories, items, uoms, suppliers, departments] =
      await Promise.all([
        this.db
          .select({
            warehouseId: tblInvWarehouse.warehouseId,
            warehouseCode: tblInvWarehouse.warehouseCode,
            warehouseName: tblInvWarehouse.warehouseName,
          })
          .from(tblInvWarehouse)
          .where(
            and(
              eq(tblInvWarehouse.compId, compId),
              eq(tblInvWarehouse.isActive, true),
            ),
          )
          .orderBy(tblInvWarehouse.warehouseName),

        this.db
          .select({
            categoryId: tblInvItemCategory.categoryId,
            categoryCode: tblInvItemCategory.categoryCode,
            categoryName: tblInvItemCategory.categoryName,
          })
          .from(tblInvItemCategory)
          .where(
            and(
              eq(tblInvItemCategory.compId, compId),
              eq(tblInvItemCategory.isActive, true),
            ),
          )
          .orderBy(tblInvItemCategory.categoryName),

        this.db
          .select({
            itemId: tblInvItem.itemId,
            itemCode: tblInvItem.itemCode,
            itemName: tblInvItem.itemName,
            baseUomId: tblInvItem.baseUomId,
            standardCost: tblInvItem.standardCost,
            reorderPoint: tblInvItem.reorderPoint,
            minStockLevel: tblInvItem.minStockLevel,
            safetyStock: tblInvItem.safetyStock,
            leadTimeDays: tblInvItem.leadTimeDays,
          })
          .from(tblInvItem)
          .where(
            and(
              eq(tblInvItem.compId, compId),
              eq(tblInvItem.isActive, true),
            ),
          )
          .orderBy(tblInvItem.itemCode),

        this.db
          .select({
            uomId: tblInvUom.uomId,
            uomCode: tblInvUom.uomCode,
            uomName: tblInvUom.uomName,
          })
          .from(tblInvUom)
          .where(eq(tblInvUom.isActive, true))
          .orderBy(tblInvUom.uomCode),

        this.db
          .select({
            partyId: tblCrmParty.partyId,
            partyCode: tblCrmParty.partyCode,
            partyName: tblCrmParty.partyName,
          })
          .from(tblCrmParty)
          .where(
            and(
              eq(tblCrmParty.compId, compId),
              eq(tblCrmParty.isSupplier, true),
              eq(tblCrmParty.isActive, true),
            ),
          )
          .orderBy(tblCrmParty.partyName),

        this.db
          .select({
            deptId: tblHrDepartment.deptId,
            deptCode: tblHrDepartment.deptCode,
            deptName: tblHrDepartment.deptName,
          })
          .from(tblHrDepartment)
          .where(
            and(
              eq(tblHrDepartment.compId, compId),
              eq(tblHrDepartment.isActive, true),
            ),
          )
          .orderBy(tblHrDepartment.deptName),
      ]);

    return {
      warehouses,
      categories,
      items,
      uoms,
      suppliers,
      departments,
    };
  }

  // --------------------------------------------------------------------------
  // 3. Dynamic Item-Level Aging & FSN Matrix
  // --------------------------------------------------------------------------
  async getAgingAnalysis(user: AuthenticatedUserContext, filters: AgingFilterDto) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const conditions = [
      eq(tblInvBinStock.compId, compId),
      eq(tblInvBinStock.branchId, branchId),
      eq(tblInvBinStock.isActive, true),
    ];

    if (filters.warehouseId) {
      conditions.push(eq(tblInvBinStock.warehouseId, filters.warehouseId));
    }
    if (filters.categoryId) {
      conditions.push(eq(tblInvItem.categoryId, filters.categoryId));
    }

    const rows = await this.db
      .select({
        binStockId: tblInvBinStock.binStockId,
        itemId: tblInvBinStock.itemId,
        itemCode: tblInvItem.itemCode,
        itemName: tblInvItem.itemName,
        categoryId: tblInvItem.categoryId,
        categoryName: tblInvItemCategory.categoryName,
        warehouseId: tblInvBinStock.warehouseId,
        warehouseName: tblInvWarehouse.warehouseName,
        binId: tblInvBinStock.binId,
        binCode: tblInvStorageBin.binCode,
        batchNo: tblInvBinStock.batchNo,
        heatNo: tblInvBinStock.heatNo,
        onHandQty: tblInvBinStock.onHandQty,
        availableQty: tblInvBinStock.availableQty,
        uomId: tblInvBinStock.uomId,
        uomCode: tblInvUom.uomCode,
        unitCost: tblInvBinStock.unitCost,
        totalValuation: tblInvBinStock.totalValuation,
        lastStockDate: tblInvBinStock.lastStockDate,
        createdDate: tblInvBinStock.createdDate,
      })
      .from(tblInvBinStock)
      .innerJoin(tblInvItem, eq(tblInvBinStock.itemId, tblInvItem.itemId))
      .innerJoin(
        tblInvItemCategory,
        eq(tblInvItem.categoryId, tblInvItemCategory.categoryId),
      )
      .innerJoin(
        tblInvWarehouse,
        eq(tblInvBinStock.warehouseId, tblInvWarehouse.warehouseId),
      )
      .leftJoin(
        tblInvStorageBin,
        eq(tblInvBinStock.binId, tblInvStorageBin.binId),
      )
      .leftJoin(tblInvUom, eq(tblInvBinStock.uomId, tblInvUom.uomId))
      .where(and(...conditions))
      .orderBy(desc(tblInvBinStock.lastStockDate));

    const now = new Date();
    let result = rows.map((r) => {
      const refDate = r.lastStockDate ? new Date(r.lastStockDate) : new Date(r.createdDate);
      const ageInDays = Math.max(0, Math.floor((now.getTime() - refDate.getTime()) / (1000 * 3600 * 24)));

      let agingBracket: string;
      let provisionRatePercent = 0;
      if (ageInDays <= 30) {
        agingBracket = '0_30';
        provisionRatePercent = 0;
      } else if (ageInDays <= 60) {
        agingBracket = '31_60';
        provisionRatePercent = 0;
      } else if (ageInDays <= 90) {
        agingBracket = '61_90';
        provisionRatePercent = 0;
      } else if (ageInDays <= 180) {
        agingBracket = '91_180';
        provisionRatePercent = 10;
      } else if (ageInDays <= 365) {
        agingBracket = '181_365';
        provisionRatePercent = 30;
      } else {
        agingBracket = 'GT_365';
        provisionRatePercent = 100;
      }

      let fsnClassification = 'FAST';
      if (ageInDays > 180) {
        fsnClassification = 'NON_MOVING';
      } else if (ageInDays > 60) {
        fsnClassification = 'SLOW';
      }

      const onHand = parseFloat(r.onHandQty || '0');
      const unitCost = parseFloat(r.unitCost || '0');
      const grossValuation = parseFloat(r.totalValuation || (onHand * unitCost).toFixed(2));
      const provisionAmount = Math.round(grossValuation * (provisionRatePercent / 100) * 100) / 100;
      const netRealizableValue = Math.max(0, grossValuation - provisionAmount);

      return {
        binStockId: r.binStockId,
        itemId: r.itemId,
        itemCode: r.itemCode,
        itemName: r.itemName,
        categoryId: r.categoryId,
        categoryName: r.categoryName,
        warehouseId: r.warehouseId,
        warehouseName: r.warehouseName,
        binId: r.binId,
        binCode: r.binCode || 'Bin',
        batchNo: r.batchNo || '-',
        heatNo: r.heatNo || '-',
        onHandQty: onHand,
        availableQty: parseFloat(r.availableQty || '0'),
        uomId: r.uomId,
        uomCode: r.uomCode || 'NOS',
        unitCost,
        grossValuation,
        firstInwardDate: r.createdDate ? new Date(r.createdDate).toISOString().split('T')[0] : null,
        lastMovementDate: r.lastStockDate ? new Date(r.lastStockDate).toISOString().split('T')[0] : null,
        ageInDays,
        agingBracket,
        fsnClassification,
        provisionRatePercent,
        provisionAmount,
        netRealizableValue,
      };
    });

    // In-memory filters for bracket and FSN
    if (filters.agingBracket && filters.agingBracket !== 'ALL') {
      result = result.filter((r) => r.agingBracket === filters.agingBracket);
    }
    if (filters.fsnClassification && filters.fsnClassification !== 'ALL') {
      result = result.filter((r) => r.fsnClassification === filters.fsnClassification);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (r) =>
          r.itemCode.toLowerCase().includes(q) ||
          r.itemName.toLowerCase().includes(q) ||
          r.batchNo.toLowerCase().includes(q) ||
          r.heatNo.toLowerCase().includes(q) ||
          r.warehouseName.toLowerCase().includes(q),
      );
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // 4. Reorder Point (ROP) & Safety Stock Alerts Console
  // --------------------------------------------------------------------------
  async getReorderAlerts(user: AuthenticatedUserContext, filters: AgingFilterDto) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    // Fetch items with inventory planning parameters
    const items = await this.db
      .select({
        itemId: tblInvItem.itemId,
        itemCode: tblInvItem.itemCode,
        itemName: tblInvItem.itemName,
        itemType: tblInvItem.itemType,
        categoryId: tblInvItem.categoryId,
        categoryName: tblInvItemCategory.categoryName,
        baseUomId: tblInvItem.baseUomId,
        uomCode: tblInvUom.uomCode,
        standardCost: tblInvItem.standardCost,
        minStockLevel: tblInvItem.minStockLevel,
        maxStockLevel: tblInvItem.maxStockLevel,
        reorderPoint: tblInvItem.reorderPoint,
        safetyStock: tblInvItem.safetyStock,
        leadTimeDays: tblInvItem.leadTimeDays,
        defaultWarehouseId: tblInvItem.defaultWarehouseId,
        defaultBinId: tblInvItem.defaultBinId,
      })
      .from(tblInvItem)
      .innerJoin(
        tblInvItemCategory,
        eq(tblInvItem.categoryId, tblInvItemCategory.categoryId),
      )
      .leftJoin(tblInvUom, eq(tblInvItem.baseUomId, tblInvUom.uomId))
      .where(
        and(
          eq(tblInvItem.compId, compId),
          eq(tblInvItem.isActive, true),
        ),
      )
      .orderBy(tblInvItem.itemCode);

    // Fetch total current on-hand stock per item
    const onHandTotals = await this.db
      .select({
        itemId: tblInvBinStock.itemId,
        totalOnHand: sql<string>`coalesce(sum(${tblInvBinStock.onHandQty}::numeric), 0)`,
        totalAvailable: sql<string>`coalesce(sum(${tblInvBinStock.availableQty}::numeric), 0)`,
        lastStockDate: sql<string>`max(${tblInvBinStock.lastStockDate})`,
      })
      .from(tblInvBinStock)
      .where(
        and(
          eq(tblInvBinStock.compId, compId),
          eq(tblInvBinStock.branchId, branchId),
          eq(tblInvBinStock.isActive, true),
        ),
      )
      .groupBy(tblInvBinStock.itemId);

    const onHandMap = new Map<number, { onHand: number; available: number; lastDate: string }>();
    onHandTotals.forEach((oh) => {
      onHandMap.set(oh.itemId, {
        onHand: parseFloat(oh.totalOnHand || '0'),
        available: parseFloat(oh.totalAvailable || '0'),
        lastDate: oh.lastStockDate,
      });
    });

    let alerts = items.map((it) => {
      const stock = onHandMap.get(it.itemId) || { onHand: 0, available: 0, lastDate: '' };
      const onHand = stock.onHand;
      const minStock = parseFloat(it.minStockLevel || '0');
      const rpo = parseFloat(it.reorderPoint || '0');
      const safety = parseFloat(it.safetyStock || '0');
      const maxStock = it.maxStockLevel ? parseFloat(it.maxStockLevel) : rpo * 2;
      const cost = parseFloat(it.standardCost || '0');

      let stockStatus = 'ADEQUATE';
      let urgencyLevel = 'NORMAL';

      if (onHand <= 0) {
        stockStatus = 'STOCKOUT';
        urgencyLevel = 'CRITICAL_URGENT';
      } else if (onHand < minStock) {
        stockStatus = 'CRITICAL_BELOW_MIN';
        urgencyLevel = 'HIGH';
      } else if (onHand <= rpo) {
        stockStatus = 'REORDER_BREACH';
        urgencyLevel = 'MEDIUM';
      } else if (maxStock > 0 && onHand > maxStock) {
        stockStatus = 'OVERSTOCKED';
        urgencyLevel = 'LOW';
      }

      // Calculate replenishment deficit to reach Max or ROP buffer
      const targetBuffer = maxStock > 0 ? maxStock : rpo * 1.5;
      const deficitQty = Math.max(0, targetBuffer - onHand);
      const estimatedReorderValue = Math.round(deficitQty * cost * 100) / 100;

      return {
        itemId: it.itemId,
        itemCode: it.itemCode,
        itemName: it.itemName,
        itemType: it.itemType,
        categoryId: it.categoryId,
        categoryName: it.categoryName,
        uomId: it.baseUomId,
        uomCode: it.uomCode || 'NOS',
        standardCost: cost,
        onHandQty: onHand,
        availableQty: stock.available,
        minStockLevel: minStock,
        reorderPoint: rpo,
        safetyStock: safety,
        maxStockLevel: maxStock,
        deficitQty,
        estimatedReorderValue,
        leadTimeDays: it.leadTimeDays,
        stockStatus,
        urgencyLevel,
        defaultWarehouseId: it.defaultWarehouseId || 1001,
        lastStockDate: stock.lastDate,
      };
    });

    // Filter by stock status if provided
    if (filters.stockStatus && filters.stockStatus !== 'ALL') {
      if (filters.stockStatus === 'STOCKOUT') {
        alerts = alerts.filter((a) => a.stockStatus === 'STOCKOUT');
      } else if (filters.stockStatus === 'BELOW_SAFETY') {
        alerts = alerts.filter((a) => a.onHandQty < a.safetyStock);
      } else if (filters.stockStatus === 'BELOW_ROP') {
        alerts = alerts.filter((a) => a.onHandQty <= a.reorderPoint);
      } else if (filters.stockStatus === 'IN_STOCK') {
        alerts = alerts.filter((a) => a.onHandQty > 0);
      }
    }

    if (filters.search) {
      const q = filters.search.toLowerCase();
      alerts = alerts.filter(
        (a) =>
          a.itemCode.toLowerCase().includes(q) ||
          a.itemName.toLowerCase().includes(q) ||
          a.categoryName.toLowerCase().includes(q),
      );
    }

    return alerts;
  }

  // --------------------------------------------------------------------------
  // 5. 1-Click Purchase Requisition (PR) Generator from Reorder Alert
  // --------------------------------------------------------------------------
  async triggerPurchaseRequisition(
    user: AuthenticatedUserContext,
    dto: TriggerPurchaseRequisitionDto,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    // 1. Fetch item details
    const [item] = await this.db
      .select({
        itemId: tblInvItem.itemId,
        itemCode: tblInvItem.itemCode,
        itemName: tblInvItem.itemName,
        baseUomId: tblInvItem.baseUomId,
        standardCost: tblInvItem.standardCost,
        leadTimeDays: tblInvItem.leadTimeDays,
      })
      .from(tblInvItem)
      .where(and(eq(tblInvItem.itemId, dto.itemId), eq(tblInvItem.compId, compId)));

    if (!item) {
      throw new NotFoundException(`Item with ID ${dto.itemId} not found.`);
    }

    // 2. Compute PR document number
    const [countRes] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(tblPrHeader)
      .where(and(eq(tblPrHeader.compId, compId), eq(tblPrHeader.branchId, branchId)));

    const nextSeq = (countRes?.count || 0) + 1;
    const prNo = `PR-AHM-2627-${String(nextSeq).padStart(4, '0')}`;

    const requiredDate =
      dto.requiredByDate ||
      new Date(Date.now() + (item.leadTimeDays || 7) * 24 * 3600 * 1000)
        .toISOString()
        .split('T')[0];

    const estimatedRate = parseFloat(item.standardCost || '0');
    const estimatedAmount = Math.round(dto.requiredQty * estimatedRate * 100) / 100;

    // 3. Create PR Header
    const [prHeader] = await this.db
      .insert(tblPrHeader)
      .values({
        prNo,
        prDate: new Date().toISOString().split('T')[0],
        requiredByDate: requiredDate,
        departmentId: 1001, // Stores / Plant Operations
        requesterUserId: userId,
        warehouseId: dto.warehouseId || 1001,
        priority: dto.priority || 'HIGH',
        prType: 'RAW_MATERIAL',
        status: 'SUBMITTED',
        totalEstimatedAmount: estimatedAmount.toFixed(2),
        purpose:
          dto.purpose ||
          `Automated Reorder Point (ROP) Replenishment Alert for ${item.itemCode}`,
        approvalRemarks: 'System-generated via Stock Aging & ROP Alert Dashboard',
        compId,
        branchId,
        fyearId,
        createdBy: userId,
      })
      .returning();

    // 4. Create PR Item
    const [prItem] = await this.db
      .insert(tblPrItem)
      .values({
        prId: prHeader.prId,
        itemId: item.itemId,
        uomId: item.baseUomId,
        requiredQty: dto.requiredQty.toFixed(3),
        approvedQty: dto.requiredQty.toFixed(3),
        estimatedRate: estimatedRate.toFixed(4),
        estimatedAmount: estimatedAmount.toFixed(2),
        suggestedVendorId: dto.suggestedVendorId || null,
        remarks: `Reorder replenishment deficit: ${dto.requiredQty}`,
        compId,
        branchId,
        fyearId,
        createdBy: userId,
      })
      .returning();

    // 5. Audit Log
    await this.auditLogService.logAction({
      userId,
      screenCode: 'STOCK_AGING',
      actionType: 'REORDER',
      entityTable: 'tbl_pr_header',
      recordId: prHeader.prId,
      newValue: { prNo, itemId: item.itemId, requiredQty: dto.requiredQty },
      compId,
      branchId,
      fyearId,
    });

    return {
      success: true,
      message: `Purchase Requisition ${prNo} generated successfully for ${item.itemCode}!`,
      prHeader,
      prItem,
    };
  }

  // --------------------------------------------------------------------------
  // 6. Valuation Provision Proposals Listing (Ind AS 2 / CARO 2020)
  // --------------------------------------------------------------------------
  async getProvisionProposals(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const rows = await this.db
      .select({
        provisionId: tblInvStockProvisionHeader.provisionId,
        provisionNo: tblInvStockProvisionHeader.provisionNo,
        provisionDate: tblInvStockProvisionHeader.provisionDate,
        valuationDate: tblInvStockProvisionHeader.valuationDate,
        warehouseId: tblInvStockProvisionHeader.warehouseId,
        warehouseName: tblInvWarehouse.warehouseName,
        totalItemsEvaluated: tblInvStockProvisionHeader.totalItemsEvaluated,
        totalGrossValuation: tblInvStockProvisionHeader.totalGrossValuation,
        freshStockValue: tblInvStockProvisionHeader.freshStockValue,
        normalStockValue: tblInvStockProvisionHeader.normalStockValue,
        slowMovingValue: tblInvStockProvisionHeader.slowMovingValue,
        stagnantStockValue: tblInvStockProvisionHeader.stagnantStockValue,
        dormantStockValue: tblInvStockProvisionHeader.dormantStockValue,
        deadStockValue: tblInvStockProvisionHeader.deadStockValue,
        recommendedProvisionAmount:
          tblInvStockProvisionHeader.recommendedProvisionAmount,
        approvedProvisionAmount:
          tblInvStockProvisionHeader.approvedProvisionAmount,
        status: tblInvStockProvisionHeader.status,
        auditStandardCitation: tblInvStockProvisionHeader.auditStandardCitation,
        reviewerName: tblSecUser.fullName,
        reviewedAt: tblInvStockProvisionHeader.reviewedAt,
        remarks: tblInvStockProvisionHeader.remarks,
        createdDate: tblInvStockProvisionHeader.createdDate,
      })
      .from(tblInvStockProvisionHeader)
      .leftJoin(
        tblInvWarehouse,
        eq(tblInvStockProvisionHeader.warehouseId, tblInvWarehouse.warehouseId),
      )
      .leftJoin(
        tblSecUser,
        eq(tblInvStockProvisionHeader.reviewedBy, tblSecUser.userId),
      )
      .where(
        and(
          eq(tblInvStockProvisionHeader.compId, compId),
          eq(tblInvStockProvisionHeader.branchId, branchId),
          eq(tblInvStockProvisionHeader.isActive, true),
        ),
      )
      .orderBy(desc(tblInvStockProvisionHeader.provisionId));

    return rows.map((r) => ({
      ...r,
      totalGrossValuation: parseFloat(r.totalGrossValuation || '0'),
      freshStockValue: parseFloat(r.freshStockValue || '0'),
      normalStockValue: parseFloat(r.normalStockValue || '0'),
      slowMovingValue: parseFloat(r.slowMovingValue || '0'),
      stagnantStockValue: parseFloat(r.stagnantStockValue || '0'),
      dormantStockValue: parseFloat(r.dormantStockValue || '0'),
      deadStockValue: parseFloat(r.deadStockValue || '0'),
      recommendedProvisionAmount: parseFloat(
        r.recommendedProvisionAmount || '0',
      ),
      approvedProvisionAmount: parseFloat(r.approvedProvisionAmount || '0'),
    }));
  }

  // --------------------------------------------------------------------------
  // 7. Single Valuation Provision Proposal Detail with Line Items
  // --------------------------------------------------------------------------
  async getProvisionDetail(user: AuthenticatedUserContext, id: number) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const [header] = await this.db
      .select({
        provisionId: tblInvStockProvisionHeader.provisionId,
        provisionNo: tblInvStockProvisionHeader.provisionNo,
        provisionDate: tblInvStockProvisionHeader.provisionDate,
        valuationDate: tblInvStockProvisionHeader.valuationDate,
        warehouseId: tblInvStockProvisionHeader.warehouseId,
        warehouseName: tblInvWarehouse.warehouseName,
        totalItemsEvaluated: tblInvStockProvisionHeader.totalItemsEvaluated,
        totalGrossValuation: tblInvStockProvisionHeader.totalGrossValuation,
        freshStockValue: tblInvStockProvisionHeader.freshStockValue,
        normalStockValue: tblInvStockProvisionHeader.normalStockValue,
        slowMovingValue: tblInvStockProvisionHeader.slowMovingValue,
        stagnantStockValue: tblInvStockProvisionHeader.stagnantStockValue,
        dormantStockValue: tblInvStockProvisionHeader.dormantStockValue,
        deadStockValue: tblInvStockProvisionHeader.deadStockValue,
        recommendedProvisionAmount:
          tblInvStockProvisionHeader.recommendedProvisionAmount,
        approvedProvisionAmount:
          tblInvStockProvisionHeader.approvedProvisionAmount,
        status: tblInvStockProvisionHeader.status,
        auditStandardCitation: tblInvStockProvisionHeader.auditStandardCitation,
        provisionPolicyMatrix: tblInvStockProvisionHeader.provisionPolicyMatrix,
        reviewerName: tblSecUser.fullName,
        reviewedAt: tblInvStockProvisionHeader.reviewedAt,
        remarks: tblInvStockProvisionHeader.remarks,
        createdDate: tblInvStockProvisionHeader.createdDate,
      })
      .from(tblInvStockProvisionHeader)
      .leftJoin(
        tblInvWarehouse,
        eq(tblInvStockProvisionHeader.warehouseId, tblInvWarehouse.warehouseId),
      )
      .leftJoin(
        tblSecUser,
        eq(tblInvStockProvisionHeader.reviewedBy, tblSecUser.userId),
      )
      .where(
        and(
          eq(tblInvStockProvisionHeader.provisionId, id),
          eq(tblInvStockProvisionHeader.compId, compId),
          eq(tblInvStockProvisionHeader.branchId, branchId),
        ),
      );

    if (!header) {
      throw new NotFoundException(`Stock provision review #${id} not found.`);
    }

    const items = await this.db
      .select({
        provisionItemId: tblInvStockProvisionItem.provisionItemId,
        itemId: tblInvStockProvisionItem.itemId,
        itemCode: tblInvStockProvisionItem.itemCode,
        itemName: tblInvStockProvisionItem.itemName,
        warehouseId: tblInvStockProvisionItem.warehouseId,
        binId: tblInvStockProvisionItem.binId,
        batchNo: tblInvStockProvisionItem.batchNo,
        heatNo: tblInvStockProvisionItem.heatNo,
        uomId: tblInvStockProvisionItem.uomId,
        uomCode: tblInvUom.uomCode,
        onHandQty: tblInvStockProvisionItem.onHandQty,
        unitCost: tblInvStockProvisionItem.unitCost,
        grossValuation: tblInvStockProvisionItem.grossValuation,
        firstInwardDate: tblInvStockProvisionItem.firstInwardDate,
        lastMovementDate: tblInvStockProvisionItem.lastMovementDate,
        ageInDays: tblInvStockProvisionItem.ageInDays,
        agingBracket: tblInvStockProvisionItem.agingBracket,
        fsnClassification: tblInvStockProvisionItem.fsnClassification,
        provisionRatePercent: tblInvStockProvisionItem.provisionRatePercent,
        provisionAmount: tblInvStockProvisionItem.provisionAmount,
        netRealizableValue: tblInvStockProvisionItem.netRealizableValue,
        justification: tblInvStockProvisionItem.justification,
        remarks: tblInvStockProvisionItem.remarks,
      })
      .from(tblInvStockProvisionItem)
      .leftJoin(tblInvUom, eq(tblInvStockProvisionItem.uomId, tblInvUom.uomId))
      .where(
        and(
          eq(tblInvStockProvisionItem.provisionId, id),
          eq(tblInvStockProvisionItem.isActive, true),
        ),
      )
      .orderBy(desc(tblInvStockProvisionItem.ageInDays));

    return {
      ...header,
      totalGrossValuation: parseFloat(header.totalGrossValuation || '0'),
      freshStockValue: parseFloat(header.freshStockValue || '0'),
      normalStockValue: parseFloat(header.normalStockValue || '0'),
      slowMovingValue: parseFloat(header.slowMovingValue || '0'),
      stagnantStockValue: parseFloat(header.stagnantStockValue || '0'),
      dormantStockValue: parseFloat(header.dormantStockValue || '0'),
      deadStockValue: parseFloat(header.deadStockValue || '0'),
      recommendedProvisionAmount: parseFloat(
        header.recommendedProvisionAmount || '0',
      ),
      approvedProvisionAmount: parseFloat(
        header.approvedProvisionAmount || '0',
      ),
      items: items.map((it) => ({
        ...it,
        onHandQty: parseFloat(it.onHandQty || '0'),
        unitCost: parseFloat(it.unitCost || '0'),
        grossValuation: parseFloat(it.grossValuation || '0'),
        provisionRatePercent: parseFloat(it.provisionRatePercent || '0'),
        provisionAmount: parseFloat(it.provisionAmount || '0'),
        netRealizableValue: parseFloat(it.netRealizableValue || '0'),
      })),
    };
  }

  // --------------------------------------------------------------------------
  // 8. Create New Stock Valuation Review & Provision Proposal
  // --------------------------------------------------------------------------
  async createProvisionProposal(
    user: AuthenticatedUserContext,
    dto: CreateProvisionProposalDto,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    // Document Number
    const [countRes] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(tblInvStockProvisionHeader)
      .where(
        and(
          eq(tblInvStockProvisionHeader.compId, compId),
          eq(tblInvStockProvisionHeader.branchId, branchId),
        ),
      );

    const nextSeq = (countRes?.count || 0) + 1;
    const provisionNo = `PROV-AHM-2627-${String(nextSeq).padStart(4, '0')}`;

    // Calculate totals from line items
    const items = dto.items || [];
    let totalGross = 0;
    let freshVal = 0;
    let normalVal = 0;
    let slowVal = 0;
    let stagnantVal = 0;
    let dormantVal = 0;
    let deadVal = 0;
    let recommendedProv = 0;

    items.forEach((it) => {
      totalGross += it.grossValuation;
      recommendedProv += it.provisionAmount;

      if (it.agingBracket === '0_30') freshVal += it.grossValuation;
      else if (it.agingBracket === '31_60') normalVal += it.grossValuation;
      else if (it.agingBracket === '61_90') slowVal += it.grossValuation;
      else if (it.agingBracket === '91_180') stagnantVal += it.grossValuation;
      else if (it.agingBracket === '181_365') dormantVal += it.grossValuation;
      else deadVal += it.grossValuation;
    });

    // 1. Insert Header
    const [header] = await this.db
      .insert(tblInvStockProvisionHeader)
      .values({
        provisionNo,
        provisionDate: new Date().toISOString().split('T')[0],
        valuationDate: dto.valuationDate || new Date().toISOString().split('T')[0],
        warehouseId: dto.warehouseId || null,
        categoryId: dto.categoryId || null,
        totalItemsEvaluated: items.length,
        totalGrossValuation: totalGross.toFixed(2),
        freshStockValue: freshVal.toFixed(2),
        normalStockValue: normalVal.toFixed(2),
        slowMovingValue: slowVal.toFixed(2),
        stagnantStockValue: stagnantVal.toFixed(2),
        dormantStockValue: dormantVal.toFixed(2),
        deadStockValue: deadVal.toFixed(2),
        recommendedProvisionAmount: recommendedProv.toFixed(2),
        approvedProvisionAmount: recommendedProv.toFixed(2),
        status: 'SUBMITTED',
        reviewedBy: userId,
        reviewedAt: new Date(),
        auditStandardCitation: 'Ind AS 2 (Inventories) & CARO 2020 Clause 3(ii)',
        provisionPolicyMatrix: dto.policyMatrix || {
          bracket_0_30: 0,
          bracket_31_60: 0,
          bracket_61_90: 0,
          bracket_91_180: 10,
          bracket_181_365: 30,
          bracket_gt_365: 100,
        },
        remarks:
          dto.remarks ||
          'Statutory inventory aging and dead stock valuation review.',
        compId,
        branchId,
        fyearId,
        createdBy: userId,
      })
      .returning();

    // 2. Insert Lines
    if (items.length > 0) {
      const lineValues = items.map((it) => ({
        provisionId: header.provisionId,
        itemId: it.itemId,
        warehouseId: it.warehouseId,
        binId: it.binId || null,
        batchNo: it.batchNo || null,
        heatNo: it.heatNo || null,
        itemCode: it.itemCode,
        itemName: it.itemName,
        uomId: it.uomId,
        onHandQty: it.onHandQty.toFixed(3),
        unitCost: it.unitCost.toFixed(4),
        grossValuation: it.grossValuation.toFixed(2),
        firstInwardDate: it.firstInwardDate || null,
        lastMovementDate: it.lastMovementDate || null,
        ageInDays: it.ageInDays,
        agingBracket: it.agingBracket,
        fsnClassification: it.fsnClassification,
        provisionRatePercent: it.provisionRatePercent.toFixed(2),
        provisionAmount: it.provisionAmount.toFixed(2),
        netRealizableValue: it.netRealizableValue.toFixed(2),
        justification: it.justification || 'Statutory aging provision',
        remarks: it.remarks || '',
        compId,
        branchId,
        fyearId,
        createdBy: userId,
      }));

      await this.db.insert(tblInvStockProvisionItem).values(lineValues);
    }

    // 3. Audit Log
    await this.auditLogService.logAction({
      userId,
      screenCode: 'STOCK_AGING',
      actionType: 'PROVISION',
      entityTable: 'tbl_inv_stock_provision_header',
      recordId: header.provisionId,
      newValue: { provisionNo, totalGross, recommendedProv },
      compId,
      branchId,
      fyearId,
    });

    return header;
  }

  // --------------------------------------------------------------------------
  // 9. Approve Provision Proposal (Ind AS 2 Write-Down Sign-off)
  // --------------------------------------------------------------------------
  async approveProvisionProposal(user: AuthenticatedUserContext, id: number) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;

    const [header] = await this.db
      .select()
      .from(tblInvStockProvisionHeader)
      .where(
        and(
          eq(tblInvStockProvisionHeader.provisionId, id),
          eq(tblInvStockProvisionHeader.compId, compId),
          eq(tblInvStockProvisionHeader.branchId, branchId),
        ),
      );

    if (!header) {
      throw new NotFoundException(`Provision review #${id} not found.`);
    }

    if (header.status === 'APPROVED' || header.status === 'POSTED') {
      throw new BadRequestException('Proposal is already approved or posted.');
    }

    const [updated] = await this.db
      .update(tblInvStockProvisionHeader)
      .set({
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date(),
        updatedBy: userId,
        updatedDate: new Date(),
      })
      .where(eq(tblInvStockProvisionHeader.provisionId, id))
      .returning();

    await this.auditLogService.logAction({
      userId,
      screenCode: 'STOCK_AGING',
      actionType: 'PROVISION',
      entityTable: 'tbl_inv_stock_provision_header',
      recordId: id,
      oldValue: { status: header.status },
      newValue: { status: 'APPROVED' },
      compId,
      branchId,
    });

    return updated;
  }
}
