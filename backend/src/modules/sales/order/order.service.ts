import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Pool } from 'pg';
import { DRIZZLE_DB, PG_POOL } from '../../../database/database.module';
import type { DrizzleDb } from '../../../database/database.module';
import { AuditLogService } from '../../../common/services/audit-log.service';
import {
  CreateOrderDto,
  UpdateOrderDto,
  ConfirmOrderDto,
  HoldOrderDto,
  CreditOverrideDto,
  CreateWorkOrderDto,
  ReserveStockDto,
  OrderItemDto,
} from './order.dto';

interface AuthenticatedUserContext {
  userId: number;
  username?: string;
  compId: number;
  branchId: number;
  fyearId?: number;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly drizzle: DrizzleDb,
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
  ) {}

  // --------------------------------------------------------------------------
  // 1. Executive Summary & KPI Metrics
  // --------------------------------------------------------------------------
  async getSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const res = await this.pool.query(
      `SELECT
         COUNT(*)::INT AS total_orders,
         COUNT(CASE WHEN status IN ('CONFIRMED', 'IN_PRODUCTION', 'READY_FOR_DISPATCH') THEN 1 END)::INT AS active_orders_count,
         COALESCE(SUM(CASE WHEN status IN ('CONFIRMED', 'IN_PRODUCTION', 'READY_FOR_DISPATCH') THEN grand_total ELSE 0 END), 0)::FLOAT AS active_orders_value,
         COUNT(CASE WHEN atp_reservation_status IN ('PENDING', 'PARTIAL') AND status != 'CANCELLED' THEN 1 END)::INT AS pending_atp_count,
         COUNT(CASE WHEN is_credit_limit_exceeded = TRUE OR status = 'ON_HOLD' THEN 1 END)::INT AS on_hold_count,
         COUNT(CASE WHEN status = 'READY_FOR_DISPATCH' THEN 1 END)::INT AS ready_dispatch_count,
         COALESCE(SUM(CASE WHEN is_active = TRUE AND status != 'CANCELLED' THEN grand_total ELSE 0 END), 0)::FLOAT AS total_order_value
       FROM tbl_sales_order_header
       WHERE comp_id = $1 AND is_active = TRUE;`,
      [compId],
    );

    const row = res.rows[0];
    return {
      totalOrders: Number(row?.total_orders || 0),
      activeOrdersCount: Number(row?.active_orders_count || 0),
      activeOrdersValue: Number(row?.active_orders_value || 0),
      pendingAtpCount: Number(row?.pending_atp_count || 0),
      onHoldCount: Number(row?.on_hold_count || 0),
      readyDispatchCount: Number(row?.ready_dispatch_count || 0),
      totalOrderValue: Number(row?.total_order_value || 0),
    };
  }

  // --------------------------------------------------------------------------
  // 2. Comprehensive Lookups
  // --------------------------------------------------------------------------
  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    // 1. Customers
    const custRes = await this.pool.query(
      `SELECT
         p.party_id,
         p.party_code,
         p.party_name,
         p.trade_name,
         p.credit_limit::FLOAT AS credit_limit,
         p.credit_days,
         p.payment_terms,
         p.pan_no,
         p.primary_contact_name,
         p.primary_email,
         p.primary_phone,
         p.currency_code,
         COALESCE(
           (SELECT SUM(so.grand_total)::FLOAT
            FROM tbl_sales_order_header so
            WHERE so.customer_id = p.party_id
              AND so.status NOT IN ('CANCELLED', 'COMPLETED')
              AND so.is_active = TRUE),
           0
         ) AS current_exposure
       FROM tbl_crm_party p
       WHERE p.comp_id = $1
         AND p.is_customer = TRUE
         AND p.is_active = TRUE
       ORDER BY p.party_name ASC;`,
      [compId],
    );

    // 2. Customer addresses
    const addrRes = await this.pool.query(
      `SELECT
         address_id,
         party_id,
         address_type,
         address_line1,
         address_line2,
         city,
         state_code,
         state_name,
         pincode,
         gstin,
         is_default
       FROM tbl_crm_party_address
       WHERE is_active = TRUE
       ORDER BY address_id ASC;`,
    );

    // 3. Finished Goods / Saleable Items
    const itemRes = await this.pool.query(
      `SELECT
         i.item_id,
         i.item_code,
         i.item_name,
         i.description,
         i.item_type,
         i.hsn_code,
         i.uom_id,
         u.uom_code,
         u.uom_name,
         COALESCE(i.standard_selling_rate, 0)::FLOAT AS standard_selling_rate,
         COALESCE(i.default_gst_rate, 18.0)::FLOAT AS gst_rate,
         COALESCE(
           (SELECT SUM(bs.available_qty)::FLOAT
            FROM tbl_inv_bin_stock bs
            WHERE bs.item_id = i.item_id
              AND bs.is_active = TRUE),
           0
         ) AS total_available_stock
       FROM tbl_inv_item i
       JOIN tbl_inv_uom u ON i.uom_id = u.uom_id
       WHERE i.comp_id = $1
         AND i.is_active = TRUE
       ORDER BY i.item_name ASC;`,
      [compId],
    );

    // 4. UOMs
    const uomRes = await this.pool.query(
      `SELECT uom_id, uom_code, uom_name, precision_digits
       FROM tbl_inv_uom
       WHERE comp_id = $1 AND is_active = TRUE
       ORDER BY uom_name ASC;`,
      [compId],
    );

    // 5. Accepted Quotations eligible for SO generation
    const quotRes = await this.pool.query(
      `SELECT
         q.quotation_id,
         q.quotation_no,
         q.quotation_date,
         q.customer_id,
         q.customer_name,
         q.inquiry_ref_no,
         q.inquiry_date,
         q.grand_total::FLOAT AS grand_total,
         q.valid_until,
         q.status,
         q.payment_terms,
         q.delivery_terms,
         q.shipping_state_code,
         q.shipping_state_name,
         q.customer_gstin,
         q.converted_to_so_id
       FROM tbl_sales_quotation_header q
       WHERE q.comp_id = $1
         AND q.is_active = TRUE
         AND q.status IN ('ACCEPTED', 'SENT')
       ORDER BY q.quotation_date DESC;`,
      [compId],
    );

    // 6. FG Warehouses & Bins
    const whRes = await this.pool.query(
      `SELECT
         w.warehouse_id,
         w.warehouse_code,
         w.warehouse_name,
         w.warehouse_type
       FROM tbl_inv_warehouse w
       WHERE w.comp_id = $1 AND w.is_active = TRUE
       ORDER BY w.warehouse_name ASC;`,
      [compId],
    );

    const binRes = await this.pool.query(
      `SELECT
         b.bin_id,
         b.warehouse_id,
         b.bin_code,
         b.bin_name,
         b.zone_code
       FROM tbl_inv_storage_bin b
       WHERE b.comp_id = $1 AND b.is_active = TRUE
       ORDER BY b.bin_code ASC;`,
      [compId],
    );

    // 7. Active FG Bin Stock for ATP Allocation
    const atpStockRes = await this.pool.query(
      `SELECT
         bs.bin_stock_id,
         bs.warehouse_id,
         w.warehouse_code,
         w.warehouse_name,
         bs.bin_id,
         sb.bin_code,
         sb.bin_name,
         bs.item_id,
         i.item_code,
         i.item_name,
         bs.batch_no,
         bs.heat_no,
         bs.on_hand_qty::FLOAT AS on_hand_qty,
         bs.reserved_qty::FLOAT AS reserved_qty,
         bs.available_qty::FLOAT AS available_qty,
         bs.unit_cost::FLOAT AS unit_cost
       FROM tbl_inv_bin_stock bs
       JOIN tbl_inv_warehouse w ON bs.warehouse_id = w.warehouse_id
       JOIN tbl_inv_storage_bin sb ON bs.bin_id = sb.bin_id
       JOIN tbl_inv_item i ON bs.item_id = i.item_id
       WHERE bs.comp_id = $1
         AND bs.available_qty > 0
         AND bs.is_active = TRUE
       ORDER BY i.item_code ASC, bs.available_qty DESC;`,
      [compId],
    );

    return {
      customers: custRes.rows,
      addresses: addrRes.rows,
      items: itemRes.rows,
      uoms: uomRes.rows,
      quotations: quotRes.rows,
      warehouses: whRes.rows,
      bins: binRes.rows,
      atpStock: atpStockRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // 3. Find All Sales Orders (Search & Filters)
  // --------------------------------------------------------------------------
  async findAll(query: any, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    let sqlQuery = `
      SELECT
        so.so_id,
        so.so_no,
        so.so_date,
        so.quotation_id,
        q.quotation_no,
        so.customer_id,
        so.customer_name,
        so.customer_po_no,
        so.customer_po_date,
        so.contact_person,
        so.contact_email,
        so.contact_phone,
        so.shipping_state_code,
        so.shipping_state_name,
        so.customer_gstin,
        so.payment_terms,
        so.delivery_terms,
        so.target_delivery_date,
        so.customer_credit_limit::FLOAT AS customer_credit_limit,
        so.current_credit_exposure::FLOAT AS current_credit_exposure,
        so.is_credit_limit_exceeded,
        so.credit_override_by,
        u_ovr.full_name AS credit_override_by_name,
        so.credit_override_at,
        so.credit_override_reason,
        so.subtotal_amount::FLOAT AS subtotal_amount,
        so.discount_amount::FLOAT AS discount_amount,
        so.taxable_amount::FLOAT AS taxable_amount,
        so.total_tax_amount::FLOAT AS total_tax_amount,
        so.freight_charges::FLOAT AS freight_charges,
        so.packaging_charges::FLOAT AS packaging_charges,
        so.grand_total::FLOAT AS grand_total,
        so.status,
        so.atp_reservation_status,
        so.confirmed_by,
        u_cnf.full_name AS confirmed_by_name,
        so.confirmed_at,
        so.hold_reason,
        so.remarks,
        so.created_date,
        COUNT(item.so_item_id)::INT AS total_items,
        COALESCE(SUM(item.ordered_qty), 0)::FLOAT AS total_ordered_qty,
        COALESCE(SUM(item.reserved_qty), 0)::FLOAT AS total_reserved_qty,
        COALESCE(SUM(item.ordered_qty - item.reserved_qty), 0)::FLOAT AS total_deficit_qty,
        COUNT(CASE WHEN item.work_order_id IS NOT NULL THEN 1 END)::INT AS linked_work_orders_count
      FROM tbl_sales_order_header so
      LEFT JOIN tbl_sales_quotation_header q ON so.quotation_id = q.quotation_id
      LEFT JOIN tbl_sec_user u_cnf ON so.confirmed_by = u_cnf.user_id
      LEFT JOIN tbl_sec_user u_ovr ON so.credit_override_by = u_ovr.user_id
      LEFT JOIN tbl_sales_order_item item ON so.so_id = item.so_id AND item.is_active = TRUE
      WHERE so.comp_id = $1 AND so.is_active = TRUE
    `;

    const params: any[] = [compId];
    let paramIndex = 2;

    if (query?.status) {
      sqlQuery += ` AND so.status = $${paramIndex}`;
      params.push(query.status);
      paramIndex++;
    }

    if (query?.atpReservationStatus) {
      sqlQuery += ` AND so.atp_reservation_status = $${paramIndex}`;
      params.push(query.atpReservationStatus);
      paramIndex++;
    }

    if (query?.customerId) {
      sqlQuery += ` AND so.customer_id = $${paramIndex}`;
      params.push(Number(query.customerId));
      paramIndex++;
    }

    if (query?.isHold === 'true' || query?.isHold === true) {
      sqlQuery += ` AND (so.status = 'ON_HOLD' OR so.is_credit_limit_exceeded = TRUE)`;
    }

    if (query?.search) {
      const term = `%${query.search.trim().toLowerCase()}%`;
      sqlQuery += ` AND (
        LOWER(so.so_no) LIKE $${paramIndex}
        OR LOWER(so.customer_name) LIKE $${paramIndex}
        OR LOWER(COALESCE(so.customer_po_no, '')) LIKE $${paramIndex}
        OR LOWER(COALESCE(q.quotation_no, '')) LIKE $${paramIndex}
      )`;
      params.push(term);
      paramIndex++;
    }

    sqlQuery += `
      GROUP BY so.so_id, q.quotation_no, u_cnf.full_name, u_ovr.full_name
      ORDER BY so.so_id DESC;
    `;

    const res = await this.pool.query(sqlQuery, params);
    return res.rows;
  }

  // --------------------------------------------------------------------------
  // 4. Find One Sales Order (Detailed Header, Line Items & Live ATP Status)
  // --------------------------------------------------------------------------
  async findOne(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const headRes = await this.pool.query(
      `SELECT
         so.*,
         so.customer_credit_limit::FLOAT AS customer_credit_limit,
         so.current_credit_exposure::FLOAT AS current_credit_exposure,
         so.subtotal_amount::FLOAT AS subtotal_amount,
         so.discount_percent::FLOAT AS discount_percent,
         so.discount_amount::FLOAT AS discount_amount,
         so.taxable_amount::FLOAT AS taxable_amount,
         so.cgst_amount::FLOAT AS cgst_amount,
         so.sgst_amount::FLOAT AS sgst_amount,
         so.igst_amount::FLOAT AS igst_amount,
         so.total_tax_amount::FLOAT AS total_tax_amount,
         so.freight_charges::FLOAT AS freight_charges,
         so.packaging_charges::FLOAT AS packaging_charges,
         so.round_off::FLOAT AS round_off,
         so.grand_total::FLOAT AS grand_total,
         q.quotation_no,
         q.inquiry_ref_no,
         u_cnf.full_name AS confirmed_by_name,
         u_ovr.full_name AS credit_override_by_name,
         p.credit_limit::FLOAT AS master_credit_limit,
         COALESCE(
           (SELECT SUM(active_so.grand_total)::FLOAT
            FROM tbl_sales_order_header active_so
            WHERE active_so.customer_id = so.customer_id
              AND active_so.status NOT IN ('CANCELLED', 'COMPLETED')
              AND active_so.is_active = TRUE),
           0
         ) AS live_total_exposure
       FROM tbl_sales_order_header so
       LEFT JOIN tbl_sales_quotation_header q ON so.quotation_id = q.quotation_id
       LEFT JOIN tbl_sec_user u_cnf ON so.confirmed_by = u_cnf.user_id
       LEFT JOIN tbl_sec_user u_ovr ON so.credit_override_by = u_ovr.user_id
       LEFT JOIN tbl_crm_party p ON so.customer_id = p.party_id
       WHERE so.so_id = $1 AND so.comp_id = $2 AND so.is_active = TRUE;`,
      [id, compId],
    );

    if (headRes.rows.length === 0) {
      throw new NotFoundException(`Sales Order #${id} not found.`);
    }

    const header = headRes.rows[0];

    // Line items
    const itemRes = await this.pool.query(
      `SELECT
         i.*,
         i.ordered_qty::FLOAT AS ordered_qty,
         i.reserved_qty::FLOAT AS reserved_qty,
         i.delivered_qty::FLOAT AS delivered_qty,
         i.invoiced_qty::FLOAT AS invoiced_qty,
         i.cancelled_qty::FLOAT AS cancelled_qty,
         i.unit_rate::FLOAT AS unit_rate,
         i.gross_amount::FLOAT AS gross_amount,
         i.discount_percent::FLOAT AS discount_percent,
         i.discount_amount::FLOAT AS discount_amount,
         i.taxable_amount::FLOAT AS taxable_amount,
         i.gst_rate::FLOAT AS gst_rate,
         i.cgst_rate::FLOAT AS cgst_rate,
         i.cgst_amount::FLOAT AS cgst_amount,
         i.sgst_rate::FLOAT AS sgst_rate,
         i.sgst_amount::FLOAT AS sgst_amount,
         i.igst_rate::FLOAT AS igst_rate,
         i.igst_amount::FLOAT AS igst_amount,
         i.total_tax_amount::FLOAT AS total_tax_amount,
         i.total_amount::FLOAT AS total_amount,
         (i.ordered_qty - i.reserved_qty)::FLOAT AS deficit_qty,
         u.uom_code,
         u.uom_name,
         wo.wo_no AS work_order_no,
         wo.status AS work_order_status,
         COALESCE(
           (SELECT SUM(bs.available_qty)::FLOAT
            FROM tbl_inv_bin_stock bs
            WHERE bs.item_id = i.item_id
              AND bs.is_active = TRUE),
           0
         ) AS live_available_stock
       FROM tbl_sales_order_item i
       JOIN tbl_inv_uom u ON i.uom_id = u.uom_id
       LEFT JOIN tbl_mfg_wo_header wo ON i.work_order_id = wo.wo_id
       WHERE i.so_id = $1 AND i.is_active = TRUE
       ORDER BY i.item_sequence ASC, i.so_item_id ASC;`,
      [id],
    );

    return {
      ...header,
      items: itemRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // 5. Create Sales Order (Direct or from Quotation with Commercial Credit Check)
  // --------------------------------------------------------------------------
  async create(dto: CreateOrderDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one sales order line item is required.');
    }

    // 1. Fetch Customer Master & Credit Limit
    const custRes = await this.pool.query(
      `SELECT party_id, party_name, credit_limit::FLOAT AS credit_limit
       FROM tbl_crm_party
       WHERE party_id = $1 AND comp_id = $2;`,
      [dto.customerId, compId],
    );

    if (custRes.rows.length === 0) {
      throw new NotFoundException(`Customer party #${dto.customerId} not found.`);
    }

    const customer = custRes.rows[0];
    const customerCreditLimit = customer.credit_limit || 0;

    // 2. Fetch Existing Exposure
    const expRes = await this.pool.query(
      `SELECT COALESCE(SUM(grand_total), 0)::FLOAT AS existing_exposure
       FROM tbl_sales_order_header
       WHERE customer_id = $1
         AND comp_id = $2
         AND status NOT IN ('CANCELLED', 'COMPLETED')
         AND is_active = TRUE;`,
      [dto.customerId, compId],
    );
    const existingExposure = Number(expRes.rows[0]?.existing_exposure || 0);

    // 3. Tax & Value Calculations
    const isInterState = (dto.shippingStateCode || '24') !== '24';
    let subtotalAmount = 0;
    let totalTaxAmount = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;

    const processedItems = dto.items.map((item, idx) => {
      const qty = Number(item.orderedQty || 1);
      const rate = Number(item.unitRate || 0);
      const gross = qty * rate;
      const discPct = Number(item.discountPercent || 0);
      const discAmt = (gross * discPct) / 100;
      const taxable = gross - discAmt;
      const gstRate = Number(item.gstRate ?? 18);

      let cgstRate = 0;
      let cgstAmt = 0;
      let sgstRate = 0;
      let sgstAmt = 0;
      let igstRate = 0;
      let igstAmt = 0;

      if (isInterState) {
        igstRate = gstRate;
        igstAmt = (taxable * igstRate) / 100;
      } else {
        cgstRate = gstRate / 2;
        cgstAmt = (taxable * cgstRate) / 100;
        sgstRate = gstRate / 2;
        sgstAmt = (taxable * sgstRate) / 100;
      }

      const itemTax = cgstAmt + sgstAmt + igstAmt;
      const itemTotal = taxable + itemTax;

      subtotalAmount += taxable;
      totalTaxAmount += itemTax;
      totalCgst += cgstAmt;
      totalSgst += sgstAmt;
      totalIgst += igstAmt;

      return {
        ...item,
        itemSequence: item.itemSequence || idx + 1,
        orderedQty: qty,
        unitRate: rate,
        grossAmount: gross,
        discountPercent: discPct,
        discountAmount: discAmt,
        taxableAmount: taxable,
        gstRate,
        cgstRate,
        cgstAmount: cgstAmt,
        sgstRate,
        sgstAmount: sgstAmt,
        igstRate,
        igstAmount: igstAmt,
        totalTaxAmount: itemTax,
        totalAmount: itemTotal,
        reservedQty: 0,
        deliveredQty: 0,
        invoicedQty: 0,
        cancelledQty: 0,
        reservationStatus: 'PENDING',
      };
    });

    const freightCharges = Number(dto.freightCharges || 0);
    const packagingCharges = Number(dto.packagingCharges || 0);
    const calculatedGrandTotal = subtotalAmount + totalTaxAmount + freightCharges + packagingCharges;

    // 4. Commercial Credit Exposure Check
    const newTotalExposure = existingExposure + calculatedGrandTotal;
    const isCreditLimitExceeded = customerCreditLimit > 0 && newTotalExposure > customerCreditLimit;

    const initialStatus = isCreditLimitExceeded ? 'ON_HOLD' : 'DRAFT';
    const holdReason = isCreditLimitExceeded
      ? `Credit limit exceeded: Exposure ₹${newTotalExposure.toLocaleString('en-IN')} exceeds limit ₹${customerCreditLimit.toLocaleString('en-IN')}`
      : null;

    // 5. Sequence generation for SO No
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      let soNo = dto.soNo;
      if (!soNo) {
        const seqRes = await client.query(
          `SELECT nextval('seq_sales_order_id') AS next_id;`,
        );
        const nextId = seqRes.rows[0].next_id;
        soNo = `SO-AHM-2627-${String(nextId).padStart(4, '0')}`;
      }

      const soDate = dto.soDate || new Date().toISOString().split('T')[0];
      const targetDelivery = dto.targetDeliveryDate || new Date(Date.now() + 21 * 86400000).toISOString().split('T')[0];

      const insertHeaderSql = `
        INSERT INTO tbl_sales_order_header (
          so_no, so_date, quotation_id,
          customer_id, customer_name, customer_po_no, customer_po_date,
          contact_person, contact_email, contact_phone,
          billing_address_id, billing_address,
          shipping_address_id, shipping_address,
          shipping_state_code, shipping_state_name,
          customer_gstin, price_list_id,
          currency_code, exchange_rate,
          target_delivery_date, payment_terms, delivery_terms,
          customer_credit_limit, current_credit_exposure, is_credit_limit_exceeded,
          subtotal_amount, discount_percent, discount_amount, taxable_amount,
          cgst_amount, sgst_amount, igst_amount, total_tax_amount,
          freight_charges, packaging_charges, round_off, grand_total,
          status, atp_reservation_status,
          hold_reason, remarks, terms_and_conditions, is_active,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6, $7,
          $8, $9, $10,
          $11, $12,
          $13, $14,
          $15, $16,
          $17, $18,
          $19, $20,
          $21, $22, $23,
          $24, $25, $26,
          $27, $28, $29, $30,
          $31, $32, $33, $34,
          $35, $36, $37, $38,
          $39, $40,
          $41, $42, $43, TRUE,
          $44, $45, $46, $47
        ) RETURNING so_id;
      `;

      const headerValues = [
        soNo,
        soDate,
        dto.quotationId || null,
        dto.customerId,
        dto.customerName || customer.party_name,
        dto.customerPoNo || null,
        dto.customerPoDate || null,
        dto.contactPerson || null,
        dto.contactEmail || null,
        dto.contactPhone || null,
        dto.billingAddressId || null,
        dto.billingAddress || null,
        dto.shippingAddressId || null,
        dto.shippingAddress || null,
        dto.shippingStateCode || '24',
        dto.shippingStateName || 'Gujarat',
        dto.customerGstin || null,
        dto.priceListId || null,
        dto.currencyCode || 'INR',
        dto.exchangeRate || 1.0,
        targetDelivery,
        dto.paymentTerms || 'NET_30',
        dto.deliveryTerms || 'EX_WORKS',
        customerCreditLimit,
        newTotalExposure,
        isCreditLimitExceeded,
        subtotalAmount,
        dto.discountPercent || 0,
        0,
        subtotalAmount,
        totalCgst,
        totalSgst,
        totalIgst,
        totalTaxAmount,
        freightCharges,
        packagingCharges,
        0,
        calculatedGrandTotal,
        initialStatus,
        'PENDING',
        holdReason,
        dto.remarks || null,
        dto.termsAndConditions || null,
        compId,
        branchId,
        user.fyearId || 1001,
        userId,
      ];

      const headerRes = await client.query(insertHeaderSql, headerValues);
      const newSoId = headerRes.rows[0].so_id;

      // Insert line items
      for (const item of processedItems) {
        await client.query(
          `INSERT INTO tbl_sales_order_item (
             so_id, item_sequence, item_id, item_code, item_name,
             description, hsn_sac_code, uom_id,
             ordered_qty, reserved_qty, delivered_qty, invoiced_qty, cancelled_qty,
             unit_rate, gross_amount, discount_percent, discount_amount, taxable_amount,
             gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
             total_tax_amount, total_amount, target_delivery_date,
             reservation_status, remarks, is_active,
             comp_id, branch_id, fyear_id, created_by
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8,
             $9, $10, $11, $12, $13,
             $14, $15, $16, $17, $18,
             $19, $20, $21, $22, $23, $24, $25,
             $26, $27, $28,
             $29, $30, TRUE,
             $31, $32, $33, $34
           );`,
          [
            newSoId,
            item.itemSequence,
            item.itemId,
            item.itemCode || `ITEM-${item.itemId}`,
            item.itemName || 'Sale Item',
            item.description || null,
            item.hsnSacCode || null,
            item.uomId,
            item.orderedQty,
            0,
            0,
            0,
            0,
            item.unitRate,
            item.grossAmount,
            item.discountPercent,
            item.discountAmount,
            item.taxableAmount,
            item.gstRate,
            item.cgstRate,
            item.cgstAmount,
            item.sgstRate,
            item.sgstAmount,
            item.igstRate,
            item.igstAmount,
            item.totalTaxAmount,
            item.totalAmount,
            item.targetDeliveryDate || targetDelivery,
            'PENDING',
            item.remarks || null,
            compId,
            branchId,
            user.fyearId || 1001,
            userId,
          ],
        );
      }

      // If converted from quotation, update quotation record
      if (dto.quotationId) {
        await client.query(
          `UPDATE tbl_sales_quotation_header
           SET status = 'CONVERTED_TO_SO',
               converted_to_so_id = $1,
               converted_at = CURRENT_TIMESTAMP,
               updated_by = $2,
               updated_date = CURRENT_TIMESTAMP
           WHERE quotation_id = $3 AND comp_id = $4;`,
          [newSoId, userId, dto.quotationId, compId],
        );
      }

      await client.query('COMMIT');

      // Audit log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'SALES_ORDER',
        actionType: 'ADD',
        entityTable: 'tbl_sales_order_header',
        recordId: newSoId,
        newValue: {
          soNo,
          customerId: dto.customerId,
          grandTotal: calculatedGrandTotal,
          isCreditLimitExceeded,
          status: initialStatus,
        },
        compId,
        branchId,
      });

      return this.findOne(newSoId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to create sales order: ${err.message}`, err.stack);
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 6. Update Sales Order (Draft / On Hold)
  // --------------------------------------------------------------------------
  async update(id: number, dto: UpdateOrderDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    const currentOrder = await this.findOne(id, user);

    if (!['DRAFT', 'ON_HOLD'].includes(currentOrder.status)) {
      throw new BadRequestException(
        `Cannot update order in status '${currentOrder.status}'. Only DRAFT and ON_HOLD orders may be modified.`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const isInterState = (dto.shippingStateCode || currentOrder.shipping_state_code || '24') !== '24';
      let subtotalAmount = 0;
      let totalTaxAmount = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalIgst = 0;

      if (dto.items && dto.items.length > 0) {
        // Delete old items
        await client.query(
          `DELETE FROM tbl_sales_order_item WHERE so_id = $1;`,
          [id],
        );

        // Re-insert line items
        for (let idx = 0; idx < dto.items.length; idx++) {
          const item = dto.items[idx];
          const qty = Number(item.orderedQty || 1);
          const rate = Number(item.unitRate || 0);
          const gross = qty * rate;
          const discPct = Number(item.discountPercent || 0);
          const discAmt = (gross * discPct) / 100;
          const taxable = gross - discAmt;
          const gstRate = Number(item.gstRate ?? 18);

          let cgstRate = 0;
          let cgstAmt = 0;
          let sgstRate = 0;
          let sgstAmt = 0;
          let igstRate = 0;
          let igstAmt = 0;

          if (isInterState) {
            igstRate = gstRate;
            igstAmt = (taxable * igstRate) / 100;
          } else {
            cgstRate = gstRate / 2;
            cgstAmt = (taxable * cgstRate) / 100;
            sgstRate = gstRate / 2;
            sgstAmt = (taxable * sgstRate) / 100;
          }

          const itemTax = cgstAmt + sgstAmt + igstAmt;
          const itemTotal = taxable + itemTax;

          subtotalAmount += taxable;
          totalTaxAmount += itemTax;
          totalCgst += cgstAmt;
          totalSgst += sgstAmt;
          totalIgst += igstAmt;

          await client.query(
            `INSERT INTO tbl_sales_order_item (
               so_id, item_sequence, item_id, item_code, item_name,
               description, hsn_sac_code, uom_id,
               ordered_qty, reserved_qty, delivered_qty, invoiced_qty, cancelled_qty,
               unit_rate, gross_amount, discount_percent, discount_amount, taxable_amount,
               gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
               total_tax_amount, total_amount, target_delivery_date,
               reservation_status, remarks, is_active,
               comp_id, branch_id, fyear_id, created_by
             ) VALUES (
               $1, $2, $3, $4, $5,
               $6, $7, $8,
               $9, $10, $11, $12, $13,
               $14, $15, $16, $17, $18,
               $19, $20, $21, $22, $23, $24, $25,
               $26, $27, $28,
               $29, $30, TRUE,
               $31, $32, $33, $34
             );`,
            [
              id,
              item.itemSequence || idx + 1,
              item.itemId,
              item.itemCode || `ITEM-${item.itemId}`,
              item.itemName || 'Sale Item',
              item.description || null,
              item.hsnSacCode || null,
              item.uomId,
              qty,
              0,
              0,
              0,
              0,
              rate,
              gross,
              discPct,
              discAmt,
              taxable,
              gstRate,
              cgstRate,
              cgstAmt,
              sgstRate,
              sgstAmt,
              igstRate,
              igstAmt,
              itemTax,
              itemTotal,
              item.targetDeliveryDate || currentOrder.target_delivery_date,
              'PENDING',
              item.remarks || null,
              compId,
              branchId,
              user.fyearId || 1001,
              userId,
            ],
          );
        }
      } else {
        subtotalAmount = currentOrder.subtotal_amount;
        totalTaxAmount = currentOrder.total_tax_amount;
        totalCgst = currentOrder.cgst_amount;
        totalSgst = currentOrder.sgst_amount;
        totalIgst = currentOrder.igst_amount;
      }

      const freightCharges = dto.freightCharges !== undefined ? Number(dto.freightCharges) : currentOrder.freight_charges;
      const packagingCharges = dto.packagingCharges !== undefined ? Number(dto.packagingCharges) : currentOrder.packaging_charges;
      const grandTotal = subtotalAmount + totalTaxAmount + freightCharges + packagingCharges;

      // Update Header
      await client.query(
        `UPDATE tbl_sales_order_header
         SET
           customer_po_no = COALESCE($1, customer_po_no),
           customer_po_date = COALESCE($2, customer_po_date),
           contact_person = COALESCE($3, contact_person),
           contact_email = COALESCE($4, contact_email),
           contact_phone = COALESCE($5, contact_phone),
           billing_address = COALESCE($6, billing_address),
           shipping_address = COALESCE($7, shipping_address),
           payment_terms = COALESCE($8, payment_terms),
           delivery_terms = COALESCE($9, delivery_terms),
           target_delivery_date = COALESCE($10, target_delivery_date),
           subtotal_amount = $11,
           taxable_amount = $11,
           cgst_amount = $12,
           sgst_amount = $13,
           igst_amount = $14,
           total_tax_amount = $15,
           freight_charges = $16,
           packaging_charges = $17,
           grand_total = $18,
           remarks = COALESCE($19, remarks),
           terms_and_conditions = COALESCE($20, terms_and_conditions),
           updated_by = $21,
           updated_date = CURRENT_TIMESTAMP
         WHERE so_id = $22 AND comp_id = $23;`,
        [
          dto.customerPoNo || null,
          dto.customerPoDate || null,
          dto.contactPerson || null,
          dto.contactEmail || null,
          dto.contactPhone || null,
          dto.billingAddress || null,
          dto.shippingAddress || null,
          dto.paymentTerms || null,
          dto.deliveryTerms || null,
          dto.targetDeliveryDate || null,
          subtotalAmount,
          totalCgst,
          totalSgst,
          totalIgst,
          totalTaxAmount,
          freightCharges,
          packagingCharges,
          grandTotal,
          dto.remarks || null,
          dto.termsAndConditions || null,
          userId,
          id,
          compId,
        ],
      );

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'SALES_ORDER',
        actionType: 'EDIT',
        entityTable: 'tbl_sales_order_header',
        recordId: id,
        newValue: { grandTotal },
        compId,
        branchId,
      });

      return this.findOne(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 7. Confirm Order & Execute ATP Stock Reservation Engine
  // --------------------------------------------------------------------------
  async confirmOrder(id: number, dto: ConfirmOrderDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    const order = await this.findOne(id, user);

    if (order.status === 'CONFIRMED' || order.status === 'READY_FOR_DISPATCH') {
      throw new BadRequestException(`Sales order #${order.so_no} is already confirmed.`);
    }

    if (order.status === 'CANCELLED') {
      throw new BadRequestException(`Cannot confirm cancelled sales order.`);
    }

    // Verify credit limit override if exceeded
    if (order.is_credit_limit_exceeded && !order.credit_override_by) {
      throw new BadRequestException(
        `Commercial Credit Limit Exceeded for ${order.customer_name}. An authorized manager credit override is mandatory before confirmation.`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      let allFull = true;
      let anyReserved = false;

      // ATP Stock Reservation Engine
      for (const item of order.items) {
        const deficitQty = item.ordered_qty - item.reserved_qty;

        if (deficitQty > 0) {
          // Query available on-hand stock for this item in FG bin stock
          const stockRes = await client.query(
            `SELECT bin_stock_id, warehouse_id, bin_id, batch_no, available_qty::FLOAT AS available_qty
             FROM tbl_inv_bin_stock
             WHERE comp_id = $1
               AND item_id = $2
               AND available_qty > 0
               AND is_active = TRUE
             ORDER BY last_stock_date ASC, bin_stock_id ASC;`,
            [compId, item.item_id],
          );

          let remainingToReserve = deficitQty;
          let newlyReservedTotal = 0;

          for (const stock of stockRes.rows) {
            if (remainingToReserve <= 0) break;

            const canTake = Math.min(stock.available_qty, remainingToReserve);

            // Deduct available, add to reserved in bin stock
            await client.query(
              `UPDATE tbl_inv_bin_stock
               SET reserved_qty = reserved_qty + $1,
                   available_qty = available_qty - $1,
                   updated_by = $2,
                   updated_date = CURRENT_TIMESTAMP
               WHERE bin_stock_id = $3;`,
              [canTake, userId, stock.bin_stock_id],
            );

            newlyReservedTotal += canTake;
            remainingToReserve -= canTake;
          }

          const totalReservedForItem = item.reserved_qty + newlyReservedTotal;
          let reservationStatus = 'PENDING';
          if (totalReservedForItem >= item.ordered_qty) {
            reservationStatus = 'FULL';
            anyReserved = true;
          } else if (totalReservedForItem > 0) {
            reservationStatus = 'PARTIAL';
            allFull = false;
            anyReserved = true;
          } else {
            reservationStatus = 'PENDING';
            allFull = false;
          }

          // Update Sales Order line item
          await client.query(
            `UPDATE tbl_sales_order_item
             SET reserved_qty = $1,
                 reservation_status = $2,
                 updated_by = $3,
                 updated_date = CURRENT_TIMESTAMP
             WHERE so_item_id = $4;`,
            [totalReservedForItem, reservationStatus, userId, item.so_item_id],
          );
        } else {
          if (item.reservation_status !== 'FULL') {
            allFull = false;
          } else {
            anyReserved = true;
          }
        }
      }

      let headerAtpStatus = 'PENDING';
      if (allFull) {
        headerAtpStatus = 'FULL';
      } else if (anyReserved) {
        headerAtpStatus = 'PARTIAL';
      }

      const nextStatus = allFull ? 'READY_FOR_DISPATCH' : 'CONFIRMED';

      // Update Sales Order Header
      await client.query(
        `UPDATE tbl_sales_order_header
         SET status = $1,
             atp_reservation_status = $2,
             confirmed_by = $3,
             confirmed_at = CURRENT_TIMESTAMP,
             hold_reason = NULL,
             remarks = COALESCE($4, remarks),
             updated_by = $3,
             updated_date = CURRENT_TIMESTAMP
         WHERE so_id = $5 AND comp_id = $6;`,
        [nextStatus, headerAtpStatus, userId, dto.remarks || null, id, compId],
      );

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'SALES_ORDER',
        actionType: 'CONFIRM',
        entityTable: 'tbl_sales_order_header',
        recordId: id,
        newValue: {
          status: nextStatus,
          atpReservationStatus: headerAtpStatus,
        },
        compId,
        branchId,
      });

      return this.findOne(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 8. Commercial Credit Limit Manager Override
  // --------------------------------------------------------------------------
  async creditOverride(id: number, dto: CreditOverrideDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    if (!dto.creditOverrideReason || dto.creditOverrideReason.trim().length < 5) {
      throw new BadRequestException('A valid managerial credit override reason is required.');
    }

    const order = await this.findOne(id, user);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const newStatus = order.status === 'ON_HOLD' ? 'DRAFT' : order.status;

      await client.query(
        `UPDATE tbl_sales_order_header
         SET credit_override_by = $1,
             credit_override_at = CURRENT_TIMESTAMP,
             credit_override_reason = $2,
             status = $3,
             hold_reason = CASE WHEN status = 'ON_HOLD' THEN NULL ELSE hold_reason END,
             updated_by = $1,
             updated_date = CURRENT_TIMESTAMP
         WHERE so_id = $4 AND comp_id = $5;`,
        [userId, dto.creditOverrideReason.trim(), newStatus, id, compId],
      );

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'SALES_ORDER',
        actionType: 'AUTHORIZE',
        entityTable: 'tbl_sales_order_header',
        recordId: id,
        newValue: {
          creditOverrideReason: dto.creditOverrideReason,
          status: newStatus,
        },
        compId,
        branchId,
      });

      return this.findOne(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 9. Put Order On Hold / Release Hold
  // --------------------------------------------------------------------------
  async setHold(id: number, dto: HoldOrderDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    const order = await this.findOne(id, user);

    let nextStatus = order.status;
    let holdReason = order.hold_reason;

    if (dto.isHold) {
      nextStatus = 'ON_HOLD';
      holdReason = dto.holdReason || 'Order placed on managerial hold.';
    } else {
      nextStatus = order.confirmed_at ? 'CONFIRMED' : 'DRAFT';
      holdReason = null;
    }

    await this.pool.query(
      `UPDATE tbl_sales_order_header
       SET status = $1,
           hold_reason = $2,
           updated_by = $3,
           updated_date = CURRENT_TIMESTAMP
       WHERE so_id = $4 AND comp_id = $5;`,
      [nextStatus, holdReason, userId, id, compId],
    );

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'SALES_ORDER',
      actionType: 'HOLD',
      entityTable: 'tbl_sales_order_header',
      recordId: id,
      newValue: {
        isHold: dto.isHold,
        status: nextStatus,
        holdReason,
      },
      compId,
      branchId,
    });

    return this.findOne(id, user);
  }

  // --------------------------------------------------------------------------
  // 10. 1-Click Manufacturing Work Order Generation for Unfulfilled Quantities
  // --------------------------------------------------------------------------
  async createWorkOrder(id: number, dto: CreateWorkOrderDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    const order = await this.findOne(id, user);

    if (['CANCELLED', 'DRAFT', 'ON_HOLD'].includes(order.status)) {
      throw new BadRequestException(
        `Sales order must be in CONFIRMED or READY_FOR_DISPATCH status to generate production Work Orders.`,
      );
    }

    const itemsToProduce = order.items.filter((item: any) => {
      if (dto.soItemId) {
        return item.so_item_id === Number(dto.soItemId) && item.deficit_qty > 0;
      }
      return item.deficit_qty > 0 && !item.work_order_id;
    });

    if (itemsToProduce.length === 0) {
      throw new BadRequestException(
        `No deficit quantities eligible for Work Order generation. All items are either fully reserved or already have linked Work Orders.`,
      );
    }

    const client = await this.pool.connect();
    const generatedWos: any[] = [];

    try {
      await client.query('BEGIN');

      for (const item of itemsToProduce) {
        // Look up default active BOM for this item
        const bomRes = await client.query(
          `SELECT bom_id, routing_id
           FROM tbl_mfg_bom_header
           WHERE comp_id = $1
             AND item_id = $2
             AND is_active = TRUE
             AND status IN ('ACTIVE', 'APPROVED')
           ORDER BY is_default DESC, bom_id DESC
           LIMIT 1;`,
          [compId, item.item_id],
        );
        const activeBom = bomRes.rows[0];

        // Sequence for WO No
        const woSeqRes = await client.query(`SELECT nextval('seq_wo_id') AS next_id;`);
        const nextWoId = woSeqRes.rows[0].next_id;
        const woNo = `WO-AHM-2627-${String(nextWoId).padStart(4, '0')}`;

        const scheduledStartDate = new Date().toISOString().split('T')[0];
        const scheduledEndDate = item.target_delivery_date || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
        const targetWarehouseId = dto.targetWarehouseId || 1004; // Central FG Warehouse

        // Insert into tbl_mfg_wo_header
        await client.query(
          `INSERT INTO tbl_mfg_wo_header (
             wo_id, wo_no, wo_date, item_id, bom_id, routing_id,
             target_warehouse_id, planned_qty, completed_qty, scrapped_qty,
             uom_id, scheduled_start_date, scheduled_end_date,
             priority, status, sales_order_id,
             remarks, is_active, comp_id, branch_id, fyear_id, created_by
           ) VALUES (
             $1, $2, CURRENT_DATE, $3, $4, $5,
             $6, $7, 0.000, 0.000,
             $8, $9, $10,
             'HIGH', 'DRAFT', $11,
             $12, TRUE, $13, $14, $15, $16
           );`,
          [
            nextWoId,
            woNo,
            item.item_id,
            activeBom?.bom_id || null,
            activeBom?.routing_id || null,
            targetWarehouseId,
            item.deficit_qty,
            item.uom_id,
            scheduledStartDate,
            scheduledEndDate,
            id,
            dto.remarks || `Generated from Sales Order #${order.so_no} item ${item.item_code} (${item.deficit_qty} ${item.uom_code})`,
            compId,
            branchId,
            user.fyearId || 1001,
            userId,
          ],
        );

        // Update Sales Order Item with Work Order Link
        await client.query(
          `UPDATE tbl_sales_order_item
           SET work_order_id = $1,
               updated_by = $2,
               updated_date = CURRENT_TIMESTAMP
           WHERE so_item_id = $3;`,
          [nextWoId, userId, item.so_item_id],
        );

        generatedWos.push({
          woId: nextWoId,
          woNo,
          itemId: item.item_id,
          itemCode: item.item_code,
          plannedQty: item.deficit_qty,
        });
      }

      // Update Header status to IN_PRODUCTION
      await client.query(
        `UPDATE tbl_sales_order_header
         SET status = 'IN_PRODUCTION',
             updated_by = $1,
             updated_date = CURRENT_TIMESTAMP
         WHERE so_id = $2 AND comp_id = $3;`,
        [userId, id, compId],
      );

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'SALES_ORDER',
        actionType: 'CREATE_WO',
        entityTable: 'tbl_mfg_wo_header',
        recordId: id,
        newValue: {
          soNo: order.so_no,
          workOrdersGenerated: generatedWos,
        },
        compId,
        branchId,
      });

      return {
        success: true,
        message: `Successfully generated ${generatedWos.length} production Work Order(s) for unfulfilled line items.`,
        salesOrderNo: order.so_no,
        workOrders: generatedWos,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 11. Manual Targeted ATP Stock Reservation / Release
  // --------------------------------------------------------------------------
  async reserveStock(id: number, dto: ReserveStockDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    const order = await this.findOne(id, user);
    const item = order.items.find((it: any) => it.so_item_id === Number(dto.soItemId));

    if (!item) {
      throw new NotFoundException(`Sales Order Item #${dto.soItemId} not found.`);
    }

    const qtyToReserve = Number(dto.qtyToReserve || 0);
    if (qtyToReserve <= 0) {
      throw new BadRequestException(`Quantity to reserve must be greater than zero.`);
    }

    const deficit = item.ordered_qty - item.reserved_qty;
    if (qtyToReserve > deficit) {
      throw new BadRequestException(
        `Cannot reserve ${qtyToReserve} units. Only ${deficit} unreserved units remain for this line item.`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Check available stock in bin
      let stockQuery = `
        SELECT bin_stock_id, available_qty::FLOAT AS available_qty
        FROM tbl_inv_bin_stock
        WHERE comp_id = $1 AND item_id = $2 AND available_qty > 0 AND is_active = TRUE
      `;
      const params: any[] = [compId, item.item_id];

      if (dto.binId) {
        stockQuery += ` AND bin_id = $3`;
        params.push(dto.binId);
      }
      if (dto.batchNo) {
        stockQuery += ` AND batch_no = $${params.length + 1}`;
        params.push(dto.batchNo);
      }
      stockQuery += ` ORDER BY last_stock_date ASC LIMIT 1 FOR UPDATE;`;

      const stockRes = await client.query(stockQuery, params);
      if (stockRes.rows.length === 0 || stockRes.rows[0].available_qty < qtyToReserve) {
        throw new BadRequestException(`Insufficient available stock in the specified storage bin / batch.`);
      }

      const binStock = stockRes.rows[0];

      // Update bin stock
      await client.query(
        `UPDATE tbl_inv_bin_stock
         SET reserved_qty = reserved_qty + $1,
             available_qty = available_qty - $1,
             updated_by = $2,
             updated_date = CURRENT_TIMESTAMP
         WHERE bin_stock_id = $3;`,
        [qtyToReserve, userId, binStock.bin_stock_id],
      );

      // Update SO item
      const newReserved = item.reserved_qty + qtyToReserve;
      const resStatus = newReserved >= item.ordered_qty ? 'FULL' : 'PARTIAL';

      await client.query(
        `UPDATE tbl_sales_order_item
         SET reserved_qty = $1,
             reservation_status = $2,
             updated_by = $3,
             updated_date = CURRENT_TIMESTAMP
         WHERE so_item_id = $4;`,
        [newReserved, resStatus, userId, item.so_item_id],
      );

      // Check overall header status
      const allItemsRes = await client.query(
        `SELECT ordered_qty::FLOAT AS ordered_qty, reserved_qty::FLOAT AS reserved_qty
         FROM tbl_sales_order_item
         WHERE so_id = $1 AND is_active = TRUE;`,
        [id],
      );

      const isAllFull = allItemsRes.rows.every((r: any) => r.reserved_qty >= r.ordered_qty);
      const isAnyReserved = allItemsRes.rows.some((r: any) => r.reserved_qty > 0);
      const headerResStatus = isAllFull ? 'FULL' : isAnyReserved ? 'PARTIAL' : 'PENDING';

      await client.query(
        `UPDATE tbl_sales_order_header
         SET atp_reservation_status = $1,
             status = CASE WHEN $1 = 'FULL' AND status = 'CONFIRMED' THEN 'READY_FOR_DISPATCH' ELSE status END,
             updated_by = $2,
             updated_date = CURRENT_TIMESTAMP
         WHERE so_id = $3;`,
        [headerResStatus, userId, id],
      );

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'SALES_ORDER',
        actionType: 'CONFIRM',
        entityTable: 'tbl_inv_bin_stock',
        recordId: id,
        newValue: {
          soItemId: item.so_item_id,
          reservedQty: qtyToReserve,
          binStockId: binStock.bin_stock_id,
        },
        compId,
        branchId,
      });

      return this.findOne(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 12. Delete Sales Order (Releases Any Reserved ATP Stock)
  // --------------------------------------------------------------------------
  async delete(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    const order = await this.findOne(id, user);

    if (['IN_PRODUCTION', 'COMPLETED', 'PARTIALLY_DELIVERED'].includes(order.status)) {
      throw new BadRequestException(
        `Cannot delete Sales Order in status '${order.status}' because production or fulfillment is already active.`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Release any reserved stock
      for (const item of order.items) {
        if (item.reserved_qty > 0) {
          await client.query(
            `UPDATE tbl_inv_bin_stock
             SET reserved_qty = GREATEST(0, reserved_qty - $1),
                 available_qty = available_qty + $1,
                 updated_by = $2,
                 updated_date = CURRENT_TIMESTAMP
             WHERE item_id = $3 AND comp_id = $4;`,
            [item.reserved_qty, userId, item.item_id, compId],
          );
        }
      }

      // Soft delete header and items
      await client.query(
        `UPDATE tbl_sales_order_header
         SET is_active = FALSE,
             status = 'CANCELLED',
             updated_by = $1,
             updated_date = CURRENT_TIMESTAMP
         WHERE so_id = $2 AND comp_id = $3;`,
        [userId, id, compId],
      );

      await client.query(
        `UPDATE tbl_sales_order_item
         SET is_active = FALSE,
             reservation_status = 'RELEASED',
             updated_by = $1,
             updated_date = CURRENT_TIMESTAMP
         WHERE so_id = $2;`,
        [userId, id],
      );

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'SALES_ORDER',
        actionType: 'DELETE',
        entityTable: 'tbl_sales_order_header',
        recordId: id,
        compId,
        branchId,
      });

      return {
        success: true,
        message: `Sales Order #${order.so_no} successfully cancelled and any reserved stock released back to available inventory.`,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
