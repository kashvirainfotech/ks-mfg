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
import {
  BulkGenerateStorageBinsDto,
  CreateStorageBinDto,
  CreateWarehouseDto,
  UpdateStorageBinDto,
  UpdateWarehouseDto,
} from './warehouse.dto';

export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

@Injectable()
export class WarehouseService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  // ==========================================================================
  // TAB 1: PLANT WAREHOUSES & STORES (tbl_inv_warehouse)
  // ==========================================================================

  async findAllWarehouses(filters?: {
    targetCompId?: number;
    targetBranchId?: number;
    warehouseType?: string;
  }) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.targetCompId) {
      params.push(Number(filters.targetCompId));
      conditions.push(`w.target_comp_id = $${params.length}`);
    }
    if (filters?.targetBranchId) {
      params.push(Number(filters.targetBranchId));
      conditions.push(`w.target_branch_id = $${params.length}`);
    }
    if (filters?.warehouseType) {
      params.push(filters.warehouseType);
      conditions.push(`w.warehouse_type = $${params.length}`);
    }

    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `
      SELECT
        w.warehouse_id          AS "warehouseId",
        w.warehouse_code        AS "warehouseCode",
        w.warehouse_name        AS "warehouseName",
        w.warehouse_type        AS "warehouseType",
        w.target_comp_id        AS "targetCompId",
        c.comp_code             AS "targetCompCode",
        c.comp_name             AS "targetCompName",
        w.target_branch_id      AS "targetBranchId",
        b.branch_code           AS "targetBranchCode",
        b.branch_name           AS "targetBranchName",
        w.incharge_employee_id  AS "inchargeEmployeeId",
        e.emp_code              AS "inchargeEmpCode",
        e.full_name             AS "inchargeFullName",
        w.allow_negative_stock  AS "allowNegativeStock",
        w.is_qc_hold_store      AS "isQcHoldStore",
        w.is_shopfloor_wip      AS "isShopfloorWip",
        w.storage_temp_min_c    AS "storageTempMinC",
        w.storage_temp_max_c    AS "storageTempMaxC",
        w.address_location      AS "addressLocation",
        w.is_default            AS "isDefault",
        w.is_active             AS "isActive",
        w.created_date          AS "createdDate",
        w.updated_date          AS "updatedDate",
        COALESCE(bin_stats.total_bins, 0)::int          AS "totalBinsCount",
        COALESCE(bin_stats.active_bins, 0)::int         AS "activeBinsCount",
        COALESCE(bin_stats.distinct_zones, 0)::int      AS "distinctZonesCount",
        COALESCE(bin_stats.total_max_weight_kg, 0)::numeric(14,2) AS "totalMaxWeightKg"
      FROM tbl_inv_warehouse w
      INNER JOIN tbl_org_company c ON c.comp_id = w.target_comp_id
      INNER JOIN tbl_org_branch b ON b.branch_id = w.target_branch_id
      LEFT JOIN tbl_hr_employee e ON e.employee_id = w.incharge_employee_id
      LEFT JOIN (
        SELECT
          warehouse_id,
          COUNT(*)::int AS total_bins,
          COUNT(*) FILTER (WHERE is_active = TRUE)::int AS active_bins,
          COUNT(DISTINCT zone_code)::int AS distinct_zones,
          SUM(max_weight_kg) AS total_max_weight_kg
        FROM tbl_inv_storage_bin
        GROUP BY warehouse_id
      ) bin_stats ON bin_stats.warehouse_id = w.warehouse_id
      ${whereSql}
      ORDER BY
        w.target_comp_id ASC,
        w.target_branch_id ASC,
        w.is_default DESC,
        w.warehouse_code ASC
      `,
      params,
    );

    return rows.map((r) => ({
      warehouseId: Number(r.warehouseId),
      warehouseCode: r.warehouseCode,
      warehouseName: r.warehouseName,
      warehouseType: r.warehouseType,
      targetCompId: Number(r.targetCompId),
      targetCompCode: r.targetCompCode,
      targetCompName: r.targetCompName,
      targetBranchId: Number(r.targetBranchId),
      targetBranchCode: r.targetBranchCode,
      targetBranchName: r.targetBranchName,
      inchargeEmployeeId: r.inchargeEmployeeId
        ? Number(r.inchargeEmployeeId)
        : null,
      inchargeEmpCode: r.inchargeEmpCode || null,
      inchargeFullName: r.inchargeFullName || null,
      allowNegativeStock: Boolean(r.allowNegativeStock),
      isQcHoldStore: Boolean(r.isQcHoldStore),
      isShopfloorWip: Boolean(r.isShopfloorWip),
      storageTempMinC:
        r.storageTempMinC !== null ? Number(r.storageTempMinC) : null,
      storageTempMaxC:
        r.storageTempMaxC !== null ? Number(r.storageTempMaxC) : null,
      addressLocation: r.addressLocation || null,
      isDefault: Boolean(r.isDefault),
      isActive: Boolean(r.isActive),
      totalBinsCount: Number(r.totalBinsCount) || 0,
      activeBinsCount: Number(r.activeBinsCount) || 0,
      distinctZonesCount: Number(r.distinctZonesCount) || 0,
      totalMaxWeightKg: Number(r.totalMaxWeightKg) || 0,
      createdDate: r.createdDate,
      updatedDate: r.updatedDate,
    }));
  }

  async findWarehouseById(warehouseId: number) {
    const all = await this.findAllWarehouses();
    const found = all.find((w) => w.warehouseId === warehouseId);
    if (!found) {
      throw new NotFoundException(`Warehouse #${warehouseId} was not found.`);
    }
    return found;
  }

  async createWarehouse(
    dto: CreateWarehouseDto,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const warehouseCode = (dto.warehouseCode || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '-');
    const warehouseName = (dto.warehouseName || '').trim();

    if (!warehouseCode || !warehouseName) {
      throw new BadRequestException(
        'Both warehouseCode and warehouseName are required.',
      );
    }

    const dupCheck = await this.pool.query(
      `
      SELECT warehouse_id
      FROM tbl_inv_warehouse
      WHERE target_comp_id = $1
        AND target_branch_id = $2
        AND warehouse_code = $3
      LIMIT 1
      `,
      [dto.targetCompId, dto.targetBranchId, warehouseCode],
    );

    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(
        `Warehouse code "${warehouseCode}" already exists in this Plant/Branch.`,
      );
    }

    const client = await this.pool.connect();
    let createdWarehouseId = 0;

    try {
      await client.query('BEGIN');

      if (dto.isDefault) {
        await client.query(
          `
          UPDATE tbl_inv_warehouse
          SET is_default = FALSE, updated_by = $1, updated_date = CURRENT_TIMESTAMP
          WHERE target_comp_id = $2
            AND target_branch_id = $3
            AND warehouse_type = $4
          `,
          [
            user.userId,
            dto.targetCompId,
            dto.targetBranchId,
            dto.warehouseType || 'RAW_MATERIAL',
          ],
        );
      }

      const { rows } = await client.query(
        `
        INSERT INTO tbl_inv_warehouse (
          warehouse_code, warehouse_name, warehouse_type,
          target_comp_id, target_branch_id, incharge_employee_id,
          allow_negative_stock, is_qc_hold_store, is_shopfloor_wip,
          storage_temp_min_c, storage_temp_max_c, address_location,
          is_default, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6,
          $7, $8, $9,
          $10, $11, $12,
          $13, $14,
          $15, $16, $17, $18
        )
        RETURNING warehouse_id AS "warehouseId"
        `,
        [
          warehouseCode,
          warehouseName,
          dto.warehouseType || 'RAW_MATERIAL',
          dto.targetCompId,
          dto.targetBranchId,
          dto.inchargeEmployeeId || null,
          dto.allowNegativeStock ?? false,
          dto.isQcHoldStore ?? dto.warehouseType === 'QUARANTINE_QC',
          dto.isShopfloorWip ?? dto.warehouseType === 'WIP_SHOPFLOOR',
          dto.storageTempMinC ?? null,
          dto.storageTempMaxC ?? null,
          dto.addressLocation?.trim() || null,
          dto.isDefault ?? false,
          dto.isActive ?? true,
          dto.targetCompId,
          dto.targetBranchId,
          user.fyearId,
          user.userId,
        ],
      );

      createdWarehouseId = Number(rows[0].warehouseId);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const created = await this.findWarehouseById(createdWarehouseId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'WAREHOUSE_MASTER',
      actionType: 'ADD',
      entityTable: 'tbl_inv_warehouse',
      recordId: created.warehouseId,
      oldValue: null,
      newValue: created as unknown as Record<string, unknown>,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return created;
  }

  async updateWarehouse(
    warehouseId: number,
    dto: UpdateWarehouseDto,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const existing = await this.findWarehouseById(warehouseId);

    const nextCode = (dto.warehouseCode ?? existing.warehouseCode)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '-');
    const nextCompId = dto.targetCompId ?? existing.targetCompId;
    const nextBranchId = dto.targetBranchId ?? existing.targetBranchId;
    const nextType = dto.warehouseType ?? existing.warehouseType;

    const dupCheck = await this.pool.query(
      `
      SELECT warehouse_id
      FROM tbl_inv_warehouse
      WHERE target_comp_id = $1
        AND target_branch_id = $2
        AND warehouse_code = $3
        AND warehouse_id <> $4
      LIMIT 1
      `,
      [nextCompId, nextBranchId, nextCode, warehouseId],
    );

    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(
        `Another warehouse with code "${nextCode}" already exists in this Plant/Branch.`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const nextIsDefault = dto.isDefault ?? existing.isDefault;
      if (nextIsDefault) {
        await client.query(
          `
          UPDATE tbl_inv_warehouse
          SET is_default = FALSE, updated_by = $1, updated_date = CURRENT_TIMESTAMP
          WHERE target_comp_id = $2
            AND target_branch_id = $3
            AND warehouse_type = $4
            AND warehouse_id <> $5
          `,
          [user.userId, nextCompId, nextBranchId, nextType, warehouseId],
        );
      }

      await client.query(
        `
        UPDATE tbl_inv_warehouse
        SET
          warehouse_code        = $1,
          warehouse_name        = $2,
          warehouse_type        = $3,
          target_comp_id        = $4,
          target_branch_id      = $5,
          incharge_employee_id  = $6,
          allow_negative_stock  = $7,
          is_qc_hold_store      = $8,
          is_shopfloor_wip      = $9,
          storage_temp_min_c    = $10,
          storage_temp_max_c    = $11,
          address_location      = $12,
          is_default            = $13,
          is_active             = $14,
          updated_by            = $15,
          updated_date          = CURRENT_TIMESTAMP
        WHERE warehouse_id = $16
        `,
        [
          nextCode,
          (dto.warehouseName ?? existing.warehouseName).trim(),
          nextType,
          nextCompId,
          nextBranchId,
          dto.inchargeEmployeeId !== undefined
            ? dto.inchargeEmployeeId || null
            : existing.inchargeEmployeeId,
          dto.allowNegativeStock ?? existing.allowNegativeStock,
          dto.isQcHoldStore ?? existing.isQcHoldStore,
          dto.isShopfloorWip ?? existing.isShopfloorWip,
          dto.storageTempMinC !== undefined
            ? dto.storageTempMinC
            : existing.storageTempMinC,
          dto.storageTempMaxC !== undefined
            ? dto.storageTempMaxC
            : existing.storageTempMaxC,
          dto.addressLocation !== undefined
            ? dto.addressLocation?.trim() || null
            : existing.addressLocation,
          nextIsDefault,
          dto.isActive ?? existing.isActive,
          user.userId,
          warehouseId,
        ],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const updated = await this.findWarehouseById(warehouseId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'WAREHOUSE_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_inv_warehouse',
      recordId: warehouseId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: updated as unknown as Record<string, unknown>,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return updated;
  }

  async deleteWarehouse(
    warehouseId: number,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const existing = await this.findWarehouseById(warehouseId);

    await this.dependencyCheckService.verifyCanDelete({
      entity: 'Warehouse',
      entityId: warehouseId,
      relations: [
        {
          table: 'tbl_inv_storage_bin',
          column: 'warehouse_id',
          label: 'Storage Bins Mapped to Warehouse',
        },
      ],
    });

    await this.pool.query(
      `DELETE FROM tbl_inv_warehouse WHERE warehouse_id = $1`,
      [warehouseId],
    );

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'WAREHOUSE_MASTER',
      actionType: 'DELETE',
      entityTable: 'tbl_inv_warehouse',
      recordId: warehouseId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: null,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return { deleted: true, warehouseId };
  }

  // ==========================================================================
  // TAB 2: MULTI-LEVEL STORAGE BINS (tbl_inv_storage_bin)
  // ==========================================================================

  async findAllStorageBins(filters?: {
    warehouseId?: number;
    targetCompId?: number;
    targetBranchId?: number;
    zoneCode?: string;
    binType?: string;
  }) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.warehouseId) {
      params.push(Number(filters.warehouseId));
      conditions.push(`sb.warehouse_id = $${params.length}`);
    }
    if (filters?.targetCompId) {
      params.push(Number(filters.targetCompId));
      conditions.push(`w.target_comp_id = $${params.length}`);
    }
    if (filters?.targetBranchId) {
      params.push(Number(filters.targetBranchId));
      conditions.push(`w.target_branch_id = $${params.length}`);
    }
    if (filters?.zoneCode) {
      params.push(filters.zoneCode);
      conditions.push(`sb.zone_code = $${params.length}`);
    }
    if (filters?.binType) {
      params.push(filters.binType);
      conditions.push(`sb.bin_type = $${params.length}`);
    }

    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `
      SELECT
        sb.bin_id                 AS "binId",
        sb.warehouse_id           AS "warehouseId",
        w.warehouse_code          AS "warehouseCode",
        w.warehouse_name          AS "warehouseName",
        w.warehouse_type          AS "warehouseType",
        w.target_comp_id          AS "targetCompId",
        c.comp_code               AS "targetCompCode",
        w.target_branch_id        AS "targetBranchId",
        b.branch_code             AS "targetBranchCode",
        b.branch_name             AS "targetBranchName",
        sb.bin_code               AS "binCode",
        sb.bin_name               AS "binName",
        sb.zone_code              AS "zoneCode",
        sb.rack_code              AS "rackCode",
        sb.shelf_level            AS "shelfLevel",
        sb.bin_position           AS "binPosition",
        sb.bin_type               AS "binType",
        sb.max_weight_kg          AS "maxWeightKg",
        sb.max_volume_cbm         AS "maxVolumeCbm",
        sb.allow_mixed_items      AS "allowMixedItems",
        sb.allow_mixed_batches    AS "allowMixedBatches",
        sb.is_pick_face           AS "isPickFace",
        sb.is_receiving_staging   AS "isReceivingStaging",
        sb.is_blocked_for_putaway AS "isBlockedForPutaway",
        sb.is_active              AS "isActive",
        sb.created_date           AS "createdDate",
        sb.updated_date           AS "updatedDate"
      FROM tbl_inv_storage_bin sb
      INNER JOIN tbl_inv_warehouse w ON w.warehouse_id = sb.warehouse_id
      INNER JOIN tbl_org_company c ON c.comp_id = w.target_comp_id
      INNER JOIN tbl_org_branch b ON b.branch_id = w.target_branch_id
      ${whereSql}
      ORDER BY
        w.warehouse_code ASC,
        sb.zone_code ASC,
        sb.rack_code ASC,
        sb.shelf_level ASC,
        sb.bin_position ASC,
        sb.bin_code ASC
      `,
      params,
    );

    return rows.map((r) => ({
      binId: Number(r.binId),
      warehouseId: Number(r.warehouseId),
      warehouseCode: r.warehouseCode,
      warehouseName: r.warehouseName,
      warehouseType: r.warehouseType,
      targetCompId: Number(r.targetCompId),
      targetCompCode: r.targetCompCode,
      targetBranchId: Number(r.targetBranchId),
      targetBranchCode: r.targetBranchCode,
      targetBranchName: r.targetBranchName,
      binCode: r.binCode,
      binName: r.binName,
      zoneCode: r.zoneCode,
      rackCode: r.rackCode,
      shelfLevel: r.shelfLevel,
      binPosition: r.binPosition,
      binType: r.binType,
      maxWeightKg: Number(r.maxWeightKg) || 0,
      maxVolumeCbm: r.maxVolumeCbm !== null ? Number(r.maxVolumeCbm) : null,
      allowMixedItems: Boolean(r.allowMixedItems),
      allowMixedBatches: Boolean(r.allowMixedBatches),
      isPickFace: Boolean(r.isPickFace),
      isReceivingStaging: Boolean(r.isReceivingStaging),
      isBlockedForPutaway: Boolean(r.isBlockedForPutaway),
      isActive: Boolean(r.isActive),
      hierarchyPath: `${r.warehouseCode} ▸ ${r.zoneCode} ▸ ${r.rackCode} ▸ ${r.shelfLevel} ▸ ${r.binPosition}`,
      createdDate: r.createdDate,
      updatedDate: r.updatedDate,
    }));
  }

  async findStorageBinById(binId: number) {
    const all = await this.findAllStorageBins();
    const found = all.find((b) => b.binId === binId);
    if (!found) {
      throw new NotFoundException(`Storage Bin #${binId} was not found.`);
    }
    return found;
  }

  async createStorageBin(
    dto: CreateStorageBinDto,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const warehouse = await this.findWarehouseById(Number(dto.warehouseId));

    const binCode = (dto.binCode || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '-');
    const binName = (dto.binName || '').trim();
    const zoneCode = (dto.zoneCode || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '-');
    const rackCode = (dto.rackCode || 'R01').trim().toUpperCase();
    const shelfLevel = (dto.shelfLevel || 'S01').trim().toUpperCase();
    const binPosition = (dto.binPosition || 'B01').trim().toUpperCase();

    if (!binCode || !binName || !zoneCode) {
      throw new BadRequestException(
        'binCode, binName, and zoneCode are required.',
      );
    }

    const dupCheck = await this.pool.query(
      `
      SELECT bin_id
      FROM tbl_inv_storage_bin
      WHERE warehouse_id = $1
        AND bin_code = $2
      LIMIT 1
      `,
      [warehouse.warehouseId, binCode],
    );

    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(
        `Storage bin code "${binCode}" already exists inside warehouse "${warehouse.warehouseCode}".`,
      );
    }

    const { rows } = await this.pool.query(
      `
      INSERT INTO tbl_inv_storage_bin (
        warehouse_id, bin_code, bin_name,
        zone_code, rack_code, shelf_level, bin_position, bin_type,
        max_weight_kg, max_volume_cbm,
        allow_mixed_items, allow_mixed_batches,
        is_pick_face, is_receiving_staging, is_blocked_for_putaway, is_active,
        comp_id, branch_id, fyear_id, created_by
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6, $7, $8,
        $9, $10,
        $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20
      )
      RETURNING bin_id AS "binId"
      `,
      [
        warehouse.warehouseId,
        binCode,
        binName,
        zoneCode,
        rackCode,
        shelfLevel,
        binPosition,
        dto.binType || 'PALLET_RACK',
        Math.max(1, Number(dto.maxWeightKg) || 1000),
        dto.maxVolumeCbm ?? null,
        dto.allowMixedItems ?? true,
        dto.allowMixedBatches ?? false,
        dto.isPickFace ?? true,
        dto.isReceivingStaging ?? false,
        dto.isBlockedForPutaway ?? false,
        dto.isActive ?? true,
        warehouse.targetCompId,
        warehouse.targetBranchId,
        user.fyearId,
        user.userId,
      ],
    );

    const created = await this.findStorageBinById(Number(rows[0].binId));

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'WAREHOUSE_MASTER',
      actionType: 'ADD',
      entityTable: 'tbl_inv_storage_bin',
      recordId: created.binId,
      oldValue: null,
      newValue: created as unknown as Record<string, unknown>,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return created;
  }

  async bulkGenerateStorageBins(
    dto: BulkGenerateStorageBinsDto,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const warehouse = await this.findWarehouseById(Number(dto.warehouseId));
    const zoneCode = (dto.zoneCode || 'Z1')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '-');
    const binPrefix = (dto.binPrefix || warehouse.warehouseCode)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '-');
    const rackPrefix = (dto.rackPrefix || 'R').trim().toUpperCase();

    const rStart = Math.max(1, Number(dto.rackStart) || 1);
    const rEnd = Math.max(rStart, Math.min(rStart + 20, Number(dto.rackEnd) || 1));
    const sStart = Math.max(1, Number(dto.shelfStart) || 1);
    const sEnd = Math.max(sStart, Math.min(sStart + 10, Number(dto.shelfEnd) || 1));
    const pStart = Math.max(1, Number(dto.positionStart) || 1);
    const pEnd = Math.max(
      pStart,
      Math.min(pStart + 20, Number(dto.positionEnd) || 1),
    );

    const totalToGenerate =
      (rEnd - rStart + 1) * (sEnd - sStart + 1) * (pEnd - pStart + 1);
    if (totalToGenerate > 100) {
      throw new BadRequestException(
        `Bulk generator is capped at 100 storage bins per batch (requested: ${totalToGenerate}).`,
      );
    }

    const client = await this.pool.connect();
    let insertedCount = 0;

    try {
      await client.query('BEGIN');

      for (let r = rStart; r <= rEnd; r++) {
        const rackCode = `${rackPrefix}${String(r).padStart(2, '0')}`;
        for (let s = sStart; s <= sEnd; s++) {
          const shelfLevel = `S${String(s).padStart(2, '0')}`;
          for (let p = pStart; p <= pEnd; p++) {
            const binPosition = `B${String(p).padStart(2, '0')}`;
            const binCode = `${binPrefix}-${rackCode}-${shelfLevel}-${binPosition}`;
            const binName = `${zoneCode} • Rack ${rackCode} Shelf ${shelfLevel} Bin ${binPosition}`;

            const res = await client.query(
              `
              INSERT INTO tbl_inv_storage_bin (
                warehouse_id, bin_code, bin_name,
                zone_code, rack_code, shelf_level, bin_position, bin_type,
                max_weight_kg, max_volume_cbm,
                allow_mixed_items, allow_mixed_batches,
                is_pick_face, is_receiving_staging, is_blocked_for_putaway, is_active,
                comp_id, branch_id, fyear_id, created_by
              ) VALUES (
                $1, $2, $3,
                $4, $5, $6, $7, $8,
                $9, $10,
                $11, $12,
                TRUE, FALSE, FALSE, TRUE,
                $13, $14, $15, $16
              )
              ON CONFLICT (warehouse_id, bin_code) DO NOTHING
              `,
              [
                warehouse.warehouseId,
                binCode,
                binName,
                zoneCode,
                rackCode,
                shelfLevel,
                binPosition,
                dto.binType || 'PALLET_RACK',
                Math.max(1, Number(dto.maxWeightKg) || 1000),
                dto.maxVolumeCbm ?? null,
                dto.allowMixedItems ?? true,
                dto.allowMixedBatches ?? false,
                warehouse.targetCompId,
                warehouse.targetBranchId,
                user.fyearId,
                user.userId,
              ],
            );
            insertedCount += res.rowCount ?? 0;
          }
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'WAREHOUSE_MASTER',
      actionType: 'ADD',
      entityTable: 'tbl_inv_storage_bin',
      recordId: warehouse.warehouseId,
      oldValue: null,
      newValue: {
        bulkGenerated: true,
        warehouseCode: warehouse.warehouseCode,
        zoneCode,
        insertedCount,
        totalRequested: totalToGenerate,
      },
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return {
      warehouseId: warehouse.warehouseId,
      warehouseCode: warehouse.warehouseCode,
      insertedCount,
      totalRequested: totalToGenerate,
    };
  }

  async updateStorageBin(
    binId: number,
    dto: UpdateStorageBinDto,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const existing = await this.findStorageBinById(binId);

    const nextWarehouseId = dto.warehouseId
      ? Number(dto.warehouseId)
      : existing.warehouseId;
    const nextBinCode = (dto.binCode ?? existing.binCode)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '-');
    const nextZoneCode = (dto.zoneCode ?? existing.zoneCode)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '-');
    const nextRackCode = (dto.rackCode ?? existing.rackCode)
      .trim()
      .toUpperCase();
    const nextShelfLevel = (dto.shelfLevel ?? existing.shelfLevel)
      .trim()
      .toUpperCase();
    const nextBinPosition = (dto.binPosition ?? existing.binPosition)
      .trim()
      .toUpperCase();

    const dupCheck = await this.pool.query(
      `
      SELECT bin_id
      FROM tbl_inv_storage_bin
      WHERE warehouse_id = $1
        AND bin_code = $2
        AND bin_id <> $3
      LIMIT 1
      `,
      [nextWarehouseId, nextBinCode, binId],
    );

    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(
        `Another storage bin with code "${nextBinCode}" already exists inside this warehouse.`,
      );
    }

    await this.pool.query(
      `
      UPDATE tbl_inv_storage_bin
      SET
        warehouse_id           = $1,
        bin_code               = $2,
        bin_name               = $3,
        zone_code              = $4,
        rack_code              = $5,
        shelf_level            = $6,
        bin_position           = $7,
        bin_type               = $8,
        max_weight_kg          = $9,
        max_volume_cbm         = $10,
        allow_mixed_items      = $11,
        allow_mixed_batches    = $12,
        is_pick_face           = $13,
        is_receiving_staging   = $14,
        is_blocked_for_putaway = $15,
        is_active              = $16,
        updated_by             = $17,
        updated_date           = CURRENT_TIMESTAMP
      WHERE bin_id = $18
      `,
      [
        nextWarehouseId,
        nextBinCode,
        (dto.binName ?? existing.binName).trim(),
        nextZoneCode,
        nextRackCode,
        nextShelfLevel,
        nextBinPosition,
        dto.binType ?? existing.binType,
        Math.max(1, Number(dto.maxWeightKg ?? existing.maxWeightKg) || 1000),
        dto.maxVolumeCbm !== undefined
          ? dto.maxVolumeCbm
          : existing.maxVolumeCbm,
        dto.allowMixedItems ?? existing.allowMixedItems,
        dto.allowMixedBatches ?? existing.allowMixedBatches,
        dto.isPickFace ?? existing.isPickFace,
        dto.isReceivingStaging ?? existing.isReceivingStaging,
        dto.isBlockedForPutaway ?? existing.isBlockedForPutaway,
        dto.isActive ?? existing.isActive,
        user.userId,
        binId,
      ],
    );

    const updated = await this.findStorageBinById(binId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'WAREHOUSE_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_inv_storage_bin',
      recordId: binId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: updated as unknown as Record<string, unknown>,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return updated;
  }

  async deleteStorageBin(
    binId: number,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const existing = await this.findStorageBinById(binId);

    await this.pool.query(
      `DELETE FROM tbl_inv_storage_bin WHERE bin_id = $1`,
      [binId],
    );

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'WAREHOUSE_MASTER',
      actionType: 'DELETE',
      entityTable: 'tbl_inv_storage_bin',
      recordId: binId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: null,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return { deleted: true, binId };
  }

  async recordScreenAction(
    actionType: 'PRINT' | 'EXPORT',
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'WAREHOUSE_MASTER',
      actionType,
      entityTable: 'tbl_inv_warehouse',
      recordId: 0,
      oldValue: null,
      newValue: { actionType, screenCode: 'WAREHOUSE_MASTER' },
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });
    return { logged: true };
  }
}
