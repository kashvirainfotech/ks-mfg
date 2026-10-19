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
  tblSalesReturnHeader,
  tblSalesReturnItem,
  tblSalesInvoiceHeader,
  tblSalesArPaymentReceipt,
} from '../../../database/schema';
import type { AuthenticatedUserContext } from '../../../common/decorators/auth.decorators';
import { AuditLogService } from '../../../common/services/audit-log.service';
import type {
  CreateSalesReturnDto,
  UpdateSalesReturnDto,
  InspectSalesReturnDto,
  PostCreditNoteDto,
  RestockSalesReturnDto,
  GenerateCreditNoteIrnDto,
  SalesReturnFilterParams,
} from './return.dto';

@Injectable()
export class SalesReturnService {
  constructor(
    @Inject(DRIZZLE_DB) private readonly db: DrizzleDb,
    private readonly auditLogService: AuditLogService,
  ) {}

  // 1. Executive Summary KPIs
  async getSummary(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const res = await this.db.execute(sql`
      SELECT
        COUNT(*)::int AS total_returns,
        COALESCE(SUM(total_credit_amount), 0)::numeric(14,2) AS total_credit_value,
        COUNT(*) FILTER (WHERE qc_status = 'PENDING')::int AS pending_qc_count,
        COUNT(*) FILTER (WHERE restock_status = 'PENDING' AND qc_status IN ('ACCEPTED', 'PARTIALLY_ACCEPTED'))::int AS pending_restock_count,
        COUNT(*) FILTER (WHERE credit_note_status = 'POSTED')::int AS credit_notes_posted,
        COALESCE(SUM(ar_adjusted_amount), 0)::numeric(14,2) AS total_ar_adjusted,
        COUNT(*) FILTER (WHERE status = 'DRAFT')::int AS draft_count,
        COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed_count
      FROM tbl_sales_return_header
      WHERE comp_id = ${compId}
        AND branch_id = ${branchId}
        AND is_active = TRUE
    `);

    return res.rows[0];
  }

  // 2. Lookups: Eligible Posted Invoices, Customers, Warehouses, Storage Bins
  async getLookups(user: AuthenticatedUserContext) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    // Posted Invoices eligible for return
    const invoicesRes = await this.db.execute(sql`
      SELECT
        h.invoice_id,
        h.invoice_no,
        h.invoice_date,
        h.customer_id,
        h.customer_name,
        h.customer_gstin,
        h.customer_pan,
        h.billing_address,
        h.billing_city,
        h.billing_state,
        h.billing_pincode,
        h.billing_state_code,
        h.place_of_supply,
        h.pos_state_code,
        h.total_invoice_amount,
        h.paid_amount,
        h.balance_amount,
        h.status,
        h.payment_status,
        json_agg(
          json_build_object(
            'invoice_item_id', i.invoice_item_id,
            'item_id', i.item_id,
            'item_code', i.item_code,
            'item_name', i.item_name,
            'description', i.description,
            'hsn_sac_code', i.hsn_sac_code,
            'uom_id', i.uom_id,
            'uom_code', u.uom_code,
            'invoiced_qty', i.invoiced_qty,
            'unit_price', i.unit_price,
            'discount_percent', i.discount_percent,
            'gst_rate', i.gst_rate,
            'batch_no', i.batch_no,
            'heat_no', i.heat_no,
            'warehouse_id', i.warehouse_id,
            'bin_id', i.bin_id
          )
        ) AS items
      FROM tbl_sales_invoice_header h
      JOIN tbl_sales_invoice_item i ON i.invoice_id = h.invoice_id AND i.is_active = TRUE
      LEFT JOIN tbl_inv_uom u ON u.uom_id = i.uom_id
      WHERE h.comp_id = ${compId}
        AND h.branch_id = ${branchId}
        AND h.status IN ('POSTED', 'PARTIALLY_PAID', 'PAID')
        AND h.is_active = TRUE
      GROUP BY h.invoice_id
      ORDER BY h.invoice_date DESC, h.invoice_id DESC
    `);

    // Customers
    const customersRes = await this.db.execute(sql`
      SELECT party_id, party_code, party_name, gstin, pan_no, state_code
      FROM tbl_crm_party
      WHERE party_type IN ('CUSTOMER', 'BOTH')
        AND is_active = TRUE
      ORDER BY party_name ASC
    `);

    // Warehouses and storage bins
    const warehousesRes = await this.db.execute(sql`
      SELECT warehouse_id, warehouse_code, warehouse_name, warehouse_type
      FROM tbl_inv_warehouse
      WHERE comp_id = ${compId}
        AND is_active = TRUE
      ORDER BY warehouse_name ASC
    `);

    const binsRes = await this.db.execute(sql`
      SELECT b.bin_id, b.bin_code, b.bin_name, b.warehouse_id, w.warehouse_name
      FROM tbl_inv_storage_bin b
      JOIN tbl_inv_warehouse w ON w.warehouse_id = b.warehouse_id
      WHERE b.comp_id = ${compId}
        AND b.is_active = TRUE
      ORDER BY b.bin_code ASC
    `);

