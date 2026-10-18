export const PR_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'CONVERTED',
  'CANCELLED',
] as const;
export type PrStatus = (typeof PR_STATUSES)[number];

export const PR_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL_URGENT'] as const;
export type PrPriority = (typeof PR_PRIORITIES)[number];

export const PR_TYPES = [
  'RAW_MATERIAL',
  'CAPITAL_ASSET',
  'CONSUMABLE_MRO',
  'TOOLING_SPARE',
  'JOB_WORK_SERVICE',
] as const;
export type PrType = (typeof PR_TYPES)[number];

export interface CreatePrItemDto {
  prItemId?: number;
  itemId: number;
  uomId: number;
  requiredQty: number;
  approvedQty?: number;
  estimatedRate: number;
  suggestedVendorId?: number | null;
  remarks?: string;
}

export interface CreateRequisitionDto {
  prNo?: string;
  prDate?: string;
  requiredByDate: string;
  departmentId: number;
  warehouseId: number;
  priority?: PrPriority;
  prType?: PrType;
  purpose: string;
  items: CreatePrItemDto[];
}

export interface UpdateRequisitionDto extends Partial<CreateRequisitionDto> {}

export interface AuthorizeRequisitionDto {
  action: 'APPROVE' | 'REJECT';
  remarks?: string;
  items?: {
    prItemId: number;
    approvedQty: number;
  }[];
}

export interface RequisitionFilterDto {
  status?: PrStatus;
  priority?: PrPriority;
  prType?: PrType;
  departmentId?: number;
  warehouseId?: number;
  search?: string;
}
