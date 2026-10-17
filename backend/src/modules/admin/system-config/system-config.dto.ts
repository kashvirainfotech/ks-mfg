export type ConfigGroupType =
  | 'INVENTORY_VALUATION'
  | 'PRODUCTION_SHOPFLOOR'
  | 'QUALITY_CONTROL'
  | 'PROCUREMENT_APPROVAL'
  | 'GST_STATUTORY'
  | 'SECURITY_SESSION';

export type ConfigDataType = 'BOOLEAN' | 'NUMBER' | 'STRING' | 'ENUM' | 'JSON';

export type ConfigScopeLevel = 'GLOBAL' | 'COMPANY' | 'BRANCH';

export interface CreateSystemConfigDto {
  configKey: string;
  configName: string;
  configGroup: ConfigGroupType;
  dataType: ConfigDataType;
  configValue: string;
  defaultValue: string;
  allowedValues?: string | null;
  scopeLevel: ConfigScopeLevel;
  targetCompId?: number | null;
  targetBranchId?: number | null;
  description?: string | null;
  isSystemLocked?: boolean;
  isActive?: boolean;
}

export interface UpdateSystemConfigDto extends Partial<CreateSystemConfigDto> {}

export type DocSeriesModuleType =
  | 'PROCUREMENT'
  | 'INVENTORY_WMS'
  | 'QUALITY'
  | 'PRODUCTION'
  | 'SALES_DISPATCH';

export type DocSeriesResetFrequency = 'FYEAR' | 'MONTHLY' | 'NEVER';

export interface CreateDocNumberSeriesDto {
  seriesCode: string;
  seriesName: string;
  docTypeCode: string;
  docTypeName: string;
  moduleName: DocSeriesModuleType;
  targetCompId: number;
  targetBranchId: number;
  targetFyearId: number;
  prefixTemplate: string;
  suffixTemplate?: string | null;
  separatorChar?: string;
  paddingDigits: number;
  startingNo: number;
  currentNextNo: number;
  resetFrequency: DocSeriesResetFrequency;
  allowManualOverride?: boolean;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UpdateDocNumberSeriesDto
  extends Partial<CreateDocNumberSeriesDto> {}
