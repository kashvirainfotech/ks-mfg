export const UOM_TYPES = [
  'COUNT',
  'WEIGHT',
  'LENGTH',
  'VOLUME',
  'AREA',
  'TIME',
] as const;
export type UomType = (typeof UOM_TYPES)[number];

export const CONVERSION_TYPES = [
  'STANDARD',
  'PACKAGING',
  'ITEM_SPECIFIC',
] as const;
export type ConversionType = (typeof CONVERSION_TYPES)[number];

export const CATEGORY_TYPES = [
  'RAW_MATERIAL',
  'WIP_SUB_ASSEMBLY',
  'FINISHED_GOODS',
  'PACKING_MATERIAL',
  'CONSUMABLES_MRO',
  'TOOLS_DIES',
  'SCRAP_REJECT',
] as const;
export type CategoryType = (typeof CATEGORY_TYPES)[number];

export const VALUATION_METHODS = [
  'FIFO',
  'WEIGHTED_AVG',
  'STANDARD_COST',
] as const;
export type ValuationMethod = (typeof VALUATION_METHODS)[number];

// ============================================================================
// TAB 1: UNIT OF MEASUREMENT DTOs (tbl_inv_uom)
// ============================================================================

export interface CreateUomDto {
  uomCode: string;
  uomName: string;
  uomType?: UomType;
  decimalPrecision?: number;
  gstUqcCode: string;
  isBaseUom?: boolean;
  isActive?: boolean;
}

export interface UpdateUomDto extends Partial<CreateUomDto> {}

// ============================================================================
// TAB 2: UOM CONVERSION MATRIX DTOs (tbl_inv_uom_conversion)
// ============================================================================

export interface CreateUomConversionDto {
  fromUomId: number;
  toUomId: number;
  conversionFactor: number;
  inverseFactor?: number;
  conversionType?: ConversionType;
  remarks?: string | null;
  createBidirectionalPair?: boolean;
  isActive?: boolean;
}

export interface UpdateUomConversionDto extends Partial<CreateUomConversionDto> {}

// ============================================================================
// TAB 3: ITEM CATEGORY HIERARCHY DTOs (tbl_inv_item_category)
// ============================================================================

export interface CreateItemCategoryDto {
  categoryCode: string;
  categoryName: string;
  parentCategoryId?: number | null;
  categoryType?: CategoryType;
  hsnSacCode?: string | null;
  defaultTaxRate?: number;
  defaultValuationMethod?: ValuationMethod;
  isLeaf?: boolean;
  isActive?: boolean;
}

export interface UpdateItemCategoryDto extends Partial<CreateItemCategoryDto> {}
