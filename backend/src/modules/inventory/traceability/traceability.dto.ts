export interface CreateBatchMasterDto {
  batchNo: string;
  heatNo?: string;
  lotNo?: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  supplierId?: number;
  grnId?: number;
  workOrderId?: number;
  manufactureDate?: string;
  expiryDate?: string;
  retestDate?: string;
  initialQty: number;
  currentQty: number;
  uomId: number;
  qcStatus?: 'APPROVED' | 'QUARANTINE' | 'REJECTED' | 'EXPIRED' | 'CONDITIONAL';
  mtcNo?: string;
  mtcDate?: string;
  mtcUrl?: string;
  chemC?: number;
  chemMn?: number;
  chemSi?: number;
  chemP?: number;
  chemS?: number;
  chemCr?: number;
  chemNi?: number;
  chemMo?: number;
  yieldStrengthMpa?: number;
  tensileStrengthMpa?: number;
  elongationPct?: number;
  hardnessVal?: number;
  hardnessScale?: string;
  impactJoules?: number;
  ultrasonicTestStatus?: string;
  radiographyStatus?: string;
  remarks?: string;
}

export interface CreateSerialMasterDto {
  itemId: number;
  itemCode: string;
  itemName: string;
  batchId?: number;
  batchNo?: string;
  heatNo?: string;
  serialNo: string;
  barcode?: string;
  rfidTag?: string;
  currentWarehouseId?: number;
  currentBinId?: number;
  status?: string;
  grnId?: number;
  workOrderId?: number;
  jobCardId?: number;
  challanId?: number;
  invoiceId?: number;
  customerId?: number;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  remarks?: string;
}

export interface CreateGenealogyLinkDto {
  parentBatchId?: number;
  parentBatchNo: string;
  parentItemId: number;
  childBatchId?: number;
  childBatchNo: string;
  childItemId: number;
  workOrderId?: number;
  jobCardId?: number;
  consumedQty: number;
  uomId: number;
  transformationType?: string;
  remarks?: string;
}

export interface TraceabilityFilterDto {
  query?: string;
  qcStatus?: string;
  serialStatus?: string;
  itemId?: number;
  supplierId?: number;
  customerId?: number;
  limit?: number;
  offset?: number;
}
