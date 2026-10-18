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
  CreatePriceListDto,
  CreatePriceListItemDto,
  PriceListFilterDto,
  PriceLookupQueryDto,
  UpdatePriceListDto,
} from './price-list.dto';

export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

@Injectable()
export class PriceListService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  // ==========================================================================
  // SUMMARY / KPI METRICS
  // ==========================================================================

  async getPriceListSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const { rows } = await this.pool.query(
      `
      SELECT
        COUNT(*)::int AS "totalPriceLists",
        COUNT(CASE WHEN is_active = true AND price_list_type = 'SALES' THEN 1 END)::int AS "salesCount",
        COUNT(CASE WHEN is_active = true AND price_list_type = 'PURCHASE' THEN 1 END)::int AS "purchaseCount",
        COUNT(CASE WHEN is_active = true AND price_list_type = 'JOB_WORK' THEN 1 END)::int AS "jobWorkCount",
        (
          SELECT COUNT(DISTINCT item_id)::int
          FROM tbl_crm_price_list_item pli
          JOIN tbl_crm_price_list pl ON pl.price_list_id = pli.price_list_id
          WHERE pl.comp_id = $1 AND pl.is_active = true AND pli.is_active = true
        ) AS "activeItemsCount"
      FROM tbl_crm_price_list
      WHERE comp_id = $1
      `,
      [compId],
    );

    const r = rows[0] || {};
    return {
      totalPriceLists: Number(r.totalPriceLists) || 0,
      salesCount: Number(r.salesCount) || 0,
      purchaseCount: Number(r.purchaseCount) || 0,
      jobWorkCount: Number(r.jobWorkCount) || 0,
      activeItemsCount: Number(r.activeItemsCount) || 0,
    };
  }

  // ==========================================================================
  // RETRIEVAL & LISTING
  // ==========================================================================

  async findAllPriceLists(filters: PriceListFilterDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const conditions: string[] = ['pl.comp_id = $1'];
    const params: unknown[] = [compId];

    if (filters.priceListType) {
      params.push(filters.priceListType);
      conditions.push(`pl.price_list_type = $${params.length}`);
    }

    if (filters.isActive !== undefined) {
      params.push(filters.isActive);
      conditions.push(`pl.is_active = $${params.length}`);
    }

    if (filters.search) {
      params.push(`%${filters.search.trim().toLowerCase()}%`);
      conditions.push(
        `(LOWER(pl.price_list_code) LIKE $${params.length} OR LOWER(pl.price_list_name) LIKE $${params.length} OR LOWER(COALESCE(pl.description, '')) LIKE $${params.length})`,
      );
    }

    const whereClause = conditions.join(' AND ');

    const sql = `
      SELECT
        pl.price_list_id        AS "priceListId",
        pl.price_list_code      AS "priceListCode",
        pl.price_list_name      AS "priceListName",
        pl.price_list_type      AS "priceListType",
        pl.currency_code        AS "currencyCode",
        TO_CHAR(pl.effective_from, 'YYYY-MM-DD') AS "effectiveFrom",
        TO_CHAR(pl.effective_to, 'YYYY-MM-DD')   AS "effectiveTo",
        pl.is_default           AS "isDefault",
        pl.description          AS "description",
        pl.is_active            AS "isActive",
        pl.created_date         AS "createdDate",
        pl.updated_date         AS "updatedDate",
        COUNT(DISTINCT pli.price_list_item_id)::int AS "itemsCount",
        COUNT(DISTINCT ppl.party_id)::int          AS "assignedPartiesCount"
      FROM tbl_crm_price_list pl
      LEFT JOIN tbl_crm_price_list_item pli ON pli.price_list_id = pl.price_list_id
      LEFT JOIN tbl_crm_party_price_list ppl ON ppl.price_list_id = pl.price_list_id
      WHERE ${whereClause}
      GROUP BY pl.price_list_id
      ORDER BY pl.is_default DESC, pl.price_list_type ASC, pl.price_list_code ASC
    `;

    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async findPriceListById(priceListId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const { rows } = await this.pool.query(
      `
      SELECT
        pl.price_list_id        AS "priceListId",
        pl.price_list_code      AS "priceListCode",
        pl.price_list_name      AS "priceListName",
        pl.price_list_type      AS "priceListType",
        pl.currency_code        AS "currencyCode",
        TO_CHAR(pl.effective_from, 'YYYY-MM-DD') AS "effectiveFrom",
        TO_CHAR(pl.effective_to, 'YYYY-MM-DD')   AS "effectiveTo",
        pl.is_default           AS "isDefault",
        pl.description          AS "description",
        pl.is_active            AS "isActive",
        pl.created_date         AS "createdDate",
        pl.updated_date         AS "updatedDate"
      FROM tbl_crm_price_list pl
      WHERE pl.price_list_id = $1 AND pl.comp_id = $2
      `,
      [priceListId, compId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Price list with ID ${priceListId} not found`);
    }

    const header = rows[0];

    // Fetch items with item details & uom details
    const itemsRes = await this.pool.query(
      `
      SELECT
        pli.price_list_item_id AS "priceListItemId",
        pli.price_list_id      AS "priceListId",
        pli.item_id            AS "itemId",
        i.item_code            AS "itemCode",
        i.item_name            AS "itemName",
        i.item_type            AS "itemType",
        pli.uom_id             AS "uomId",
        u.uom_code             AS "uomCode",
        u.uom_name             AS "uomName",
        pli.min_qty::float     AS "minQty",
        pli.max_qty::float     AS "maxQty",
        pli.base_rate::float   AS "baseRate",
        pli.discount_pct::float AS "discountPct",
        pli.effective_rate::float AS "effectiveRate",
        pli.lead_time_days     AS "leadTimeDays",
        pli.remarks            AS "remarks",
        pli.is_active          AS "isActive"
      FROM tbl_crm_price_list_item pli
      JOIN tbl_inv_item i ON i.item_id = pli.item_id
      JOIN tbl_inv_uom u ON u.uom_id = pli.uom_id
      WHERE pli.price_list_id = $1
      ORDER BY i.item_code ASC, pli.min_qty ASC
      `,
      [priceListId],
    );

    // Fetch assigned parties
    const partiesRes = await this.pool.query(
      `
      SELECT
        ppl.party_price_list_id AS "partyPriceListId",
        ppl.party_id           AS "partyId",
        p.party_code           AS "partyCode",
        p.party_name           AS "partyName",
        p.party_group          AS "partyGroup",
        ppl.is_primary         AS "isPrimary",
        ppl.is_active          AS "isActive"
      FROM tbl_crm_party_price_list ppl
      JOIN tbl_crm_party p ON p.party_id = ppl.party_id
      WHERE ppl.price_list_id = $1
      ORDER BY p.party_name ASC
      `,
      [priceListId],
    );

    return {
      ...header,
      items: itemsRes.rows,
      assignedParties: partiesRes.rows,
    };
  }

  // ==========================================================================
  // DYNAMIC PRICE LOOKUP
  // ==========================================================================

  async lookupRate(query: PriceLookupQueryDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const { itemId, qty } = query;
    let priceListId = query.priceListId;

    if (!priceListId && query.partyId) {
      // Find assigned primary price list for this party
      const { rows } = await this.pool.query(
        `
        SELECT ppl.price_list_id
        FROM tbl_crm_party_price_list ppl
        JOIN tbl_crm_price_list pl ON pl.price_list_id = ppl.price_list_id
        WHERE ppl.party_id = $1 AND pl.comp_id = $2 AND pl.is_active = true
        ORDER BY ppl.is_primary DESC, ppl.party_price_list_id ASC
        LIMIT 1
        `,
        [query.partyId, compId],
      );
      if (rows.length > 0) {
        priceListId = rows[0].price_list_id;
      }
    }

    if (!priceListId) {
      // Fallback to company default sales price list
      const { rows } = await this.pool.query(
        `
        SELECT price_list_id
        FROM tbl_crm_price_list
        WHERE comp_id = $1 AND is_default = true AND is_active = true
        LIMIT 1
        `,
        [compId],
      );
      if (rows.length > 0) {
        priceListId = rows[0].price_list_id;
      }
    }

    if (!priceListId) {
      throw new NotFoundException('No active price list found for rate lookup');
    }

    const { rows: bracketRows } = await this.pool.query(
      `
      SELECT
        pli.price_list_item_id,
        pli.price_list_id,
        pli.item_id,
        pli.uom_id,
        u.uom_code,
        pli.min_qty::float AS min_qty,
        pli.max_qty::float AS max_qty,
        pli.base_rate::float AS base_rate,
        pli.discount_pct::float AS discount_pct,
        pli.effective_rate::float AS effective_rate,
        pli.lead_time_days
      FROM tbl_crm_price_list_item pli
      JOIN tbl_inv_uom u ON u.uom_id = pli.uom_id
      WHERE pli.price_list_id = $1
        AND pli.item_id = $2
        AND pli.is_active = true
        AND pli.min_qty <= $3
        AND (pli.max_qty IS NULL OR pli.max_qty >= $3)
      ORDER BY pli.min_qty DESC
      LIMIT 1
      `,
      [priceListId, itemId, qty],
    );

    if (bracketRows.length === 0) {
      // If no exact tiered bracket matched, check any row for this item in the price list
      const { rows: fallbackRows } = await this.pool.query(
        `
        SELECT
          pli.price_list_item_id,
          pli.price_list_id,
          pli.item_id,
          pli.uom_id,
          u.uom_code,
          pli.min_qty::float AS min_qty,
          pli.max_qty::float AS max_qty,
          pli.base_rate::float AS base_rate,
          pli.discount_pct::float AS discount_pct,
          pli.effective_rate::float AS effective_rate,
          pli.lead_time_days
        FROM tbl_crm_price_list_item pli
        JOIN tbl_inv_uom u ON u.uom_id = pli.uom_id
        WHERE pli.price_list_id = $1 AND pli.item_id = $2 AND pli.is_active = true
        ORDER BY pli.min_qty ASC
        LIMIT 1
        `,
        [priceListId, itemId],
      );

      if (fallbackRows.length === 0) {
        throw new NotFoundException(
          `Item ID ${itemId} is not listed in Price List ${priceListId}`,
        );
      }
      return fallbackRows[0];
    }

    return bracketRows[0];
  }

  // ==========================================================================
  // CREATE
  // ==========================================================================

  async createPriceList(
    dto: CreatePriceListDto,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const trimmedCode = dto.priceListCode.trim().toUpperCase();
    const trimmedName = dto.priceListName.trim();

    if (!trimmedCode) {
      throw new BadRequestException('Price list code is required');
    }
    if (!trimmedName) {
      throw new BadRequestException('Price list name is required');
    }

    // Check duplicate code
    const { rows: existingCode } = await this.pool.query(
      `SELECT price_list_id FROM tbl_crm_price_list WHERE comp_id = $1 AND LOWER(price_list_code) = LOWER($2)`,
      [compId, trimmedCode],
    );
    if (existingCode.length > 0) {
      throw new ConflictException(
        `A price list with code "${trimmedCode}" already exists for this company.`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // If marked default, unset other default price lists of this type
      if (dto.isDefault) {
        await client.query(
          `UPDATE tbl_crm_price_list SET is_default = false WHERE comp_id = $1 AND price_list_type = $2`,
          [compId, dto.priceListType],
        );
      }

      const insertHeaderSql = `
        INSERT INTO tbl_crm_price_list (
          price_list_code, price_list_name, price_list_type,
          currency_code, effective_from, effective_to,
          is_default, description, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6,
          $7, $8, $9,
          $10, $11, $12, $13
        ) RETURNING price_list_id
      `;

      const headerRes = await client.query(insertHeaderSql, [
        trimmedCode,
        trimmedName,
        dto.priceListType || 'SALES',
        dto.currencyCode || 'INR',
        dto.effectiveFrom,
        dto.effectiveTo || null,
        Boolean(dto.isDefault),
        dto.description || null,
        dto.isActive !== undefined ? dto.isActive : true,
        compId,
        branchId,
        fyearId,
        userId,
      ]);

      const priceListId = headerRes.rows[0].price_list_id;

      // Insert line items
      if (Array.isArray(dto.items) && dto.items.length > 0) {
        for (const it of dto.items) {
          const discountPct = Number(it.discountPct) || 0;
          const baseRate = Number(it.baseRate) || 0;
          const effectiveRate =
            it.effectiveRate !== undefined
              ? Number(it.effectiveRate)
              : Number((baseRate * (1 - discountPct / 100)).toFixed(4));

          await client.query(
            `
            INSERT INTO tbl_crm_price_list_item (
              price_list_id, item_id, uom_id,
              min_qty, max_qty, base_rate, discount_pct, effective_rate,
              lead_time_days, remarks, is_active,
              comp_id, branch_id, fyear_id, created_by
            ) VALUES (
              $1, $2, $3,
              $4, $5, $6, $7, $8,
              $9, $10, $11,
              $12, $13, $14, $15
            )
            `,
            [
              priceListId,
              it.itemId,
              it.uomId,
              it.minQty || 1,
              it.maxQty || null,
              baseRate,
              discountPct,
              effectiveRate,
              it.leadTimeDays || 0,
              it.remarks || null,
              it.isActive !== undefined ? it.isActive : true,
              compId,
              branchId,
              fyearId,
              userId,
            ],
          );
        }
      }

      // Insert party associations
      if (Array.isArray(dto.assignedPartyIds) && dto.assignedPartyIds.length > 0) {
        for (const partyId of dto.assignedPartyIds) {
          await client.query(
            `
            INSERT INTO tbl_crm_party_price_list (
              party_id, price_list_id, is_primary, is_active,
              comp_id, branch_id, fyear_id, created_by
            ) VALUES ($1, $2, true, true, $3, $4, $5, $6)
            ON CONFLICT (party_id, price_list_id) DO NOTHING
            `,
            [partyId, priceListId, compId, branchId, fyearId, userId],
          );
        }
      }

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PRICE_LIST',
        actionType: 'ADD',
        entityTable: 'tbl_crm_price_list',
        recordId: priceListId,
        oldValue: null,
        newValue: {
          priceListId,
          priceListCode: trimmedCode,
          priceListName: trimmedName,
          priceListType: dto.priceListType,
          itemsCount: dto.items?.length || 0,
        },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findPriceListById(priceListId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  async updatePriceList(
    priceListId: number,
    dto: UpdatePriceListDto,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const existing = await this.findPriceListById(priceListId, user);

    if (dto.priceListCode) {
      const trimmedCode = dto.priceListCode.trim().toUpperCase();
      const { rows: conflict } = await this.pool.query(
        `SELECT price_list_id FROM tbl_crm_price_list WHERE comp_id = $1 AND LOWER(price_list_code) = LOWER($2) AND price_list_id <> $3`,
        [compId, trimmedCode, priceListId],
      );
      if (conflict.length > 0) {
        throw new ConflictException(
          `Price list code "${trimmedCode}" is already in use by another price list.`,
        );
      }
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const targetType = dto.priceListType || existing.priceListType;

      if (dto.isDefault) {
        await client.query(
          `UPDATE tbl_crm_price_list SET is_default = false WHERE comp_id = $1 AND price_list_type = $2 AND price_list_id <> $3`,
          [compId, targetType, priceListId],
        );
      }

      const updateHeaderSql = `
        UPDATE tbl_crm_price_list
        SET
          price_list_code = COALESCE($1, price_list_code),
          price_list_name = COALESCE($2, price_list_name),
          price_list_type = COALESCE($3, price_list_type),
          currency_code   = COALESCE($4, currency_code),
          effective_from  = COALESCE($5, effective_from),
          effective_to    = $6,
          is_default      = COALESCE($7, is_default),
          description     = $8,
          is_active       = COALESCE($9, is_active),
          updated_by      = $10,
          updated_date    = CURRENT_TIMESTAMP
        WHERE price_list_id = $11 AND comp_id = $12
      `;

      await client.query(updateHeaderSql, [
        dto.priceListCode ? dto.priceListCode.trim().toUpperCase() : null,
        dto.priceListName ? dto.priceListName.trim() : null,
        dto.priceListType || null,
        dto.currencyCode || null,
        dto.effectiveFrom || null,
        dto.effectiveTo !== undefined ? dto.effectiveTo : existing.effectiveTo,
        dto.isDefault !== undefined ? dto.isDefault : null,
        dto.description !== undefined ? dto.description : existing.description,
        dto.isActive !== undefined ? dto.isActive : null,
        userId,
        priceListId,
        compId,
      ]);

      // If line items passed, replace cleanly
      if (Array.isArray(dto.items)) {
        await client.query(
          `DELETE FROM tbl_crm_price_list_item WHERE price_list_id = $1`,
          [priceListId],
        );

        for (const it of dto.items) {
          const discountPct = Number(it.discountPct) || 0;
          const baseRate = Number(it.baseRate) || 0;
          const effectiveRate =
            it.effectiveRate !== undefined
              ? Number(it.effectiveRate)
              : Number((baseRate * (1 - discountPct / 100)).toFixed(4));

          await client.query(
            `
            INSERT INTO tbl_crm_price_list_item (
              price_list_id, item_id, uom_id,
              min_qty, max_qty, base_rate, discount_pct, effective_rate,
              lead_time_days, remarks, is_active,
              comp_id, branch_id, fyear_id, created_by
            ) VALUES (
              $1, $2, $3,
              $4, $5, $6, $7, $8,
              $9, $10, $11,
              $12, $13, $14, $15
            )
            `,
            [
              priceListId,
              it.itemId,
              it.uomId,
              it.minQty || 1,
              it.maxQty || null,
              baseRate,
              discountPct,
              effectiveRate,
              it.leadTimeDays || 0,
              it.remarks || null,
              it.isActive !== undefined ? it.isActive : true,
              compId,
              branchId,
              fyearId,
              userId,
            ],
          );
        }
      }

      // If assigned party IDs passed, replace
      if (Array.isArray(dto.assignedPartyIds)) {
        await client.query(
          `DELETE FROM tbl_crm_party_price_list WHERE price_list_id = $1`,
          [priceListId],
        );

        for (const partyId of dto.assignedPartyIds) {
          await client.query(
            `
            INSERT INTO tbl_crm_party_price_list (
              party_id, price_list_id, is_primary, is_active,
              comp_id, branch_id, fyear_id, created_by
            ) VALUES ($1, $2, true, true, $3, $4, $5, $6)
            ON CONFLICT (party_id, price_list_id) DO NOTHING
            `,
            [partyId, priceListId, compId, branchId, fyearId, userId],
          );
        }
      }

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PRICE_LIST',
        actionType: 'EDIT',
        entityTable: 'tbl_crm_price_list',
        recordId: priceListId,
        oldValue: {
          priceListCode: existing.priceListCode,
          priceListName: existing.priceListName,
          itemsCount: existing.items?.length,
        },
        newValue: {
          priceListCode: dto.priceListCode || existing.priceListCode,
          priceListName: dto.priceListName || existing.priceListName,
          itemsCount: dto.items ? dto.items.length : existing.items?.length,
        },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findPriceListById(priceListId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // DELETE
  // ==========================================================================

  async deletePriceList(
    priceListId: number,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const existing = await this.findPriceListById(priceListId, user);

    // Dependency verification across downstream documents (Sales Order, Purchase Order, etc.)
    await this.dependencyCheckService.verifyCanDelete({
      entity: 'tbl_crm_price_list',
      entityId: priceListId,
      relations: [
        {
          table: 'tbl_so_header',
          column: 'price_list_id',
          label: 'Sales Orders',
        },
        {
          table: 'tbl_po_header',
          column: 'price_list_id',
          label: 'Purchase Orders',
        },
      ],
    });

    await this.pool.query(
      `DELETE FROM tbl_crm_price_list WHERE price_list_id = $1 AND comp_id = $2`,
      [priceListId, compId],
    );

    // Audit log
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'PRICE_LIST',
      actionType: 'DELETE',
      entityTable: 'tbl_crm_price_list',
      recordId: priceListId,
      oldValue: {
        priceListId,
        priceListCode: existing.priceListCode,
        priceListName: existing.priceListName,
      },
      newValue: null,
      compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return {
      success: true,
      message: `Price List ${existing.priceListCode} (${existing.priceListName}) deleted successfully`,
    };
  }

  // ==========================================================================
  // ACTION LOGGING
  // ==========================================================================

  async recordScreenAction(
    actionType: 'PRINT' | 'EXPORT',
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'PRICE_LIST',
      actionType,
      entityTable: 'tbl_crm_price_list',
      recordId: 0,
      oldValue: null,
      newValue: { actionType, screenCode: 'PRICE_LIST' },
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });
    return { logged: true };
  }
}
