export type GaugeType =
  | 'VERNIER_CALIPER'
  | 'MICROMETER'
  | 'DIAL_INDICATOR'
  | 'PRESSURE_GAUGE'
  | 'TORQUE_WRENCH'
  | 'TEMPERATURE_CONTROLLER'
  | 'HARDNESS_TESTER'
  | 'CMM_PROBE'
  | 'HEIGHT_GAUGE'
  | 'BORE_GAUGE'
  | 'SURFACE_ROUGHNESS_TESTER';

export type GaugeStatus =
  | 'VALID'
  | 'CALIBRATION_DUE'
  | 'OVERDUE'
  | 'UNDER_CALIBRATION'
  | 'OUT_OF_TOLERANCE_LOCKOUT'
  | 'SCRAPPED';

export type CalibrationAgencyType = 'INTERNAL_LAB' | 'NABL_EXTERNAL_LAB' | 'OEM_MANUFACTURER';

export type CalibrationResult = 'PASS' | 'PASS_WITH_CORRECTION' | 'FAIL_OUT_OF_TOLERANCE';

export interface CreateGaugeDto {
  gaugeCode?: string;
  gaugeName: string;
  gaugeType: GaugeType;
  makeManufacturer: string;
  modelNo?: string;
  serialNo: string;
  rangeMin: number;
  rangeMax: number;
  uom: string;
  leastCount: number;
  maxPermissibleError: number;
  locationCustody: string;
  custodianId?: number;
  calibrationFrequencyDays: number;
  lastCalibrationDate: string;
  calibrationAgencyType?: CalibrationAgencyType;
  agencyName?: string;
  calibrationCertificateNo?: string;
  remarks?: string;
}

export interface UpdateGaugeDto {
  gaugeName?: string;
  gaugeType?: GaugeType;
  makeManufacturer?: string;
  modelNo?: string;
  serialNo?: string;
  rangeMin?: number;
  rangeMax?: number;
  uom?: string;
  leastCount?: number;
  maxPermissibleError?: number;
  locationCustody?: string;
  custodianId?: number;
  calibrationFrequencyDays?: number;
  calibrationAgencyType?: CalibrationAgencyType;
  agencyName?: string;
  currentStatus?: GaugeStatus;
  remarks?: string;
}

export interface LogCalibrationEventDto {
  calibrationDate: string;
  certificateNo: string;
  calibratedByAgency: string;
  calibratorName: string;
  masterInstrumentTraceability: string;
  nominalValue: number;
  observedValue: number;
  errorVal: number;
  permissibleTolerance: number;
  calibrationResult: CalibrationResult;
  nextDueDate?: string;
  environmentalConditions?: string;
  certificateUrl?: string;
  remarks?: string;
}

export interface LockoutGaugeDto {
  lockoutReason: string;
  newStatus?: 'OUT_OF_TOLERANCE_LOCKOUT' | 'SCRAPPED';
}

export interface CalibrationFilterDto {
  status?: string;
  gaugeType?: string;
  agencyType?: string;
  isOverdueOnly?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}
