export type GrnStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'QC_IN_PROGRESS'
  | 'APPROVED'
  | 'CANCELLED';

export interface CreateGrnItemDto {
  poItemId?: number;
  gateInwardItemId?: number;
  itemId: number;
  itemDescription?: string;
  uomId: number;
  orderQty?: number;
  challanQty: number;
  receivedQty: number;
  acceptedQty?: number;
  rejectedQty?: number;
  quarantineQty?: number;
  shortageQty?: number;
  excessQty?: number;
  unitRate: number;
  receivedAmount?: number;
  batchNo?: string;
  mfgDate?: string;
  expiryDate?: string;
  quarantineBinId?: number;
  storageBinId?: number;
  isQcRequired?: boolean;
  remarks?: string;
}

export interface CreateGrnDto {
  grnNo?: string;
  grnDate: string;
  warehouseId: number;
  vendorId: number;
  poId?: number;
  gateInwardId?: number;
  challanNo: string;
  challanDate: string;
  invoiceNo?: string;
  invoiceDate?: string;
  vehicleNo?: string;
  ewayBillNo?: string;
  lrNo?: string;
  lrDate?: string;
  storeRemarks?: string;
  status?: GrnStatus;
  items: CreateGrnItemDto[];
}

export interface UpdateGrnDto {
  grnDate?: string;
  warehouseId?: number;
  vendorId?: number;
  poId?: number;
  gateInwardId?: number;
  challanNo?: string;
  challanDate?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  vehicleNo?: string;
  ewayBillNo?: string;
  lrNo?: string;
  lrDate?: string;
  storeRemarks?: string;
  items?: CreateGrnItemDto[];
}

export interface QuarantinePutAwayDto {
  quarantineBinId?: number;
  inspectionRemarks?: string;
  items?: {
    grnItemId: number;
    quarantineBinId?: number;
    quarantineQty?: number;
    batchNo?: string;
  }[];
}

export interface ApproveGrnDto {
  approvalRemarks?: string;
  items?: {
    grnItemId: number;
    acceptedQty?: number;
    rejectedQty?: number;
    storageBinId?: number;
    remarks?: string;
  }[];
}

export interface CancelGrnDto {
  cancelReason: string;
}

export interface GrnFilterParams {
  status?: GrnStatus;
  warehouseId?: number;
  vendorId?: number;
  poId?: number;
  gateInwardId?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
}
