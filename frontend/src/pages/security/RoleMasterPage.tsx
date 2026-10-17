import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  Copy,
  Edit3,
  Filter,
  KeyRound,
  Lock,
  Save,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Square,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import {
  MasterDataTable,
  type GroupByOption,
  type MasterTableColumn,
} from '../../components/common/MasterDataTable';
import {
  ConfirmDeleteModal,
  type DependencyConflictItem,
} from '../../components/common/ConfirmDeleteModal';
import { PermissionGate } from '../../components/common/PermissionGate';
import { apiClient } from '../../lib/apiClient';

export interface RoleEntity {
  roleId: number;
  roleCode: string;
  roleName: string;
  roleDescription: string | null;
  isSystemRole: boolean;
  isActive: boolean;
  grantedScreenCount: number;
  totalScreenCount: number;
  grantedActionCount: number;
  assignedUserCount: number;
  createdDate: string;
  updatedDate: string | null;
}

export interface RoleActionPermissionItem {
  actionId: number;
  screenId: number;
  actionCode: string;
  actionName: string;
  isAllowed: boolean;
}

export interface RoleScreenPermissionItem {
  screenId: number;
  screenCode: string;
  screenName: string;
  moduleName: string;
  routePath: string | null;
  displayOrder: number;
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  actions: RoleActionPermissionItem[];
}

const EMPTY_ROLE_FORM = {
  roleCode: '',
  roleName: '',
  roleDescription: '',
  cloneFromRoleId: '' as string | number,
  isActive: true,
};

