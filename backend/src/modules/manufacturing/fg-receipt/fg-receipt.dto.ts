export interface CreateFgReceiptByproductDto {
  itemId: number;
  uomId: number;
  productType?: string; // 'CO_PRODUCT' | 'BY_PRODUCT' | 'RECOVERABLE_SCRAP' | 'HAZARDOUS_WASTE'
  quantity: number;
  recoveryRate?: number;
  totalRecoveryValue?: number;
  toWarehouseId: number;
  toBinId?: number | null;
  remarks?: string;
}

export interface CreateFgReceiptDto {
  receiptNo?: string;
  receiptDate?: string;
  woId: number;
  itemId: number;
  uomId: number;
  toWarehouseId: number;
  toBinId?: number | null;
  batchNo?: string;
  heatNo?: string;
  manufacturingDate?: string;
  expiryDate?: string | null;
  receivedQty: number;
  acceptedQty?: number;
  rejectedQty?: number;
  reworkQty?: number;
  qcStatus?: string;
  qcRemarks?: string;
  materialCost?: number;
  operationCost?: number;
  byproductCredit?: number;
  totalCost?: number;
  unitCost?: number;
  remarks?: string;
  byproducts?: CreateFgReceiptByproductDto[];
}

export interface UpdateFgReceiptDto {
  receiptDate?: string;
  woId?: number;
  itemId?: number;
  uomId?: number;
  toWarehouseId?: number;
  toBinId?: number | null;
  batchNo?: string;
  heatNo?: string;
  manufacturingDate?: string;
  expiryDate?: string | null;
  receivedQty?: number;
  acceptedQty?: number;
  rejectedQty?: number;
  reworkQty?: number;
  qcStatus?: string;
  qcRemarks?: string;
  materialCost?: number;
  operationCost?: number;
  byproductCredit?: number;
  totalCost?: number;
  unitCost?: number;
  remarks?: string;
  byproducts?: CreateFgReceiptByproductDto[];
}

export interface QcInspectionFgReceiptDto {
  acceptedQty: number;
  rejectedQty?: number;
  reworkQty?: number;
  qcStatus: 'ACCEPTED' | 'REJECTED' | 'DEVIATION_ACCEPTED';
  qcRemarks?: string;
}

export interface PostFgReceiptDto {
  toWarehouseId?: number;
  toBinId?: number | null;
  remarks?: string;
}
