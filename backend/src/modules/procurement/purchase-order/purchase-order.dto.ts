export const PO_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'RELEASED',
  'PARTIALLY_RECEIVED',
  'CLOSED',
  'CANCELLED',
] as const;
export type PoStatus = (typeof PO_STATUSES)[number];

export const PO_TYPES = [
  'STANDARD_PO',
  'BLANKET_PO',
  'JOB_WORK_PO',
  'SERVICE_PO',
] as const;
export type PoType = (typeof PO_TYPES)[number];

export interface CreatePoItemDto {
  poItemId?: number;
  prItemId?: number | null;
  rfqItemId?: number | null;
  itemId: number;
  uomId: number;
  orderQty: number;
  unitRate: number;
  discountPct?: number;
  taxPct?: number;
  deliveryDate?: string;
  technicalSpecs?: string;
}

export interface CreatePurchaseOrderDto {
  poNo?: string;
  poDate?: string;
  deliveryDueDate: string;
  vendorId: number;
  vendorAddressId?: number | null;
  warehouseId: number;
  rfqId?: number | null;
  prId?: number | null;
  poType?: PoType;
  paymentTerms?: string;
  deliveryTerms?: string;
  freightTerms?: string;
  notes?: string;
  items: CreatePoItemDto[];
}

export interface UpdatePurchaseOrderDto extends Partial<CreatePurchaseOrderDto> {}

export interface ReleasePurchaseOrderDto {
  releaseNotes?: string;
}

export interface CancelPurchaseOrderDto {
  cancellationReason: string;
}

export interface PurchaseOrderFilterDto {
  status?: PoStatus;
  poType?: PoType;
  vendorId?: number;
  warehouseId?: number;
  search?: string;
}
