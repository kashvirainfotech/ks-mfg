export interface JobCardFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string; // 'PENDING', 'IN_PROGRESS', 'PAUSED', 'COMPLETED', 'CANCELLED'
  workCenterId?: number;
  machineId?: number;
  woId?: number;
  operatorId?: number;
  qcStatus?: string; // 'NA', 'PENDING', 'INSPECTION_IN_PROGRESS', 'ACCEPTED', 'REJECTED', 'DEVIATION_ACCEPTED'
  startDate?: string;
  endDate?: string;
}

export interface CreateJobCardDto {
  woId: number;
  woRoutingOpId: number;
  workCenterId: number;
  machineId?: number;
  assignedOperatorId?: number;
  plannedQty: number;
  inputQty?: number;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  isInspectionRequired?: boolean;
  remarks?: string;
}

export interface GenerateJobCardsFromWoDto {
  woId: number;
  remarks?: string;
}

export interface StartJobCardDto {
  operatorId?: number;
  machineId?: number;
  remarks?: string;
}

export interface LogTimeAndOutputDto {
  operatorId?: number;
  machineId?: number;
  setupMins?: number;
  runMins?: number;
  downtimeMins?: number;
  downtimeReason?: string;
  completedQty: number;
  scrappedQty?: number;
  reworkQty?: number;
  remarks?: string;
}

export interface InProcessQcDto {
  qcStatus: 'ACCEPTED' | 'REJECTED' | 'DEVIATION_ACCEPTED';
  sampleSize?: number;
  acceptedQty: number;
  rejectedQty?: number;
  qcRemarks?: string;
}

export interface CompleteJobCardDto {
  finalRemarks?: string;
}

export interface UpdateJobCardDto {
  workCenterId?: number;
  machineId?: number;
  assignedOperatorId?: number;
  scheduledStartDate?: string;
  scheduledEndDate?: string;
  remarks?: string;
}
