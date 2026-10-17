import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  CalendarRange,
  CheckCircle2,
  Edit3,
  Filter,
  GitBranch,
  Lock,
  LockOpen,
  ShieldAlert,
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

export interface BranchLockMapping {
  branchFyearId: number | null;
  compId: number;
  branchId: number;
  fyearId: number;
  branchCode: string;
  branchName: string;
  branchType: string;
  city: string | null;
  isLocked: boolean;
  booksBeginFrom: string;
  isActive: boolean;
}

export interface FinancialYearEntity {
  fyearId: number;
  compId: number;
  compCode: string;
  compName: string;
  fyearCode: string;
  fyearName: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isClosed: boolean;
  isActive: boolean;
  branchLocks: BranchLockMapping[];
}

interface CompanyLookup {
  compId: number;
  compCode: string;
  compName: string;
}

const FALLBACK_COMPANIES: CompanyLookup[] = [
  { compId: 1001, compCode: 'KSMFG', compName: 'Kashvira Manufacturing ERP' },
  { compId: 1002, compCode: 'KSAUTO', compName: 'Kashvira Auto Components' },
  {
    compId: 1003,
    compCode: 'KSVALVE',
    compName: 'Kashvira Industrial Valves',
  },
  {
    compId: 1004,
    compCode: 'KSCAST',
    compName: 'Kashvira Alloy Castings (Subsidiary)',
  },
];

