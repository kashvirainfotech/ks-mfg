import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Edit3,
  Filter,
  GitBranch,
  IdCard,
  KeyRound,
  Lock,
  Mail,
  Phone,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  Unlock,
  UserCheck,
  UserCog,
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

export type UserCategory = 'SYSTEM' | 'EMPLOYEE' | 'PARTY';

export interface UserCompanyRoleMapping {
  userCompanyRoleId?: number;
  mappedCompId: number;
  compCode?: string;
  compName?: string;
  roleId: number;
  roleCode?: string;
  roleName?: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface UserBranchRoleMapping {
  userBranchRoleId?: number;
  mappedCompId: number;
  compCode?: string;
  compName?: string;
  mappedBranchId: number;
  branchCode?: string;
  branchName?: string;
  branchType?: string;
  roleId: number;
  roleCode?: string;
  roleName?: string;
  isDefault: boolean;
  isActive: boolean;
}

export interface UserEntity {
  userId: number;
  username: string;
  email: string;
  mobile: string | null;
  fullName: string;
  userCategory: UserCategory;
  linkedEntityId: number | null;
  linkedEmpCode: string | null;
  linkedEmpName: string | null;
  linkedDeptName: string | null;
  linkedDesigName: string | null;
  isSuperAdmin: boolean;
  isActive: boolean;
  failedLoginCount: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  companyRoles: UserCompanyRoleMapping[];
  branchRoles: UserBranchRoleMapping[];
  createdDate: string;
  updatedDate: string | null;
}

interface CompanyLookup {
  compId: number;
  compCode: string;
  compName: string;
}

interface BranchLookup {
  branchId: number;
  compId: number;
  branchCode: string;
  branchName: string;
  branchType: string;
}

interface RoleLookup {
  roleId: number;
  roleCode: string;
  roleName: string;
  isActive: boolean;
}

interface EmployeeLookup {
  employeeId: number;
  compId: number;
  primaryBranchId: number;
  empCode: string;
  fullName: string;
  workEmail: string | null;
  mobileNo: string;
  deptName: string;
  desigName: string;
}

const EMPTY_USER_FORM = {
  username: '',
  email: '',
  mobile: '',
  password: '',
  fullName: '',
  userCategory: 'EMPLOYEE' as UserCategory,
  linkedEntityId: '' as string | number,
  isSuperAdmin: false,
  isActive: true,
};

export const UserMasterPage: React.FC = () => {
  const [users, setUsers] = useState<UserEntity[]>([]);
  const [companies, setCompanies] = useState<CompanyLookup[]>([]);
  const [branches, setBranches] = useState<BranchLookup[]>([]);
  const [roles, setRoles] = useState<RoleLookup[]>([]);
  const [employees, setEmployees] = useState<EmployeeLookup[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState<UserCategory | 'ALL'>(
    'ALL',
  );
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'LOCKED' | 'INACTIVE'
  >('ALL');

  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // User Create / Edit + Role Assignments Modal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserEntity | null>(null);
  const [modalTab, setModalTab] = useState<'PROFILE' | 'COMP_ROLES' | 'BRANCH_ROLES'>('PROFILE');
  const [userForm, setUserForm] = useState(EMPTY_USER_FORM);
  const [draftCompRoles, setDraftCompRoles] = useState<UserCompanyRoleMapping[]>([]);
  const [draftBranchRoles, setDraftBranchRoles] = useState<UserBranchRoleMapping[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);

  // Quick Add Row State inside Modal for Company Role & Branch Role
  const [newCompId, setNewCompId] = useState<number | ''>('');
  const [newCompRoleId, setNewCompRoleId] = useState<number | ''>('');
  const [newBranchCompId, setNewBranchCompId] = useState<number | ''>('');
  const [newBranchId, setNewBranchId] = useState<number | ''>('');
  const [newBranchRoleId, setNewBranchRoleId] = useState<number | ''>('');

  // Password Reset Modal
  const [passwordResetTarget, setPasswordResetTarget] =
    useState<UserEntity | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Delete Modal
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

  // Escape key closes active modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isUserModalOpen && !isSavingUser) setIsUserModalOpen(false);
        if (passwordResetTarget && !isResettingPassword) {
          setPasswordResetTarget(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUserModalOpen, isSavingUser, passwordResetTarget, isResettingPassword]);

  const fetchAllData = async () => {
    setIsLoading(true);
    setBannerMessage(null);
    try {
      const [usersRes, compRes, branchRes, roleRes, empRes] = await Promise.all([
        apiClient.get('/security/users'),
        apiClient.get('/org/companies'),
        apiClient.get('/org/branches'),
        apiClient.get('/security/roles'),
        apiClient.get('/hr/employees'),
      ]);

      const uData = usersRes.data?.data ?? usersRes.data;
      const cData = compRes.data?.data ?? compRes.data;
      const bData = branchRes.data?.data ?? branchRes.data;
      const rData = roleRes.data?.data ?? roleRes.data;
      const eData = empRes.data?.data ?? empRes.data;

      setUsers(Array.isArray(uData) ? uData : []);
      setCompanies(Array.isArray(cData) ? cData : []);
      setBranches(Array.isArray(bData) ? bData : []);
      setRoles(Array.isArray(rData) ? rData : []);
      setEmployees(Array.isArray(eData) ? eData : []);
    } catch (err: any) {
      setUsers([]);
      setBannerMessage({
        type: 'error',
        text:
          err?.response?.data?.error?.message ||
          'Unable to load User Master and Role Assignment records from PostgreSQL.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchAllData();
  }, []);

  const isAccountLocked = (u: UserEntity): boolean => {
    if (u.failedLoginCount >= 5) return true;
    if (u.lockedUntil && new Date(u.lockedUntil).getTime() > Date.now()) {
      return true;
    }
    return false;
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (categoryFilter !== 'ALL' && u.userCategory !== categoryFilter) {
        return false;
      }
      if (statusFilter === 'ACTIVE' && (!u.isActive || isAccountLocked(u))) {
        return false;
      }
      if (statusFilter === 'LOCKED' && !isAccountLocked(u)) {
        return false;
      }
      if (statusFilter === 'INACTIVE' && u.isActive) {
        return false;
      }
      return true;
    });
  }, [users, categoryFilter, statusFilter]);

  const kpiStats = useMemo(() => {
    const totalUsers = users.length;
    const activeEmployeeUsers = users.filter(
      (u) => u.isActive && u.userCategory === 'EMPLOYEE',
    ).length;
    const totalRoleAssignments = users.reduce(
      (acc, u) => acc + u.companyRoles.length + u.branchRoles.length,
      0,
    );
    const superAdminsCount = users.filter((u) => u.isSuperAdmin).length;
    return {
      totalUsers,
      activeEmployeeUsers,
      totalRoleAssignments,
      superAdminsCount,
    };
  }, [users]);

  // Open Create / Edit User Modal
  const openCreateModal = () => {
    const defaultCompId = companies[0]?.compId || 1001;
    const defaultBranch = branches.find((b) => b.compId === defaultCompId);
    const defaultRole =
      roles.find((r) => r.roleCode !== 'SUPER_ADMIN') || roles[0];

    setEditingUser(null);
    setUserForm(EMPTY_USER_FORM);
    setDraftCompRoles(
      defaultRole
        ? [
            {
              mappedCompId: defaultCompId,
              roleId: defaultRole.roleId,
              isDefault: true,
              isActive: true,
            },
          ]
        : [],
    );
    setDraftBranchRoles(
      defaultBranch && defaultRole
        ? [
            {
              mappedCompId: defaultCompId,
              mappedBranchId: defaultBranch.branchId,
              roleId: defaultRole.roleId,
              isDefault: true,
              isActive: true,
            },
          ]
        : [],
    );
    setNewCompId(defaultCompId);
    setNewCompRoleId(defaultRole?.roleId || '');
    setNewBranchCompId(defaultCompId);
    setNewBranchId(defaultBranch?.branchId || '');
    setNewBranchRoleId(defaultRole?.roleId || '');
    setModalTab('PROFILE');
    setFormError(null);
    setIsUserModalOpen(true);
  };

  const openEditModal = (
    user: UserEntity,
    initialTab: 'PROFILE' | 'COMP_ROLES' | 'BRANCH_ROLES' = 'PROFILE',
  ) => {
    const defaultCompId = companies[0]?.compId || 1001;
    const defaultBranch = branches.find((b) => b.compId === defaultCompId);
    const defaultRole = roles[0];

    setEditingUser(user);
    setUserForm({
      username: user.username,
      email: user.email,
      mobile: user.mobile || '',
      password: '',
      fullName: user.fullName,
      userCategory: user.userCategory,
      linkedEntityId: user.linkedEntityId || '',
      isSuperAdmin: user.isSuperAdmin,
      isActive: user.isActive,
    });
    setDraftCompRoles(user.companyRoles.map((cr) => ({ ...cr })));
    setDraftBranchRoles(user.branchRoles.map((br) => ({ ...br })));
    setNewCompId(defaultCompId);
    setNewCompRoleId(defaultRole?.roleId || '');
    setNewBranchCompId(defaultCompId);
    setNewBranchId(defaultBranch?.branchId || '');
    setNewBranchRoleId(defaultRole?.roleId || '');
    setModalTab(initialTab);
    setFormError(null);
    setIsUserModalOpen(true);
  };

  // Auto-fill user fields when an Employee is chosen
  const handleSelectLinkedEmployee = (empIdStr: string) => {
    if (!empIdStr) {
      setUserForm({ ...userForm, linkedEntityId: '' });
      return;
    }
    const empId = Number(empIdStr);
    const emp = employees.find((e) => e.employeeId === empId);
    if (!emp) return;

    const suggestedUsername = emp.workEmail
      ? emp.workEmail.split('@')[0].toLowerCase()
      : emp.fullName.toLowerCase().replace(/\s+/g, '.');

    setUserForm({
      ...userForm,
      linkedEntityId: emp.employeeId,
      fullName: userForm.fullName || emp.fullName,
      email: userForm.email || emp.workEmail || '',
      mobile: userForm.mobile || emp.mobileNo || '',
      username: editingUser ? userForm.username : userForm.username || suggestedUsername,
    });
  };

  // Company Role Draft Helpers
  const handleAddDraftCompRole = () => {
    if (!newCompId || !newCompRoleId) return;
    const exists = draftCompRoles.some(
      (cr) =>
        cr.mappedCompId === Number(newCompId) &&
        cr.roleId === Number(newCompRoleId),
    );
    if (exists) return;

    setDraftCompRoles((prev) => [
      ...prev,
      {
        mappedCompId: Number(newCompId),
        roleId: Number(newCompRoleId),
        isDefault: prev.length === 0,
        isActive: true,
      },
    ]);
  };

  const handleSetDefaultCompRole = (idx: number) => {
    setDraftCompRoles((prev) =>
      prev.map((item, i) => ({
        ...item,
        isDefault: i === idx,
      })),
    );
  };

  const handleRemoveDraftCompRole = (idx: number) => {
    setDraftCompRoles((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length > 0 && !next.some((r) => r.isDefault)) {
        next[0].isDefault = true;
      }
      return next;
    });
  };

