export interface MaterialIssueFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string; // 'DRAFT', 'SUBMITTED', 'POSTED', 'CANCELLED'
  issueType?: string; // 'STANDARD_ISSUE', 'RETURN_TO_STORE', 'SCRAP_ADJUSTMENT', 'LINESIDE_TRANSFER'
  woId?: number;
  fromWarehouseId?: number;
  toWarehouseId?: number;
  startDate?: string;
  endDate?: string;
}

export interface CreateMaterialIssueItemDto {
  woBomItemId?: number;
  itemId: number;
  uomId: number;
  requiredQty?: number;
  previouslyIssuedQty?: number;
  issueQty: number;
  unitCost?: number;
  batchNo?: string;
  heatNo?: string;
  binLocation?: string;
  remarks?: string;
}

export interface CreateMaterialIssueDto {
  issueNo?: string;
  issueDate?: string;
  woId: number;
  issueType?: 'STANDARD_ISSUE' | 'RETURN_TO_STORE' | 'SCRAP_ADJUSTMENT' | 'LINESIDE_TRANSFER';
  fromWarehouseId: number;
  toWarehouseId?: number;
  issuedBy?: number;
  receivedBy?: number;
  remarks?: string;
  items: CreateMaterialIssueItemDto[];
}

export interface UpdateMaterialIssueDto {
  fromWarehouseId?: number;
  toWarehouseId?: number;
  issueDate?: string;
  issuedBy?: number;
  receivedBy?: number;
  remarks?: string;
  items?: CreateMaterialIssueItemDto[];
}

export interface SubmitMaterialIssueDto {
  remarks?: string;
}

export interface ReturnToStoreItemDto {
  woBomItemId?: number;
  itemId: number;
  uomId: number;
  returnQty: number;
  unitCost?: number;
  batchNo?: string;
  binLocation?: string;
  remarks?: string;
}

export interface ReturnToStoreDto {
  woId: number;
  fromWarehouseId: number; // WIP Warehouse returning from
  toWarehouseId: number;   // Store Warehouse returning to
  remarks?: string;
  items: ReturnToStoreItemDto[];
}