    return {
      invoices: invoicesRes.rows,
      customers: customersRes.rows,
      warehouses: warehousesRes.rows,
      bins: binsRes.rows,
    };
  }

  // 3. Paginated Register
  async getReturns(user: AuthenticatedUserContext, filters: SalesReturnFilterParams) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const page = filters.page ? Number(filters.page) : 1;
    const limit = filters.limit ? Number(filters.limit) : 25;
    const offset = (page - 1) * limit;

    const conditions: any[] = [
      eq(tblSalesReturnHeader.compId, compId),
      eq(tblSalesReturnHeader.branchId, branchId),
      eq(tblSalesReturnHeader.isActive, true),
    ];

    if (filters.status) {
      conditions.push(eq(tblSalesReturnHeader.status, filters.status));
    }
    if (filters.qcStatus) {
      conditions.push(eq(tblSalesReturnHeader.qcStatus, filters.qcStatus));
    }
    if (filters.restockStatus) {
      conditions.push(eq(tblSalesReturnHeader.restockStatus, filters.restockStatus));
    }
    if (filters.creditNoteStatus) {
      conditions.push(eq(tblSalesReturnHeader.creditNoteStatus, filters.creditNoteStatus));
    }
    if (filters.customerId) {
      conditions.push(eq(tblSalesReturnHeader.customerId, Number(filters.customerId)));
    }
    if (filters.startDate) {
      conditions.push(sql`${tblSalesReturnHeader.returnDate} >= ${filters.startDate}`);
    }
    if (filters.endDate) {
      conditions.push(sql`${tblSalesReturnHeader.returnDate} <= ${filters.endDate}`);
    }
    if (filters.search) {
      const q = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(tblSalesReturnHeader.returnNo, q),
          ilike(tblSalesReturnHeader.creditNoteNo, q),
          ilike(tblSalesReturnHeader.invoiceNo, q),
          ilike(tblSalesReturnHeader.customerName, q),
          ilike(tblSalesReturnHeader.rmaReferenceNo, q),
          ilike(tblSalesReturnHeader.returnReason, q),
        ),
      );
    }

    const whereClause = and(...conditions);

    const [rows, countRes] = await Promise.all([
      this.db
        .select({
          returnId: tblSalesReturnHeader.returnId,
          returnNo: tblSalesReturnHeader.returnNo,
          returnDate: tblSalesReturnHeader.returnDate,
          returnType: tblSalesReturnHeader.returnType,
          creditNoteNo: tblSalesReturnHeader.creditNoteNo,
          creditNoteDate: tblSalesReturnHeader.creditNoteDate,
          invoiceId: tblSalesReturnHeader.invoiceId,
          invoiceNo: tblSalesReturnHeader.invoiceNo,
          invoiceDate: tblSalesReturnHeader.invoiceDate,
          customerId: tblSalesReturnHeader.customerId,
          customerName: tblSalesReturnHeader.customerName,
          customerGstin: tblSalesReturnHeader.customerGstin,
          placeOfSupply: tblSalesReturnHeader.placeOfSupply,
          rmaReferenceNo: tblSalesReturnHeader.rmaReferenceNo,
          gateEntryNo: tblSalesReturnHeader.gateEntryNo,
          vehicleNo: tblSalesReturnHeader.vehicleNo,
          subtotalAmount: tblSalesReturnHeader.subtotalAmount,
          taxableAmount: tblSalesReturnHeader.taxableAmount,
          cgstAmount: tblSalesReturnHeader.cgstAmount,
          sgstAmount: tblSalesReturnHeader.sgstAmount,
          igstAmount: tblSalesReturnHeader.igstAmount,
          totalCreditAmount: tblSalesReturnHeader.totalCreditAmount,
          arAdjustedAmount: tblSalesReturnHeader.arAdjustedAmount,
          irnStatus: tblSalesReturnHeader.irnStatus,
          irnNo: tblSalesReturnHeader.irnNo,
          returnReason: tblSalesReturnHeader.returnReason,
          qcStatus: tblSalesReturnHeader.qcStatus,
          restockStatus: tblSalesReturnHeader.restockStatus,
          creditNoteStatus: tblSalesReturnHeader.creditNoteStatus,
          status: tblSalesReturnHeader.status,
          createdDate: tblSalesReturnHeader.createdDate,
        })
        .from(tblSalesReturnHeader)
        .where(whereClause)
        .orderBy(desc(tblSalesReturnHeader.returnDate), desc(tblSalesReturnHeader.returnId))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql`COUNT(*)::int` })
        .from(tblSalesReturnHeader)
        .where(whereClause),
    ]);

    const total = Number(countRes[0]?.count || 0);

    return {
      data: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // 4. Single Return Details with Lines
  async getReturnById(user: AuthenticatedUserContext, returnId: number) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;

    const [header] = await this.db
      .select()
      .from(tblSalesReturnHeader)
      .where(
        and(
          eq(tblSalesReturnHeader.returnId, returnId),
          eq(tblSalesReturnHeader.compId, compId),
          eq(tblSalesReturnHeader.branchId, branchId),
          eq(tblSalesReturnHeader.isActive, true),
        ),
      );

    if (!header) {
      throw new NotFoundException(`Sales return record #${returnId} not found`);
    }

    const itemsRes = await this.db.execute(sql`
      SELECT
        ri.*,
        u.uom_code,
        u.uom_name,
        w.warehouse_name AS target_warehouse_name,
        b.bin_code AS target_bin_code,
        b.bin_name AS target_bin_name
      FROM tbl_sales_return_item ri
      LEFT JOIN tbl_inv_uom u ON u.uom_id = ri.uom_id
      LEFT JOIN tbl_inv_warehouse w ON w.warehouse_id = ri.target_warehouse_id
      LEFT JOIN tbl_inv_storage_bin b ON b.bin_id = ri.target_bin_id
      WHERE ri.return_id = ${returnId}
        AND ri.is_active = TRUE
      ORDER BY ri.item_sequence ASC, ri.return_item_id ASC
    `);

    return {
      ...header,
      items: itemsRes.rows,
    };
  }

  // 5. Create Sales Return / RMA
  async createReturn(user: AuthenticatedUserContext, dto: CreateSalesReturnDto) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('At least one item must be added for return');
    }

    // Auto-numbering: SR-{BRANCH}-{FYEAR}-XXXX
    const countRes = await this.db.execute(sql`
      SELECT COUNT(*)::int AS cnt
      FROM tbl_sales_return_header
      WHERE comp_id = ${compId} AND branch_id = ${branchId}
    `);
    const seq = (Number(countRes.rows[0]?.cnt || 0) + 1).toString().padStart(4, '0');
    const returnNo = `SR-AHM-2627-${seq}`;

    // Evaluate Supplier Branch State Code vs Customer POS State Code
    const branchStateCode = '24'; // Gujarat (Ahmedabad Branch)
    const isIntraState = (dto.posStateCode || dto.billingStateCode || '24') === branchStateCode;

    // Calculate line items and header totals
    let subtotalAmount = 0;
    let discountAmount = 0;
    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    const preparedItems = dto.items.map((item, idx) => {
      const returnedQty = Number(item.returnedQty) || 1;
      const unitPrice = Number(item.unitPrice) || 0;
      const lineSubtotal = returnedQty * unitPrice;
      const discPct = Number(item.discountPercent) || 0;
      const lineDisc = Number(((lineSubtotal * discPct) / 100).toFixed(2));
      const lineTaxable = Number((lineSubtotal - lineDisc).toFixed(2));

      const gstRate = Number(item.gstRate) || 18.0;
      let cgstRate = 0;
      let sgstRate = 0;
      let igstRate = 0;
      let lineCgst = 0;
      let lineSgst = 0;
      let lineIgst = 0;

      if (isIntraState) {
        cgstRate = gstRate / 2;
        sgstRate = gstRate / 2;
        lineCgst = Number(((lineTaxable * cgstRate) / 100).toFixed(2));
        lineSgst = Number(((lineTaxable * sgstRate) / 100).toFixed(2));
      } else {
        igstRate = gstRate;
        lineIgst = Number(((lineTaxable * igstRate) / 100).toFixed(2));
      }

      const lineTotal = Number((lineTaxable + lineCgst + lineSgst + lineIgst).toFixed(2));

      subtotalAmount += lineSubtotal;
      discountAmount += lineDisc;
      taxableAmount += lineTaxable;
      cgstAmount += lineCgst;
      sgstAmount += lineSgst;
      igstAmount += lineIgst;

      return {
        itemSequence: idx + 1,
        invoiceItemId: item.invoiceItemId || null,
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        description: item.description || null,
        hsnSacCode: item.hsnSacCode || '8481',
        uomId: item.uomId,
        invoicedQty: (item.invoicedQty || 0).toString(),
        returnedQty: returnedQty.toString(),
        acceptedQty: (item.acceptedQty || 0).toString(),
        rejectedScrapQty: (item.rejectedScrapQty || 0).toString(),
        unitPrice: unitPrice.toString(),
        discountPercent: discPct.toString(),
        discountAmount: lineDisc.toString(),
        taxableAmount: lineTaxable.toString(),
        gstRate: gstRate.toString(),
        cgstRate: cgstRate.toString(),
        cgstAmount: lineCgst.toString(),
        sgstRate: sgstRate.toString(),
        sgstAmount: lineSgst.toString(),
        igstRate: igstRate.toString(),
        igstAmount: lineIgst.toString(),
        lineTotal: lineTotal.toString(),
        targetWarehouseId: item.targetWarehouseId || null,
        targetBinId: item.targetBinId || null,
        batchNo: item.batchNo || null,
        heatNo: item.heatNo || null,
        defectType: item.defectType || null,
        qcVerdict: item.qcVerdict || 'PENDING',
        actionTaken: item.actionTaken || null,
        remarks: item.remarks || null,
        compId,
        branchId,
        fyearId,
        createdBy: userId,
      };
    });

    const rawTotal = taxableAmount + cgstAmount + sgstAmount + igstAmount;
    const roundedTotal = Math.round(rawTotal);
    const roundOff = Number((roundedTotal - rawTotal).toFixed(2));

    const [header] = await this.db
      .insert(tblSalesReturnHeader)
      .values({
        returnNo,
        returnDate: dto.returnDate || new Date().toISOString().split('T')[0],
        returnType: dto.returnType || 'COMMERCIAL_RETURN',
        invoiceId: dto.invoiceId,
        invoiceNo: dto.invoiceNo,
        invoiceDate: dto.invoiceDate,
        customerId: dto.customerId,
        customerName: dto.customerName,
        customerGstin: dto.customerGstin || null,
        customerPan: dto.customerPan || null,
        billingAddress: dto.billingAddress,
        billingCity: dto.billingCity || null,
        billingState: dto.billingState || null,
        billingPincode: dto.billingPincode || null,
        billingStateCode: dto.billingStateCode || '24',
        placeOfSupply: dto.placeOfSupply || 'Gujarat (24)',
        posStateCode: dto.posStateCode || '24',
        rmaReferenceNo: dto.rmaReferenceNo || null,
        rmaReferenceDate: dto.rmaReferenceDate || null,
        gateEntryNo: dto.gateEntryNo || null,
        gateEntryDate: dto.gateEntryDate || null,
        vehicleNo: dto.vehicleNo || null,
        transporterName: dto.transporterName || null,
        lrNo: dto.lrNo || null,
        lrDate: dto.lrDate || null,
        subtotalAmount: subtotalAmount.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        taxableAmount: taxableAmount.toFixed(2),
        cgstAmount: cgstAmount.toFixed(2),
        sgstAmount: sgstAmount.toFixed(2),
        igstAmount: igstAmount.toFixed(2),
        roundOffAmount: roundOff.toFixed(2),
        totalCreditAmount: roundedTotal.toFixed(2),
        arAdjustedAmount: '0.00',
        returnReason: dto.returnReason,
        qcStatus: 'PENDING',
        restockStatus: 'PENDING',
        creditNoteStatus: 'DRAFT',
        status: 'DRAFT',
        remarks: dto.remarks || null,
        compId,
        branchId,
        fyearId,
        createdBy: userId,
      })
      .returning();

    // Insert line items
    for (const item of preparedItems) {
      await this.db.insert(tblSalesReturnItem).values({
        ...item,
        returnId: header.returnId,
      });
    }

    await this.auditLogService.logAction({
      userId,
      screenCode: 'SALES_RETURN',
      actionType: 'ADD',
      entityTable: 'tbl_sales_return_header',
      recordId: header.returnId,
      newValue: { returnNo, totalCreditAmount: roundedTotal, returnReason: dto.returnReason },
      compId,
      branchId,
      fyearId,
    });

    return this.getReturnById(user, header.returnId);
  }

  // 6. Update Sales Return (Draft only)
  async updateReturn(user: AuthenticatedUserContext, returnId: number, dto: UpdateSalesReturnDto) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;

    const existing = await this.getReturnById(user, returnId);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot edit sales return in '${existing.status}' status. Only DRAFT records can be modified.`);
    }

    const branchStateCode = '24';
    const isIntraState = (dto.posStateCode || existing.posStateCode || '24') === branchStateCode;

    let subtotalAmount = 0;
    let discountAmount = 0;
    let taxableAmount = 0;
    let cgstAmount = 0;
    let sgstAmount = 0;
    let igstAmount = 0;

    const itemsToSave = (dto.items && dto.items.length > 0 ? dto.items : existing.items).map((item: any, idx: number) => {
      const returnedQty = Number(item.returnedQty) || 1;
      const unitPrice = Number(item.unitPrice) || 0;
      const lineSubtotal = returnedQty * unitPrice;
      const discPct = Number(item.discountPercent) || 0;
      const lineDisc = Number(((lineSubtotal * discPct) / 100).toFixed(2));
      const lineTaxable = Number((lineSubtotal - lineDisc).toFixed(2));

      const gstRate = Number(item.gstRate) || 18.0;
      let cgstRate = 0;
      let sgstRate = 0;
      let igstRate = 0;
      let lineCgst = 0;
      let lineSgst = 0;
      let lineIgst = 0;

      if (isIntraState) {
        cgstRate = gstRate / 2;
        sgstRate = gstRate / 2;
        lineCgst = Number(((lineTaxable * cgstRate) / 100).toFixed(2));
        lineSgst = Number(((lineTaxable * sgstRate) / 100).toFixed(2));
      } else {
        igstRate = gstRate;
        lineIgst = Number(((lineTaxable * igstRate) / 100).toFixed(2));
      }

      const lineTotal = Number((lineTaxable + lineCgst + lineSgst + lineIgst).toFixed(2));

      subtotalAmount += lineSubtotal;
      discountAmount += lineDisc;
      taxableAmount += lineTaxable;
      cgstAmount += lineCgst;
      sgstAmount += lineSgst;
      igstAmount += lineIgst;

      return {
        returnId,
        itemSequence: idx + 1,
        invoiceItemId: item.invoiceItemId || null,
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        description: item.description || null,
        hsnSacCode: item.hsnSacCode || '8481',
        uomId: item.uomId,
        invoicedQty: (item.invoicedQty || 0).toString(),
        returnedQty: returnedQty.toString(),
        acceptedQty: (item.acceptedQty || 0).toString(),
        rejectedScrapQty: (item.rejectedScrapQty || 0).toString(),
        unitPrice: unitPrice.toString(),
        discountPercent: discPct.toString(),
        discountAmount: lineDisc.toString(),
        taxableAmount: lineTaxable.toString(),
        gstRate: gstRate.toString(),
        cgstRate: cgstRate.toString(),
        cgstAmount: lineCgst.toString(),
        sgstRate: sgstRate.toString(),
        sgstAmount: lineSgst.toString(),
        igstRate: igstRate.toString(),
        igstAmount: lineIgst.toString(),
        lineTotal: lineTotal.toString(),
        targetWarehouseId: item.targetWarehouseId || null,
        targetBinId: item.targetBinId || null,
        batchNo: item.batchNo || null,
        heatNo: item.heatNo || null,
        defectType: item.defectType || null,
        qcVerdict: item.qcVerdict || 'PENDING',
        actionTaken: item.actionTaken || null,
        remarks: item.remarks || null,
        compId,
        branchId,
        fyearId: user.fyearId || 1001,
        createdBy: userId,
      };
    });

    const rawTotal = taxableAmount + cgstAmount + sgstAmount + igstAmount;
    const roundedTotal = Math.round(rawTotal);
    const roundOff = Number((roundedTotal - rawTotal).toFixed(2));

    await this.db
      .update(tblSalesReturnHeader)
      .set({
        returnType: dto.returnType ?? existing.returnType,
        rmaReferenceNo: dto.rmaReferenceNo ?? existing.rmaReferenceNo,
        rmaReferenceDate: dto.rmaReferenceDate ?? existing.rmaReferenceDate,
        gateEntryNo: dto.gateEntryNo ?? existing.gateEntryNo,
        gateEntryDate: dto.gateEntryDate ?? existing.gateEntryDate,
        vehicleNo: dto.vehicleNo ?? existing.vehicleNo,
        transporterName: dto.transporterName ?? existing.transporterName,
        lrNo: dto.lrNo ?? existing.lrNo,
        lrDate: dto.lrDate ?? existing.lrDate,
        returnReason: dto.returnReason ?? existing.returnReason,
        remarks: dto.remarks ?? existing.remarks,
        subtotalAmount: subtotalAmount.toFixed(2),
        discountAmount: discountAmount.toFixed(2),
        taxableAmount: taxableAmount.toFixed(2),
        cgstAmount: cgstAmount.toFixed(2),
        sgstAmount: sgstAmount.toFixed(2),
        igstAmount: igstAmount.toFixed(2),
        roundOffAmount: roundOff.toFixed(2),
        totalCreditAmount: roundedTotal.toFixed(2),
        updatedBy: userId,
        updatedDate: new Date(),
      })
      .where(eq(tblSalesReturnHeader.returnId, returnId));

    // Replace line items if provided
    if (dto.items && dto.items.length > 0) {
      await this.db
        .delete(tblSalesReturnItem)
        .where(eq(tblSalesReturnItem.returnId, returnId));

      for (const item of itemsToSave) {
        await this.db.insert(tblSalesReturnItem).values(item);
      }
    }

    await this.auditLogService.logAction({
      userId,
      screenCode: 'SALES_RETURN',
      actionType: 'EDIT',
      entityTable: 'tbl_sales_return_header',
      recordId: returnId,
      oldValue: { status: existing.status, totalCreditAmount: existing.totalCreditAmount },
      newValue: { totalCreditAmount: roundedTotal },
      compId,
      branchId,
      fyearId: user.fyearId || 1001,
    });

    return this.getReturnById(user, returnId);
  }

  // 7. Inspect Inward RMA Quarantine Goods (QC Inspection)
  async inspectReturn(user: AuthenticatedUserContext, returnId: number, dto: InspectSalesReturnDto) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;

    const existing = await this.getReturnById(user, returnId);
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Cannot inspect a cancelled sales return');
    }

    let totalAccepted = 0;
    let totalRejected = 0;

    for (const itemDto of dto.items) {
      const acc = Number(itemDto.acceptedQty) || 0;
      const rej = Number(itemDto.rejectedScrapQty) || 0;
      totalAccepted += acc;
      totalRejected += rej;

      await this.db
        .update(tblSalesReturnItem)
        .set({
          acceptedQty: acc.toString(),
          rejectedScrapQty: rej.toString(),
          qcVerdict: itemDto.qcVerdict,
          targetWarehouseId: itemDto.targetWarehouseId || null,
          targetBinId: itemDto.targetBinId || null,
          defectType: itemDto.defectType || null,
          actionTaken: itemDto.actionTaken || null,
          remarks: itemDto.remarks || null,
          updatedBy: userId,
          updatedDate: new Date(),
        })
        .where(
          and(
            eq(tblSalesReturnItem.returnItemId, itemDto.returnItemId),
            eq(tblSalesReturnItem.returnId, returnId),
          ),
        );
    }

    let overallQcStatus: 'ACCEPTED' | 'REJECTED' | 'PARTIALLY_ACCEPTED' = 'PARTIALLY_ACCEPTED';
    if (totalAccepted > 0 && totalRejected === 0) {
      overallQcStatus = 'ACCEPTED';
    } else if (totalAccepted === 0 && totalRejected > 0) {
      overallQcStatus = 'REJECTED';
    }

    const nextStatus = existing.status === 'DRAFT' ? 'INSPECTED' : existing.status;

    await this.db
      .update(tblSalesReturnHeader)
      .set({
        qcStatus: overallQcStatus,
        qcInspectedBy: userId,
        qcInspectedAt: new Date(),
        qcRemarks: dto.qcRemarks || 'QC Inspection completed',
        status: nextStatus,
        updatedBy: userId,
        updatedDate: new Date(),
      })
      .where(eq(tblSalesReturnHeader.returnId, returnId));

    await this.auditLogService.logAction({
      userId,
      screenCode: 'SALES_RETURN',
      actionType: 'INSPECT',
      entityTable: 'tbl_sales_return_header',
      recordId: returnId,
      newValue: { qcStatus: overallQcStatus, qcRemarks: dto.qcRemarks },
      compId,
      branchId,
      fyearId: user.fyearId || 1001,
    });

    return this.getReturnById(user, returnId);
  }

  // 8. Post Statutory Credit Note & Adjust AR Balance
  async postCreditNote(user: AuthenticatedUserContext, returnId: number, dto: PostCreditNoteDto) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    const existing = await this.getReturnById(user, returnId);
    if (existing.creditNoteStatus === 'POSTED') {
      throw new BadRequestException(`Credit note has already been posted (${existing.creditNoteNo})`);
    }

    // Auto-numbering: CN-{BRANCH}-{FYEAR}-XXXX
    const countRes = await this.db.execute(sql`
      SELECT COUNT(*)::int AS cnt
      FROM tbl_sales_return_header
      WHERE comp_id = ${compId} AND branch_id = ${branchId} AND credit_note_no IS NOT NULL
    `);
    const seq = (Number(countRes.rows[0]?.cnt || 0) + 1).toString().padStart(4, '0');
    const creditNoteNo = `CN-AHM-2627-${seq}`;
    const creditNoteDate = new Date().toISOString().split('T')[0];

    const creditAmount = Number(existing.totalCreditAmount);
    let arAdjusted = 0;

    // Adjust AR Balance on Linked Invoice if requested
    const shouldAdjustAr = dto.adjustArBalance !== false;
    if (shouldAdjustAr && existing.invoiceId) {
      const [inv] = await this.db
        .select()
        .from(tblSalesInvoiceHeader)
        .where(eq(tblSalesInvoiceHeader.invoiceId, existing.invoiceId));

      if (inv) {
        const curBalance = Number(inv.balanceAmount);
        const newBalance = Math.max(0, Number((curBalance - creditAmount).toFixed(2)));
        const newPaymentStatus = newBalance === 0 ? 'PAID' : 'PARTIALLY_PAID';
        arAdjusted = creditAmount;

        await this.db
          .update(tblSalesInvoiceHeader)
          .set({
            balanceAmount: newBalance.toFixed(2),
            paymentStatus: newPaymentStatus,
            updatedBy: userId,
            updatedDate: new Date(),
          })
          .where(eq(tblSalesInvoiceHeader.invoiceId, existing.invoiceId));

        // Create AR Clearance / Adjustment Receipt record
        const recCount = await this.db.execute(sql`
          SELECT COUNT(*)::int AS cnt FROM tbl_sales_ar_payment_receipt WHERE comp_id = ${compId} AND branch_id = ${branchId}
        `);
        const recSeq = (Number(recCount.rows[0]?.cnt || 0) + 1).toString().padStart(4, '0');
        const receiptNo = `REC-AHM-2627-${recSeq}`;

        await this.db.insert(tblSalesArPaymentReceipt).values({
          receiptNo,
          receiptDate: creditNoteDate,
          invoiceId: existing.invoiceId,
          customerId: existing.customerId,
          paymentMode: 'CREDIT_ADJUSTMENT',
          referenceNo: creditNoteNo,
          paymentAmount: creditAmount.toFixed(2),
          tdsAmount: '0.00',
          totalAllocatedAmount: creditAmount.toFixed(2),
          remarks: `Credit Note adjustment from ${existing.returnNo} (${creditNoteNo})`,
          recordedBy: userId,
          compId,
          branchId,
          fyearId,
          createdBy: userId,
        });
      }
    }

    const nextStatus = existing.restockStatus === 'RESTOCKED' ? 'COMPLETED' : 'CREDITED';

    await this.db
      .update(tblSalesReturnHeader)
      .set({
        creditNoteNo,
        creditNoteDate,
        creditNoteStatus: 'POSTED',
        creditPostedBy: userId,
        creditPostedAt: new Date(),
        arAdjustedAmount: arAdjusted.toFixed(2),
        status: nextStatus,
        remarks: dto.remarks ? `${existing.remarks || ''} | ${dto.remarks}` : existing.remarks,
        updatedBy: userId,
        updatedDate: new Date(),
      })
      .where(eq(tblSalesReturnHeader.returnId, returnId));

    await this.auditLogService.logAction({
      userId,
      screenCode: 'SALES_RETURN',
      actionType: 'POST_CREDIT_NOTE',
      entityTable: 'tbl_sales_return_header',
      recordId: returnId,
      newValue: { creditNoteNo, creditNoteDate, creditAmount, arAdjusted },
      compId,
      branchId,
      fyearId,
    });

    return this.getReturnById(user, returnId);
  }

  // 9. Generate Rule 48(4) E-Invoice IRN for Credit Note
  async generateIrn(user: AuthenticatedUserContext, returnId: number, dto: GenerateCreditNoteIrnDto) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;

    const existing = await this.getReturnById(user, returnId);
    if (existing.creditNoteStatus !== 'POSTED') {
      throw new BadRequestException('Please post the statutory credit note before generating E-Invoice IRN');
    }

    const supplierGstin = '24AAACK1234C1Z5';
    const fyearStr = '2627';
    const docType = 'CRN';
    const docNo = existing.creditNoteNo || existing.returnNo;
    const timestampStr = new Date().toISOString();

    const rawString = `${supplierGstin}${fyearStr}${docType}${docNo}${timestampStr}`;
    const irnNo = crypto.createHash('sha256').update(rawString).digest('hex').substring(0, 64);

    const randomAck = Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString();
    const ackDate = new Date();

    const qrPayload = JSON.stringify({
      sellerGstin: supplierGstin,
      buyerGstin: existing.customerGstin || 'URP',
      docNo,
      docTyp: docType,
      docDt: existing.creditNoteDate,
      totInvVal: Number(existing.totalCreditAmount),
      itemCnt: existing.items?.length || 1,
      mainHsnCode: existing.items?.[0]?.hsn_sac_code || '8481',
      irn: irnNo,
    });
    const signedQrCode = Buffer.from(qrPayload).toString('base64');

    await this.db
      .update(tblSalesReturnHeader)
      .set({
        irnStatus: 'GENERATED',
        irnNo,
        ackNo: randomAck,
        ackDate,
        signedQrCode,
        updatedBy: userId,
        updatedDate: new Date(),
      })
      .where(eq(tblSalesReturnHeader.returnId, returnId));

    await this.auditLogService.logAction({
      userId,
      screenCode: 'SALES_RETURN',
      actionType: 'GENERATE_IRN',
      entityTable: 'tbl_sales_return_header',
      recordId: returnId,
      newValue: { irnStatus: 'GENERATED', irnNo, ackNo: randomAck },
      compId,
      branchId,
      fyearId: user.fyearId || 1001,
    });

    return this.getReturnById(user, returnId);
  }

  // 10. Restock Accepted Goods to Warehouse Bins (Inventory Inward)
  async restockReturn(user: AuthenticatedUserContext, returnId: number, dto: RestockSalesReturnDto) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const fyearId = user.fyearId || 1001;
    const userId = user.userId || 1001;

    const existing = await this.getReturnById(user, returnId);
    if (existing.restockStatus === 'RESTOCKED') {
      throw new BadRequestException('Items have already been restocked into warehouse inventory');
    }
    if (existing.qcStatus === 'PENDING') {
      throw new BadRequestException('QC inspection must be recorded before restocking accepted items');
    }

    let restockedCount = 0;

    for (const item of existing.items) {
      const acceptedQty = Number(item.accepted_qty) || 0;
      if (acceptedQty <= 0) continue;

      const targetWarehouseId = Number(item.target_warehouse_id) || 1004; // Central FG Warehouse fallback
      const targetBinId = Number(item.target_bin_id) || 1007; // Bin FG-BAY-01 fallback
      const itemId = Number(item.item_id);
      const uomId = Number(item.uom_id);
      const batchNo = item.batch_no || 'RMA-RESTOCK';
      const heatNo = item.heat_no || null;
      const unitCost = Number(item.unit_price) || 0;
      const totalCost = Number((acceptedQty * unitCost).toFixed(2));

      // 1. Upsert Bin Stock
      await this.db.execute(sql`
        INSERT INTO tbl_inv_bin_stock (
          comp_id, branch_id, fyear_id,
          warehouse_id, bin_id, item_id, uom_id,
          batch_no, heat_no, on_hand_qty, reserved_qty, available_qty,
          unit_cost, total_valuation, last_stock_date, created_by
        ) VALUES (
          ${compId}, ${branchId}, ${fyearId},
          ${targetWarehouseId}, ${targetBinId}, ${itemId}, ${uomId},
          ${batchNo}, ${heatNo}, ${acceptedQty}, 0.000, ${acceptedQty},
          ${unitCost}, ${totalCost}, CURRENT_TIMESTAMP, ${userId}
        )
        ON CONFLICT (warehouse_id, bin_id, item_id, batch_no)
        DO UPDATE SET
          on_hand_qty = tbl_inv_bin_stock.on_hand_qty + ${acceptedQty},
          available_qty = tbl_inv_bin_stock.available_qty + ${acceptedQty},
          total_valuation = (tbl_inv_bin_stock.on_hand_qty + ${acceptedQty}) * ${unitCost},
          last_stock_date = CURRENT_TIMESTAMP,
          updated_by = ${userId},
          updated_date = CURRENT_TIMESTAMP;
      `);

      // 2. Post immutable transaction in stock ledger
      await this.db.execute(sql`
        INSERT INTO tbl_inv_stock_ledger (
          comp_id, branch_id, fyear_id, transaction_date, transaction_type,
          reference_doc_type, reference_doc_id, reference_doc_no,
          warehouse_id, to_bin_id, item_id, uom_id,
          batch_no, heat_no, qty_in, qty_out, unit_cost, total_cost, remarks, created_by
        ) VALUES (
          ${compId}, ${branchId}, ${fyearId}, CURRENT_TIMESTAMP, 'SALES_RETURN',
          'SALES_RETURN', ${returnId}, ${existing.returnNo},
          ${targetWarehouseId}, ${targetBinId}, ${itemId}, ${uomId},
          ${batchNo}, ${heatNo}, ${acceptedQty}, 0.000, ${unitCost}, ${totalCost},
          ${`Sales return restock inward from ${existing.returnNo}`}, ${userId}
        );
      `);

      restockedCount++;
    }

    const nextStatus = existing.creditNoteStatus === 'POSTED' ? 'COMPLETED' : 'RESTOCKED';

    await this.db
      .update(tblSalesReturnHeader)
      .set({
        restockStatus: 'RESTOCKED',
        restockedBy: userId,
        restockedAt: new Date(),
        status: nextStatus,
        updatedBy: userId,
        updatedDate: new Date(),
      })
      .where(eq(tblSalesReturnHeader.returnId, returnId));

    await this.auditLogService.logAction({
      userId,
      screenCode: 'SALES_RETURN',
      actionType: 'RESTOCK',
      entityTable: 'tbl_sales_return_header',
      recordId: returnId,
      newValue: { restockStatus: 'RESTOCKED', restockedCount },
      compId,
      branchId,
      fyearId,
    });

    return this.getReturnById(user, returnId);
  }

  // 11. Cancel Sales Return
  async cancelReturn(user: AuthenticatedUserContext, returnId: number, cancellationReason: string) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;

    const existing = await this.getReturnById(user, returnId);
    if (existing.status === 'CANCELLED') {
      throw new BadRequestException('Sales return is already cancelled');
    }

    // Revert AR adjustment if Credit Note was posted
    if (existing.creditNoteStatus === 'POSTED' && Number(existing.arAdjustedAmount) > 0 && existing.invoiceId) {
      const [inv] = await this.db
        .select()
        .from(tblSalesInvoiceHeader)
        .where(eq(tblSalesInvoiceHeader.invoiceId, existing.invoiceId));

      if (inv) {
        const restoredBalance = Number(inv.balanceAmount) + Number(existing.arAdjustedAmount);
        await this.db
          .update(tblSalesInvoiceHeader)
          .set({
            balanceAmount: restoredBalance.toFixed(2),
            paymentStatus: restoredBalance > 0 ? 'PARTIALLY_PAID' : 'PAID',
            updatedBy: userId,
            updatedDate: new Date(),
          })
          .where(eq(tblSalesInvoiceHeader.invoiceId, existing.invoiceId));
      }
    }

    // Revert Restocked inventory if already completed
    if (existing.restockStatus === 'RESTOCKED') {
      for (const item of existing.items) {
        const acceptedQty = Number(item.accepted_qty) || 0;
        if (acceptedQty <= 0) continue;

        const targetWarehouseId = Number(item.target_warehouse_id) || 1004;
        const targetBinId = Number(item.target_bin_id) || 1007;
        const itemId = Number(item.item_id);
        const uomId = Number(item.uom_id);
        const batchNo = item.batch_no || 'RMA-RESTOCK';

        await this.db.execute(sql`
          UPDATE tbl_inv_bin_stock
          SET
            on_hand_qty = GREATEST(0, on_hand_qty - ${acceptedQty}),
            available_qty = GREATEST(0, available_qty - ${acceptedQty}),
            last_stock_date = CURRENT_TIMESTAMP,
            updated_by = ${userId},
            updated_date = CURRENT_TIMESTAMP
          WHERE warehouse_id = ${targetWarehouseId}
            AND bin_id = ${targetBinId}
            AND item_id = ${itemId}
            AND batch_no = ${batchNo};
        `);

        // Ledger reversal
        await this.db.execute(sql`
          INSERT INTO tbl_inv_stock_ledger (
            comp_id, branch_id, fyear_id, transaction_date, transaction_type,
            reference_doc_type, reference_doc_id, reference_doc_no,
            warehouse_id, from_bin_id, item_id, uom_id,
            batch_no, qty_in, qty_out, remarks, created_by
          ) VALUES (
            ${compId}, ${branchId}, ${user.fyearId || 1001}, CURRENT_TIMESTAMP, 'ADJUSTMENT',
            'SALES_RETURN', ${returnId}, ${existing.returnNo},
            ${targetWarehouseId}, ${targetBinId}, ${itemId}, ${uomId},
            ${batchNo}, 0.000, ${acceptedQty},
            ${`Reversal of restock for cancelled return ${existing.returnNo}: ${cancellationReason}`}, ${userId}
          );
        `);
      }
    }

    await this.db
      .update(tblSalesReturnHeader)
      .set({
        status: 'CANCELLED',
        remarks: `${existing.remarks || ''} [CANCELLED: ${cancellationReason}]`,
        irnStatus: existing.irnStatus === 'GENERATED' ? 'CANCELLED' : existing.irnStatus,
        updatedBy: userId,
        updatedDate: new Date(),
      })
      .where(eq(tblSalesReturnHeader.returnId, returnId));

    await this.auditLogService.logAction({
      userId,
      screenCode: 'SALES_RETURN',
      actionType: 'CANCEL',
      entityTable: 'tbl_sales_return_header',
      recordId: returnId,
      newValue: { status: 'CANCELLED', cancellationReason },
      compId,
      branchId,
      fyearId: user.fyearId || 1001,
    });

    return this.getReturnById(user, returnId);
  }

  // 12. Soft Delete Draft Sales Return
  async deleteReturn(user: AuthenticatedUserContext, returnId: number) {
    const compId = user.compId || 1001;
    const branchId = user.branchId || 1001;
    const userId = user.userId || 1001;

    const existing = await this.getReturnById(user, returnId);
    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT sales return records can be deleted');
    }

    await this.db
      .update(tblSalesReturnHeader)
      .set({
        isActive: false,
        updatedBy: userId,
        updatedDate: new Date(),
      })
      .where(
        and(
          eq(tblSalesReturnHeader.returnId, returnId),
          eq(tblSalesReturnHeader.compId, compId),
          eq(tblSalesReturnHeader.branchId, branchId),
        ),
      );

    await this.auditLogService.logAction({
      userId,
      screenCode: 'SALES_RETURN',
      actionType: 'DELETE',
      entityTable: 'tbl_sales_return_header',
      recordId: returnId,
      oldValue: { returnNo: existing.returnNo, totalCreditAmount: existing.totalCreditAmount },
      compId,
      branchId,
      fyearId: user.fyearId || 1001,
    });

    return { success: true, message: `Sales return ${existing.returnNo} removed successfully` };
  }
}
