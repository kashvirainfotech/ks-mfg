export interface AgingFilterDto {
  warehouseId?: number;
  categoryId?: number;
  agingBracket?: 'ALL' | '0_30' | '31_60' | '61_90' | '91_180' | '181_365' | 'GT_365';
  fsnClassification?: 'ALL' | 'FAST' | 'SLOW' | 'NON_MOVING';
  stockStatus?: 'ALL' | 'IN_STOCK' | 'STOCKOUT' | 'BELOW_SAFETY' | 'BELOW_ROP';
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateProvisionProposalDto {
  valuationDate: string;
  warehouseId?: number;
  categoryId?: number;
  policyMatrix?: {
    bracket_0_30: number;
    bracket_31_60: number;
    bracket_61_90: number;
    bracket_91_180: number;
    bracket_181_365: number;
    bracket_gt_365: number;
  };
  remarks?: string;
  items?: Array<{
    itemId: number;
    warehouseId: number;
    binId?: number;
    batchNo?: string;
    heatNo?: string;
    itemCode: string;
    itemName: string;
    uomId: number;
    onHandQty: number;
    unitCost: number;
    grossValuation: number;
    firstInwardDate?: string;
    lastMovementDate?: string;
    ageInDays: number;
    agingBracket: string;
    fsnClassification: string;
    provisionRatePercent: number;
    provisionAmount: number;
    netRealizableValue: number;
    justification?: string;
    remarks?: string;
  }>;
}

export interface TriggerPurchaseRequisitionDto {
  itemId: number;
  warehouseId: number;
  requiredQty: number;
  requiredByDate?: string;
  suggestedVendorId?: number;
  purpose?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL_URGENT';
}
