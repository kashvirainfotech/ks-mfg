export interface QuotationItemDto {
  quotationItemId?: number;
  itemSequence?: number;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  description?: string;
  hsnSacCode?: string;
  uomId: number;
  quantity: number;
  unitRate: number;
  grossAmount?: number;
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
  totalTaxAmount?: number;
  totalAmount?: number;
  deliveryLeadTimeDays?: number;
  remarks?: string;
}

export interface CreateQuotationDto {
  quotationNo?: string;
  quotationDate?: string;
  inquiryRefNo?: string;
  inquiryDate?: string;
  customerId: number;
  customerName?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  billingAddressId?: number;
  billingAddress?: string;
  shippingAddressId?: number;
  shippingAddress?: string;
  shippingStateCode?: string;
  shippingStateName?: string;
  customerGstin?: string;
  priceListId?: number;
  currencyCode?: string;
  exchangeRate?: number;
  validUntil: string;
  deliveryLeadTimeDays?: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  discountPercent?: number;
  freightCharges?: number;
  packagingCharges?: number;
  remarks?: string;
  termsAndConditions?: string;
  items: QuotationItemDto[];
}

export interface UpdateQuotationDto extends Partial<CreateQuotationDto> {}

export interface ReviseQuotationDto {
  revisionReason: string;
  discountPercent?: number;
  freightCharges?: number;
  packagingCharges?: number;
  validUntil?: string;
  remarks?: string;
  items?: QuotationItemDto[];
}

export interface UpdateQuotationStatusDto {
  status: 'DRAFT' | 'SUBMITTED' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED_TO_SO';
  remarks?: string;
}

export interface ConvertQuotationToSoDto {
  customerPoNo?: string;
  customerPoDate?: string;
  remarks?: string;
}
