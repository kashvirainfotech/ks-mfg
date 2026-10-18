export type InvoiceStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'CANCELLED';

export type MatchingStatus =
  | 'MATCHED'
  | 'PRICE_VARIANCE'
  | 'QTY_VARIANCE'
  | 'TAX_VARIANCE'
  | 'PENDING_REVIEW';

export type PaymentStatus =
  | 'UNPAID'
  | 'PARTIALLY_PAID'
  | 'PAID';

export interface CreateInvoiceItemDto {
  poItemId?: number;
  grnItemItemId?: number; // legacy alias
  grnItemId?: number;
  qcItemId?: number;
  itemId: number;
  itemDescription?: string;
  hsnCode?: string;
  uomId: number;
  poQty?: number;
  receivedQty?: number;
  acceptedQty?: number;
  billedQty: number;
  poRate?: number;
  invoicedRate: number;
  rateVariance?: number;
  itemAmount?: number;
  discountPercent?: number;
  discountAmount?: number;
  taxableAmount?: number;
  gstRate?: number;
  cgstRate?: number;
  cgstAmount?: number;
  sgstRate?: number;
  sgstAmount?: number;
  igstRate?: number;
  igstAmount?: number;
  totalItemAmount?: number;
  batchNo?: string;
  remarks?: string;
}

export interface CreateInvoiceDto {
  invoiceNo?: string;
  invoiceDate: string;
  vendorId: number;
  poId?: number;
  grnId?: number;
  qcId?: number;
  vendorInvoiceNo: string;
  vendorInvoiceDate: string;
  vendorGstin?: string;
  paymentTermsDays?: number;
  dueDate?: string;
  subtotalAmount?: number;
  discountAmount?: number;
  taxableAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  totalTaxAmount?: number;
  freightCharges?: number;
  insuranceCharges?: number;
  packagingCharges?: number;
  tdsRate?: number;
  tdsAmount?: number;
  tcsRate?: number;
  tcsAmount?: number;
  roundOff?: number;
  netPayableAmount?: number;
  matchingStatus?: MatchingStatus;
  status?: InvoiceStatus;
  remarks?: string;
  items: CreateInvoiceItemDto[];
}

export interface UpdateInvoiceDto {
  invoiceDate?: string;
  vendorId?: number;
  poId?: number;
  grnId?: number;
  qcId?: number;
  vendorInvoiceNo?: string;
  vendorInvoiceDate?: string;
  vendorGstin?: string;
  paymentTermsDays?: number;
  dueDate?: string;
  subtotalAmount?: number;
  discountAmount?: number;
  taxableAmount?: number;
  cgstAmount?: number;
  sgstAmount?: number;
  igstAmount?: number;
  totalTaxAmount?: number;
  freightCharges?: number;
  insuranceCharges?: number;
  packagingCharges?: number;
  tdsRate?: number;
  tdsAmount?: number;
  tcsRate?: number;
  tcsAmount?: number;
  roundOff?: number;
  netPayableAmount?: number;
  matchingStatus?: MatchingStatus;
  remarks?: string;
  items?: CreateInvoiceItemDto[];
}

export interface SubmitInvoiceDto {
  remarks?: string;
}

export interface ApproveInvoiceDto {
  approvalRemarks?: string;
}

export interface CancelInvoiceDto {
  cancelReason: string;
}

export interface RecordPaymentDto {
  paidAmount: number;
  paymentMode: 'NEFT' | 'RTGS' | 'CHEQUE' | 'UPI' | 'INTERNAL_TRANSFER';
  paymentRefNo: string;
  paymentDate: string;
  remarks?: string;
}

export interface InvoiceFilterParams {
  status?: InvoiceStatus;
  matchingStatus?: MatchingStatus;
  paymentStatus?: PaymentStatus;
  vendorId?: number;
  poId?: number;
  grnId?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
}
