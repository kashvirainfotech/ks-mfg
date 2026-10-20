export interface CreateAdjustmentItemDto {
  itemId: number;
  itemCode: string;
  itemName: string;
  binId: number;
  uomId: number;
  batchNo?: string;
  heatNo?: string;
  bookQty: number;
  physicalQty: number;
  unitCost: number;
  discrepancyReason?: string;
  remarks?: string;
}

export interface CreateAdjustmentHeaderDto {
  adjustmentDate?: string;
  adjustmentType: string;
  warehouseId: number;
  auditedBy?: number;
  auditedAt?: string;
  remarks?: string;
  items: CreateAdjustmentItemDto[];
}

export interface UpdateAdjustmentHeaderDto {
  adjustmentDate?: string;
  adjustmentType?: string;
  warehouseId?: number;
  remarks?: string;
  items?: CreateAdjustmentItemDto[];
}

export interface AdjustmentFilterDto {
  warehouseId?: number;
  status?: string;
  adjustmentType?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export interface CancelAdjustmentDto {
  cancellationReason: string;
}
