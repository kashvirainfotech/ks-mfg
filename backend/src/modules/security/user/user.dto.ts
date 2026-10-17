export type UserCategory = 'SYSTEM' | 'EMPLOYEE' | 'PARTY';

export interface UserCompanyRoleInput {
  mappedCompId: number;
  roleId: number;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface UserBranchRoleInput {
  mappedCompId: number;
  mappedBranchId: number;
  roleId: number;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface CreateUserDto {
  username: string;
  email: string;
  mobile?: string | null;
  password: string;
  fullName: string;
  userCategory?: UserCategory;
  linkedEntityId?: number | null;
  isSuperAdmin?: boolean;
  isActive?: boolean;
  companyRoles?: UserCompanyRoleInput[];
  branchRoles?: UserBranchRoleInput[];
}

export interface UpdateUserDto {
  username?: string;
  email?: string;
  mobile?: string | null;
  fullName?: string;
  userCategory?: UserCategory;
  linkedEntityId?: number | null;
  isSuperAdmin?: boolean;
  isActive?: boolean;
  companyRoles?: UserCompanyRoleInput[];
  branchRoles?: UserBranchRoleInput[];
}

export interface ResetUserPasswordDto {
  newPassword: string;
}

export interface UpdateUserRoleAssignmentsDto {
  companyRoles: UserCompanyRoleInput[];
  branchRoles: UserBranchRoleInput[];
}
