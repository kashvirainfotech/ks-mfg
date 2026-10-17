export interface CreateEmployeeDto {
  compId?: number;
  branchId?: number;
  empCode: string;
  firstName: string;
  lastName?: string | null;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: string | null;
  dateOfJoining: string;
  deptId: number;
  desigId: number;
  primaryBranchId: number;
  reportingManagerId?: number | null;
  employmentType?:
    | 'PERMANENT'
    | 'CONTRACT'
    | 'PROBATION'
    | 'TRAINEE'
    | 'CONSULTANT';
  employmentStatus?: 'ACTIVE' | 'ON_NOTICE' | 'SUSPENDED' | 'RELIEVED';
  workEmail?: string | null;
  mobileNo: string;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  bloodGroup?: string | null;
  panNo?: string | null;
  aadhaarMasked?: string | null;
  pfUanNo?: string | null;
  esiNo?: string | null;
  bankName?: string | null;
  bankAccountNo?: string | null;
  bankIfscCode?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  stateName?: string | null;
  pincode?: string | null;
  remarks?: string | null;
  isActive?: boolean;
}

export type UpdateEmployeeDto = Partial<CreateEmployeeDto>;
