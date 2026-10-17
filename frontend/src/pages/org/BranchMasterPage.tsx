import React, { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Edit3,
  Filter,
  GitBranch,
  Star,
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

export type BranchType = 'PLANT' | 'HO' | 'WAREHOUSE' | 'SALES_OFFICE';

export interface BranchEntity {
  branchId: number;
  compId: number;
  compCode: string;
  compName: string;
  branchCode: string;
  branchName: string;
  branchType: BranchType;
  gstin: string | null;
  address: string | null;
  city: string | null;
  stateName: string | null;
  stateCode: string | null;
  pincode: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  isHeadOffice: boolean;
  isActive: boolean;
}

interface CompanyLookup {
  compId: number;
  compCode: string;
  compName: string;
  gstin?: string | null;
}

const INDIAN_STATES: { code: string; name: string }[] = [
  { code: '24', name: 'Gujarat' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '36', name: 'Telangana' },
];

const BRANCH_TYPE_LABELS: Record<BranchType, string> = {
  PLANT: 'Manufacturing Plant',
  HO: 'Head Office',
  WAREHOUSE: 'Distribution Warehouse',
  SALES_OFFICE: 'Regional Sales Office',
};

const EMPTY_FORM = {
  compId: 1001,
  branchCode: '',
  branchName: '',
  branchType: 'PLANT' as BranchType,
  gstin: '',
  address: '',
  city: 'Ahmedabad',
  stateName: 'Gujarat',
  stateCode: '24',
  pincode: '',
  country: 'India',
  phone: '',
  email: '',
  isHeadOffice: false,
  isActive: true,
};

export const BranchMasterPage: React.FC = () => {
  const [branches, setBranches] = useState<BranchEntity[]>([]);
  const [companies, setCompanies] = useState<CompanyLookup[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [companyFilter, setCompanyFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | 'ACTIVE' | 'INACTIVE'
  >('ALL');

  // Add / Edit Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchEntity | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirmation & Dependency Conflict Modal State
  const [deleteTarget, setDeleteTarget] = useState<BranchEntity | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDependencies, setDeleteDependencies] = useState<
    DependencyConflictItem[]
  >([]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [branchRes, compRes] = await Promise.all([
        apiClient.get('/org/branches'),
        apiClient.get('/org/companies'),
      ]);
      if (Array.isArray(branchRes.data?.data)) {
        setBranches(branchRes.data.data);
      }
      if (Array.isArray(compRes.data?.data)) {
        setCompanies(compRes.data.data);
      }
    } catch {
      setBranches([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const filteredData = useMemo(() => {
    return branches.filter((b) => {
      if (companyFilter !== 'ALL' && b.compId !== Number(companyFilter)) {
        return false;
      }
      if (typeFilter !== 'ALL' && b.branchType !== typeFilter) {
        return false;
      }
      if (statusFilter === 'ACTIVE' && !b.isActive) return false;
      if (statusFilter === 'INACTIVE' && b.isActive) return false;
      return true;
    });
  }, [branches, companyFilter, typeFilter, statusFilter]);

  const handleGstinChange = (rawGstin: string) => {
    const gstin = rawGstin.toUpperCase().trim();
    const updates: Partial<typeof EMPTY_FORM> = { gstin };

    if (gstin.length >= 2) {
      const stCode = gstin.slice(0, 2);
      const foundState = INDIAN_STATES.find((s) => s.code === stCode);
      if (foundState) {
        updates.stateCode = foundState.code;
        updates.stateName = foundState.name;
      }
    }
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const openAddModal = () => {
    setEditingBranch(null);
    setFormError(null);
    const defaultComp = companies[0];
    setFormData({
      ...EMPTY_FORM,
      compId: defaultComp?.compId || 1001,
      gstin: defaultComp?.gstin || '',
    });
    setIsFormOpen(true);
  };

  const openEditModal = (branch: BranchEntity) => {
    setEditingBranch(branch);
    setFormError(null);
    setFormData({
      compId: branch.compId,
      branchCode: branch.branchCode,
      branchName: branch.branchName,
      branchType: branch.branchType,
      gstin: branch.gstin || '',
      address: branch.address || '',
      city: branch.city || '',
      stateName: branch.stateName || 'Gujarat',
      stateCode: branch.stateCode || '24',
      pincode: branch.pincode || '',
      country: branch.country || 'India',
      phone: branch.phone || '',
      email: branch.email || '',
      isHeadOffice: branch.isHeadOffice,
      isActive: branch.isActive,
    });
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);

    try {
      if (editingBranch) {
        const res = await apiClient.put(
          `/org/branches/${editingBranch.branchId}`,
          formData,
        );
        const updated = res.data?.data;
        if (updated) {
          setBranches((prev) =>
            prev.map((b) =>
              b.branchId === editingBranch.branchId ? updated : b,
            ),
          );
        }
      } else {
        const res = await apiClient.post('/org/branches', formData);
        const created = res.data?.data;
        if (created) {
          setBranches((prev) => [...prev, created]);
        }
      }
      setIsFormOpen(false);
    } catch (err: any) {
      setFormError(
        err?.response?.data?.message || 'Failed to save branch record.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteModal = (branch: BranchEntity) => {
    setDeleteTarget(branch);
    setDeleteError(null);
    setDeleteDependencies([]);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    setDeleteDependencies([]);

    try {
      await apiClient.delete(`/org/branches/${deleteTarget.branchId}`);
      setBranches((prev) =>
        prev.filter((b) => b.branchId !== deleteTarget.branchId),
      );
      setDeleteTarget(null);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setDeleteError(err.response.data?.message);
        setDeleteDependencies(err.response.data?.details || []);
      } else {
        setDeleteError(
          err?.response?.data?.message || 'Unable to delete branch.',
        );
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: MasterTableColumn<BranchEntity>[] = [
    {
      key: 'branchCode',
      header: 'Branch Code & ID',
      sortable: true,
      sortValue: (r) => r.branchCode,
      render: (r) => (
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono-code font-bold text-[var(--brand-600)] dark:text-[var(--brand-300)]">
              {r.branchCode}
            </span>
            {r.isHeadOffice && (
              <span
                title="Designated Head Office Branch"
                className="inline-flex items-center gap-0.5 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300"
              >
                <Star className="h-2.5 w-2.5 fill-current" /> HO
              </span>
            )}
          </div>
          <div className="font-mono-code text-[10px] text-[var(--text-muted)]">
            ID #{r.branchId}
          </div>
        </div>
      ),
    },
    {
      key: 'branchName',
      header: 'Plant / Branch Name & Parent Company',
      sortable: true,
      sortValue: (r) => r.branchName,
      render: (r) => (
        <div>
          <div className="font-bold text-[var(--text-primary)]">
            {r.branchName}
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
      key: 'branchType',
      header: 'Type',
      sortable: true,
      sortValue: (r) => r.branchType,
      render: (r) => {
        const badgeStyle =
          r.branchType === 'PLANT'
            ? 'bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/20 text-[var(--brand-600)] dark:text-[var(--brand-300)]'
            : r.branchType === 'WAREHOUSE'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
              : r.branchType === 'HO'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                : 'bg-violet-500/15 text-violet-600 dark:text-violet-300';
        return (
          <span
            className={`inline-flex rounded-lg px-2.5 py-1 text-[11px] font-bold ${badgeStyle}`}
          >
            {BRANCH_TYPE_LABELS[r.branchType] || r.branchType}
          </span>
        );
      },
    },
    {
      key: 'city',
      header: 'Location & GSTIN',
      sortable: true,
      sortValue: (r) => `${r.stateName || ''} ${r.city || ''}`,
      render: (r) => (
        <div>
          <div className="font-semibold text-[var(--text-secondary)]">
            {r.city || '—'}, {r.stateName || '—'}{' '}
            {r.stateCode ? `(${r.stateCode})` : ''}
          </div>
          <div className="font-mono-code text-[11px] text-[var(--text-muted)]">
            GSTIN: {r.gstin || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Plant Contact',
      render: (r) => (
        <div>
          <div className="font-semibold text-[var(--text-secondary)]">
            {r.email || '—'}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            {r.phone || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      sortable: true,
      sortValue: (r) => (r.isActive ? 1 : 0),
      render: (r) =>
        r.isActive ? (
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
            Active
          </span>
        ) : (
          <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-300">
            Inactive
          </span>
        ),
    },
  ];

  const groupByOptions: GroupByOption<BranchEntity>[] = [
    {
      key: 'company',
      label: 'Parent Company',
      groupValue: (r) => `${r.compCode} — ${r.compName}`,
    },
    {
      key: 'branchType',
      label: 'Facility Type',
      groupValue: (r) => BRANCH_TYPE_LABELS[r.branchType] || r.branchType,
    },
    {
      key: 'stateName',
      label: 'State / Region',
      groupValue: (r) =>
        r.stateName ? `${r.stateName} (State Code ${r.stateCode})` : 'Other',
    },
  ];

  return (
    <>
      <MasterDataTable<BranchEntity>
        title="Branch & Plant Master"
        subtitle="Manage manufacturing plants, distribution hubs, head offices, state GSTINs, and company assignments"
        screenCode="BRANCH_MASTER"
        tableNameBadge="tbl_org_branch"
        data={filteredData}
        rowKey={(r) => r.branchId}
        columns={columns}
        isLoading={isLoading}
        addButtonLabel="Add Branch / Plant"
        onAddClick={openAddModal}
        onPrintClick={() => {
          void apiClient.post('/org/branches/action/PRINT').catch(() => {});
        }}
        onExportClick={() => {
          void apiClient.post('/org/branches/action/EXPORT').catch(() => {});
        }}
        searchPlaceholder="Search by branch code, plant name, company, GSTIN, city, or state..."
        searchPredicate={(r, q) =>
          r.branchCode.toLowerCase().includes(q) ||
          r.branchName.toLowerCase().includes(q) ||
          r.compCode.toLowerCase().includes(q) ||
          r.compName.toLowerCase().includes(q) ||
          (r.city || '').toLowerCase().includes(q) ||
          (r.stateName || '').toLowerCase().includes(q) ||
          (r.gstin || '').toLowerCase().includes(q)
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
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
            >
              <option value="ALL">All Facility Types</option>
              <option value="PLANT">Manufacturing Plant</option>
              <option value="HO">Head Office</option>
              <option value="WAREHOUSE">Distribution Warehouse</option>
              <option value="SALES_OFFICE">Regional Sales Office</option>
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
            <PermissionGate screen="BRANCH_MASTER" action="EDIT">
              <button
                type="button"
                onClick={() => openEditModal(row)}
                title="Edit Branch / Plant"
                className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--brand-500)] transition cursor-pointer"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            </PermissionGate>

            <PermissionGate screen="BRANCH_MASTER" action="DELETE">
              <button
                type="button"
                onClick={() => openDeleteModal(row)}
                title="Delete Branch (Pre-Checked by DependencyCheckService)"
                className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-rose-500/10 hover:text-rose-500 transition cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </PermissionGate>
          </div>
        )}
      />

      {/* Add / Edit Branch Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-600)] text-white">
                  <GitBranch className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                    {editingBranch
                      ? `Edit Branch — ${editingBranch.branchCode} (#${editingBranch.branchId})`
                      : 'Create New Plant / Branch Facility'}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Persisted in `tbl_org_branch` with field-level delta audit
                    logging (`tbl_sys_audit_log`)
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

              {/* Row 1: Parent Company & Facility Type */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                <div className="sm:col-span-7">
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Parent Company Entity (`comp_id`) *
                  </label>
                  <select
                    value={formData.compId}
                    onChange={(e) => {
                      const cid = Number(e.target.value);
                      const comp = companies.find((c) => c.compId === cid);
                      setFormData((s) => ({
                        ...s,
                        compId: cid,
                        gstin: comp?.gstin || s.gstin,
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

                <div className="sm:col-span-5">
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Facility / Branch Type *
                  </label>
                  <select
                    value={formData.branchType}
                    onChange={(e) =>
                      setFormData((s) => ({
                        ...s,
                        branchType: e.target.value as BranchType,
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                  >
                    <option value="PLANT">Manufacturing Plant</option>
                    <option value="HO">Head Office</option>
                    <option value="WAREHOUSE">Distribution Warehouse</option>
                    <option value="SALES_OFFICE">Regional Sales Office</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Branch Code & Branch Name */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                <div className="sm:col-span-4">
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Branch / Plant Code *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={20}
                    placeholder="e.g. PLT-AHM-01"
                    value={formData.branchCode}
                    onChange={(e) =>
                      setFormData((s) => ({
                        ...s,
                        branchCode: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono-code font-bold text-[var(--text-primary)]"
                  />
                </div>

                <div className="sm:col-span-8">
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Branch / Manufacturing Plant Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ahmedabad Main Plant & HO"
                    value={formData.branchName}
                    onChange={(e) =>
                      setFormData((s) => ({ ...s, branchName: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {/* Row 3: GSTIN, Head Office Flag, Status */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    State GSTIN (Auto-fills State)
                  </label>
                  <input
                    type="text"
                    maxLength={15}
                    placeholder="24AABCK1234F1Z5"
                    value={formData.gstin}
                    onChange={(e) => handleGstinChange(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono-code font-bold text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Is Head Office?
                  </label>
                  <select
                    value={formData.isHeadOffice ? 'true' : 'false'}
                    onChange={(e) =>
                      setFormData((s) => ({
                        ...s,
                        isHeadOffice: e.target.value === 'true',
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                  >
                    <option value="false">No — Operational Unit</option>
                    <option value="true">Yes — Primary Head Office</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Operational Status
                  </label>
                  <select
                    value={formData.isActive ? 'true' : 'false'}
                    onChange={(e) =>
                      setFormData((s) => ({
                        ...s,
                        isActive: e.target.value === 'true',
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Street Address */}
              <div>
                <label className="block font-bold text-[var(--text-secondary)] mb-1">
                  Factory / Facility Address
                </label>
                <input
                  type="text"
                  placeholder="Plot 42, GIDC Industrial Estate, Sanand"
                  value={formData.address}
                  onChange={(e) =>
                    setFormData((s) => ({ ...s, address: e.target.value }))
                  }
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text-primary)]"
                />
              </div>

              {/* Row 5: City, State, Pincode */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.city}
                    onChange={(e) =>
                      setFormData((s) => ({ ...s, city: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    State & GST State Code *
                  </label>
                  <select
                    value={formData.stateCode}
                    onChange={(e) => {
                      const st = INDIAN_STATES.find(
                        (s) => s.code === e.target.value,
                      );
                      setFormData((s) => ({
                        ...s,
                        stateCode: e.target.value,
                        stateName: st?.name || s.stateName,
                      }));
                    }}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.code} — {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    PIN Code
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="382110"
                    value={formData.pincode}
                    onChange={(e) =>
                      setFormData((s) => ({ ...s, pincode: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono-code text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {/* Row 6: Phone & Email */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Plant Contact Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+91-79-26543210"
                    value={formData.phone}
                    onChange={(e) =>
                      setFormData((s) => ({ ...s, phone: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Plant Dispatch / Operations Email
                  </label>
                  <input
                    type="email"
                    placeholder="plant.ops@ksmfg.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((s) => ({ ...s, email: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text-primary)]"
                  />
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
                    : editingBranch
                      ? 'Update Branch'
                      : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pre-Deletion Dependency Check Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        entityType="Branch / Plant"
        entityName={deleteTarget?.branchName || ''}
        entityCode={deleteTarget?.branchCode}
        isDeleting={isDeleting}
        errorMessage={deleteError}
        dependencies={deleteDependencies}
        onConfirm={() => void handleConfirmDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
};
