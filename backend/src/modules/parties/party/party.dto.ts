export const PARTY_GROUPS = [
  'OEM_AUTOMOTIVE',
  'TIER_1_EXPORT',
  'HEAVY_ENGINEERING',
  'RAW_MATERIAL_VENDOR',
  'CONSUMABLE_VENDOR',
  'JOB_WORK_CONTRACTOR',
  'LOGISTICS_PARTNER',
] as const;
export type PartyGroup = (typeof PARTY_GROUPS)[number];

export const PAYMENT_TERMS = [
  'IMMEDIATE',
  'NET_15',
  'NET_30',
  'NET_45',
  'NET_60',
  'NET_90',
  'ADVANCE',
] as const;
export type PaymentTerms = (typeof PAYMENT_TERMS)[number];

export const GST_TREATMENT_TYPES = [
  'REGISTERED_REGULAR',
  'REGISTERED_COMPOSITION',
  'UNREGISTERED',
  'SEZ_DEVELOPER',
  'OVERSEAS_EXPORT',
] as const;
export type GstTreatmentType = (typeof GST_TREATMENT_TYPES)[number];

export const ADDRESS_TYPES = [
  'BILLING',
  'SHIPPING',
  'BOTH',
  'PLANT_SITE',
] as const;
export type AddressType = (typeof ADDRESS_TYPES)[number];

export interface CreatePartyAddressDto {
  addressId?: number;
  addressLabel?: string;
  addressType?: AddressType;
  gstin?: string;
  stateCode?: string;
  stateName?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  pincode: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  isDefaultBilling?: boolean;
  isDefaultShipping?: boolean;
  isActive?: boolean;
}

export interface CreatePartyDto {
  partyCode: string;
  partyName: string;
  tradeName?: string;
  isCustomer?: boolean;
  isSupplier?: boolean;
  isJobWorker?: boolean;
  isTransporter?: boolean;
  partyGroup?: PartyGroup;
  panNo?: string;
  msmeRegNo?: string;
  primaryContactName: string;
  primaryEmail?: string;
  primaryPhone: string;
  website?: string;
  creditLimit?: number;
  creditDays?: number;
  paymentTerms?: PaymentTerms;
  currencyCode?: string;
  gstTreatmentType?: GstTreatmentType;
  isActive?: boolean;
  remarks?: string;
  addresses?: CreatePartyAddressDto[];
}

export interface UpdatePartyDto extends Partial<CreatePartyDto> {}

export interface PartyFilterDto {
  isCustomer?: boolean;
  isSupplier?: boolean;
  isJobWorker?: boolean;
  isTransporter?: boolean;
  partyGroup?: string;
  isActive?: boolean;
  search?: string;
}
