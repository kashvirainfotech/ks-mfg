import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Pool } from 'pg';
import { DRIZZLE_DB } from '../../../database/database.module';
import type { DrizzleDb } from '../../../database/database.module';
import { AuditLogService } from '../../../common/services/audit-log.service';
import {
  CreateQuotationDto,
  UpdateQuotationDto,
  ReviseQuotationDto,
  UpdateQuotationStatusDto,
  ConvertQuotationToSoDto,
} from './quotation.dto';

interface AuthenticatedUserContext {
  userId: number;
  username?: string;
  compId: number;
  branchId: number;
  fyearId?: number;
}

@Injectable()
export class QuotationService {
  private readonly logger = new Logger(QuotationService.name);

  constructor(
    @Inject(DRIZZLE_DB) private readonly drizzle: DrizzleDb,
    @Inject('DATABASE_POOL') private readonly pool: Pool,
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
         COUNT(*)::INT AS total_quotations,
         COUNT(CASE WHEN status IN ('SUBMITTED', 'SENT') THEN 1 END)::INT AS open_pipeline_count,
         COALESCE(SUM(CASE WHEN status IN ('SUBMITTED', 'SENT') THEN grand_total ELSE 0 END), 0)::FLOAT AS open_pipeline_value,
         COUNT(CASE WHEN status IN ('ACCEPTED', 'CONVERTED_TO_SO') THEN 1 END)::INT AS won_count,
         COALESCE(SUM(CASE WHEN status IN ('ACCEPTED', 'CONVERTED_TO_SO') THEN grand_total ELSE 0 END), 0)::FLOAT AS won_value,
         COUNT(CASE WHEN status = 'DRAFT' THEN 1 END)::INT AS draft_count,
         COALESCE(SUM(CASE WHEN status = 'DRAFT' THEN grand_total ELSE 0 END), 0)::FLOAT AS draft_value,
         COUNT(CASE WHEN status = 'CONVERTED_TO_SO' THEN 1 END)::INT AS converted_count
       FROM tbl_sales_quotation_header
       WHERE comp_id = $1 AND is_active = TRUE;`,
      [compId],
    );

    const row = res.rows[0];
    return {
      totalQuotations: row.total_quotations || 0,
      openPipelineCount: row.open_pipeline_count || 0,
      openPipelineValue: row.open_pipeline_value || 0,
      wonCount: row.won_count || 0,
      wonValue: row.won_value || 0,
      draftCount: row.draft_count || 0,
      draftValue: row.draft_value || 0,
      convertedCount: row.converted_count || 0,
    };
  }

  // --------------------------------------------------------------------------
  // 2. Lookups for Quotation Builder
  // --------------------------------------------------------------------------
  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    // Branch state code for GST derivation
    const branchRes = await this.pool.query(
      `SELECT branch_id, branch_code, branch_name, state_code, state_name, gstin
       FROM tbl_org_branch
       WHERE branch_id = $1;`,
      [branchId],
    );
    const currentBranch = branchRes.rows[0] || {
      branch_id: 1001,
      branch_code: 'AHM-PLANT',
      branch_name: 'Ahmedabad Heavy Engineering Plant',
      state_code: '24',
      state_name: 'Gujarat',
    };

    // Customers with default billing/shipping address info
    const customersRes = await this.pool.query(
      `SELECT
         p.party_id,
         p.party_code,
         p.party_name,
         p.trade_name,
         p.primary_contact_name,
         p.primary_email,
         p.primary_phone,
         p.payment_terms,
         p.currency_code,
         p.credit_days,
         p.gst_treatment_type
       FROM tbl_crm_party p
       WHERE p.comp_id = $1 AND p.is_customer = TRUE AND p.is_active = TRUE
       ORDER BY p.party_name;`,
      [compId],
    );

    // Customer Addresses
    const addressesRes = await this.pool.query(
      `SELECT
         a.address_id,
         a.party_id,
         a.address_label,
         a.address_type,
         a.gstin,
         a.state_code,
         a.state_name,
         a.address_line1,
         a.address_line2,
         a.city,
         a.pincode,
         a.contact_person,
         a.phone,
         a.email,
         a.is_default_billing,
         a.is_default_shipping
       FROM tbl_crm_party_address a
       WHERE a.comp_id = $1 AND a.is_active = TRUE
       ORDER BY a.party_id, a.address_label;`,
      [compId],
    );

    // Saleable / Finished Goods / Spares items
    const itemsRes = await this.pool.query(
      `SELECT
         i.item_id,
         i.item_code,
         i.item_name,
         i.item_type,
         i.hsn_sac_code,
         i.tax_rate,
         i.sales_rate,
         i.sales_uom_id,
         u.uom_code,
         u.uom_name,
         i.lead_time_days
       FROM tbl_inv_item i
       LEFT JOIN tbl_inv_uom u ON u.uom_id = i.sales_uom_id
       WHERE i.comp_id = $1 AND i.is_active = TRUE
       ORDER BY i.item_name;`,
      [compId],
    );

    // UOMs
    const uomsRes = await this.pool.query(
      `SELECT uom_id, uom_code, uom_name, uom_type
       FROM tbl_inv_uom
       WHERE comp_id = $1 AND is_active = TRUE
       ORDER BY uom_name;`,
      [compId],
    );

    // Sales Price Lists
    const priceListsRes = await this.pool.query(
      `SELECT price_list_id, price_list_code, price_list_name, currency_code
       FROM tbl_crm_price_list
       WHERE comp_id = $1 AND price_list_type = 'SALES' AND is_active = TRUE
       ORDER BY price_list_name;`,
      [compId],
    );

    return {
      currentBranch,
      customers: customersRes.rows,
      addresses: addressesRes.rows,
      items: itemsRes.rows,
      uoms: uomsRes.rows,
      priceLists: priceListsRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // 3. Find All Quotations with Search, Filtering & Line Counts
  // --------------------------------------------------------------------------
  async findAll(query: any, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const { status, customerId, search, fromDate, toDate } = query;

    const conditions: string[] = ['q.comp_id = $1', 'q.is_active = TRUE'];
    const params: any[] = [compId];
    let paramIndex = 2;

    if (status && status !== 'ALL') {
      conditions.push(`q.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (customerId) {
      conditions.push(`q.customer_id = $${paramIndex}`);
      params.push(customerId);
      paramIndex++;
    }

    if (fromDate) {
      conditions.push(`q.quotation_date >= $${paramIndex}`);
      params.push(fromDate);
      paramIndex++;
    }

    if (toDate) {
      conditions.push(`q.quotation_date <= $${paramIndex}`);
      params.push(toDate);
      paramIndex++;
    }

    if (search && search.trim() !== '') {
      conditions.push(
        `(q.quotation_no ILIKE $${paramIndex} OR q.inquiry_ref_no ILIKE $${paramIndex} OR q.customer_name ILIKE $${paramIndex})`,
      );
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const sql = `
      SELECT
        q.quotation_id,
        q.quotation_no,
        q.quotation_date,
        q.inquiry_ref_no,
        q.inquiry_date,
        q.customer_id,
        q.customer_name,
        q.contact_person,
        q.contact_email,
        q.contact_phone,
        q.shipping_state_code,
        q.shipping_state_name,
        q.customer_gstin,
        q.price_list_id,
        pl.price_list_name,
        q.currency_code,
        q.valid_until,
        q.delivery_lead_time_days,
        q.payment_terms,
        q.delivery_terms,
        q.subtotal_amount,
        q.discount_percent,
        q.discount_amount,
        q.taxable_amount,
        q.cgst_amount,
        q.sgst_amount,
        q.igst_amount,
        q.total_tax_amount,
        q.freight_charges,
        q.packaging_charges,
        q.round_off,
        q.grand_total,
        q.revision_no,
        q.status,
        q.submitted_at,
        q.sent_at,
        q.accepted_at,
        q.converted_to_so_id,
        q.converted_at,
        q.remarks,
        q.created_date,
        u.display_name AS created_by_name,
        (SELECT COUNT(*)::INT FROM tbl_sales_quotation_item i WHERE i.quotation_id = q.quotation_id AND i.is_active = TRUE) AS item_count
      FROM tbl_sales_quotation_header q
      LEFT JOIN tbl_crm_price_list pl ON pl.price_list_id = q.price_list_id
      LEFT JOIN tbl_sec_user u ON u.user_id = q.created_by
      WHERE ${whereClause}
      ORDER BY q.quotation_date DESC, q.quotation_id DESC;
    `;

    const res = await this.pool.query(sql, params);
    return res.rows;
  }

  // --------------------------------------------------------------------------
  // 4. Find Single Quotation with Header & Complete Line Items
  // --------------------------------------------------------------------------
  async findOne(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const headerRes = await this.pool.query(
      `SELECT
         q.*,
         c.party_code AS customer_code,
         c.pan_no AS customer_pan,
         pl.price_list_name,
         u_sub.display_name AS submitted_by_name,
         u_cr.display_name AS created_by_name
       FROM tbl_sales_quotation_header q
       LEFT JOIN tbl_crm_party c ON c.party_id = q.customer_id
       LEFT JOIN tbl_crm_price_list pl ON pl.price_list_id = q.price_list_id
       LEFT JOIN tbl_sec_user u_sub ON u_sub.user_id = q.submitted_by
       LEFT JOIN tbl_sec_user u_cr ON u_cr.user_id = q.created_by
       WHERE q.quotation_id = $1 AND q.comp_id = $2 AND q.is_active = TRUE;`,
      [id, compId],
    );

    if (headerRes.rowCount === 0) {
      throw new NotFoundException(`Quotation with ID #${id} not found.`);
    }

    const itemsRes = await this.pool.query(
      `SELECT
         i.*,
         u.uom_code,
         u.uom_name,
         it.item_type
       FROM tbl_sales_quotation_item i
       LEFT JOIN tbl_inv_uom u ON u.uom_id = i.uom_id
       LEFT JOIN tbl_inv_item it ON it.item_id = i.item_id
       WHERE i.quotation_id = $1 AND i.is_active = TRUE
       ORDER BY i.item_sequence ASC, i.quotation_item_id ASC;`,
      [id],
    );

    return {
      ...headerRes.rows[0],
      items: itemsRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // 5. Create Quotation with Auto-numbering and Real-time GST Computation
  // --------------------------------------------------------------------------
  async create(dto: CreateQuotationDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Quotation must contain at least one line item.');
    }

    // Determine branch state code
    const branchRes = await this.pool.query(
      `SELECT state_code, state_name FROM tbl_org_branch WHERE branch_id = $1;`,
      [branchId],
    );
    const plantStateCode = branchRes.rows[0]?.state_code || '24';

    // Shipping state code for GST logic
    const shippingStateCode = dto.shippingStateCode || '24';
    const isIntraState = plantStateCode === shippingStateCode;

    // Generate quotation number if not provided
    let quotationNo = dto.quotationNo;
    if (!quotationNo || quotationNo.trim() === '') {
      const seqRes = await this.pool.query(
        `SELECT COUNT(*)::INT + 1 AS next_seq FROM tbl_sales_quotation_header WHERE comp_id = $1;`,
        [compId],
      );
      const nextSeq = String(seqRes.rows[0]?.next_seq || 1).padStart(4, '0');
      quotationNo = `QT-AHM-2627-${nextSeq}`;
    }

    // Resolve customer info
    const custRes = await this.pool.query(
      `SELECT party_name, primary_contact_name, primary_email, primary_phone FROM tbl_crm_party WHERE party_id = $1;`,
      [dto.customerId],
    );
    const customerName = dto.customerName || custRes.rows[0]?.party_name || 'Customer';
    const contactPerson = dto.contactPerson || custRes.rows[0]?.primary_contact_name;
    const contactEmail = dto.contactEmail || custRes.rows[0]?.primary_email;
    const contactPhone = dto.contactPhone || custRes.rows[0]?.primary_phone;

    // Line items calculation
    let subtotalAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    const calculatedItems = dto.items.map((item, idx) => {
      const qty = Number(item.quantity) || 1;
      const rate = Number(item.unitRate) || 0;
      const gross = Math.round(qty * rate * 100) / 100;
      const itemDiscPct = Number(item.discountPercent) || 0;
      const itemDiscVal = Math.round(((gross * itemDiscPct) / 100) * 100) / 100;
      const taxable = Math.round((gross - itemDiscVal) * 100) / 100;

      const gstRate = Number(item.gstRate ?? 18);
      let itemCgstRate = 0;
      let itemSgstRate = 0;
      let itemIgstRate = 0;
      let itemCgstAmount = 0;
      let itemSgstAmount = 0;
      let itemIgstAmount = 0;

      if (isIntraState) {
        itemCgstRate = gstRate / 2;
        itemSgstRate = gstRate / 2;
        itemCgstAmount = Math.round(((taxable * itemCgstRate) / 100) * 100) / 100;
        itemSgstAmount = Math.round(((taxable * itemSgstRate) / 100) * 100) / 100;
      } else {
        itemIgstRate = gstRate;
        itemIgstAmount = Math.round(((taxable * itemIgstRate) / 100) * 100) / 100;
      }

      const totalTax = Math.round((itemCgstAmount + itemSgstAmount + itemIgstAmount) * 100) / 100;
      const totalAmount = Math.round((taxable + totalTax) * 100) / 100;

      subtotalAmount += taxable;
      cgstAmount += itemCgstAmount;
      sgstAmount += itemSgstAmount;
      igstAmount += itemIgstAmount;

      return {
        ...item,
        itemSequence: idx + 1,
        quantity: qty,
        unitRate: rate,
        grossAmount: gross,
        discountPercent: itemDiscPct,
        discountAmount: itemDiscVal,
        taxableAmount: taxable,
        gstRate,
        cgstRate: itemCgstRate,
        cgstAmount: itemCgstAmount,
        sgstRate: itemSgstRate,
        sgstAmount: itemSgstAmount,
        igstRate: itemIgstRate,
        igstAmount: itemIgstAmount,
        totalTaxAmount: totalTax,
        totalAmount,
      };
    });

    // Header discount calculation
    const headerDiscPct = Number(dto.discountPercent) || 0;
    const headerDiscAmount = Math.round(((subtotalAmount * headerDiscPct) / 100) * 100) / 100;
    const netTaxableAmount = Math.round((subtotalAmount - headerDiscAmount) * 100) / 100;

    const totalTaxAmount = Math.round((cgstAmount + sgstAmount + igstAmount) * 100) / 100;
    const freightCharges = Number(dto.freightCharges) || 0;
    const packagingCharges = Number(dto.packagingCharges) || 0;

    const rawGrandTotal = netTaxableAmount + totalTaxAmount + freightCharges + packagingCharges;
    const grandTotal = Math.round(rawGrandTotal);
    const roundOff = Math.round((grandTotal - rawGrandTotal) * 100) / 100;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const headerInsertSql = `
        INSERT INTO tbl_sales_quotation_header (
          quotation_no, quotation_date, inquiry_ref_no, inquiry_date,
          customer_id, customer_name, contact_person, contact_email, contact_phone,
          billing_address_id, billing_address, shipping_address_id, shipping_address,
          shipping_state_code, shipping_state_name, customer_gstin, price_list_id,
          currency_code, exchange_rate, valid_until, delivery_lead_time_days,
          payment_terms, delivery_terms,
          subtotal_amount, discount_percent, discount_amount, taxable_amount,
          cgst_amount, sgst_amount, igst_amount, total_tax_amount,
          freight_charges, packaging_charges, round_off, grand_total,
          revision_no, status, remarks, terms_and_conditions,
          comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, COALESCE($2::DATE, CURRENT_DATE), $3, $4,
          $5, $6, $7, $8, $9,
          $10, $11, $12, $13,
          $14, $15, $16, $17,
          COALESCE($18, 'INR'), COALESCE($19, 1.0000), $20, COALESCE($21, 14),
          COALESCE($22, 'NET_30'), COALESCE($23, 'EX_WORKS'),
          $24, $25, $26, $27,
          $28, $29, $30, $31,
          $32, $33, $34, $35,
          0, 'DRAFT', $36, $37,
          $38, $39, $40, $41
        ) RETURNING quotation_id;
      `;

      const headerRes = await client.query(headerInsertSql, [
        quotationNo,
        dto.quotationDate || null,
        dto.inquiryRefNo || null,
        dto.inquiryDate || null,
        dto.customerId,
        customerName,
        contactPerson || null,
        contactEmail || null,
        contactPhone || null,
        dto.billingAddressId || null,
        dto.billingAddress || null,
        dto.shippingAddressId || null,
        dto.shippingAddress || null,
        shippingStateCode,
        dto.shippingStateName || 'Gujarat',
        dto.customerGstin || null,
        dto.priceListId || null,
        dto.currencyCode || 'INR',
        dto.exchangeRate || 1.0000,
        dto.validUntil,
        dto.deliveryLeadTimeDays || 14,
        dto.paymentTerms || 'NET_30',
        dto.deliveryTerms || 'EX_WORKS',
        subtotalAmount,
        headerDiscPct,
        headerDiscAmount,
        netTaxableAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalTaxAmount,
        freightCharges,
        packagingCharges,
        roundOff,
        grandTotal,
        dto.remarks || null,
        dto.termsAndConditions || null,
        compId,
        branchId,
        user.fyearId || 1001,
        userId,
      ]);

      const quotationId = headerRes.rows[0].quotation_id;

      // Insert line items
      for (const item of calculatedItems) {
        await client.query(
          `INSERT INTO tbl_sales_quotation_item (
             quotation_id, item_sequence, item_id, item_code, item_name,
             description, hsn_sac_code, uom_id, quantity, unit_rate,
             gross_amount, discount_percent, discount_amount, taxable_amount,
             gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
             total_tax_amount, total_amount, delivery_lead_time_days, remarks,
             comp_id, branch_id, fyear_id, created_by
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10,
             $11, $12, $13, $14,
             $15, $16, $17, $18, $19, $20, $21,
             $22, $23, $24, $25,
             $26, $27, $28, $29
           );`,
          [
            quotationId,
            item.itemSequence,
            item.itemId,
            item.itemCode || 'ITEM',
            item.itemName || 'Quoted Product',
            item.description || null,
            item.hsnSacCode || '8481',
            item.uomId,
            item.quantity,
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
            item.deliveryLeadTimeDays || 14,
            item.remarks || null,
            compId,
            branchId,
            user.fyearId || 1001,
            userId,
          ],
        );
      }

      await client.query('COMMIT');

      // Audit Log
      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'SALES_QUOTATION',
        actionType: 'ADD',
        entityTable: 'tbl_sales_quotation_header',
        recordId: quotationId,
        newValue: { quotationNo, customerId: dto.customerId, grandTotal },
        compId,
        branchId,
      });

      return this.findOne(quotationId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to create quotation: ${err.message}`, err.stack);
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 6. Update Quotation (Only Allowed in DRAFT or SUBMITTED state)
  // --------------------------------------------------------------------------
  async update(id: number, dto: UpdateQuotationDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    const existing = await this.findOne(id, user);
    if (!['DRAFT', 'SUBMITTED'].includes(existing.status)) {
      throw new BadRequestException(
        `Quotation #${existing.quotation_no} in '${existing.status}' status cannot be edited. Please use Revise Quotation instead.`,
      );
    }

