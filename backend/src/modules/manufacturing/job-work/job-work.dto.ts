export interface CreateJobWorkChallanItemDto {
  itemId: number;
  itemDescription?: string;
  uomId: number;
  sentQty: number;
  unitRate: number;
  hsnCode?: string;
  batchNo?: string;
  heatNo?: string;
  remarks?: string;
}

export interface CreateJobWorkChallanDto {
  challanNo?: string;
  challanDate?: string;
  vendorId: number;
  woId?: number;
  woRoutingOpId?: number;
  jobCardId?: number;
  natureOfProcessing: string;
  fromWarehouseId: number;
  expectedReturnDate?: string;
  transporterName?: string;
  vehicleNo?: string;
  ewayBillNo?: string;
  remarks?: string;
  items: CreateJobWorkChallanItemDto[];
}

export interface UpdateJobWorkChallanDto {
  challanDate?: string;
  vendorId?: number;
  woId?: number;
  woRoutingOpId?: number;
  jobCardId?: number;
  natureOfProcessing?: string;
  fromWarehouseId?: number;
  expectedReturnDate?: string;
  transporterName?: string;
  vehicleNo?: string;
  ewayBillNo?: string;
  remarks?: string;
  items?: CreateJobWorkChallanItemDto[];
}

export interface DispatchJobWorkChallanDto {
  transporterName?: string;
  vehicleNo?: string;
  ewayBillNo?: string;
  remarks?: string;
}

export interface CreateJobWorkReceiptItemDto {
  challanItemId?: number;
  receivedItemId: number;
  uomId: number;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty?: number;
  reworkQty?: number;
  scrapQty?: number;
  lossQty?: number;
  processingRate: number;
  batchNo?: string;
  heatNo?: string;
  remarks?: string;
}

export interface CreateJobWorkReceiptDto {
  receiptNo?: string;
  receiptDate?: string;
  challanId: number;
  vendorId: number;
  woId?: number;
  vendorDcNo?: string;
  vendorDcDate?: string;
  vendorInvoiceNo?: string;
  toWarehouseId: number;
  serviceCharges?: number;
  taxAmount?: number;
  totalAmount?: number;
  qcStatus?: string;
  remarks?: string;
  items: CreateJobWorkReceiptItemDto[];
}

export interface ReconcileJobWorkChallanDto {
  remarks?: string;
  forceClose?: boolean;
}
