export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeColor =
  | 'indigo'
  | 'blue'
  | 'emerald'
  | 'violet'
  | 'amber'
  | 'rose';

export type PermissionAction =
  | 'VIEW'
  | 'ADD'
  | 'EDIT'
  | 'DELETE'
  | 'PRINT'
  | 'EXPORT'
  | 'AUTHORIZE'
  | 'CANCEL'
  | 'REOPEN'
  | 'SUBMIT'
  | 'SEND'
  | 'FINALIZE'
  | 'RELEASE'
  | 'UNLOAD'
  | 'EXIT'
  | 'APPROVE'
  | 'REJECT'
  | 'ASSIGN'
  | 'CONFIRM'
  | 'CLONE'
  | 'EXPLODE'
  | 'MAINTENANCE'
  | 'RUN_MRP'
  | 'CONVERT'
  | 'CLOSE'
  | 'RETURN'
  | 'START'
  | 'COMPLETE'
  | 'DISPATCH'
  | 'RECEIVE'
  | 'RECONCILE'
  | 'POST'
  | 'CONVERT_TO_SO'
  | 'REVISE'
  | 'CREATE_WO'
  | 'HOLD'
  | 'PICK'
  | 'PACK'
  | 'GENERATE_IRN'
  | 'RECORD_PAYMENT'
  | 'INSPECT'
  | 'POST_CREDIT_NOTE'
  | 'RESTOCK'
  | 'LEDGER_DRILLDOWN'
  | 'REVALUE'
  | 'DRILLDOWN'
  | 'REGISTER_BATCH'
  | 'REGISTER_SERIAL';

export interface UserProfile {
  userId: number;
  username: string;
  email: string;
  mobile?: string | null;
  fullName: string;
  userCategory: 'SYSTEM' | 'EMPLOYEE' | 'PARTY';
  linkedEntityId: number | null;
  isSuperAdmin: boolean;
}

export interface CompanyInfo {
  compId: number;
  compCode: string;
  compName: string;
  legalName: string;
  gstin?: string | null;
  stateCode?: string | null;
  baseCurrencyCode: string;
}

export interface BranchInfo {
  branchId: number;
  compId: number;
  branchCode: string;
  branchName: string;
  branchType: string;
  city?: string | null;
  stateCode?: string | null;
  isHeadOffice: boolean;
}

export interface FinancialYearInfo {
  fyearId: number;
  compId: number;
  fyearCode: string;
  fyearName: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isClosed: boolean;
  isLocked: boolean;
  mappedBranchId?: number | null;
}

export interface ScreenPermission {
  screenId: number;
  screenCode: string;
  screenName: string;
  moduleName: string;
  routePath?: string | null;
  iconName?: string | null;
  displayOrder: number;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  allowedActions: string[];
}

export interface UserPreferences {
  userPreferenceId?: number;
  userId?: number;
  themeMode: ThemeMode;
  themeColor: ThemeColor;
  sidebarCollapsed: boolean;
  defaultCompId?: number | null;
  defaultBranchId?: number | null;
  defaultFyearId?: number | null;
}

export interface ActiveTenantContext {
  compId: number;
  branchId: number;
  fyearId: number;
}

export interface AuthSessionPayload {
  accessToken: string;
  refreshToken?: string;
  user: UserProfile;
  activeContext: ActiveTenantContext;
  preferences: UserPreferences;
  allowedCompanies: CompanyInfo[];
  allowedBranches: BranchInfo[];
  allowedFinancialYears: FinancialYearInfo[];
  permissions: ScreenPermission[];
}