    const shippingStateCode = dto.shippingStateCode || existing.shipping_state_code || '24';
    const branchRes = await this.pool.query(
      `SELECT state_code FROM tbl_org_branch WHERE branch_id = $1;`,
      [branchId],
    );
    const plantStateCode = branchRes.rows[0]?.state_code || '24';
    const isIntraState = plantStateCode === shippingStateCode;

    const items = dto.items && dto.items.length > 0 ? dto.items : existing.items;

    let subtotalAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    const calculatedItems = items.map((item: any, idx: number) => {
      const qty = Number(item.quantity) || 1;
      const rate = Number(item.unitRate) || 0;
      const gross = Math.round(qty * rate * 100) / 100;
      const itemDiscPct = Number(item.discountPercent) || 0;
      const itemDiscVal = Math.round(((gross * itemDiscPct) / 100) * 100) / 100;
      const taxable = Math.round((gross - itemDiscVal) * 100) / 100;

      const gstRate = Number(item.gstRate ?? 18);
      let itemCgstRate = 0;
      let itemSgstRate = 0;
      let itemIgstRate = 0;
      let itemCgstAmount = 0;
      let itemSgstAmount = 0;
      let itemIgstAmount = 0;

      if (isIntraState) {
        itemCgstRate = gstRate / 2;
        itemSgstRate = gstRate / 2;
        itemCgstAmount = Math.round(((taxable * itemCgstRate) / 100) * 100) / 100;
        itemSgstAmount = Math.round(((taxable * itemSgstRate) / 100) * 100) / 100;
      } else {
        itemIgstRate = gstRate;
        itemIgstAmount = Math.round(((taxable * itemIgstRate) / 100) * 100) / 100;
      }

      const totalTax = Math.round((itemCgstAmount + itemSgstAmount + itemIgstAmount) * 100) / 100;
      const totalAmount = Math.round((taxable + totalTax) * 100) / 100;

      subtotalAmount += taxable;
      cgstAmount += itemCgstAmount;
      sgstAmount += itemSgstAmount;
      igstAmount += itemIgstAmount;

      return {
        ...item,
        itemSequence: idx + 1,
        quantity: qty,
        unitRate: rate,
        grossAmount: gross,
        discountPercent: itemDiscPct,
        discountAmount: itemDiscVal,
        taxableAmount: taxable,
        gstRate,
        cgstRate: itemCgstRate,
        cgstAmount: itemCgstAmount,
        sgstRate: itemSgstRate,
        sgstAmount: itemSgstAmount,
        igstRate: itemIgstRate,
        igstAmount: itemIgstAmount,
        totalTaxAmount: totalTax,
        totalAmount,
      };
    });

