export interface CreateRoleDto {
  roleCode: string;
  roleName: string;
  roleDescription?: string | null;
  cloneFromRoleId?: number | null;
  isActive?: boolean;
}

export interface UpdateRoleDto {
  roleCode?: string;
  roleName?: string;
  roleDescription?: string | null;
  isActive?: boolean;
}

export interface RoleActionMatrixInput {
  actionId: number;
  isAllowed: boolean;
}

export interface RoleScreenMatrixInput {
  screenId: number;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  actions?: RoleActionMatrixInput[];
}

export interface UpdateRoleMatrixDto {
  screens: RoleScreenMatrixInput[];
}
