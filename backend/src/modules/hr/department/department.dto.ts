export type DepartmentCategory =
  | 'PRODUCTION'
  | 'QUALITY'
  | 'SUPPLY_CHAIN'
  | 'ENGINEERING'
  | 'MAINTENANCE'
  | 'FINANCE_HR'
  | 'SALES_ADMIN';

export interface CreateDepartmentDto {
  compId: number;
  branchId?: number;
  deptCode: string;
  deptName: string;
  deptCategory: DepartmentCategory;
  parentDeptId?: number | null;
  hodEmployeeId?: number | null;
  costCenterCode?: string | null;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateDepartmentDto extends Partial<CreateDepartmentDto> {}

export interface CreateDesignationDto {
  compId: number;
  branchId?: number;
  desigCode: string;
  desigName: string;
  deptId?: number | null;
  gradeCode: string;
  hierarchyLevel: number;
  description?: string | null;
  isActive?: boolean;
}

export interface UpdateDesignationDto extends Partial<CreateDesignationDto> {}
