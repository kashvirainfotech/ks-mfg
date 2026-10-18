export interface RoutingFilterParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  itemId?: number;
  isDefault?: boolean;
}

export interface CreateRoutingOperationDto {
  routingOpId?: number;
  opSequence: number;
  opCode: string;
  opName: string;
  workCenterId: number;
  machineId?: number;
  setupTimeMins?: number;
  runTimeMins: number;
  overlapPercent?: number;
  machineHourlyRate?: number;
  laborHourlyRate?: number;
  overheadHourlyRate?: number;
  toolingDescription?: string;
  fixtureNo?: string;
  isInspectionRequired?: boolean;
  qcCheckpoints?: string;
  isSubcontracted?: boolean;
  subcontractVendorId?: number;
  remarks?: string;
}

export interface CreateRoutingDto {
  routingCode?: string;
  routingName: string;
  itemId: number;
  versionNo?: string;
  status?: string;
  isDefault?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  batchSize?: number;
  remarks?: string;
  operations: CreateRoutingOperationDto[];
}

export interface UpdateRoutingDto {
  routingName?: string;
  versionNo?: string;
  status?: string;
  isDefault?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  batchSize?: number;
  remarks?: string;
  operations?: CreateRoutingOperationDto[];
}

export interface ApproveRoutingDto {
  approvalRemarks?: string;
  setAsDefault?: boolean;
  syncToBom?: boolean;
}

export interface CloneRoutingDto {
  newVersionNo: string;
  newRoutingName?: string;
  copyOperations?: boolean;
}