  // Branch Role Draft Helpers
  const handleAddDraftBranchRole = () => {
    if (!newBranchCompId || !newBranchId || !newBranchRoleId) return;
    const exists = draftBranchRoles.some(
      (br) =>
        br.mappedBranchId === Number(newBranchId) &&
        br.roleId === Number(newBranchRoleId),
    );
    if (exists) return;

    setDraftBranchRoles((prev) => [
      ...prev,
      {
        mappedCompId: Number(newBranchCompId),
        mappedBranchId: Number(newBranchId),
        roleId: Number(newBranchRoleId),
        isDefault: prev.length === 0,
        isActive: true,
      },
    ]);
  };

  const handleSetDefaultBranchRole = (idx: number) => {
    setDraftBranchRoles((prev) =>
      prev.map((item, i) => ({
        ...item,
        isDefault: i === idx,
      })),
    );
  };

  const handleRemoveDraftBranchRole = (idx: number) => {
    setDraftBranchRoles((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length > 0 && !next.some((r) => r.isDefault)) {
        next[0].isDefault = true;
      }
      return next;
    });
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (
      !userForm.username.trim() ||
      !userForm.email.trim() ||
      !userForm.fullName.trim()
    ) {
      setFormError('Username, Email, and Full Name are mandatory.');
      return;
    }

