import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import * as crypto from 'crypto';
import { DRIZZLE_DB } from '../../../database/database.module';
import type { DrizzleDb } from '../../../database/database.module';
import {
  tblSalesInvoiceHeader,
  tblSalesInvoiceItem,
  tblSalesArPaymentReceipt,
  tblSalesDeliveryChallanHeader,
  tblSalesDeliveryChallanItem,
  tblSalesOrderHeader,
  tblSalesOrderItem,
  tblCrmParty,
  tblCrmPartyAddress,
  tblInvItem,
  tblInvUom,
  tblSecUser,
  tblOrgBranch,
  tblOrgFinancialYear,
} from '../../../database/schema';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import { AuditLogService } from '../../../common/services/audit-log.service';
import type {
  CancelInvoiceDto,
  CreateInvoiceDto,
  GenerateIrnDto,
  InvoiceFilterParams,
  PostInvoiceDto,
  RecordPaymentDto,
  UpdateInvoiceDto,
} from './invoice.dto';

@Injectable()
export class InvoiceService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly auditLogService: AuditLogService,
  ) {}

  // 1. KPI Summary
  async getInvoiceSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const res = await this.db.execute(sql`
      SELECT
        COUNT(*)::int AS total_invoices,
        COALESCE(SUM(total_invoice_amount), 0)::numeric(14,2) AS total_invoiced_value,
        COALESCE(SUM(paid_amount), 0)::numeric(14,2) AS total_received_value,
        COALESCE(SUM(balance_amount) FILTER (WHERE status IN ('POSTED', 'PARTIALLY_PAID')), 0)::numeric(14,2) AS total_outstanding_ar,
        COUNT(*) FILTER (WHERE status = 'DRAFT')::int AS draft_count,
        COUNT(*) FILTER (WHERE status = 'POSTED')::int AS posted_count,
        COUNT(*) FILTER (WHERE payment_status = 'PAID')::int AS fully_paid_count,
        COUNT(*) FILTER (WHERE irn_status = 'GENERATED')::int AS e_invoices_active,
        COUNT(*) FILTER (WHERE status IN ('POSTED', 'PARTIALLY_PAID') AND due_date < CURRENT_DATE)::int AS overdue_count
      FROM tbl_sales_invoice_header
      WHERE comp_id = ${compId}
        AND branch_id = ${branchId}
        AND is_active = TRUE
    `);

    return res.rows[0];
  }

  // 2. Pending Dispatches (Delivery Challans) and Open Sales Orders for 1-Click Billing
  async getPendingDispatches(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    // Dispatched Challans
    const challansRes = await this.db.execute(sql`
      SELECT
        dc.challan_id,
        dc.challan_no,
        dc.challan_date,
        dc.customer_id,
        dc.customer_name,
        dc.so_id,
        dc.status,
        dc.total_quantity,
        dc.total_value,
        dc.e_way_bill_no,
        dc.transporter_name,
        dc.vehicle_no,
        COUNT(dci.challan_item_id)::int AS item_count
      FROM tbl_sales_delivery_challan_header dc
      LEFT JOIN tbl_sales_delivery_challan_item dci ON dci.challan_id = dc.challan_id AND dci.is_active = TRUE
      WHERE dc.comp_id = ${compId}
        AND dc.branch_id = ${branchId}
        AND dc.status IN ('DISPATCHED', 'DELIVERED')
        AND dc.is_active = TRUE
      GROUP BY dc.challan_id
      ORDER BY dc.challan_date DESC, dc.challan_id DESC
    `);

    // Open Confirmed Sales Orders
    const ordersRes = await this.db.execute(sql`
      SELECT
        so.so_id,
        so.so_no,
        so.so_date,
        so.customer_id,
        so.customer_name,
        so.status,
        so.total_amount,
        COUNT(soi.so_item_id)::int AS item_count
      FROM tbl_sales_order_header so
      JOIN tbl_sales_order_item soi ON soi.so_id = so.so_id AND soi.is_active = TRUE
      WHERE so.comp_id = ${compId}
        AND so.branch_id = ${branchId}
        AND so.status IN ('CONFIRMED', 'IN_PRODUCTION', 'READY_FOR_DISPATCH', 'PARTIALLY_DELIVERED', 'COMPLETED')
        AND so.is_active = TRUE
        AND soi.ordered_qty > soi.invoiced_qty
      GROUP BY so.so_id
      ORDER BY so.so_date DESC, so.so_id DESC
    `);

    return {
      dispatchedChallans: challansRes.rows,
      openOrders: ordersRes.rows,
    };
  }

  // 3. Get Details from Delivery Challan for 1-Click Form Pre-fill
  async getChallanDetails(challanId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const [header] = await this.db
      .select()
      .from(tblSalesDeliveryChallanHeader)
      .where(
        and(
          eq(tblSalesDeliveryChallanHeader.challanId, challanId),
          eq(tblSalesDeliveryChallanHeader.compId, compId),
          eq(tblSalesDeliveryChallanHeader.branchId, branchId),
        ),
      );

    if (!header) {
      throw new NotFoundException(`Delivery Challan #${challanId} not found`);
    }

    const items = await this.db
      .select()
      .from(tblSalesDeliveryChallanItem)
      .where(
        and(
          eq(tblSalesDeliveryChallanItem.challanId, challanId),
          eq(tblSalesDeliveryChallanItem.isActive, true),
        ),
      );

    // Fetch customer details
    const [customer] = await this.db
      .select()
      .from(tblCrmParty)
      .where(eq(tblCrmParty.partyId, header.customerId));

    return {
      header,
      items,
      customer,
    };
  }

  // 4. Get Details from Sales Order for 1-Click Form Pre-fill
  async getSoDetails(soId: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const [header] = await this.db
      .select()
      .from(tblSalesOrderHeader)
      .where(
        and(
          eq(tblSalesOrderHeader.soId, soId),
          eq(tblSalesOrderHeader.compId, compId),
          eq(tblSalesOrderHeader.branchId, branchId),
        ),
      );

    if (!header) {
      throw new NotFoundException(`Sales Order #${soId} not found`);
    }

    const items = await this.db
      .select()
      .from(tblSalesOrderItem)
      .where(
        and(
          eq(tblSalesOrderItem.soId, soId),
          eq(tblSalesOrderItem.isActive, true),
        ),
      );

    const [customer] = await this.db
      .select()
      .from(tblCrmParty)
      .where(eq(tblCrmParty.partyId, header.customerId));

    return {
      header,
      items,
      customer,
    };
  }

  // 5. Find All Invoices with Filtering & Pagination
  async findAllInvoices(filters: InvoiceFilterParams, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const page = filters.page || 1;
    const limit = filters.limit || 25;
    const offset = (page - 1) * limit;

    const conditions = [
      eq(tblSalesInvoiceHeader.compId, compId),
      eq(tblSalesInvoiceHeader.branchId, branchId),
      eq(tblSalesInvoiceHeader.isActive, true),
    ];

    if (filters.status) {
      conditions.push(eq(tblSalesInvoiceHeader.status, filters.status));
    }
    if (filters.paymentStatus) {
      conditions.push(eq(tblSalesInvoiceHeader.paymentStatus, filters.paymentStatus));
    }
    if (filters.irnStatus) {
      conditions.push(eq(tblSalesInvoiceHeader.irnStatus, filters.irnStatus));
    }
    if (filters.customerId) {
      conditions.push(eq(tblSalesInvoiceHeader.customerId, filters.customerId));
    }
    if (filters.startDate) {
      conditions.push(sql`${tblSalesInvoiceHeader.invoiceDate} >= ${filters.startDate}`);
    }
    if (filters.endDate) {
      conditions.push(sql`${tblSalesInvoiceHeader.invoiceDate} <= ${filters.endDate}`);
    }
    if (filters.search) {
      const q = `%${filters.search.trim()}%`;
      conditions.push(
        or(
          ilike(tblSalesInvoiceHeader.invoiceNo, q),
          ilike(tblSalesInvoiceHeader.customerName, q),
          ilike(tblSalesInvoiceHeader.customerGstin, q),
          ilike(tblSalesInvoiceHeader.irnNo, q),
          ilike(tblSalesInvoiceHeader.eWayBillNo, q),
        )!,
      );
    }

    const whereClause = and(...conditions);

    const [countResult] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(tblSalesInvoiceHeader)
      .where(whereClause);

    const total = countResult?.total || 0;

    const rows = await this.db
      .select()
      .from(tblSalesInvoiceHeader)
      .where(whereClause)
      .orderBy(desc(tblSalesInvoiceHeader.invoiceDate), desc(tblSalesInvoiceHeader.invoiceId))
      .limit(limit)
      .offset(offset);

    return {
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 6. Find One Invoice with Items, Allocations, and Audit info
  async findOneInvoice(id: number, user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const [header] = await this.db
      .select()
      .from(tblSalesInvoiceHeader)
      .where(
        and(
          eq(tblSalesInvoiceHeader.invoiceId, id),
          eq(tblSalesInvoiceHeader.compId, compId),
          eq(tblSalesInvoiceHeader.branchId, branchId),
        ),
      );

    if (!header) {
      throw new NotFoundException(`Invoice #${id} not found`);
    }

    const items = await this.db
      .select({
        invoiceItemId: tblSalesInvoiceItem.invoiceItemId,
        invoiceId: tblSalesInvoiceItem.invoiceId,
        soItemId: tblSalesInvoiceItem.soItemId,
        challanItemId: tblSalesInvoiceItem.challanItemId,
        itemSequence: tblSalesInvoiceItem.itemSequence,
        itemId: tblSalesInvoiceItem.itemId,
        itemCode: tblSalesInvoiceItem.itemCode,
        itemName: tblSalesInvoiceItem.itemName,
        description: tblSalesInvoiceItem.description,
        hsnSacCode: tblSalesInvoiceItem.hsnSacCode,
        uomId: tblSalesInvoiceItem.uomId,
        uomCode: tblInvUom.uomCode,
        quantity: tblSalesInvoiceItem.quantity,
        unitRate: tblSalesInvoiceItem.unitRate,
        grossAmount: tblSalesInvoiceItem.grossAmount,
        discountPercent: tblSalesInvoiceItem.discountPercent,
        discountAmount: tblSalesInvoiceItem.discountAmount,
        taxableAmount: tblSalesInvoiceItem.taxableAmount,
        gstRate: tblSalesInvoiceItem.gstRate,
        cgstRate: tblSalesInvoiceItem.cgstRate,
        cgstAmount: tblSalesInvoiceItem.cgstAmount,
        sgstRate: tblSalesInvoiceItem.sgstRate,
        sgstAmount: tblSalesInvoiceItem.sgstAmount,
        igstRate: tblSalesInvoiceItem.igstRate,
        igstAmount: tblSalesInvoiceItem.igstAmount,
        totalTaxAmount: tblSalesInvoiceItem.totalTaxAmount,
        totalItemAmount: tblSalesInvoiceItem.totalItemAmount,
        batchNo: tblSalesInvoiceItem.batchNo,
        heatNo: tblSalesInvoiceItem.heatNo,
        remarks: tblSalesInvoiceItem.remarks,
      })
      .from(tblSalesInvoiceItem)
      .leftJoin(tblInvUom, eq(tblInvUom.uomId, tblSalesInvoiceItem.uomId))
      .where(
        and(
          eq(tblSalesInvoiceItem.invoiceId, id),
          eq(tblSalesInvoiceItem.isActive, true),
        ),
      )
      .orderBy(tblSalesInvoiceItem.itemSequence);

    // Fetch payments / AR receipts
    const payments = await this.db
      .select()
      .from(tblSalesArPaymentReceipt)
      .where(
        and(
          eq(tblSalesArPaymentReceipt.invoiceId, id),
          eq(tblSalesArPaymentReceipt.isActive, true),
        ),
      )
      .orderBy(desc(tblSalesArPaymentReceipt.receiptDate));

    return {
      header,
      items,
      payments,
    };
  }

  // 7. Auto-generate Sequential Invoice Number
  private async generateInvoiceNo(compId: number, branchId: number): Promise<string> {
    const [branch] = await this.db
      .select()
      .from(tblOrgBranch)
      .where(eq(tblOrgBranch.branchId, branchId));

    const branchCode = branch?.branchCode ? branch.branchCode.replace(/[^A-Za-z0-9]/g, '').substring(0, 3).toUpperCase() : 'AHM';
    const fyearCode = '2627';

    const res = await this.db.execute(sql`
      SELECT COALESCE(MAX(SUBSTRING(invoice_no FROM '[0-9]+$')::int), 0) + 1 AS next_seq
      FROM tbl_sales_invoice_header
      WHERE comp_id = ${compId}
        AND branch_id = ${branchId}
        AND invoice_no LIKE ${'INV-' + branchCode + '-' + fyearCode + '-%'}
    `);

    const nextSeq = res.rows[0]?.next_seq || 1;
    const seqStr = String(nextSeq).padStart(4, '0');
    return `INV-${branchCode}-${fyearCode}-${seqStr}`;
  }

  // 8. Auto-generate Sequential AR Receipt Number
  private async generateReceiptNo(compId: number, branchId: number): Promise<string> {
    const [branch] = await this.db
      .select()
      .from(tblOrgBranch)
      .where(eq(tblOrgBranch.branchId, branchId));

    const branchCode = branch?.branchCode ? branch.branchCode.replace(/[^A-Za-z0-9]/g, '').substring(0, 3).toUpperCase() : 'AHM';
    const fyearCode = '2627';

    const res = await this.db.execute(sql`
      SELECT COALESCE(MAX(SUBSTRING(receipt_no FROM '[0-9]+$')::int), 0) + 1 AS next_seq
      FROM tbl_sales_ar_payment_receipt
      WHERE comp_id = ${compId}
        AND branch_id = ${branchId}
        AND receipt_no LIKE ${'REC-' + branchCode + '-' + fyearCode + '-%'}
    `);

    const nextSeq = res.rows[0]?.next_seq || 1;
    const seqStr = String(nextSeq).padStart(4, '0');
    return `REC-${branchCode}-${fyearCode}-${seqStr}`;
  }

  // 9. Create Invoice
  async createInvoice(
    dto: CreateInvoiceDto,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one line item is required to generate an invoice');
    }

    // Determine Supply Type & Tax Breakdown (State 24 = Gujarat)
    const placeOfSupply = dto.placeOfSupply || '24 - Gujarat';
    const isIntraState = placeOfSupply.startsWith('24') || dto.supplyType === 'INTRA_STATE';
    const supplyType = isIntraState ? 'INTRA_STATE' : (dto.supplyType || 'INTER_STATE');

    const invoiceNo = await this.generateInvoiceNo(compId, branchId);

    // Calculate Due Date
    const paymentTermsDays = dto.paymentTermsDays !== undefined ? dto.paymentTermsDays : 30;
    const invoiceDateObj = new Date(dto.invoiceDate);
    const calculatedDueDate = new Date(invoiceDateObj.getTime() + paymentTermsDays * 24 * 60 * 60 * 1000);
    const dueDateStr = dto.dueDate || calculatedDueDate.toISOString().split('T')[0];

    // Compute Item Taxes & Subtotals
    let subtotalAmount = 0;
    let discountAmount = 0;
    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    const computedItems = dto.items.map((item, idx) => {
      const qty = Number(item.quantity);
      const rate = Number(item.unitRate);
      const gross = Math.round(qty * rate * 100) / 100;
      const discPct = Number(item.discountPercent || 0);
      const discAmt = Math.round(gross * (discPct / 100) * 100) / 100;
      const itemTaxable = Math.round((gross - discAmt) * 100) / 100;

      const gstRate = item.gstRate !== undefined ? Number(item.gstRate) : 18.0;
      let cgstRate = 0;
      let cgst = 0;
      let sgstRate = 0;
      let sgst = 0;
      let igstRate = 0;
      let igst = 0;

      if (supplyType === 'INTRA_STATE') {
        cgstRate = gstRate / 2;
        sgstRate = gstRate / 2;
        cgst = Math.round(itemTaxable * (cgstRate / 100) * 100) / 100;
        sgst = Math.round(itemTaxable * (sgstRate / 100) * 100) / 100;
      } else {
        igstRate = gstRate;
        igst = Math.round(itemTaxable * (igstRate / 100) * 100) / 100;
      }

      const totalTax = cgst + sgst + igst;
      const totalItem = Math.round((itemTaxable + totalTax) * 100) / 100;

      subtotalAmount += gross;
      discountAmount += discAmt;
      taxableAmount += itemTaxable;
      cgstAmount += cgst;
      sgstAmount += sgst;
      igstAmount += igst;

      return {
        ...item,
        itemSequence: idx + 1,
        quantity: String(qty),
        unitRate: String(rate),
        grossAmount: String(gross),
        discountPercent: String(discPct),
        discountAmount: String(discAmt),
        taxableAmount: String(itemTaxable),
        gstRate: String(gstRate),
        cgstRate: String(cgstRate),
        cgstAmount: String(cgst),
        sgstRate: String(sgstRate),
        sgstAmount: String(sgst),
        igstRate: String(igstRate),
        igstAmount: String(igst),
        totalTaxAmount: String(totalTax),
        totalItemAmount: String(totalItem),
      };
    });

    const totalTaxAmount = cgstAmount + sgstAmount + igstAmount;
    const freightCharges = Number(dto.freightCharges || 0);
    const insuranceCharges = Number(dto.insuranceCharges || 0);
    const packagingCharges = Number(dto.packagingCharges || 0);
    const tcsRate = Number(dto.tcsRate || 0);

    const preliminaryTotal =
      taxableAmount +
      totalTaxAmount +
      freightCharges +
      insuranceCharges +
      packagingCharges;

    const tcsAmount = Math.round(preliminaryTotal * (tcsRate / 100) * 100) / 100;
    const unroundedTotal = preliminaryTotal + tcsAmount;
    const roundedTotal = Math.round(unroundedTotal);
    const roundOff = Math.round((roundedTotal - unroundedTotal) * 100) / 100;

    const totalInvoiceAmount = roundedTotal;
    const balanceAmount = roundedTotal;

    // Insert Header and Items
    const [insertedHeader] = await this.db
      .insert(tblSalesInvoiceHeader)
      .values({
        invoiceNo,
        invoiceDate: dto.invoiceDate,
        invoiceType: dto.invoiceType || 'TAX_INVOICE',
        challanId: dto.challanId || null,
        soId: dto.soId || null,
        customerId: dto.customerId,
        customerName: dto.customerName,
        contactPerson: dto.contactPerson || null,
        contactPhone: dto.contactPhone || null,
        billingAddressId: dto.billingAddressId || null,
        billingAddress: dto.billingAddress || null,
        shippingAddressId: dto.shippingAddressId || null,
        shippingAddress: dto.shippingAddress || null,
        placeOfSupply,
        customerGstin: dto.customerGstin || null,
        customerPan: dto.customerPan || null,
        supplyType,
        reverseChargeApplicable: dto.reverseChargeApplicable || false,
        transporterName: dto.transporterName || null,
        vehicleNo: dto.vehicleNo || null,
        lrRrNo: dto.lrRrNo || null,
        lrRrDate: dto.lrRrDate || null,
        irnStatus: 'NOT_GENERATED',
        paymentTermsDays,
        dueDate: dueDateStr,
        currencyCode: 'INR',
        subtotalAmount: String(subtotalAmount),
        discountAmount: String(discountAmount),
        taxableAmount: String(taxableAmount),
        cgstAmount: String(cgstAmount),
        sgstAmount: String(sgstAmount),
        igstAmount: String(igstAmount),
        totalTaxAmount: String(totalTaxAmount),
        freightCharges: String(freightCharges),
        insuranceCharges: String(insuranceCharges),
        packagingCharges: String(packagingCharges),
        tcsRate: String(tcsRate),
        tcsAmount: String(tcsAmount),
        roundOff: String(roundOff),
        totalInvoiceAmount: String(totalInvoiceAmount),
        paidAmount: '0.00',
        balanceAmount: String(balanceAmount),
        status: 'DRAFT',
        paymentStatus: 'UNPAID',
        remarks: dto.remarks || null,
        termsAndConditions:
          dto.termsAndConditions ||
          '1. Payment due strictly within agreed credit terms. 2. Interest @ 18% p.a. chargeable on delayed payment.',
        isActive: true,
        compId,
        branchId,
        createdBy: userId,
      })
      .returning();

    // Insert Items
    for (const item of computedItems) {
      await this.db.insert(tblSalesInvoiceItem).values({
        invoiceId: insertedHeader.invoiceId,
        soItemId: item.soItemId || null,
        challanItemId: item.challanItemId || null,
        itemSequence: item.itemSequence,
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        description: item.description || null,
        hsnSacCode: item.hsnSacCode || null,
        uomId: item.uomId,
        quantity: item.quantity,
        unitRate: item.unitRate,
        grossAmount: item.grossAmount,
        discountPercent: item.discountPercent,
        discountAmount: item.discountAmount,
        taxableAmount: item.taxableAmount,
        gstRate: item.gstRate,
        cgstRate: item.cgstRate,
        cgstAmount: item.cgstAmount,
        sgstRate: item.sgstRate,
        sgstAmount: item.sgstAmount,
        igstRate: item.igstRate,
        igstAmount: item.igstAmount,
        totalTaxAmount: item.totalTaxAmount,
        totalItemAmount: item.totalItemAmount,
        batchNo: item.batchNo || null,
        heatNo: item.heatNo || null,
        remarks: item.remarks || null,
        isActive: true,
        compId,
        branchId,
        createdBy: userId,
      });
    }

    await this.auditLogService.logAction({
      userId,
      screenCode: 'SALES_INVOICE',
      actionType: 'ADD',
      entityTable: 'tbl_sales_invoice_header',
      recordId: insertedHeader.invoiceId,
      newValue: { invoiceNo, totalInvoiceAmount, customerName: dto.customerName },
      compId,
      branchId,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      correlationId: meta?.correlationId,
    });

    return this.findOneInvoice(insertedHeader.invoiceId, user);
  }

  // 10. Update Invoice
  async updateInvoice(
    id: number,
    dto: UpdateInvoiceDto,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    const [existing] = await this.db
      .select()
      .from(tblSalesInvoiceHeader)
      .where(
        and(
          eq(tblSalesInvoiceHeader.invoiceId, id),
          eq(tblSalesInvoiceHeader.compId, compId),
          eq(tblSalesInvoiceHeader.branchId, branchId),
        ),
      );

    if (!existing) {
      throw new NotFoundException(`Invoice #${id} not found`);
    }

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(`Only DRAFT invoices can be modified. Current status: ${existing.status}`);
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one line item is required');
    }

    const placeOfSupply = dto.placeOfSupply || existing.placeOfSupply;
    const isIntraState = placeOfSupply.startsWith('24') || dto.supplyType === 'INTRA_STATE';
    const supplyType = isIntraState ? 'INTRA_STATE' : (dto.supplyType || 'INTER_STATE');

    const paymentTermsDays = dto.paymentTermsDays !== undefined ? dto.paymentTermsDays : existing.paymentTermsDays;
    const invoiceDateObj = new Date(dto.invoiceDate || existing.invoiceDate);
    const calculatedDueDate = new Date(invoiceDateObj.getTime() + paymentTermsDays * 24 * 60 * 60 * 1000);
    const dueDateStr = dto.dueDate || calculatedDueDate.toISOString().split('T')[0];

    let subtotalAmount = 0;
    let discountAmount = 0;
    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    const computedItems = dto.items.map((item, idx) => {
      const qty = Number(item.quantity);
      const rate = Number(item.unitRate);
      const gross = Math.round(qty * rate * 100) / 100;
      const discPct = Number(item.discountPercent || 0);
      const discAmt = Math.round(gross * (discPct / 100) * 100) / 100;
      const itemTaxable = Math.round((gross - discAmt) * 100) / 100;

      const gstRate = item.gstRate !== undefined ? Number(item.gstRate) : 18.0;
      let cgstRate = 0;
      let cgst = 0;
      let sgstRate = 0;
      let sgst = 0;
      let igstRate = 0;
      let igst = 0;

      if (supplyType === 'INTRA_STATE') {
        cgstRate = gstRate / 2;
        sgstRate = gstRate / 2;
        cgst = Math.round(itemTaxable * (cgstRate / 100) * 100) / 100;
        sgst = Math.round(itemTaxable * (sgstRate / 100) * 100) / 100;
      } else {
        igstRate = gstRate;
        igst = Math.round(itemTaxable * (igstRate / 100) * 100) / 100;
      }

      const totalTax = cgst + sgst + igst;
      const totalItem = Math.round((itemTaxable + totalTax) * 100) / 100;

      subtotalAmount += gross;
      discountAmount += discAmt;
      taxableAmount += itemTaxable;
      cgstAmount += cgst;
      sgstAmount += sgst;
      igstAmount += igst;

      return {
        ...item,
        itemSequence: idx + 1,
        quantity: String(qty),
        unitRate: String(rate),
        grossAmount: String(gross),
        discountPercent: String(discPct),
        discountAmount: String(discAmt),
        taxableAmount: String(itemTaxable),
        gstRate: String(gstRate),
        cgstRate: String(cgstRate),
        cgstAmount: String(cgst),
        sgstRate: String(sgstRate),
        sgstAmount: String(sgst),
        igstRate: String(igstRate),
        igstAmount: String(igst),
        totalTaxAmount: String(totalTax),
        totalItemAmount: String(totalItem),
      };
    });

    const totalTaxAmount = cgstAmount + sgstAmount + igstAmount;
    const freightCharges = Number(dto.freightCharges !== undefined ? dto.freightCharges : existing.freightCharges);
    const insuranceCharges = Number(dto.insuranceCharges !== undefined ? dto.insuranceCharges : existing.insuranceCharges);
    const packagingCharges = Number(dto.packagingCharges !== undefined ? dto.packagingCharges : existing.packagingCharges);
    const tcsRate = Number(dto.tcsRate !== undefined ? dto.tcsRate : existing.tcsRate);

    const preliminaryTotal =
      taxableAmount +
      totalTaxAmount +
      freightCharges +
      insuranceCharges +
      packagingCharges;

    const tcsAmount = Math.round(preliminaryTotal * (tcsRate / 100) * 100) / 100;
    const unroundedTotal = preliminaryTotal + tcsAmount;
    const roundedTotal = Math.round(unroundedTotal);
    const roundOff = Math.round((roundedTotal - unroundedTotal) * 100) / 100;

    const totalInvoiceAmount = roundedTotal;
    const balanceAmount = roundedTotal;

    await this.db
      .update(tblSalesInvoiceHeader)
      .set({
        invoiceDate: dto.invoiceDate || existing.invoiceDate,
        invoiceType: dto.invoiceType || existing.invoiceType,
        customerId: dto.customerId || existing.customerId,
        customerName: dto.customerName || existing.customerName,
        contactPerson: dto.contactPerson !== undefined ? dto.contactPerson : existing.contactPerson,
        contactPhone: dto.contactPhone !== undefined ? dto.contactPhone : existing.contactPhone,
        billingAddressId: dto.billingAddressId !== undefined ? dto.billingAddressId : existing.billingAddressId,
        billingAddress: dto.billingAddress !== undefined ? dto.billingAddress : existing.billingAddress,
        shippingAddressId: dto.shippingAddressId !== undefined ? dto.shippingAddressId : existing.shippingAddressId,
        shippingAddress: dto.shippingAddress !== undefined ? dto.shippingAddress : existing.shippingAddress,
        placeOfSupply,
        customerGstin: dto.customerGstin !== undefined ? dto.customerGstin : existing.customerGstin,
        customerPan: dto.customerPan !== undefined ? dto.customerPan : existing.customerPan,
        supplyType,
        reverseChargeApplicable: dto.reverseChargeApplicable !== undefined ? dto.reverseChargeApplicable : existing.reverseChargeApplicable,
        transporterName: dto.transporterName !== undefined ? dto.transporterName : existing.transporterName,
        vehicleNo: dto.vehicleNo !== undefined ? dto.vehicleNo : existing.vehicleNo,
        lrRrNo: dto.lrRrNo !== undefined ? dto.lrRrNo : existing.lrRrNo,
        lrRrDate: dto.lrRrDate !== undefined ? dto.lrRrDate : existing.lrRrDate,
        paymentTermsDays,
        dueDate: dueDateStr,
        subtotalAmount: String(subtotalAmount),
        discountAmount: String(discountAmount),
        taxableAmount: String(taxableAmount),
        cgstAmount: String(cgstAmount),
        sgstAmount: String(sgstAmount),
        igstAmount: String(igstAmount),
        totalTaxAmount: String(totalTaxAmount),
        freightCharges: String(freightCharges),
        insuranceCharges: String(insuranceCharges),
        packagingCharges: String(packagingCharges),
        tcsRate: String(tcsRate),
        tcsAmount: String(tcsAmount),
        roundOff: String(roundOff),
        totalInvoiceAmount: String(totalInvoiceAmount),
        balanceAmount: String(balanceAmount),
        remarks: dto.remarks !== undefined ? dto.remarks : existing.remarks,
        termsAndConditions: dto.termsAndConditions !== undefined ? dto.termsAndConditions : existing.termsAndConditions,
        updatedBy: userId,
        updatedDate: new Date(),
      })
      .where(eq(tblSalesInvoiceHeader.invoiceId, id));

    // Delete existing items and insert new ones
    await this.db.delete(tblSalesInvoiceItem).where(eq(tblSalesInvoiceItem.invoiceId, id));

    for (const item of computedItems) {
      await this.db.insert(tblSalesInvoiceItem).values({
        invoiceId: id,
        soItemId: item.soItemId || null,
        challanItemId: item.challanItemId || null,
        itemSequence: item.itemSequence,
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        description: item.description || null,
        hsnSacCode: item.hsnSacCode || null,
        uomId: item.uomId,
        quantity: item.quantity,
        unitRate: item.unitRate,
        grossAmount: item.grossAmount,
        discountPercent: item.discountPercent,
        discountAmount: item.discountAmount,
        taxableAmount: item.taxableAmount,
        gstRate: item.gstRate,
        cgstRate: item.cgstRate,
        cgstAmount: item.cgstAmount,
        sgstRate: item.sgstRate,
        sgstAmount: item.sgstAmount,
        igstRate: item.igstRate,
        igstAmount: item.igstAmount,
        totalTaxAmount: item.totalTaxAmount,
        totalItemAmount: item.totalItemAmount,
        batchNo: item.batchNo || null,
        heatNo: item.heatNo || null,
        remarks: item.remarks || null,
        isActive: true,
        compId,
        branchId,
        createdBy: userId,
      });
    }

    await this.auditLogService.logAction({
      userId,
      screenCode: 'SALES_INVOICE',
      actionType: 'EDIT',
      entityTable: 'tbl_sales_invoice_header',
      recordId: id,
      oldValue: { totalInvoiceAmount: existing.totalInvoiceAmount },
      newValue: { totalInvoiceAmount },
      compId,
      branchId,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      correlationId: meta?.correlationId,
    });

    return this.findOneInvoice(id, user);
  }

  // 11. Delete Invoice (DRAFT only)
  async deleteInvoice(
    id: number,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    const [existing] = await this.db
      .select()
      .from(tblSalesInvoiceHeader)
      .where(
        and(
          eq(tblSalesInvoiceHeader.invoiceId, id),
          eq(tblSalesInvoiceHeader.compId, compId),
          eq(tblSalesInvoiceHeader.branchId, branchId),
        ),
      );

    if (!existing) {
      throw new NotFoundException(`Invoice #${id} not found`);
    }

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(`Only DRAFT invoices can be deleted. Current status: ${existing.status}`);
    }

    await this.db.delete(tblSalesInvoiceItem).where(eq(tblSalesInvoiceItem.invoiceId, id));
    await this.db.delete(tblSalesInvoiceHeader).where(eq(tblSalesInvoiceHeader.invoiceId, id));

    await this.auditLogService.logAction({
      userId,
      screenCode: 'SALES_INVOICE',
      actionType: 'DELETE',
      entityTable: 'tbl_sales_invoice_header',
      recordId: id,
      oldValue: { invoiceNo: existing.invoiceNo, totalInvoiceAmount: existing.totalInvoiceAmount },
      compId,
      branchId,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      correlationId: meta?.correlationId,
    });

    return { success: true, message: `Invoice #${existing.invoiceNo} deleted successfully` };
  }

  // 12. Post Invoice & Finalize AR
  async postInvoice(
    id: number,
    dto: PostInvoiceDto,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    const [existing] = await this.db
      .select()
      .from(tblSalesInvoiceHeader)
      .where(
        and(
          eq(tblSalesInvoiceHeader.invoiceId, id),
          eq(tblSalesInvoiceHeader.compId, compId),
          eq(tblSalesInvoiceHeader.branchId, branchId),
        ),
      );

    if (!existing) {
      throw new NotFoundException(`Invoice #${id} not found`);
    }

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(`Only DRAFT invoices can be posted. Current status: ${existing.status}`);
    }

    // Fetch line items
    const items = await this.db
      .select()
      .from(tblSalesInvoiceItem)
      .where(and(eq(tblSalesInvoiceItem.invoiceId, id), eq(tblSalesInvoiceItem.isActive, true)));

    // Synchronize invoiced_qty on Sales Order Items
    for (const item of items) {
      if (item.soItemId) {
        await this.db.execute(sql`
          UPDATE tbl_sales_order_item
          SET invoiced_qty = invoiced_qty + ${Number(item.quantity)}
          WHERE so_item_id = ${item.soItemId}
        `);
      }
    }

    // Update Header Status to POSTED
    await this.db
      .update(tblSalesInvoiceHeader)
      .set({
        status: 'POSTED',
        paymentStatus: 'UNPAID',
        postedBy: userId,
        postedAt: new Date(),
        remarks: dto.remarks ? `${existing.remarks || ''}\n[POSTED]: ${dto.remarks}` : existing.remarks,
        updatedBy: userId,
        updatedDate: new Date(),
      })
      .where(eq(tblSalesInvoiceHeader.invoiceId, id));

    await this.auditLogService.logAction({
      userId,
      screenCode: 'SALES_INVOICE',
      actionType: 'POST',
      entityTable: 'tbl_sales_invoice_header',
      recordId: id,
      newValue: { status: 'POSTED', postedBy: userId },
      compId,
      branchId,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      correlationId: meta?.correlationId,
    });

    return this.findOneInvoice(id, user);
  }

  // 13. Generate Statutory E-Invoice IRN & Signed QR Code
  async generateIrn(
    id: number,
    dto: GenerateIrnDto,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    const [existing] = await this.db
      .select()
      .from(tblSalesInvoiceHeader)
      .where(
        and(
          eq(tblSalesInvoiceHeader.invoiceId, id),
          eq(tblSalesInvoiceHeader.compId, compId),
          eq(tblSalesInvoiceHeader.branchId, branchId),
        ),
      );

    if (!existing) {
      throw new NotFoundException(`Invoice #${id} not found`);
    }

    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Cannot generate E-Invoice IRN for a CANCELLED invoice');
    }

    if (existing.irnStatus === 'GENERATED' && !dto.override) {
      throw new BadRequestException('E-Invoice IRN has already been generated for this invoice');
    }

    // Fetch Seller branch details for GSTIN
    const [branch] = await this.db
      .select()
      .from(tblOrgBranch)
      .where(eq(tblOrgBranch.branchId, branchId));

    const sellerGstin = branch?.gstin || '24AABCK1234F1Z5';
    const buyerGstin = existing.customerGstin || 'URP';
    const docNo = existing.invoiceNo;
    const docDate = existing.invoiceDate;
    const fyear = '2026-27';

    // Generate Statutory 64-character SHA-256 Hash
    const rawIrnString = `${sellerGstin}${fyear}INV${docNo}${new Date().getTime()}`;
    const irnNo = crypto.createHash('sha256').update(rawIrnString).digest('hex');

    // Generate Acknowledgement Number & Timestamp
    const ackNo = `11${Date.now().toString().substring(3)}`;
    const ackDate = new Date();

    // Fetch item summary
    const items = await this.db
      .select()
      .from(tblSalesInvoiceItem)
      .where(and(eq(tblSalesInvoiceItem.invoiceId, id), eq(tblSalesInvoiceItem.isActive, true)));

    const mainHsn = items[0]?.hsnSacCode || '8481';

    // Statutory Signed QR Code JSON Payload
    const qrPayload = JSON.stringify({
      Irn: irnNo,
      SellerGstin: sellerGstin,
      BuyerGstin: buyerGstin,
      DocNo: docNo,
      DocTyp: 'INV',
      DocDt: docDate,
      TotInvVal: Number(existing.totalInvoiceAmount),
      ItemCnt: items.length,
      MainHsnCode: mainHsn,
      AckNo: ackNo,
      AckDt: ackDate.toISOString(),
    });

    // Auto-generate E-Way Bill Number if missing and vehicle exists
    let eWayBillNo = existing.eWayBillNo;
    let eWayBillDate = existing.eWayBillDate;
    if (!eWayBillNo && existing.vehicleNo) {
      const statePrefix = sellerGstin.substring(0, 2);
      eWayBillNo = `${statePrefix}${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      eWayBillDate = new Date().toISOString().split('T')[0];
    }

    await this.db
      .update(tblSalesInvoiceHeader)
      .set({
        irnStatus: 'GENERATED',
        irnNo,
        ackNo,
        ackDate,
        signedQrCode: qrPayload,
        eWayBillNo,
        eWayBillDate,
        updatedBy: userId,
        updatedDate: new Date(),
      })
      .where(eq(tblSalesInvoiceHeader.invoiceId, id));

    await this.auditLogService.logAction({
      userId,
      screenCode: 'SALES_INVOICE',
      actionType: 'GENERATE_IRN',
      entityTable: 'tbl_sales_invoice_header',
      recordId: id,
      newValue: { irnNo, ackNo, ackDate },
      compId,
      branchId,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      correlationId: meta?.correlationId,
    });

    return this.findOneInvoice(id, user);
  }

  // 14. Record Customer Payment Receipt / AR Clearance
  async recordPayment(
    id: number,
    dto: RecordPaymentDto,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    const [existing] = await this.db
      .select()
      .from(tblSalesInvoiceHeader)
      .where(
        and(
          eq(tblSalesInvoiceHeader.invoiceId, id),
          eq(tblSalesInvoiceHeader.compId, compId),
          eq(tblSalesInvoiceHeader.branchId, branchId),
        ),
      );

    if (!existing) {
      throw new NotFoundException(`Invoice #${id} not found`);
    }

    if (existing.status === 'DRAFT') {
      throw new BadRequestException('Invoice must be POSTED before recording payment');
    }

    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Cannot record payment for a CANCELLED invoice');
    }

    const currentBalance = Number(existing.balanceAmount);
    if (currentBalance <= 0) {
      throw new BadRequestException('This invoice is already fully paid');
    }

    const pmtAmt = Number(dto.paymentAmount);
    const tdsAmt = Number(dto.tdsAmount || 0);
    const totalAllocated = Math.round((pmtAmt + tdsAmt) * 100) / 100;

    if (totalAllocated > currentBalance + 0.05) {
      throw new BadRequestException(
        `Total allocated payment (₹${totalAllocated}) cannot exceed outstanding invoice balance (₹${currentBalance})`,
      );
    }

    const receiptNo = await this.generateReceiptNo(compId, branchId);
    const receiptDate = new Date().toISOString().split('T')[0];

    // Insert AR Payment Receipt
    const [receipt] = await this.db
      .insert(tblSalesArPaymentReceipt)
      .values({
        receiptNo,
        receiptDate,
        invoiceId: id,
        customerId: existing.customerId,
        paymentMode: dto.paymentMode,
        referenceNo: dto.referenceNo || null,
        paymentAmount: String(pmtAmt),
        tdsAmount: String(tdsAmt),
        totalAllocatedAmount: String(totalAllocated),
        bankName: dto.bankName || null,
        chequeDate: dto.chequeDate || null,
        remarks: dto.remarks || null,
        recordedBy: userId,
        isActive: true,
        compId,
        branchId,
        createdBy: userId,
      })
      .returning();

    // Recompute paid & balance amounts
    const newPaidAmount = Math.round((Number(existing.paidAmount) + totalAllocated) * 100) / 100;
    const newBalanceAmount = Math.max(0, Math.round((Number(existing.totalInvoiceAmount) - newPaidAmount) * 100) / 100);

    const paymentStatus = newBalanceAmount <= 0.01 ? 'PAID' : 'PARTIALLY_PAID';
    const status = newBalanceAmount <= 0.01 ? 'PAID' : existing.status;

    await this.db
      .update(tblSalesInvoiceHeader)
      .set({
        paidAmount: String(newPaidAmount),
        balanceAmount: String(newBalanceAmount),
        paymentStatus,
        status,
        updatedBy: userId,
        updatedDate: new Date(),
      })
      .where(eq(tblSalesInvoiceHeader.invoiceId, id));

    await this.auditLogService.logAction({
      userId,
      screenCode: 'SALES_INVOICE',
      actionType: 'RECORD_PAYMENT',
      entityTable: 'tbl_sales_ar_payment_receipt',
      recordId: receipt.paymentId,
      newValue: { receiptNo, paymentAmount: pmtAmt, tdsAmount: tdsAmt, newBalanceAmount },
      compId,
      branchId,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      correlationId: meta?.correlationId,
    });

    return this.findOneInvoice(id, user);
  }

  // 15. Cancel Invoice
  async cancelInvoice(
    id: number,
    dto: CancelInvoiceDto,
    user: AuthenticatedUserContext,
    meta?: { ipAddress?: string; userAgent?: string; correlationId?: string },
  ) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId;

    const [existing] = await this.db
      .select()
      .from(tblSalesInvoiceHeader)
      .where(
        and(
          eq(tblSalesInvoiceHeader.invoiceId, id),
          eq(tblSalesInvoiceHeader.compId, compId),
          eq(tblSalesInvoiceHeader.branchId, branchId),
        ),
      );

    if (!existing) {
      throw new NotFoundException(`Invoice #${id} not found`);
    }

    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Invoice is already cancelled');
    }

    if (Number(existing.paidAmount) > 0) {
      throw new BadRequestException('Cannot cancel an invoice with recorded customer payments. Please reverse payments first.');
    }

    // If posted, reverse invoiced_qty on Sales Order
    if (existing.status === 'POSTED') {
      const items = await this.db
        .select()
        .from(tblSalesInvoiceItem)
        .where(and(eq(tblSalesInvoiceItem.invoiceId, id), eq(tblSalesInvoiceItem.isActive, true)));

      for (const item of items) {
        if (item.soItemId) {
          await this.db.execute(sql`
            UPDATE tbl_sales_order_item
            SET invoiced_qty = GREATEST(0, invoiced_qty - ${Number(item.quantity)})
            WHERE so_item_id = ${item.soItemId}
          `);
        }
      }
    }

    await this.db
      .update(tblSalesInvoiceHeader)
      .set({
        status: 'CANCELLED',
        irnStatus: existing.irnStatus === 'GENERATED' ? 'CANCELLED' : existing.irnStatus,
        cancelledBy: userId,
        cancelledAt: new Date(),
        cancellationReason: dto.cancellationReason,
        updatedBy: userId,
        updatedDate: new Date(),
      })
      .where(eq(tblSalesInvoiceHeader.invoiceId, id));

    await this.auditLogService.logAction({
      userId,
      screenCode: 'SALES_INVOICE',
      actionType: 'CANCEL',
      entityTable: 'tbl_sales_invoice_header',
      recordId: id,
      newValue: { status: 'CANCELLED', cancellationReason: dto.cancellationReason },
      compId,
      branchId,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      correlationId: meta?.correlationId,
    });

    return this.findOneInvoice(id, user);
  }
}
