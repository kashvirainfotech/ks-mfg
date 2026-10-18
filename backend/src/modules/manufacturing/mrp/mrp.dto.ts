export interface MrpFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  demandSource?: string;
  orderType?: string; // 'MAKE', 'BUY', 'SUBCONTRACT'
  bomLevel?: number;
  mrpRunId?: number;
  isPastDue?: string; // 'true' | 'false'
  startDate?: string;
  endDate?: string;
}

export interface RunMrpDto {
  planningHorizonDays?: number;
  demandSource?: string; // 'ALL', 'BUFFER_DEFICIT', 'SALES_ORDERS', 'MANUAL_FORECAST'
  includeSafetyStock?: boolean;
  specificItemIds?: number[];
  remarks?: string;
}

export interface ConvertPlannedOrderDto {
  plannedOrderIds: number[];
  warehouseId?: number;
  departmentId?: number;
  requiredByDate?: string;
  priority?: string; // 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL_URGENT'
  purpose?: string;
}

export interface UpdatePlannedOrderStatusDto {
  status: 'SUGGESTED' | 'CONFIRMED' | 'CANCELLED';
  remarks?: string;
}
