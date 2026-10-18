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
  CreateItemCategoryDto,
  CreateUomConversionDto,
  CreateUomDto,
  UpdateItemCategoryDto,
  UpdateUomConversionDto,
  UpdateUomDto,
} from './uom.dto';

export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

@Injectable()
export class UomService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  // ==========================================================================
  // TAB 1: UNITS OF MEASUREMENT (tbl_inv_uom)
  // ==========================================================================

  async findAllUoms(filters?: { uomType?: string; isActive?: boolean }) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.uomType) {
      params.push(filters.uomType);
      conditions.push(`u.uom_type = $${params.length}`);
    }
    if (filters?.isActive !== undefined) {
      params.push(filters.isActive);
      conditions.push(`u.is_active = $${params.length}`);
    }

    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `
      SELECT
        u.uom_id            AS "uomId",
        u.uom_code          AS "uomCode",
        u.uom_name          AS "uomName",
        u.uom_type          AS "uomType",
        u.decimal_precision AS "decimalPrecision",
        u.gst_uqc_code      AS "gstUqcCode",
        u.is_base_uom       AS "isBaseUom",
        u.is_active         AS "isActive",
        u.created_date      AS "createdDate",
        u.updated_date      AS "updatedDate",
        COALESCE(conv_stats.conversions_count, 0)::int AS "conversionsCount"
      FROM tbl_inv_uom u
      LEFT JOIN (
        SELECT
          from_uom_id AS uom_id,
          COUNT(*)::int AS conversions_count
        FROM tbl_inv_uom_conversion
        GROUP BY from_uom_id
      ) conv_stats ON conv_stats.uom_id = u.uom_id
      ${whereSql}
      ORDER BY
        u.uom_type ASC,
        u.is_base_uom DESC,
        u.uom_code ASC
      `,
      params,
    );

    return rows.map((r) => ({
      uomId: Number(r.uomId),
      uomCode: r.uomCode,
      uomName: r.uomName,
      uomType: r.uomType,
      decimalPrecision: Number(r.decimalPrecision) || 0,
      gstUqcCode: r.gstUqcCode,
      isBaseUom: Boolean(r.isBaseUom),
      isActive: Boolean(r.isActive),
      conversionsCount: Number(r.conversionsCount) || 0,
      createdDate: r.createdDate,
      updatedDate: r.updatedDate,
    }));
  }

  async findUomById(uomId: number) {
    const all = await this.findAllUoms();
    const found = all.find((u) => u.uomId === uomId);
    if (!found) {
      throw new NotFoundException(`Unit of Measurement #${uomId} was not found.`);
    }
    return found;
  }

  async createUom(
    dto: CreateUomDto,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const uomCode = (dto.uomCode || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');
    const uomName = (dto.uomName || '').trim();
    const gstUqcCode = (dto.gstUqcCode || uomCode)
      .trim()
      .toUpperCase()
      .slice(0, 10);

    if (!uomCode || !uomName) {
      throw new BadRequestException('Both uomCode and uomName are required.');
    }

    const dupCheck = await this.pool.query(
      `SELECT uom_id FROM tbl_inv_uom WHERE uom_code = $1 LIMIT 1`,
      [uomCode],
    );

    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(
        `Unit of measurement with code "${uomCode}" already exists.`,
      );
    }

    const client = await this.pool.connect();
    let createdUomId = 0;

    try {
      await client.query('BEGIN');

      const isBase = Boolean(dto.isBaseUom);
      const uomType = dto.uomType || 'COUNT';

      if (isBase) {
        // Unmark other base UOMs of the same physical type
        await client.query(
          `
          UPDATE tbl_inv_uom
          SET is_base_uom = FALSE, updated_by = $1, updated_date = CURRENT_TIMESTAMP
          WHERE uom_type = $2 AND is_base_uom = TRUE
          `,
          [user.userId, uomType],
        );
      }

      const { rows } = await client.query(
        `
        INSERT INTO tbl_inv_uom (
          uom_code, uom_name, uom_type, decimal_precision, gst_uqc_code,
          is_base_uom, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7,
          $8, $9, $10, $11
        )
        RETURNING uom_id AS "uomId"
        `,
        [
          uomCode,
          uomName,
          uomType,
          dto.decimalPrecision ?? 0,
          gstUqcCode,
          isBase,
          dto.isActive ?? true,
          user.compId,
          user.branchId,
          user.fyearId,
          user.userId,
        ],
      );

      createdUomId = Number(rows[0].uomId);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const created = await this.findUomById(createdUomId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'UOM_MASTER',
      actionType: 'ADD',
      entityTable: 'tbl_inv_uom',
      recordId: created.uomId,
      oldValue: null,
      newValue: created as unknown as Record<string, unknown>,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return created;
  }

  async updateUom(
    uomId: number,
    dto: UpdateUomDto,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const existing = await this.findUomById(uomId);

    const nextCode = (dto.uomCode ?? existing.uomCode)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '');
    const nextType = dto.uomType ?? existing.uomType;
    const nextPrecision = dto.decimalPrecision ?? existing.decimalPrecision;
    const nextGstCode = (dto.gstUqcCode ?? existing.gstUqcCode)
      .trim()
      .toUpperCase();

    const dupCheck = await this.pool.query(
      `SELECT uom_id FROM tbl_inv_uom WHERE uom_code = $1 AND uom_id <> $2 LIMIT 1`,
      [nextCode, uomId],
    );

    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(
        `Another unit of measurement with code "${nextCode}" already exists.`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const nextIsBase = dto.isBaseUom ?? existing.isBaseUom;
      if (nextIsBase) {
        await client.query(
          `
          UPDATE tbl_inv_uom
          SET is_base_uom = FALSE, updated_by = $1, updated_date = CURRENT_TIMESTAMP
          WHERE uom_type = $2 AND is_base_uom = TRUE AND uom_id <> $3
          `,
          [user.userId, nextType, uomId],
        );
      }

      await client.query(
        `
        UPDATE tbl_inv_uom
        SET
          uom_code          = $1,
          uom_name          = $2,
          uom_type          = $3,
          decimal_precision = $4,
          gst_uqc_code      = $5,
          is_base_uom       = $6,
          is_active         = $7,
          updated_by        = $8,
          updated_date      = CURRENT_TIMESTAMP
        WHERE uom_id = $9
        `,
        [
          nextCode,
          (dto.uomName ?? existing.uomName).trim(),
          nextType,
          nextPrecision,
          nextGstCode,
          nextIsBase,
          dto.isActive ?? existing.isActive,
          user.userId,
          uomId,
        ],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const updated = await this.findUomById(uomId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'UOM_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_inv_uom',
      recordId: uomId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: updated as unknown as Record<string, unknown>,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return updated;
  }

  async deleteUom(
    uomId: number,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const existing = await this.findUomById(uomId);

    await this.dependencyCheckService.verifyCanDelete({
      entity: 'Unit of Measurement',
      entityId: uomId,
      relations: [
        {
          table: 'tbl_inv_uom_conversion',
          column: 'from_uom_id',
          label: 'Conversions Originating from this UOM',
        },
        {
          table: 'tbl_inv_uom_conversion',
          column: 'to_uom_id',
          label: 'Conversions Targeting this UOM',
        },
      ],
    });

    await this.pool.query(`DELETE FROM tbl_inv_uom WHERE uom_id = $1`, [uomId]);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'UOM_MASTER',
      actionType: 'DELETE',
      entityTable: 'tbl_inv_uom',
      recordId: uomId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: null,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return { deleted: true, uomId };
  }

  // ==========================================================================
  // TAB 2: UOM CONVERSION MATRIX (tbl_inv_uom_conversion)
  // ==========================================================================

  async findAllConversions(filters?: {
    fromUomId?: number;
    toUomId?: number;
    conversionType?: string;
  }) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.fromUomId) {
      params.push(Number(filters.fromUomId));
      conditions.push(`c.from_uom_id = $${params.length}`);
    }
    if (filters?.toUomId) {
      params.push(Number(filters.toUomId));
      conditions.push(`c.to_uom_id = $${params.length}`);
    }
    if (filters?.conversionType) {
      params.push(filters.conversionType);
      conditions.push(`c.conversion_type = $${params.length}`);
    }

    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `
      SELECT
        c.conversion_id     AS "conversionId",
        c.from_uom_id       AS "fromUomId",
        fu.uom_code         AS "fromUomCode",
        fu.uom_name         AS "fromUomName",
        fu.uom_type         AS "fromUomType",
        c.to_uom_id         AS "toUomId",
        tu.uom_code         AS "toUomCode",
        tu.uom_name         AS "toUomName",
        tu.uom_type         AS "toUomType",
        c.conversion_factor AS "conversionFactor",
        c.inverse_factor    AS "inverseFactor",
        c.conversion_type   AS "conversionType",
        c.remarks           AS "remarks",
        c.is_active         AS "isActive",
        c.created_date      AS "createdDate",
        c.updated_date      AS "updatedDate"
      FROM tbl_inv_uom_conversion c
      INNER JOIN tbl_inv_uom fu ON fu.uom_id = c.from_uom_id
      INNER JOIN tbl_inv_uom tu ON tu.uom_id = c.to_uom_id
      ${whereSql}
      ORDER BY
        fu.uom_code ASC,
        tu.uom_code ASC
      `,
      params,
    );

    return rows.map((r) => ({
      conversionId: Number(r.conversionId),
      fromUomId: Number(r.fromUomId),
      fromUomCode: r.fromUomCode,
      fromUomName: r.fromUomName,
      fromUomType: r.fromUomType,
      toUomId: Number(r.toUomId),
      toUomCode: r.toUomCode,
      toUomName: r.toUomName,
      toUomType: r.toUomType,
      conversionFactor: Number(r.conversionFactor),
      inverseFactor: Number(r.inverseFactor),
      conversionType: r.conversionType,
      remarks: r.remarks || null,
      isActive: Boolean(r.isActive),
      equationText: `1 ${r.fromUomCode} = ${Number(r.conversionFactor)} ${r.toUomCode}`,
      inverseEquationText: `1 ${r.toUomCode} = ${Number(r.inverseFactor)} ${r.fromUomCode}`,
      createdDate: r.createdDate,
      updatedDate: r.updatedDate,
    }));
  }

  async findConversionById(conversionId: number) {
    const all = await this.findAllConversions();
    const found = all.find((c) => c.conversionId === conversionId);
    if (!found) {
      throw new NotFoundException(
        `UOM Conversion #${conversionId} was not found.`,
      );
    }
    return found;
  }

  async createConversion(
    dto: CreateUomConversionDto,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const fromUomId = Number(dto.fromUomId);
    const toUomId = Number(dto.toUomId);

    if (fromUomId === toUomId) {
      throw new BadRequestException('From UOM and To UOM cannot be the same.');
    }

    const factor = Number(dto.conversionFactor);
    if (!factor || factor <= 0) {
      throw new BadRequestException(
        'Conversion factor must be a positive number.',
      );
    }

    const inverse =
      dto.inverseFactor !== undefined && Number(dto.inverseFactor) > 0
        ? Number(dto.inverseFactor)
        : Number((1 / factor).toFixed(6));

    const dupCheck = await this.pool.query(
      `
      SELECT conversion_id
      FROM tbl_inv_uom_conversion
      WHERE from_uom_id = $1 AND to_uom_id = $2
      LIMIT 1
      `,
      [fromUomId, toUomId],
    );

    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(
        'A conversion ratio between these two units already exists.',
      );
    }

    const client = await this.pool.connect();
    let createdConversionId = 0;

    try {
      await client.query('BEGIN');

      const { rows } = await client.query(
        `
        INSERT INTO tbl_inv_uom_conversion (
          from_uom_id, to_uom_id, conversion_factor, inverse_factor,
          conversion_type, remarks, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7,
          $8, $9, $10, $11
        )
        RETURNING conversion_id AS "conversionId"
        `,
        [
          fromUomId,
          toUomId,
          factor,
          inverse,
          dto.conversionType || 'STANDARD',
          dto.remarks?.trim() || null,
          dto.isActive ?? true,
          user.compId,
          user.branchId,
          user.fyearId,
          user.userId,
        ],
      );

      createdConversionId = Number(rows[0].conversionId);

      // If user requested bidirectional reciprocal creation (e.g. A->B and B->A)
      if (dto.createBidirectionalPair) {
        await client.query(
          `
          INSERT INTO tbl_inv_uom_conversion (
            from_uom_id, to_uom_id, conversion_factor, inverse_factor,
            conversion_type, remarks, is_active,
            comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7,
            $8, $9, $10, $11
          )
          ON CONFLICT (from_uom_id, to_uom_id) DO NOTHING
          `,
          [
            toUomId,
            fromUomId,
            inverse,
            factor,
            dto.conversionType || 'STANDARD',
            `Auto-generated reciprocal for conversion #${createdConversionId}`,
            dto.isActive ?? true,
            user.compId,
            user.branchId,
            user.fyearId,
            user.userId,
          ],
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const created = await this.findConversionById(createdConversionId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'UOM_MASTER',
      actionType: 'ADD',
      entityTable: 'tbl_inv_uom_conversion',
      recordId: created.conversionId,
      oldValue: null,
      newValue: created as unknown as Record<string, unknown>,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return created;
  }

  async updateConversion(
    conversionId: number,
    dto: UpdateUomConversionDto,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const existing = await this.findConversionById(conversionId);

    const factor =
      dto.conversionFactor !== undefined
        ? Number(dto.conversionFactor)
        : existing.conversionFactor;
    if (factor <= 0) {
      throw new BadRequestException('Conversion factor must be greater than 0.');
    }

    const inverse =
      dto.inverseFactor !== undefined && Number(dto.inverseFactor) > 0
        ? Number(dto.inverseFactor)
        : Number((1 / factor).toFixed(6));

    await this.pool.query(
      `
      UPDATE tbl_inv_uom_conversion
      SET
        conversion_factor = $1,
        inverse_factor    = $2,
        conversion_type   = $3,
        remarks           = $4,
        is_active         = $5,
        updated_by        = $6,
        updated_date      = CURRENT_TIMESTAMP
      WHERE conversion_id = $7
      `,
      [
        factor,
        inverse,
        dto.conversionType ?? existing.conversionType,
        dto.remarks !== undefined
          ? dto.remarks?.trim() || null
          : existing.remarks,
        dto.isActive ?? existing.isActive,
        user.userId,
        conversionId,
      ],
    );

    const updated = await this.findConversionById(conversionId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'UOM_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_inv_uom_conversion',
      recordId: conversionId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: updated as unknown as Record<string, unknown>,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return updated;
  }

  async deleteConversion(
    conversionId: number,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const existing = await this.findConversionById(conversionId);

    await this.pool.query(
      `DELETE FROM tbl_inv_uom_conversion WHERE conversion_id = $1`,
      [conversionId],
    );

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'UOM_MASTER',
      actionType: 'DELETE',
      entityTable: 'tbl_inv_uom_conversion',
      recordId: conversionId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: null,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return { deleted: true, conversionId };
  }

  // ==========================================================================
  // TAB 3: ITEM CATEGORY HIERARCHY TREE (tbl_inv_item_category)
  // ==========================================================================

  async findAllCategories(filters?: {
    categoryType?: string;
    parentCategoryId?: number;
    isLeaf?: boolean;
  }) {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filters?.categoryType) {
      params.push(filters.categoryType);
      conditions.push(`c.category_type = $${params.length}`);
    }
    if (filters?.parentCategoryId !== undefined) {
      params.push(Number(filters.parentCategoryId));
      conditions.push(`c.parent_category_id = $${params.length}`);
    }
    if (filters?.isLeaf !== undefined) {
      params.push(filters.isLeaf);
      conditions.push(`c.is_leaf = $${params.length}`);
    }

    const whereSql =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await this.pool.query(
      `
      SELECT
        c.category_id              AS "categoryId",
        c.category_code            AS "categoryCode",
        c.category_name            AS "categoryName",
        c.parent_category_id       AS "parentCategoryId",
        p.category_code            AS "parentCategoryCode",
        p.category_name            AS "parentCategoryName",
        c.category_type            AS "categoryType",
        c.hsn_sac_code             AS "hsnSacCode",
        c.default_tax_rate         AS "defaultTaxRate",
        c.default_valuation_method AS "defaultValuationMethod",
        c.level_depth              AS "levelDepth",
        c.hierarchy_path           AS "hierarchyPath",
        c.is_leaf                  AS "isLeaf",
        c.is_active                AS "isActive",
        c.created_date             AS "createdDate",
        c.updated_date             AS "updatedDate",
        COALESCE(child_stats.child_count, 0)::int AS "childCategoriesCount"
      FROM tbl_inv_item_category c
      LEFT JOIN tbl_inv_item_category p ON p.category_id = c.parent_category_id
      LEFT JOIN (
        SELECT
          parent_category_id,
          COUNT(*)::int AS child_count
        FROM tbl_inv_item_category
        WHERE parent_category_id IS NOT NULL
        GROUP BY parent_category_id
      ) child_stats ON child_stats.parent_category_id = c.category_id
      ${whereSql}
      ORDER BY
        c.category_type ASC,
        c.level_depth ASC,
        c.hierarchy_path ASC,
        c.category_code ASC
      `,
      params,
    );

    return rows.map((r) => ({
      categoryId: Number(r.categoryId),
      categoryCode: r.categoryCode,
      categoryName: r.categoryName,
      parentCategoryId: r.parentCategoryId ? Number(r.parentCategoryId) : null,
      parentCategoryCode: r.parentCategoryCode || null,
      parentCategoryName: r.parentCategoryName || null,
      categoryType: r.categoryType,
      hsnSacCode: r.hsnSacCode || null,
      defaultTaxRate: Number(r.defaultTaxRate) || 18.0,
      defaultValuationMethod: r.defaultValuationMethod,
      levelDepth: Number(r.levelDepth) || 1,
      hierarchyPath: r.hierarchyPath,
      isLeaf: Boolean(r.isLeaf),
      isActive: Boolean(r.isActive),
      childCategoriesCount: Number(r.childCategoriesCount) || 0,
      createdDate: r.createdDate,
      updatedDate: r.updatedDate,
    }));
  }

  async findCategoryById(categoryId: number) {
    const all = await this.findAllCategories();
    const found = all.find((c) => c.categoryId === categoryId);
    if (!found) {
      throw new NotFoundException(
        `Item Category #${categoryId} was not found.`,
      );
    }
    return found;
  }

  async createCategory(
    dto: CreateItemCategoryDto,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const categoryCode = (dto.categoryCode || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '_');
    const categoryName = (dto.categoryName || '').trim();

    if (!categoryCode || !categoryName) {
      throw new BadRequestException(
        'Both categoryCode and categoryName are required.',
      );
    }

    const dupCheck = await this.pool.query(
      `SELECT category_id FROM tbl_inv_item_category WHERE category_code = $1 LIMIT 1`,
      [categoryCode],
    );

    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(
        `Item Category code "${categoryCode}" already exists.`,
      );
    }

    let levelDepth = 1;
    let hierarchyPath = categoryCode;
    const parentId = dto.parentCategoryId ? Number(dto.parentCategoryId) : null;

    if (parentId) {
      const parent = await this.findCategoryById(parentId);
      levelDepth = parent.levelDepth + 1;
      hierarchyPath = `${parent.hierarchyPath} / ${categoryCode}`;
    }

    const client = await this.pool.connect();
    let createdCategoryId = 0;

    try {
      await client.query('BEGIN');

      if (parentId) {
        // Parent now has at least one child, so mark parent is_leaf = FALSE
        await client.query(
          `
          UPDATE tbl_inv_item_category
          SET is_leaf = FALSE, updated_by = $1, updated_date = CURRENT_TIMESTAMP
          WHERE category_id = $2
          `,
          [user.userId, parentId],
        );
      }

      const { rows } = await client.query(
        `
        INSERT INTO tbl_inv_item_category (
          category_code, category_name, parent_category_id,
          category_type, hsn_sac_code, default_tax_rate, default_valuation_method,
          level_depth, hierarchy_path, is_leaf, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13, $14, $15
        )
        RETURNING category_id AS "categoryId"
        `,
        [
          categoryCode,
          categoryName,
          parentId,
          dto.categoryType || 'RAW_MATERIAL',
          dto.hsnSacCode?.trim() || null,
          dto.defaultTaxRate ?? 18.0,
          dto.defaultValuationMethod || 'FIFO',
          levelDepth,
          hierarchyPath,
          dto.isLeaf ?? true,
          dto.isActive ?? true,
          user.compId,
          user.branchId,
          user.fyearId,
          user.userId,
        ],
      );

      createdCategoryId = Number(rows[0].categoryId);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const created = await this.findCategoryById(createdCategoryId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'UOM_MASTER',
      actionType: 'ADD',
      entityTable: 'tbl_inv_item_category',
      recordId: created.categoryId,
      oldValue: null,
      newValue: created as unknown as Record<string, unknown>,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return created;
  }

  async updateCategory(
    categoryId: number,
    dto: UpdateItemCategoryDto,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const existing = await this.findCategoryById(categoryId);

    const nextCode = (dto.categoryCode ?? existing.categoryCode)
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_-]/g, '_');
    const nextParentId =
      dto.parentCategoryId !== undefined
        ? dto.parentCategoryId
          ? Number(dto.parentCategoryId)
          : null
        : existing.parentCategoryId;

    if (nextParentId === categoryId) {
      throw new BadRequestException('A category cannot be its own parent.');
    }

    const dupCheck = await this.pool.query(
      `SELECT category_id FROM tbl_inv_item_category WHERE category_code = $1 AND category_id <> $2 LIMIT 1`,
      [nextCode, categoryId],
    );

    if ((dupCheck.rowCount ?? 0) > 0) {
      throw new ConflictException(
        `Another category with code "${nextCode}" already exists.`,
      );
    }

    let levelDepth = 1;
    let hierarchyPath = nextCode;

    if (nextParentId) {
      const parent = await this.findCategoryById(nextParentId);
      levelDepth = parent.levelDepth + 1;
      hierarchyPath = `${parent.hierarchyPath} / ${nextCode}`;
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      if (nextParentId && nextParentId !== existing.parentCategoryId) {
        await client.query(
          `
          UPDATE tbl_inv_item_category
          SET is_leaf = FALSE, updated_by = $1, updated_date = CURRENT_TIMESTAMP
          WHERE category_id = $2
          `,
          [user.userId, nextParentId],
        );
      }

      await client.query(
        `
        UPDATE tbl_inv_item_category
        SET
          category_code            = $1,
          category_name            = $2,
          parent_category_id       = $3,
          category_type            = $4,
          hsn_sac_code             = $5,
          default_tax_rate         = $6,
          default_valuation_method = $7,
          level_depth              = $8,
          hierarchy_path           = $9,
          is_leaf                  = $10,
          is_active                = $11,
          updated_by               = $12,
          updated_date             = CURRENT_TIMESTAMP
        WHERE category_id = $13
        `,
        [
          nextCode,
          (dto.categoryName ?? existing.categoryName).trim(),
          nextParentId,
          dto.categoryType ?? existing.categoryType,
          dto.hsnSacCode !== undefined
            ? dto.hsnSacCode?.trim() || null
            : existing.hsnSacCode,
          dto.defaultTaxRate ?? existing.defaultTaxRate,
          dto.defaultValuationMethod ?? existing.defaultValuationMethod,
          levelDepth,
          hierarchyPath,
          dto.isLeaf ?? existing.isLeaf,
          dto.isActive ?? existing.isActive,
          user.userId,
          categoryId,
        ],
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const updated = await this.findCategoryById(categoryId);

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'UOM_MASTER',
      actionType: 'EDIT',
      entityTable: 'tbl_inv_item_category',
      recordId: categoryId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: updated as unknown as Record<string, unknown>,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return updated;
  }

  async deleteCategory(
    categoryId: number,
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    const existing = await this.findCategoryById(categoryId);

    await this.dependencyCheckService.verifyCanDelete({
      entity: 'Item Category',
      entityId: categoryId,
      relations: [
        {
          table: 'tbl_inv_item_category',
          column: 'parent_category_id',
          label: 'Child Sub-Categories depending on this Category',
        },
      ],
    });

    await this.pool.query(
      `DELETE FROM tbl_inv_item_category WHERE category_id = $1`,
      [categoryId],
    );

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'UOM_MASTER',
      actionType: 'DELETE',
      entityTable: 'tbl_inv_item_category',
      recordId: categoryId,
      oldValue: existing as unknown as Record<string, unknown>,
      newValue: null,
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return { deleted: true, categoryId };
  }

  // ==========================================================================
  // SCREEN AUDIT ACTION LOGGING (PRINT / EXPORT)
  // ==========================================================================

  async recordScreenAction(
    actionType: 'PRINT' | 'EXPORT',
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'UOM_MASTER',
      actionType,
      entityTable: 'tbl_inv_uom',
      recordId: 0,
      oldValue: null,
      newValue: { actionType, screenCode: 'UOM_MASTER' },
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });
    return { logged: true };
  }
}
