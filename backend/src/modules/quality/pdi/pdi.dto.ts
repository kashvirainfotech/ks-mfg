export type PdiOverallVerdict =
  | 'PENDING'
  | 'APPROVED_FOR_DISPATCH'
  | 'REJECTED_QUARANTINE'
  | 'CONCESSION_ACCEPTED';

export type PdiDisposition =
  | 'CLEAR_FOR_INVOICE'
  | 'QUARANTINE_HOLD'
  | 'RETURN_TO_SHOPFLOOR'
  | 'SCRAP'
  | 'CONCESSION_USE_AS_IS';

export type PdiParamCategory =
  | 'DIMENSIONAL'
  | 'FUNCTIONAL_PRESSURE'
  | 'SURFACE_PAINT_DFT'
  | 'VISUAL_PACKAGING'
  | 'ELECTRICAL_ACTUATOR'
  | 'METALLURGICAL_HARDNESS';

export type PdiVisualResult = 'PASS' | 'FAIL' | 'NA';
export type PdiParamResult = 'PASS' | 'FAIL' | 'CONCESSION';
export type PdiStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';

export type PackagingCondition =
  | 'ACCEPTABLE'
  | 'DAMAGED_REPACK'
  | 'POOR_LABELING'
  | 'CRATE_HOLD';

export interface PdiParamDto {
  pdiParamId?: number;
  paramSequence: number;
  paramName: string;
  paramCategory: PdiParamCategory;
  instrumentName?: string;
  nominalVal?: number | null;
  minTolerance?: number | null;
  maxTolerance?: number | null;
  uomCode?: string;
  observedVal1?: number | null;
  observedVal2?: number | null;
  observedVal3?: number | null;
  observedVal4?: number | null;
  observedVal5?: number | null;
  meanVal?: number | null;
  visualResult?: PdiVisualResult;
  paramResult: PdiParamResult;
  notes?: string;
}

export interface PdiCoaSpecDto {
  coaSpecId?: number;
  elemCPct?: number;
  elemMnPct?: number;
  elemSiPct?: number;
  elemPPct?: number;
  elemSPct?: number;
  elemCrPct?: number;
  elemNiPct?: number;
  elemMoPct?: number;
  yieldStrengthMpa?: number;
  tensileStrengthMpa?: number;
  elongationPct?: number;
  hardnessVal?: string;
  impactEnergyJoules?: number;
  hydroShellTestBar?: number;
  hydroSeatTestBar?: number;
  airSeatTestBar?: number;
  ndeTestType?: string;
  ndeResult?: 'ACCEPTED' | 'REJECTED' | 'NA';
  labName?: string;
  certifiedEngineer?: string;
  certificationStandard?: string;
}

export interface CreatePdiDto {
  pdiNo?: string;
  pdiDate: string;
  salesOrderId?: number;
  customerId: number;
  woId?: number;
  challanId?: number;
  itemId: number;
  warehouseId: number;
  batchNo?: string;
  heatNo?: string;
  lotQty: number;
  sampleSize: number;
  acceptedQty?: number;
  rejectedQty?: number;
  reworkQty?: number;
  overallVerdict?: PdiOverallVerdict;
  disposition?: PdiDisposition;
  mtcNo?: string;
  standardSpecification?: string;
  packagingCondition?: PackagingCondition;
  labelingVerification?: PdiVisualResult;
  preservationCoating?: string;
  customerWitnessRequired?: boolean;
  customerWitnessName?: string;
  customerWitnessDate?: string;
  remarks?: string;
  deviationReason?: string;
  params: PdiParamDto[];
  coaSpec?: PdiCoaSpecDto;
}

export interface UpdatePdiDto {
  pdiDate?: string;
  salesOrderId?: number;
  customerId?: number;
  woId?: number;
  challanId?: number;
  itemId?: number;
  warehouseId?: number;
  batchNo?: string;
  heatNo?: string;
  lotQty?: number;
  sampleSize?: number;
  acceptedQty?: number;
  rejectedQty?: number;
  reworkQty?: number;
  overallVerdict?: PdiOverallVerdict;
  disposition?: PdiDisposition;
  mtcNo?: string;
  standardSpecification?: string;
  packagingCondition?: PackagingCondition;
  labelingVerification?: PdiVisualResult;
  preservationCoating?: string;
  customerWitnessRequired?: boolean;
  customerWitnessName?: string;
  customerWitnessDate?: string;
  remarks?: string;
  deviationReason?: string;
  params?: PdiParamDto[];
  coaSpec?: PdiCoaSpecDto;
}

export interface ApprovePdiDto {
  overallVerdict: PdiOverallVerdict;
  disposition: PdiDisposition;
  acceptedQty: number;
  rejectedQty: number;
  reworkQty?: number;
  deviationReason?: string;
  remarks?: string;
  isReleaseCoa?: boolean;
}

export interface ReleaseCoaDto {
  coaNo?: string;
  standardSpecification?: string;
  certifiedEngineer?: string;
  remarks?: string;
}

export interface PdiFilterDto {
  status?: PdiStatus;
  overallVerdict?: PdiOverallVerdict;
  customerId?: number;
  itemId?: number;
  warehouseId?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
}
