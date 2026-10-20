import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, sql, desc, or, ilike } from 'drizzle-orm';
import { DRIZZLE_DB } from '../../../database/database.module';
import type { DrizzleDb } from '../../../database/database.module';
import { AuditLogService } from '../../../common/services/audit-log.service';
import {
  tblInvBatchMaster,
  tblInvBatchGenealogy,
  tblInvSerialMaster,
  tblInvStockLedger,
  tblInvItem,
  tblInvWarehouse,
  tblInvStorageBin,
  tblInvUom,
  tblCrmParty,
  tblInvGrnHeader,
  tblMfgWoHeader,
  tblSalesDeliveryChallanHeader,
  tblSalesInvoiceHeader,
} from '../../../database/schema/core.schema';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import type {
  CreateBatchMasterDto,
  CreateSerialMasterDto,
  CreateGenealogyLinkDto,
  TraceabilityFilterDto,
} from './traceability.dto';

@Injectable()
export class StockTraceabilityService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly auditLogService: AuditLogService,
  ) {}

  // --------------------------------------------------------------------------
  // 1. Executive Summary KPIs
  // --------------------------------------------------------------------------
  async getSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const [batchSummary] = await this.db
      .select({
        totalBatches: sql<number>`count(*)::int`,
        activeHeats: sql<number>`count(distinct ${tblInvBatchMaster.heatNo})::int`,
        quarantineCount: sql<number>`count(*) filter (where ${tblInvBatchMaster.qcStatus} IN ('QUARANTINE', 'REJECTED'))::int`,
        approvedCount: sql<number>`count(*) filter (where ${tblInvBatchMaster.qcStatus} = 'APPROVED')::int`,
      })
      .from(tblInvBatchMaster)
      .where(
        and(
          eq(tblInvBatchMaster.compId, compId),
          eq(tblInvBatchMaster.isActive, true),
        ),
      );

    const [serialSummary] = await this.db
      .select({
        totalSerials: sql<number>`count(*)::int`,
        availableSerials: sql<number>`count(*) filter (where ${tblInvSerialMaster.status} = 'AVAILABLE')::int`,
        deliveredSerials: sql<number>`count(*) filter (where ${tblInvSerialMaster.status} = 'DELIVERED')::int`,
      })
      .from(tblInvSerialMaster)
      .where(
        and(
          eq(tblInvSerialMaster.compId, compId),
          eq(tblInvSerialMaster.isActive, true),
        ),
      );

    const [genealogySummary] = await this.db
      .select({
        genealogyLinks: sql<number>`count(*)::int`,
      })
      .from(tblInvBatchGenealogy)
      .where(
        and(
          eq(tblInvBatchGenealogy.compId, compId),
          eq(tblInvBatchGenealogy.isActive, true),
        ),
      );

    return {
      totalBatches: batchSummary?.totalBatches || 0,
      activeHeats: batchSummary?.activeHeats || 0,
      quarantineCount: batchSummary?.quarantineCount || 0,
      approvedCount: batchSummary?.approvedCount || 0,
      totalSerials: serialSummary?.totalSerials || 0,
      availableSerials: serialSummary?.availableSerials || 0,
      deliveredSerials: serialSummary?.deliveredSerials || 0,
      genealogyLinks: genealogySummary?.genealogyLinks || 0,
    };
  }

  // --------------------------------------------------------------------------
  // 2. Master Lookups
  // --------------------------------------------------------------------------
  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const [items, warehouses, bins, uoms, parties, workOrders] = await Promise.all([
      this.db
        .select({
          itemId: tblInvItem.itemId,
          itemCode: tblInvItem.itemCode,
          itemName: tblInvItem.itemName,
          itemType: tblInvItem.itemType,
          uomId: tblInvItem.baseUomId,
        })
        .from(tblInvItem)
        .where(and(eq(tblInvItem.compId, compId), eq(tblInvItem.isActive, true)))
        .orderBy(tblInvItem.itemCode),

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
          binId: tblInvStorageBin.binId,
          binCode: tblInvStorageBin.binCode,
          binName: tblInvStorageBin.binName,
          warehouseId: tblInvStorageBin.warehouseId,
        })
        .from(tblInvStorageBin)
        .where(eq(tblInvStorageBin.isActive, true))
        .orderBy(tblInvStorageBin.binCode),

      this.db
        .select({
          uomId: tblInvUom.uomId,
          uomCode: tblInvUom.uomCode,
          uomName: tblInvUom.uomName,
        })
        .from(tblInvUom)
        .where(eq(tblInvUom.isActive, true)),

      this.db
        .select({
          partyId: tblCrmParty.partyId,
          partyCode: tblCrmParty.partyCode,
          partyName: tblCrmParty.partyName,
          isCustomer: tblCrmParty.isCustomer,
          isSupplier: tblCrmParty.isSupplier,
        })
        .from(tblCrmParty)
        .where(and(eq(tblCrmParty.compId, compId), eq(tblCrmParty.isActive, true)))
        .orderBy(tblCrmParty.partyName),

      this.db
        .select({
          woId: tblMfgWoHeader.woId,
          woNo: tblMfgWoHeader.woNo,
          plannedQty: tblMfgWoHeader.plannedQty,
          status: tblMfgWoHeader.status,
        })
        .from(tblMfgWoHeader)
        .where(
          and(
            eq(tblMfgWoHeader.compId, compId),
            eq(tblMfgWoHeader.isActive, true),
          ),
        )
        .orderBy(desc(tblMfgWoHeader.woNo)),
    ]);

    return {
      items,
      warehouses,
      bins,
      uoms,
      suppliers: parties.filter((p) => p.isSupplier),
      customers: parties.filter((p) => p.isCustomer),
      workOrders,
    };
  }

  // --------------------------------------------------------------------------
  // 3. Batches Listing
  // --------------------------------------------------------------------------
  async getBatches(user: AuthenticatedUserContext, filters: TraceabilityFilterDto) {
    const compId = user.compId || 1001;

    const conditions = [
      eq(tblInvBatchMaster.compId, compId),
      eq(tblInvBatchMaster.isActive, true),
    ];

    if (filters.qcStatus && filters.qcStatus !== 'ALL') {
      conditions.push(eq(tblInvBatchMaster.qcStatus, filters.qcStatus));
    }
    if (filters.itemId) {
      conditions.push(eq(tblInvBatchMaster.itemId, filters.itemId));
    }
    if (filters.supplierId) {
      conditions.push(eq(tblInvBatchMaster.supplierId, filters.supplierId));
    }
    if (filters.query) {
      const q = `%${filters.query}%`;
      conditions.push(
        or(
          ilike(tblInvBatchMaster.batchNo, q),
          ilike(tblInvBatchMaster.heatNo, q),
          ilike(tblInvBatchMaster.itemCode, q),
          ilike(tblInvBatchMaster.itemName, q),
          ilike(tblInvBatchMaster.mtcNo, q),
        )!,
      );
    }

    const rows = await this.db
      .select({
        batchId: tblInvBatchMaster.batchId,
        batchNo: tblInvBatchMaster.batchNo,
        heatNo: tblInvBatchMaster.heatNo,
        lotNo: tblInvBatchMaster.lotNo,
        itemId: tblInvBatchMaster.itemId,
        itemCode: tblInvBatchMaster.itemCode,
        itemName: tblInvBatchMaster.itemName,
        supplierId: tblInvBatchMaster.supplierId,
        supplierName: tblCrmParty.partyName,
        grnId: tblInvBatchMaster.grnId,
        workOrderId: tblInvBatchMaster.workOrderId,
        woNo: tblMfgWoHeader.woNo,
        manufactureDate: tblInvBatchMaster.manufactureDate,
        expiryDate: tblInvBatchMaster.expiryDate,
        retestDate: tblInvBatchMaster.retestDate,
        initialQty: tblInvBatchMaster.initialQty,
        currentQty: tblInvBatchMaster.currentQty,
        uomId: tblInvBatchMaster.uomId,
        uomCode: tblInvUom.uomCode,
        qcStatus: tblInvBatchMaster.qcStatus,
        mtcNo: tblInvBatchMaster.mtcNo,
        mtcDate: tblInvBatchMaster.mtcDate,
        mtcUrl: tblInvBatchMaster.mtcUrl,
        chemC: tblInvBatchMaster.chemC,
        chemMn: tblInvBatchMaster.chemMn,
        chemSi: tblInvBatchMaster.chemSi,
        chemP: tblInvBatchMaster.chemP,
        chemS: tblInvBatchMaster.chemS,
        chemCr: tblInvBatchMaster.chemCr,
        chemNi: tblInvBatchMaster.chemNi,
        chemMo: tblInvBatchMaster.chemMo,
        yieldStrengthMpa: tblInvBatchMaster.yieldStrengthMpa,
        tensileStrengthMpa: tblInvBatchMaster.tensileStrengthMpa,
        elongationPct: tblInvBatchMaster.elongationPct,
        hardnessVal: tblInvBatchMaster.hardnessVal,
        hardnessScale: tblInvBatchMaster.hardnessScale,
        impactJoules: tblInvBatchMaster.impactJoules,
        ultrasonicTestStatus: tblInvBatchMaster.ultrasonicTestStatus,
        radiographyStatus: tblInvBatchMaster.radiographyStatus,
        remarks: tblInvBatchMaster.remarks,
        createdDate: tblInvBatchMaster.createdDate,
      })
      .from(tblInvBatchMaster)
      .leftJoin(tblCrmParty, eq(tblInvBatchMaster.supplierId, tblCrmParty.partyId))
      .leftJoin(tblMfgWoHeader, eq(tblInvBatchMaster.workOrderId, tblMfgWoHeader.woId))
      .leftJoin(tblInvUom, eq(tblInvBatchMaster.uomId, tblInvUom.uomId))
      .where(and(...conditions))
      .orderBy(desc(tblInvBatchMaster.batchId))
      .limit(filters.limit || 100)
      .offset(filters.offset || 0);

    return rows;
  }

  // --------------------------------------------------------------------------
  // 4. Serials Listing
  // --------------------------------------------------------------------------
  async getSerials(user: AuthenticatedUserContext, filters: TraceabilityFilterDto) {
    const compId = user.compId || 1001;

    const conditions = [
      eq(tblInvSerialMaster.compId, compId),
      eq(tblInvSerialMaster.isActive, true),
    ];

    if (filters.serialStatus && filters.serialStatus !== 'ALL') {
      conditions.push(eq(tblInvSerialMaster.status, filters.serialStatus));
    }
    if (filters.itemId) {
      conditions.push(eq(tblInvSerialMaster.itemId, filters.itemId));
    }
    if (filters.customerId) {
      conditions.push(eq(tblInvSerialMaster.customerId, filters.customerId));
    }
    if (filters.query) {
      const q = `%${filters.query}%`;
      conditions.push(
        or(
          ilike(tblInvSerialMaster.serialNo, q),
          ilike(tblInvSerialMaster.batchNo, q),
          ilike(tblInvSerialMaster.heatNo, q),
          ilike(tblInvSerialMaster.itemCode, q),
          ilike(tblInvSerialMaster.barcode, q),
          ilike(tblInvSerialMaster.rfidTag, q),
        )!,
      );
    }

    const rows = await this.db
      .select({
        serialId: tblInvSerialMaster.serialId,
        itemId: tblInvSerialMaster.itemId,
        itemCode: tblInvSerialMaster.itemCode,
        itemName: tblInvSerialMaster.itemName,
        batchId: tblInvSerialMaster.batchId,
        batchNo: tblInvSerialMaster.batchNo,
        heatNo: tblInvSerialMaster.heatNo,
        serialNo: tblInvSerialMaster.serialNo,
        barcode: tblInvSerialMaster.barcode,
        rfidTag: tblInvSerialMaster.rfidTag,
        currentWarehouseId: tblInvSerialMaster.currentWarehouseId,
        warehouseName: tblInvWarehouse.warehouseName,
        currentBinId: tblInvSerialMaster.currentBinId,
        binCode: tblInvStorageBin.binCode,
        status: tblInvSerialMaster.status,
        grnId: tblInvSerialMaster.grnId,
        workOrderId: tblInvSerialMaster.workOrderId,
        woNo: tblMfgWoHeader.woNo,
        challanId: tblInvSerialMaster.challanId,
        challanNo: tblSalesDeliveryChallanHeader.challanNo,
        invoiceId: tblInvSerialMaster.invoiceId,
        invoiceNo: tblSalesInvoiceHeader.invoiceNo,
        customerId: tblInvSerialMaster.customerId,
        customerName: tblCrmParty.partyName,
        warrantyStartDate: tblInvSerialMaster.warrantyStartDate,
        warrantyEndDate: tblInvSerialMaster.warrantyEndDate,
        remarks: tblInvSerialMaster.remarks,
        createdDate: tblInvSerialMaster.createdDate,
      })
      .from(tblInvSerialMaster)
      .leftJoin(
        tblInvWarehouse,
        eq(tblInvSerialMaster.currentWarehouseId, tblInvWarehouse.warehouseId),
      )
      .leftJoin(
        tblInvStorageBin,
        eq(tblInvSerialMaster.currentBinId, tblInvStorageBin.binId),
      )
      .leftJoin(
        tblMfgWoHeader,
        eq(tblInvSerialMaster.workOrderId, tblMfgWoHeader.woId),
      )
      .leftJoin(
        tblSalesDeliveryChallanHeader,
        eq(
          tblInvSerialMaster.challanId,
          tblSalesDeliveryChallanHeader.challanId,
        ),
      )
      .leftJoin(
        tblSalesInvoiceHeader,
        eq(tblInvSerialMaster.invoiceId, tblSalesInvoiceHeader.invoiceId),
      )
      .leftJoin(
        tblCrmParty,
        eq(tblInvSerialMaster.customerId, tblCrmParty.partyId),
      )
      .where(and(...conditions))
      .orderBy(desc(tblInvSerialMaster.serialId))
      .limit(filters.limit || 100)
      .offset(filters.offset || 0);

    return rows;
  }

  // --------------------------------------------------------------------------
  // 5. Genealogy Links Listing
  // --------------------------------------------------------------------------
  async getGenealogyList(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const rows = await this.db
      .select({
        genealogyId: tblInvBatchGenealogy.genealogyId,
        parentBatchId: tblInvBatchGenealogy.parentBatchId,
        parentBatchNo: tblInvBatchGenealogy.parentBatchNo,
        parentItemId: tblInvBatchGenealogy.parentItemId,
        childBatchId: tblInvBatchGenealogy.childBatchId,
        childBatchNo: tblInvBatchGenealogy.childBatchNo,
        childItemId: tblInvBatchGenealogy.childItemId,
        workOrderId: tblInvBatchGenealogy.workOrderId,
        woNo: tblMfgWoHeader.woNo,
        consumedQty: tblInvBatchGenealogy.consumedQty,
        uomId: tblInvBatchGenealogy.uomId,
        uomCode: tblInvUom.uomCode,
        transformationType: tblInvBatchGenealogy.transformationType,
        linkDate: tblInvBatchGenealogy.linkDate,
        remarks: tblInvBatchGenealogy.remarks,
      })
      .from(tblInvBatchGenealogy)
      .leftJoin(
        tblMfgWoHeader,
        eq(tblInvBatchGenealogy.workOrderId, tblMfgWoHeader.woId),
      )
      .leftJoin(tblInvUom, eq(tblInvBatchGenealogy.uomId, tblInvUom.uomId))
      .where(
        and(
          eq(tblInvBatchGenealogy.compId, compId),
          eq(tblInvBatchGenealogy.isActive, true),
        ),
      )
      .orderBy(desc(tblInvBatchGenealogy.genealogyId));

    return rows;
  }

  // --------------------------------------------------------------------------
  // 6. Master 360-Degree Bi-Directional Genealogy & Traceability Explorer
  // --------------------------------------------------------------------------
  async explore360(user: AuthenticatedUserContext, rawQuery: string) {
    const compId = user.compId || 1001;
    const query = (rawQuery || '').trim();

    if (!query) {
      throw new BadRequestException('Traceability search query cannot be empty.');
    }

    // 1. Locate primary matching batch or serial
    const [matchingBatch] = await this.db
      .select({
        batchId: tblInvBatchMaster.batchId,
        batchNo: tblInvBatchMaster.batchNo,
        heatNo: tblInvBatchMaster.heatNo,
        lotNo: tblInvBatchMaster.lotNo,
        itemId: tblInvBatchMaster.itemId,
        itemCode: tblInvBatchMaster.itemCode,
        itemName: tblInvBatchMaster.itemName,
        supplierId: tblInvBatchMaster.supplierId,
        supplierName: tblCrmParty.partyName,
        supplierCode: tblCrmParty.partyCode,
        grnId: tblInvBatchMaster.grnId,
        workOrderId: tblInvBatchMaster.workOrderId,
        woNo: tblMfgWoHeader.woNo,
        manufactureDate: tblInvBatchMaster.manufactureDate,
        expiryDate: tblInvBatchMaster.expiryDate,
        retestDate: tblInvBatchMaster.retestDate,
        initialQty: tblInvBatchMaster.initialQty,
        currentQty: tblInvBatchMaster.currentQty,
        uomId: tblInvBatchMaster.uomId,
        uomCode: tblInvUom.uomCode,
        qcStatus: tblInvBatchMaster.qcStatus,
        mtcNo: tblInvBatchMaster.mtcNo,
        mtcDate: tblInvBatchMaster.mtcDate,
        mtcUrl: tblInvBatchMaster.mtcUrl,
        chemC: tblInvBatchMaster.chemC,
        chemMn: tblInvBatchMaster.chemMn,
        chemSi: tblInvBatchMaster.chemSi,
        chemP: tblInvBatchMaster.chemP,
        chemS: tblInvBatchMaster.chemS,
        chemCr: tblInvBatchMaster.chemCr,
        chemNi: tblInvBatchMaster.chemNi,
        chemMo: tblInvBatchMaster.chemMo,
        yieldStrengthMpa: tblInvBatchMaster.yieldStrengthMpa,
        tensileStrengthMpa: tblInvBatchMaster.tensileStrengthMpa,
        elongationPct: tblInvBatchMaster.elongationPct,
        hardnessVal: tblInvBatchMaster.hardnessVal,
        hardnessScale: tblInvBatchMaster.hardnessScale,
        impactJoules: tblInvBatchMaster.impactJoules,
        ultrasonicTestStatus: tblInvBatchMaster.ultrasonicTestStatus,
        radiographyStatus: tblInvBatchMaster.radiographyStatus,
        remarks: tblInvBatchMaster.remarks,
      })
      .from(tblInvBatchMaster)
      .leftJoin(tblCrmParty, eq(tblInvBatchMaster.supplierId, tblCrmParty.partyId))
      .leftJoin(tblMfgWoHeader, eq(tblInvBatchMaster.workOrderId, tblMfgWoHeader.woId))
      .leftJoin(tblInvUom, eq(tblInvBatchMaster.uomId, tblInvUom.uomId))
      .where(
        and(
          eq(tblInvBatchMaster.compId, compId),
          or(
            ilike(tblInvBatchMaster.batchNo, query),
            ilike(tblInvBatchMaster.heatNo, query),
            ilike(tblInvBatchMaster.mtcNo, query),
            ilike(tblInvBatchMaster.lotNo, query),
          )!,
        ),
      )
      .limit(1);

    // Also check serial master
    const [matchingSerial] = await this.db
      .select({
        serialId: tblInvSerialMaster.serialId,
        serialNo: tblInvSerialMaster.serialNo,
        batchId: tblInvSerialMaster.batchId,
        batchNo: tblInvSerialMaster.batchNo,
        heatNo: tblInvSerialMaster.heatNo,
        itemId: tblInvSerialMaster.itemId,
        itemCode: tblInvSerialMaster.itemCode,
        itemName: tblInvSerialMaster.itemName,
        status: tblInvSerialMaster.status,
        barcode: tblInvSerialMaster.barcode,
        rfidTag: tblInvSerialMaster.rfidTag,
        workOrderId: tblInvSerialMaster.workOrderId,
        woNo: tblMfgWoHeader.woNo,
        challanId: tblInvSerialMaster.challanId,
        challanNo: tblSalesDeliveryChallanHeader.challanNo,
        invoiceId: tblInvSerialMaster.invoiceId,
        invoiceNo: tblSalesInvoiceHeader.invoiceNo,
        customerId: tblInvSerialMaster.customerId,
        customerName: tblCrmParty.partyName,
        warehouseName: tblInvWarehouse.warehouseName,
        binCode: tblInvStorageBin.binCode,
        warrantyStartDate: tblInvSerialMaster.warrantyStartDate,
        warrantyEndDate: tblInvSerialMaster.warrantyEndDate,
      })
      .from(tblInvSerialMaster)
      .leftJoin(
        tblMfgWoHeader,
        eq(tblInvSerialMaster.workOrderId, tblMfgWoHeader.woId),
      )
      .leftJoin(
        tblSalesDeliveryChallanHeader,
        eq(
          tblInvSerialMaster.challanId,
          tblSalesDeliveryChallanHeader.challanId,
        ),
      )
      .leftJoin(
        tblSalesInvoiceHeader,
        eq(tblInvSerialMaster.invoiceId, tblSalesInvoiceHeader.invoiceId),
      )
      .leftJoin(
        tblCrmParty,
        eq(tblInvSerialMaster.customerId, tblCrmParty.partyId),
      )
      .leftJoin(
        tblInvWarehouse,
        eq(tblInvSerialMaster.currentWarehouseId, tblInvWarehouse.warehouseId),
      )
      .leftJoin(
        tblInvStorageBin,
        eq(tblInvSerialMaster.currentBinId, tblInvStorageBin.binId),
      )
      .where(
        and(
          eq(tblInvSerialMaster.compId, compId),
          or(
            ilike(tblInvSerialMaster.serialNo, query),
            ilike(tblInvSerialMaster.barcode, query),
            ilike(tblInvSerialMaster.rfidTag, query),
          )!,
        ),
      )
      .limit(1);

    const activeBatchNo =
      matchingBatch?.batchNo || matchingSerial?.batchNo || query;
    const activeHeatNo =
      matchingBatch?.heatNo || matchingSerial?.heatNo || query;

    // 2. Fetch all linked serials
    const serials = await this.db
      .select({
        serialId: tblInvSerialMaster.serialId,
        serialNo: tblInvSerialMaster.serialNo,
        barcode: tblInvSerialMaster.barcode,
        rfidTag: tblInvSerialMaster.rfidTag,
        status: tblInvSerialMaster.status,
        itemCode: tblInvSerialMaster.itemCode,
        itemName: tblInvSerialMaster.itemName,
        warehouseName: tblInvWarehouse.warehouseName,
        binCode: tblInvStorageBin.binCode,
        customerName: tblCrmParty.partyName,
        challanNo: tblSalesDeliveryChallanHeader.challanNo,
        invoiceNo: tblSalesInvoiceHeader.invoiceNo,
        warrantyStartDate: tblInvSerialMaster.warrantyStartDate,
        warrantyEndDate: tblInvSerialMaster.warrantyEndDate,
      })
      .from(tblInvSerialMaster)
      .leftJoin(
        tblInvWarehouse,
        eq(tblInvSerialMaster.currentWarehouseId, tblInvWarehouse.warehouseId),
      )
      .leftJoin(
        tblInvStorageBin,
        eq(tblInvSerialMaster.currentBinId, tblInvStorageBin.binId),
      )
      .leftJoin(
        tblCrmParty,
        eq(tblInvSerialMaster.customerId, tblCrmParty.partyId),
      )
      .leftJoin(
        tblSalesDeliveryChallanHeader,
        eq(
          tblInvSerialMaster.challanId,
          tblSalesDeliveryChallanHeader.challanId,
        ),
      )
      .leftJoin(
        tblSalesInvoiceHeader,
        eq(tblInvSerialMaster.invoiceId, tblSalesInvoiceHeader.invoiceId),
      )
      .where(
        and(
          eq(tblInvSerialMaster.compId, compId),
          or(
            ilike(tblInvSerialMaster.batchNo, activeBatchNo),
            ilike(tblInvSerialMaster.heatNo, activeHeatNo),
          )!,
        ),
      );

    // 3. Upstream & Downstream Genealogy Linkages
    const [childrenLinks, parentLinks] = await Promise.all([
      // Downstream: What was produced from this batch?
      this.db
        .select({
          genealogyId: tblInvBatchGenealogy.genealogyId,
          parentBatchNo: tblInvBatchGenealogy.parentBatchNo,
          childBatchId: tblInvBatchGenealogy.childBatchId,
          childBatchNo: tblInvBatchGenealogy.childBatchNo,
          childItemId: tblInvBatchGenealogy.childItemId,
          childItemCode: tblInvItem.itemCode,
          childItemName: tblInvItem.itemName,
          workOrderId: tblInvBatchGenealogy.workOrderId,
          woNo: tblMfgWoHeader.woNo,
          consumedQty: tblInvBatchGenealogy.consumedQty,
          transformationType: tblInvBatchGenealogy.transformationType,
          linkDate: tblInvBatchGenealogy.linkDate,
        })
        .from(tblInvBatchGenealogy)
        .leftJoin(
          tblInvItem,
          eq(tblInvBatchGenealogy.childItemId, tblInvItem.itemId),
        )
        .leftJoin(
          tblMfgWoHeader,
          eq(tblInvBatchGenealogy.workOrderId, tblMfgWoHeader.woId),
        )
        .where(
          and(
            eq(tblInvBatchGenealogy.compId, compId),
            ilike(tblInvBatchGenealogy.parentBatchNo, activeBatchNo),
          ),
        ),

      // Upstream: What parent materials were consumed to make this batch?
      this.db
        .select({
          genealogyId: tblInvBatchGenealogy.genealogyId,
          parentBatchId: tblInvBatchGenealogy.parentBatchId,
          parentBatchNo: tblInvBatchGenealogy.parentBatchNo,
          parentItemId: tblInvBatchGenealogy.parentItemId,
          parentItemCode: tblInvItem.itemCode,
          parentItemName: tblInvItem.itemName,
          childBatchNo: tblInvBatchGenealogy.childBatchNo,
          workOrderId: tblInvBatchGenealogy.workOrderId,
          woNo: tblMfgWoHeader.woNo,
          consumedQty: tblInvBatchGenealogy.consumedQty,
          transformationType: tblInvBatchGenealogy.transformationType,
          linkDate: tblInvBatchGenealogy.linkDate,
        })
        .from(tblInvBatchGenealogy)
        .leftJoin(
          tblInvItem,
          eq(tblInvBatchGenealogy.parentItemId, tblInvItem.itemId),
        )
        .leftJoin(
          tblMfgWoHeader,
          eq(tblInvBatchGenealogy.workOrderId, tblMfgWoHeader.woId),
        )
        .where(
          and(
            eq(tblInvBatchGenealogy.compId, compId),
            ilike(tblInvBatchGenealogy.childBatchNo, activeBatchNo),
          ),
        ),
    ]);

    // 4. Consolidated Stock Movements (tbl_inv_stock_ledger)
    const ledgerMovements = await this.db
      .select({
        ledgerId: tblInvStockLedger.ledgerId,
        transactionDate: tblInvStockLedger.transactionDate,
        transactionType: tblInvStockLedger.transactionType,
        referenceDocType: tblInvStockLedger.referenceDocType,
        referenceDocNo: tblInvStockLedger.referenceDocNo,
        warehouseName: tblInvWarehouse.warehouseName,
        fromBinCode: sql<string>`(select bin_code from tbl_inv_storage_bin where bin_id = ${tblInvStockLedger.fromBinId})`,
        toBinCode: sql<string>`(select bin_code from tbl_inv_storage_bin where bin_id = ${tblInvStockLedger.toBinId})`,
        itemCode: tblInvItem.itemCode,
        itemName: tblInvItem.itemName,
        uomCode: tblInvUom.uomCode,
        batchNo: tblInvStockLedger.batchNo,
        heatNo: tblInvStockLedger.heatNo,
        qtyIn: tblInvStockLedger.qtyIn,
        qtyOut: tblInvStockLedger.qtyOut,
        unitCost: tblInvStockLedger.unitCost,
        totalCost: tblInvStockLedger.totalCost,
        closingBalance: tblInvStockLedger.closingBalance,
        remarks: tblInvStockLedger.remarks,
      })
      .from(tblInvStockLedger)
      .leftJoin(
        tblInvWarehouse,
        eq(tblInvStockLedger.warehouseId, tblInvWarehouse.warehouseId),
      )
      .leftJoin(tblInvItem, eq(tblInvStockLedger.itemId, tblInvItem.itemId))
      .leftJoin(tblInvUom, eq(tblInvStockLedger.uomId, tblInvUom.uomId))
      .where(
        and(
          eq(tblInvStockLedger.compId, compId),
          or(
            ilike(tblInvStockLedger.batchNo, activeBatchNo),
            ilike(tblInvStockLedger.heatNo, activeHeatNo),
          )!,
        ),
      )
      .orderBy(desc(tblInvStockLedger.transactionDate));

    // 5. Construct Visual Interactive DAG Nodes & Edges
    const nodes: any[] = [];
    const edges: any[] = [];

    // Upstream Supplier Root
    if (matchingBatch?.supplierName) {
      nodes.push({
        id: 'node-supplier',
        label: matchingBatch.supplierName,
        sublabel: `Vendor: ${matchingBatch.supplierCode || 'SUPL-1001'}`,
        type: 'SUPPLIER',
        color: 'indigo',
        date: matchingBatch.manufactureDate,
      });
    }

    // Inward Ingot / Heat Node
    nodes.push({
      id: 'node-batch-heat',
      label: matchingBatch?.itemCode || 'Raw Material Heat',
      sublabel: `Heat #${activeHeatNo} (Batch: ${activeBatchNo})`,
      type: 'BATCH_HEAT',
      color: 'blue',
      status: matchingBatch?.qcStatus || 'APPROVED',
      isCenter: true,
      mtcNo: matchingBatch?.mtcNo,
    });

    if (matchingBatch?.supplierName) {
      edges.push({
        from: 'node-supplier',
        to: 'node-batch-heat',
        label: matchingBatch.mtcNo ? `MTC: ${matchingBatch.mtcNo}` : 'Inward GRN',
      });
    }

    // Upstream Parent Links
    parentLinks.forEach((pl, idx) => {
      const pid = `node-parent-${idx}`;
      nodes.push({
        id: pid,
        label: pl.parentItemCode || pl.parentBatchNo,
        sublabel: `Batch: ${pl.parentBatchNo} (${pl.consumedQty} consumed)`,
        type: 'PARENT_RAW_MATERIAL',
        color: 'slate',
        date: pl.linkDate,
      });
      edges.push({
        from: pid,
        to: 'node-batch-heat',
        label: pl.transformationType.replace(/_/g, ' '),
      });
    });

    // Downstream Children Links
    childrenLinks.forEach((cl, idx) => {
      const cid = `node-child-${idx}`;
      nodes.push({
        id: cid,
        label: cl.childItemCode || cl.childBatchNo,
        sublabel: `WO: ${cl.woNo || 'Production Order'} (Batch: ${cl.childBatchNo})`,
        type: 'CHILD_ASSEMBLY',
        color: 'purple',
        date: cl.linkDate,
      });
      edges.push({
        from: 'node-batch-heat',
        to: cid,
        label: `Assembled in WO`,
      });
    });

    // Downstream Serials & Delivery
    serials.forEach((s, idx) => {
      const sid = `node-serial-${idx}`;
      nodes.push({
        id: sid,
        label: `Unit S/N: ${s.serialNo}`,
        sublabel: s.customerName ? `Client: ${s.customerName}` : `Location: ${s.warehouseName || 'Stores'}`,
        type: 'SERIAL_UNIT',
        color: s.status === 'DELIVERED' ? 'emerald' : 'amber',
        status: s.status,
      });

      // Link to child batch if exists or main batch
      const sourceNodeId =
        childrenLinks.length > 0 ? `node-child-0` : 'node-batch-heat';
      edges.push({
        from: sourceNodeId,
        to: sid,
        label: s.challanNo ? `Challan: ${s.challanNo}` : 'Serialized Output',
      });
    });

    return {
      query,
      targetBatch: matchingBatch || null,
      targetSerial: matchingSerial || null,
      serials,
      genealogy: {
        upstreamParents: parentLinks,
        downstreamChildren: childrenLinks,
      },
      movementLedger: ledgerMovements,
      graph: {
        nodes,
        edges,
      },
    };
  }

  // --------------------------------------------------------------------------
  // 7. Register / Update Batch Quality Passport & MTC
  // --------------------------------------------------------------------------
  async createBatch(user: AuthenticatedUserContext, dto: CreateBatchMasterDto) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    const [created] = await this.db
      .insert(tblInvBatchMaster)
      .values({
        batchNo: dto.batchNo.trim().toUpperCase(),
        heatNo: dto.heatNo ? dto.heatNo.trim().toUpperCase() : null,
        lotNo: dto.lotNo ? dto.lotNo.trim().toUpperCase() : null,
        itemId: dto.itemId,
        itemCode: dto.itemCode,
        itemName: dto.itemName,
        supplierId: dto.supplierId || null,
        grnId: dto.grnId || null,
        workOrderId: dto.workOrderId || null,
        manufactureDate: dto.manufactureDate || null,
        expiryDate: dto.expiryDate || null,
        retestDate: dto.retestDate || null,
        initialQty: String(dto.initialQty || 0),
        currentQty: String(dto.currentQty || dto.initialQty || 0),
        uomId: dto.uomId,
        qcStatus: dto.qcStatus || 'APPROVED',
        mtcNo: dto.mtcNo || null,
        mtcDate: dto.mtcDate || null,
        mtcUrl: dto.mtcUrl || null,
        chemC: dto.chemC !== undefined ? String(dto.chemC) : null,
        chemMn: dto.chemMn !== undefined ? String(dto.chemMn) : null,
        chemSi: dto.chemSi !== undefined ? String(dto.chemSi) : null,
        chemP: dto.chemP !== undefined ? String(dto.chemP) : null,
        chemS: dto.chemS !== undefined ? String(dto.chemS) : null,
        chemCr: dto.chemCr !== undefined ? String(dto.chemCr) : null,
        chemNi: dto.chemNi !== undefined ? String(dto.chemNi) : null,
        chemMo: dto.chemMo !== undefined ? String(dto.chemMo) : null,
        yieldStrengthMpa: dto.yieldStrengthMpa !== undefined ? String(dto.yieldStrengthMpa) : null,
        tensileStrengthMpa: dto.tensileStrengthMpa !== undefined ? String(dto.tensileStrengthMpa) : null,
        elongationPct: dto.elongationPct !== undefined ? String(dto.elongationPct) : null,
        hardnessVal: dto.hardnessVal !== undefined ? String(dto.hardnessVal) : null,
        hardnessScale: dto.hardnessScale || 'BHN',
        impactJoules: dto.impactJoules !== undefined ? String(dto.impactJoules) : null,
        ultrasonicTestStatus: dto.ultrasonicTestStatus || 'PASSED',
        radiographyStatus: dto.radiographyStatus || 'NOT_APPLICABLE',
        remarks: dto.remarks || null,
        compId,
        branchId,
        fyearId,
        createdBy: userId,
      })
      .returning();

    await this.auditLogService.logAction({
      userId,
      screenCode: 'STOCK_TRACEABILITY',
      actionType: 'ADD',
      entityTable: 'tbl_inv_batch_master',
      recordId: created.batchId,
      newValue: {
        batchNo: created.batchNo,
        heatNo: created.heatNo,
        mtcNo: created.mtcNo,
      },
      compId,
      branchId,
      fyearId,
    });

    return created;
  }

  // --------------------------------------------------------------------------
  // 8. Register Serialized Unit
  // --------------------------------------------------------------------------
  async createSerial(user: AuthenticatedUserContext, dto: CreateSerialMasterDto) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    const [created] = await this.db
      .insert(tblInvSerialMaster)
      .values({
        itemId: dto.itemId,
        itemCode: dto.itemCode,
        itemName: dto.itemName,
        batchId: dto.batchId || null,
        batchNo: dto.batchNo ? dto.batchNo.trim().toUpperCase() : null,
        heatNo: dto.heatNo ? dto.heatNo.trim().toUpperCase() : null,
        serialNo: dto.serialNo.trim().toUpperCase(),
        barcode: dto.barcode || null,
        rfidTag: dto.rfidTag || null,
        currentWarehouseId: dto.currentWarehouseId || null,
        currentBinId: dto.currentBinId || null,
        status: dto.status || 'AVAILABLE',
        grnId: dto.grnId || null,
        workOrderId: dto.workOrderId || null,
        jobCardId: dto.jobCardId || null,
        challanId: dto.challanId || null,
        invoiceId: dto.invoiceId || null,
        customerId: dto.customerId || null,
        warrantyStartDate: dto.warrantyStartDate || null,
        warrantyEndDate: dto.warrantyEndDate || null,
        remarks: dto.remarks || null,
        compId,
        branchId,
        fyearId,
        createdBy: userId,
      })
      .returning();

    await this.auditLogService.logAction({
      userId,
      screenCode: 'STOCK_TRACEABILITY',
      actionType: 'ADD',
      entityTable: 'tbl_inv_serial_master',
      recordId: created.serialId,
      newValue: {
        serialNo: created.serialNo,
        itemCode: created.itemCode,
        batchNo: created.batchNo,
      },
      compId,
      branchId,
      fyearId,
    });

    return created;
  }

  // --------------------------------------------------------------------------
  // 9. Register Parent-Child Genealogy Linkage
  // --------------------------------------------------------------------------
  async createGenealogyLink(
    user: AuthenticatedUserContext,
    dto: CreateGenealogyLinkDto,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    const [created] = await this.db
      .insert(tblInvBatchGenealogy)
      .values({
        parentBatchId: dto.parentBatchId || null,
        parentBatchNo: dto.parentBatchNo.trim().toUpperCase(),
        parentItemId: dto.parentItemId,
        childBatchId: dto.childBatchId || null,
        childBatchNo: dto.childBatchNo.trim().toUpperCase(),
        childItemId: dto.childItemId,
        workOrderId: dto.workOrderId || null,
        jobCardId: dto.jobCardId || null,
        consumedQty: String(dto.consumedQty),
        uomId: dto.uomId,
        transformationType: dto.transformationType || 'WORK_ORDER_ASSEMBLY',
        remarks: dto.remarks || null,
        compId,
        branchId,
        fyearId,
        createdBy: userId,
      })
      .returning();

    await this.auditLogService.logAction({
      userId,
      screenCode: 'STOCK_TRACEABILITY',
      actionType: 'ADD',
      entityTable: 'tbl_inv_batch_genealogy',
      recordId: created.genealogyId,
      newValue: {
        parentBatchNo: created.parentBatchNo,
        childBatchNo: created.childBatchNo,
        consumedQty: created.consumedQty,
      },
      compId,
      branchId,
      fyearId,
    });

    return created;
  }
}
