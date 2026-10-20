export interface StockBalanceFilterDto {
  warehouseId?: number;
  binId?: number;
  itemType?: string;
  stockStatus?: 'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'RESERVED';
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface StockRevaluationDto {
  newUnitCost: number;
  revaluationReason: string;
  updateItemStandardCost?: boolean;
}
