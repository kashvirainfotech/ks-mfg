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
  tblInvAdjustmentHeader,
  tblInvAdjustmentItem,
  tblInvBinStock,
  tblInvStockLedger,
  tblInvWarehouse,
  tblInvStorageBin,
  tblInvItem,
  tblInvUom,
  tblSecUser,
} from '../../../database/schema/core.schema';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import type {
  CreateAdjustmentHeaderDto,
  UpdateAdjustmentHeaderDto,
  AdjustmentFilterDto,
  CancelAdjustmentDto,
} from './adjustment.dto';

@Injectable()
export class StockAdjustmentService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly auditLogService: AuditLogService,
  ) {}


  async getSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const [summary] = await this.db
      .select({
        totalVouchers: sql<number>`count(*)::int`,
        draftCount: sql<number>`count(*) filter (where ${tblInvAdjustmentHeader.status} = 'DRAFT')::int`,
        submittedCount: sql<number>`count(*) filter (where ${tblInvAdjustmentHeader.status} = 'SUBMITTED')::int`,
        postedCount: sql<number>`count(*) filter (where ${tblInvAdjustmentHeader.status} = 'POSTED')::int`,
        totalBookValue: sql<string>`coalesce(sum(${tblInvAdjustmentHeader.totalBookValue}::numeric), 0)`,
        totalPhysicalValue: sql<string>`coalesce(sum(${tblInvAdjustmentHeader.totalPhysicalValue}::numeric), 0)`,
        netVarianceValue: sql<string>`coalesce(sum(${tblInvAdjustmentHeader.netVarianceValue}::numeric), 0)`,
      })
      .from(tblInvAdjustmentHeader)
      .where(
        and(
          eq(tblInvAdjustmentHeader.compId, compId),
          eq(tblInvAdjustmentHeader.branchId, branchId),
          eq(tblInvAdjustmentHeader.isActive, true),
        ),
      );

    return {
      totalVouchers: summary?.totalVouchers || 0,
      draftCount: summary?.draftCount || 0,
      submittedCount: summary?.submittedCount || 0,
      postedCount: summary?.postedCount || 0,
      totalBookValue: parseFloat(summary?.totalBookValue || '0'),
      totalPhysicalValue: parseFloat(summary?.totalPhysicalValue || '0'),
      netVarianceValue: parseFloat(summary?.netVarianceValue || '0'),
    };
  }

  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const warehouses = await this.db
      .select({
        warehouseId: tblInvWarehouse.warehouseId,
        warehouseCode: tblInvWarehouse.warehouseCode,
        warehouseName: tblInvWarehouse.warehouseName,
        warehouseType: tblInvWarehouse.warehouseType,
      })
      .from(tblInvWarehouse)
      .where(
        and(
          eq(tblInvWarehouse.compId, compId),
          eq(tblInvWarehouse.branchId, branchId),
          eq(tblInvWarehouse.isActive, true),
        ),
      );

    const bins = await this.db
      .select({
        binId: tblInvStorageBin.binId,
        warehouseId: tblInvStorageBin.warehouseId,
        binCode: tblInvStorageBin.binCode,
        binName: tblInvStorageBin.binName,
        binType: tblInvStorageBin.binType,
      })
      .from(tblInvStorageBin)
      .where(
        and(
          eq(tblInvStorageBin.compId, compId),
          eq(tblInvStorageBin.branchId, branchId),
          eq(tblInvStorageBin.isActive, true),
        ),
      );

    const items = await this.db
      .select({
        itemId: tblInvItem.itemId,
        itemCode: tblInvItem.itemCode,
        itemName: tblInvItem.itemName,
        uomId: tblInvItem.baseUomId,
        standardCost: tblInvItem.standardCost,
      })
      .from(tblInvItem)
      .where(
        and(
          eq(tblInvItem.compId, compId),
          eq(tblInvItem.branchId, branchId),
          eq(tblInvItem.isActive, true),
        ),
      );

    const uoms = await this.db
      .select({
        uomId: tblInvUom.uomId,
        uomCode: tblInvUom.uomCode,
        uomName: tblInvUom.uomName,
      })
      .from(tblInvUom)
      .where(eq(tblInvUom.isActive, true));

    const users = await this.db
      .select({
        userId: tblSecUser.userId,
        fullName: tblSecUser.fullName,
        username: tblSecUser.username,
      })
      .from(tblSecUser)
      .where(eq(tblSecUser.isActive, true));

    return {
      warehouses,
      bins,
      items,
      uoms,
      users,
    };
  }

  async getBookStock(
    warehouseId: number,
    binId?: number,
    user?: AuthenticatedUserContext,
  ) {
    const compId = user?.compId || 1001;
    const branchId = user?.branchId || 1001;

    const conditions = [
      eq(tblInvBinStock.compId, compId),
      eq(tblInvBinStock.branchId, branchId),
      eq(tblInvBinStock.warehouseId, warehouseId),
      eq(tblInvBinStock.isActive, true),
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
        availableQty: tblInvBinStock.availableQty,
        unitCost: tblInvBinStock.unitCost,
        totalValuation: tblInvBinStock.totalValuation,
      })
      .from(tblInvBinStock)
      .innerJoin(tblInvItem, eq(tblInvBinStock.itemId, tblInvItem.itemId))
      .innerJoin(
        tblInvStorageBin,
        eq(tblInvBinStock.binId, tblInvStorageBin.binId),
      )
      .innerJoin(tblInvUom, eq(tblInvBinStock.uomId, tblInvUom.uomId))
      .where(and(...conditions));

    return rows.map((r) => ({
      binStockId: r.binStockId,
      warehouseId: r.warehouseId,
      binId: r.binId,
      binCode: r.binCode,
      binName: r.binName,
      itemId: r.itemId,
      itemCode: r.itemCode,
      itemName: r.itemName,
      uomId: r.uomId,
      uomCode: r.uomCode,
      batchNo: r.batchNo || '',
      heatNo: r.heatNo || '',
      bookQty: parseFloat(r.onHandQty || '0'),
      physicalQty: parseFloat(r.onHandQty || '0'), // default matches book
      varianceQty: 0,
      unitCost: parseFloat(r.unitCost || '0'),
      bookValue: parseFloat(r.totalValuation || '0'),
      physicalValue: parseFloat(r.totalValuation || '0'),
      varianceValue: 0,
      varianceDirection: 'NONE',
      discrepancyReason: '',
      remarks: '',
    }));
  }

  async findAll(
    filter: AdjustmentFilterDto,
    user: AuthenticatedUserContext,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const conditions = [
      eq(tblInvAdjustmentHeader.compId, compId),
      eq(tblInvAdjustmentHeader.branchId, branchId),
      eq(tblInvAdjustmentHeader.isActive, true),
    ];

    if (filter.warehouseId) {
      conditions.push(
        eq(tblInvAdjustmentHeader.warehouseId, Number(filter.warehouseId)),
      );
    }
    if (filter.status) {
      conditions.push(eq(tblInvAdjustmentHeader.status, filter.status));
    }
    if (filter.adjustmentType) {
      conditions.push(
        eq(tblInvAdjustmentHeader.adjustmentType, filter.adjustmentType),
      );
    }
    if (filter.search) {
      conditions.push(
        or(
          ilike(tblInvAdjustmentHeader.adjustmentNo, `%${filter.search}%`),
          ilike(tblInvAdjustmentHeader.remarks, `%${filter.search}%`),
        )!,
      );
    }

    const rows = await this.db
      .select({
        adjustmentId: tblInvAdjustmentHeader.adjustmentId,
        adjustmentNo: tblInvAdjustmentHeader.adjustmentNo,
        adjustmentDate: tblInvAdjustmentHeader.adjustmentDate,
        adjustmentType: tblInvAdjustmentHeader.adjustmentType,
        warehouseId: tblInvAdjustmentHeader.warehouseId,
        warehouseCode: tblInvWarehouse.warehouseCode,
        warehouseName: tblInvWarehouse.warehouseName,
        auditedBy: tblInvAdjustmentHeader.auditedBy,
        auditorName: tblSecUser.fullName,
        auditedAt: tblInvAdjustmentHeader.auditedAt,
        approvedBy: tblInvAdjustmentHeader.approvedBy,
        approvalDate: tblInvAdjustmentHeader.approvalDate,
        totalItems: tblInvAdjustmentHeader.totalItems,
        totalBookValue: tblInvAdjustmentHeader.totalBookValue,
        totalPhysicalValue: tblInvAdjustmentHeader.totalPhysicalValue,
        netVarianceValue: tblInvAdjustmentHeader.netVarianceValue,
        status: tblInvAdjustmentHeader.status,
        cancellationReason: tblInvAdjustmentHeader.cancellationReason,
        remarks: tblInvAdjustmentHeader.remarks,
        createdDate: tblInvAdjustmentHeader.createdDate,
      })
      .from(tblInvAdjustmentHeader)
      .innerJoin(
        tblInvWarehouse,
        eq(tblInvAdjustmentHeader.warehouseId, tblInvWarehouse.warehouseId),
      )
      .leftJoin(
        tblSecUser,
        eq(tblInvAdjustmentHeader.auditedBy, tblSecUser.userId),
      )
      .where(and(...conditions))
      .orderBy(desc(tblInvAdjustmentHeader.adjustmentId));

    return rows.map((r) => ({
      ...r,
      totalBookValue: parseFloat(r.totalBookValue || '0'),
      totalPhysicalValue: parseFloat(r.totalPhysicalValue || '0'),
      netVarianceValue: parseFloat(r.netVarianceValue || '0'),
    }));
  }

  async findOne(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const [header] = await this.db
      .select({
        adjustmentId: tblInvAdjustmentHeader.adjustmentId,
        adjustmentNo: tblInvAdjustmentHeader.adjustmentNo,
        adjustmentDate: tblInvAdjustmentHeader.adjustmentDate,
        adjustmentType: tblInvAdjustmentHeader.adjustmentType,
        warehouseId: tblInvAdjustmentHeader.warehouseId,
        warehouseCode: tblInvWarehouse.warehouseCode,
        warehouseName: tblInvWarehouse.warehouseName,
        auditedBy: tblInvAdjustmentHeader.auditedBy,
        auditorName: tblSecUser.fullName,
        auditedAt: tblInvAdjustmentHeader.auditedAt,
        approvedBy: tblInvAdjustmentHeader.approvedBy,
        approvalDate: tblInvAdjustmentHeader.approvalDate,
        totalItems: tblInvAdjustmentHeader.totalItems,
        totalBookValue: tblInvAdjustmentHeader.totalBookValue,
        totalPhysicalValue: tblInvAdjustmentHeader.totalPhysicalValue,
        netVarianceValue: tblInvAdjustmentHeader.netVarianceValue,
        status: tblInvAdjustmentHeader.status,
        cancellationReason: tblInvAdjustmentHeader.cancellationReason,
        remarks: tblInvAdjustmentHeader.remarks,
        createdDate: tblInvAdjustmentHeader.createdDate,
      })
      .from(tblInvAdjustmentHeader)
      .innerJoin(
        tblInvWarehouse,
        eq(tblInvAdjustmentHeader.warehouseId, tblInvWarehouse.warehouseId),
      )
      .leftJoin(
        tblSecUser,
        eq(tblInvAdjustmentHeader.auditedBy, tblSecUser.userId),
      )
      .where(
        and(
          eq(tblInvAdjustmentHeader.adjustmentId, id),
          eq(tblInvAdjustmentHeader.compId, compId),
          eq(tblInvAdjustmentHeader.branchId, branchId),
          eq(tblInvAdjustmentHeader.isActive, true),
        ),
      );

    if (!header) {
      throw new NotFoundException(`Stock adjustment voucher #${id} not found`);
    }

    // Lookup approver name if approvedBy exists
    let approverName: string | null = null;
    if (header.approvedBy) {
      const [approver] = await this.db
        .select({ fullName: tblSecUser.fullName })
        .from(tblSecUser)
        .where(eq(tblSecUser.userId, header.approvedBy));
      approverName = approver?.fullName || null;
    }

    const items = await this.db
      .select({
        adjustmentItemId: tblInvAdjustmentItem.adjustmentItemId,
        adjustmentId: tblInvAdjustmentItem.adjustmentId,
        itemSequence: tblInvAdjustmentItem.itemSequence,
        itemId: tblInvAdjustmentItem.itemId,
        itemCode: tblInvAdjustmentItem.itemCode,
        itemName: tblInvAdjustmentItem.itemName,
        binId: tblInvAdjustmentItem.binId,
        binCode: tblInvStorageBin.binCode,
        binName: tblInvStorageBin.binName,
        uomId: tblInvAdjustmentItem.uomId,
        uomCode: tblInvUom.uomCode,
        batchNo: tblInvAdjustmentItem.batchNo,
        heatNo: tblInvAdjustmentItem.heatNo,
        bookQty: tblInvAdjustmentItem.bookQty,
        physicalQty: tblInvAdjustmentItem.physicalQty,
        varianceQty: tblInvAdjustmentItem.varianceQty,
        unitCost: tblInvAdjustmentItem.unitCost,
        bookValue: tblInvAdjustmentItem.bookValue,
        physicalValue: tblInvAdjustmentItem.physicalValue,
        varianceValue: tblInvAdjustmentItem.varianceValue,
        varianceDirection: tblInvAdjustmentItem.varianceDirection,
        discrepancyReason: tblInvAdjustmentItem.discrepancyReason,
        remarks: tblInvAdjustmentItem.remarks,
      })
      .from(tblInvAdjustmentItem)
      .innerJoin(
        tblInvStorageBin,
        eq(tblInvAdjustmentItem.binId, tblInvStorageBin.binId),
      )
      .innerJoin(tblInvUom, eq(tblInvAdjustmentItem.uomId, tblInvUom.uomId))
      .where(
        and(
          eq(tblInvAdjustmentItem.adjustmentId, id),
          eq(tblInvAdjustmentItem.isActive, true),
        ),
      )
      .orderBy(tblInvAdjustmentItem.itemSequence);

    return {
      ...header,
      approverName,
      totalBookValue: parseFloat(header.totalBookValue || '0'),
      totalPhysicalValue: parseFloat(header.totalPhysicalValue || '0'),
      netVarianceValue: parseFloat(header.netVarianceValue || '0'),
      items: items.map((it) => ({
        ...it,
        bookQty: parseFloat(it.bookQty || '0'),
        physicalQty: parseFloat(it.physicalQty || '0'),
        varianceQty: parseFloat(it.varianceQty || '0'),
        unitCost: parseFloat(it.unitCost || '0'),
        bookValue: parseFloat(it.bookValue || '0'),
        physicalValue: parseFloat(it.physicalValue || '0'),
        varianceValue: parseFloat(it.varianceValue || '0'),
      })),
    };
  }

  async create(
    dto: CreateAdjustmentHeaderDto,
    user: AuthenticatedUserContext,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const createdBy = user.userId;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item must be included in stock adjustment');
    }

    // Auto-generate adjustment number
    const [countRes] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(tblInvAdjustmentHeader)
      .where(
        and(
          eq(tblInvAdjustmentHeader.compId, compId),
          eq(tblInvAdjustmentHeader.branchId, branchId),
        ),
      );
    const nextSeq = (countRes?.count || 0) + 1;
    const adjustmentNo = `SA-AHM-2627-${String(nextSeq).padStart(4, '0')}`;

    let totalBookValue = 0;
    let totalPhysicalValue = 0;

    const processedItems = dto.items.map((item, idx) => {
      const bookQty = Number(item.bookQty || 0);
      const physicalQty = Number(item.physicalQty || 0);
      const varianceQty = physicalQty - bookQty;
      const unitCost = Number(item.unitCost || 0);

      const bookVal = Math.round(bookQty * unitCost * 100) / 100;
      const physVal = Math.round(physicalQty * unitCost * 100) / 100;
      const varVal = Math.round(varianceQty * unitCost * 100) / 100;

      totalBookValue += bookVal;
      totalPhysicalValue += physVal;

      let varianceDirection = 'NONE';
      if (varianceQty > 0) varianceDirection = 'SURPLUS_GAIN';
      else if (varianceQty < 0) varianceDirection = 'DEFICIT_LOSS';

      return {
        itemSequence: idx + 1,
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        binId: item.binId,
        uomId: item.uomId,
        batchNo: item.batchNo || null,
        heatNo: item.heatNo || null,
        bookQty: bookQty.toFixed(3),
        physicalQty: physicalQty.toFixed(3),
        varianceQty: varianceQty.toFixed(3),
        unitCost: unitCost.toFixed(4),
        bookValue: bookVal.toFixed(2),
        physicalValue: physVal.toFixed(2),
        varianceValue: varVal.toFixed(2),
        varianceDirection,
        discrepancyReason: item.discrepancyReason || null,
        remarks: item.remarks || null,
        compId,
        branchId,
        fyearId,
        createdBy,
      };
    });

    const netVarianceValue = totalPhysicalValue - totalBookValue;

    const [header] = await this.db
      .insert(tblInvAdjustmentHeader)
      .values({
        adjustmentNo,
        adjustmentDate: dto.adjustmentDate || sql`CURRENT_DATE`,
        adjustmentType: dto.adjustmentType,
        warehouseId: dto.warehouseId,
        auditedBy: dto.auditedBy || createdBy,
        auditedAt: dto.auditedAt ? new Date(dto.auditedAt) : new Date(),
        totalItems: processedItems.length,
        totalBookValue: totalBookValue.toFixed(2),
        totalPhysicalValue: totalPhysicalValue.toFixed(2),
        netVarianceValue: netVarianceValue.toFixed(2),
        status: 'DRAFT',
        remarks: dto.remarks || null,
        compId,
        branchId,
        fyearId,
        createdBy,
      })
      .returning();

    for (const item of processedItems) {
      await this.db.insert(tblInvAdjustmentItem).values({
        ...item,
        adjustmentId: header.adjustmentId,
      });
    }

    await this.auditLogService.logAction({
      userId: user.userId,
      screenCode: 'STOCK_ADJUSTMENT',
      actionType: 'ADD',
      entityTable: 'tbl_inv_adjustment_header',
      recordId: header.adjustmentId,
      oldValue: null,
      newValue: header,
      compId,
      branchId,
    });

    return this.findOne(header.adjustmentId, user);
  }

  async update(
    id: number,
    dto: UpdateAdjustmentHeaderDto,
    user: AuthenticatedUserContext,
  ) {
    const existing = await this.findOne(id, user);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        `Cannot edit stock adjustment with status ${existing.status}`,
      );
    }

    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;

    let totalBookValue = existing.totalBookValue;
    let totalPhysicalValue = existing.totalPhysicalValue;

    if (dto.items && dto.items.length > 0) {
      // Re-calculate
      totalBookValue = 0;
      totalPhysicalValue = 0;

      // Delete old items
      await this.db
        .delete(tblInvAdjustmentItem)
        .where(eq(tblInvAdjustmentItem.adjustmentId, id));

      const processedItems = dto.items.map((item, idx) => {
        const bookQty = Number(item.bookQty || 0);
        const physicalQty = Number(item.physicalQty || 0);
        const varianceQty = physicalQty - bookQty;
        const unitCost = Number(item.unitCost || 0);

        const bookVal = Math.round(bookQty * unitCost * 100) / 100;
        const physVal = Math.round(physicalQty * unitCost * 100) / 100;
        const varVal = Math.round(varianceQty * unitCost * 100) / 100;

        totalBookValue += bookVal;
        totalPhysicalValue += physVal;

        let varianceDirection = 'NONE';
        if (varianceQty > 0) varianceDirection = 'SURPLUS_GAIN';
        else if (varianceQty < 0) varianceDirection = 'DEFICIT_LOSS';

        return {
          adjustmentId: id,
          itemSequence: idx + 1,
          itemId: item.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          binId: item.binId,
          uomId: item.uomId,
          batchNo: item.batchNo || null,
          heatNo: item.heatNo || null,
          bookQty: bookQty.toFixed(3),
          physicalQty: physicalQty.toFixed(3),
          varianceQty: varianceQty.toFixed(3),
          unitCost: unitCost.toFixed(4),
          bookValue: bookVal.toFixed(2),
          physicalValue: physVal.toFixed(2),
          varianceValue: varVal.toFixed(2),
          varianceDirection,
          discrepancyReason: item.discrepancyReason || null,
          remarks: item.remarks || null,
          compId,
          branchId,
          fyearId,
          createdBy: user.userId,
        };
      });

      for (const item of processedItems) {
        await this.db.insert(tblInvAdjustmentItem).values(item);
      }
    }

    const netVarianceValue = totalPhysicalValue - totalBookValue;

    await this.db
      .update(tblInvAdjustmentHeader)
      .set({
        adjustmentDate: dto.adjustmentDate || existing.adjustmentDate,
        adjustmentType: dto.adjustmentType || existing.adjustmentType,
        warehouseId: dto.warehouseId || existing.warehouseId,
        remarks: dto.remarks !== undefined ? dto.remarks : existing.remarks,
        totalItems: dto.items ? dto.items.length : existing.totalItems,
        totalBookValue: totalBookValue.toFixed(2),
        totalPhysicalValue: totalPhysicalValue.toFixed(2),
        netVarianceValue: netVarianceValue.toFixed(2),
        updatedBy: user.userId,
        updatedDate: new Date(),
      })
      .where(eq(tblInvAdjustmentHeader.adjustmentId, id));

    await this.auditLogService.logAction({
      userId: user.userId,
      screenCode: 'STOCK_ADJUSTMENT',
      actionType: 'EDIT',
      entityTable: 'tbl_inv_adjustment_header',
      recordId: id,
      oldValue: existing,
      newValue: dto,
      compId,
      branchId,
    });

    return this.findOne(id, user);
  }

  async submit(id: number, user: AuthenticatedUserContext) {
    const existing = await this.findOne(id, user);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        `Cannot submit voucher in ${existing.status} status`,
      );
    }

    await this.db
      .update(tblInvAdjustmentHeader)
      .set({
        status: 'SUBMITTED',
        auditedBy: user.userId,
        auditedAt: new Date(),
        updatedBy: user.userId,
        updatedDate: new Date(),
      })
      .where(eq(tblInvAdjustmentHeader.adjustmentId, id));

    await this.auditLogService.logAction({
      userId: user.userId,
      screenCode: 'STOCK_ADJUSTMENT',
      actionType: 'SUBMIT',
      entityTable: 'tbl_inv_adjustment_header',
      recordId: id,
      oldValue: { status: 'DRAFT' },
      newValue: { status: 'SUBMITTED' },
      compId: user.compId || 1001,
      branchId: user.branchId || 1001,
    });

    return this.findOne(id, user);
  }

  async approve(id: number, user: AuthenticatedUserContext) {
    const adjustment = await this.findOne(id, user);
    if (adjustment.status !== 'SUBMITTED' && adjustment.status !== 'DRAFT') {
      throw new BadRequestException(
        `Cannot approve stock adjustment with status ${adjustment.status}`,
      );
    }

    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId;

    // Process each item and synchronize bin stock & stock ledger
    for (const item of adjustment.items) {
      const varianceQty = item.varianceQty;
      if (Math.abs(varianceQty) < 0.0001) {
        continue;
      }

      // Check if bin stock record exists
      const binStockConditions = [
        eq(tblInvBinStock.compId, compId),
        eq(tblInvBinStock.branchId, branchId),
        eq(tblInvBinStock.warehouseId, adjustment.warehouseId),
        eq(tblInvBinStock.binId, item.binId),
        eq(tblInvBinStock.itemId, item.itemId),
      ];
      if (item.batchNo) {
        binStockConditions.push(eq(tblInvBinStock.batchNo, item.batchNo));
      }

      const [existingStock] = await this.db
        .select()
        .from(tblInvBinStock)
        .where(and(...binStockConditions));

      let newOnHand = 0;
      let newAvailable = 0;

      if (varianceQty > 0) {
        // Surplus Gain: Stock Increase
        if (existingStock) {
          newOnHand = parseFloat(existingStock.onHandQty || '0') + varianceQty;
          newAvailable =
            parseFloat(existingStock.availableQty || '0') + varianceQty;
          const newValuation = Math.round(newOnHand * item.unitCost * 100) / 100;

          await this.db
            .update(tblInvBinStock)
            .set({
              onHandQty: newOnHand.toFixed(3),
              availableQty: newAvailable.toFixed(3),
              totalValuation: newValuation.toFixed(2),
              lastStockDate: new Date(),
              updatedBy: userId,
              updatedDate: new Date(),
            })
            .where(eq(tblInvBinStock.binStockId, existingStock.binStockId));
        } else {
          newOnHand = varianceQty;
          newAvailable = varianceQty;
          const newValuation =
            Math.round(varianceQty * item.unitCost * 100) / 100;

          await this.db.insert(tblInvBinStock).values({
            compId,
            branchId,
            fyearId,
            warehouseId: adjustment.warehouseId,
            binId: item.binId,
            itemId: item.itemId,
            uomId: item.uomId,
            batchNo: item.batchNo || null,
            heatNo: item.heatNo || null,
            onHandQty: newOnHand.toFixed(3),
            reservedQty: '0.000',
            availableQty: newAvailable.toFixed(3),
            unitCost: item.unitCost.toFixed(4),
            totalValuation: newValuation.toFixed(2),
            lastStockDate: new Date(),
            createdBy: userId,
          });
        }

        // Double-entry stock ledger transaction (qty_in = varianceQty)
        await this.db.insert(tblInvStockLedger).values({
          compId,
          branchId,
          fyearId,
          transactionDate: new Date(),
          transactionType: 'ADJUSTMENT',
          referenceDocType: 'ADJUSTMENT',
          referenceDocId: adjustment.adjustmentId,
          referenceDocNo: adjustment.adjustmentNo,
          warehouseId: adjustment.warehouseId,
          toBinId: item.binId,
          itemId: item.itemId,
          uomId: item.uomId,
          batchNo: item.batchNo || null,
          heatNo: item.heatNo || null,
          qtyIn: varianceQty.toFixed(3),
          qtyOut: '0.000',
          unitCost: item.unitCost.toFixed(4),
          totalCost: (varianceQty * item.unitCost).toFixed(2),
          closingBalance: newOnHand.toFixed(3),
          remarks: `Physical stock surplus gain adjustment (+${varianceQty}) - ${item.discrepancyReason || 'Audit variance'}`,
          createdBy: userId,
        });
      } else {
        // Deficit Loss / Write-Off: Stock Decrease
        const deficitQty = Math.abs(varianceQty);
        if (existingStock) {
          newOnHand = Math.max(
            0,
            parseFloat(existingStock.onHandQty || '0') - deficitQty,
          );
          newAvailable = Math.max(
            0,
            parseFloat(existingStock.availableQty || '0') - deficitQty,
          );
          const newValuation = Math.round(newOnHand * item.unitCost * 100) / 100;

          await this.db
            .update(tblInvBinStock)
            .set({
              onHandQty: newOnHand.toFixed(3),
              availableQty: newAvailable.toFixed(3),
              totalValuation: newValuation.toFixed(2),
              lastStockDate: new Date(),
              updatedBy: userId,
              updatedDate: new Date(),
            })
            .where(eq(tblInvBinStock.binStockId, existingStock.binStockId));
        }

        // Double-entry stock ledger transaction (qty_out = deficitQty)
        await this.db.insert(tblInvStockLedger).values({
          compId,
          branchId,
          fyearId,
          transactionDate: new Date(),
          transactionType: 'ADJUSTMENT',
          referenceDocType: 'ADJUSTMENT',
          referenceDocId: adjustment.adjustmentId,
          referenceDocNo: adjustment.adjustmentNo,
          warehouseId: adjustment.warehouseId,
          fromBinId: item.binId,
          itemId: item.itemId,
          uomId: item.uomId,
          batchNo: item.batchNo || null,
          heatNo: item.heatNo || null,
          qtyIn: '0.000',
          qtyOut: deficitQty.toFixed(3),
          unitCost: item.unitCost.toFixed(4),
          totalCost: (deficitQty * item.unitCost).toFixed(2),
          closingBalance: newOnHand.toFixed(3),
          remarks: `Physical stock deficit write-off adjustment (-${deficitQty}) - ${item.discrepancyReason || 'Audit variance'}`,
          createdBy: userId,
        });
      }
    }

    // Update Header Status to POSTED
    await this.db
      .update(tblInvAdjustmentHeader)
      .set({
        status: 'POSTED',
        approvedBy: userId,
        approvalDate: new Date(),
        updatedBy: userId,
        updatedDate: new Date(),
      })
      .where(eq(tblInvAdjustmentHeader.adjustmentId, id));

    await this.auditLogService.logAction({
      userId,
      screenCode: 'STOCK_ADJUSTMENT',
      actionType: 'APPROVE',
      entityTable: 'tbl_inv_adjustment_header',
      recordId: id,
      oldValue: { status: adjustment.status },
      newValue: { status: 'POSTED', approvedBy: userId },
      compId,
      branchId,
    });

    return this.findOne(id, user);
  }

  async cancel(
    id: number,
    dto: CancelAdjustmentDto,
    user: AuthenticatedUserContext,
  ) {
    const adjustment = await this.findOne(id, user);
    if (adjustment.status === 'CANCELLED') {
      throw new BadRequestException('Voucher is already cancelled');
    }

    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId;

    // If it was POSTED, revert stock balances & post reversing ledger records
    if (adjustment.status === 'POSTED') {
      for (const item of adjustment.items) {
        const varianceQty = item.varianceQty;
        if (Math.abs(varianceQty) < 0.0001) continue;

        const binStockConditions = [
          eq(tblInvBinStock.compId, compId),
          eq(tblInvBinStock.branchId, branchId),
          eq(tblInvBinStock.warehouseId, adjustment.warehouseId),
          eq(tblInvBinStock.binId, item.binId),
          eq(tblInvBinStock.itemId, item.itemId),
        ];
        if (item.batchNo) {
          binStockConditions.push(eq(tblInvBinStock.batchNo, item.batchNo));
        }

        const [existingStock] = await this.db
          .select()
          .from(tblInvBinStock)
          .where(and(...binStockConditions));

        if (existingStock) {
          // Invert: if was surplus (+), subtract; if was deficit (-), add back
          const revertedOnHand = Math.max(
            0,
            parseFloat(existingStock.onHandQty || '0') - varianceQty,
          );
          const revertedAvailable = Math.max(
            0,
            parseFloat(existingStock.availableQty || '0') - varianceQty,
          );
          const newValuation =
            Math.round(revertedOnHand * item.unitCost * 100) / 100;

          await this.db
            .update(tblInvBinStock)
            .set({
              onHandQty: revertedOnHand.toFixed(3),
              availableQty: revertedAvailable.toFixed(3),
              totalValuation: newValuation.toFixed(2),
              lastStockDate: new Date(),
              updatedBy: userId,
              updatedDate: new Date(),
            })
            .where(eq(tblInvBinStock.binStockId, existingStock.binStockId));

          // Post reversing ledger transaction
          if (varianceQty > 0) {
            await this.db.insert(tblInvStockLedger).values({
              compId,
              branchId,
              fyearId,
              transactionDate: new Date(),
              transactionType: 'ADJUSTMENT',
              referenceDocType: 'ADJUSTMENT',
              referenceDocId: adjustment.adjustmentId,
              referenceDocNo: adjustment.adjustmentNo,
              warehouseId: adjustment.warehouseId,
              fromBinId: item.binId,
              itemId: item.itemId,
              uomId: item.uomId,
              batchNo: item.batchNo || null,
              heatNo: item.heatNo || null,
              qtyIn: '0.000',
              qtyOut: varianceQty.toFixed(3),
              unitCost: item.unitCost.toFixed(4),
              totalCost: (varianceQty * item.unitCost).toFixed(2),
              closingBalance: revertedOnHand.toFixed(3),
              remarks: `REVERSAL of surplus adjustment due to voucher cancellation #${adjustment.adjustmentNo}`,
              createdBy: userId,
            });
          } else {
            const deficitQty = Math.abs(varianceQty);
            await this.db.insert(tblInvStockLedger).values({
              compId,
              branchId,
              fyearId,
              transactionDate: new Date(),
              transactionType: 'ADJUSTMENT',
              referenceDocType: 'ADJUSTMENT',
              referenceDocId: adjustment.adjustmentId,
              referenceDocNo: adjustment.adjustmentNo,
              warehouseId: adjustment.warehouseId,
              toBinId: item.binId,
              itemId: item.itemId,
              uomId: item.uomId,
              batchNo: item.batchNo || null,
              heatNo: item.heatNo || null,
              qtyIn: deficitQty.toFixed(3),
              qtyOut: '0.000',
              unitCost: item.unitCost.toFixed(4),
              totalCost: (deficitQty * item.unitCost).toFixed(2),
              closingBalance: revertedOnHand.toFixed(3),
              remarks: `REVERSAL of deficit write-off due to voucher cancellation #${adjustment.adjustmentNo}`,
              createdBy: userId,
            });
          }
        }
      }
    }

    await this.db
      .update(tblInvAdjustmentHeader)
      .set({
        status: 'CANCELLED',
        cancellationReason: dto.cancellationReason || 'Cancelled by manager',
        updatedBy: userId,
        updatedDate: new Date(),
      })
      .where(eq(tblInvAdjustmentHeader.adjustmentId, id));

    await this.auditLogService.logAction({
      userId,
      screenCode: 'STOCK_ADJUSTMENT',
      actionType: 'CANCEL',
      entityTable: 'tbl_inv_adjustment_header',
      recordId: id,
      oldValue: { status: adjustment.status },
      newValue: { status: 'CANCELLED', reason: dto.cancellationReason },
      compId,
      branchId,
    });

    return this.findOne(id, user);
  }
}
