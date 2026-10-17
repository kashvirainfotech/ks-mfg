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
          allowedCompanies: [],
          allowedBranches: [],
          allowedFinancialYears: [],
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
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken === 'demo-local-jwt-token') {
          state.clearSession();
        }
      },
    },
  ),
);
