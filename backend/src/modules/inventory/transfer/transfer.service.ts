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
  tblInvTransferHeader,
  tblInvTransferItem,
  tblInvBinStock,
  tblInvStockLedger,
  tblInvWarehouse,
  tblInvStorageBin,
  tblInvItem,
  tblInvUom,
  tblSecUser,
  tblOrgBranch,
} from '../../../database/schema/core.schema';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import type {
  CreateTransferHeaderDto,
  UpdateTransferHeaderDto,
  DispatchTransferDto,
  ReceiveTransferDto,
  CancelTransferDto,
  TransferFilterDto,
} from './transfer.dto';

@Injectable()
export class StockTransferService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly auditLogService: AuditLogService,
  ) {}

  async getSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const [summary] = await this.db
      .select({
        totalTransfers: sql<number>`count(*)::int`,
        draftCount: sql<number>`count(*) filter (where ${tblInvTransferHeader.status} = 'DRAFT')::int`,
        dispatchedCount: sql<number>`count(*) filter (where ${tblInvTransferHeader.status} = 'DISPATCHED')::int`,
        receivedCount: sql<number>`count(*) filter (where ${tblInvTransferHeader.status} = 'RECEIVED')::int`,
        cancelledCount: sql<number>`count(*) filter (where ${tblInvTransferHeader.status} = 'CANCELLED')::int`,
        totalTransferQty: sql<string>`coalesce(sum(${tblInvTransferHeader.totalTransferQty}::numeric), 0)`,
        totalTransferValue: sql<string>`coalesce(sum(${tblInvTransferHeader.totalTransferValue}::numeric), 0)`,
      })
      .from(tblInvTransferHeader)
      .where(
        and(
          eq(tblInvTransferHeader.compId, compId),
          eq(tblInvTransferHeader.branchId, branchId),
          eq(tblInvTransferHeader.isActive, true),
        ),
      );

    return {
      totalTransfers: Number(summary?.totalTransfers || 0),
      draftCount: Number(summary?.draftCount || 0),
      dispatchedCount: Number(summary?.dispatchedCount || 0),
      receivedCount: Number(summary?.receivedCount || 0),
      cancelledCount: Number(summary?.cancelledCount || 0),
      totalTransferQty: Number(summary?.totalTransferQty || 0),
      totalTransferValue: Number(summary?.totalTransferValue || 0),
    };
  }

  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const [warehouses, storageBins, items, uoms, branches] = await Promise.all([
      this.db
        .select({
          warehouseId: tblInvWarehouse.warehouseId,
          warehouseCode: tblInvWarehouse.warehouseCode,
          warehouseName: tblInvWarehouse.warehouseName,
          warehouseType: tblInvWarehouse.warehouseType,
          branchId: tblInvWarehouse.branchId,
        })
        .from(tblInvWarehouse)
        .where(
          and(
            eq(tblInvWarehouse.compId, compId),
            eq(tblInvWarehouse.isActive, true),
          ),
        ),
      this.db
        .select({
          binId: tblInvStorageBin.binId,
          warehouseId: tblInvStorageBin.warehouseId,
          binCode: tblInvStorageBin.binCode,
          binName: tblInvStorageBin.binName,
          binType: tblInvStorageBin.binType,
          isPickFace: tblInvStorageBin.isPickFace,
        })
        .from(tblInvStorageBin)
        .where(
          and(
            eq(tblInvStorageBin.compId, compId),
            eq(tblInvStorageBin.isActive, true),
          ),
        ),
      this.db
        .select({
          itemId: tblInvItem.itemId,
          itemCode: tblInvItem.itemCode,
          itemName: tblInvItem.itemName,
          baseUomId: tblInvItem.baseUomId,
          standardCost: tblInvItem.standardCost,
          itemType: tblInvItem.itemType,
        })
        .from(tblInvItem)
        .where(
          and(
            eq(tblInvItem.compId, compId),
            eq(tblInvItem.isActive, true),
          ),
        ),
      this.db
        .select({
          uomId: tblInvUom.uomId,
          uomCode: tblInvUom.uomCode,
          uomName: tblInvUom.uomName,
        })
        .from(tblInvUom)
        .where(
          and(
            eq(tblInvUom.compId, compId),
            eq(tblInvUom.isActive, true),
          ),
        ),
      this.db
        .select({
          branchId: tblOrgBranch.branchId,
          branchCode: tblOrgBranch.branchCode,
          branchName: tblOrgBranch.branchName,
          gstin: tblOrgBranch.gstin,
        })
        .from(tblOrgBranch)
        .where(
          and(
            eq(tblOrgBranch.compId, compId),
            eq(tblOrgBranch.isActive, true),
          ),
        ),
    ]);

    return {
      warehouses,
      storageBins,
      items,
      uoms,
      branches,
    };
  }

  async getAvailableStock(
    warehouseId: number,
    binId?: number,
    user?: AuthenticatedUserContext,
  ) {
    const compId = user?.compId || 1001;

    const conditions = [
      eq(tblInvBinStock.compId, compId),
      eq(tblInvBinStock.warehouseId, warehouseId),
      eq(tblInvBinStock.isActive, true),
      sql`${tblInvBinStock.availableQty} > 0`,
    ];

    if (binId) {
      conditions.push(eq(tblInvBinStock.binId, binId));
    }

    const rows = await this.db
      .select({
        binStockId: tblInvBinStock.binStockId,
        warehouseId: tblInvBinStock.warehouseId,
        binId: tblInvBinStock.binId,
        binCode: tblInvStorageBin.binCode,
        binName: tblInvStorageBin.binName,
        itemId: tblInvBinStock.itemId,
        itemCode: tblInvItem.itemCode,
        itemName: tblInvItem.itemName,
        uomId: tblInvBinStock.uomId,
        uomCode: tblInvUom.uomCode,
        batchNo: tblInvBinStock.batchNo,
        heatNo: tblInvBinStock.heatNo,
        onHandQty: tblInvBinStock.onHandQty,
        reservedQty: tblInvBinStock.reservedQty,
        availableQty: tblInvBinStock.availableQty,
        unitCost: tblInvBinStock.unitCost,
      })
      .from(tblInvBinStock)
      .innerJoin(tblInvItem, eq(tblInvBinStock.itemId, tblInvItem.itemId))
      .innerJoin(tblInvStorageBin, eq(tblInvBinStock.binId, tblInvStorageBin.binId))
      .innerJoin(tblInvUom, eq(tblInvBinStock.uomId, tblInvUom.uomId))
      .where(and(...conditions))
      .orderBy(tblInvItem.itemCode, tblInvStorageBin.binCode);

    return rows.map((r) => ({
      ...r,
      onHandQty: Number(r.onHandQty || 0),
      reservedQty: Number(r.reservedQty || 0),
      availableQty: Number(r.availableQty || 0),
      unitCost: Number(r.unitCost || 0),
    }));
  }

  async findAll(filter: TransferFilterDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const page = Math.max(1, Number(filter.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filter.limit) || 25));
    const offset = (page - 1) * limit;

    const conditions = [
      eq(tblInvTransferHeader.compId, compId),
      eq(tblInvTransferHeader.branchId, branchId),
      eq(tblInvTransferHeader.isActive, true),
    ];

    if (filter.status && filter.status !== 'ALL') {
      conditions.push(eq(tblInvTransferHeader.status, filter.status));
    }
    if (filter.transferType && filter.transferType !== 'ALL') {
      conditions.push(eq(tblInvTransferHeader.transferType, filter.transferType));
    }
    if (filter.fromWarehouseId) {
      conditions.push(
        eq(tblInvTransferHeader.fromWarehouseId, Number(filter.fromWarehouseId)),
      );
    }
    if (filter.toWarehouseId) {
      conditions.push(
        eq(tblInvTransferHeader.toWarehouseId, Number(filter.toWarehouseId)),
      );
    }
    if (filter.search?.trim()) {
      const term = `%${filter.search.trim()}%`;
      conditions.push(
        or(
          ilike(tblInvTransferHeader.transferNo, term),
          ilike(tblInvTransferHeader.transporterName, term),
          ilike(tblInvTransferHeader.vehicleNo, term),
          ilike(tblInvTransferHeader.lrNo, term),
          ilike(tblInvTransferHeader.ewayBillNo, term),
          ilike(tblInvTransferHeader.challanNo, term),
          ilike(tblInvTransferHeader.remarks, term),
        )!,
      );
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(tblInvTransferHeader)
      .where(whereClause);

    const total = Number(countResult?.count || 0);

    const fromWh = this.db
      .select({
        warehouseId: tblInvWarehouse.warehouseId,
        warehouseCode: tblInvWarehouse.warehouseCode,
        warehouseName: tblInvWarehouse.warehouseName,
      })
      .from(tblInvWarehouse)
      .as('from_wh');

    const toWh = this.db
      .select({
        warehouseId: tblInvWarehouse.warehouseId,
        warehouseCode: tblInvWarehouse.warehouseCode,
        warehouseName: tblInvWarehouse.warehouseName,
      })
      .from(tblInvWarehouse)
      .as('to_wh');

    const toBr = this.db
      .select({
        branchId: tblOrgBranch.branchId,
        branchCode: tblOrgBranch.branchCode,
        branchName: tblOrgBranch.branchName,
      })
      .from(tblOrgBranch)
      .as('to_br');

    const rows = await this.db
      .select({
        transferId: tblInvTransferHeader.transferId,
        transferNo: tblInvTransferHeader.transferNo,
        transferDate: tblInvTransferHeader.transferDate,
        transferType: tblInvTransferHeader.transferType,
        fromWarehouseId: tblInvTransferHeader.fromWarehouseId,
        fromWarehouseName: fromWh.warehouseName,
        fromWarehouseCode: fromWh.warehouseCode,
        toWarehouseId: tblInvTransferHeader.toWarehouseId,
        toWarehouseName: toWh.warehouseName,
        toWarehouseCode: toWh.warehouseCode,
        toBranchId: tblInvTransferHeader.toBranchId,
        toBranchName: toBr.branchName,
        toBranchCode: toBr.branchCode,
        transporterName: tblInvTransferHeader.transporterName,
        vehicleNo: tblInvTransferHeader.vehicleNo,
        lrNo: tblInvTransferHeader.lrNo,
        lrDate: tblInvTransferHeader.lrDate,
        ewayBillNo: tblInvTransferHeader.ewayBillNo,
        challanNo: tblInvTransferHeader.challanNo,
        challanDate: tblInvTransferHeader.challanDate,
        totalItems: tblInvTransferHeader.totalItems,
        totalTransferQty: tblInvTransferHeader.totalTransferQty,
        totalTransferValue: tblInvTransferHeader.totalTransferValue,
        status: tblInvTransferHeader.status,
        dispatchedAt: tblInvTransferHeader.dispatchedAt,
        receivedAt: tblInvTransferHeader.receivedAt,
        cancellationReason: tblInvTransferHeader.cancellationReason,
        remarks: tblInvTransferHeader.remarks,
        createdDate: tblInvTransferHeader.createdDate,
      })
      .from(tblInvTransferHeader)
      .leftJoin(fromWh, eq(tblInvTransferHeader.fromWarehouseId, fromWh.warehouseId))
      .leftJoin(toWh, eq(tblInvTransferHeader.toWarehouseId, toWh.warehouseId))
      .leftJoin(toBr, eq(tblInvTransferHeader.toBranchId, toBr.branchId))
      .where(whereClause)
      .orderBy(desc(tblInvTransferHeader.transferDate), desc(tblInvTransferHeader.transferId))
      .limit(limit)
      .offset(offset);

    const formattedRows = rows.map((r) => ({
      ...r,
      totalTransferQty: Number(r.totalTransferQty || 0),
      totalTransferValue: Number(r.totalTransferValue || 0),
    }));

    return {
      data: formattedRows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const [header] = await this.db
      .select({
        transferId: tblInvTransferHeader.transferId,
        transferNo: tblInvTransferHeader.transferNo,
        transferDate: tblInvTransferHeader.transferDate,
        transferType: tblInvTransferHeader.transferType,
        fromWarehouseId: tblInvTransferHeader.fromWarehouseId,
        toWarehouseId: tblInvTransferHeader.toWarehouseId,
        toBranchId: tblInvTransferHeader.toBranchId,
        transporterName: tblInvTransferHeader.transporterName,
        vehicleNo: tblInvTransferHeader.vehicleNo,
        lrNo: tblInvTransferHeader.lrNo,
        lrDate: tblInvTransferHeader.lrDate,
        ewayBillNo: tblInvTransferHeader.ewayBillNo,
        challanNo: tblInvTransferHeader.challanNo,
        challanDate: tblInvTransferHeader.challanDate,
        totalItems: tblInvTransferHeader.totalItems,
        totalTransferQty: tblInvTransferHeader.totalTransferQty,
        totalTransferValue: tblInvTransferHeader.totalTransferValue,
        status: tblInvTransferHeader.status,
        dispatchedBy: tblInvTransferHeader.dispatchedBy,
        dispatchedAt: tblInvTransferHeader.dispatchedAt,
        receivedBy: tblInvTransferHeader.receivedBy,
        receivedAt: tblInvTransferHeader.receivedAt,
        cancellationReason: tblInvTransferHeader.cancellationReason,
        remarks: tblInvTransferHeader.remarks,
        compId: tblInvTransferHeader.compId,
        branchId: tblInvTransferHeader.branchId,
        createdDate: tblInvTransferHeader.createdDate,
      })
      .from(tblInvTransferHeader)
      .where(
        and(
          eq(tblInvTransferHeader.transferId, id),
          eq(tblInvTransferHeader.compId, compId),
          eq(tblInvTransferHeader.isActive, true),
        ),
      );

    if (!header) {
      throw new NotFoundException(`Stock transfer #${id} not found`);
    }

    const [fromWh] = await this.db
      .select({
        warehouseName: tblInvWarehouse.warehouseName,
        warehouseCode: tblInvWarehouse.warehouseCode,
      })
      .from(tblInvWarehouse)
      .where(eq(tblInvWarehouse.warehouseId, header.fromWarehouseId));

    const [toWh] = await this.db
      .select({
        warehouseName: tblInvWarehouse.warehouseName,
        warehouseCode: tblInvWarehouse.warehouseCode,
      })
      .from(tblInvWarehouse)
      .where(eq(tblInvWarehouse.warehouseId, header.toWarehouseId));

    const [toBr] = await this.db
      .select({
        branchName: tblOrgBranch.branchName,
        branchCode: tblOrgBranch.branchCode,
      })
      .from(tblOrgBranch)
      .where(eq(tblOrgBranch.branchId, header.toBranchId));

    let dispatchedByName = null;
    if (header.dispatchedBy) {
      const [u] = await this.db
        .select({ fullName: tblSecUser.fullName })
        .from(tblSecUser)
        .where(eq(tblSecUser.userId, header.dispatchedBy));
      dispatchedByName = u?.fullName || null;
    }

    let receivedByName = null;
    if (header.receivedBy) {
      const [u] = await this.db
        .select({ fullName: tblSecUser.fullName })
        .from(tblSecUser)
        .where(eq(tblSecUser.userId, header.receivedBy));
      receivedByName = u?.fullName || null;
    }

    const fromBin = this.db
      .select({
        binId: tblInvStorageBin.binId,
        binCode: tblInvStorageBin.binCode,
        binName: tblInvStorageBin.binName,
      })
      .from(tblInvStorageBin)
      .as('from_bin');

    const toBin = this.db
      .select({
        binId: tblInvStorageBin.binId,
        binCode: tblInvStorageBin.binCode,
        binName: tblInvStorageBin.binName,
      })
      .from(tblInvStorageBin)
      .as('to_bin');

    const items = await this.db
      .select({
        transferItemId: tblInvTransferItem.transferItemId,
        transferId: tblInvTransferItem.transferId,
        itemSequence: tblInvTransferItem.itemSequence,
        itemId: tblInvTransferItem.itemId,
        itemCode: tblInvTransferItem.itemCode,
        itemName: tblInvTransferItem.itemName,
        uomId: tblInvTransferItem.uomId,
        uomCode: tblInvUom.uomCode,
        fromBinId: tblInvTransferItem.fromBinId,
        fromBinCode: fromBin.binCode,
        fromBinName: fromBin.binName,
        toBinId: tblInvTransferItem.toBinId,
        toBinCode: toBin.binCode,
        toBinName: toBin.binName,
        batchNo: tblInvTransferItem.batchNo,
        heatNo: tblInvTransferItem.heatNo,
        availableQty: tblInvTransferItem.availableQty,
        transferQty: tblInvTransferItem.transferQty,
        receivedQty: tblInvTransferItem.receivedQty,
        unitCost: tblInvTransferItem.unitCost,
        lineTotal: tblInvTransferItem.lineTotal,
        remarks: tblInvTransferItem.remarks,
      })
      .from(tblInvTransferItem)
      .innerJoin(tblInvUom, eq(tblInvTransferItem.uomId, tblInvUom.uomId))
      .leftJoin(fromBin, eq(tblInvTransferItem.fromBinId, fromBin.binId))
      .leftJoin(toBin, eq(tblInvTransferItem.toBinId, toBin.binId))
      .where(
        and(
          eq(tblInvTransferItem.transferId, id),
          eq(tblInvTransferItem.isActive, true),
        ),
      )
      .orderBy(tblInvTransferItem.itemSequence);

    return {
      ...header,
      fromWarehouseName: fromWh?.warehouseName || '',
      fromWarehouseCode: fromWh?.warehouseCode || '',
      toWarehouseName: toWh?.warehouseName || '',
      toWarehouseCode: toWh?.warehouseCode || '',
      toBranchName: toBr?.branchName || '',
      toBranchCode: toBr?.branchCode || '',
      dispatchedByName,
      receivedByName,
      totalTransferQty: Number(header.totalTransferQty || 0),
      totalTransferValue: Number(header.totalTransferValue || 0),
      items: items.map((it) => ({
        ...it,
        availableQty: Number(it.availableQty || 0),
        transferQty: Number(it.transferQty || 0),
        receivedQty: Number(it.receivedQty || 0),
        unitCost: Number(it.unitCost || 0),
        lineTotal: Number(it.lineTotal || 0),
      })),
    };
  }

  async create(dto: CreateTransferHeaderDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one transfer item line is required');
    }

    if (dto.fromWarehouseId === dto.toWarehouseId && dto.transferType === 'INTER_WAREHOUSE') {
      throw new BadRequestException('Source and destination warehouse cannot be the same for inter-warehouse transfer');
    }

    const prefix = dto.transferType === 'INTER_BRANCH_STO' ? 'STO' : 'ST';
    const yearStr = '2627';
    const branchCode = 'AHM';

    const [seqRow] = await this.db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(tblInvTransferHeader)
      .where(
        and(
          eq(tblInvTransferHeader.compId, compId),
          eq(tblInvTransferHeader.branchId, branchId),
        ),
      );

    const nextSeq = (Number(seqRow?.count) || 0) + 1;
    const transferNo = `${prefix}-${branchCode}-${yearStr}-${String(nextSeq).padStart(4, '0')}`;

    let totalTransferQty = 0;
    let totalTransferValue = 0;

    const itemsToInsert = dto.items.map((item, idx) => {
      const transferQty = Number(item.transferQty || 0);
      const unitCost = Number(item.unitCost || 0);
      const lineTotal = Number((transferQty * unitCost).toFixed(2));

      totalTransferQty += transferQty;
      totalTransferValue += lineTotal;

      return {
        itemSequence: idx + 1,
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        uomId: item.uomId,
        fromBinId: item.fromBinId,
        toBinId: item.toBinId,
        batchNo: item.batchNo || null,
        heatNo: item.heatNo || null,
        availableQty: String(item.availableQty || 0),
        transferQty: String(transferQty),
        receivedQty: '0.000',
        unitCost: String(unitCost),
        lineTotal: String(lineTotal),
        remarks: item.remarks || null,
        compId,
        branchId,
        fyearId,
        createdBy: user.userId,
      };
    });

    const [created] = await this.db
      .insert(tblInvTransferHeader)
      .values({
        transferNo,
        transferDate: dto.transferDate ? (dto.transferDate as any) : sql`CURRENT_DATE`,
        transferType: dto.transferType,
        fromWarehouseId: dto.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId,
        toBranchId: dto.toBranchId || branchId,
        transporterName: dto.transporterName || null,
        vehicleNo: dto.vehicleNo || null,
        lrNo: dto.lrNo || null,
        lrDate: dto.lrDate ? (dto.lrDate as any) : null,
        ewayBillNo: dto.ewayBillNo || null,
        challanNo: dto.challanNo || null,
        challanDate: dto.challanDate ? (dto.challanDate as any) : null,
        totalItems: itemsToInsert.length,
        totalTransferQty: String(totalTransferQty),
        totalTransferValue: String(totalTransferValue.toFixed(2)),
        status: 'DRAFT',
        remarks: dto.remarks || null,
        compId,
        branchId,
        fyearId,
        createdBy: user.userId,
      })
      .returning();

    for (const it of itemsToInsert) {
      await this.db.insert(tblInvTransferItem).values({
        ...it,
        transferId: created.transferId,
      });
    }

    await this.auditLogService.logAction({
      userId: user.userId,
      screenCode: 'STOCK_TRANSFER',
      actionType: 'ADD',
      entityTable: 'tbl_inv_transfer_header',
      recordId: created.transferId,
      newValue: {
        transferNo,
        transferType: dto.transferType,
        totalItems: itemsToInsert.length,
        totalTransferQty,
        totalTransferValue,
      },
      compId,
      branchId,
    });

    return this.findOne(created.transferId, user);
  }

  async update(id: number, dto: UpdateTransferHeaderDto, user: AuthenticatedUserContext) {
    const existing = await this.findOne(id, user);

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT transfers can be modified');
    }

    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    let totalTransferQty = existing.totalTransferQty;
    let totalTransferValue = existing.totalTransferValue;
    let totalItems = existing.totalItems;

    if (dto.items && dto.items.length > 0) {
      await this.db
        .delete(tblInvTransferItem)
        .where(eq(tblInvTransferItem.transferId, id));

      totalTransferQty = 0;
      totalTransferValue = 0;
      totalItems = dto.items.length;

      for (let i = 0; i < dto.items.length; i++) {
        const item = dto.items[i];
        const transferQty = Number(item.transferQty || 0);
        const unitCost = Number(item.unitCost || 0);
        const lineTotal = Number((transferQty * unitCost).toFixed(2));

        totalTransferQty += transferQty;
        totalTransferValue += lineTotal;

        await this.db.insert(tblInvTransferItem).values({
          transferId: id,
          itemSequence: i + 1,
          itemId: item.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          uomId: item.uomId,
          fromBinId: item.fromBinId,
          toBinId: item.toBinId,
          batchNo: item.batchNo || null,
          heatNo: item.heatNo || null,
          availableQty: String(item.availableQty || 0),
          transferQty: String(transferQty),
          receivedQty: '0.000',
          unitCost: String(unitCost),
          lineTotal: String(lineTotal),
          remarks: item.remarks || null,
          compId,
          branchId,
          fyearId,
          createdBy: user.userId,
        });
      }
    }

    await this.db
      .update(tblInvTransferHeader)
      .set({
        transferType: dto.transferType ?? (existing.transferType as any),
        fromWarehouseId: dto.fromWarehouseId ?? existing.fromWarehouseId,
        toWarehouseId: dto.toWarehouseId ?? existing.toWarehouseId,
        toBranchId: dto.toBranchId ?? existing.toBranchId,
        transporterName: dto.transporterName ?? existing.transporterName,
        vehicleNo: dto.vehicleNo ?? existing.vehicleNo,
        lrNo: dto.lrNo ?? existing.lrNo,
        lrDate: dto.lrDate ? (dto.lrDate as any) : (existing.lrDate as any),
        ewayBillNo: dto.ewayBillNo ?? existing.ewayBillNo,
        challanNo: dto.challanNo ?? existing.challanNo,
        challanDate: dto.challanDate ? (dto.challanDate as any) : (existing.challanDate as any),
        totalItems,
        totalTransferQty: String(totalTransferQty),
        totalTransferValue: String(totalTransferValue.toFixed(2)),
        remarks: dto.remarks ?? existing.remarks,
        updatedBy: user.userId,
        updatedDate: new Date(),
      })
      .where(eq(tblInvTransferHeader.transferId, id));

    await this.auditLogService.logAction({
      userId: user.userId,
      screenCode: 'STOCK_TRANSFER',
      actionType: 'EDIT',
      entityTable: 'tbl_inv_transfer_header',
      recordId: id,
      oldValue: {
        totalTransferQty: existing.totalTransferQty,
        totalTransferValue: existing.totalTransferValue,
      },
      newValue: {
        totalTransferQty,
        totalTransferValue,
      },
      compId,
      branchId,
    });

    return this.findOne(id, user);
  }

  async dispatch(id: number, dto: DispatchTransferDto, user: AuthenticatedUserContext) {
    const transfer = await this.findOne(id, user);

    if (transfer.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot dispatch transfer with status '${transfer.status}'`);
    }

    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    for (const item of transfer.items) {
      const transferQty = Number(item.transferQty);

      const batchCondition = item.batchNo
        ? eq(tblInvBinStock.batchNo, item.batchNo)
        : sql`${tblInvBinStock.batchNo} IS NULL`;

      const [sourceStock] = await this.db
        .select()
        .from(tblInvBinStock)
        .where(
          and(
            eq(tblInvBinStock.compId, compId),
            eq(tblInvBinStock.warehouseId, transfer.fromWarehouseId),
            eq(tblInvBinStock.binId, item.fromBinId),
            eq(tblInvBinStock.itemId, item.itemId),
            batchCondition,
          ),
        );

      if (!sourceStock || Number(sourceStock.availableQty) < transferQty) {
        throw new BadRequestException(
          `Insufficient available stock for item '${item.itemCode}' in source bin. Available: ${sourceStock ? sourceStock.availableQty : 0}, Required: ${transferQty}`,
        );
      }

      const newOnHand = Number(sourceStock.onHandQty) - transferQty;
      const newAvailable = Number(sourceStock.availableQty) - transferQty;
      const newTotalValuation = Number((newOnHand * Number(sourceStock.unitCost || 0)).toFixed(2));

      await this.db
        .update(tblInvBinStock)
        .set({
          onHandQty: String(newOnHand),
          availableQty: String(newAvailable),
          totalValuation: String(newTotalValuation),
          lastStockDate: new Date(),
          updatedBy: user.userId,
          updatedDate: new Date(),
        })
        .where(eq(tblInvBinStock.binStockId, sourceStock.binStockId));

      await this.db.insert(tblInvStockLedger).values({
        compId,
        branchId,
        fyearId,
        transactionDate: new Date(),
        transactionType: 'INTERNAL_TRANSFER',
        referenceDocType: 'TRANSFER',
        referenceDocId: transfer.transferId,
        referenceDocNo: transfer.transferNo,
        warehouseId: transfer.fromWarehouseId,
        fromBinId: item.fromBinId,
        toBinId: item.toBinId,
        itemId: item.itemId,
        uomId: item.uomId,
        batchNo: item.batchNo || null,
        heatNo: item.heatNo || null,
        qtyIn: '0.000',
        qtyOut: String(transferQty),
        unitCost: String(item.unitCost),
        totalCost: String(item.lineTotal),
        closingBalance: String(newOnHand),
        remarks: `Outward stock transfer (${transfer.transferNo}) to bin #${item.toBinId}`,
        createdBy: user.userId,
      });
    }

    await this.db
      .update(tblInvTransferHeader)
      .set({
        status: 'DISPATCHED',
        dispatchedBy: user.userId,
        dispatchedAt: new Date(),
        transporterName: dto.transporterName ?? transfer.transporterName,
        vehicleNo: dto.vehicleNo ?? transfer.vehicleNo,
        lrNo: dto.lrNo ?? transfer.lrNo,
        lrDate: dto.lrDate ? (dto.lrDate as any) : (transfer.lrDate as any),
        ewayBillNo: dto.ewayBillNo ?? transfer.ewayBillNo,
        challanNo: dto.challanNo ?? transfer.challanNo,
        challanDate: dto.challanDate ? (dto.challanDate as any) : (transfer.challanDate as any),
        remarks: dto.remarks ?? transfer.remarks,
        updatedBy: user.userId,
        updatedDate: new Date(),
      })
      .where(eq(tblInvTransferHeader.transferId, id));

    await this.auditLogService.logAction({
      userId: user.userId,
      screenCode: 'STOCK_TRANSFER',
      actionType: 'DISPATCH',
      entityTable: 'tbl_inv_transfer_header',
      recordId: id,
      newValue: {
        status: 'DISPATCHED',
        dispatchedAt: new Date().toISOString(),
        transferNo: transfer.transferNo,
      },
      compId,
      branchId,
    });

    return this.findOne(id, user);
  }

  async receive(id: number, dto: ReceiveTransferDto, user: AuthenticatedUserContext) {
    const transfer = await this.findOne(id, user);

    if (transfer.status !== 'DISPATCHED') {
      throw new BadRequestException(`Cannot receive transfer with status '${transfer.status}'. It must be DISPATCHED.`);
    }

    const compId = user.compId || 1001;
    const destBranchId = transfer.toBranchId || user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    for (const item of transfer.items) {
      const customItem = dto.items?.find((i) => i.transferItemId === item.transferItemId);
      const receivedQty = customItem?.receivedQty !== undefined ? Number(customItem.receivedQty) : Number(item.transferQty);
      const toBinId = customItem?.toBinId || item.toBinId;

      await this.db
        .update(tblInvTransferItem)
        .set({
          receivedQty: String(receivedQty),
          toBinId,
          updatedBy: user.userId,
          updatedDate: new Date(),
        })
        .where(eq(tblInvTransferItem.transferItemId, item.transferItemId));

      const batchCondition = item.batchNo
        ? eq(tblInvBinStock.batchNo, item.batchNo)
        : sql`${tblInvBinStock.batchNo} IS NULL`;

      const [destStock] = await this.db
        .select()
        .from(tblInvBinStock)
        .where(
          and(
            eq(tblInvBinStock.compId, compId),
            eq(tblInvBinStock.warehouseId, transfer.toWarehouseId),
            eq(tblInvBinStock.binId, toBinId),
            eq(tblInvBinStock.itemId, item.itemId),
            batchCondition,
          ),
        );

      let newClosingBalance = receivedQty;

      if (destStock) {
        const updatedOnHand = Number(destStock.onHandQty) + receivedQty;
        const updatedAvailable = Number(destStock.availableQty) + receivedQty;
        const updatedValuation = Number((updatedOnHand * Number(destStock.unitCost || item.unitCost)).toFixed(2));
        newClosingBalance = updatedOnHand;

        await this.db
          .update(tblInvBinStock)
          .set({
            onHandQty: String(updatedOnHand),
            availableQty: String(updatedAvailable),
            totalValuation: String(updatedValuation),
            lastStockDate: new Date(),
            updatedBy: user.userId,
            updatedDate: new Date(),
          })
          .where(eq(tblInvBinStock.binStockId, destStock.binStockId));
      } else {
        const totalValuation = Number((receivedQty * Number(item.unitCost)).toFixed(2));

        await this.db.insert(tblInvBinStock).values({
          compId,
          branchId: destBranchId,
          fyearId,
          warehouseId: transfer.toWarehouseId,
          binId: toBinId,
          itemId: item.itemId,
          uomId: item.uomId,
          batchNo: item.batchNo || null,
          heatNo: item.heatNo || null,
          onHandQty: String(receivedQty),
          reservedQty: '0.000',
          availableQty: String(receivedQty),
          unitCost: String(item.unitCost),
          totalValuation: String(totalValuation),
          lastStockDate: new Date(),
          createdBy: user.userId,
        });
      }

      await this.db.insert(tblInvStockLedger).values({
        compId,
        branchId: destBranchId,
        fyearId,
        transactionDate: new Date(),
        transactionType: 'INTERNAL_TRANSFER',
        referenceDocType: 'TRANSFER',
        referenceDocId: transfer.transferId,
        referenceDocNo: transfer.transferNo,
        warehouseId: transfer.toWarehouseId,
        fromBinId: item.fromBinId,
        toBinId,
        itemId: item.itemId,
        uomId: item.uomId,
        batchNo: item.batchNo || null,
        heatNo: item.heatNo || null,
        qtyIn: String(receivedQty),
        qtyOut: '0.000',
        unitCost: String(item.unitCost),
        totalCost: String((receivedQty * Number(item.unitCost)).toFixed(2)),
        closingBalance: String(newClosingBalance),
        remarks: `Inward stock receipt (${transfer.transferNo}) from bin #${item.fromBinId}`,
        createdBy: user.userId,
      });
    }

    await this.db
      .update(tblInvTransferHeader)
      .set({
        status: 'RECEIVED',
        receivedBy: user.userId,
        receivedAt: new Date(),
        remarks: dto.remarks ?? transfer.remarks,
        updatedBy: user.userId,
        updatedDate: new Date(),
      })
      .where(eq(tblInvTransferHeader.transferId, id));

    await this.auditLogService.logAction({
      userId: user.userId,
      screenCode: 'STOCK_TRANSFER',
      actionType: 'RECEIVE',
      entityTable: 'tbl_inv_transfer_header',
      recordId: id,
      newValue: {
        status: 'RECEIVED',
        receivedAt: new Date().toISOString(),
        transferNo: transfer.transferNo,
      },
      compId,
      branchId: destBranchId,
    });

    return this.findOne(id, user);
  }

  async directTransfer(id: number, user: AuthenticatedUserContext) {
    await this.dispatch(id, {}, user);
    return this.receive(id, {}, user);
  }

  async cancel(id: number, dto: CancelTransferDto, user: AuthenticatedUserContext) {
    if (!dto.reason?.trim()) {
      throw new BadRequestException('A mandatory cancellation reason must be provided');
    }

    const transfer = await this.findOne(id, user);

    if (transfer.status === 'CANCELLED') {
      throw new BadRequestException('Transfer voucher is already cancelled');
    }

    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    if (transfer.status === 'DISPATCHED') {
      for (const item of transfer.items) {
        const transferQty = Number(item.transferQty);

        const batchCondition = item.batchNo
          ? eq(tblInvBinStock.batchNo, item.batchNo)
          : sql`${tblInvBinStock.batchNo} IS NULL`;

        const [sourceStock] = await this.db
          .select()
          .from(tblInvBinStock)
          .where(
            and(
              eq(tblInvBinStock.compId, compId),
              eq(tblInvBinStock.warehouseId, transfer.fromWarehouseId),
              eq(tblInvBinStock.binId, item.fromBinId),
              eq(tblInvBinStock.itemId, item.itemId),
              batchCondition,
            ),
          );

        if (sourceStock) {
          const restoredOnHand = Number(sourceStock.onHandQty) + transferQty;
          const restoredAvailable = Number(sourceStock.availableQty) + transferQty;
          const restoredValuation = Number((restoredOnHand * Number(sourceStock.unitCost || 0)).toFixed(2));

          await this.db
            .update(tblInvBinStock)
            .set({
              onHandQty: String(restoredOnHand),
              availableQty: String(restoredAvailable),
              totalValuation: String(restoredValuation),
              lastStockDate: new Date(),
              updatedBy: user.userId,
              updatedDate: new Date(),
            })
            .where(eq(tblInvBinStock.binStockId, sourceStock.binStockId));

          await this.db.insert(tblInvStockLedger).values({
            compId,
            branchId,
            fyearId,
            transactionDate: new Date(),
            transactionType: 'INTERNAL_TRANSFER',
            referenceDocType: 'TRANSFER',
            referenceDocId: transfer.transferId,
            referenceDocNo: transfer.transferNo,
            warehouseId: transfer.fromWarehouseId,
            fromBinId: item.fromBinId,
            toBinId: item.toBinId,
            itemId: item.itemId,
            uomId: item.uomId,
            batchNo: item.batchNo || null,
            heatNo: item.heatNo || null,
            qtyIn: String(transferQty),
            qtyOut: '0.000',
            unitCost: String(item.unitCost),
            totalCost: String(item.lineTotal),
            closingBalance: String(restoredOnHand),
            remarks: `Reversal of dispatch upon cancellation (${transfer.transferNo})`,
            createdBy: user.userId,
          });
        }
      }
    } else if (transfer.status === 'RECEIVED') {
      for (const item of transfer.items) {
        const receivedQty = Number(item.receivedQty || item.transferQty);
        const transferQty = Number(item.transferQty);

        const batchCondition = item.batchNo
          ? eq(tblInvBinStock.batchNo, item.batchNo)
          : sql`${tblInvBinStock.batchNo} IS NULL`;

        const [destStock] = await this.db
          .select()
          .from(tblInvBinStock)
          .where(
            and(
              eq(tblInvBinStock.compId, compId),
              eq(tblInvBinStock.warehouseId, transfer.toWarehouseId),
              eq(tblInvBinStock.binId, item.toBinId),
              eq(tblInvBinStock.itemId, item.itemId),
              batchCondition,
            ),
          );

        if (destStock) {
          const reducedOnHand = Math.max(0, Number(destStock.onHandQty) - receivedQty);
          const reducedAvailable = Math.max(0, Number(destStock.availableQty) - receivedQty);
          const reducedValuation = Number((reducedOnHand * Number(destStock.unitCost || 0)).toFixed(2));

          await this.db
            .update(tblInvBinStock)
            .set({
              onHandQty: String(reducedOnHand),
              availableQty: String(reducedAvailable),
              totalValuation: String(reducedValuation),
              lastStockDate: new Date(),
              updatedBy: user.userId,
              updatedDate: new Date(),
            })
            .where(eq(tblInvBinStock.binStockId, destStock.binStockId));

          await this.db.insert(tblInvStockLedger).values({
            compId,
            branchId: transfer.toBranchId || branchId,
            fyearId,
            transactionDate: new Date(),
            transactionType: 'INTERNAL_TRANSFER',
            referenceDocType: 'TRANSFER',
            referenceDocId: transfer.transferId,
            referenceDocNo: transfer.transferNo,
            warehouseId: transfer.toWarehouseId,
            fromBinId: item.fromBinId,
            toBinId: item.toBinId,
            itemId: item.itemId,
            uomId: item.uomId,
            batchNo: item.batchNo || null,
            heatNo: item.heatNo || null,
            qtyIn: '0.000',
            qtyOut: String(receivedQty),
            unitCost: String(item.unitCost),
            totalCost: String((receivedQty * Number(item.unitCost)).toFixed(2)),
            closingBalance: String(reducedOnHand),
            remarks: `Reversal of receipt upon cancellation (${transfer.transferNo})`,
            createdBy: user.userId,
          });
        }

        const [sourceStock] = await this.db
          .select()
          .from(tblInvBinStock)
          .where(
            and(
              eq(tblInvBinStock.compId, compId),
              eq(tblInvBinStock.warehouseId, transfer.fromWarehouseId),
              eq(tblInvBinStock.binId, item.fromBinId),
              eq(tblInvBinStock.itemId, item.itemId),
              batchCondition,
            ),
          );

        if (sourceStock) {
          const restoredOnHand = Number(sourceStock.onHandQty) + transferQty;
          const restoredAvailable = Number(sourceStock.availableQty) + transferQty;
          const restoredValuation = Number((restoredOnHand * Number(sourceStock.unitCost || 0)).toFixed(2));

          await this.db
            .update(tblInvBinStock)
            .set({
              onHandQty: String(restoredOnHand),
              availableQty: String(restoredAvailable),
              totalValuation: String(restoredValuation),
              lastStockDate: new Date(),
              updatedBy: user.userId,
              updatedDate: new Date(),
            })
            .where(eq(tblInvBinStock.binStockId, sourceStock.binStockId));

          await this.db.insert(tblInvStockLedger).values({
            compId,
            branchId,
            fyearId,
            transactionDate: new Date(),
            transactionType: 'INTERNAL_TRANSFER',
            referenceDocType: 'TRANSFER',
            referenceDocId: transfer.transferId,
            referenceDocNo: transfer.transferNo,
            warehouseId: transfer.fromWarehouseId,
            fromBinId: item.fromBinId,
            toBinId: item.toBinId,
            itemId: item.itemId,
            uomId: item.uomId,
            batchNo: item.batchNo || null,
            heatNo: item.heatNo || null,
            qtyIn: String(transferQty),
            qtyOut: '0.000',
            unitCost: String(item.unitCost),
            totalCost: String(item.lineTotal),
            closingBalance: String(restoredOnHand),
            remarks: `Reversal of transfer upon cancellation (${transfer.transferNo})`,
            createdBy: user.userId,
          });
        }
      }
    }

    await this.db
      .update(tblInvTransferHeader)
      .set({
        status: 'CANCELLED',
        cancellationReason: dto.reason.trim(),
        updatedBy: user.userId,
        updatedDate: new Date(),
      })
      .where(eq(tblInvTransferHeader.transferId, id));

    await this.auditLogService.logAction({
      userId: user.userId,
      screenCode: 'STOCK_TRANSFER',
      actionType: 'CANCEL',
      entityTable: 'tbl_inv_transfer_header',
      recordId: id,
      oldValue: { status: transfer.status },
      newValue: { status: 'CANCELLED', reason: dto.reason },
      compId,
      branchId,
    });

    return this.findOne(id, user);
  }
}