const FALLBACK_FYEARS: FinancialYearEntity[] = [
  {
    fyearId: 1001,
    compId: 1001,
    compCode: 'KSMFG',
    compName: 'Kashvira Manufacturing ERP',
    fyearCode: '2026-27',
    fyearName: 'FY 2026-2027',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    isCurrent: true,
    isClosed: false,
    isActive: true,
    branchLocks: [
      {
        branchFyearId: 1001,
        compId: 1001,
        branchId: 1001,
        fyearId: 1001,
        branchCode: 'PLT-AHM-01',
        branchName: 'Ahmedabad Main Plant & HO',
        branchType: 'PLANT',
        city: 'Ahmedabad',
        isLocked: false,
        booksBeginFrom: '2026-04-01',
        isActive: true,
      },
      {
        branchFyearId: 1002,
        compId: 1001,
        branchId: 1002,
        fyearId: 1001,
        branchCode: 'PLT-RAJ-02',
        branchName: 'Rajkot CNC & Foundry Unit',
        branchType: 'PLANT',
        city: 'Rajkot',
        isLocked: false,
        booksBeginFrom: '2026-04-01',
        isActive: true,
      },
      {
        branchFyearId: 1005,
        compId: 1001,
        branchId: 1004,
        fyearId: 1001,
        branchCode: 'WH-SRT-03',
        branchName: 'Surat Regional Distribution Hub',
        branchType: 'WAREHOUSE',
        city: 'Surat',
        isLocked: false,
        booksBeginFrom: '2026-04-01',
        isActive: true,
      },
      {
        branchFyearId: 1006,
        compId: 1001,
        branchId: 1006,
        fyearId: 1001,
        branchCode: 'SO-MUM-01',
        branchName: 'Mumbai Western Region Sales Office',
        branchType: 'SALES_OFFICE',
        city: 'Mumbai',
        isLocked: false,
        booksBeginFrom: '2026-04-01',
        isActive: true,
      },
    ],
  },
  {
    fyearId: 1002,
    compId: 1001,
    compCode: 'KSMFG',
    compName: 'Kashvira Manufacturing ERP',
    fyearCode: '2025-26',
    fyearName: 'FY 2025-2026',
    startDate: '2025-04-01',
    endDate: '2026-03-31',
    isCurrent: false,
    isClosed: false,
    isActive: true,
    branchLocks: [
      {
        branchFyearId: 1003,
        compId: 1001,
        branchId: 1001,
        fyearId: 1002,
        branchCode: 'PLT-AHM-01',
        branchName: 'Ahmedabad Main Plant & HO',
        branchType: 'PLANT',
        city: 'Ahmedabad',
        isLocked: true,
        booksBeginFrom: '2025-04-01',
        isActive: true,
      },
      {
        branchFyearId: 1007,
        compId: 1001,
        branchId: 1002,
        fyearId: 1002,
        branchCode: 'PLT-RAJ-02',
        branchName: 'Rajkot CNC & Foundry Unit',
        branchType: 'PLANT',
        city: 'Rajkot',
        isLocked: true,
        booksBeginFrom: '2025-04-01',
        isActive: true,
      },
      {
        branchFyearId: null,
        compId: 1001,
        branchId: 1004,
        fyearId: 1002,
        branchCode: 'WH-SRT-03',
        branchName: 'Surat Regional Distribution Hub',
        branchType: 'WAREHOUSE',
        city: 'Surat',
        isLocked: false,
        booksBeginFrom: '2025-04-01',
        isActive: true,
      },
    ],
  },
  {
    fyearId: 1004,
    compId: 1001,
    compCode: 'KSMFG',
    compName: 'Kashvira Manufacturing ERP',
    fyearCode: '2024-25',
    fyearName: 'FY 2024-2025 (Audited & Closed)',
    startDate: '2024-04-01',
    endDate: '2025-03-31',
    isCurrent: false,
    isClosed: true,
    isActive: true,
    branchLocks: [
      {
        branchFyearId: 1008,
        compId: 1001,
        branchId: 1001,
        fyearId: 1004,
        branchCode: 'PLT-AHM-01',
        branchName: 'Ahmedabad Main Plant & HO',
        branchType: 'PLANT',
        city: 'Ahmedabad',
        isLocked: true,
        booksBeginFrom: '2024-04-01',
        isActive: true,
      },
      {
        branchFyearId: null,
        compId: 1001,
        branchId: 1002,
        fyearId: 1004,
        branchCode: 'PLT-RAJ-02',
        branchName: 'Rajkot CNC & Foundry Unit',
        branchType: 'PLANT',
        city: 'Rajkot',
        isLocked: true,
        booksBeginFrom: '2024-04-01',
        isActive: true,
      },
    ],
  },
  {
    fyearId: 1003,
    compId: 1002,
    compCode: 'KSAUTO',
    compName: 'Kashvira Auto Components',
    fyearCode: '2026-27',
    fyearName: 'FY 2026-2027',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    isCurrent: true,
    isClosed: false,
    isActive: true,
    branchLocks: [
      {
        branchFyearId: 1004,
        compId: 1002,
        branchId: 1003,
        fyearId: 1003,
        branchCode: 'PLT-PNQ-01',
        branchName: 'Pune Chakan Assembly Plant',
        branchType: 'PLANT',
        city: 'Pune',
        isLocked: false,
        booksBeginFrom: '2026-04-01',
        isActive: true,
      },
    ],
  },
  {
    fyearId: 1005,
    compId: 1003,
    compCode: 'KSVALVE',
    compName: 'Kashvira Industrial Valves',
    fyearCode: '2026-27',
    fyearName: 'FY 2026-2027',
    startDate: '2026-04-01',
    endDate: '2027-03-31',
    isCurrent: true,
    isClosed: false,
    isActive: true,
    branchLocks: [
      {
        branchFyearId: 1009,
        compId: 1003,
        branchId: 1005,
        fyearId: 1005,
        branchCode: 'PLT-VTV-01',
        branchName: 'Vatva High-Pressure Valve Unit',
        branchType: 'PLANT',
        city: 'Ahmedabad',
        isLocked: false,
        booksBeginFrom: '2026-04-01',
        isActive: true,
      },
    ],
  },
];

const EMPTY_FORM = {
  compId: 1001,
  fyearCode: '2027-28',
  fyearName: 'FY 2027-2028',
  startDate: '2027-04-01',
  endDate: '2028-03-31',
  isCurrent: false,
  isClosed: false,
  isActive: true,
};

