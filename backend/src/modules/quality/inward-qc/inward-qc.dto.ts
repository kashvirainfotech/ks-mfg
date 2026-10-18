export type QcOverallResult =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ACCEPTED_UNDER_DEVIATION';

export type QcInspectionStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type QcInspectionType =
  | 'INCOMING_RAW_MATERIAL'
  | 'SUBCONTRACT_JOBWORK'
  | 'CONSUMABLE_CHEMICAL'
  | 'BOUGHT_OUT_COMPONENT';

export type QcCheckResult = 'PASS' | 'FAIL' | 'NA';

export type QcItemDisposition =
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ACCEPTED_UNDER_DEVIATION'
  | 'REWORK';

export interface CreateQcItemDto {
  grnItemId: number;
  itemId: number;
  uomId: number;
  receivedQty: number;
  sampleQty?: number;
  acceptedQty?: number;
  rejectedQty?: number;
  disposition?: QcItemDisposition;
  defectCode?: string;
  batchNo?: string;
  heatNo?: string;
  mfgDate?: string;
  expiryDate?: string;
  quarantineBinId?: number;
  destinationBinId?: number;
  visualCheck?: QcCheckResult;
  dimensionCheck?: QcCheckResult;
  chemicalTest?: QcCheckResult;
  hardnessTest?: QcCheckResult;
  observedParameters?: Record<string, any>;
  remarks?: string;
}

export interface CreateQcInspectionDto {
  qcNo?: string;
  qcDate: string;
  grnId: number;
  warehouseId: number;
  vendorId: number;
  poId?: number;
  gateInwardId?: number;
  sampleSize?: number;
  inspectionType?: QcInspectionType;
  overallResult?: QcOverallResult;
  remarks?: string;
  deviationReason?: string;
  testCertNo?: string;
  testCertDate?: string;
  items: CreateQcItemDto[];
}

export interface UpdateQcInspectionDto {
  qcDate?: string;
  warehouseId?: number;
  vendorId?: number;
  poId?: number;
  gateInwardId?: number;
  sampleSize?: number;
  inspectionType?: QcInspectionType;
  overallResult?: QcOverallResult;
  remarks?: string;
  deviationReason?: string;
  testCertNo?: string;
  testCertDate?: string;
  items?: CreateQcItemDto[];
}

export interface ApproveQcInspectionDto {
  approvalRemarks?: string;
  overallResult?: QcOverallResult;
  items?: {
    qcItemId: number;
    acceptedQty: number;
    rejectedQty: number;
    destinationBinId?: number;
    disposition?: QcItemDisposition;
    remarks?: string;
  }[];
}

export interface RejectQcInspectionDto {
  rejectionReason: string;
  defectCode?: string;
}

export interface CancelQcInspectionDto {
  cancelReason: string;
}

export interface QcFilterParams {
  status?: QcInspectionStatus;
  overallResult?: QcOverallResult;
  warehouseId?: number;
  vendorId?: number;
  grnId?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
}
