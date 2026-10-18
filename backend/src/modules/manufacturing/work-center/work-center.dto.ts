export type WorkCenterType =
  | 'MACHINE'
  | 'LINE_ASSEMBLY'
  | 'MANUAL'
  | 'FURNACE'
  | 'TEST_BENCH'
  | 'SUBCONTRACTOR';

export type WorkCenterStatus = 'ACTIVE' | 'UNDER_MAINTENANCE' | 'INACTIVE';

export type MachineStatus =
  | 'OPERATIONAL'
  | 'BREAKDOWN'
  | 'STANDBY'
  | 'DECOMMISSIONED';

export interface CreateWorkCenterMachineDto {
  wcMachineId?: number;
  machineCode?: string;
  machineName: string;
  modelNo?: string;
  serialNo?: string;
  manufacturer?: string;
  installationDate?: string;
  warrantyExpiryDate?: string;
  powerRatingKw?: number;
  status?: MachineStatus;
  lastMaintenanceDate?: string;
  nextMaintenanceDue?: string;
  remarks?: string;
}

export interface CreateWorkCenterShiftDto {
  wcShiftId?: number;
  shiftId: number;
  daysOfWeek?: string;
  operatorCount?: number;
  remarks?: string;
}

export interface CreateWorkCenterDto {
  workCenterCode?: string;
  workCenterName: string;
  workCenterType?: WorkCenterType;
  deptId?: number;
  locationDesc?: string;
  capacityPerDayHours?: number;
  efficiencyPercent?: number;
  capacityUom?: string;
  costPerHour?: number;
  labourCostPerHour?: number;
  overheadCostPerHour?: number;
  status?: WorkCenterStatus;
  remarks?: string;
  machines?: CreateWorkCenterMachineDto[];
  shifts?: CreateWorkCenterShiftDto[];
}

export interface UpdateWorkCenterDto {
  workCenterName?: string;
  workCenterType?: WorkCenterType;
  deptId?: number;
  locationDesc?: string;
  capacityPerDayHours?: number;
  efficiencyPercent?: number;
  capacityUom?: string;
  costPerHour?: number;
  labourCostPerHour?: number;
  overheadCostPerHour?: number;
  status?: WorkCenterStatus;
  remarks?: string;
  machines?: CreateWorkCenterMachineDto[];
  shifts?: CreateWorkCenterShiftDto[];
}

export interface UpdateMachineStatusDto {
  status: MachineStatus;
  remarks?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDue?: string;
}

export interface WorkCenterFilterParams {
  status?: WorkCenterStatus;
  workCenterType?: WorkCenterType;
  deptId?: number;
  search?: string;
}

export interface CreateShiftDto {
  shiftCode: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  breakDurationMins?: number;
  effectiveWorkingHours?: number;
  isNightShift?: boolean;
  remarks?: string;
}
