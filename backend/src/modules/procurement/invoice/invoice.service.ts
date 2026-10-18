import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../../../database/database.module';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import { AuditLogService } from '../../../common/services/audit-log.service';
import { DependencyCheckService } from '../../../common/services/dependency-check.service';
import type {
  ApproveInvoiceDto,
  CancelInvoiceDto,
  CreateInvoiceDto,
  InvoiceFilterParams,
  RecordPaymentDto,
  SubmitInvoiceDto,
  UpdateInvoiceDto,
} from './invoice.dto';

@Injectable()
export class InvoiceService {
  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    private readonly auditLogService: AuditLogService,
    private readonly dependencyCheckService: DependencyCheckService,
  ) {}

  // --------------------------------------------------------------------------
  // KPI Summary
  // --------------------------------------------------------------------------
  async getInvoiceSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const sql = `
      SELECT
        COUNT(*)::INT AS total_invoices,
        COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN net_payable_amount ELSE 0 END), 0)::FLOAT AS total_payable,
        COUNT(CASE WHEN matching_status = 'MATCHED' AND status != 'CANCELLED' THEN 1 END)::INT AS matched_count,
        COUNT(CASE WHEN matching_status != 'MATCHED' AND status != 'CANCELLED' THEN 1 END)::INT AS variance_count,
        COUNT(CASE WHEN status = 'SUBMITTED' THEN 1 END)::INT AS pending_approval_count,
        COUNT(CASE WHEN status = 'APPROVED' THEN 1 END)::INT AS approved_count,
        COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN paid_amount ELSE 0 END), 0)::FLOAT AS paid_amount,
        COALESCE(SUM(CASE WHEN status != 'CANCELLED' THEN balance_amount ELSE 0 END), 0)::FLOAT AS unpaid_amount
      FROM tbl_pur_invoice_header
      WHERE comp_id = $1 AND is_active = TRUE
        AND ($2::BIGINT IS NULL OR branch_id = $2::BIGINT);
    `;

    const res = await this.pool.query(sql, [compId, branchId]);
    const r = res.rows[0] || {};
    return {
      totalInvoices: Number(r.total_invoices || 0),
      totalPayable: Number(r.total_payable || 0),
      matchedCount: Number(r.matched_count || 0),
      varianceCount: Number(r.variance_count || 0),
      pendingApprovalCount: Number(r.pending_approval_count || 0),
      approvedCount: Number(r.approved_count || 0),
      paidAmount: Number(r.paid_amount || 0),
      unpaidAmount: Number(r.unpaid_amount || 0),
    };
  }

  // --------------------------------------------------------------------------
  // Document Number Generation (PINV-AHM-YYNextYY-XXXX)
  // --------------------------------------------------------------------------
  private async generateInvoiceNumber(
    compId: number,
    branchId: number,
  ): Promise<string> {
    const bRes = await this.pool.query(
      `SELECT branch_code FROM tbl_org_branch WHERE branch_id = $1 AND comp_id = $2;`,
      [branchId, compId],
    );
    const branchCode = bRes.rows[0]?.branch_code || 'HO';

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    let startYear = curYear;
    if (curMonth < 4) startYear = curYear - 1;
    const nextYear = startYear + 1;
    const fyearCode = `${String(startYear).slice(-2)}${String(nextYear).slice(-2)}`;

    const seqRes = await this.pool.query(
      `SELECT nextval('seq_pur_invoice_id') AS next_val;`,
    );
    const seq = String(seqRes.rows[0].next_val).padStart(4, '0');
    return `PINV-${branchCode}-${fyearCode}-${seq}`;
  }

  // --------------------------------------------------------------------------
  // Find All (Register Listing)
  // --------------------------------------------------------------------------
  async findAllInvoices(
    filters: InvoiceFilterParams,
    user: AuthenticatedUserContext,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const conditions: string[] = [
      `h.comp_id = $1`,
      `h.is_active = TRUE`,
      `($2::BIGINT IS NULL OR h.branch_id = $2::BIGINT)`,
    ];
    const params: any[] = [compId, branchId];
    let idx = 3;

    if (filters.status) {
      conditions.push(`h.status = $${idx++}`);
      params.push(filters.status);
    }
    if (filters.matchingStatus) {
      conditions.push(`h.matching_status = $${idx++}`);
      params.push(filters.matchingStatus);
    }
    if (filters.paymentStatus) {
      conditions.push(`h.payment_status = $${idx++}`);
      params.push(filters.paymentStatus);
    }
    if (filters.vendorId) {
      conditions.push(`h.vendor_id = $${idx++}`);
      params.push(filters.vendorId);
    }
    if (filters.poId) {
      conditions.push(`h.po_id = $${idx++}`);
      params.push(filters.poId);
    }
    if (filters.grnId) {
      conditions.push(`h.grn_id = $${idx++}`);
      params.push(filters.grnId);
    }
    if (filters.startDate) {
      conditions.push(`h.invoice_date >= $${idx++}`);
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push(`h.invoice_date <= $${idx++}`);
      params.push(filters.endDate);
    }
    if (filters.search) {
      conditions.push(
        `(h.invoice_no ILIKE $${idx} OR h.vendor_invoice_no ILIKE $${idx} OR p.party_name ILIKE $${idx} OR po.po_number ILIKE $${idx} OR grn.grn_no ILIKE $${idx})`,
      );
      params.push(`%${filters.search}%`);
      idx++;
    }

    const sql = `
      SELECT
        h.invoice_id,
        h.comp_id,
        h.branch_id,
        h.invoice_no,
        h.invoice_date,
        h.vendor_id,
        p.party_name AS vendor_name,
        p.party_code AS vendor_code,
        h.vendor_invoice_no,
        h.vendor_invoice_date,
        h.vendor_gstin,
        h.payment_terms_days,
        h.due_date,
        h.po_id,
        po.po_number,
        h.grn_id,
        grn.grn_no,
        h.qc_id,
        qc.qc_no,
        h.subtotal_amount::FLOAT AS subtotal_amount,
        h.discount_amount::FLOAT AS discount_amount,
        h.taxable_amount::FLOAT AS taxable_amount,
        h.cgst_amount::FLOAT AS cgst_amount,
        h.sgst_amount::FLOAT AS sgst_amount,
        h.igst_amount::FLOAT AS igst_amount,
        h.total_tax_amount::FLOAT AS total_tax_amount,
        h.freight_charges::FLOAT AS freight_charges,
        h.insurance_charges::FLOAT AS insurance_charges,
        h.packaging_charges::FLOAT AS packaging_charges,
        h.tds_rate::FLOAT AS tds_rate,
        h.tds_amount::FLOAT AS tds_amount,
        h.tcs_rate::FLOAT AS tcs_rate,
        h.tcs_amount::FLOAT AS tcs_amount,
        h.round_off::FLOAT AS round_off,
        h.net_payable_amount::FLOAT AS net_payable_amount,
        h.paid_amount::FLOAT AS paid_amount,
        h.balance_amount::FLOAT AS balance_amount,
        h.matching_status,
        h.status,
        h.payment_status,
        h.approved_by,
        u_app.full_name AS approved_by_name,
        h.approved_date,
        h.approval_remarks,
        h.cancel_reason,
        h.remarks,
        h.created_at,
        h.created_by,
        u_cr.full_name AS created_by_name,
        COUNT(i.invoice_item_id)::INT AS item_count
      FROM tbl_pur_invoice_header h
      JOIN tbl_crm_party p ON h.vendor_id = p.party_id
      LEFT JOIN tbl_po_header po ON h.po_id = po.po_id
      LEFT JOIN tbl_inv_grn_header grn ON h.grn_id = grn.grn_id
      LEFT JOIN tbl_qc_inward_inspection_header qc ON h.qc_id = qc.qc_id
      LEFT JOIN tbl_sec_user u_app ON h.approved_by = u_app.user_id
      LEFT JOIN tbl_sec_user u_cr ON h.created_by = u_cr.user_id
      LEFT JOIN tbl_pur_invoice_item i ON h.invoice_id = i.invoice_id AND i.is_active = TRUE
      WHERE ${conditions.join(' AND ')}
      GROUP BY
        h.invoice_id,
        p.party_name,
        p.party_code,
        po.po_number,
        grn.grn_no,
        qc.qc_no,
        u_app.full_name,
        u_cr.full_name
      ORDER BY h.invoice_id DESC;
    `;

    const res = await this.pool.query(sql, params);
    return res.rows;
  }

  // --------------------------------------------------------------------------
  // Find One (Detail View with Line Items)
  // --------------------------------------------------------------------------
  async findOneInvoice(invoiceId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const headSql = `
      SELECT
        h.invoice_id,
        h.comp_id,
        h.branch_id,
        h.fyear_id,
        h.invoice_no,
        h.invoice_date,
        h.vendor_id,
        p.party_name AS vendor_name,
        p.party_code AS vendor_code,
        h.vendor_invoice_no,
        h.vendor_invoice_date,
        h.vendor_gstin,
        h.payment_terms_days,
        h.due_date,
        h.po_id,
        po.po_number,
        po.po_date,
        h.grn_id,
        grn.grn_no,
        grn.grn_date,
        h.qc_id,
        qc.qc_no,
        qc.qc_date,
        h.subtotal_amount::FLOAT AS subtotal_amount,
        h.discount_amount::FLOAT AS discount_amount,
        h.taxable_amount::FLOAT AS taxable_amount,
        h.cgst_amount::FLOAT AS cgst_amount,
        h.sgst_amount::FLOAT AS sgst_amount,
        h.igst_amount::FLOAT AS igst_amount,
        h.total_tax_amount::FLOAT AS total_tax_amount,
        h.freight_charges::FLOAT AS freight_charges,
        h.insurance_charges::FLOAT AS insurance_charges,
        h.packaging_charges::FLOAT AS packaging_charges,
        h.tds_rate::FLOAT AS tds_rate,
        h.tds_amount::FLOAT AS tds_amount,
        h.tcs_rate::FLOAT AS tcs_rate,
        h.tcs_amount::FLOAT AS tcs_amount,
        h.round_off::FLOAT AS round_off,
        h.net_payable_amount::FLOAT AS net_payable_amount,
        h.paid_amount::FLOAT AS paid_amount,
        h.balance_amount::FLOAT AS balance_amount,
        h.matching_status,
        h.status,
        h.payment_status,
        h.approved_by,
        u_app.full_name AS approved_by_name,
        h.approved_date,
        h.approval_remarks,
        h.cancel_reason,
        h.remarks,
        h.created_at,
        h.created_by,
        u_cr.full_name AS created_by_name
      FROM tbl_pur_invoice_header h
      JOIN tbl_crm_party p ON h.vendor_id = p.party_id
      LEFT JOIN tbl_po_header po ON h.po_id = po.po_id
      LEFT JOIN tbl_inv_grn_header grn ON h.grn_id = grn.grn_id
      LEFT JOIN tbl_qc_inward_inspection_header qc ON h.qc_id = qc.qc_id
      LEFT JOIN tbl_sec_user u_app ON h.approved_by = u_app.user_id
      LEFT JOIN tbl_sec_user u_cr ON h.created_by = u_cr.user_id
      WHERE h.invoice_id = $1 AND h.comp_id = $2 AND h.is_active = TRUE;
    `;

    const headRes = await this.pool.query(headSql, [invoiceId, compId]);
    if (headRes.rows.length === 0) {
      throw new NotFoundException(`Purchase Invoice #${invoiceId} not found.`);
    }
    const invoice = headRes.rows[0];

    const itemSql = `
      SELECT
        i.invoice_item_id,
        i.invoice_id,
        i.po_item_id,
        i.grn_item_id,
        i.qc_item_id,
        i.item_id,
        it.item_code,
        it.item_name,
        COALESCE(i.item_description, it.item_name) AS item_description,
        i.hsn_code,
        i.uom_id,
        u.uom_code,
        u.uom_name,
        i.po_qty::FLOAT AS po_qty,
        i.received_qty::FLOAT AS received_qty,
        i.accepted_qty::FLOAT AS accepted_qty,
        i.billed_qty::FLOAT AS billed_qty,
        i.po_rate::FLOAT AS po_rate,
        i.invoiced_rate::FLOAT AS invoiced_rate,
        i.rate_variance::FLOAT AS rate_variance,
        i.item_amount::FLOAT AS item_amount,
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
        i.total_item_amount::FLOAT AS total_item_amount,
        i.batch_no,
        i.remarks
      FROM tbl_pur_invoice_item i
      JOIN tbl_inv_item it ON i.item_id = it.item_id
      JOIN tbl_inv_uom u ON i.uom_id = u.uom_id
      WHERE i.invoice_id = $1 AND i.is_active = TRUE
      ORDER BY i.invoice_item_id ASC;
    `;

    const itemRes = await this.pool.query(itemSql, [invoiceId]);
    return {
      ...invoice,
      items: itemRes.rows,
    };
  }

  // --------------------------------------------------------------------------
  // Create Invoice (with 3-Way Variance Evaluation)
  // --------------------------------------------------------------------------
  async createInvoice(
    dto: CreateInvoiceDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    // Check duplicate vendor invoice
    const dupCheck = await this.pool.query(
      `SELECT invoice_id, invoice_no FROM tbl_pur_invoice_header
       WHERE comp_id = $1 AND vendor_id = $2 AND vendor_invoice_no = $3 AND is_active = TRUE;`,
      [compId, dto.vendorId, dto.vendorInvoiceNo.trim()],
    );
    if (dupCheck.rows.length > 0) {
      throw new BadRequestException(
        `Vendor Invoice #${dto.vendorInvoiceNo} has already been registered in KS-MFG as ${dupCheck.rows[0].invoice_no}.`,
      );
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one invoice line item is required.');
    }

    const invoiceNo =
      dto.invoiceNo || (await this.generateInvoiceNumber(compId, branchId));

    // Calculate due date if not provided
    const termsDays = dto.paymentTermsDays || 30;
    let dueDate = dto.dueDate;
    if (!dueDate) {
      const invDate = new Date(dto.vendorInvoiceDate || dto.invoiceDate);
      invDate.setDate(invDate.getDate() + termsDays);
      dueDate = invDate.toISOString().split('T')[0];
    }

    // Determine 3-way matching status automatically if not forced
    let detectedMatchingStatus = 'MATCHED';
    let subtotalCalc = 0;
    let totalDiscountCalc = 0;
    let taxableCalc = 0;
    let cgstCalc = 0;
    let sgstCalc = 0;
    let igstCalc = 0;

    const processedItems = dto.items.map((it) => {
      const poQty = Number(it.poQty || 0);
      const receivedQty = Number(it.receivedQty || 0);
      const acceptedQty = Number(it.acceptedQty || 0);
      const billedQty = Number(it.billedQty || 0);
      const poRate = Number(it.poRate || 0);
      const invoicedRate = Number(it.invoicedRate || 0);
      const rateVariance = invoicedRate - poRate;

      // Variance detection
      if (Math.abs(rateVariance) > 0.01 && poRate > 0) {
        detectedMatchingStatus = 'PRICE_VARIANCE';
      }
      if (acceptedQty > 0 && billedQty - acceptedQty > 0.001) {
        if (detectedMatchingStatus === 'MATCHED') {
          detectedMatchingStatus = 'QTY_VARIANCE';
        }
      }

      const itemAmount = billedQty * invoicedRate;
      const discountPercent = Number(it.discountPercent || 0);
      const discountAmount =
        it.discountAmount !== undefined
          ? Number(it.discountAmount)
          : (itemAmount * discountPercent) / 100;
      const itemTaxable = itemAmount - discountAmount;

      const gstRate = Number(it.gstRate || 18.0);
      const cgstRate = Number(it.cgstRate || (it.igstRate ? 0 : gstRate / 2));
      const sgstRate = Number(it.sgstRate || (it.igstRate ? 0 : gstRate / 2));
      const igstRate = Number(it.igstRate || 0);

      const cgstAmt =
        it.cgstAmount !== undefined
          ? Number(it.cgstAmount)
          : (itemTaxable * cgstRate) / 100;
      const sgstAmt =
        it.sgstAmount !== undefined
          ? Number(it.sgstAmount)
          : (itemTaxable * sgstRate) / 100;
      const igstAmt =
        it.igstAmount !== undefined
          ? Number(it.igstAmount)
          : (itemTaxable * igstRate) / 100;
      const totalItemAmt = itemTaxable + cgstAmt + sgstAmt + igstAmt;

      subtotalCalc += itemAmount;
      totalDiscountCalc += discountAmount;
      taxableCalc += itemTaxable;
      cgstCalc += cgstAmt;
      sgstCalc += sgstAmt;
      igstCalc += igstAmt;

      return {
        ...it,
        poQty,
        receivedQty,
        acceptedQty,
        billedQty,
        poRate,
        invoicedRate,
        rateVariance,
        itemAmount: Math.round(itemAmount * 100) / 100,
        discountPercent,
        discountAmount: Math.round(discountAmount * 100) / 100,
        taxableAmount: Math.round(itemTaxable * 100) / 100,
        gstRate,
        cgstRate,
        cgstAmount: Math.round(cgstAmt * 100) / 100,
        sgstRate,
        sgstAmount: Math.round(sgstAmt * 100) / 100,
        igstRate,
        igstAmount: Math.round(igstAmt * 100) / 100,
        totalItemAmount: Math.round(totalItemAmt * 100) / 100,
      };
    });

    const finalMatchingStatus =
      dto.matchingStatus && dto.matchingStatus !== 'MATCHED'
        ? dto.matchingStatus
        : detectedMatchingStatus;

    const freight = Number(dto.freightCharges || 0);
    const insurance = Number(dto.insuranceCharges || 0);
    const packaging = Number(dto.packagingCharges || 0);
    const totalTax = cgstCalc + sgstCalc + igstCalc;
    const tdsRate = Number(dto.tdsRate || 0);
    const tdsAmount =
      dto.tdsAmount !== undefined
        ? Number(dto.tdsAmount)
        : (taxableCalc * tdsRate) / 100;
    const tcsRate = Number(dto.tcsRate || 0);
    const tcsAmount =
      dto.tcsAmount !== undefined
        ? Number(dto.tcsAmount)
        : ((taxableCalc + totalTax) * tcsRate) / 100;
    const rawNetPayable =
      taxableCalc +
      totalTax +
      freight +
      insurance +
      packaging -
      tdsAmount +
      tcsAmount;
    const roundOff =
      dto.roundOff !== undefined
        ? Number(dto.roundOff)
        : Math.round(rawNetPayable) - rawNetPayable;
    const netPayable =
      dto.netPayableAmount !== undefined
        ? Number(dto.netPayableAmount)
        : Math.round(rawNetPayable + roundOff);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const insertHeadSql = `
        INSERT INTO tbl_pur_invoice_header (
          comp_id, branch_id, fyear_id, invoice_no, invoice_date,
          vendor_id, po_id, grn_id, qc_id,
          vendor_invoice_no, vendor_invoice_date, vendor_gstin,
          payment_terms_days, due_date,
          subtotal_amount, discount_amount, taxable_amount,
          cgst_amount, sgst_amount, igst_amount, total_tax_amount,
          freight_charges, insurance_charges, packaging_charges,
          tds_rate, tds_amount, tcs_rate, tcs_amount,
          round_off, net_payable_amount, paid_amount, balance_amount,
          matching_status, status, payment_status, remarks,
          created_by, created_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11, $12,
          $13, $14,
          $15, $16, $17,
          $18, $19, $20, $21,
          $22, $23, $24,
          $25, $26, $27, $28,
          $29, $30, 0, $30,
          $31, $32, 'UNPAID', $33,
          $34, CURRENT_TIMESTAMP
        ) RETURNING invoice_id;
      `;

      const headRes = await client.query(insertHeadSql, [
        compId,
        branchId,
        fyearId,
        invoiceNo,
        dto.invoiceDate,
        dto.vendorId,
        dto.poId || null,
        dto.grnId || null,
        dto.qcId || null,
        dto.vendorInvoiceNo.trim(),
        dto.vendorInvoiceDate,
        dto.vendorGstin || null,
        termsDays,
        dueDate,
        Math.round(subtotalCalc * 100) / 100,
        Math.round(totalDiscountCalc * 100) / 100,
        Math.round(taxableCalc * 100) / 100,
        Math.round(cgstCalc * 100) / 100,
        Math.round(sgstCalc * 100) / 100,
        Math.round(igstCalc * 100) / 100,
        Math.round(totalTax * 100) / 100,
        freight,
        insurance,
        packaging,
        tdsRate,
        Math.round(tdsAmount * 100) / 100,
        tcsRate,
        Math.round(tcsAmount * 100) / 100,
        Math.round(roundOff * 100) / 100,
        netPayable,
        finalMatchingStatus,
        dto.status || 'DRAFT',
        dto.remarks || null,
        userId,
      ]);

      const newInvoiceId = headRes.rows[0].invoice_id;

      // Insert line items
      const insertItemSql = `
        INSERT INTO tbl_pur_invoice_item (
          invoice_id, po_item_id, grn_item_id, qc_item_id,
          item_id, item_description, hsn_code, uom_id,
          po_qty, received_qty, accepted_qty, billed_qty,
          po_rate, invoiced_rate, rate_variance, item_amount,
          discount_percent, discount_amount, taxable_amount,
          gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
          igst_rate, igst_amount, total_item_amount,
          batch_no, remarks, comp_id, branch_id, fyear_id, created_by
        ) VALUES (
          $1, $2, $3, $4,
          $5, $6, $7, $8,
          $9, $10, $11, $12,
          $13, $14, $15, $16,
          $17, $18, $19,
          $20, $21, $22, $23, $24,
          $25, $26, $27,
          $28, $29, $30, $31, $32, $33
        );
      `;

      for (const it of processedItems) {
        await client.query(insertItemSql, [
          newInvoiceId,
          it.poItemId || null,
          it.grnItemId || it.grnItemItemId || null,
          it.qcItemId || null,
          it.itemId,
          it.itemDescription || null,
          it.hsnCode || null,
          it.uomId,
          it.poQty,
          it.receivedQty,
          it.acceptedQty,
          it.billedQty,
          it.poRate,
          it.invoicedRate,
          it.rateVariance,
          it.itemAmount,
          it.discountPercent,
          it.discountAmount,
          it.taxableAmount,
          it.gstRate,
          it.cgstRate,
          it.cgstAmount,
          it.sgstRate,
          it.sgstAmount,
          it.igstRate,
          it.igstAmount,
          it.totalItemAmount,
          it.batchNo || null,
          it.remarks || null,
          compId,
          branchId,
          fyearId,
          userId,
        ]);
      }

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PURCHASE_INVOICE',
        actionType: 'CREATE',
        entityTable: 'tbl_pur_invoice_header',
        recordId: newInvoiceId,
        newValue: { invoiceNo, vendorInvoiceNo: dto.vendorInvoiceNo, netPayable },
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findOneInvoice(newInvoiceId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Update Invoice (DRAFT only)
  // --------------------------------------------------------------------------
  async updateInvoice(
    invoiceId: number,
    dto: UpdateInvoiceDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const currentRes = await this.pool.query(
      `SELECT * FROM tbl_pur_invoice_header WHERE invoice_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [invoiceId, compId],
    );
    if (currentRes.rows.length === 0) {
      throw new NotFoundException(`Invoice #${invoiceId} not found.`);
    }
    const current = currentRes.rows[0];
    if (current.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only DRAFT purchase invoices can be modified. Current status: '${current.status}'.`,
      );
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      let matchingStatus = current.matching_status;
      let subtotal = Number(current.subtotal_amount);
      let totalDiscount = Number(current.discount_amount);
      let taxable = Number(current.taxable_amount);
      let cgst = Number(current.cgst_amount);
      let sgst = Number(current.sgst_amount);
      let igst = Number(current.igst_amount);
      let totalTax = Number(current.total_tax_amount);
      let netPayable = Number(current.net_payable_amount);

      // If items provided, recreate line items
      if (dto.items && dto.items.length > 0) {
        let detectedMatching = 'MATCHED';
        subtotal = 0;
        totalDiscount = 0;
        taxable = 0;
        cgst = 0;
        sgst = 0;
        igst = 0;

        await client.query(
          `DELETE FROM tbl_pur_invoice_item WHERE invoice_id = $1;`,
          [invoiceId],
        );

        const insertItemSql = `
          INSERT INTO tbl_pur_invoice_item (
            invoice_id, po_item_id, grn_item_id, qc_item_id,
            item_id, item_description, hsn_code, uom_id,
            po_qty, received_qty, accepted_qty, billed_qty,
            po_rate, invoiced_rate, rate_variance, item_amount,
            discount_percent, discount_amount, taxable_amount,
            gst_rate, cgst_rate, cgst_amount, sgst_rate, sgst_amount,
            igst_rate, igst_amount, total_item_amount,
            batch_no, remarks, comp_id, branch_id, fyear_id, created_by
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8,
            $9, $10, $11, $12,
            $13, $14, $15, $16,
            $17, $18, $19,
            $20, $21, $22, $23, $24,
            $25, $26, $27,
            $28, $29, $30, $31, $32, $33
          );
        `;

        for (const it of dto.items) {
          const poQty = Number(it.poQty || 0);
          const receivedQty = Number(it.receivedQty || 0);
          const acceptedQty = Number(it.acceptedQty || 0);
          const billedQty = Number(it.billedQty || 0);
          const poRate = Number(it.poRate || 0);
          const invoicedRate = Number(it.invoicedRate || 0);
          const rateVariance = invoicedRate - poRate;

          if (Math.abs(rateVariance) > 0.01 && poRate > 0) {
            detectedMatching = 'PRICE_VARIANCE';
          }
          if (acceptedQty > 0 && billedQty - acceptedQty > 0.001) {
            if (detectedMatching === 'MATCHED') {
              detectedMatching = 'QTY_VARIANCE';
            }
          }

          const itemAmount = billedQty * invoicedRate;
          const discountPercent = Number(it.discountPercent || 0);
          const discountAmount =
            it.discountAmount !== undefined
              ? Number(it.discountAmount)
              : (itemAmount * discountPercent) / 100;
          const itemTaxable = itemAmount - discountAmount;

          const gstRate = Number(it.gstRate || 18.0);
          const cgstRate = Number(it.cgstRate || (it.igstRate ? 0 : gstRate / 2));
          const sgstRate = Number(it.sgstRate || (it.igstRate ? 0 : gstRate / 2));
          const igstRate = Number(it.igstRate || 0);

          const cgstAmt =
            it.cgstAmount !== undefined
              ? Number(it.cgstAmount)
              : (itemTaxable * cgstRate) / 100;
          const sgstAmt =
            it.sgstAmount !== undefined
              ? Number(it.sgstAmount)
              : (itemTaxable * sgstRate) / 100;
          const igstAmt =
            it.igstAmount !== undefined
              ? Number(it.igstAmount)
              : (itemTaxable * igstRate) / 100;
          const totalItemAmt = itemTaxable + cgstAmt + sgstAmt + igstAmt;

          subtotal += itemAmount;
          totalDiscount += discountAmount;
          taxable += itemTaxable;
          cgst += cgstAmt;
          sgst += sgstAmt;
          igst += igstAmt;

          await client.query(insertItemSql, [
            invoiceId,
            it.poItemId || null,
            it.grnItemId || it.grnItemItemId || null,
            it.qcItemId || null,
            it.itemId,
            it.itemDescription || null,
            it.hsnCode || null,
            it.uomId,
            poQty,
            receivedQty,
            acceptedQty,
            billedQty,
            poRate,
            invoicedRate,
            rateVariance,
            Math.round(itemAmount * 100) / 100,
            discountPercent,
            Math.round(discountAmount * 100) / 100,
            Math.round(itemTaxable * 100) / 100,
            gstRate,
            cgstRate,
            Math.round(cgstAmt * 100) / 100,
            sgstRate,
            Math.round(sgstAmt * 100) / 100,
            igstRate,
            Math.round(igstAmt * 100) / 100,
            Math.round(totalItemAmt * 100) / 100,
            it.batchNo || null,
            it.remarks || null,
            compId,
            branchId,
            fyearId,
            userId,
          ]);
        }

        matchingStatus = detectedMatching;
        totalTax = cgst + sgst + igst;
        const freight = Number(dto.freightCharges ?? current.freight_charges);
        const insurance = Number(dto.insuranceCharges ?? current.insurance_charges);
        const packaging = Number(dto.packagingCharges ?? current.packaging_charges);
        const tdsRate = Number(dto.tdsRate ?? current.tds_rate);
        const tdsAmount = (taxable * tdsRate) / 100;
        const tcsRate = Number(dto.tcsRate ?? current.tcs_rate);
        const tcsAmount = ((taxable + totalTax) * tcsRate) / 100;
        const rawNet =
          taxable + totalTax + freight + insurance + packaging - tdsAmount + tcsAmount;
        const roundOff = Math.round(rawNet) - rawNet;
        netPayable = Math.round(rawNet + roundOff);
      }

      const updateHeadSql = `
        UPDATE tbl_pur_invoice_header SET
          invoice_date = COALESCE($1, invoice_date),
          vendor_id = COALESCE($2, vendor_id),
          po_id = COALESCE($3, po_id),
          grn_id = COALESCE($4, grn_id),
          qc_id = COALESCE($5, qc_id),
          vendor_invoice_no = COALESCE($6, vendor_invoice_no),
          vendor_invoice_date = COALESCE($7, vendor_invoice_date),
          vendor_gstin = COALESCE($8, vendor_gstin),
          payment_terms_days = COALESCE($9, payment_terms_days),
          due_date = COALESCE($10, due_date),
          subtotal_amount = $11,
          discount_amount = $12,
          taxable_amount = $13,
          cgst_amount = $14,
          sgst_amount = $15,
          igst_amount = $16,
          total_tax_amount = $17,
          freight_charges = COALESCE($18, freight_charges),
          insurance_charges = COALESCE($19, insurance_charges),
          packaging_charges = COALESCE($20, packaging_charges),
          tds_rate = COALESCE($21, tds_rate),
          tds_amount = COALESCE($22, tds_amount),
          tcs_rate = COALESCE($23, tcs_rate),
          tcs_amount = COALESCE($24, tcs_amount),
          round_off = COALESCE($25, round_off),
          net_payable_amount = $26,
          balance_amount = $26 - paid_amount,
          matching_status = COALESCE($27, matching_status),
          remarks = COALESCE($28, remarks),
          updated_by = $29,
          updated_at = CURRENT_TIMESTAMP
        WHERE invoice_id = $30 AND comp_id = $31;
      `;

      await client.query(updateHeadSql, [
        dto.invoiceDate || null,
        dto.vendorId || null,
        dto.poId || null,
        dto.grnId || null,
        dto.qcId || null,
        dto.vendorInvoiceNo ? dto.vendorInvoiceNo.trim() : null,
        dto.vendorInvoiceDate || null,
        dto.vendorGstin || null,
        dto.paymentTermsDays || null,
        dto.dueDate || null,
        Math.round(subtotal * 100) / 100,
        Math.round(totalDiscount * 100) / 100,
        Math.round(taxable * 100) / 100,
        Math.round(cgst * 100) / 100,
        Math.round(sgst * 100) / 100,
        Math.round(igst * 100) / 100,
        Math.round(totalTax * 100) / 100,
        dto.freightCharges ?? null,
        dto.insuranceCharges ?? null,
        dto.packagingCharges ?? null,
        dto.tdsRate ?? null,
        dto.tdsAmount ?? null,
        dto.tcsRate ?? null,
        dto.tcsAmount ?? null,
        dto.roundOff ?? null,
        netPayable,
        dto.matchingStatus || matchingStatus,
        dto.remarks || null,
        userId,
        invoiceId,
        compId,
      ]);

      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PURCHASE_INVOICE',
        actionType: 'UPDATE',
        entityTable: 'tbl_pur_invoice_header',
        recordId: invoiceId,
        oldValue: current,
        newValue: dto,
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return this.findOneInvoice(invoiceId, user);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Submit Invoice (DRAFT -> SUBMITTED)
  // --------------------------------------------------------------------------
  async submitInvoice(
    invoiceId: number,
    dto: SubmitInvoiceDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const res = await this.pool.query(
      `SELECT invoice_id, invoice_no, status FROM tbl_pur_invoice_header
       WHERE invoice_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [invoiceId, compId],
    );
    if (res.rows.length === 0) {
      throw new NotFoundException(`Invoice #${invoiceId} not found.`);
    }
    const current = res.rows[0];
    if (current.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only DRAFT invoices can be submitted. Current status: '${current.status}'.`,
      );
    }

    const itemCheck = await this.pool.query(
      `SELECT COUNT(*)::INT AS cnt FROM tbl_pur_invoice_item WHERE invoice_id = $1 AND is_active = TRUE;`,
      [invoiceId],
    );
    if (itemCheck.rows[0].cnt === 0) {
      throw new BadRequestException('Cannot submit invoice with zero items.');
    }

    await this.pool.query(
      `UPDATE tbl_pur_invoice_header SET
        status = 'SUBMITTED',
        remarks = COALESCE($1, remarks),
        updated_by = $2,
        updated_at = CURRENT_TIMESTAMP
       WHERE invoice_id = $3 AND comp_id = $4;`,
      [dto.remarks || null, userId, invoiceId, compId],
    );

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'PURCHASE_INVOICE',
      actionType: 'SUBMIT',
      entityTable: 'tbl_pur_invoice_header',
      recordId: invoiceId,
      oldValue: { status: 'DRAFT' },
      newValue: { status: 'SUBMITTED' },
      compId,
      branchId,
      fyearId,
      ...meta,
    });

    return this.findOneInvoice(invoiceId, user);
  }

  // --------------------------------------------------------------------------
  // Approve Invoice (SUBMITTED -> APPROVED)
  // --------------------------------------------------------------------------
  async approveInvoice(
    invoiceId: number,
    dto: ApproveInvoiceDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const res = await this.pool.query(
      `SELECT invoice_id, invoice_no, status, net_payable_amount, paid_amount FROM tbl_pur_invoice_header
       WHERE invoice_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [invoiceId, compId],
    );
    if (res.rows.length === 0) {
      throw new NotFoundException(`Invoice #${invoiceId} not found.`);
    }
    const current = res.rows[0];
    if (current.status !== 'SUBMITTED') {
      throw new BadRequestException(
        `Only SUBMITTED invoices can be approved. Current status: '${current.status}'.`,
      );
    }

    const netPayable = Number(current.net_payable_amount);
    const paid = Number(current.paid_amount || 0);
    const balance = netPayable - paid;

    await this.pool.query(
      `UPDATE tbl_pur_invoice_header SET
        status = 'APPROVED',
        approved_by = $1,
        approved_date = CURRENT_TIMESTAMP,
        approval_remarks = $2,
        balance_amount = $3,
        updated_by = $1,
        updated_at = CURRENT_TIMESTAMP
       WHERE invoice_id = $4 AND comp_id = $5;`,
      [userId, dto.approvalRemarks || 'AP 3-Way Match Verified & Approved', balance, invoiceId, compId],
    );

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'PURCHASE_INVOICE',
      actionType: 'APPROVE',
      entityTable: 'tbl_pur_invoice_header',
      recordId: invoiceId,
      oldValue: { status: 'SUBMITTED' },
      newValue: { status: 'APPROVED', approvedBy: userId, balance },
      compId,
      branchId,
      fyearId,
      ...meta,
    });

    return this.findOneInvoice(invoiceId, user);
  }

  // --------------------------------------------------------------------------
  // Cancel Invoice
  // --------------------------------------------------------------------------
  async cancelInvoice(
    invoiceId: number,
    dto: CancelInvoiceDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const res = await this.pool.query(
      `SELECT invoice_id, invoice_no, status, paid_amount FROM tbl_pur_invoice_header
       WHERE invoice_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [invoiceId, compId],
    );
    if (res.rows.length === 0) {
      throw new NotFoundException(`Invoice #${invoiceId} not found.`);
    }
    const current = res.rows[0];
    if (current.status === 'CANCELLED') {
      throw new BadRequestException('Invoice is already cancelled.');
    }
    if (Number(current.paid_amount) > 0) {
      throw new BadRequestException(
        `Cannot cancel invoice with recorded payment of ₹${current.paid_amount}. Reverse AP payment first.`,
      );
    }

    await this.pool.query(
      `UPDATE tbl_pur_invoice_header SET
        status = 'CANCELLED',
        cancel_reason = $1,
        updated_by = $2,
        updated_at = CURRENT_TIMESTAMP
       WHERE invoice_id = $3 AND comp_id = $4;`,
      [dto.cancelReason, userId, invoiceId, compId],
    );

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'PURCHASE_INVOICE',
      actionType: 'CANCEL',
      entityTable: 'tbl_pur_invoice_header',
      recordId: invoiceId,
      oldValue: { status: current.status },
      newValue: { status: 'CANCELLED', cancelReason: dto.cancelReason },
      compId,
      branchId,
      fyearId,
      ...meta,
    });

    return this.findOneInvoice(invoiceId, user);
  }

  // --------------------------------------------------------------------------
  // Record Payment / AP Clearance
  // --------------------------------------------------------------------------
  async recordPayment(
    invoiceId: number,
    dto: RecordPaymentDto,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const res = await this.pool.query(
      `SELECT invoice_id, invoice_no, status, net_payable_amount, paid_amount, balance_amount
       FROM tbl_pur_invoice_header
       WHERE invoice_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [invoiceId, compId],
    );
    if (res.rows.length === 0) {
      throw new NotFoundException(`Invoice #${invoiceId} not found.`);
    }
    const current = res.rows[0];
    if (current.status !== 'APPROVED' && current.status !== 'PARTIALLY_PAID') {
      throw new BadRequestException(
        `Payments can only be cleared against APPROVED purchase invoices. Current status: '${current.status}'.`,
      );
    }

    const payAmt = Number(dto.paidAmount);
    if (payAmt <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero.');
    }

    const currentBalance = Number(current.balance_amount);
    if (payAmt > currentBalance) {
      throw new BadRequestException(
        `Payment amount (₹${payAmt}) exceeds outstanding AP balance (₹${currentBalance}).`,
      );
    }

    const newPaid = Number(current.paid_amount) + payAmt;
    const newBalance = Number(current.net_payable_amount) - newPaid;
    const newPaymentStatus = newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID';
    const newStatus = newBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    await this.pool.query(
      `UPDATE tbl_pur_invoice_header SET
        paid_amount = $1,
        balance_amount = $2,
        payment_status = $3,
        status = $4,
        updated_by = $5,
        updated_at = CURRENT_TIMESTAMP
       WHERE invoice_id = $6 AND comp_id = $7;`,
      [newPaid, newBalance, newPaymentStatus, newStatus, userId, invoiceId, compId],
    );

    await this.auditLogService.logAction({
      userId,
      username: user.username,
      screenCode: 'PURCHASE_INVOICE',
      actionType: 'PAYMENT_CLEARANCE',
      entityTable: 'tbl_pur_invoice_header',
      recordId: invoiceId,
      oldValue: { paidAmount: current.paid_amount, balanceAmount: current.balance_amount },
      newValue: {
        paidAmount: newPaid,
        balanceAmount: newBalance,
        paymentMode: dto.paymentMode,
        paymentRefNo: dto.paymentRefNo,
      },
      compId,
      branchId,
      fyearId,
      ...meta,
    });

    return this.findOneInvoice(invoiceId, user);
  }

  // --------------------------------------------------------------------------
  // Delete Invoice (DRAFT only)
  // --------------------------------------------------------------------------
  async deleteInvoice(
    invoiceId: number,
    user: AuthenticatedUserContext,
    meta?: any,
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || null;
    const userId = user.userId || 1001;

    const res = await this.pool.query(
      `SELECT invoice_id, invoice_no, status FROM tbl_pur_invoice_header
       WHERE invoice_id = $1 AND comp_id = $2 AND is_active = TRUE;`,
      [invoiceId, compId],
    );
    if (res.rows.length === 0) {
      throw new NotFoundException(`Invoice #${invoiceId} not found.`);
    }
    const current = res.rows[0];
    if (current.status !== 'DRAFT') {
      throw new BadRequestException(
        `Only DRAFT invoices can be deleted. Current status: '${current.status}'.`,
      );
    }

    await this.dependencyCheckService.verifyCanDelete({
      entity: 'Purchase Invoice',
      entityId: invoiceId,
      relations: [],
    });

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `DELETE FROM tbl_pur_invoice_item WHERE invoice_id = $1;`,
        [invoiceId],
      );
      await client.query(
        `DELETE FROM tbl_pur_invoice_header WHERE invoice_id = $1;`,
        [invoiceId],
      );
      await client.query('COMMIT');

      await this.auditLogService.logAction({
        userId,
        username: user.username,
        screenCode: 'PURCHASE_INVOICE',
        actionType: 'DELETE',
        entityTable: 'tbl_pur_invoice_header',
        recordId: invoiceId,
        oldValue: current,
        compId,
        branchId,
        fyearId,
        ...meta,
      });

      return {
        success: true,
        message: `Purchase Invoice #${current.invoice_no} deleted successfully.`,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --------------------------------------------------------------------------
  // Lookups & 3-Way Match Helpers
  // --------------------------------------------------------------------------

  // Get Approved / Completed GRNs ready for Commercial Invoicing
  async getPendingGrns(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const sql = `
      SELECT
        g.grn_id,
        g.grn_no,
        g.grn_date,
        g.vendor_id,
        p.party_name AS vendor_name,
        p.party_code AS vendor_code,
        g.po_id,
        po.po_number,
        po.po_date,
        g.challan_no,
        g.challan_date,
        g.invoice_no AS challan_invoice_no,
        g.status AS grn_status,
        qc.qc_id,
        qc.qc_no,
        qc.overall_result AS qc_result
      FROM tbl_inv_grn_header g
      JOIN tbl_crm_party p ON g.vendor_id = p.party_id
      LEFT JOIN tbl_po_header po ON g.po_id = po.po_id
      LEFT JOIN tbl_qc_inward_inspection_header qc ON g.grn_id = qc.grn_id AND qc.is_active = TRUE
      WHERE g.comp_id = $1
        AND g.is_active = TRUE
        AND g.status IN ('APPROVED', 'QC_IN_PROGRESS', 'SUBMITTED')
      ORDER BY g.grn_id DESC;
    `;
    const res = await this.pool.query(sql, [compId]);
    return res.rows;
  }

  // Get GRN Line Items with QC Accepted Qty & PO Rate for 1-Click Import
  async getGrnDetails(grnId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const grnSql = `
      SELECT
        g.grn_id,
        g.grn_no,
        g.grn_date,
        g.vendor_id,
        p.party_name AS vendor_name,
        p.party_code AS vendor_code,
        pa.gstin AS vendor_gstin,
        g.po_id,
        po.po_number,
        po.po_date,
        g.challan_no,
        g.challan_date,
        qc.qc_id,
        qc.qc_no,
        qc.overall_result AS qc_result
      FROM tbl_inv_grn_header g
      JOIN tbl_crm_party p ON g.vendor_id = p.party_id
      LEFT JOIN tbl_crm_party_address pa ON p.party_id = pa.party_id AND pa.is_default = TRUE
      LEFT JOIN tbl_po_header po ON g.po_id = po.po_id
      LEFT JOIN tbl_qc_inward_inspection_header qc ON g.grn_id = qc.grn_id AND qc.is_active = TRUE
      WHERE g.grn_id = $1 AND g.comp_id = $2 AND g.is_active = TRUE;
    `;
    const grnRes = await this.pool.query(grnSql, [grnId, compId]);
    if (grnRes.rows.length === 0) {
      throw new NotFoundException(`GRN #${grnId} not found.`);
    }
    const grn = grnRes.rows[0];

    const itemSql = `
      SELECT
        gi.grn_item_id,
        gi.po_item_id,
        qci.qc_item_id,
        gi.item_id,
        it.item_code,
        it.item_name,
        it.hsn_code,
        gi.uom_id,
        u.uom_code,
        u.uom_name,
        COALESCE(poi.quantity, gi.order_qty, 0)::FLOAT AS po_qty,
        COALESCE(poi.unit_price, gi.unit_rate, 0)::FLOAT AS po_rate,
        gi.received_qty::FLOAT AS received_qty,
        COALESCE(qci.accepted_qty, gi.accepted_qty, gi.received_qty)::FLOAT AS accepted_qty,
        COALESCE(qci.accepted_qty, gi.accepted_qty, gi.received_qty)::FLOAT AS billed_qty,
        COALESCE(poi.unit_price, gi.unit_rate, 0)::FLOAT AS invoiced_rate,
        0.0000::FLOAT AS rate_variance,
        (COALESCE(qci.accepted_qty, gi.accepted_qty, gi.received_qty) * COALESCE(poi.unit_price, gi.unit_rate, 0))::FLOAT AS item_amount,
        COALESCE(poi.gst_rate, 18.0)::FLOAT AS gst_rate,
        gi.batch_no,
        gi.remarks
      FROM tbl_inv_grn_item gi
      JOIN tbl_inv_item it ON gi.item_id = it.item_id
      JOIN tbl_inv_uom u ON gi.uom_id = u.uom_id
      LEFT JOIN tbl_po_item poi ON gi.po_item_id = poi.po_item_id
      LEFT JOIN tbl_qc_inward_inspection_item qci ON gi.grn_item_id = qci.grn_item_id
      WHERE gi.grn_id = $1 AND gi.is_active = TRUE
      ORDER BY gi.grn_item_id ASC;
    `;
    const itemRes = await this.pool.query(itemSql, [grnId]);

    return {
      ...grn,
      items: itemRes.rows,
    };
  }

  // Get Approved Purchase Orders
  async getApprovedPurchaseOrders(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const sql = `
      SELECT
        po.po_id,
        po.po_number,
        po.po_date,
        po.vendor_id,
        p.party_name AS vendor_name,
        p.party_code AS vendor_code,
        po.total_amount::FLOAT AS total_amount,
        po.status
      FROM tbl_po_header po
      JOIN tbl_crm_party p ON po.vendor_id = p.party_id
      WHERE po.comp_id = $1
        AND po.is_active = TRUE
        AND po.status = 'APPROVED'
      ORDER BY po.po_id DESC;
    `;
    const res = await this.pool.query(sql, [compId]);
    return res.rows;
  }

  // Get PO Items for direct PO Invoicing
  async getPoDetails(poId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;

    const poSql = `
      SELECT
        po.po_id,
        po.po_number,
        po.po_date,
        po.vendor_id,
        p.party_name AS vendor_name,
        p.party_code AS vendor_code,
        pa.gstin AS vendor_gstin,
        po.payment_terms
      FROM tbl_po_header po
      JOIN tbl_crm_party p ON po.vendor_id = p.party_id
      LEFT JOIN tbl_crm_party_address pa ON p.party_id = pa.party_id AND pa.is_default = TRUE
      WHERE po.po_id = $1 AND po.comp_id = $2 AND po.is_active = TRUE;
    `;
    const poRes = await this.pool.query(poSql, [poId, compId]);
    if (poRes.rows.length === 0) {
      throw new NotFoundException(`PO #${poId} not found.`);
    }
    const po = poRes.rows[0];

    const itemSql = `
      SELECT
        poi.po_item_id,
        poi.item_id,
        it.item_code,
        it.item_name,
        it.hsn_code,
        poi.uom_id,
        u.uom_code,
        u.uom_name,
        poi.quantity::FLOAT AS po_qty,
        poi.received_quantity::FLOAT AS received_qty,
        poi.quantity::FLOAT AS accepted_qty,
        poi.quantity::FLOAT AS billed_qty,
        poi.unit_price::FLOAT AS po_rate,
        poi.unit_price::FLOAT AS invoiced_rate,
        0.0000::FLOAT AS rate_variance,
        poi.line_total::FLOAT AS item_amount,
        COALESCE(poi.gst_rate, 18.0)::FLOAT AS gst_rate
      FROM tbl_po_item poi
      JOIN tbl_inv_item it ON poi.item_id = it.item_id
      JOIN tbl_inv_uom u ON poi.uom_id = u.uom_id
      WHERE poi.po_id = $1 AND poi.is_active = TRUE
      ORDER BY poi.po_item_id ASC;
    `;
    const itemRes = await this.pool.query(itemSql, [poId]);

    return {
      ...po,
      items: itemRes.rows,
    };
  }

  // Get active vendors / suppliers
  async getVendors(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const sql = `
      SELECT
        p.party_id,
        p.party_code,
        p.party_name,
        p.trade_name,
        pa.gstin,
        p.credit_days,
        p.payment_terms
      FROM tbl_crm_party p
      LEFT JOIN tbl_crm_party_address pa ON p.party_id = pa.party_id AND pa.is_default = TRUE
      WHERE p.comp_id = $1 AND p.is_supplier = TRUE AND p.is_active = TRUE
      ORDER BY p.party_name ASC;
    `;
    const res = await this.pool.query(sql, [compId]);
    return res.rows;
  }
}
