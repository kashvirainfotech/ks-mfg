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
  AwardRfqDto,
  CreateRfqDto,
  RecordVendorQuoteDto,
  RfqFilterDto,
  UpdateRfqDto,
} from './rfq.dto';

export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

@Injectable()
export class RfqService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  // ==========================================================================
  // KPI SUMMARY
  // ==========================================================================

  async getRfqSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const { rows } = await this.pool.query(
      `
      SELECT
        COUNT(*)::int AS "totalRfqs",
        COUNT(CASE WHEN status IN ('DRAFT', 'SENT') THEN 1 END)::int AS "openCount",
        COUNT(CASE WHEN status IN ('QUOTES_RECEIVED', 'COMPARISON_DONE') THEN 1 END)::int AS "evaluatingCount",
        COUNT(CASE WHEN status = 'AWARDED' THEN 1 END)::int AS "awardedCount",
        (
          SELECT COUNT(*)::int FROM tbl_rfq_vendor v
          JOIN tbl_rfq_header h ON h.rfq_id = v.rfq_id
          WHERE h.comp_id = $1 AND v.status IN ('QUOTED', 'SELECTED') AND v.is_active = true
        ) AS "totalQuotesReceived"
      FROM tbl_rfq_header
      WHERE comp_id = $1 AND is_active = true
      `,
      [compId],
    );

    const r = rows[0] || {};
    return {
      totalRfqs: Number(r.totalRfqs) || 0,
      openCount: Number(r.openCount) || 0,
      evaluatingCount: Number(r.evaluatingCount) || 0,
      awardedCount: Number(r.awardedCount) || 0,
      totalQuotesReceived: Number(r.totalQuotesReceived) || 0,
    };
  }

  // ==========================================================================
  // RETRIEVAL & LISTING
  // ==========================================================================

  async findAllRfqs(filters: RfqFilterDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const conditions: string[] = ['rfq.comp_id = $1', 'rfq.is_active = true'];
    const params: unknown[] = [compId];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`rfq.status = $${params.length}`);
    }

    if (filters.warehouseId) {
      params.push(filters.warehouseId);
      conditions.push(`rfq.warehouse_id = $${params.length}`);
    }

    if (filters.search) {
      params.push(`%${filters.search.trim().toLowerCase()}%`);
      conditions.push(
        `(LOWER(rfq.rfq_no) LIKE $${params.length} OR LOWER(rfq.remarks) LIKE $${params.length} OR LOWER(w.warehouse_name) LIKE $${params.length} OR LOWER(COALESCE(p.party_name, '')) LIKE $${params.length})`,
      );
    }

    const whereClause = conditions.join(' AND ');

    const sql = `
      SELECT
        rfq.rfq_id                    AS "rfqId",
        rfq.rfq_no                    AS "rfqNo",
        TO_CHAR(rfq.rfq_date, 'YYYY-MM-DD') AS "rfqDate",
        TO_CHAR(rfq.due_date, 'YYYY-MM-DD') AS "dueDate",
        rfq.warehouse_id              AS "warehouseId",
        w.warehouse_code              AS "warehouseCode",
        w.warehouse_name              AS "warehouseName",
        rfq.status                    AS "status",
        rfq.payment_terms             AS "paymentTerms",
        rfq.delivery_terms            AS "deliveryTerms",
        rfq.remarks                   AS "remarks",
        rfq.awarded_vendor_id         AS "awardedVendorId",
        p.party_code                  AS "awardedVendorCode",
        p.party_name                  AS "awardedVendorName",
        rfq.awarded_date              AS "awardedDate",
        rfq.awarded_remarks           AS "awardedRemarks",
        rfq.is_active                 AS "isActive",
        rfq.created_date              AS "createdDate",
        COUNT(DISTINCT ri.rfq_item_id)::int   AS "itemsCount",
        COUNT(DISTINCT rv.rfq_vendor_id)::int AS "invitedVendorsCount",
        COUNT(DISTINCT CASE WHEN rv.status IN ('QUOTED', 'SELECTED') THEN rv.rfq_vendor_id END)::int AS "quotesReceivedCount"
      FROM tbl_rfq_header rfq
      JOIN tbl_inv_warehouse w ON w.warehouse_id = rfq.warehouse_id
      LEFT JOIN tbl_crm_party p ON p.party_id = rfq.awarded_vendor_id
      LEFT JOIN tbl_rfq_item ri ON ri.rfq_id = rfq.rfq_id AND ri.is_active = true
      LEFT JOIN tbl_rfq_vendor rv ON rv.rfq_id = rfq.rfq_id AND rv.is_active = true
      WHERE ${whereClause}
      GROUP BY rfq.rfq_id, w.warehouse_code, w.warehouse_name, p.party_code, p.party_name
      ORDER BY rfq.rfq_date DESC, rfq.rfq_id DESC
    `;

    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async findRfqById(rfqId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const { rows } = await this.pool.query(
      `
      SELECT
        rfq.rfq_id                    AS "rfqId",
        rfq.rfq_no                    AS "rfqNo",
        TO_CHAR(rfq.rfq_date, 'YYYY-MM-DD') AS "rfqDate",
        TO_CHAR(rfq.due_date, 'YYYY-MM-DD') AS "dueDate",
        rfq.warehouse_id              AS "warehouseId",
        w.warehouse_code              AS "warehouseCode",
        w.warehouse_name              AS "warehouseName",
        rfq.status                    AS "status",
        rfq.payment_terms             AS "paymentTerms",
        rfq.delivery_terms            AS "deliveryTerms",
        rfq.remarks                   AS "remarks",
        rfq.awarded_vendor_id         AS "awardedVendorId",
        p.party_code                  AS "awardedVendorCode",
        p.party_name                  AS "awardedVendorName",
        rfq.awarded_date              AS "awardedDate",
        rfq.awarded_remarks           AS "awardedRemarks",
        rfq.is_active                 AS "isActive",
        rfq.created_date              AS "createdDate",
        rfq.updated_date              AS "updatedDate"
      FROM tbl_rfq_header rfq
      JOIN tbl_inv_warehouse w ON w.warehouse_id = rfq.warehouse_id
      LEFT JOIN tbl_crm_party p ON p.party_id = rfq.awarded_vendor_id
      WHERE rfq.rfq_id = $1 AND rfq.comp_id = $2
      `,
      [rfqId, compId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`RFQ with ID ${rfqId} not found`);
    }

    const header = rows[0];

    // Line items
    const itemsRes = await this.pool.query(
      `
      SELECT
        ri.rfq_item_id            AS "rfqItemId",
        ri.rfq_id                 AS "rfqId",
        ri.pr_item_id             AS "prItemId",
        prh.pr_no                 AS "prNo",
        ri.item_id               AS "itemId",
        i.item_code               AS "itemCode",
        i.item_name               AS "itemName",
        i.item_type               AS "itemType",
        ri.uom_id                AS "uomId",
        u.uom_code                AS "uomCode",
        u.uom_name                AS "uomName",
        ri.required_qty::float   AS "requiredQty",
        ri.target_rate::float     AS "targetRate",
        (ri.required_qty * ri.target_rate)::float AS "targetAmount",
        ri.technical_specs        AS "technicalSpecs",
        ri.is_active             AS "isActive"
      FROM tbl_rfq_item ri
      JOIN tbl_inv_item i ON i.item_id = ri.item_id
      JOIN tbl_inv_uom u ON u.uom_id = ri.uom_id
      LEFT JOIN tbl_pr_item pri ON pri.pr_item_id = ri.pr_item_id
      LEFT JOIN tbl_pr_header prh ON prh.pr_id = pri.pr_id
      WHERE ri.rfq_id = $1 AND ri.is_active = true
      ORDER BY ri.rfq_item_id ASC
      `,
      [rfqId],
    );

    // Invited Vendors
    const vendorsRes = await this.pool.query(
      `
      SELECT
        rv.rfq_vendor_id          AS "rfqVendorId",
        rv.rfq_id                 AS "rfqId",
        rv.party_id               AS "partyId",
        p.party_code              AS "partyCode",
        p.party_name              AS "partyName",
        p.email                   AS "vendorEmail",
        p.phone                   AS "vendorPhone",
        rv.invitation_date        AS "invitationDate",
        rv.status                 AS "status",
        rv.vendor_quote_ref       AS "vendorQuoteRef",
        TO_CHAR(rv.quote_date, 'YYYY-MM-DD') AS "quoteDate",
        rv.total_quote_amount::float AS "totalQuoteAmount",
        rv.payment_terms          AS "paymentTerms",
        rv.delivery_lead_time_days AS "deliveryLeadTimeDays",
        rv.vendor_remarks         AS "vendorRemarks",
        rv.is_active              AS "isActive"
      FROM tbl_rfq_vendor rv
      JOIN tbl_crm_party p ON p.party_id = rv.party_id
      WHERE rv.rfq_id = $1 AND rv.is_active = true
      ORDER BY rv.rfq_vendor_id ASC
      `,
      [rfqId],
    );

    return {
      ...header,
      items: itemsRes.rows,
      vendors: vendorsRes.rows,
    };
  }

  // ==========================================================================
  // COMPARATIVE STATEMENT (CS) ENGINE
  // ==========================================================================

  async getComparativeStatement(rfqId: number, user: AuthenticatedUserContext) {
    const rfq = await this.findRfqById(rfqId, user);

    // Fetch all vendor item quotation bids
    const { rows: quotes } = await this.pool.query(
      `
      SELECT
        rvi.rfq_vendor_item_id    AS "rfqVendorItemId",
        rvi.rfq_vendor_id         AS "rfqVendorId",
        rv.party_id               AS "partyId",
        p.party_code              AS "partyCode",
        p.party_name              AS "partyName",
        rvi.rfq_item_id           AS "rfqItemId",
        rvi.offered_qty::float    AS "offeredQty",
        rvi.quoted_rate::float    AS "quotedRate",
        rvi.discount_pct::float   AS "discountPct",
        rvi.net_rate::float       AS "netRate",
        rvi.tax_pct::float        AS "taxPct",
        rvi.total_amount::float   AS "totalAmount",
        rvi.is_l1                 AS "isL1",
        rvi.is_awarded            AS "isAwarded",
        rvi.remarks               AS "remarks",
        rv.delivery_lead_time_days AS "leadTimeDays",
        rv.payment_terms          AS "paymentTerms",
        rv.vendor_quote_ref       AS "vendorQuoteRef"
      FROM tbl_rfq_vendor_item rvi
      JOIN tbl_rfq_vendor rv ON rv.rfq_vendor_id = rvi.rfq_vendor_id
      JOIN tbl_crm_party p ON p.party_id = rv.party_id
      WHERE rv.rfq_id = $1 AND rvi.is_active = true
      ORDER BY rvi.rfq_item_id ASC, rvi.net_rate ASC
      `,
      [rfqId],
    );

    // Group quotes by rfq_item_id
    const itemQuotesMap: Record<number, any[]> = {};
    for (const q of quotes) {
      if (!itemQuotesMap[q.rfqItemId]) {
        itemQuotesMap[q.rfqItemId] = [];
      }
      itemQuotesMap[q.rfqItemId].push(q);
    }

    // Build matrix per line item
    const comparisonItems = rfq.items.map((item: any) => {
      const itemQuotes = itemQuotesMap[item.rfqItemId] || [];

      // Sort by netRate asc to verify L1 rank
      const rankedQuotes = [...itemQuotes].sort((a, b) => a.netRate - b.netRate);
      const l1Bid = rankedQuotes[0] || null;

      return {
        ...item,
        quotes: itemQuotes,
        l1Quote: l1Bid
          ? {
              partyId: l1Bid.partyId,
              partyName: l1Bid.partyName,
              netRate: l1Bid.netRate,
              totalAmount: l1Bid.totalAmount,
              variancePct:
                item.targetRate > 0
                  ? Number((((l1Bid.netRate - item.targetRate) / item.targetRate) * 100).toFixed(2))
                  : 0,
            }
          : null,
      };
    });

    // Summary of invited vendors with quotes
    const vendorSummaries = rfq.vendors.map((v: any) => {
      const vendorQuotes = quotes.filter((q) => q.partyId === v.partyId);
      const totalQuoted = vendorQuotes.reduce((sum, q) => sum + (q.totalAmount || 0), 0);
      const l1WinsCount = vendorQuotes.filter((q) => q.isL1).length;

      return {
        ...v,
        quotesCount: vendorQuotes.length,
        totalQuotedAmount: totalQuoted,
        l1WinsCount,
      };
    });

    return {
      rfq,
      comparisonItems,
      vendorSummaries,
    };
  }

  // ==========================================================================
  // CREATE RFQ
  // ==========================================================================

  async createRfq(
    dto: CreateRfqDto,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('RFQ must contain at least one line item');
    }

    // Generate RFQ number if blank
    let rfqNo = dto.rfqNo?.trim().toUpperCase();
    if (!rfqNo || rfqNo === 'AUTO') {
      const yearStr = new Date().getFullYear().toString().slice(-2);
      const nextYearStr = (new Date().getFullYear() + 1).toString().slice(-2);
      const { rows: countRes } = await this.pool.query(
        `SELECT COUNT(*)::int AS count FROM tbl_rfq_header WHERE comp_id = $1`,
        [compId],
      );
      const seq = (Number(countRes[0]?.count) || 0) + 1;
      rfqNo = `RFQ-AHM-${yearStr}${nextYearStr}-${seq.toString().padStart(4, '0')}`;
    }

    // Duplicate check
    const { rows: existing } = await this.pool.query(
      `SELECT rfq_id FROM tbl_rfq_header WHERE comp_id = $1 AND LOWER(rfq_no) = LOWER($2)`,
      [compId, rfqNo],
    );
    if (existing.length > 0) {
      throw new ConflictException(`RFQ number "${rfqNo}" already exists for this company.`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const insertHeaderSql = `
        INSERT INTO tbl_rfq_header (
          rfq_no, rfq_date, due_date, warehouse_id, status,
          payment_terms, delivery_terms, remarks, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, COALESCE($2, CURRENT_DATE), $3, $4, 'DRAFT',
          $5, $6, $7, true,
          $8, $9, $10, $11
        ) RETURNING rfq_id
      `;

      const headerRes = await client.query(insertHeaderSql, [
        rfqNo,
        dto.rfqDate || null,
        dto.dueDate,
        dto.warehouseId,
        dto.paymentTerms?.trim() || null,
        dto.deliveryTerms?.trim() || null,
        dto.remarks?.trim() || null,
        compId,
        branchId,
        fyearId,
        userId,
      ]);

      const rfqId = headerRes.rows[0].rfq_id;

      // Insert Line Items
      for (const it of dto.items) {
        await client.query(
          `
          INSERT INTO tbl_rfq_item (
            rfq_id, pr_item_id, item_id, uom_id, required_qty, target_rate,
            technical_specs, is_active, comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, true, $8, $9, $10, $11
          )
          `,
          [
            rfqId,
            it.prItemId || null,
            it.itemId,
            it.uomId,
            it.requiredQty,
            it.targetRate || 0,
            it.technicalSpecs?.trim() || null,
            compId,
            branchId,
            fyearId,
            userId,
          ],
        );
      }

      // Insert Invited Vendors
      if (Array.isArray(dto.vendorPartyIds) && dto.vendorPartyIds.length > 0) {
        for (const partyId of dto.vendorPartyIds) {
          await client.query(
            `
            INSERT INTO tbl_rfq_vendor (
              rfq_id, party_id, status, is_active,
              comp_id, branch_id, fyear_id, created_by
            ) VALUES (
              $1, $2, 'INVITED', true,
              $3, $4, $5, $6
            ) ON CONFLICT (rfq_id, party_id) DO NOTHING
            `,
            [rfqId, partyId, compId, branchId, fyearId, userId],
          );
        }
      }

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PROCUREMENT_RFQ',
        actionType: 'ADD',
        entityTable: 'tbl_rfq_header',
        recordId: rfqId,
        oldValue: null,
        newValue: {
          rfqId,
          rfqNo,
          dueDate: dto.dueDate,
          itemsCount: dto.items.length,
          vendorsCount: dto.vendorPartyIds?.length || 0,
        },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findRfqById(rfqId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // UPDATE RFQ
  // ==========================================================================

  async updateRfq(
    rfqId: number,
    dto: UpdateRfqDto,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const existing = await this.findRfqById(rfqId, user);

    if (existing.status === 'AWARDED' || existing.status === 'CANCELLED') {
      throw new BadRequestException(
        `Cannot edit an RFQ with status "${existing.status}".`,
      );
    }

    if (dto.rfqNo && dto.rfqNo.trim().toUpperCase() !== existing.rfqNo) {
      const cleanNo = dto.rfqNo.trim().toUpperCase();
      const { rows: conflict } = await this.pool.query(
        `SELECT rfq_id FROM tbl_rfq_header WHERE comp_id = $1 AND LOWER(rfq_no) = LOWER($2) AND rfq_id <> $3`,
        [compId, cleanNo, rfqId],
      );
      if (conflict.length > 0) {
        throw new ConflictException(`RFQ number "${cleanNo}" is already in use.`);
      }
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const updateHeaderSql = `
        UPDATE tbl_rfq_header
        SET
          rfq_no         = COALESCE($1, rfq_no),
          rfq_date       = COALESCE($2, rfq_date),
          due_date       = COALESCE($3, due_date),
          warehouse_id   = COALESCE($4, warehouse_id),
          payment_terms  = COALESCE($5, payment_terms),
          delivery_terms = COALESCE($6, delivery_terms),
          remarks        = COALESCE($7, remarks),
          updated_by     = $8,
          updated_date   = CURRENT_TIMESTAMP
        WHERE rfq_id = $9 AND comp_id = $10
      `;

      await client.query(updateHeaderSql, [
        dto.rfqNo ? dto.rfqNo.trim().toUpperCase() : null,
        dto.rfqDate || null,
        dto.dueDate || null,
        dto.warehouseId || null,
        dto.paymentTerms?.trim() || null,
        dto.deliveryTerms?.trim() || null,
        dto.remarks?.trim() || null,
        userId,
        rfqId,
        compId,
      ]);

      if (Array.isArray(dto.items)) {
        await client.query(`DELETE FROM tbl_rfq_item WHERE rfq_id = $1`, [rfqId]);
        for (const it of dto.items) {
          await client.query(
            `
            INSERT INTO tbl_rfq_item (
              rfq_id, pr_item_id, item_id, uom_id, required_qty, target_rate,
              technical_specs, is_active, comp_id, branch_id, fyear_id, created_by
            ) VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, true, $8, $9, $10, $11
            )
            `,
            [
              rfqId,
              it.prItemId || null,
              it.itemId,
              it.uomId,
              it.requiredQty,
              it.targetRate || 0,
              it.technicalSpecs?.trim() || null,
              compId,
              branchId,
              fyearId,
              userId,
            ],
          );
        }
      }

      if (Array.isArray(dto.vendorPartyIds)) {
        // Retain vendors with quotes, add new ones
        for (const partyId of dto.vendorPartyIds) {
          await client.query(
            `
            INSERT INTO tbl_rfq_vendor (
              rfq_id, party_id, status, is_active,
              comp_id, branch_id, fyear_id, created_by
            ) VALUES (
              $1, $2, 'INVITED', true,
              $3, $4, $5, $6
            ) ON CONFLICT (rfq_id, party_id) DO NOTHING
            `,
            [rfqId, partyId, compId, branchId, fyearId, userId],
          );
        }
      }

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PROCUREMENT_RFQ',
        actionType: 'EDIT',
        entityTable: 'tbl_rfq_header',
        recordId: rfqId,
        oldValue: { rfqNo: existing.rfqNo, dueDate: existing.dueDate },
        newValue: { rfqNo: dto.rfqNo || existing.rfqNo, dueDate: dto.dueDate || existing.dueDate },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findRfqById(rfqId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // SEND RFQ (ISSUE TO VENDORS)
  // ==========================================================================

  async sendRfq(rfqId: number, user: AuthenticatedUserContext, meta?: AuditMetadata) {
    const compId = user.compId || 1001;
    const existing = await this.findRfqById(rfqId, user);

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only DRAFT RFQs can be issued to vendors. Current status: ${existing.status}`,
      );
    }

    if (existing.vendors.length === 0) {
      throw new BadRequestException('Please invite at least one supplier vendor before sending the RFQ.');
    }

    await this.pool.query(
      `
      UPDATE tbl_rfq_header
      SET status = 'SENT', updated_by = $1, updated_date = CURRENT_TIMESTAMP
      WHERE rfq_id = $2 AND comp_id = $3
      `,
      [user.userId, rfqId, compId],
    );

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'PROCUREMENT_RFQ',
      actionType: 'SEND',
      entityTable: 'tbl_rfq_header',
      recordId: rfqId,
      oldValue: { status: 'DRAFT' },
      newValue: { status: 'SENT', invitedVendors: existing.vendors.length },
      compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return this.findRfqById(rfqId, user);
  }

  // ==========================================================================
  // RECORD VENDOR QUOTATION & RECALCULATE L1 BIDS
  // ==========================================================================

  async recordVendorQuote(
    rfqId: number,
    vendorPartyId: number,
    dto: RecordVendorQuoteDto,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const rfq = await this.findRfqById(rfqId, user);

    if (rfq.status === 'AWARDED' || rfq.status === 'CANCELLED') {
      throw new BadRequestException(
        `Cannot record quotations on an RFQ with status "${rfq.status}".`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Ensure vendor is in tbl_rfq_vendor
      let rfqVendorId: number;
      const { rows: vRows } = await client.query(
        `SELECT rfq_vendor_id FROM tbl_rfq_vendor WHERE rfq_id = $1 AND party_id = $2`,
        [rfqId, vendorPartyId],
      );

      if (vRows.length > 0) {
        rfqVendorId = vRows[0].rfq_vendor_id;
      } else {
        const { rows: newV } = await client.query(
          `
          INSERT INTO tbl_rfq_vendor (
            rfq_id, party_id, status, is_active, comp_id, branch_id, fyear_id, created_by
          ) VALUES ($1, $2, 'QUOTED', true, $3, $4, $5, $6)
          RETURNING rfq_vendor_id
          `,
          [rfqId, vendorPartyId, compId, branchId, fyearId, userId],
        );
        rfqVendorId = newV[0].rfq_vendor_id;
      }

      // Insert or Update quotation line items
      let grandTotalQuote = 0;

      for (const it of dto.items) {
        const quotedRate = Number(it.quotedRate) || 0;
        const discountPct = Number(it.discountPct) || 0;
        const netRate = Number((quotedRate * (1 - discountPct / 100)).toFixed(4));
        const taxPct = it.taxPct !== undefined ? Number(it.taxPct) : 18.0;
        const offeredQty = Number(it.offeredQty) || 0;
        const lineTotal = Number((netRate * offeredQty * (1 + taxPct / 100)).toFixed(2));
        grandTotalQuote += lineTotal;

        await client.query(
          `
          INSERT INTO tbl_rfq_vendor_item (
            rfq_vendor_id, rfq_item_id, offered_qty, quoted_rate, discount_pct,
            net_rate, tax_pct, total_amount, remarks, is_active,
            comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, true,
            $10, $11, $12, $13
          )
          ON CONFLICT (rfq_vendor_id, rfq_item_id) DO UPDATE SET
            offered_qty  = EXCLUDED.offered_qty,
            quoted_rate  = EXCLUDED.quoted_rate,
            discount_pct = EXCLUDED.discount_pct,
            net_rate     = EXCLUDED.net_rate,
            tax_pct      = EXCLUDED.tax_pct,
            total_amount = EXCLUDED.total_amount,
            remarks      = EXCLUDED.remarks,
            updated_by   = $13,
            updated_date = CURRENT_TIMESTAMP
          `,
          [
            rfqVendorId,
            it.rfqItemId,
            offeredQty,
            quotedRate,
            discountPct,
            netRate,
            taxPct,
            lineTotal,
            it.remarks?.trim() || null,
            compId,
            branchId,
            fyearId,
            userId,
          ],
        );
      }

      // Update tbl_rfq_vendor
      await client.query(
        `
        UPDATE tbl_rfq_vendor
        SET
          status                  = 'QUOTED',
          vendor_quote_ref        = $1,
          quote_date              = $2,
          total_quote_amount      = $3,
          payment_terms           = $4,
          delivery_lead_time_days = $5,
          vendor_remarks          = $6,
          updated_by              = $7,
          updated_date            = CURRENT_TIMESTAMP
        WHERE rfq_vendor_id = $8
        `,
        [
          dto.vendorQuoteRef.trim(),
          dto.quoteDate,
          grandTotalQuote.toFixed(2),
          dto.paymentTerms?.trim() || null,
          dto.deliveryLeadTimeDays || 0,
          dto.vendorRemarks?.trim() || null,
          userId,
          rfqVendorId,
        ],
      );

      // Recalculate L1 bidder for each item in the RFQ
      for (const item of rfq.items) {
        // Reset all to FALSE first
        await client.query(
          `
          UPDATE tbl_rfq_vendor_item rvi
          SET is_l1 = false
          FROM tbl_rfq_vendor rv
          WHERE rvi.rfq_vendor_id = rv.rfq_vendor_id
            AND rv.rfq_id = $1
            AND rvi.rfq_item_id = $2
          `,
          [rfqId, item.rfqItemId],
        );

        // Find min net_rate > 0 and mark as L1
        await client.query(
          `
          UPDATE tbl_rfq_vendor_item
          SET is_l1 = true
          WHERE rfq_vendor_item_id = (
            SELECT rvi.rfq_vendor_item_id
            FROM tbl_rfq_vendor_item rvi
            JOIN tbl_rfq_vendor rv ON rv.rfq_vendor_id = rvi.rfq_vendor_id
            WHERE rv.rfq_id = $1 AND rvi.rfq_item_id = $2 AND rvi.net_rate > 0 AND rvi.is_active = true
            ORDER BY rvi.net_rate ASC, rvi.total_amount ASC
            LIMIT 1
          )
          `,
          [rfqId, item.rfqItemId],
        );
      }

      // Update RFQ Header status to COMPARISON_DONE
      await client.query(
        `
        UPDATE tbl_rfq_header
        SET status = 'COMPARISON_DONE', updated_by = $1, updated_date = CURRENT_TIMESTAMP
        WHERE rfq_id = $2 AND comp_id = $3
        `,
        [userId, rfqId, compId],
      );

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PROCUREMENT_RFQ',
        actionType: 'EDIT',
        entityTable: 'tbl_rfq_vendor',
        recordId: rfqVendorId,
        oldValue: null,
        newValue: {
          rfqId,
          vendorPartyId,
          vendorQuoteRef: dto.vendorQuoteRef,
          totalQuoteAmount: grandTotalQuote,
        },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.getComparativeStatement(rfqId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // AWARD RFQ (FINALIZE COMPARATIVE STATEMENT)
  // ==========================================================================

  async awardRfq(
    rfqId: number,
    dto: AwardRfqDto,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;

    const rfq = await this.findRfqById(rfqId, user);

    if (rfq.status === 'AWARDED') {
      throw new BadRequestException('This RFQ has already been awarded.');
    }

    if (!dto.awardedRemarks?.trim()) {
      throw new BadRequestException('Award remarks / selection justification is mandatory.');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Update RFQ header
      await client.query(
        `
        UPDATE tbl_rfq_header
        SET
          status            = 'AWARDED',
          awarded_vendor_id = $1,
          awarded_date      = CURRENT_TIMESTAMP,
          awarded_remarks   = $2,
          updated_by        = $3,
          updated_date      = CURRENT_TIMESTAMP
        WHERE rfq_id = $4 AND comp_id = $5
        `,
        [dto.awardedVendorId, dto.awardedRemarks.trim(), userId, rfqId, compId],
      );

      // Mark vendor as SELECTED in tbl_rfq_vendor
      await client.query(
        `
        UPDATE tbl_rfq_vendor
        SET status = CASE WHEN party_id = $1 THEN 'SELECTED' ELSE status END
        WHERE rfq_id = $2
        `,
        [dto.awardedVendorId, rfqId],
      );

      // Mark line items as awarded
      await client.query(
        `
        UPDATE tbl_rfq_vendor_item rvi
        SET is_awarded = (rv.party_id = $1)
        FROM tbl_rfq_vendor rv
        WHERE rvi.rfq_vendor_id = rv.rfq_vendor_id
          AND rv.rfq_id = $2
        `,
        [dto.awardedVendorId, rfqId],
      );

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PROCUREMENT_RFQ',
        actionType: 'FINALIZE',
        entityTable: 'tbl_rfq_header',
        recordId: rfqId,
        oldValue: { status: rfq.status },
        newValue: {
          status: 'AWARDED',
          awardedVendorId: dto.awardedVendorId,
          awardedRemarks: dto.awardedRemarks,
        },
        compId,
        branchId: user.branchId,
        fyearId: user.fyearId,
        ...meta,
      });

      return this.findRfqById(rfqId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // DELETE RFQ
  // ==========================================================================

  async deleteRfq(
    rfqId: number,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const existing = await this.findRfqById(rfqId, user);

    if (existing.status !== 'DRAFT' && existing.status !== 'CANCELLED') {
      throw new BadRequestException(
        `Cannot delete an RFQ with status "${existing.status}". Only DRAFT or CANCELLED RFQs can be deleted.`,
      );
    }

    // Dependency check for Purchase Orders
    await this.dependencyCheckService.verifyCanDelete({
      entity: 'tbl_rfq_header',
      entityId: rfqId,
      relations: [
        {
          table: 'tbl_po_item',
          column: 'rfq_id',
          label: 'Purchase Orders',
        },
      ],
    });

    await this.pool.query(
      `DELETE FROM tbl_rfq_header WHERE rfq_id = $1 AND comp_id = $2`,
      [rfqId, compId],
    );

    // Audit Log
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'PROCUREMENT_RFQ',
      actionType: 'DELETE',
      entityTable: 'tbl_rfq_header',
      recordId: rfqId,
      oldValue: { rfqId, rfqNo: existing.rfqNo, status: existing.status },
      newValue: null,
      compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return {
      success: true,
      message: `RFQ ${existing.rfqNo} deleted successfully`,
    };
  }

  // ==========================================================================
  // ACTION AUDIT LOGGING
  // ==========================================================================

  async recordScreenAction(
    actionType: 'PRINT' | 'EXPORT',
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'PROCUREMENT_RFQ',
      actionType,
      entityTable: 'tbl_rfq_header',
      recordId: 0,
      oldValue: null,
      newValue: { actionType, screenCode: 'PROCUREMENT_RFQ' },
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });
    return { logged: true };
  }
}
