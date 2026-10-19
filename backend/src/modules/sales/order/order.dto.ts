export interface OrderItemDto {
  soItemId?: number;
  itemSequence?: number;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  description?: string;
  hsnSacCode?: string;
  uomId: number;
  orderedQty: number;
  reservedQty?: number;
  deliveredQty?: number;
  invoicedQty?: number;
  cancelledQty?: number;
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
  targetDeliveryDate?: string;
  reservationStatus?: 'PENDING' | 'PARTIAL' | 'FULL' | 'RELEASED';
  workOrderId?: number;
  remarks?: string;
}

export interface CreateOrderDto {
  soNo?: string;
  soDate?: string;
  quotationId?: number;
  customerId: number;
  customerName?: string;
  customerPoNo?: string;
  customerPoDate?: string;
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
  targetDeliveryDate?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  discountPercent?: number;
  freightCharges?: number;
  packagingCharges?: number;
  remarks?: string;
  termsAndConditions?: string;
  items: OrderItemDto[];
}

export interface UpdateOrderDto extends Partial<CreateOrderDto> {}

export interface ConfirmOrderDto {
  autoReserveStock?: boolean;
  remarks?: string;
}

export interface HoldOrderDto {
  isHold: boolean;
  holdReason?: string;
}

export interface CreditOverrideDto {
  creditOverrideReason: string;
}

export interface CreateWorkOrderDto {
  soItemId?: number;
  targetWarehouseId?: number;
  remarks?: string;
}

export interface ReserveStockDto {
  soItemId: number;
  qtyToReserve: number;
  warehouseId?: number;
  binId?: number;
  batchNo?: string;
}