export const RoleMasterPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'ROLES' | 'MATRIX'>('ROLES');

  // Roles list state
  const [roles, setRoles] = useState<RoleEntity[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(false);
  const [roleTypeFilter, setRoleTypeFilter] = useState<
    'ALL' | 'SYSTEM' | 'CUSTOM'
  >('ALL');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'INACTIVE'
  >('ALL');

  // Matrix state
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [matrixRole, setMatrixRole] = useState<RoleEntity | null>(null);
  const [matrixScreens, setMatrixScreens] = useState<
    RoleScreenPermissionItem[]
  >([]);
  const [isLoadingMatrix, setIsLoadingMatrix] = useState(false);
  const [isSavingMatrix, setIsSavingMatrix] = useState(false);
  const [isMatrixDirty, setIsMatrixDirty] = useState(false);
  const [matrixModuleFilter, setMatrixModuleFilter] = useState<string>('ALL');
  const [matrixSearchQuery, setMatrixSearchQuery] = useState<string>('');

  // Feedback banner
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Create / Edit Role Modal state
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleEntity | null>(null);
  const [roleForm, setRoleForm] = useState(EMPTY_ROLE_FORM);
  const [roleFormError, setRoleFormError] = useState<string | null>(null);
  const [isSavingRole, setIsSavingRole] = useState(false);

  // Delete Role Modal state
  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    code: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDependencies, setDeleteDependencies] = useState<
    DependencyConflictItem[]
  >([]);

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isRoleModalOpen && !isSavingRole) {
        setIsRoleModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRoleModalOpen, isSavingRole]);

  const fetchRoles = async (preferredRoleId?: number) => {
    setIsLoadingRoles(true);
    try {
      const res = await apiClient.get('/security/roles');
      const data: RoleEntity[] = res.data?.data ?? res.data ?? [];
      const list = Array.isArray(data) ? data : [];
      setRoles(list);

      const targetId =
        preferredRoleId ??
        selectedRoleId ??
        (list.length > 0 ? list[0].roleId : null);
      if (targetId) {
        setSelectedRoleId(targetId);
      }
    } catch (err: any) {
      setRoles([]);
      setBannerMessage({
        type: 'error',
        text:
          err?.response?.data?.error?.message ||
          'Failed to load Global Roles from the database.',
      });
    } finally {
      setIsLoadingRoles(false);
    }
  };

  const fetchRoleMatrix = async (roleId: number) => {
    setIsLoadingMatrix(true);
    try {
      const res = await apiClient.get(`/security/roles/${roleId}/matrix`);
      const payload = res.data?.data ?? res.data;
      if (payload?.role && Array.isArray(payload?.screens)) {
        setMatrixRole(payload.role);
        setMatrixScreens(payload.screens);
        setIsMatrixDirty(false);
      }
    } catch (err: any) {
      setBannerMessage({
        type: 'error',
        text:
          err?.response?.data?.error?.message ||
          'Failed to load Role Permission Matrix from the server.',
      });
    } finally {
      setIsLoadingMatrix(false);
    }
  };

  useEffect(() => {
    void fetchRoles();
  }, []);

  useEffect(() => {
    if (selectedRoleId) {
      void fetchRoleMatrix(selectedRoleId);
    }
  }, [selectedRoleId]);

  // Filtered Roles for Table
  const filteredRoles = useMemo(() => {
    return roles.filter((r) => {
      if (roleTypeFilter === 'SYSTEM' && !r.isSystemRole) return false;
      if (roleTypeFilter === 'CUSTOM' && r.isSystemRole) return false;
      if (statusFilter === 'ACTIVE' && !r.isActive) return false;
      if (statusFilter === 'INACTIVE' && r.isActive) return false;
      return true;
    });
  }, [roles, roleTypeFilter, statusFilter]);

  // KPI Summary Metrics
  const kpiStats = useMemo(() => {
    const totalRoles = roles.length;
    const systemRoles = roles.filter((r) => r.isSystemRole).length;
    const customRoles = roles.filter((r) => !r.isSystemRole).length;
    const totalUserMappings = roles.reduce(
      (acc, r) => acc + r.assignedUserCount,
      0,
    );
    return { totalRoles, systemRoles, customRoles, totalUserMappings };
  }, [roles]);

  // Open Role Modal Handlers
  const openCreateRoleModal = () => {
    setEditingRole(null);
    setRoleForm(EMPTY_ROLE_FORM);
    setRoleFormError(null);
    setIsRoleModalOpen(true);
  };

  const openEditRoleModal = (role: RoleEntity) => {
    setEditingRole(role);
    setRoleForm({
      roleCode: role.roleCode,
      roleName: role.roleName,
      roleDescription: role.roleDescription || '',
      cloneFromRoleId: '',
      isActive: role.isActive,
    });
    setRoleFormError(null);
    setIsRoleModalOpen(true);
  };

  const openConfigureMatrix = (role: RoleEntity) => {
    setSelectedRoleId(role.roleId);
    setActiveTab('MATRIX');
  };

  const handleSaveRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoleFormError(null);

    if (!roleForm.roleCode.trim() || !roleForm.roleName.trim()) {
      setRoleFormError('Role Code and Role Name are mandatory.');
      return;
    }

    setIsSavingRole(true);
    try {
      if (editingRole) {
        await apiClient.put(`/security/roles/${editingRole.roleId}`, {
          roleCode: roleForm.roleCode.trim().toUpperCase(),
          roleName: roleForm.roleName.trim(),
          roleDescription: roleForm.roleDescription.trim() || null,
          isActive: roleForm.isActive,
        });
        await fetchRoles(editingRole.roleId);
        setBannerMessage({
          type: 'success',
          text: `Role "${roleForm.roleName.trim()}" (${roleForm.roleCode.trim().toUpperCase()}) updated successfully.`,
        });
      } else {
        const res = await apiClient.post('/security/roles', {
          roleCode: roleForm.roleCode.trim().toUpperCase(),
          roleName: roleForm.roleName.trim(),
          roleDescription: roleForm.roleDescription.trim() || null,
          cloneFromRoleId: roleForm.cloneFromRoleId
            ? Number(roleForm.cloneFromRoleId)
            : null,
          isActive: roleForm.isActive,
        });
        const created: RoleEntity = res.data?.data ?? res.data;
        await fetchRoles(created?.roleId);
        setBannerMessage({
          type: 'success',
          text: `Role "${roleForm.roleName.trim()}" (${roleForm.roleCode.trim().toUpperCase()}) created successfully.`,
        });
      }
      setIsRoleModalOpen(false);
    } catch (err: any) {
      setRoleFormError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Failed to save role.',
      );
    } finally {
      setIsSavingRole(false);
    }
  };

  const handleConfirmDeleteRole = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    setDeleteDependencies([]);

    try {
      await apiClient.delete(`/security/roles/${deleteTarget.id}`);
      const deletedLabel = `${deleteTarget.name} (${deleteTarget.code})`;
      setDeleteTarget(null);
      await fetchRoles(roles[0]?.roleId);
      setBannerMessage({
        type: 'success',
        text: `Role "${deletedLabel}" deleted permanently.`,
      });
    } catch (err: any) {
      const errPayload = err?.response?.data?.error;
      const conflicts: DependencyConflictItem[] =
        errPayload?.details?.dependencies || [];
      setDeleteDependencies(conflicts);
      setDeleteError(
        errPayload?.message ||
          'Cannot delete this role because dependent records exist.',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // ==========================================================================
  // Matrix Interactive Toggle Handlers
  // ==========================================================================

  const toggleScreenFlag = (
    screenId: number,
    field: 'canView' | 'canAdd' | 'canEdit' | 'canDelete',
  ) => {
    setMatrixScreens((prev) =>
      prev.map((s) => {
        if (s.screenId !== screenId) return s;
        const nextVal = !s[field];

        if (field === 'canView' && !nextVal) {
          // Turning off VIEW clears ADD, EDIT, DELETE, and all custom actions on this screen
          return {
            ...s,
            canView: false,
            canAdd: false,
            canEdit: false,
            canDelete: false,
            actions: s.actions.map((a) => ({ ...a, isAllowed: false })),
          };
        }

        // Turning on ADD/EDIT/DELETE automatically enables VIEW
        return {
          ...s,
          [field]: nextVal,
          canView: nextVal ? true : s.canView,
        };
      }),
    );
    setIsMatrixDirty(true);
  };

  const toggleScreenAllRow = (screenId: number) => {
    setMatrixScreens((prev) =>
      prev.map((s) => {
        if (s.screenId !== screenId) return s;
        const allCurrentlyGranted =
          s.canView &&
          s.canAdd &&
          s.canEdit &&
          s.canDelete &&
          s.actions.every((a) => a.isAllowed);

        const nextState = !allCurrentlyGranted;
        return {
          ...s,
          canView: nextState,
          canAdd: nextState,
          canEdit: nextState,
          canDelete: nextState,
          actions: s.actions.map((a) => ({ ...a, isAllowed: nextState })),
        };
      }),
    );
    setIsMatrixDirty(true);
  };

  const toggleActionPermission = (screenId: number, actionId: number) => {
    setMatrixScreens((prev) =>
      prev.map((s) => {
        if (s.screenId !== screenId) return s;
        const updatedActions = s.actions.map((a) =>
          a.actionId === actionId ? { ...a, isAllowed: !a.isAllowed } : a,
        );
        const anyAllowed = updatedActions.some((a) => a.isAllowed);
        return {
          ...s,
          canView: anyAllowed ? true : s.canView,
          actions: updatedActions,
        };
      }),
    );
    setIsMatrixDirty(true);
  };

  const applyBulkPreset = (
    preset: 'VIEW_ONLY' | 'FULL_ACCESS' | 'CLEAR_ALL',
  ) => {
    setMatrixScreens((prev) =>
      prev.map((s) => {
        const isVisibleInFilter =
          matrixModuleFilter === 'ALL' || s.moduleName === matrixModuleFilter;
        if (!isVisibleInFilter) return s;

        if (preset === 'VIEW_ONLY') {
          return {
            ...s,
            canView: true,
            canAdd: false,
            canEdit: false,
            canDelete: false,
            actions: s.actions.map((a) => ({
              ...a,
              isAllowed: a.actionCode === 'PRINT' || a.actionCode === 'EXPORT',
            })),
          };
        }
        if (preset === 'FULL_ACCESS') {
          return {
            ...s,
            canView: true,
            canAdd: true,
            canEdit: true,
            canDelete: true,
            actions: s.actions.map((a) => ({ ...a, isAllowed: true })),
          };
        }
        return {
          ...s,
          canView: false,
          canAdd: false,
          canEdit: false,
          canDelete: false,
          actions: s.actions.map((a) => ({ ...a, isAllowed: false })),
        };
      }),
    );
    setIsMatrixDirty(true);
  };

  const handleSaveMatrix = async () => {
    if (!selectedRoleId) return;
    setIsSavingMatrix(true);
    setBannerMessage(null);

    try {
      const payload = {
        screens: matrixScreens.map((s) => ({
          screenId: s.screenId,
          canView: s.canView,
          canAdd: s.canAdd,
          canEdit: s.canEdit,
          canDelete: s.canDelete,
          actions: s.actions.map((a) => ({
            actionId: a.actionId,
            isAllowed: a.isAllowed,
          })),
        })),
      };

      const res = await apiClient.put(
        `/security/roles/${selectedRoleId}/matrix`,
        payload,
      );
      const updated = res.data?.data ?? res.data;
      if (updated?.role && Array.isArray(updated?.screens)) {
        setMatrixRole(updated.role);
        setMatrixScreens(updated.screens);
        setIsMatrixDirty(false);
      }
      await fetchRoles(selectedRoleId);
      setBannerMessage({
        type: 'success',
        text: `Granular Screen & Action Permissions saved for "${matrixRole?.roleName}" (${matrixRole?.roleCode}).`,
      });
    } catch (err: any) {
      setBannerMessage({
        type: 'error',
        text:
          err?.response?.data?.error?.message ||
          'Failed to save permission matrix.',
      });
    } finally {
      setIsSavingMatrix(false);
    }
  };

  // Distinct module names in matrix
  const matrixModules = useMemo(() => {
    const set = new Set<string>();
    matrixScreens.forEach((s) => set.add(s.moduleName));
    return Array.from(set);
  }, [matrixScreens]);

  const filteredMatrixScreens = useMemo(() => {
    const q = matrixSearchQuery.trim().toLowerCase();
    return matrixScreens.filter((s) => {
      if (matrixModuleFilter !== 'ALL' && s.moduleName !== matrixModuleFilter) {
        return false;
      }
      if (!q) return true;
      return (
        s.screenName.toLowerCase().includes(q) ||
        s.screenCode.toLowerCase().includes(q) ||
        s.moduleName.toLowerCase().includes(q) ||
        s.actions.some(
          (a) =>
            a.actionCode.toLowerCase().includes(q) ||
            a.actionName.toLowerCase().includes(q),
        )
      );
    });
  }, [matrixScreens, matrixModuleFilter, matrixSearchQuery]);

  // Export CSV
  const handleExportRolesCsv = async () => {
    try {
      await apiClient.post('/security/roles/action/EXPORT');
    } catch {
      // Non-blocking audit log
    }

    const headers = [
      'Role Code',
      'Role Name',
      'Role Type',
      'Description',
      'Granted Screens',
      'Total Screens',
      'Granted Custom Actions',
      'Assigned Users',
      'Status',
    ];
    const lines = [
      headers.join(','),
      ...filteredRoles.map((r) =>
        [
          r.roleCode,
          `"${(r.roleName || '').replace(/"/g, '""')}"`,
          r.isSystemRole ? 'SYSTEM' : 'CUSTOM',
          `"${(r.roleDescription || '').replace(/"/g, '""')}"`,
          r.grantedScreenCount,
          r.totalScreenCount,
          r.grantedActionCount,
          r.assignedUserCount,
          r.isActive ? 'ACTIVE' : 'INACTIVE',
        ].join(','),
      ),
    ];

    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KS_MFG_Global_Roles_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Columns for Role Directory
  const roleColumns: MasterTableColumn<RoleEntity>[] = useMemo(
    () => [
      {
        key: 'roleCode',
        header: 'Role Code',
        render: (row) => (
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-brand-600 dark:text-brand-400">
              {row.roleCode}
            </span>
            {row.isSystemRole && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Lock className="h-2.5 w-2.5" />
                SYSTEM
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'roleName',
        header: 'Role Title & Responsibility Scope',
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-semibold text-slate-900 dark:text-slate-100">
              {row.roleName}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
              {row.roleDescription || 'No description provided'}
            </span>
          </div>
        ),
      },
      {
        key: 'grantedScreenCount',
        header: 'Screen Access Coverage',
        render: (row) => {
          const pct =
            row.totalScreenCount > 0
              ? Math.round(
                  (row.grantedScreenCount / row.totalScreenCount) * 100,
                )
              : 0;
          return (
            <div className="w-44 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {row.grantedScreenCount} / {row.totalScreenCount} Screens
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  {pct}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-brand-600 dark:bg-brand-400 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        },
      },
      {
        key: 'grantedActionCount',
        header: 'Custom Actions',
        align: 'center',
        render: (row) => (
          <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/10 px-2.5 py-1 font-mono text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            <KeyRound className="h-3 w-3" />
            {row.grantedActionCount} Allowed
          </span>
        ),
      },
      {
        key: 'assignedUserCount',
        header: 'Assigned Users',
        align: 'center',
        render: (row) => (
          <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Users className="h-3 w-3 text-slate-400" />
            {row.assignedUserCount} User{row.assignedUserCount === 1 ? '' : 's'}
          </span>
        ),
      },
      {
        key: 'isActive',
        header: 'Status',
        align: 'center',
        render: (row) => (
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
              row.isActive
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : 'border-slate-500/20 bg-slate-500/10 text-slate-500'
            }`}
          >
            {row.isActive ? 'Active' : 'Inactive'}
          </span>
        ),
      },
    ],
    [],
  );

  const roleGroupByOptions: GroupByOption<RoleEntity>[] = [
    {
      key: 'roleType',
      label: 'Role Classification (System vs Custom)',
      groupValue: (r) =>
        r.isSystemRole ? 'Built-In System Roles' : 'Custom Enterprise Roles',
    },
    {
      key: 'status',
      label: 'Operational Status',
      groupValue: (r) => (r.isActive ? 'Active Roles' : 'Inactive Roles'),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top Header & Mode Switcher */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-semibold text-brand-600 dark:text-brand-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Phase 2 • Step 2.3 — Security & Granular RBAC Engine
            </span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Global Roles & Screen/Action Permissions Matrix
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Define reusable Global Roles (`tbl_sec_role`) independent of
            Company/Branch and configure fine-grained Screen (`VIEW`, `ADD`,
            `EDIT`, `DELETE`) & Action (`PRINT`, `EXPORT`, `AUTHORIZE`) rights.
          </p>
        </div>

        {/* Workspace Tab Switcher */}
        <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('ROLES')}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
              activeTab === 'ROLES'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Shield className="h-3.5 w-3.5" />
            1. Global Roles Directory ({roles.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('MATRIX')}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition cursor-pointer ${
              activeTab === 'MATRIX'
                ? 'bg-brand-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            2. Screen & Action Permissions Matrix
            {matrixRole ? ` (${matrixRole.roleCode})` : ''}
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Global Roles
            </span>
            <ShieldCheck className="h-4 w-4 text-brand-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
            {kpiStats.totalRoles}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Protected System Roles
            </span>
            <Lock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {kpiStats.systemRoles}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Custom Enterprise Roles
            </span>
            <KeyRound className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {kpiStats.customRoles}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Active User Role Mappings
            </span>
            <Users className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {kpiStats.totalUserMappings}
          </p>
        </div>
      </div>

      {/* Feedback Banner */}
      {bannerMessage && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs font-medium ${
            bannerMessage.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300'
          }`}
        >
          <span>{bannerMessage.text}</span>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="ml-4 rounded p-1 hover:bg-black/5 dark:hover:bg-white/5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ====================================================================
          TAB 1: GLOBAL ROLES DIRECTORY (`tbl_sec_role`)
          ==================================================================== */}
      {activeTab === 'ROLES' && (
        <MasterDataTable<RoleEntity>
          title="Global Security Roles Catalogue"
          subtitle="Roles are defined globally (`tbl_sec_role`) and mapped to Users at the Company or Branch/Plant level in Step 2.4."
          screenCode="ROLE_MASTER"
          tableNameBadge="tbl_sec_role"
          data={filteredRoles}
          rowKey={(r) => r.roleId}
          columns={roleColumns}
          isLoading={isLoadingRoles}
          addButtonLabel="Create Global Role"
          onAddClick={openCreateRoleModal}
          onExportClick={() => {
            void handleExportRolesCsv();
          }}
          onPrintClick={() => {
            void apiClient
              .post('/security/roles/action/PRINT')
              .catch(() => {});
            window.print();
          }}
          searchPlaceholder="Search by role code, role title, or responsibility description..."
          searchPredicate={(r, q) =>
            r.roleCode.toLowerCase().includes(q) ||
            r.roleName.toLowerCase().includes(q) ||
            (r.roleDescription || '').toLowerCase().includes(q)
          }
          groupByOptions={roleGroupByOptions}
          filterToolbarSlot={
            <>
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={roleTypeFilter}
                  onChange={(e) =>
                    setRoleTypeFilter(
                      e.target.value as 'ALL' | 'SYSTEM' | 'CUSTOM',
                    )
                  }
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200"
                >
                  <option value="ALL">All Role Types</option>
                  <option value="SYSTEM">Built-In System Roles</option>
                  <option value="CUSTOM">Custom Enterprise Roles</option>
                </select>
              </div>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE',
                  )
                }
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </>
          }
          renderRowActions={(row) => (
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => openConfigureMatrix(row)}
                title="Configure Screen & Action Permissions Matrix"
                className="inline-flex items-center gap-1 rounded-lg border border-brand-500/30 bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-500/20 dark:text-brand-400 transition cursor-pointer"
              >
                <Sliders className="h-3.5 w-3.5" />
                Matrix
              </button>

              <PermissionGate screen="ROLE_MASTER" action="EDIT">
                <button
                  type="button"
                  onClick={() => openEditRoleModal(row)}
                  title="Edit Role Metadata"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-brand-400 transition cursor-pointer"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              </PermissionGate>

              <PermissionGate screen="ROLE_MASTER" action="DELETE">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteDependencies([]);
                    setDeleteTarget({
                      id: row.roleId,
                      code: row.roleCode,
                      name: row.roleName,
                    });
                  }}
                  title="Delete Role (Pre-Checked by DependencyCheckService)"
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-500 transition cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </PermissionGate>
            </div>
          )}
        />
      )}

      {/* ====================================================================
          TAB 2: GRANULAR SCREEN & ACTION PERMISSIONS MATRIX
          ==================================================================== */}
      {activeTab === 'MATRIX' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          {/* Matrix Top Control Bar */}
          <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Target Global Role
                </label>
                <select
                  value={selectedRoleId || ''}
                  onChange={(e) => setSelectedRoleId(Number(e.target.value))}
                  className="mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-sm font-bold text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                >
                  {roles.map((r) => (
                    <option key={r.roleId} value={r.roleId}>
                      {r.roleCode} — {r.roleName}
                      {r.isSystemRole ? ' [SYSTEM]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  ERP Module Filter
                </label>
                <select
                  value={matrixModuleFilter}
                  onChange={(e) => setMatrixModuleFilter(e.target.value)}
                  className="mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:border-brand-500 focus:outline-none"
                >
                  <option value="ALL">All Modules ({matrixScreens.length})</option>
                  {matrixModules.map((mod) => (
                    <option key={mod} value={mod}>
                      {mod}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Quick Screen / Action Search
                </label>
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Filter screens or actions..."
                    value={matrixSearchQuery}
                    onChange={(e) => setMatrixSearchQuery(e.target.value)}
                    className="w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-8 pr-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Bulk Presets & Save Matrix Button */}
            <div className="flex flex-wrap items-center gap-2">
              <PermissionGate screen="ROLE_MASTER" action="EDIT">
                <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-1">
                  <button
                    type="button"
                    onClick={() => applyBulkPreset('VIEW_ONLY')}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Grant View + Export
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBulkPreset('FULL_ACCESS')}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-brand-600 hover:bg-white dark:text-brand-400 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Grant Full Access
                  </button>
                  <button
                    type="button"
                    onClick={() => applyBulkPreset('CLEAR_ALL')}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-white dark:text-rose-400 dark:hover:bg-slate-800 transition cursor-pointer"
                  >
                    Revoke All
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isSavingMatrix || !isMatrixDirty}
                  onClick={handleSaveMatrix}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-brand-500 disabled:opacity-50 transition cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  {isSavingMatrix
                    ? 'Saving Matrix...'
                    : isMatrixDirty
                      ? 'Save Permission Matrix *'
                      : 'Matrix Saved'}
                </button>
              </PermissionGate>
            </div>
          </div>

          {/* Super Admin Self-Lockout Protection Notice */}
          {matrixRole?.roleCode === 'SUPER_ADMIN' && (
            <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-5 py-2.5 text-xs font-medium text-amber-700 dark:text-amber-300">
              <ShieldAlert className="h-4 w-4 shrink-0" />
              <span>
                <strong>Super Admin Lockout Protection:</strong> Full CRUD
                access to <code className="font-mono">ROLE_MASTER</code> and{' '}
                <code className="font-mono">USER_MASTER</code> is permanently
                enforced for <code className="font-mono">SUPER_ADMIN</code> so
                administrators cannot lock themselves out.
              </span>
            </div>
          )}

          {/* Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4">Module</th>
                  <th className="py-3 px-4">Screen Name & Code</th>
                  <th className="py-3 px-3 text-center">Row All</th>
                  <th className="py-3 px-3 text-center">View</th>
                  <th className="py-3 px-3 text-center">Add</th>
                  <th className="py-3 px-3 text-center">Edit</th>
                  <th className="py-3 px-3 text-center">Delete</th>
                  <th className="py-3 px-4">
                    Granular Screen Actions (`tbl_sec_action`)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70 text-xs">
                {isLoadingMatrix ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-slate-400"
                    >
                      Loading permission matrix from PostgreSQL...
                    </td>
                  </tr>
                ) : filteredMatrixScreens.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="py-12 text-center text-slate-400"
                    >
                      No screens match your current filter.
                    </td>
                  </tr>
                ) : (
                  filteredMatrixScreens.map((screen) => {
                    const allChecked =
                      screen.canView &&
                      screen.canAdd &&
                      screen.canEdit &&
                      screen.canDelete &&
                      screen.actions.every((a) => a.isAllowed);

                    return (
                      <tr
                        key={screen.screenId}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition"
                      >
                        <td className="py-3 px-4">
                          <span className="inline-flex rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            {screen.moduleName}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {screen.screenName}
                            </span>
                            <span className="font-mono text-[11px] text-slate-400">
                              {screen.screenCode}{' '}
                              {screen.routePath ? `• ${screen.routePath}` : ''}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => toggleScreenAllRow(screen.screenId)}
                            className="inline-flex items-center justify-center rounded p-1 text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 cursor-pointer"
                            title="Toggle all permissions for this screen"
                          >
                            {allChecked ? (
                              <CheckSquare className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                        {(
                          [
                            'canView',
                            'canAdd',
                            'canEdit',
                            'canDelete',
                          ] as const
                        ).map((flag) => (
                          <td key={flag} className="py-3 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={screen[flag]}
                              onChange={() =>
                                toggleScreenFlag(screen.screenId, flag)
                              }
                              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                            />
                          </td>
                        ))}
                        <td className="py-3 px-4">
                          {screen.actions.length === 0 ? (
                            <span className="text-[11px] text-slate-400">
                              Standard CRUD Only
                            </span>
                          ) : (
                            <div className="flex flex-wrap items-center gap-2">
                              {screen.actions.map((act) => (
                                <label
                                  key={act.actionId}
                                  title={act.actionName}
                                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer ${
                                    act.isAllowed
                                      ? 'border-brand-500/40 bg-brand-500/10 text-brand-700 dark:text-brand-300'
                                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-500'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={act.isAllowed}
                                    onChange={() =>
                                      toggleActionPermission(
                                        screen.screenId,
                                        act.actionId,
                                      )
                                    }
                                    className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                  />
                                  <span className="font-mono">
                                    {act.actionCode}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Global Role Modal */}
      {isRoleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!isSavingRole) setIsRoleModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingRole
                    ? `Edit Global Role — ${editingRole.roleCode}`
                    : 'Create New Global Role'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Global roles are reusable across all Companies and Plants.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRoleModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveRole} className="p-6 space-y-4">
              {roleFormError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-medium text-rose-600 dark:text-rose-300">
                  {roleFormError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Role Code *
                </label>
                <input
                  type="text"
                  required
                  maxLength={40}
                  disabled={Boolean(editingRole?.isSystemRole)}
                  placeholder="e.g., PRODUCTION_PLANNER"
                  value={roleForm.roleCode}
                  onChange={(e) =>
                    setRoleForm({
                      ...roleForm,
                      roleCode: e.target.value
                        .toUpperCase()
                        .replace(/\s+/g, '_'),
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono text-xs uppercase text-slate-900 dark:text-white disabled:opacity-60 focus:border-brand-500 focus:outline-none"
                />
                {editingRole?.isSystemRole && (
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                    System Role Code is locked to preserve kernel RBAC bindings.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Role Title / Name *
                </label>
                <input
                  type="text"
                  required
                  maxLength={100}
                  placeholder="e.g., Senior Production & MRP Planner"
                  value={roleForm.roleName}
                  onChange={(e) =>
                    setRoleForm({ ...roleForm, roleName: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Role Description & Responsibility Scope
                </label>
                <textarea
                  rows={3}
                  maxLength={300}
                  placeholder="Describe the plant/module responsibilities granted to this role..."
                  value={roleForm.roleDescription}
                  onChange={(e) =>
                    setRoleForm({
                      ...roleForm,
                      roleDescription: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              {!editingRole && (
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <Copy className="h-3.5 w-3.5 text-brand-500" />
                    Clone Baseline Permissions From Existing Role (Optional)
                  </label>
                  <select
                    value={roleForm.cloneFromRoleId}
                    onChange={(e) =>
                      setRoleForm({
                        ...roleForm,
                        cloneFromRoleId: e.target.value,
                      })
                    }
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                  >
                    <option value="">
                      — Start With Blank Permissions Matrix —
                    </option>
                    {roles.map((r) => (
                      <option key={r.roleId} value={r.roleId}>
                        {r.roleCode} — {r.roleName} ({r.grantedScreenCount}{' '}
                        screens)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={editingRole?.roleCode === 'SUPER_ADMIN'}
                    checked={roleForm.isActive}
                    onChange={(e) =>
                      setRoleForm({ ...roleForm, isActive: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  Role Active for User Mapping
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRoleModalOpen(false)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingRole}
                    className="rounded-xl bg-brand-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-500 disabled:opacity-50 transition"
                  >
                    {isSavingRole
                      ? 'Saving...'
                      : editingRole
                        ? 'Update Role'
                        : 'Create Role'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pre-Delete Dependency Verification Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        entityType="Global Security Role"
        entityName={deleteTarget?.name || ''}
        entityCode={deleteTarget?.code}
        isDeleting={isDeleting}
        errorMessage={deleteError}
        dependencies={deleteDependencies}
        onConfirm={handleConfirmDeleteRole}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
          setDeleteDependencies([]);
        }}
      />
    </div>
  );
};
