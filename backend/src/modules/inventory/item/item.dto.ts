export const ITEM_TYPES = [
  'RAW_MATERIAL',
  'WIP_SEMI_FINISHED',
  'FINISHED_GOODS',
  'PACKING_MATERIAL',
  'CONSUMABLE_MRO',
  'TOOLING_DIE',
  'SCRAP',
] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const VALUATION_METHODS = [
  'FIFO',
  'WEIGHTED_AVG',
  'STANDARD_COST',
] as const;
export type ValuationMethod = (typeof VALUATION_METHODS)[number];

export interface CreateItemDto {
  itemCode: string;
  itemName: string;
  categoryId: number;
  itemType?: ItemType;
  description?: string;
  baseUomId: number;
  purchaseUomId?: number;
  salesUomId?: number;
  hsnSacCode?: string;
  taxRate?: number;
  standardCost?: number;
  purchaseRate?: number;
  salesRate?: number;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderPoint?: number;
  safetyStock?: number;
  leadTimeDays?: number;
  valuationMethod?: ValuationMethod;
  isBatchManaged?: boolean;
  isSerialManaged?: boolean;
  isQcInspectionRequired?: boolean;
  shelfLifeDays?: number;
  defaultWarehouseId?: number;
  defaultBinId?: number;
  drawingNo?: string;
  revisionNo?: string;
  weightPerUnitKg?: number;
  isBomAllowed?: boolean;
  yieldPercentage?: number;
  inspectionLeadTimeDays?: number;
  isActive?: boolean;
}

export interface UpdateItemDto extends Partial<CreateItemDto> {}

export interface ItemFilterDto {
  categoryId?: number;
  itemType?: ItemType;
  isActive?: boolean;
  search?: string;
  warehouseId?: number;
}
