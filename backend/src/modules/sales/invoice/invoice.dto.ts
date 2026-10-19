export interface CreateInvoiceItemDto {
  soItemId?: number;
  challanItemId?: number;
  itemSequence?: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  description?: string;
  hsnSacCode?: string;
  uomId: number;
  quantity: number;
  unitRate: number;
  discountPercent?: number;
  gstRate?: number;
  batchNo?: string;
  heatNo?: string;
  remarks?: string;
}

export interface CreateInvoiceDto {
  invoiceType?: 'TAX_INVOICE' | 'EXPORT_INVOICE' | 'PROFORMA_INVOICE' | 'DEBIT_NOTE' | 'BILL_OF_SUPPLY';
  invoiceDate: string;
  challanId?: number;
  soId?: number;
  customerId: number;
  customerName: string;
  contactPerson?: string;
  contactPhone?: string;
  billingAddressId?: number;
  billingAddress?: string;
  shippingAddressId?: number;
  shippingAddress?: string;
  placeOfSupply?: string;
  customerGstin?: string;
  customerPan?: string;
  supplyType?: 'INTRA_STATE' | 'INTER_STATE' | 'EXPORT_WITH_PAY' | 'EXPORT_WITHOUT_PAY';
  reverseChargeApplicable?: boolean;
  transporterName?: string;
  vehicleNo?: string;
  lrRrNo?: string;
  lrRrDate?: string;
  paymentTermsDays?: number;
  dueDate?: string;
  freightCharges?: number;
  insuranceCharges?: number;
  packagingCharges?: number;
  tcsRate?: number;
  remarks?: string;
  termsAndConditions?: string;
  items: CreateInvoiceItemDto[];
}

export interface UpdateInvoiceDto extends Partial<CreateInvoiceDto> {}

export interface PostInvoiceDto {
  remarks?: string;
}

export interface GenerateIrnDto {
  override?: boolean;
  remarks?: string;
}

export interface RecordPaymentDto {
  paymentMode: 'NEFT_RTGS' | 'CHEQUE' | 'UPI' | 'CASH' | 'BANK_TRANSFER' | 'CREDIT_ADJUSTMENT';
  referenceNo?: string;
  paymentAmount: number;
  tdsAmount?: number;
  bankName?: string;
  chequeDate?: string;
  remarks?: string;
}

export interface CancelInvoiceDto {
  cancellationReason: string;
}

export interface InvoiceFilterParams {
  search?: string;
  status?: string;
  paymentStatus?: string;
  irnStatus?: string;
  customerId?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}