    if (!editingUser && userForm.password.length < 6) {
      setFormError('Initial Password must be at least 6 characters.');
      return;
    }

    setIsSavingUser(true);
    try {
      const payload = {
        username: userForm.username.trim().toLowerCase(),
        email: userForm.email.trim().toLowerCase(),
        mobile: userForm.mobile.trim() || null,
        fullName: userForm.fullName.trim(),
        userCategory: userForm.userCategory,
        linkedEntityId:
          userForm.userCategory === 'EMPLOYEE' && userForm.linkedEntityId
            ? Number(userForm.linkedEntityId)
            : null,
        isSuperAdmin: userForm.isSuperAdmin,
        isActive: userForm.isActive,
        companyRoles: draftCompRoles.map((cr) => ({
          mappedCompId: cr.mappedCompId,
          roleId: cr.roleId,
          isDefault: cr.isDefault,
          isActive: cr.isActive,
        })),
        branchRoles: draftBranchRoles.map((br) => ({
          mappedCompId: br.mappedCompId,
          mappedBranchId: br.mappedBranchId,
          roleId: br.roleId,
          isDefault: br.isDefault,
          isActive: br.isActive,
        })),
      };

      if (editingUser) {
        await apiClient.put(`/security/users/${editingUser.userId}`, payload);
      } else {
        await apiClient.post('/security/users', {
          ...payload,
          password: userForm.password,
        });
      }

      await fetchAllData();
      setIsUserModalOpen(false);
      setBannerMessage({
        type: 'success',
        text: editingUser
          ? `User "${payload.fullName}" (@${payload.username}) and role assignments updated.`
          : `User "${payload.fullName}" (@${payload.username}) created with ${payload.companyRoles.length} company role(s) and ${payload.branchRoles.length} plant/branch role(s).`,
      });
    } catch (err: any) {
      setFormError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Failed to save user account.',
      );
    } finally {
      setIsSavingUser(false);
    }
  };

  // Password Reset Submit
  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetTarget) return;
    setPasswordError(null);

    if (newPasswordInput.length < 6) {
      setPasswordError('New password must be at least 6 characters.');
      return;
    }
    if (newPasswordInput !== confirmPasswordInput) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setIsResettingPassword(true);
    try {
      await apiClient.put(
        `/security/users/${passwordResetTarget.userId}/reset-password`,
        { newPassword: newPasswordInput },
      );
      const targetName = passwordResetTarget.username;
      setPasswordResetTarget(null);
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      await fetchAllData();
      setBannerMessage({
        type: 'success',
        text: `Password reset completed and login lockout cleared for @${targetName}.`,
      });
    } catch (err: any) {
      setPasswordError(
        err?.response?.data?.error?.message ||
          'Failed to reset user password.',
      );
    } finally {
      setIsResettingPassword(false);
    }
  };

  // Unlock User Account
  const handleUnlockUser = async (user: UserEntity) => {
    try {
      await apiClient.put(`/security/users/${user.userId}/unlock`);
      await fetchAllData();
      setBannerMessage({
        type: 'success',
        text: `Account lockout cleared for @${user.username}.`,
      });
    } catch (err: any) {
      setBannerMessage({
        type: 'error',
        text:
          err?.response?.data?.error?.message ||
          'Failed to unlock user account.',
      });
    }
  };

  // Delete User Handler
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    setDeleteDependencies([]);

    try {
      await apiClient.delete(`/security/users/${deleteTarget.id}`);
      const deletedLabel = `${deleteTarget.name} (@${deleteTarget.code})`;
      setDeleteTarget(null);
      await fetchAllData();
      setBannerMessage({
        type: 'success',
        text: `User account "${deletedLabel}" deleted permanently.`,
      });
    } catch (err: any) {
      const errPayload = err?.response?.data?.error;
      const conflicts: DependencyConflictItem[] =
        errPayload?.details?.dependencies || [];
      setDeleteDependencies(conflicts);
      setDeleteError(
        errPayload?.message ||
          'Cannot delete this user account because dependent role mappings or audit logs exist.',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Export CSV
  const handleExportCsv = async () => {
    try {
      await apiClient.post('/security/users/action/EXPORT');
    } catch {
      // Non-blocking audit log
    }

    const headers = [
      'Username',
      'Full Name',
      'Email',
      'Mobile',
      'Category',
      'Linked Employee',
      'Super Admin',
      'Company Role Mappings',
      'Branch Role Mappings',
      'Status',
    ];
    const lines = [
      headers.join(','),
      ...filteredUsers.map((u) =>
        [
          u.username,
          `"${(u.fullName || '').replace(/"/g, '""')}"`,
          u.email,
          u.mobile || '',
          u.userCategory,
          u.linkedEmpCode ? `${u.linkedEmpCode} - ${u.linkedEmpName}` : '',
          u.isSuperAdmin ? 'YES' : 'NO',
          `"${u.companyRoles.map((cr) => `${cr.compCode}:${cr.roleCode}`).join('; ')}"`,
          `"${u.branchRoles.map((br) => `${br.branchCode}:${br.roleCode}`).join('; ')}"`,
          u.isActive ? 'ACTIVE' : 'INACTIVE',
        ].join(','),
      ),
    ];

    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KS_MFG_Users_And_Role_Mappings_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const userColumns: MasterTableColumn<UserEntity>[] = useMemo(
    () => [
      {
        key: 'username',
        header: 'Username & Identity',
        render: (row) => (
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-brand-600 dark:text-brand-400">
                @{row.username}
              </span>
              {row.isSuperAdmin && (
                <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <ShieldAlert className="h-2.5 w-2.5" />
                  SUPER ADMIN
                </span>
              )}
            </div>
            <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 mt-0.5">
              {row.fullName}
            </span>
          </div>
        ),
      },
      {
        key: 'email',
        header: 'Contact & Category',
        render: (row) => (
          <div className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-300">
              <Mail className="h-3 w-3 text-slate-400" />
              {row.email}
            </span>
            {row.mobile && (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Phone className="h-3 w-3 text-slate-400" />
                {row.mobile}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'linkedEmpCode',
        header: 'Linked HR Employee',
        render: (row) =>
          row.linkedEmpCode ? (
            <div className="flex flex-col">
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <IdCard className="h-3.5 w-3.5 text-brand-500" />
                {row.linkedEmpCode} — {row.linkedEmpName}
              </span>
              <span className="text-[11px] text-slate-400">
                {row.linkedDesigName || ''}{' '}
                {row.linkedDeptName ? `(${row.linkedDeptName})` : ''}
              </span>
            </div>
          ) : (
            <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-400">
              {row.userCategory} ACCOUNT
            </span>
          ),
      },
      {
        key: 'companyRoles',
        header: 'Company Role Mappings (`tbl_sec_user_company_role`)',
        render: (row) =>
          row.companyRoles.length === 0 ? (
            <span className="text-xs text-slate-400">No company roles</span>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-w-xs">
              {row.companyRoles.map((cr) => (
                <span
                  key={`${cr.mappedCompId}-${cr.roleId}`}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${
                    cr.isDefault
                      ? 'border-brand-500/30 bg-brand-500/10 text-brand-700 dark:text-brand-300'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {cr.isDefault && <Star className="h-2.5 w-2.5 fill-current" />}
                  <span className="font-mono font-bold">{cr.compCode}:</span>
                  <span>{cr.roleCode}</span>
                </span>
              ))}
            </div>
          ),
      },
      {
        key: 'branchRoles',
        header: 'Plant / Branch Role Mappings (`tbl_sec_user_branch_role`)',
        render: (row) =>
          row.branchRoles.length === 0 ? (
            <span className="text-xs text-slate-400">No branch roles</span>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-w-sm">
              {row.branchRoles.map((br) => (
                <span
                  key={`${br.mappedBranchId}-${br.roleId}`}
                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${
                    br.isDefault
                      ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {br.isDefault && <Star className="h-2.5 w-2.5 fill-current" />}
                  <span className="font-mono font-bold">{br.branchCode}:</span>
                  <span>{br.roleCode}</span>
                </span>
              ))}
            </div>
          ),
      },
      {
        key: 'isActive',
        header: 'Status',
        align: 'center',
        render: (row) => {
          const locked = isAccountLocked(row);
          if (locked) {
            return (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                <Lock className="h-3 w-3" />
                Locked ({row.failedLoginCount})
              </span>
            );
          }
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                row.isActive
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-slate-500/20 bg-slate-500/10 text-slate-500'
              }`}
            >
              {row.isActive ? 'Active' : 'Inactive'}
            </span>
          );
        },
      },
    ],
    [],
  );

  const groupByOptions: GroupByOption<UserEntity>[] = [
    {
      key: 'userCategory',
      label: 'User Category (Employee vs System)',
      groupValue: (r) => `${r.userCategory} Accounts`,
    },
    {
      key: 'status',
      label: 'Account Status',
      groupValue: (r) =>
        isAccountLocked(r)
          ? 'Locked Accounts'
          : r.isActive
            ? 'Active Accounts'
            : 'Inactive Accounts',
    },
  ];

  // Lookup Helpers inside Modal
  const getCompanyLabel = (compId: number) => {
    const c = companies.find((x) => x.compId === compId);
    return c ? `${c.compCode} — ${c.compName}` : `Company #${compId}`;
  };

  const getBranchLabel = (branchId: number) => {
    const b = branches.find((x) => x.branchId === branchId);
    return b ? `${b.branchCode} — ${b.branchName}` : `Branch #${branchId}`;
  };

  const getRoleLabel = (roleId: number) => {
    const r = roles.find((x) => x.roleId === roleId);
    return r ? `${r.roleCode} — ${r.roleName}` : `Role #${roleId}`;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-semibold text-brand-600 dark:text-brand-400">
              <UserCog className="h-3.5 w-3.5" />
              Phase 2 • Step 2.4 — Multi-Tenant User & Role Assignment Engine
            </span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            User Master & Multi-Company / Multi-Branch Role Assignment
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Manage ERP user accounts (`tbl_sec_user`), link workforce employees,
            and assign Global Roles across multiple Companies
            (`tbl_sec_user_company_role`) and Plants/Branches
            (`tbl_sec_user_branch_role`).
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total ERP User Accounts
            </span>
            <Users className="h-4 w-4 text-brand-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
            {kpiStats.totalUsers}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Active Employee-Linked Users
            </span>
            <UserCheck className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {kpiStats.activeEmployeeUsers}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Company & Branch Role Mappings
            </span>
            <GitBranch className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {kpiStats.totalRoleAssignments}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Global Super Administrators
            </span>
            <ShieldCheck className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {kpiStats.superAdminsCount}
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

      {/* Master Data Table */}
      <MasterDataTable<UserEntity>
        title="Security User Accounts & Role Assignment Matrix"
        subtitle="Each user can be assigned different Global Roles across different Companies (`tbl_sec_user_company_role`) and Plants/Branches (`tbl_sec_user_branch_role`)."
        screenCode="USER_MASTER"
        tableNameBadge="tbl_sec_user"
        data={filteredUsers}
        rowKey={(r) => r.userId}
        columns={userColumns}
        isLoading={isLoading}
        addButtonLabel="Create User & Assign Roles"
        onAddClick={openCreateModal}
        onExportClick={() => {
          void handleExportCsv();
        }}
        onPrintClick={() => {
          void apiClient.post('/security/users/action/PRINT').catch(() => {});
          window.print();
        }}
        searchPlaceholder="Search by username, full name, email, employee code, company code, branch code, or role..."
        searchPredicate={(r, q) =>
          r.username.toLowerCase().includes(q) ||
          r.fullName.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q) ||
          (r.linkedEmpCode || '').toLowerCase().includes(q) ||
          r.companyRoles.some(
            (cr) =>
              (cr.compCode || '').toLowerCase().includes(q) ||
              (cr.roleCode || '').toLowerCase().includes(q),
          ) ||
          r.branchRoles.some(
            (br) =>
              (br.branchCode || '').toLowerCase().includes(q) ||
              (br.roleCode || '').toLowerCase().includes(q),
          )
        }
        groupByOptions={groupByOptions}
        filterToolbarSlot={
          <>
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={categoryFilter}
                onChange={(e) =>
                  setCategoryFilter(e.target.value as UserCategory | 'ALL')
                }
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200"
              >
                <option value="ALL">All User Categories</option>
                <option value="EMPLOYEE">Employee Accounts</option>
                <option value="SYSTEM">System Accounts</option>
                <option value="PARTY">External Party Accounts</option>
              </select>
            </div>

            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(
                  e.target.value as 'ALL' | 'ACTIVE' | 'LOCKED' | 'INACTIVE',
                )
              }
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Accounts</option>
              <option value="LOCKED">Locked Accounts</option>
              <option value="INACTIVE">Inactive Accounts</option>
            </select>
          </>
        }
        renderRowActions={(row) => (
          <div className="inline-flex items-center gap-1">
            <PermissionGate screen="USER_MASTER" action="EDIT">
              <button
                type="button"
                onClick={() => openEditModal(row, 'BRANCH_ROLES')}
                title="Configure Multi-Company & Multi-Branch Role Mappings"
                className="inline-flex items-center gap-1 rounded-lg border border-brand-500/30 bg-brand-500/10 px-2 py-1 text-[11px] font-semibold text-brand-600 hover:bg-brand-500/20 dark:text-brand-400 transition cursor-pointer"
              >
                <GitBranch className="h-3 w-3" />
                Roles
              </button>

              <button
                type="button"
                onClick={() => {
                  setPasswordError(null);
                  setNewPasswordInput('');
                  setConfirmPasswordInput('');
                  setPasswordResetTarget(row);
                }}
                title="Reset User Password"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-amber-500/10 hover:text-amber-600 dark:text-slate-400 transition cursor-pointer"
              >
                <KeyRound className="h-4 w-4" />
              </button>

              {isAccountLocked(row) && (
                <button
                  type="button"
                  onClick={() => handleUnlockUser(row)}
                  title="Unlock Locked User Account"
                  className="rounded-lg p-1.5 text-rose-500 hover:bg-emerald-500/10 hover:text-emerald-600 transition cursor-pointer"
                >
                  <Unlock className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => openEditModal(row, 'PROFILE')}
                title="Edit User Profile"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            </PermissionGate>

            <PermissionGate screen="USER_MASTER" action="DELETE">
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteDependencies([]);
                  setDeleteTarget({
                    id: row.userId,
                    code: row.username,
                    name: row.fullName,
                  });
                }}
                title="Delete User Account"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-500/10 hover:text-rose-500 transition cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </PermissionGate>
          </div>
        )}
      />

      {/* ====================================================================
          USER CREATE / EDIT + MULTI-COMPANY / MULTI-BRANCH ROLE MODAL
          ==================================================================== */}
      {isUserModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!isSavingUser) setIsUserModalOpen(false);
          }}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingUser
                    ? `Manage User & Role Mappings — @${editingUser.username} (${editingUser.fullName})`
                    : 'Create ERP User & Assign Multi-Company / Multi-Branch Roles'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Link user to HR Employee Master and assign Global Roles per
                  Company and per Plant/Branch.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 px-6">
              <button
                type="button"
                onClick={() => setModalTab('PROFILE')}
                className={`inline-flex items-center gap-2 border-b-2 py-2.5 px-3 text-xs font-semibold transition cursor-pointer ${
                  modalTab === 'PROFILE'
                    ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <UserCog className="h-3.5 w-3.5" />
                1. User Identity & Employee Link
              </button>
              <button
                type="button"
                onClick={() => setModalTab('COMP_ROLES')}
                className={`inline-flex items-center gap-2 border-b-2 py-2.5 px-3 text-xs font-semibold transition cursor-pointer ${
                  modalTab === 'COMP_ROLES'
                    ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" />
                2. Company Role Mappings ({draftCompRoles.length})
              </button>
              <button
                type="button"
                onClick={() => setModalTab('BRANCH_ROLES')}
                className={`inline-flex items-center gap-2 border-b-2 py-2.5 px-3 text-xs font-semibold transition cursor-pointer ${
                  modalTab === 'BRANCH_ROLES'
                    ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <GitBranch className="h-3.5 w-3.5" />
                3. Plant / Branch Role Mappings ({draftBranchRoles.length})
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              {formError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-medium text-rose-600 dark:text-rose-300">
                  {formError}
                </div>
              )}

              {/* TAB 1: PROFILE & EMPLOYEE LINK */}
              {modalTab === 'PROFILE' && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      User Category *
                    </label>
                    <select
                      value={userForm.userCategory}
                      onChange={(e) =>
                        setUserForm({
                          ...userForm,
                          userCategory: e.target.value as UserCategory,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    >
                      <option value="EMPLOYEE">
                        EMPLOYEE — Linked to HR Employee Master
                      </option>
                      <option value="SYSTEM">
                        SYSTEM — Technical / Service Administrator
                      </option>
                      <option value="PARTY">
                        PARTY — Customer / Vendor Portal User
                      </option>
                    </select>
                  </div>

                  {userForm.userCategory === 'EMPLOYEE' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Link to HR Employee Record (`tbl_hr_employee`)
                      </label>
                      <select
                        value={userForm.linkedEntityId}
                        onChange={(e) =>
                          handleSelectLinkedEmployee(e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                      >
                        <option value="">— Select Employee to Auto-Fill —</option>
                        {employees.map((emp) => (
                          <option key={emp.employeeId} value={emp.employeeId}>
                            {emp.empCode} — {emp.fullName} ({emp.desigName})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Login Username *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={60}
                      disabled={editingUser?.userId === 1001}
                      placeholder="e.g., arjun.mehta"
                      value={userForm.username}
                      onChange={(e) =>
                        setUserForm({
                          ...userForm,
                          username: e.target.value
                            .toLowerCase()
                            .replace(/\s+/g, ''),
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono text-xs text-slate-900 dark:text-white disabled:opacity-60 focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Full Display Name *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={150}
                      placeholder="e.g., Arjun Mehta"
                      value={userForm.fullName}
                      onChange={(e) =>
                        setUserForm({ ...userForm, fullName: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Official Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      maxLength={150}
                      placeholder="e.g., arjun.mehta@ksmfg.com"
                      value={userForm.email}
                      onChange={(e) =>
                        setUserForm({ ...userForm, email: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Mobile Number
                    </label>
                    <input
                      type="text"
                      maxLength={25}
                      placeholder="e.g., +91-9825010001"
                      value={userForm.mobile}
                      onChange={(e) =>
                        setUserForm({ ...userForm, mobile: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  {!editingUser && (
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Initial Login Password (Bcrypt 12-Round Hashed) *
                      </label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="Minimum 6 characters"
                        value={userForm.password}
                        onChange={(e) =>
                          setUserForm({ ...userForm, password: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="sm:col-span-2 pt-1">
                    <label className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-xs font-semibold text-amber-700 dark:text-amber-300 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={editingUser?.userId === 1001}
                        checked={userForm.isSuperAdmin}
                        onChange={(e) =>
                          setUserForm({
                            ...userForm,
                            isSuperAdmin: e.target.checked,
                          })
                        }
                        className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                      />
                      Grant Global Super Admin Authority (`is_super_admin = TRUE`
                      — Unrestricted access across all Companies & Plants)
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 2: COMPANY ROLE MAPPINGS */}
              {modalTab === 'COMP_ROLES' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                        Target Company
                      </label>
                      <select
                        value={newCompId}
                        onChange={(e) => setNewCompId(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                      >
                        {companies.map((c) => (
                          <option key={c.compId} value={c.compId}>
                            {c.compCode} — {c.compName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1 min-w-[200px]">
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                        Global Role to Grant
                      </label>
                      <select
                        value={newCompRoleId}
                        onChange={(e) =>
                          setNewCompRoleId(Number(e.target.value))
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                      >
                        {roles.map((r) => (
                          <option key={r.roleId} value={r.roleId}>
                            {r.roleCode} — {r.roleName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddDraftCompRole}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-500 transition cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Company Role
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[11px] font-bold uppercase text-slate-500">
                          <th className="py-2.5 px-3">Company</th>
                          <th className="py-2.5 px-3">Assigned Global Role</th>
                          <th className="py-2.5 px-3 text-center">
                            Default Login Company
                          </th>
                          <th className="py-2.5 px-3 text-right">Remove</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                        {draftCompRoles.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="py-6 text-center text-slate-400"
                            >
                              No company-level roles assigned yet. Add one above.
                            </td>
                          </tr>
                        ) : (
                          draftCompRoles.map((cr, idx) => (
                            <tr
                              key={`${cr.mappedCompId}-${cr.roleId}`}
                              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                            >
                              <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                                {getCompanyLabel(cr.mappedCompId)}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-semibold text-brand-600 dark:text-brand-400">
                                {getRoleLabel(cr.roleId)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="radio"
                                  name="defaultCompRole"
                                  checked={cr.isDefault}
                                  onChange={() => handleSetDefaultCompRole(idx)}
                                  className="h-3.5 w-3.5 text-brand-600 cursor-pointer"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveDraftCompRole(idx)}
                                  className="rounded p-1 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 3: PLANT / BRANCH ROLE MAPPINGS */}
              {modalTab === 'BRANCH_ROLES' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                    <div className="flex-1 min-w-[150px]">
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                        Company
                      </label>
                      <select
                        value={newBranchCompId}
                        onChange={(e) => {
                          const cId = Number(e.target.value);
                          setNewBranchCompId(cId);
                          const firstB = branches.find((b) => b.compId === cId);
                          setNewBranchId(firstB?.branchId || '');
                        }}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                      >
                        {companies.map((c) => (
                          <option key={c.compId} value={c.compId}>
                            {c.compCode} — {c.compName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                        Plant / Branch
                      </label>
                      <select
                        value={newBranchId}
                        onChange={(e) => setNewBranchId(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                      >
                        {branches
                          .filter(
                            (b) => b.compId === Number(newBranchCompId),
                          )
                          .map((b) => (
                            <option key={b.branchId} value={b.branchId}>
                              {b.branchCode} — {b.branchName}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="flex-1 min-w-[180px]">
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
                        Global Role at Plant
                      </label>
                      <select
                        value={newBranchRoleId}
                        onChange={(e) =>
                          setNewBranchRoleId(Number(e.target.value))
                        }
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-900 dark:text-white"
                      >
                        {roles.map((r) => (
                          <option key={r.roleId} value={r.roleId}>
                            {r.roleCode} — {r.roleName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddDraftBranchRole}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-500 transition cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Branch Role
                    </button>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[11px] font-bold uppercase text-slate-500">
                          <th className="py-2.5 px-3">Company</th>
                          <th className="py-2.5 px-3">Plant / Branch</th>
                          <th className="py-2.5 px-3">Assigned Global Role</th>
                          <th className="py-2.5 px-3 text-center">
                            Default Plant
                          </th>
                          <th className="py-2.5 px-3 text-right">Remove</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                        {draftBranchRoles.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="py-6 text-center text-slate-400"
                            >
                              No plant/branch-specific roles assigned yet. Add
                              one above.
                            </td>
                          </tr>
                        ) : (
                          draftBranchRoles.map((br, idx) => (
                            <tr
                              key={`${br.mappedBranchId}-${br.roleId}`}
                              className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                            >
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                                {getCompanyLabel(br.mappedCompId)}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                                {getBranchLabel(br.mappedBranchId)}
                              </td>
                              <td className="py-2.5 px-3 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                                {getRoleLabel(br.roleId)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <input
                                  type="radio"
                                  name="defaultBranchRole"
                                  checked={br.isDefault}
                                  onChange={() =>
                                    handleSetDefaultBranchRole(idx)
                                  }
                                  className="h-3.5 w-3.5 text-brand-600 cursor-pointer"
                                />
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleRemoveDraftBranchRole(idx)
                                  }
                                  className="rounded p-1 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={editingUser?.userId === 1001}
                    checked={userForm.isActive}
                    onChange={(e) =>
                      setUserForm({ ...userForm, isActive: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  Account Active for Login & API Access
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsUserModalOpen(false)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingUser}
                    className="rounded-xl bg-brand-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-500 disabled:opacity-50 transition"
                  >
                    {isSavingUser
                      ? 'Saving...'
                      : editingUser
                        ? 'Save User & Role Mappings'
                        : 'Create User & Save Mappings'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          ADMINISTRATIVE PASSWORD RESET MODAL
          ==================================================================== */}
      {passwordResetTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!isResettingPassword) setPasswordResetTarget(null);
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Reset Password — @{passwordResetTarget.username}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Sets a new 12-round Bcrypt password and clears any login
                  lockout.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPasswordResetTarget(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handlePasswordResetSubmit} className="p-6 space-y-4">
              {passwordError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-medium text-rose-600 dark:text-rose-300">
                  {passwordError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Enter new password (min 6 chars)"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Confirm New Password *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Re-enter new password"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => setPasswordResetTarget(null)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResettingPassword}
                  className="rounded-xl bg-brand-600 px-5 py-2 text-xs font-semibold text-white hover:bg-brand-500 disabled:opacity-50"
                >
                  {isResettingPassword ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pre-Delete Dependency Verification Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        entityType="ERP User Account"
        entityName={deleteTarget?.name || ''}
        entityCode={deleteTarget?.code}
        isDeleting={isDeleting}
        errorMessage={deleteError}
        dependencies={deleteDependencies}
        onConfirm={handleConfirmDelete}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
          setDeleteDependencies([]);
        }}
      />
    </div>
  );
};
