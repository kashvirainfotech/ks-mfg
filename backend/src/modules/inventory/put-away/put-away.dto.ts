export type PutAwayType =
  | 'GRN_INWARD'
  | 'QC_RELEASE'
  | 'INTERNAL_TRANSFER'
  | 'REWORK_RETURN';

export type PutAwayStatus =
  | 'DRAFT'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface CreatePutAwayItemDto {
  grnItemId?: number;
  qcItemId?: number;
  itemId: number;
  itemDescription?: string;
  uomId: number;
  sourceBinId?: number;
  destinationBinId: number;
  allocatedQty: number;
  putawayQty?: number;
  batchNo?: string;
  heatNo?: string;
  mfgDate?: string;
  expiryDate?: string;
  remarks?: string;
}

export interface CreatePutAwayDto {
  warehouseId: number;
  grnId?: number;
  qcId?: number;
  assignedTo?: number;
  putawayType?: PutAwayType;
  putawayDate?: string;
  remarks?: string;
  items: CreatePutAwayItemDto[];
}

export interface UpdatePutAwayDto {
  warehouseId?: number;
  grnId?: number;
  qcId?: number;
  assignedTo?: number;
  putawayType?: PutAwayType;
  putawayDate?: string;
  remarks?: string;
  items?: CreatePutAwayItemDto[];
}

export interface AssignPutAwayDto {
  assignedTo: number;
  remarks?: string;
}

export interface ConfirmPutAwayItemDto {
  putawayItemId: number;
  destinationBinId: number;
  putawayQty: number;
  remarks?: string;
}

export interface ConfirmPutAwayDto {
  completedDate?: string;
  remarks?: string;
  items?: ConfirmPutAwayItemDto[];
}

export interface CancelPutAwayDto {
  cancelReason: string;
}

export interface PutAwayFilterDto {
  status?: string;
  putawayType?: string;
  warehouseId?: number;
  assignedTo?: number;
  fromDate?: string;
  toDate?: string;
  search?: string;
}
