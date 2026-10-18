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
  CancelPurchaseOrderDto,
  CreatePurchaseOrderDto,
  PurchaseOrderFilterDto,
  ReleasePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from './purchase-order.dto';

export interface AuditMetadata {
  ipAddress?: string;
  userAgent?: string;
  correlationId?: string;
}

@Injectable()
export class PurchaseOrderService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  // ==========================================================================
  // KPI SUMMARY
  // ==========================================================================

  async getPurchaseOrderSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const { rows } = await this.pool.query(
      `
      SELECT
        COUNT(*)::int AS "totalPos",
        COUNT(CASE WHEN status IN ('SUBMITTED', 'APPROVED') THEN 1 END)::int AS "pendingReleaseCount",
        COUNT(CASE WHEN status = 'RELEASED' THEN 1 END)::int AS "releasedCount",
        COUNT(CASE WHEN status = 'PARTIALLY_RECEIVED' THEN 1 END)::int AS "partiallyReceivedCount",
        COALESCE(SUM(CASE WHEN status NOT IN ('CANCELLED') THEN net_total_amount ELSE 0 END), 0)::float AS "totalSpendValue"
      FROM tbl_po_header
      WHERE comp_id = $1 AND is_active = true
      `,
      [compId],
    );

    const r = rows[0] || {};
    return {
      totalPos: Number(r.totalPos) || 0,
      pendingReleaseCount: Number(r.pendingReleaseCount) || 0,
      releasedCount: Number(r.releasedCount) || 0,
      partiallyReceivedCount: Number(r.partiallyReceivedCount) || 0,
      totalSpendValue: Number(r.totalSpendValue) || 0,
    };
  }

  // ==========================================================================
  // RETRIEVAL & LISTING
  // ==========================================================================

  async findAllPurchaseOrders(
    filters: PurchaseOrderFilterDto,
    user: AuthenticatedUserContext,
  ) {
    const compId = user.compId || 1001;
    const conditions: string[] = ['po.comp_id = $1', 'po.is_active = true'];
    const params: unknown[] = [compId];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`po.status = $${params.length}`);
    }

    if (filters.poType) {
      params.push(filters.poType);
      conditions.push(`po.po_type = $${params.length}`);
    }

    if (filters.vendorId) {
      params.push(filters.vendorId);
      conditions.push(`po.vendor_id = $${params.length}`);
    }

    if (filters.warehouseId) {
      params.push(filters.warehouseId);
      conditions.push(`po.warehouse_id = $${params.length}`);
    }

    if (filters.search) {
      params.push(`%${filters.search.trim().toLowerCase()}%`);
      conditions.push(
        `(LOWER(po.po_no) LIKE $${params.length} OR LOWER(p.party_name) LIKE $${params.length} OR LOWER(p.party_code) LIKE $${params.length} OR LOWER(w.warehouse_name) LIKE $${params.length})`,
      );
    }

    const whereClause = conditions.join(' AND ');

    const sql = `
      SELECT
        po.po_id                      AS "poId",
        po.po_no                      AS "poNo",
        TO_CHAR(po.po_date, 'YYYY-MM-DD') AS "poDate",
        TO_CHAR(po.delivery_due_date, 'YYYY-MM-DD') AS "deliveryDueDate",
        po.vendor_id                  AS "vendorId",
        p.party_code                  AS "vendorCode",
        p.party_name                  AS "vendorName",
        po.warehouse_id              AS "warehouseId",
        w.warehouse_code              AS "warehouseCode",
        w.warehouse_name              AS "warehouseName",
        po.rfq_id                     AS "rfqId",
        rfq.rfq_no                    AS "rfqNo",
        po.pr_id                      AS "prId",
        pr.pr_no                      AS "prNo",
        po.po_type                    AS "poType",
        po.status                     AS "status",
        po.payment_terms              AS "paymentTerms",
        po.delivery_terms             AS "deliveryTerms",
        po.freight_terms              AS "freightTerms",
        po.subtotal_amount::float     AS "subtotalAmount",
        po.discount_amount::float     AS "discountAmount",
        po.tax_amount::float          AS "taxAmount",
        po.roundoff_amount::float     AS "roundoffAmount",
        po.net_total_amount::float    AS "netTotalAmount",
        po.notes                      AS "notes",
        po.approved_by                AS "approvedBy",
        app_u.full_name               AS "approvedByName",
        po.approved_date              AS "approvedDate",
        po.released_by                AS "releasedBy",
        rel_u.full_name               AS "releasedByName",
        po.released_date              AS "releasedDate",
        po.cancellation_reason        AS "cancellationReason",
        po.is_active                  AS "isActive",
        po.created_date               AS "createdDate",
        COUNT(poi.po_item_id)::int    AS "itemsCount"
      FROM tbl_po_header po
      JOIN tbl_crm_party p ON p.party_id = po.vendor_id
      JOIN tbl_inv_warehouse w ON w.warehouse_id = po.warehouse_id
      LEFT JOIN tbl_rfq_header rfq ON rfq.rfq_id = po.rfq_id
      LEFT JOIN tbl_pr_header pr ON pr.pr_id = po.pr_id
      LEFT JOIN tbl_sec_user app_u ON app_u.user_id = po.approved_by
      LEFT JOIN tbl_sec_user rel_u ON rel_u.user_id = po.released_by
      LEFT JOIN tbl_po_item poi ON poi.po_id = po.po_id AND poi.is_active = true
      WHERE ${whereClause}
      GROUP BY po.po_id, p.party_code, p.party_name, w.warehouse_code, w.warehouse_name, rfq.rfq_no, pr.pr_no, app_u.full_name, rel_u.full_name
      ORDER BY po.po_date DESC, po.po_id DESC
    `;

    const { rows } = await this.pool.query(sql, params);
    return rows;
  }

  async findPurchaseOrderById(poId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const { rows } = await this.pool.query(
      `
      SELECT
        po.po_id                      AS "poId",
        po.po_no                      AS "poNo",
        TO_CHAR(po.po_date, 'YYYY-MM-DD') AS "poDate",
        TO_CHAR(po.delivery_due_date, 'YYYY-MM-DD') AS "deliveryDueDate",
        po.vendor_id                  AS "vendorId",
        p.party_code                  AS "vendorCode",
        p.party_name                  AS "vendorName",
        p.email                       AS "vendorEmail",
        p.phone                       AS "vendorPhone",
        p.gstin                       AS "vendorGstin",
        po.vendor_address_id          AS "vendorAddressId",
        po.warehouse_id              AS "warehouseId",
        w.warehouse_code              AS "warehouseCode",
        w.warehouse_name              AS "warehouseName",
        w.address_location            AS "warehouseAddress",
        po.rfq_id                     AS "rfqId",
        rfq.rfq_no                    AS "rfqNo",
        po.pr_id                      AS "prId",
        pr.pr_no                      AS "prNo",
        po.po_type                    AS "poType",
        po.status                     AS "status",
        po.payment_terms              AS "paymentTerms",
        po.delivery_terms             AS "deliveryTerms",
        po.freight_terms              AS "freightTerms",
        po.subtotal_amount::float     AS "subtotalAmount",
        po.discount_amount::float     AS "discountAmount",
        po.tax_amount::float          AS "taxAmount",
        po.roundoff_amount::float     AS "roundoffAmount",
        po.net_total_amount::float    AS "netTotalAmount",
        po.notes                      AS "notes",
        po.approved_by                AS "approvedBy",
        app_u.full_name               AS "approvedByName",
        po.approved_date              AS "approvedDate",
        po.released_by                AS "releasedBy",
        rel_u.full_name               AS "releasedByName",
        po.released_date              AS "releasedDate",
        po.cancellation_reason        AS "cancellationReason",
        po.is_active                  AS "isActive",
        po.created_date               AS "createdDate",
        po.updated_date               AS "updatedDate"
      FROM tbl_po_header po
      JOIN tbl_crm_party p ON p.party_id = po.vendor_id
      JOIN tbl_inv_warehouse w ON w.warehouse_id = po.warehouse_id
      LEFT JOIN tbl_rfq_header rfq ON rfq.rfq_id = po.rfq_id
      LEFT JOIN tbl_pr_header pr ON pr.pr_id = po.pr_id
      LEFT JOIN tbl_sec_user app_u ON app_u.user_id = po.approved_by
      LEFT JOIN tbl_sec_user rel_u ON rel_u.user_id = po.released_by
      WHERE po.po_id = $1 AND po.comp_id = $2
      `,
      [poId, compId],
    );

    if (rows.length === 0) {
      throw new NotFoundException(`Purchase Order with ID ${poId} not found`);
    }

    const header = rows[0];

    // Line items
    const { rows: items } = await this.pool.query(
      `
      SELECT
        poi.po_item_id            AS "poItemId",
        poi.po_id                 AS "poId",
        poi.pr_item_id             AS "prItemId",
        poi.rfq_item_id            AS "rfqItemId",
        poi.item_id               AS "itemId",
        i.item_code               AS "itemCode",
        i.item_name               AS "itemName",
        i.item_type               AS "itemType",
        poi.uom_id                AS "uomId",
        u.uom_code                AS "uomCode",
        u.uom_name                AS "uomName",
        poi.order_qty::float      AS "orderQty",
        poi.unit_rate::float      AS "unitRate",
        poi.discount_pct::float   AS "discountPct",
        poi.discount_amount::float AS "discountAmount",
        poi.tax_pct::float        AS "taxPct",
        poi.tax_amount::float     AS "taxAmount",
        poi.net_amount::float     AS "netAmount",
        poi.received_qty::float   AS "receivedQty",
        poi.billed_qty::float     AS "billedQty",
        TO_CHAR(poi.delivery_date, 'YYYY-MM-DD') AS "deliveryDate",
        poi.technical_specs       AS "technicalSpecs",
        poi.is_active             AS "isActive"
      FROM tbl_po_item poi
      JOIN tbl_inv_item i ON i.item_id = poi.item_id
      JOIN tbl_inv_uom u ON u.uom_id = poi.uom_id
      WHERE poi.po_id = $1 AND poi.is_active = true
      ORDER BY poi.po_item_id ASC
      `,
      [poId],
    );

    return {
      ...header,
      items,
    };
  }

  // ==========================================================================
  // CREATE PURCHASE ORDER
  // ==========================================================================

  async createPurchaseOrder(
    dto: CreatePurchaseOrderDto,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Purchase Order must contain at least one line item');
    }

    // Auto-generate PO number if blank
    let poNo = dto.poNo?.trim().toUpperCase();
    if (!poNo || poNo === 'AUTO') {
      const yearStr = new Date().getFullYear().toString().slice(-2);
      const nextYearStr = (new Date().getFullYear() + 1).toString().slice(-2);
      const { rows: countRes } = await this.pool.query(
        `SELECT COUNT(*)::int AS count FROM tbl_po_header WHERE comp_id = $1`,
        [compId],
      );
      const seq = (Number(countRes[0]?.count) || 0) + 1;
      poNo = `PO-AHM-${yearStr}${nextYearStr}-${seq.toString().padStart(4, '0')}`;
    }

    // Duplicate check
    const { rows: existing } = await this.pool.query(
      `SELECT po_id FROM tbl_po_header WHERE comp_id = $1 AND LOWER(po_no) = LOWER($2)`,
      [compId, poNo],
    );
    if (existing.length > 0) {
      throw new ConflictException(`Purchase Order number "${poNo}" already exists.`);
    }

    // Calculate line and header financials
    let totalSubtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    const lineCalculations = dto.items.map((it) => {
      const orderQty = Number(it.orderQty) || 0;
      const unitRate = Number(it.unitRate) || 0;
      const grossAmount = orderQty * unitRate;
      const discountPct = Number(it.discountPct) || 0;
      const discountAmount = Number(((grossAmount * discountPct) / 100).toFixed(2));
      const taxableAmount = grossAmount - discountAmount;
      const taxPct = it.taxPct !== undefined ? Number(it.taxPct) : 18.0;
      const taxAmount = Number(((taxableAmount * taxPct) / 100).toFixed(2));
      const netAmount = Number((taxableAmount + taxAmount).toFixed(2));

      totalSubtotal += grossAmount;
      totalDiscount += discountAmount;
      totalTax += taxAmount;

      return {
        ...it,
        grossAmount,
        discountAmount,
        taxPct,
        taxAmount,
        netAmount,
      };
    });

    const netBeforeRoundoff = totalSubtotal - totalDiscount + totalTax;
    const roundedNetTotal = Math.round(netBeforeRoundoff);
    const roundoffAmount = Number((roundedNetTotal - netBeforeRoundoff).toFixed(2));

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const insertHeaderSql = `
        INSERT INTO tbl_po_header (
          po_no, po_date, delivery_due_date, vendor_id, vendor_address_id, warehouse_id,
          rfq_id, pr_id, po_type, status, payment_terms, delivery_terms, freight_terms,
          subtotal_amount, discount_amount, tax_amount, roundoff_amount, net_total_amount,
          notes, is_active, comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, COALESCE($2, CURRENT_DATE), $3, $4, $5, $6,
          $7, $8, $9, 'DRAFT', $10, $11, $12,
          $13, $14, $15, $16, $17,
          $18, true, $19, $20, $21, $22
        ) RETURNING po_id
      `;

      const headerRes = await client.query(insertHeaderSql, [
        poNo,
        dto.poDate || null,
        dto.deliveryDueDate,
        dto.vendorId,
        dto.vendorAddressId || null,
        dto.warehouseId,
        dto.rfqId || null,
        dto.prId || null,
        dto.poType || 'STANDARD_PO',
        dto.paymentTerms?.trim() || null,
        dto.deliveryTerms?.trim() || null,
        dto.freightTerms?.trim() || null,
        totalSubtotal.toFixed(2),
        totalDiscount.toFixed(2),
        totalTax.toFixed(2),
        roundoffAmount.toFixed(2),
        roundedNetTotal.toFixed(2),
        dto.notes?.trim() || null,
        compId,
        branchId,
        fyearId,
        userId,
      ]);

      const poId = headerRes.rows[0].po_id;

      // Insert line items
      for (const line of lineCalculations) {
        await client.query(
          `
          INSERT INTO tbl_po_item (
            po_id, pr_item_id, rfq_item_id, item_id, uom_id,
            order_qty, unit_rate, discount_pct, discount_amount,
            tax_pct, tax_amount, net_amount, received_qty, billed_qty,
            delivery_date, technical_specs, is_active,
            comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12, 0.000, 0.000,
            $13, $14, true,
            $15, $16, $17, $18
          )
          `,
          [
            poId,
            line.prItemId || null,
            line.rfqItemId || null,
            line.itemId,
            line.uomId,
            line.orderQty,
            line.unitRate,
            line.discountPct,
            line.discountAmount,
            line.taxPct,
            line.taxAmount,
            line.netAmount,
            line.deliveryDate || dto.deliveryDueDate,
            line.technicalSpecs?.trim() || null,
            compId,
            branchId,
            fyearId,
            userId,
          ],
        );
      }

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PURCHASE_ORDER',
        actionType: 'ADD',
        entityTable: 'tbl_po_header',
        recordId: poId,
        oldValue: null,
        newValue: {
          poId,
          poNo,
          vendorId: dto.vendorId,
          netTotalAmount: roundedNetTotal,
          itemsCount: dto.items.length,
        },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findPurchaseOrderById(poId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // UPDATE PURCHASE ORDER
  // ==========================================================================

  async updatePurchaseOrder(
    poId: number,
    dto: UpdatePurchaseOrderDto,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const existing = await this.findPurchaseOrderById(poId, user);

    if (existing.status !== 'DRAFT' && existing.status !== 'SUBMITTED') {
      throw new BadRequestException(
        `Cannot edit a Purchase Order with status "${existing.status}". Only DRAFT or SUBMITTED orders can be modified.`,
      );
    }

    if (dto.poNo && dto.poNo.trim().toUpperCase() !== existing.poNo) {
      const cleanNo = dto.poNo.trim().toUpperCase();
      const { rows: conflict } = await this.pool.query(
        `SELECT po_id FROM tbl_po_header WHERE comp_id = $1 AND LOWER(po_no) = LOWER($2) AND po_id <> $3`,
        [compId, cleanNo, poId],
      );
      if (conflict.length > 0) {
        throw new ConflictException(`Purchase Order number "${cleanNo}" is already in use.`);
      }
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      let totalSubtotal = existing.subtotalAmount;
      let totalDiscount = existing.discountAmount;
      let totalTax = existing.taxAmount;
      let roundedNetTotal = existing.netTotalAmount;
      let roundoffAmount = existing.roundoffAmount;

      if (Array.isArray(dto.items) && dto.items.length > 0) {
        totalSubtotal = 0;
        totalDiscount = 0;
        totalTax = 0;

        const lineCalculations = dto.items.map((it) => {
          const orderQty = Number(it.orderQty) || 0;
          const unitRate = Number(it.unitRate) || 0;
          const grossAmount = orderQty * unitRate;
          const discountPct = Number(it.discountPct) || 0;
          const discountAmount = Number(((grossAmount * discountPct) / 100).toFixed(2));
          const taxableAmount = grossAmount - discountAmount;
          const taxPct = it.taxPct !== undefined ? Number(it.taxPct) : 18.0;
          const taxAmount = Number(((taxableAmount * taxPct) / 100).toFixed(2));
          const netAmount = Number((taxableAmount + taxAmount).toFixed(2));

          totalSubtotal += grossAmount;
          totalDiscount += discountAmount;
          totalTax += taxAmount;

          return {
            ...it,
            grossAmount,
            discountAmount,
            taxPct,
            taxAmount,
            netAmount,
          };
        });

        const netBeforeRoundoff = totalSubtotal - totalDiscount + totalTax;
        roundedNetTotal = Math.round(netBeforeRoundoff);
        roundoffAmount = Number((roundedNetTotal - netBeforeRoundoff).toFixed(2));

        // Delete old items and insert updated ones
        await client.query(`DELETE FROM tbl_po_item WHERE po_id = $1`, [poId]);

        for (const line of lineCalculations) {
          await client.query(
            `
            INSERT INTO tbl_po_item (
              po_id, pr_item_id, rfq_item_id, item_id, uom_id,
              order_qty, unit_rate, discount_pct, discount_amount,
              tax_pct, tax_amount, net_amount, received_qty, billed_qty,
              delivery_date, technical_specs, is_active,
              comp_id, branch_id, fyear_id, created_by
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9,
              $10, $11, $12, 0.000, 0.000,
              $13, $14, true,
              $15, $16, $17, $18
            )
            `,
            [
              poId,
              line.prItemId || null,
              line.rfqItemId || null,
              line.itemId,
              line.uomId,
              line.orderQty,
              line.unitRate,
              line.discountPct,
              line.discountAmount,
              line.taxPct,
              line.taxAmount,
              line.netAmount,
              line.deliveryDate || dto.deliveryDueDate || existing.deliveryDueDate,
              line.technicalSpecs?.trim() || null,
              compId,
              branchId,
              fyearId,
              userId,
            ],
          );
        }
      }

      const updateHeaderSql = `
        UPDATE tbl_po_header
        SET
          po_no             = COALESCE($1, po_no),
          po_date           = COALESCE($2, po_date),
          delivery_due_date = COALESCE($3, delivery_due_date),
          vendor_id         = COALESCE($4, vendor_id),
          warehouse_id      = COALESCE($5, warehouse_id),
          po_type           = COALESCE($6, po_type),
          payment_terms     = COALESCE($7, payment_terms),
          delivery_terms    = COALESCE($8, delivery_terms),
          freight_terms     = COALESCE($9, freight_terms),
          notes             = COALESCE($10, notes),
          subtotal_amount   = $11,
          discount_amount   = $12,
          tax_amount        = $13,
          roundoff_amount   = $14,
          net_total_amount  = $15,
          updated_by        = $16,
          updated_date      = CURRENT_TIMESTAMP
        WHERE po_id = $17 AND comp_id = $18
      `;

      await client.query(updateHeaderSql, [
        dto.poNo ? dto.poNo.trim().toUpperCase() : null,
        dto.poDate || null,
        dto.deliveryDueDate || null,
        dto.vendorId || null,
        dto.warehouseId || null,
        dto.poType || null,
        dto.paymentTerms?.trim() || null,
        dto.deliveryTerms?.trim() || null,
        dto.freightTerms?.trim() || null,
        dto.notes?.trim() || null,
        totalSubtotal.toFixed(2),
        totalDiscount.toFixed(2),
        totalTax.toFixed(2),
        roundoffAmount.toFixed(2),
        roundedNetTotal.toFixed(2),
        userId,
        poId,
        compId,
      ]);

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PURCHASE_ORDER',
        actionType: 'EDIT',
        entityTable: 'tbl_po_header',
        recordId: poId,
        oldValue: { poNo: existing.poNo, netTotalAmount: existing.netTotalAmount },
        newValue: { poNo: dto.poNo || existing.poNo, netTotalAmount: roundedNetTotal },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findPurchaseOrderById(poId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // SUBMIT PURCHASE ORDER (FOR RELEASE / APPROVAL)
  // ==========================================================================

  async submitPurchaseOrder(
    poId: number,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const existing = await this.findPurchaseOrderById(poId, user);

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only DRAFT purchase orders can be submitted for approval. Current status: ${existing.status}`,
      );
    }

    await this.pool.query(
      `
      UPDATE tbl_po_header
      SET status = 'SUBMITTED', updated_by = $1, updated_date = CURRENT_TIMESTAMP
      WHERE po_id = $2 AND comp_id = $3
      `,
      [user.userId, poId, compId],
    );

    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'PURCHASE_ORDER',
      actionType: 'SUBMIT',
      entityTable: 'tbl_po_header',
      recordId: poId,
      oldValue: { status: 'DRAFT' },
      newValue: { status: 'SUBMITTED' },
      compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return this.findPurchaseOrderById(poId, user);
  }

  // ==========================================================================
  // RELEASE & AUTHORIZE PURCHASE ORDER
  // ==========================================================================

  async releasePurchaseOrder(
    poId: number,
    dto: ReleasePurchaseOrderDto,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;
    const existing = await this.findPurchaseOrderById(poId, user);

    if (existing.status !== 'SUBMITTED' && existing.status !== 'APPROVED') {
      throw new BadRequestException(
        `Only SUBMITTED or APPROVED purchase orders can be released. Current status: ${existing.status}`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `
        UPDATE tbl_po_header
        SET
          status         = 'RELEASED',
          approved_by    = COALESCE(approved_by, $1),
          approved_date  = COALESCE(approved_date, CURRENT_TIMESTAMP),
          released_by    = $1,
          released_date  = CURRENT_TIMESTAMP,
          updated_by     = $1,
          updated_date   = CURRENT_TIMESTAMP
        WHERE po_id = $2 AND comp_id = $3
        `,
        [userId, poId, compId],
      );

      // Update ordered_qty on linked PR items if present
      for (const it of existing.items) {
        if (it.prItemId) {
          await client.query(
            `
            UPDATE tbl_pr_item
            SET ordered_qty = ordered_qty + $1
            WHERE pr_item_id = $2
            `,
            [it.orderQty, it.prItemId],
          );
        }
      }

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PURCHASE_ORDER',
        actionType: 'RELEASE',
        entityTable: 'tbl_po_header',
        recordId: poId,
        oldValue: { status: existing.status },
        newValue: {
          status: 'RELEASED',
          releasedBy: userId,
          releaseNotes: dto.releaseNotes,
        },
        compId,
        branchId: user.branchId,
        fyearId: user.fyearId,
        ...meta,
      });

      return this.findPurchaseOrderById(poId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // CANCEL PURCHASE ORDER
  // ==========================================================================

  async cancelPurchaseOrder(
    poId: number,
    dto: CancelPurchaseOrderDto,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const userId = user.userId || 1001;
    const existing = await this.findPurchaseOrderById(poId, user);

    if (existing.status === 'CANCELLED' || existing.status === 'CLOSED') {
      throw new BadRequestException(
        `Cannot cancel an order with status "${existing.status}".`,
      );
    }

    if (!dto.cancellationReason?.trim()) {
      throw new BadRequestException('Cancellation reason is mandatory.');
    }

    // Verify no goods have been received against this PO
    const hasReceipts = existing.items.some((it: any) => Number(it.receivedQty) > 0);
    if (hasReceipts) {
      throw new BadRequestException(
        'Cannot cancel this Purchase Order because goods have already been received on one or more line items.',
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `
        UPDATE tbl_po_header
        SET
          status              = 'CANCELLED',
          cancellation_reason = $1,
          updated_by          = $2,
          updated_date        = CURRENT_TIMESTAMP
        WHERE po_id = $3 AND comp_id = $4
        `,
        [dto.cancellationReason.trim(), userId, poId, compId],
      );

      // Revert ordered_qty on linked PR items
      for (const it of existing.items) {
        if (it.prItemId && existing.status === 'RELEASED') {
          await client.query(
            `
            UPDATE tbl_pr_item
            SET ordered_qty = GREATEST(0, ordered_qty - $1)
            WHERE pr_item_id = $2
            `,
            [it.orderQty, it.prItemId],
          );
        }
      }

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PURCHASE_ORDER',
        actionType: 'CANCEL',
        entityTable: 'tbl_po_header',
        recordId: poId,
        oldValue: { status: existing.status },
        newValue: { status: 'CANCELLED', reason: dto.cancellationReason },
        compId,
        branchId: user.branchId,
        fyearId: user.fyearId,
        ...meta,
      });

      return this.findPurchaseOrderById(poId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // ==========================================================================
  // DELETE PURCHASE ORDER
  // ==========================================================================

  async deletePurchaseOrder(
    poId: number,
    user: AuthenticatedUserContext,
    meta?: AuditMetadata,
  ) {
    const compId = user.compId || 1001;
    const existing = await this.findPurchaseOrderById(poId, user);

    if (existing.status !== 'DRAFT' && existing.status !== 'CANCELLED') {
      throw new BadRequestException(
        `Cannot delete a Purchase Order with status "${existing.status}". Only DRAFT or CANCELLED orders can be deleted.`,
      );
    }

    // Dependency check for Goods Receipt and Invoices
    await this.dependencyCheckService.verifyCanDelete({
      entity: 'tbl_po_header',
      entityId: poId,
      relations: [
        {
          table: 'tbl_grn_item',
          column: 'po_id',
          label: 'Goods Receipt Notes (GRN)',
        },
        {
          table: 'tbl_pi_item',
          column: 'po_id',
          label: 'Purchase Invoices',
        },
      ],
    });

    await this.pool.query(
      `DELETE FROM tbl_po_header WHERE po_id = $1 AND comp_id = $2`,
      [poId, compId],
    );

    // Audit Log
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'PURCHASE_ORDER',
      actionType: 'DELETE',
      entityTable: 'tbl_po_header',
      recordId: poId,
      oldValue: { poId, poNo: existing.poNo, status: existing.status },
      newValue: null,
      compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });

    return {
      success: true,
      message: `Purchase Order ${existing.poNo} deleted successfully`,
    };
  }

  // ==========================================================================
  // SCREEN ACTION AUDIT LOGGING
  // ==========================================================================

  async recordScreenAction(
    actionType: 'PRINT' | 'EXPORT',
    user: AuthenticatedUserContext,
    meta: AuditMetadata,
  ) {
    await this.auditLogService.logAction({
      userId: user.userId,
      username: user.username,
      screenCode: 'PURCHASE_ORDER',
      actionType,
      entityTable: 'tbl_po_header',
      recordId: 0,
      oldValue: null,
      newValue: { actionType, screenCode: 'PURCHASE_ORDER' },
      compId: user.compId,
      branchId: user.branchId,
      fyearId: user.fyearId,
      ...meta,
    });
    return { logged: true };
  }
}
