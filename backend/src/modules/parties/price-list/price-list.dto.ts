export const PRICE_LIST_TYPES = ['SALES', 'PURCHASE', 'JOB_WORK'] as const;
export type PriceListType = (typeof PRICE_LIST_TYPES)[number];

export interface CreatePriceListItemDto {
  priceListItemId?: number;
  itemId: number;
  uomId: number;
  minQty: number;
  maxQty?: number | null;
  baseRate: number;
  discountPct?: number;
  effectiveRate?: number;
  leadTimeDays?: number;
  remarks?: string;
  isActive?: boolean;
}

export interface CreatePriceListDto {
  priceListCode: string;
  priceListName: string;
  priceListType: PriceListType;
  currencyCode?: string;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo?: string | null;
  isDefault?: boolean;
  description?: string;
  isActive?: boolean;
  items?: CreatePriceListItemDto[];
  assignedPartyIds?: number[];
}

export interface UpdatePriceListDto extends Partial<CreatePriceListDto> {}

export interface PriceListFilterDto {
  priceListType?: PriceListType;
  isActive?: boolean;
  search?: string;
}

export interface PriceLookupQueryDto {
  priceListId?: number;
  partyId?: number;
  itemId: number;
  qty: number;
}
