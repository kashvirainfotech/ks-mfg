export interface WorkOrderFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string; // 'DRAFT', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CLOSED', 'CANCELLED'
  priority?: string; // 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL_URGENT'
  itemId?: number;
  targetWarehouseId?: number;
  startDate?: string;
  endDate?: string;
  isOverdue?: string; // 'true' | 'false'
}

export interface CreateWoBomItemDto {
  itemId: number;
  itemDescription?: string;
  uomId: number;
  standardQtyPerUnit: number;
  scrapFactorPercent?: number;
  requiredQty: number;
  unitCost?: number;
  sourceType?: 'PURCHASED' | 'MANUFACTURED' | 'SUBCONTRACT';
  operationSeq?: number;
  isCritical?: boolean;
  remarks?: string;
}

export interface CreateWoRoutingOpDto {
  opSequence: number;
  opCode: string;
  opName: string;
  workCenterId: number;
  machineId?: number;
  plannedSetupTimeMins?: number;
  plannedRunTimeMins?: number;
  plannedCost?: number;
  plannedQty?: number;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  isInspectionRequired?: boolean;
  isSubcontracted?: boolean;
  subcontractVendorId?: number;
  remarks?: string;
}

export interface CreateWorkOrderDto {
  woNo?: string;
  woDate?: string;
  itemId: number;
  bomId?: number;
  routingId?: number;
  targetWarehouseId: number;
  wipWarehouseId?: number;
  plannedQty: number;
  uomId: number;
  scheduledStartDate: string;
  scheduledEndDate: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL_URGENT';
  salesOrderId?: number;
  mrpPlannedOrderId?: number;
  batchNo?: string;
  remarks?: string;
  customBomItems?: CreateWoBomItemDto[];
  customRoutingOps?: CreateWoRoutingOpDto[];
}

export interface UpdateWorkOrderDto {
  targetWarehouseId?: number;
  wipWarehouseId?: number;
  plannedQty?: number;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL_URGENT';
  batchNo?: string;
  remarks?: string;
  customBomItems?: CreateWoBomItemDto[];
  customRoutingOps?: CreateWoRoutingOpDto[];
}

export interface ReleaseWorkOrderDto {
  releaseRemarks?: string;
}

export interface CloseWorkOrderDto {
  completedQty: number;
  scrappedQty?: number;
  closeRemarks?: string;
}

export interface ConvertMrpOrderDto {
  plannedOrderId: number;
  targetWarehouseId?: number;
  wipWarehouseId?: number;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL_URGENT';
  batchNo?: string;
  remarks?: string;
}
