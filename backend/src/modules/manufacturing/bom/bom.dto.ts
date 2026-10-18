export type BomType =
  | 'MANUFACTURING'
  | 'SUBCONTRACTING'
  | 'ASSEMBLY'
  | 'DISASSEMBLY'
  | 'PROTOTYPE';

export type BomStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'OBSOLETE'
  | 'UNDER_REVIEW';

export type SourceType =
  | 'PURCHASED'
  | 'MANUFACTURED'
  | 'SUBCONTRACTED'
  | 'CUSTOMER_SUPPLIED';

export type ByProductType =
  | 'CO_PRODUCT'
  | 'BY_PRODUCT'
  | 'RECOVERABLE_SCRAP'
  | 'HAZARDOUS_WASTE';

export interface CreateBomItemDto {
  itemId: number;
  itemDescription?: string;
  uomId: number;
  quantity: number;
  scrapFactorPercent?: number;
  grossQuantity?: number;
  childBomId?: number;
  unitCost?: number;
  lineCost?: number;
  sourceType?: SourceType;
  operationSeq?: number;
  operationName?: string;
  isCritical?: boolean;
  remarks?: string;
}

export interface CreateBomByproductDto {
  itemId: number;
  itemDescription?: string;
  uomId: number;
  quantity: number;
  productType?: ByProductType;
  costAllocationPercent?: number;
  estimatedRecoveryRate?: number;
  estimatedRecoveryValue?: number;
  remarks?: string;
}

export interface CreateBomDto {
  bomCode?: string;
  bomName: string;
  itemId: number;
  uomId: number;
  outputQty?: number;
  versionNo?: string;
  bomType?: BomType;
  status?: BomStatus;
  isDefault?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  routingId?: number;
  totalMaterialCost?: number;
  totalLabourCost?: number;
  totalOverheadCost?: number;
  totalByproductRecovery?: number;
  netUnitCost?: number;
  remarks?: string;
  items: CreateBomItemDto[];
  byproducts?: CreateBomByproductDto[];
}

export interface UpdateBomDto {
  bomName?: string;
  outputQty?: number;
  versionNo?: string;
  bomType?: BomType;
  status?: BomStatus;
  isDefault?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  routingId?: number;
  totalMaterialCost?: number;
  totalLabourCost?: number;
  totalOverheadCost?: number;
  totalByproductRecovery?: number;
  netUnitCost?: number;
  remarks?: string;
  items?: CreateBomItemDto[];
  byproducts?: CreateBomByproductDto[];
}

export interface CloneBomDto {
  newVersionNo: string;
  newBomCode?: string;
  newBomName?: string;
  remarks?: string;
}

export interface ApproveBomDto {
  approvalRemarks?: string;
}

export interface BomFilterParams {
  status?: BomStatus;
  bomType?: BomType;
  itemId?: number;
  search?: string;
  isDefault?: boolean;
}