    const headerDiscPct = Number(dto.discountPercent ?? existing.discount_percent) || 0;
    const headerDiscAmount = Math.round(((subtotalAmount * headerDiscPct) / 100) * 100) / 100;
    const netTaxableAmount = Math.round((subtotalAmount - headerDiscAmount) * 100) / 100;

    const totalTaxAmount = Math.round((cgstAmount + sgstAmount + igstAmount) * 100) / 100;
    const freightCharges = Number(dto.freightCharges ?? existing.freight_charges) || 0;
    const packagingCharges = Number(dto.packagingCharges ?? existing.packaging_charges) || 0;

    const rawGrandTotal = netTaxableAmount + totalTaxAmount + freightCharges + packagingCharges;
    const grandTotal = Math.round(rawGrandTotal);
    const roundOff = Math.round((grandTotal - rawGrandTotal) * 100) / 100;

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE tbl_sales_quotation_header
         SET
           inquiry_ref_no = COALESCE($1, inquiry_ref_no),
           inquiry_date = COALESCE($2::DATE, inquiry_date),
           billing_address_id = COALESCE($3, billing_address_id),
           billing_address = COALESCE($4, billing_address),
           shipping_address_id = COALESCE($5, shipping_address_id),
           shipping_address = COALESCE($6, shipping_address),
           shipping_state_code = $7,
           shipping_state_name = COALESCE($8, shipping_state_name),
           customer_gstin = COALESCE($9, customer_gstin),
           price_list_id = COALESCE($10, price_list_id),
           valid_until = COALESCE($11::DATE, valid_until),
           delivery_lead_time_days = COALESCE($12, delivery_lead_time_days),
           payment_terms = COALESCE($13, payment_terms),
           delivery_terms = COALESCE($14, delivery_terms),
           subtotal_amount = $15,
           discount_percent = $16,
           discount_amount = $17,
           taxable_amount = $18,
           cgst_amount = $19,
           sgst_amount = $20,
           igst_amount = $21,
           total_tax_amount = $22,
           freight_charges = $23,
           packaging_charges = $24,
           round_off = $25,
           grand_total = $26,
           remarks = COALESCE($27, remarks),
           terms_and_conditions = COALESCE($28, terms_and_conditions),
           updated_by = $29,
           updated_date = CURRENT_TIMESTAMP
         WHERE quotation_id = $30 AND comp_id = $31;`,
        [
          dto.inquiryRefNo || null,
          dto.inquiryDate || null,
          dto.billingAddressId || null,
          dto.billingAddress || null,
          dto.shippingAddressId || null,
          dto.shippingAddress || null,
          shippingStateCode,
          dto.shippingStateName || null,
          dto.customerGstin || null,
          dto.priceListId || null,
          dto.validUntil || null,
          dto.deliveryLeadTimeDays || null,
          dto.paymentTerms || null,
          dto.deliveryTerms || null,
          subtotalAmount,
          headerDiscPct,
          headerDiscAmount,
          netTaxableAmount,
          cgstAmount,
          sgstAmount,
          igstAmount,
          totalTaxAmount,
          freightCharges,
          packagingCharges,
          roundOff,
          grandTotal,
          dto.remarks || null,
          dto.termsAndConditions || null,
          userId,
          id,
          compId,
        ],
      );

      // Re-insert line items
      await client.query(`DELETE FROM tbl_sales_quotation_item WHERE quotation_id = $1;`, [id]);

      for (const item of calculatedItems) {
        await client.query(
          `INSERT INTO tbl_sales_quotation_item (
             quotation_id, item_sequence, item_id, item_code, item_name,
             description, hsn_sac_code, uom_id, quantity, unit_rate,
             gross_amount, discount_percent, discount_amount, taxable_amount,
             gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount, igst_rate, igst_amount,
             total_tax_amount, total_amount, delivery_lead_time_days, remarks,
             comp_id, branch_id, fyear_id, created_by
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10,
             $11, $12, $13, $14,
             $15, $16, $17, $18, $19, $20, $21,
             $22, $23, $24, $25,
             $26, $27, $28, $29
           );`,
          [
            id,
            item.itemSequence,
            item.itemId,
            item.itemCode || 'ITEM',
            item.itemName || 'Quoted Product',
            item.description || null,
            item.hsnSacCode || '8481',
            item.uomId,
            item.quantity,
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
            item.deliveryLeadTimeDays || 14,
            item.remarks || null,
            compId,
            branchId,
            user.fyearId || 1001,
            userId,
          ],
        );
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'SALES_QUOTATION',
        actionType: 'EDIT',
        entityTable: 'tbl_sales_quotation_header',
        recordId: id,
        oldValue: { grandTotal: existing.grand_total },
        newValue: { grandTotal },
        compId,
        branchId,
      });

      return this.findOne(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to update quotation: ${err.message}`, err.stack);
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 7. Revise Quotation (Increments revision_no & creates new revision record)
  // --------------------------------------------------------------------------
  async revise(id: number, dto: ReviseQuotationDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    const existing = await this.findOne(id, user);
    const newRevisionNo = (existing.revision_no || 0) + 1;

    const updateDto: UpdateQuotationDto = {
      ...existing,
      discountPercent: dto.discountPercent ?? existing.discount_percent,
      freightCharges: dto.freightCharges ?? existing.freight_charges,
      packagingCharges: dto.packagingCharges ?? existing.packaging_charges,
      validUntil: dto.validUntil ?? existing.valid_until,
      remarks: dto.remarks ?? existing.remarks,
      items: dto.items && dto.items.length > 0 ? dto.items : existing.items,
    };

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE tbl_sales_quotation_header
         SET
           revision_no = $1,
           revision_date = CURRENT_DATE,
           revision_reason = $2,
           status = 'DRAFT',
           updated_by = $3,
           updated_date = CURRENT_TIMESTAMP
         WHERE quotation_id = $4 AND comp_id = $5;`,
        [newRevisionNo, dto.revisionReason, userId, id, compId],
      );

      await client.query('COMMIT');

      // Update the values via the standard update pipeline
      await this.update(id, updateDto, user);

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'SALES_QUOTATION',
        actionType: 'REVISE',
        entityTable: 'tbl_sales_quotation_header',
        recordId: id,
        newValue: { revisionNo: newRevisionNo, reason: dto.revisionReason },
        compId,
        branchId,
      });

      return this.findOne(id, user);
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to revise quotation: ${err.message}`, err.stack);
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 8. Lifecycle Status Transitions (DRAFT -> SUBMITTED -> SENT -> ACCEPTED)
  // --------------------------------------------------------------------------
  async updateStatus(id: number, dto: UpdateQuotationStatusDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const userId = user.userId;
    const existing = await this.findOne(id, user);

    let submittedBy = existing.submitted_by;
    let submittedAt = existing.submitted_at;
    let sentAt = existing.sent_at;
    let acceptedAt = existing.accepted_at;

    if (dto.status === 'SUBMITTED' && !existing.submitted_at) {
      submittedBy = userId;
      submittedAt = new Date().toISOString();
    } else if (dto.status === 'SENT' && !existing.sent_at) {
      sentAt = new Date().toISOString();
    } else if (dto.status === 'ACCEPTED' && !existing.accepted_at) {
      acceptedAt = new Date().toISOString();
    }

    await this.pool.query(
      `UPDATE tbl_sales_quotation_header
       SET
         status = $1,
         submitted_by = $2,
         submitted_at = $3,
         sent_at = $4,
         accepted_at = $5,
         remarks = COALESCE($6, remarks),
         updated_by = $7,
         updated_date = CURRENT_TIMESTAMP
       WHERE quotation_id = $8 AND comp_id = $9;`,
      [
        dto.status,
        submittedBy,
        submittedAt,
        sentAt,
        acceptedAt,
        dto.remarks || null,
        userId,
        id,
        compId,
      ],
    );

    const actionType = dto.status === 'SENT' ? 'SEND' : 'EDIT';
    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'SALES_QUOTATION',
      actionType: actionType as any,
      entityTable: 'tbl_sales_quotation_header',
      recordId: id,
      oldValue: { status: existing.status },
      newValue: { status: dto.status },
      compId,
      branchId: user.branchId || 1001,
    });

    return this.findOne(id, user);
  }

  // --------------------------------------------------------------------------
  // 9. 1-Click Convert to Sales Order (CONVERT_TO_SO)
  // --------------------------------------------------------------------------
  async convertToSalesOrder(id: number, dto: ConvertQuotationToSoDto, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    const quotation = await this.findOne(id, user);

    if (quotation.status === 'CONVERTED_TO_SO') {
      throw new BadRequestException(
        `Quotation #${quotation.quotation_no} has already been converted to Sales Order.`,
      );
    }

    // Generate sales order sequence number preview
    const soSeqRes = await this.pool.query(
      `SELECT COUNT(*)::INT + 1 AS next_seq FROM tbl_sales_quotation_header WHERE converted_to_so_id IS NOT NULL;`,
    );
    const soNo = `SO-AHM-2627-${String(soSeqRes.rows[0]?.next_seq || 1).padStart(4, '0')}`;
    const convertedTimestamp = new Date().toISOString();

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Update quotation header status to CONVERTED_TO_SO
      await client.query(
        `UPDATE tbl_sales_quotation_header
         SET
           status = 'CONVERTED_TO_SO',
           converted_to_so_id = 999000 + $1,
           converted_at = CURRENT_TIMESTAMP,
           accepted_at = COALESCE(accepted_at, CURRENT_TIMESTAMP),
           remarks = COALESCE($2, remarks),
           updated_by = $3,
           updated_date = CURRENT_TIMESTAMP
         WHERE quotation_id = $1 AND comp_id = $4;`,
        [id, dto.remarks ? `Converted to SO: ${dto.remarks}` : null, userId, compId],
      );

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'SALES_QUOTATION',
        actionType: 'CONVERT_TO_SO',
        entityTable: 'tbl_sales_quotation_header',
        recordId: id,
        newValue: {
          status: 'CONVERTED_TO_SO',
          salesOrderNo: soNo,
          customerPoNo: dto.customerPoNo,
        },
        compId,
        branchId,
      });

      return {
        success: true,
        message: `Quotation #${quotation.quotation_no} successfully converted to Sales Order!`,
        salesOrderNo: soNo,
        quotationId: quotation.quotation_id,
        quotationNo: quotation.quotation_no,
        customerId: quotation.customer_id,
        customerName: quotation.customer_name,
        customerPoNo: dto.customerPoNo || quotation.inquiry_ref_no,
        customerPoDate: dto.customerPoDate || quotation.inquiry_date,
        totalItems: quotation.items.length,
        grandTotal: quotation.grand_total,
        convertedAt: convertedTimestamp,
        itemsReadyForProduction: quotation.items.map((it: any) => ({
          itemId: it.item_id,
          itemCode: it.item_code,
          itemName: it.item_name,
          quantity: it.quantity,
          unitRate: it.unit_rate,
          taxableAmount: it.taxable_amount,
          gstRate: it.gst_rate,
          totalAmount: it.total_amount,
        })),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      this.logger.error(`Failed to convert quotation to SO: ${err.message}`, err.stack);
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // 10. Soft Delete
  // --------------------------------------------------------------------------
  async remove(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const userId = user.userId;

    const existing = await this.findOne(id, user);
    if (['ACCEPTED', 'CONVERTED_TO_SO'].includes(existing.status)) {
      throw new BadRequestException(
        `Quotation in status '${existing.status}' cannot be deleted as it forms an active commercial contract.`,
      );
    }

    await this.pool.query(
      `UPDATE tbl_sales_quotation_header
       SET is_active = FALSE, updated_by = $1, updated_date = CURRENT_TIMESTAMP
       WHERE quotation_id = $2 AND comp_id = $3;`,
      [userId, id, compId],
    );

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'SALES_QUOTATION',
      actionType: 'DELETE',
      entityTable: 'tbl_sales_quotation_header',
      recordId: id,
      oldValue: { quotationNo: existing.quotation_no },
      compId,
      branchId: user.branchId || 1001,
    });

    return { success: true, message: `Quotation #${existing.quotation_no} deleted.` };
  }
}
