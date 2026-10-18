export const RFQ_STATUSES = [
  'DRAFT',
  'SENT',
  'QUOTES_RECEIVED',
  'COMPARISON_DONE',
  'AWARDED',
  'CANCELLED',
] as const;
export type RfqStatus = (typeof RFQ_STATUSES)[number];

export const VENDOR_INVITE_STATUSES = [
  'INVITED',
  'QUOTED',
  'DECLINED',
  'SELECTED',
] as const;
export type VendorInviteStatus = (typeof VENDOR_INVITE_STATUSES)[number];

export interface CreateRfqItemDto {
  rfqItemId?: number;
  prItemId?: number | null;
  itemId: number;
  uomId: number;
  requiredQty: number;
  targetRate?: number;
  technicalSpecs?: string;
}

export interface CreateRfqDto {
  rfqNo?: string;
  rfqDate?: string;
  dueDate: string;
  warehouseId: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  remarks?: string;
  items: CreateRfqItemDto[];
  vendorPartyIds?: number[];
}

export interface UpdateRfqDto extends Partial<CreateRfqDto> {}

export interface RecordQuoteItemDto {
  rfqItemId: number;
  offeredQty: number;
  quotedRate: number;
  discountPct?: number;
  taxPct?: number;
  remarks?: string;
}

export interface RecordVendorQuoteDto {
  vendorQuoteRef: string;
  quoteDate: string;
  paymentTerms?: string;
  deliveryLeadTimeDays?: number;
  vendorRemarks?: string;
  items: RecordQuoteItemDto[];
}

export interface AwardRfqDto {
  awardedVendorId: number;
  awardedRemarks: string;
  awardedItemIds?: number[];
}

export interface RfqFilterDto {
  status?: RfqStatus;
  warehouseId?: number;
  search?: string;
}
