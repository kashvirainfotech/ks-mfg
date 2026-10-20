export type InspectionStage =
  | 'FIRST_PIECE'
  | 'PATROL_INSPECTION'
  | 'STAGE_COMPLETION'
  | 'LAST_PIECE';

export type OverallResult =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ACCEPTED_UNDER_DEVIATION';

export type DispositionType =
  | 'DIRECT_ACCEPT'
  | 'SCRAP'
  | 'REWORK_SAME_OP'
  | 'REWORK_NEW_OP'
  | 'CONCESSION_USE_AS_IS';

export type ParamCategory =
  | 'DIMENSIONAL'
  | 'METALLURGICAL'
  | 'SURFACE_FINISH'
  | 'VISUAL'
  | 'FUNCTIONAL'
  | 'TORQUE_TENSION';

export type VisualResult = 'PASS' | 'FAIL' | 'NA';

export type ParamResult = 'PASS' | 'FAIL' | 'CONCESSION';

export type InspectionStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface InProcessQcParamDto {
  ipqcParamId?: number;
  paramSequence: number;
  paramName: string;
  paramCategory: ParamCategory;
  instrumentName?: string;
  nominalVal?: number;
  minTolerance?: number;
  maxTolerance?: number;
  uomCode?: string;
  obsVal1?: number;
  obsVal2?: number;
  obsVal3?: number;
  obsVal4?: number;
  obsVal5?: number;
  meanVal?: number;
  visualResult?: VisualResult;
  paramResult: ParamResult;
  deviationRemarks?: string;
}

export interface CreateInProcessQcDto {
  ipqcNo?: string;
  ipqcDate: string;
  woId: number;
  jobCardId?: number;
  woRoutingOpId?: number;
  itemId: number;
  workCenterId?: number;
  machineId?: number;
  assignedOperatorId?: number;
  inspectorId: number;
  inspectionStage: InspectionStage;
  shiftName: string;
  batchNo?: string;
  heatNo?: string;
  lotQty: number;
  sampleSize: number;
  acceptedQty?: number;
  rejectedQty?: number;
  reworkQty?: number;
  overallResult?: OverallResult;
  dispositionType?: DispositionType;
  deviationReason?: string;
  isCapaRequired?: boolean;
  ncrNo?: string;
  remarks?: string;
  params: InProcessQcParamDto[];
}

export interface UpdateInProcessQcDto {
  ipqcDate?: string;
  woId?: number;
  jobCardId?: number;
  woRoutingOpId?: number;
  itemId?: number;
  workCenterId?: number;
  machineId?: number;
  assignedOperatorId?: number;
  inspectorId?: number;
  inspectionStage?: InspectionStage;
  shiftName?: string;
  batchNo?: string;
  heatNo?: string;
  lotQty?: number;
  sampleSize?: number;
  acceptedQty?: number;
  rejectedQty?: number;
  reworkQty?: number;
  overallResult?: OverallResult;
  dispositionType?: DispositionType;
  deviationReason?: string;
  isCapaRequired?: boolean;
  ncrNo?: string;
  remarks?: string;
  params?: InProcessQcParamDto[];
}

export interface ApproveInProcessQcDto {
  overallResult: OverallResult;
  acceptedQty: number;
  rejectedQty: number;
  reworkQty?: number;
  dispositionType: DispositionType;
  deviationReason?: string;
  isCapaRequired?: boolean;
  ncrNo?: string;
  remarks?: string;
}

export interface GrantDeviationDto {
  deviationReason: string;
  dispositionType?: DispositionType;
  remarks?: string;
}

export interface InProcessQcFilterDto {
  status?: InspectionStatus;
  overallResult?: OverallResult;
  inspectionStage?: InspectionStage;
  woId?: number;
  jobCardId?: number;
  itemId?: number;
  workCenterId?: number;
  search?: string;
  startDate?: string;
  endDate?: string;
}
