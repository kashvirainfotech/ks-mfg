export interface ChallanItemDto {
  challanItemId?: number;
  soItemId?: number;
  itemSequence?: number;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  description?: string;
  hsnSacCode?: string;
  uomId: number;
  orderedQty?: number;
  dispatchedQty: number;
  warehouseId: number;
  binId?: number;
  batchNo?: string;
  heatNo?: string;
  unitRate?: number;
  totalAmount?: number;
  remarks?: string;
}

export interface CreateChallanDto {
  challanNo?: string;
  challanDate?: string;
  soId?: number;
  soNo?: string;
  customerId: number;
  customerName?: string;
  contactPerson?: string;
  contactPhone?: string;
  billingAddressId?: number;
  billingAddress?: string;
  shippingAddressId?: number;
  shippingAddress?: string;
  shippingStateCode?: string;
  shippingStateName?: string;
  customerGstin?: string;
  dispatchPurpose?: string;
  transporterId?: number;
  transporterName?: string;
  vehicleNo?: string;
  lrRrNo?: string;
  lrRrDate?: string;
  eWayBillNo?: string;
  eWayBillDate?: string;
  deliveryTerms?: string;
  totalPackages?: number;
  packageType?: string;
  grossWeightKg?: number;
  netWeightKg?: number;
  warehouseId: number;
  remarks?: string;
  termsAndConditions?: string;
  items: ChallanItemDto[];
}

export interface UpdateChallanDto extends Partial<CreateChallanDto> {}

export interface PickChallanDto {
  pickedBy?: number;
  remarks?: string;
}

export interface PackChallanDto {
  packedBy?: number;
  totalPackages?: number;
  packageType?: string;
  grossWeightKg?: number;
  netWeightKg?: number;
  remarks?: string;
}

export interface DispatchChallanDto {
  vehicleNo?: string;
  transporterId?: number;
  transporterName?: string;
  lrRrNo?: string;
  lrRrDate?: string;
  eWayBillNo?: string;
  eWayBillDate?: string;
  remarks?: string;
}