export const FinancialYearMasterPage: React.FC = () => {
  const [fyears, setFyears] = useState<FinancialYearEntity[]>(FALLBACK_FYEARS);
  const [companies, setCompanies] =
    useState<CompanyLookup[]>(FALLBACK_COMPANIES);
  const [isLoading, setIsLoading] = useState(false);

  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [periodFilter, setPeriodFilter] = useState<
    'ALL' | 'OPEN' | 'CLOSED' | 'CURRENT'
  >('ALL');

  // Add / Edit Financial Year Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFy, setEditingFy] = useState<FinancialYearEntity | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Branch-Wise FY Activation & Period Locking Modal State
  const [lockModalFyId, setLockModalFyId] = useState<number | null>(null);
  const [togglingBranchId, setTogglingBranchId] = useState<number | null>(null);

  // Delete Confirmation & Dependency Conflict Modal State
  const [deleteTarget, setDeleteTarget] =
    useState<FinancialYearEntity | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDependencies, setDeleteDependencies] = useState<
    DependencyConflictItem[]
  >([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [fyRes, compRes] = await Promise.all([
        apiClient.get('/org/financial-years'),
        apiClient.get('/org/companies'),
      ]);
      if (Array.isArray(fyRes.data?.data)) {
        setFyears(fyRes.data.data);
      }
      if (Array.isArray(compRes.data?.data)) {
        setCompanies(compRes.data.data);
      }
    } catch {
      // Retain seeded fallback records if local PostgreSQL is offline
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const filteredData = useMemo(() => {
    return fyears.filter((f) => {
      if (companyFilter !== 'ALL' && f.compId !== Number(companyFilter)) {
        return false;
      }
      if (periodFilter === 'OPEN' && f.isClosed) return false;
      if (periodFilter === 'CLOSED' && !f.isClosed) return false;
      if (periodFilter === 'CURRENT' && !f.isCurrent) return false;
      return true;
    });
  }, [fyears, companyFilter, periodFilter]);

  const activeLockModalFy = useMemo(
    () => fyears.find((f) => f.fyearId === lockModalFyId) || null,
    [fyears, lockModalFyId],
  );

  // Sync lock status into useAuthStore so top header Read-Only Period badge updates immediately
  const syncAuthStoreLockState = (
    fyearId: number,
    branchId: number,
    isLocked: boolean,
  ) => {
    const authState = useAuthStore.getState();
    const updatedAllowedFys = authState.allowedFinancialYears.map((fy) => {
      if (
        fy.fyearId === fyearId &&
        (fy.mappedBranchId === branchId || fy.mappedBranchId == null)
      ) {
        return { ...fy, isLocked };
      }
      return fy;
    });
    useAuthStore.setState({ allowedFinancialYears: updatedAllowedFys });
  };

  const applyPresetYear = (startYear: number) => {
    const endYear = startYear + 1;
    const shortEnd = String(endYear).slice(2);
    setFormData((s) => ({
      ...s,
      fyearCode: `${startYear}-${shortEnd}`,
      fyearName: `FY ${startYear}-${endYear}`,
      startDate: `${startYear}-04-01`,
      endDate: `${endYear}-03-31`,
    }));
  };

  const openAddModal = () => {
    setEditingFy(null);
    setFormError(null);
    setFormData({
      ...EMPTY_FORM,
      compId: companies[0]?.compId || 1001,
    });
    setIsFormOpen(true);
  };

  const openEditModal = (fy: FinancialYearEntity) => {
    setEditingFy(fy);
    setFormError(null);
    setFormData({
      compId: fy.compId,
      fyearCode: fy.fyearCode,
      fyearName: fy.fyearName,
      startDate: fy.startDate,
      endDate: fy.endDate,
      isCurrent: fy.isCurrent,
      isClosed: fy.isClosed,
      isActive: fy.isActive,
    });
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (formData.endDate < formData.startDate) {
      setFormError('End Date must be on or after Start Date.');
      return;
    }

    setIsSaving(true);
    try {
      if (editingFy) {
        const res = await apiClient.put(
          `/org/financial-years/${editingFy.fyearId}`,
          formData,
        );
        const updated = res.data?.data;
        if (updated) {
          setFyears((prev) =>
            prev.map((f) => (f.fyearId === editingFy.fyearId ? updated : f)),
          );
        }
      } else {
        const res = await apiClient.post('/org/financial-years', formData);
        const created = res.data?.data;
        if (created) {
          setFyears((prev) => [created, ...prev]);
        }
      }
      setIsFormOpen(false);
    } catch (err: any) {
      if (err?.response?.status) {
        setFormError(
          err.response.data?.message || 'Failed to save financial year.',
        );
        setIsSaving(false);
        return;
      }

      // Local demo mode fallback when backend server is not running
      const duplicate = fyears.some(
        (f) =>
          f.compId === formData.compId &&
          f.fyearCode.toLowerCase() ===
            formData.fyearCode.trim().toLowerCase() &&
          f.fyearId !== editingFy?.fyearId,
      );
      if (duplicate) {
        setFormError(
          `Financial Year "${formData.fyearCode}" already exists for the selected company.`,
        );
        setIsSaving(false);
        return;
      }

      const parentComp =
        companies.find((c) => c.compId === formData.compId) ||
        FALLBACK_COMPANIES[0];

      if (editingFy) {
        setFyears((prev) =>
          prev.map((f) => {
            if (f.fyearId === editingFy.fyearId) {
              const updatedLocks = formData.isClosed
                ? f.branchLocks.map((bl) => ({ ...bl, isLocked: true }))
                : f.branchLocks;
              return {
                ...f,
                ...formData,
                compCode: parentComp.compCode,
                compName: parentComp.compName,
                branchLocks: updatedLocks,
              };
            }
            if (formData.isCurrent && f.compId === formData.compId) {
              return { ...f, isCurrent: false };
            }
            return f;
          }),
        );
      } else {
        const nextId = Math.max(...fyears.map((f) => f.fyearId), 1000) + 1;
        const sampleBranches =
          fyears.find((f) => f.compId === formData.compId)?.branchLocks || [];
        const newFy: FinancialYearEntity = {
          ...formData,
          fyearId: nextId,
          compCode: parentComp.compCode,
          compName: parentComp.compName,
          branchLocks: sampleBranches.map((bl, idx) => ({
            ...bl,
            branchFyearId: 2000 + nextId + idx,
            fyearId: nextId,
            isLocked: Boolean(formData.isClosed),
            booksBeginFrom: formData.startDate,
          })),
        };
        setFyears((prev) => [
          newFy,
          ...prev.map((f) =>
            formData.isCurrent && f.compId === formData.compId
              ? { ...f, isCurrent: false }
              : f,
          ),
        ]);
      }
      setIsFormOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleBranchLock = async (
    fy: FinancialYearEntity,
    mapping: BranchLockMapping,
  ) => {
    if (fy.isClosed) return; // Closed FY cannot be unlocked at branch level unless reopened
    const nextLocked = !mapping.isLocked;
    setTogglingBranchId(mapping.branchId);

    try {
      const res = await apiClient.patch('/org/financial-years/branch-lock', {
        compId: fy.compId,
        branchId: mapping.branchId,
        fyearId: fy.fyearId,
        isLocked: nextLocked,
        booksBeginFrom: mapping.booksBeginFrom || fy.startDate,
        isActive: true,
      });
      const updatedFy = res.data?.data;
      if (updatedFy) {
        setFyears((prev) =>
          prev.map((f) => (f.fyearId === fy.fyearId ? updatedFy : f)),
        );
      }
      syncAuthStoreLockState(fy.fyearId, mapping.branchId, nextLocked);
    } catch {
      // Offline fallback update
      setFyears((prev) =>
        prev.map((f) => {
          if (f.fyearId !== fy.fyearId) return f;
          return {
            ...f,
            branchLocks: f.branchLocks.map((bl) =>
              bl.branchId === mapping.branchId
                ? { ...bl, isLocked: nextLocked }
                : bl,
            ),
          };
        }),
      );
      syncAuthStoreLockState(fy.fyearId, mapping.branchId, nextLocked);
    } finally {
      setTogglingBranchId(null);
    }
  };

  const openDeleteModal = (fy: FinancialYearEntity) => {
    setDeleteTarget(fy);
    setDeleteError(null);
    setDeleteDependencies([]);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    setDeleteDependencies([]);

    try {
      await apiClient.delete(`/org/financial-years/${deleteTarget.fyearId}`);
      setFyears((prev) =>
        prev.filter((f) => f.fyearId !== deleteTarget.fyearId),
      );
      setDeleteTarget(null);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setDeleteError(err.response.data?.message);
        setDeleteDependencies(err.response.data?.details || []);
        setIsDeleting(false);
        return;
      }
      if (err?.response?.status) {
        setDeleteError(
          err.response.data?.message || 'Unable to delete financial year.',
        );
        setIsDeleting(false);
        return;
      }

      // Offline fallback simulation of DependencyCheckService
      const mappedCount = deleteTarget.branchLocks.filter(
        (bl) => bl.branchFyearId !== null,
      ).length;
      if (mappedCount > 0 || deleteTarget.fyearId === 1001) {
        const deps: DependencyConflictItem[] = [
          {
            table: 'tbl_org_branch_fyear',
            label: 'Branch Financial Year Lock Mappings',
            count: Math.max(mappedCount, 1),
          },
        ];
        if (deleteTarget.fyearId === 1001) {
          deps.push({
            table: 'tbl_sec_user_preference',
            label: 'User Default Financial Year Preferences',
            count: 1,
          });
        }
        setDeleteError(
          `Cannot delete FINANCIAL_YEAR #${deleteTarget.fyearId} (${deleteTarget.fyearCode}) because it has active branch period mappings.`,
        );
        setDeleteDependencies(deps);
        setIsDeleting(false);
        return;
      }

      setFyears((prev) =>
        prev.filter((f) => f.fyearId !== deleteTarget.fyearId),
      );
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: MasterTableColumn<FinancialYearEntity>[] = [
    {
      key: 'fyearCode',
      header: 'FY Code & ID',
      sortable: true,
      sortValue: (r) => r.fyearCode,
      render: (r) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono-code font-bold text-[var(--brand-600)] dark:text-[var(--brand-300)]">
              {r.fyearCode}
            </span>
            {r.isCurrent && (
              <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                Current
              </span>
            )}
          </div>
          <div className="font-mono-code text-[10px] text-[var(--text-muted)]">
            ID #{r.fyearId}
          </div>
        </div>
      ),
    },
    {
      key: 'fyearName',
      header: 'Accounting Period & Parent Company',
      sortable: true,
      sortValue: (r) => r.fyearName,
      render: (r) => (
        <div>
          <div className="font-bold text-[var(--text-primary)]">
            {r.fyearName}
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
      key: 'startDate',
      header: 'Period Duration',
      sortable: true,
      sortValue: (r) => r.startDate,
      render: (r) => (
        <div className="font-mono-code text-xs">
          <span className="font-semibold text-[var(--text-primary)]">
            {r.startDate}
          </span>
          <span className="mx-1.5 text-[var(--text-muted)]">→</span>
          <span className="font-semibold text-[var(--text-primary)]">
            {r.endDate}
          </span>
        </div>
      ),
    },
    {
      key: 'branchLocks',
      header: 'Branch-Wise Locking (`tbl_org_branch_fyear`)',
      render: (r) => {
        const total = r.branchLocks.length;
        const lockedCnt = r.branchLocks.filter((b) => b.isLocked).length;
        const openCnt = total - lockedCnt;

        return (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLockModalFyId(r.fyearId)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--brand-500)] transition cursor-pointer"
            >
              {lockedCnt > 0 ? (
                <Lock className="h-3.5 w-3.5 text-amber-500" />
              ) : (
                <LockOpen className="h-3.5 w-3.5 text-emerald-500" />
              )}
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                {openCnt} Open
              </span>
              <span className="text-[var(--text-muted)]">/</span>
              <span
                className={
                  lockedCnt > 0
                    ? 'text-amber-600 dark:text-amber-400 font-bold'
                    : 'text-[var(--text-muted)]'
                }
              >
                {lockedCnt} Locked
              </span>
              <span className="ml-1 rounded-md bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/20 px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand-600)] dark:text-[var(--brand-300)]">
                Configure
              </span>
            </button>
          </div>
        );
      },
    },
    {
      key: 'isClosed',
      header: 'Year Status',
      sortable: true,
      sortValue: (r) => (r.isClosed ? 1 : 0),
      render: (r) =>
        r.isClosed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-300">
            <Lock className="h-3 w-3" /> Year Closed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> Open for Entry
          </span>
        ),
    },
  ];

  const groupByOptions: GroupByOption<FinancialYearEntity>[] = [
    {
      key: 'company',
      label: 'Parent Company',
      groupValue: (r) => `${r.compCode} — ${r.compName}`,
    },
    {
      key: 'periodState',
      label: 'Accounting Period State',
      groupValue: (r) =>
        r.isClosed
          ? 'Closed / Audited Financial Years'
          : 'Open Operational Financial Years',
    },
  ];

  return (
    <>
      <MasterDataTable<FinancialYearEntity>
        title="Financial Year & Branch Period Locking"
        subtitle="Define company accounting periods (`tbl_org_financial_year`) and control branch-wise backdated voucher locking (`tbl_org_branch_fyear`)"
        screenCode="FYEAR_MASTER"
        tableNameBadge="tbl_org_financial_year"
        data={filteredData}
        rowKey={(r) => r.fyearId}
        columns={columns}
        isLoading={isLoading}
        addButtonLabel="Add Financial Year"
        onAddClick={openAddModal}
        onPrintClick={() => {
          void apiClient
            .post('/org/financial-years/action/PRINT')
            .catch(() => {});
        }}
        onExportClick={() => {
          void apiClient
            .post('/org/financial-years/action/EXPORT')
            .catch(() => {});
        }}
        searchPlaceholder="Search by FY code (e.g. 2026-27), period name, or company..."
        searchPredicate={(r, q) =>
          r.fyearCode.toLowerCase().includes(q) ||
          r.fyearName.toLowerCase().includes(q) ||
          r.compCode.toLowerCase().includes(q) ||
          r.compName.toLowerCase().includes(q)
        }
        groupByOptions={groupByOptions}
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
              value={periodFilter}
              onChange={(e) =>
                setPeriodFilter(
                  e.target.value as 'ALL' | 'OPEN' | 'CLOSED' | 'CURRENT',
                )
              }
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
            >
              <option value="ALL">All Accounting Periods</option>
              <option value="CURRENT">Current Active FY Only</option>
              <option value="OPEN">Open Periods Only</option>
              <option value="CLOSED">Closed / Audited Periods</option>
            </select>
          </>
        }
        renderRowActions={(row) => (
          <div className="inline-flex items-center gap-1">
            <PermissionGate screen="FYEAR_MASTER" action="EDIT">
              <button
                type="button"
                onClick={() => setLockModalFyId(row.fyearId)}
                title="Manage Branch-Wise Period Locks"
                className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-amber-500 transition cursor-pointer"
              >
                <Lock className="h-4 w-4" />
              </button>
            </PermissionGate>

            <PermissionGate screen="FYEAR_MASTER" action="EDIT">
              <button
                type="button"
                onClick={() => openEditModal(row)}
                title="Edit Financial Year"
                className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--brand-500)] transition cursor-pointer"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            </PermissionGate>

            <PermissionGate screen="FYEAR_MASTER" action="DELETE">
              <button
                type="button"
                onClick={() => openDeleteModal(row)}
                title="Delete Financial Year (Pre-Checked by DependencyCheckService)"
                className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-rose-500/10 hover:text-rose-500 transition cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </PermissionGate>
          </div>
        )}
      />

      {/* ====================================================================
          Modal 1: Add / Edit Financial Year (`tbl_org_financial_year`)
          ==================================================================== */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-600)] text-white">
                  <CalendarRange className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                    {editingFy
                      ? `Edit Financial Year — ${editingFy.fyearCode} (#${editingFy.fyearId})`
                      : 'Create New Accounting Financial Year'}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Auto-initializes branch period mappings in
                    `tbl_org_branch_fyear`
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 font-semibold text-rose-600 dark:text-rose-300">
                  {formError}
                </div>
              )}

              {/* Quick Indian April–March Preset Buttons */}
              {!editingFy && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 flex items-center justify-between">
                  <span className="font-bold text-[var(--text-secondary)]">
                    Quick April–March Preset:
                  </span>
                  <div className="flex items-center gap-1.5">
                    {[2025, 2026, 2027, 2028].map((yr) => (
                      <button
                        key={yr}
                        type="button"
                        onClick={() => applyPresetYear(yr)}
                        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 font-mono-code font-bold text-[var(--brand-600)] dark:text-[var(--brand-300)] hover:border-[var(--brand-500)] transition cursor-pointer"
                      >
                        {yr}-{String(yr + 1).slice(2)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Parent Company */}
              <div>
                <label className="block font-bold text-[var(--text-secondary)] mb-1">
                  Parent Company Entity (`comp_id`) *
                </label>
                <select
                  value={formData.compId}
                  onChange={(e) =>
                    setFormData((s) => ({
                      ...s,
                      compId: Number(e.target.value),
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

              {/* FY Code & Name */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Financial Year Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 2026-27"
                    value={formData.fyearCode}
                    onChange={(e) =>
                      setFormData((s) => ({ ...s, fyearCode: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono-code font-bold text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Period Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. FY 2026-2027"
                    value={formData.fyearName}
                    onChange={(e) =>
                      setFormData((s) => ({ ...s, fyearName: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {/* Start Date & End Date */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Books Start Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData((s) => ({ ...s, startDate: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono-code text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Books End Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData((s) => ({ ...s, endDate: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono-code text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {/* Current FY & Closed Flags */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Default Current Period?
                  </label>
                  <select
                    value={formData.isCurrent ? 'true' : 'false'}
                    onChange={(e) =>
                      setFormData((s) => ({
                        ...s,
                        isCurrent: e.target.value === 'true',
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                  >
                    <option value="true">Yes — Active Default FY</option>
                    <option value="false">No — Historical / Future FY</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Year-End Hard Close Status
                  </label>
                  <select
                    value={formData.isClosed ? 'true' : 'false'}
                    onChange={(e) =>
                      setFormData((s) => ({
                        ...s,
                        isClosed: e.target.value === 'true',
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                  >
                    <option value="false">Open for Transactions</option>
                    <option value="true">Closed (Locks All Branches)</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 border-t border-[var(--border-subtle)] pt-4">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 font-semibold text-[var(--text-secondary)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] disabled:opacity-50 px-5 py-2 font-bold text-white shadow-xs transition cursor-pointer"
                >
                  {isSaving
                    ? 'Saving...'
                    : editingFy
                      ? 'Update Financial Year'
                      : 'Create Financial Year'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          Modal 2: Branch-Wise FY Activation & Period Locking (`tbl_org_branch_fyear`)
          ==================================================================== */}
      {activeLockModalFy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                    Branch-Wise Period Locking — {activeLockModalFy.fyearName} (
                    {activeLockModalFy.compCode})
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Locking a branch for `{activeLockModalFy.fyearCode}` blocks
                    backdated voucher creation/edits (`is_locked = TRUE` in
                    `tbl_org_branch_fyear`)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLockModalFyId(null)}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 text-xs">
              {activeLockModalFy.isClosed && (
                <div className="flex items-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-700 dark:text-amber-300 font-semibold">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>
                    This Financial Year is globally marked as{' '}
                    <strong>Year Closed (`is_closed = TRUE`)</strong>. All
                    branches are locked until the financial year is reopened.
                  </span>
                </div>
              )}

              <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      <th className="py-2.5 px-4">Branch / Plant</th>
                      <th className="py-2.5 px-4">Books Begin From</th>
                      <th className="py-2.5 px-4">Voucher Entry Status</th>
                      <th className="py-2.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {activeLockModalFy.branchLocks.map((bl) => (
                      <tr
                        key={bl.branchId}
                        className="hover:bg-[var(--bg-hover)]"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                            <GitBranch className="h-3.5 w-3.5 text-[var(--brand-500)]" />
                            <span className="font-mono-code">
                              {bl.branchCode}
                            </span>
                            <span>— {bl.branchName}</span>
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] pl-5">
                            {bl.branchType} • {bl.city || 'India'}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono-code text-[var(--text-secondary)]">
                          {bl.booksBeginFrom || activeLockModalFy.startDate}
                        </td>
                        <td className="py-3 px-4">
                          {bl.isLocked ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-300">
                              <Lock className="h-3 w-3" /> Locked (Read-Only)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
                              <LockOpen className="h-3 w-3" /> Open for Vouchers
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <PermissionGate screen="FYEAR_MASTER" action="EDIT">
                            <button
                              type="button"
                              disabled={
                                activeLockModalFy.isClosed ||
                                togglingBranchId === bl.branchId
                              }
                              onClick={() =>
                                void handleToggleBranchLock(
                                  activeLockModalFy,
                                  bl,
                                )
                              }
                              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition cursor-pointer disabled:opacity-40 ${
                                bl.isLocked
                                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                              }`}
                            >
                              {bl.isLocked ? (
                                <>
                                  <LockOpen className="h-3.5 w-3.5" />
                                  <span>Unlock Branch</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="h-3.5 w-3.5" />
                                  <span>Lock Branch</span>
                                </>
                              )}
                            </button>
                          </PermissionGate>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-3.5 text-xs">
              <span className="text-[var(--text-muted)]">
                Every lock/unlock toggle is recorded in `tbl_sys_audit_log` with
                before/after JSONB deltas.
              </span>
              <button
                type="button"
                onClick={() => setLockModalFyId(null)}
                className="rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] px-4 py-2 font-bold text-white shadow-xs cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Deletion Dependency Check Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        entityType="Financial Year"
        entityName={deleteTarget?.fyearName || ''}
        entityCode={deleteTarget?.fyearCode}
        isDeleting={isDeleting}
        errorMessage={deleteError}
        dependencies={deleteDependencies}
        onConfirm={() => void handleConfirmDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
};
