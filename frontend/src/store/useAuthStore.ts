import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  ActiveTenantContext,
  AuthSessionPayload,
  BranchInfo,
  CompanyInfo,
  FinancialYearInfo,
  PermissionAction,
  ScreenPermission,
  UserProfile,
} from '../types/auth.types';

interface AuthState {
  accessToken: string | null;
  user: UserProfile | null;
  activeContext: ActiveTenantContext;
  allowedCompanies: CompanyInfo[];
  allowedBranches: BranchInfo[];
  allowedFinancialYears: FinancialYearInfo[];
  permissions: ScreenPermission[];
  isAuthenticated: boolean;

  setSession: (payload: AuthSessionPayload) => void;
  updateContext: (
    ctx: ActiveTenantContext,
    accessToken?: string,
    permissions?: ScreenPermission[],
  ) => void;
  clearSession: () => void;
  hasPermission: (screenCode: string, action?: PermissionAction) => boolean;
  isCurrentFyearLocked: () => boolean;
}

export const DEFAULT_DEMO_SESSION: AuthSessionPayload = {
  accessToken: 'demo-local-jwt-token',
  user: {
    userId: 1001,
    username: 'admin',
    email: 'admin@ksmfg.com',
    mobile: '+91-9876543210',
    fullName: 'Rajesh Patel (Super Admin)',
    userCategory: 'SYSTEM',
    linkedEntityId: null,
    isSuperAdmin: true,
  },
  activeContext: {
    compId: 1001,
    branchId: 1001,
    fyearId: 1001,
  },
  preferences: {
    themeMode: 'light',
    themeColor: 'indigo',
    sidebarCollapsed: false,
    defaultCompId: 1001,
    defaultBranchId: 1001,
    defaultFyearId: 1001,
  },
  allowedCompanies: [
    {
      compId: 1001,
      compCode: 'KSMFG',
      compName: 'Kashvira Manufacturing ERP',
      legalName: 'Kashvira Precision Manufacturing Pvt. Ltd.',
      gstin: '24AABCK1234F1Z5',
      stateCode: '24',
      baseCurrencyCode: 'INR',
    },
    {
      compId: 1002,
      compCode: 'KSAUTO',
      compName: 'Kashvira Auto Components',
      legalName: 'Kashvira Auto Components Pvt. Ltd.',
      gstin: '27AABCK9999K1Z2',
      stateCode: '27',
      baseCurrencyCode: 'INR',
    },
  ],
  allowedBranches: [
    {
      branchId: 1001,
      compId: 1001,
      branchCode: 'PLT-AHM-01',
      branchName: 'Ahmedabad Main Plant & HO',
      branchType: 'PLANT',
      city: 'Ahmedabad',
      stateCode: '24',
      isHeadOffice: true,
    },
    {
      branchId: 1002,
      compId: 1001,
      branchCode: 'PLT-RAJ-02',
      branchName: 'Rajkot CNC & Foundry Unit',
      branchType: 'PLANT',
      city: 'Rajkot',
      stateCode: '24',
      isHeadOffice: false,
    },
    {
      branchId: 1003,
      compId: 1002,
      branchCode: 'PLT-PNQ-01',
      branchName: 'Pune Chakan Assembly Plant',
      branchType: 'PLANT',
      city: 'Pune',
      stateCode: '27',
      isHeadOffice: true,
    },
  ],
  allowedFinancialYears: [
    {
      fyearId: 1001,
      compId: 1001,
      fyearCode: '2026-27',
      fyearName: 'FY 2026-2027',
      startDate: '2026-04-01',
      endDate: '2027-03-31',
      isCurrent: true,
      isClosed: false,
      isLocked: false,
      mappedBranchId: 1001,
    },
    {
      fyearId: 1002,
      compId: 1001,
      fyearCode: '2025-26',
      fyearName: 'FY 2025-2026 (Locked)',
      startDate: '2025-04-01',
      endDate: '2026-03-31',
      isCurrent: false,
      isClosed: false,
      isLocked: true,
      mappedBranchId: 1001,
    },
    {
      fyearId: 1003,
      compId: 1002,
      fyearCode: '2026-27',
      fyearName: 'FY 2026-2027',
      startDate: '2026-04-01',
      endDate: '2027-03-31',
      isCurrent: true,
      isClosed: false,
      isLocked: false,
      mappedBranchId: 1003,
    },
  ],
  permissions: [
    {
      screenId: 1001,
      screenCode: 'DASHBOARD',
      screenName: 'Plant Operations Dashboard',
      moduleName: 'DASHBOARD',
      routePath: '/dashboard',
      iconName: 'LayoutDashboard',
      displayOrder: 1,
      canView: true,
      canAdd: true,
      canEdit: true,
      canDelete: true,
      allowedActions: ['EXPORT'],
    },
    {
      screenId: 1014,
      screenCode: 'PARTY_MASTER',
      screenName: 'Customer & Supplier Master',
      moduleName: 'CRM_SRM',
      routePath: '/parties/master',
      iconName: 'Users',
      displayOrder: 14,
      canView: true,
      canAdd: true,
      canEdit: true,
      canDelete: true,
      allowedActions: ['EXPORT', 'PRINT'],
    },
  ],
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      activeContext: {
        compId: 1001,
        branchId: 1001,
        fyearId: 1001,
      },
      allowedCompanies: [],
      allowedBranches: [],
      allowedFinancialYears: [],
      permissions: [],
      isAuthenticated: false,

      setSession: (payload) =>
        set({
          accessToken: payload.accessToken,
          user: payload.user,
          activeContext: payload.activeContext,
          allowedCompanies: payload.allowedCompanies,
          allowedBranches: payload.allowedBranches,
          allowedFinancialYears: payload.allowedFinancialYears,
          permissions: payload.permissions,
          isAuthenticated: true,
        }),

      updateContext: (ctx, accessToken, permissions) =>
        set((state) => ({
          activeContext: ctx,
          accessToken: accessToken ?? state.accessToken,
          permissions: permissions ?? state.permissions,
        })),

      clearSession: () =>
        set({
          accessToken: null,
          user: null,
          isAuthenticated: false,
          permissions: [],
        }),

      hasPermission: (screenCode, action = 'VIEW') => {
        const state = get();
        if (!state.user) return false;
        if (state.user.isSuperAdmin) return true;

        const perm = state.permissions.find(
          (p) => p.screenCode === screenCode,
        );
        if (!perm) return false;

        switch (action) {
          case 'VIEW':
            return perm.canView;
          case 'ADD':
            return perm.canAdd;
          case 'EDIT':
            return perm.canEdit;
          case 'DELETE':
            return perm.canDelete;
          default:
            return perm.allowedActions.includes(action);
        }
      },

      isCurrentFyearLocked: () => {
        const state = get();
        const fy = state.allowedFinancialYears.find(
          (f) =>
            f.fyearId === state.activeContext.fyearId &&
            (f.mappedBranchId === null ||
              f.mappedBranchId === undefined ||
              f.mappedBranchId === state.activeContext.branchId),
        );
        return Boolean(fy?.isLocked || fy?.isClosed);
      },
    }),
    {
      name: 'ksmfg-auth-session',
    },
  ),
);
