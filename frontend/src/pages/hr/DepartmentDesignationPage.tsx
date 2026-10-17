import React, { useEffect, useMemo, useState } from 'react';
import {
  Award,
  Building2,
  Edit3,
  Filter,
  GitMerge,
  Layers,
  Network,
  Trash2,
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
import { useAuthStore } from '../../store/useAuthStore';

export type DepartmentCategory =
  | 'PRODUCTION'
  | 'QUALITY'
  | 'SUPPLY_CHAIN'
  | 'ENGINEERING'
  | 'MAINTENANCE'
  | 'FINANCE_HR'
  | 'SALES_ADMIN';

export interface DepartmentEntity {
  deptId: number;
  compId: number;
  compCode: string;
  compName: string;
  branchId: number;
  deptCode: string;
  deptName: string;
  deptCategory: DepartmentCategory;
  parentDeptId: number | null;
  parentDeptCode: string | null;
  parentDeptName: string | null;
  hodEmployeeId: number | null;
  costCenterCode: string | null;
  description: string | null;
  designationCount: number;
  isActive: boolean;
}

export interface DesignationEntity {
  desigId: number;
  compId: number;
  compCode: string;
  compName: string;
  branchId: number;
  desigCode: string;
  desigName: string;
  deptId: number | null;
  deptCode: string | null;
  deptName: string | null;
  gradeCode: string;
  hierarchyLevel: number;
  description: string | null;
  isActive: boolean;
}

interface CompanyLookup {
  compId: number;
  compCode: string;
  compName: string;
}

const DEPT_CATEGORY_LABELS: Record<DepartmentCategory, string> = {
  PRODUCTION: 'Shopfloor Production',
  QUALITY: 'Quality Assurance & Lab',
  SUPPLY_CHAIN: 'Supply Chain & Warehouse',
  ENGINEERING: 'R&D, Design & BOM Engineering',
  MAINTENANCE: 'Plant Maintenance & Tool Room',
  FINANCE_HR: 'Finance, Costing & HR',
  SALES_ADMIN: 'Sales, Dispatch & Administration',
};

const GRADE_OPTIONS = [
  { code: 'E1', label: 'E1 — Executive / VP / Director', defaultLevel: 1 },
  { code: 'M1', label: 'M1 — Plant Head / GM', defaultLevel: 2 },
  { code: 'M2', label: 'M2 — Department Manager / HOD', defaultLevel: 3 },
  { code: 'L1', label: 'L1 — Lead Engineer / Asst. Manager', defaultLevel: 4 },
  { code: 'L2', label: 'L2 — Senior Engineer / Executive', defaultLevel: 4 },
  { code: 'L3', label: 'L3 — Engineer / Officer', defaultLevel: 5 },
  { code: 'L4', label: 'L4 — Shift Supervisor / QC Inspector', defaultLevel: 6 },
  { code: 'L5', label: 'L5 — Shopfloor CNC / Line Operator', defaultLevel: 7 },
];

const EMPTY_DEPT_FORM = {
  compId: 1001,
  deptCode: '',
  deptName: '',
  deptCategory: 'PRODUCTION' as DepartmentCategory,
  parentDeptId: '' as string | number,
  costCenterCode: '',
  description: '',
  isActive: true,
};

const EMPTY_DESIG_FORM = {
  compId: 1001,
  desigCode: '',
  desigName: '',
  deptId: '' as string | number,
  gradeCode: 'L3',
  hierarchyLevel: 5,
  description: '',
  isActive: true,
};

export const DepartmentDesignationPage: React.FC = () => {
  const activeContext = useAuthStore((s) => s.activeContext);

  const [activeTab, setActiveTab] = useState<'DEPARTMENTS' | 'DESIGNATIONS'>(
    'DEPARTMENTS',
  );
  const [departments, setDepartments] = useState<DepartmentEntity[]>([]);
  const [designations, setDesignations] = useState<DesignationEntity[]>([]);
  const [companies, setCompanies] = useState<CompanyLookup[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [deptFilterForDesig, setDeptFilterForDesig] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'INACTIVE'
  >('ALL');

  // Department Modal State
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentEntity | null>(null);
  const [deptForm, setDeptForm] = useState(EMPTY_DEPT_FORM);
  const [deptFormError, setDeptFormError] = useState<string | null>(null);

  // Designation Modal State
  const [isDesigModalOpen, setIsDesigModalOpen] = useState(false);
  const [editingDesig, setEditingDesig] = useState<DesignationEntity | null>(
    null,
  );
  const [desigForm, setDesigForm] = useState(EMPTY_DESIG_FORM);
  const [desigFormError, setDesigFormError] = useState<string | null>(null);

  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'DEPARTMENT' | 'DESIGNATION';
    id: number;
    code: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDependencies, setDeleteDependencies] = useState<
    DependencyConflictItem[]
  >([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [deptRes, desigRes, compRes] = await Promise.all([
        apiClient.get('/hr/departments'),
        apiClient.get('/hr/designations'),
        apiClient.get('/org/companies'),
      ]);
      if (Array.isArray(deptRes.data?.data)) {
        setDepartments(deptRes.data.data);
      }
      if (Array.isArray(desigRes.data?.data)) {
        setDesignations(desigRes.data.data);
      }
      if (Array.isArray(compRes.data?.data)) {
        setCompanies(compRes.data.data);
      }
    } catch {
      setDepartments([]);
      setDesignations([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const filteredDepartments = useMemo(() => {
    return departments.filter((d) => {
      if (companyFilter !== 'ALL' && d.compId !== Number(companyFilter)) {
        return false;
      }
      if (categoryFilter !== 'ALL' && d.deptCategory !== categoryFilter) {
        return false;
      }
      if (statusFilter === 'ACTIVE' && !d.isActive) return false;
      if (statusFilter === 'INACTIVE' && d.isActive) return false;
      return true;
    });
  }, [departments, companyFilter, categoryFilter, statusFilter]);

  const filteredDesignations = useMemo(() => {
    return designations.filter((dg) => {
      if (companyFilter !== 'ALL' && dg.compId !== Number(companyFilter)) {
        return false;
      }
      if (
        deptFilterForDesig !== 'ALL' &&
        dg.deptId !== Number(deptFilterForDesig)
      ) {
        return false;
      }
      if (statusFilter === 'ACTIVE' && !dg.isActive) return false;
      if (statusFilter === 'INACTIVE' && dg.isActive) return false;
      return true;
    });
  }, [designations, companyFilter, deptFilterForDesig, statusFilter]);

  // ==========================================================================
  // Department Add / Edit / Delete Handlers
  // ==========================================================================

  const openAddDeptModal = () => {
    setEditingDept(null);
    setDeptFormError(null);
    setDeptForm({
      ...EMPTY_DEPT_FORM,
      compId: companies[0]?.compId || activeContext.compId || 1001,
    });
    setIsDeptModalOpen(true);
  };

  const openEditDeptModal = (dept: DepartmentEntity) => {
    setEditingDept(dept);
    setDeptFormError(null);
    setDeptForm({
      compId: dept.compId,
      deptCode: dept.deptCode,
      deptName: dept.deptName,
      deptCategory: dept.deptCategory,
      parentDeptId: dept.parentDeptId || '',
      costCenterCode: dept.costCenterCode || '',
      description: dept.description || '',
      isActive: dept.isActive,
    });
    setIsDeptModalOpen(true);
  };

  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeptFormError(null);
    setIsSaving(true);

    const payload = {
      compId: Number(deptForm.compId),
      deptCode: deptForm.deptCode.trim().toUpperCase(),
      deptName: deptForm.deptName.trim(),
      deptCategory: deptForm.deptCategory,
      parentDeptId: deptForm.parentDeptId
        ? Number(deptForm.parentDeptId)
        : null,
      costCenterCode: deptForm.costCenterCode.trim() || null,
      description: deptForm.description.trim() || null,
      isActive: deptForm.isActive,
    };

    try {
      if (editingDept) {
        await apiClient.put(`/hr/departments/${editingDept.deptId}`, payload);
      } else {
        await apiClient.post('/hr/departments', payload);
      }
      setIsDeptModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setDeptFormError(
        err?.response?.data?.message || 'Failed to save department record.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================================================
  // Designation Add / Edit / Delete Handlers
  // ==========================================================================

  const openAddDesigModal = () => {
    setEditingDesig(null);
    setDesigFormError(null);
    const defaultCompId = companies[0]?.compId || activeContext.compId || 1001;
    const firstDept = departments.find((d) => d.compId === defaultCompId);
    setDesigForm({
      ...EMPTY_DESIG_FORM,
      compId: defaultCompId,
      deptId: firstDept?.deptId || '',
    });
    setIsDesigModalOpen(true);
  };

  const openEditDesigModal = (desig: DesignationEntity) => {
    setEditingDesig(desig);
    setDesigFormError(null);
    setDesigForm({
      compId: desig.compId,
      desigCode: desig.desigCode,
      desigName: desig.desigName,
      deptId: desig.deptId || '',
      gradeCode: desig.gradeCode,
      hierarchyLevel: desig.hierarchyLevel,
      description: desig.description || '',
      isActive: desig.isActive,
    });
    setIsDesigModalOpen(true);
  };

  const handleSaveDesignation = async (e: React.FormEvent) => {
    e.preventDefault();
    setDesigFormError(null);
    setIsSaving(true);

    const payload = {
      compId: Number(desigForm.compId),
      desigCode: desigForm.desigCode.trim().toUpperCase(),
      desigName: desigForm.desigName.trim(),
      deptId: desigForm.deptId ? Number(desigForm.deptId) : null,
      gradeCode: desigForm.gradeCode.trim().toUpperCase(),
      hierarchyLevel: Number(desigForm.hierarchyLevel || 5),
      description: desigForm.description.trim() || null,
      isActive: desigForm.isActive,
    };

    try {
      if (editingDesig) {
        await apiClient.put(
          `/hr/designations/${editingDesig.desigId}`,
          payload,
        );
      } else {
        await apiClient.post('/hr/designations', payload);
      }
      setIsDesigModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setDesigFormError(
        err?.response?.data?.message || 'Failed to save designation record.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ==========================================================================
  // Unified Pre-Delete Dependency Handler
  // ==========================================================================

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    setDeleteDependencies([]);

    try {
      if (deleteTarget.type === 'DEPARTMENT') {
        await apiClient.delete(`/hr/departments/${deleteTarget.id}`);
      } else {
        await apiClient.delete(`/hr/designations/${deleteTarget.id}`);
      }
      setDeleteTarget(null);
      await fetchData();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setDeleteError(err.response.data?.message);
        setDeleteDependencies(err.response.data?.details || []);
      } else {
        setDeleteError(
          err?.response?.data?.message ||
            `Unable to delete ${deleteTarget.type.toLowerCase()}.`,
        );
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // ==========================================================================
  // Table Columns & Group-By Definitions
  // ==========================================================================

  const deptColumns: MasterTableColumn<DepartmentEntity>[] = [
    {
      key: 'deptCode',
      header: 'Dept Code & ID',
      sortable: true,
      sortValue: (r) => r.deptCode,
      render: (r) => (
        <div>
          <div className="font-mono-code font-bold text-[var(--brand-600)] dark:text-[var(--brand-300)]">
            {r.deptCode}
          </div>
          <div className="font-mono-code text-[10px] text-[var(--text-muted)]">
            ID #{r.deptId}
          </div>
        </div>
      ),
    },
    {
      key: 'deptName',
      header: 'Department Name & Parent Company',
      sortable: true,
      sortValue: (r) => r.deptName,
      render: (r) => (
        <div>
          <div className="font-bold text-[var(--text-primary)]">
            {r.deptName}
          </div>
          <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
            <Building2 className="h-3 w-3 text-[var(--brand-500)]" />
            <span className="font-mono-code font-semibold text-[var(--text-secondary)]">
              {r.compCode}
            </span>
            <span>— {r.compName}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'deptCategory',
      header: 'Functional Category',
      sortable: true,
      sortValue: (r) => r.deptCategory,
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-primary)]">
          <Layers className="h-3 w-3 text-[var(--brand-500)]" />
          {DEPT_CATEGORY_LABELS[r.deptCategory] || r.deptCategory}
        </span>
      ),
    },
    {
      key: 'parentDeptName',
      header: 'Parent Dept & Cost Center',
      render: (r) => (
        <div className="text-xs">
          {r.parentDeptCode ? (
            <div className="inline-flex items-center gap-1 font-semibold text-[var(--text-primary)]">
              <GitMerge className="h-3 w-3 text-emerald-500" />
              <span className="font-mono-code">{r.parentDeptCode}</span>
              <span className="text-[var(--text-muted)]">
                ({r.parentDeptName})
              </span>
            </div>
          ) : (
            <span className="text-[11px] text-[var(--text-muted)]">
              Top-Level Division
            </span>
          )}
          {r.costCenterCode && (
            <div className="font-mono-code text-[11px] text-[var(--text-muted)] mt-0.5">
              Cost Center: {r.costCenterCode}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'designationCount',
      header: 'Linked Designations',
      sortable: true,
      sortValue: (r) => r.designationCount,
      render: (r) => (
        <span className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/20 px-2 py-0.5 font-mono-code text-xs font-bold text-[var(--brand-600)] dark:text-[var(--brand-300)]">
          {r.designationCount} Roles
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      sortable: true,
      sortValue: (r) => (r.isActive ? 1 : 0),
      render: (r) =>
        r.isActive ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Inactive
          </span>
        ),
    },
  ];

  const desigColumns: MasterTableColumn<DesignationEntity>[] = [
    {
      key: 'desigCode',
      header: 'Code & ID',
      sortable: true,
      sortValue: (r) => r.desigCode,
      render: (r) => (
        <div>
          <div className="font-mono-code font-bold text-[var(--brand-600)] dark:text-[var(--brand-300)]">
            {r.desigCode}
          </div>
          <div className="font-mono-code text-[10px] text-[var(--text-muted)]">
            ID #{r.desigId}
          </div>
        </div>
      ),
    },
    {
      key: 'desigName',
      header: 'Designation Title & Company',
      sortable: true,
      sortValue: (r) => r.desigName,
      render: (r) => (
        <div>
          <div className="font-bold text-[var(--text-primary)]">
            {r.desigName}
          </div>
          <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
            <Building2 className="h-3 w-3 text-[var(--brand-500)]" />
            <span className="font-mono-code font-semibold text-[var(--text-secondary)]">
              {r.compCode}
            </span>
            <span>— {r.compName}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'deptName',
      header: 'Default Department (`dept_id`)',
      sortable: true,
      sortValue: (r) => r.deptName || '',
      render: (r) =>
        r.deptCode ? (
          <div className="text-xs">
            <span className="font-mono-code font-bold text-[var(--text-primary)]">
              {r.deptCode}
            </span>
            <div className="text-[11px] text-[var(--text-muted)]">
              {r.deptName}
            </div>
          </div>
        ) : (
          <span className="text-[11px] text-[var(--text-muted)]">
            Cross-Departmental (Any)
          </span>
        ),
    },
    {
      key: 'gradeCode',
      header: 'Grade Band & Cadre Level',
      sortable: true,
      sortValue: (r) => r.hierarchyLevel,
      render: (r) => (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/20 px-2 py-0.5 font-mono-code text-xs font-bold text-[var(--brand-600)] dark:text-[var(--brand-300)]">
            <Award className="h-3 w-3" /> {r.gradeCode}
          </span>
          <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
            Level {r.hierarchyLevel}
          </span>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Role Responsibilities',
      render: (r) => (
        <span className="text-xs text-[var(--text-secondary)] line-clamp-2">
          {r.description || '—'}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      sortable: true,
      sortValue: (r) => (r.isActive ? 1 : 0),
      render: (r) =>
        r.isActive ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Active
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Inactive
          </span>
        ),
    },
  ];

  const deptGroupByOptions: GroupByOption<DepartmentEntity>[] = [
    {
      key: 'company',
      label: 'Parent Company',
      groupValue: (r) => `${r.compCode} — ${r.compName}`,
    },
    {
      key: 'deptCategory',
      label: 'Functional Category',
      groupValue: (r) => DEPT_CATEGORY_LABELS[r.deptCategory] || r.deptCategory,
    },
  ];

  const desigGroupByOptions: GroupByOption<DesignationEntity>[] = [
    {
      key: 'department',
      label: 'Department',
      groupValue: (r) =>
        r.deptCode
          ? `${r.deptCode} — ${r.deptName}`
          : 'Cross-Departmental Roles',
    },
    {
      key: 'gradeCode',
      label: 'Grade Band',
      groupValue: (r) => `Grade ${r.gradeCode} (Level ${r.hierarchyLevel})`,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Top KPI Summary Bar & Tab Switcher */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('DEPARTMENTS')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition cursor-pointer ${
              activeTab === 'DEPARTMENTS'
                ? 'bg-[var(--brand-600)] text-white shadow-xs'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Network className="h-4 w-4" />
            <span>Departments (`tbl_hr_department`)</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-mono-code ${
                activeTab === 'DEPARTMENTS'
                  ? 'bg-white/20 text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
              }`}
            >
              {departments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DESIGNATIONS')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-extrabold transition cursor-pointer ${
              activeTab === 'DESIGNATIONS'
                ? 'bg-[var(--brand-600)] text-white shadow-xs'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Award className="h-4 w-4" />
            <span>Designations & Grades (`tbl_hr_designation`)</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-mono-code ${
                activeTab === 'DESIGNATIONS'
                  ? 'bg-white/20 text-white'
                  : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
              }`}
            >
              {designations.length}
            </span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2">
            <span className="text-[var(--text-muted)]">Active Depts: </span>
            <strong className="font-mono-code text-[var(--text-primary)]">
              {departments.filter((d) => d.isActive).length}
            </strong>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2">
            <span className="text-[var(--text-muted)]">
              Production & QC Units:{' '}
            </span>
            <strong className="font-mono-code text-emerald-600 dark:text-emerald-400">
              {
                departments.filter(
                  (d) =>
                    d.deptCategory === 'PRODUCTION' ||
                    d.deptCategory === 'QUALITY',
                ).length
              }
            </strong>
          </div>
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2">
            <span className="text-[var(--text-muted)]">
              Active Designations:{' '}
            </span>
            <strong className="font-mono-code text-[var(--brand-600)] dark:text-[var(--brand-300)]">
              {designations.filter((dg) => dg.isActive).length}
            </strong>
          </div>
        </div>
      </div>

      {/* ====================================================================
          Tab 1: Department Master (`tbl_hr_department`)
          ==================================================================== */}
      {activeTab === 'DEPARTMENTS' && (
        <MasterDataTable<DepartmentEntity>
          title="Department & Cost Center Master"
          subtitle="Manage plant functional departments, parent-child division hierarchy, and cost centers (`tbl_hr_department`)"
          screenCode="DEPT_MASTER"
          tableNameBadge="tbl_hr_department"
          data={filteredDepartments}
          rowKey={(r) => r.deptId}
          columns={deptColumns}
          isLoading={isLoading}
          addButtonLabel="Add Department"
          onAddClick={openAddDeptModal}
          onPrintClick={() => {
            void apiClient
              .post('/hr/departments/action/PRINT')
              .catch(() => {});
          }}
          onExportClick={() => {
            void apiClient
              .post('/hr/departments/action/EXPORT')
              .catch(() => {});
          }}
          searchPlaceholder="Search by dept code, department name, cost center, or company..."
          searchPredicate={(r, q) =>
            r.deptCode.toLowerCase().includes(q) ||
            r.deptName.toLowerCase().includes(q) ||
            (r.costCenterCode || '').toLowerCase().includes(q) ||
            r.compCode.toLowerCase().includes(q)
          }
          groupByOptions={deptGroupByOptions}
          filterToolbarSlot={
            <>
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
                >
                  <option value="ALL">All Companies</option>
                  {companies.map((c) => (
                    <option key={c.compId} value={c.compId}>
                      {c.compCode} — {c.compName}
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
              >
                <option value="ALL">All Functional Categories</option>
                {Object.entries(DEPT_CATEGORY_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE',
                  )
                }
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </>
          }
          renderRowActions={(row) => (
            <div className="inline-flex items-center gap-1">
              <PermissionGate screen="DEPT_MASTER" action="EDIT">
                <button
                  type="button"
                  onClick={() => openEditDeptModal(row)}
                  title="Edit Department"
                  className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--brand-500)] transition cursor-pointer"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              </PermissionGate>

              <PermissionGate screen="DEPT_MASTER" action="DELETE">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteDependencies([]);
                    setDeleteTarget({
                      type: 'DEPARTMENT',
                      id: row.deptId,
                      code: row.deptCode,
                      name: row.deptName,
                    });
                  }}
                  title="Delete Department (Pre-Checked by DependencyCheckService)"
                  className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-rose-500/10 hover:text-rose-500 transition cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </PermissionGate>
            </div>
          )}
        />
      )}

      {/* ====================================================================
          Tab 2: Designation Master (`tbl_hr_designation`)
          ==================================================================== */}
      {activeTab === 'DESIGNATIONS' && (
        <MasterDataTable<DesignationEntity>
          title="Designation & Cadre Hierarchy Master"
          subtitle="Define job titles, grade bands (`E1`, `M1`, `L1`–`L5`), and organizational hierarchy levels (`tbl_hr_designation`)"
          screenCode="DEPT_MASTER"
          tableNameBadge="tbl_hr_designation"
          data={filteredDesignations}
          rowKey={(r) => r.desigId}
          columns={desigColumns}
          isLoading={isLoading}
          addButtonLabel="Add Designation"
          onAddClick={openAddDesigModal}
          onPrintClick={() => {
            void apiClient
              .post('/hr/designations/action/PRINT')
              .catch(() => {});
          }}
          onExportClick={() => {
            void apiClient
              .post('/hr/designations/action/EXPORT')
              .catch(() => {});
          }}
          searchPlaceholder="Search by designation code, title, grade band, or department..."
          searchPredicate={(r, q) =>
            r.desigCode.toLowerCase().includes(q) ||
            r.desigName.toLowerCase().includes(q) ||
            r.gradeCode.toLowerCase().includes(q) ||
            (r.deptName || '').toLowerCase().includes(q)
          }
          groupByOptions={desigGroupByOptions}
          filterToolbarSlot={
            <>
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-[var(--text-muted)]" />
                <select
                  value={companyFilter}
                  onChange={(e) => setCompanyFilter(e.target.value)}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
                >
                  <option value="ALL">All Companies</option>
                  {companies.map((c) => (
                    <option key={c.compId} value={c.compId}>
                      {c.compCode} — {c.compName}
                    </option>
                  ))}
                </select>
              </div>

              <select
                value={deptFilterForDesig}
                onChange={(e) => setDeptFilterForDesig(e.target.value)}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
              >
                <option value="ALL">All Departments</option>
                {departments.map((d) => (
                  <option key={d.deptId} value={d.deptId}>
                    {d.deptCode} — {d.deptName}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE',
                  )
                }
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </>
          }
          renderRowActions={(row) => (
            <div className="inline-flex items-center gap-1">
              <PermissionGate screen="DEPT_MASTER" action="EDIT">
                <button
                  type="button"
                  onClick={() => openEditDesigModal(row)}
                  title="Edit Designation"
                  className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--brand-500)] transition cursor-pointer"
                >
                  <Edit3 className="h-4 w-4" />
                </button>
              </PermissionGate>

              <PermissionGate screen="DEPT_MASTER" action="DELETE">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleteDependencies([]);
                    setDeleteTarget({
                      type: 'DESIGNATION',
                      id: row.desigId,
                      code: row.desigCode,
                      name: row.desigName,
                    });
                  }}
                  title="Delete Designation (Pre-Checked by DependencyCheckService)"
                  className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-rose-500/10 hover:text-rose-500 transition cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </PermissionGate>
            </div>
          )}
        />
      )}

      {/* ====================================================================
          Modal 1: Add / Edit Department (`tbl_hr_department`)
          ==================================================================== */}
      {isDeptModalOpen && (
        <div
          onClick={() => setIsDeptModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden my-8"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-600)] text-white">
                  <Network className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                    {editingDept
                      ? `Edit Department — ${editingDept.deptCode} (#${editingDept.deptId})`
                      : 'Create New Department'}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Persists to `tbl_hr_department` with JSONB delta audit
                    logging
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeptModalOpen(false)}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveDepartment}
              className="p-6 space-y-4 text-xs"
            >
              {deptFormError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 font-semibold text-rose-600 dark:text-rose-300">
                  {deptFormError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Parent Company (`comp_id`) *
                  </label>
                  <select
                    required
                    value={deptForm.compId}
                    onChange={(e) =>
                      setDeptForm((s) => ({
                        ...s,
                        compId: Number(e.target.value),
                        parentDeptId: '',
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                  >
                    {companies.map((c) => (
                      <option key={c.compId} value={c.compId}>
                        {c.compCode} — {c.compName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Functional Category (`dept_category`) *
                  </label>
                  <select
                    value={deptForm.deptCategory}
                    onChange={(e) =>
                      setDeptForm((s) => ({
                        ...s,
                        deptCategory: e.target.value as DepartmentCategory,
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                  >
                    {Object.entries(DEPT_CATEGORY_LABELS).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Department Code (`dept_code`) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={30}
                    placeholder="e.g. PROD-CNC"
                    value={deptForm.deptCode}
                    onChange={(e) =>
                      setDeptForm((s) => ({
                        ...s,
                        deptCode: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono-code font-bold uppercase text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Cost Center Code (`cost_center_code`)
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    placeholder="e.g. CC-PROD-101"
                    value={deptForm.costCenterCode}
                    onChange={(e) =>
                      setDeptForm((s) => ({
                        ...s,
                        costCenterCode: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono-code font-semibold text-[var(--text-primary)]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Department Name (`dept_name`) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    placeholder="e.g. CNC Machining & Assembly Shopfloor"
                    value={deptForm.deptName}
                    onChange={(e) =>
                      setDeptForm((s) => ({ ...s, deptName: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Parent Department (`parent_dept_id`)
                  </label>
                  <select
                    value={deptForm.parentDeptId}
                    onChange={(e) =>
                      setDeptForm((s) => ({
                        ...s,
                        parentDeptId: e.target.value
                          ? Number(e.target.value)
                          : '',
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                  >
                    <option value="">None (Top-Level Division)</option>
                    {departments
                      .filter(
                        (d) =>
                          d.compId === deptForm.compId &&
                          d.deptId !== editingDept?.deptId,
                      )
                      .map((d) => (
                        <option key={d.deptId} value={d.deptId}>
                          {d.deptCode} — {d.deptName}
                        </option>
                      ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Functional Description (`description`)
                  </label>
                  <textarea
                    rows={2}
                    maxLength={300}
                    placeholder="Describe shopfloor lines, quality responsibilities, or store scope..."
                    value={deptForm.description}
                    onChange={(e) =>
                      setDeptForm((s) => ({
                        ...s,
                        description: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-medium text-[var(--text-primary)]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={deptForm.isActive}
                      onChange={(e) =>
                        setDeptForm((s) => ({
                          ...s,
                          isActive: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded accent-[var(--brand-600)]"
                    />
                    <span className="font-bold text-[var(--text-primary)]">
                      Department is Active (`is_active`)
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-[var(--border-subtle)] pt-4">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2 font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] px-5 py-2 font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSaving
                    ? 'Saving...'
                    : editingDept
                      ? 'Update Department'
                      : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          Modal 2: Add / Edit Designation (`tbl_hr_designation`)
          ==================================================================== */}
      {isDesigModalOpen && (
        <div
          onClick={() => setIsDesigModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden my-8"
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-600)] text-white">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                    {editingDesig
                      ? `Edit Designation — ${editingDesig.desigCode} (#${editingDesig.desigId})`
                      : 'Create New Job Designation'}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Persists to `tbl_hr_designation` with grade & cadre level
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDesigModalOpen(false)}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={handleSaveDesignation}
              className="p-6 space-y-4 text-xs"
            >
              {desigFormError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 font-semibold text-rose-600 dark:text-rose-300">
                  {desigFormError}
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Parent Company (`comp_id`) *
                  </label>
                  <select
                    required
                    value={desigForm.compId}
                    onChange={(e) => {
                      const nextCompId = Number(e.target.value);
                      const firstDept = departments.find(
                        (d) => d.compId === nextCompId,
                      );
                      setDesigForm((s) => ({
                        ...s,
                        compId: nextCompId,
                        deptId: firstDept?.deptId || '',
                      }));
                    }}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                  >
                    {companies.map((c) => (
                      <option key={c.compId} value={c.compId}>
                        {c.compCode} — {c.compName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Default Department (`dept_id`)
                  </label>
                  <select
                    value={desigForm.deptId}
                    onChange={(e) =>
                      setDesigForm((s) => ({
                        ...s,
                        deptId: e.target.value ? Number(e.target.value) : '',
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                  >
                    <option value="">Cross-Departmental (Any Dept)</option>
                    {departments
                      .filter((d) => d.compId === desigForm.compId)
                      .map((d) => (
                        <option key={d.deptId} value={d.deptId}>
                          {d.deptCode} — {d.deptName}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Designation Code (`desig_code`) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={30}
                    placeholder="e.g. PLANT-MGR"
                    value={desigForm.desigCode}
                    onChange={(e) =>
                      setDesigForm((s) => ({
                        ...s,
                        desigCode: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono-code font-bold uppercase text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Designation Title (`desig_name`) *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={120}
                    placeholder="e.g. Plant Operations Manager"
                    value={desigForm.desigName}
                    onChange={(e) =>
                      setDesigForm((s) => ({
                        ...s,
                        desigName: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Grade Band (`grade_code`) *
                  </label>
                  <select
                    value={desigForm.gradeCode}
                    onChange={(e) => {
                      const selected = GRADE_OPTIONS.find(
                        (g) => g.code === e.target.value,
                      );
                      setDesigForm((s) => ({
                        ...s,
                        gradeCode: e.target.value,
                        hierarchyLevel:
                          selected?.defaultLevel ?? s.hierarchyLevel,
                      }));
                    }}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                  >
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g.code} value={g.code}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Hierarchy Level (`1` = Top Exec ... `8` = Operator) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    max={10}
                    value={desigForm.hierarchyLevel}
                    onChange={(e) =>
                      setDesigForm((s) => ({
                        ...s,
                        hierarchyLevel: Number(e.target.value || 1),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono-code font-bold text-[var(--text-primary)]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Role Responsibilities (`description`)
                  </label>
                  <textarea
                    rows={2}
                    maxLength={300}
                    placeholder="Key operational authorities, shopfloor responsibilities, or approval scope..."
                    value={desigForm.description}
                    onChange={(e) =>
                      setDesigForm((s) => ({
                        ...s,
                        description: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-medium text-[var(--text-primary)]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={desigForm.isActive}
                      onChange={(e) =>
                        setDesigForm((s) => ({
                          ...s,
                          isActive: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded accent-[var(--brand-600)]"
                    />
                    <span className="font-bold text-[var(--text-primary)]">
                      Designation is Active (`is_active`)
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-[var(--border-subtle)] pt-4">
                <button
                  type="button"
                  onClick={() => setIsDesigModalOpen(false)}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2 font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] px-5 py-2 font-bold text-white shadow-xs transition cursor-pointer disabled:opacity-50"
                >
                  {isSaving
                    ? 'Saving...'
                    : editingDesig
                      ? 'Update Designation'
                      : 'Create Designation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          Modal 3: Pre-Delete Dependency Verification Modal
          ==================================================================== */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        entityType={
          deleteTarget?.type === 'DEPARTMENT' ? 'Department' : 'Designation'
        }
        entityName={deleteTarget ? deleteTarget.name : ''}
        entityCode={
          deleteTarget ? `${deleteTarget.code} (#${deleteTarget.id})` : ''
        }
        isDeleting={isDeleting}
        errorMessage={deleteError}
        dependencies={deleteDependencies}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
};
