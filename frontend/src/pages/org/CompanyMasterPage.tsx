import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Edit3, Filter, Globe, Trash2, X } from 'lucide-react';
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

export interface CompanyEntity {
  compId: number;
  compCode: string;
  compName: string;
  legalName: string;
  gstin: string | null;
  panNo: string | null;
  cinNo: string | null;
  iecCode: string | null;
  msmeRegNo: string | null;
  baseCurrencyCode: string;
  registeredAddress: string | null;
  city: string | null;
  stateName: string | null;
  stateCode: string | null;
  pincode: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  isActive: boolean;
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

const FALLBACK_COMPANIES: CompanyEntity[] = [
  {
    compId: 1001,
    compCode: 'KSMFG',
    compName: 'Kashvira Manufacturing ERP',
    legalName: 'Kashvira Precision Manufacturing Pvt. Ltd.',
    gstin: '24AABCK1234F1Z5',
    panNo: 'AABCK1234F',
    cinNo: 'U29100GJ2020PTC112233',
    iecCode: '0820001122',
    msmeRegNo: 'UDYAM-GJ-01-0011223',
    baseCurrencyCode: 'INR',
    registeredAddress: 'Plot 42, GIDC Industrial Estate, Sanand',
    city: 'Ahmedabad',
    stateName: 'Gujarat',
    stateCode: '24',
    pincode: '382110',
    country: 'India',
    phone: '+91-79-26543210',
    email: 'info@ksmfg.com',
    website: 'https://www.ksmfg.com',
    isActive: true,
  },
  {
    compId: 1002,
    compCode: 'KSAUTO',
    compName: 'Kashvira Auto Components',
    legalName: 'Kashvira Auto Components Pvt. Ltd.',
    gstin: '27AABCK9999K1Z2',
    panNo: 'AABCK9999K',
    cinNo: 'U34300MH2022PTC223344',
    iecCode: '0322009988',
    msmeRegNo: 'UDYAM-MH-26-0044556',
    baseCurrencyCode: 'INR',
    registeredAddress: 'Plot B-19, Chakan MIDC Phase II',
    city: 'Pune',
    stateName: 'Maharashtra',
    stateCode: '27',
    pincode: '410501',
    country: 'India',
    phone: '+91-20-67891234',
    email: 'auto@ksmfg.com',
    website: 'https://auto.ksmfg.com',
    isActive: true,
  },
  {
    compId: 1003,
    compCode: 'KSVALVE',
    compName: 'Kashvira Industrial Valves',
    legalName: 'Kashvira Industrial Valves & Process Controls Ltd.',
    gstin: '24AABCK7788V1Z9',
    panNo: 'AABCK7788V',
    cinNo: 'U29120GJ2021PLC334455',
    iecCode: '0821009988',
    msmeRegNo: 'UDYAM-GJ-01-0099887',
    baseCurrencyCode: 'INR',
    registeredAddress: 'Plot 118, Phase IV, Vatva GIDC',
    city: 'Ahmedabad',
    stateName: 'Gujarat',
    stateCode: '24',
    pincode: '382445',
    country: 'India',
    phone: '+91-79-25894400',
    email: 'valves@ksmfg.com',
    website: 'https://valves.ksmfg.com',
    isActive: true,
  },
  {
    compId: 1004,
    compCode: 'KSCAST',
    compName: 'Kashvira Alloy Castings (Subsidiary)',
    legalName: 'Kashvira Precision Alloy Castings Pvt. Ltd.',
    gstin: '24AABCK5544C1Z3',
    panNo: 'AABCK5544C',
    cinNo: 'U27100GJ2023PTC445566',
    iecCode: '0823005544',
    msmeRegNo: 'UDYAM-GJ-20-0055443',
    baseCurrencyCode: 'INR',
    registeredAddress: 'Survey 212, Shapar-Veraval Industrial Area',
    city: 'Rajkot',
    stateName: 'Gujarat',
    stateCode: '24',
    pincode: '360024',
    country: 'India',
    phone: '+91-2827-252100',
    email: 'castings@ksmfg.com',
    website: 'https://castings.ksmfg.com',
    isActive: true,
  },
];

const EMPTY_FORM = {
  compCode: '',
  compName: '',
  legalName: '',
  gstin: '',
  panNo: '',
  cinNo: '',
  iecCode: '',
  msmeRegNo: '',
  baseCurrencyCode: 'INR',
  registeredAddress: '',
  city: 'Ahmedabad',
  stateName: 'Gujarat',
  stateCode: '24',
  pincode: '',
  country: 'India',
  phone: '',
  email: '',
  website: '',
  isActive: true,
};

export const CompanyMasterPage: React.FC = () => {
  const [companies, setCompanies] =
    useState<CompanyEntity[]>(FALLBACK_COMPANIES);
  const [isLoading, setIsLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [stateFilter, setStateFilter] = useState<string>('ALL');

  // Add / Edit Modal State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyEntity | null>(
    null,
  );
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete Confirmation & Dependency Conflict Modal State
  const [deleteTarget, setDeleteTarget] = useState<CompanyEntity | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDependencies, setDeleteDependencies] = useState<
    DependencyConflictItem[]
  >([]);

  const fetchCompanies = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get('/org/companies');
      if (Array.isArray(res.data?.data)) {
        setCompanies(res.data.data);
      }
    } catch {
      // Retain seeded fallback records when local PostgreSQL is offline
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchCompanies();
  }, []);

  const filteredData = useMemo(() => {
    return companies.filter((c) => {
      if (statusFilter === 'ACTIVE' && !c.isActive) return false;
      if (statusFilter === 'INACTIVE' && c.isActive) return false;
      if (stateFilter !== 'ALL' && c.stateName !== stateFilter) return false;
      return true;
    });
  }, [companies, statusFilter, stateFilter]);

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
    if (gstin.length >= 12) {
      updates.panNo = gstin.slice(2, 12);
    }

    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const openAddModal = () => {
    setEditingCompany(null);
    setFormError(null);
    setFormData(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEditModal = (company: CompanyEntity) => {
    setEditingCompany(company);
    setFormError(null);
    setFormData({
      compCode: company.compCode,
      compName: company.compName,
      legalName: company.legalName,
      gstin: company.gstin || '',
      panNo: company.panNo || '',
      cinNo: company.cinNo || '',
      iecCode: company.iecCode || '',
      msmeRegNo: company.msmeRegNo || '',
      baseCurrencyCode: company.baseCurrencyCode || 'INR',
      registeredAddress: company.registeredAddress || '',
      city: company.city || '',
      stateName: company.stateName || 'Gujarat',
      stateCode: company.stateCode || '24',
      pincode: company.pincode || '',
      country: company.country || 'India',
      phone: company.phone || '',
      email: company.email || '',
      website: company.website || '',
      isActive: company.isActive,
    });
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSaving(true);

    try {
      if (editingCompany) {
        const res = await apiClient.put(
          `/org/companies/${editingCompany.compId}`,
          formData,
        );
        const updated = res.data?.data;
        if (updated) {
          setCompanies((prev) =>
            prev.map((c) => (c.compId === editingCompany.compId ? updated : c)),
          );
        }
      } else {
        const res = await apiClient.post('/org/companies', formData);
        const created = res.data?.data;
        if (created) {
          setCompanies((prev) => [...prev, created]);
        }
      }
      setIsFormOpen(false);
    } catch (err: any) {
      if (err?.response?.status) {
        setFormError(
          err.response.data?.message || 'Failed to save company record.',
        );
        setIsSaving(false);
        return;
      }

      // Local demo mode fallback when backend server is not running
      const normalizedCode = formData.compCode.trim().toUpperCase();
      const duplicate = companies.some(
        (c) =>
          c.compCode.toUpperCase() === normalizedCode &&
          c.compId !== editingCompany?.compId,
      );
      if (duplicate) {
        setFormError(`Company Code "${normalizedCode}" already exists.`);
        setIsSaving(false);
        return;
      }

      if (editingCompany) {
        setCompanies((prev) =>
          prev.map((c) =>
            c.compId === editingCompany.compId
              ? {
                  ...c,
                  ...formData,
                  compCode: normalizedCode,
                }
              : c,
          ),
        );
      } else {
        const nextId =
          Math.max(...companies.map((c) => c.compId), 1000) + 1;
        setCompanies((prev) => [
          ...prev,
          {
            ...formData,
            compId: nextId,
            compCode: normalizedCode,
          },
        ]);
      }
      setIsFormOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const openDeleteModal = (company: CompanyEntity) => {
    setDeleteTarget(company);
    setDeleteError(null);
    setDeleteDependencies([]);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    setDeleteDependencies([]);

    try {
      await apiClient.delete(`/org/companies/${deleteTarget.compId}`);
      setCompanies((prev) =>
        prev.filter((c) => c.compId !== deleteTarget.compId),
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
          err.response.data?.message || 'Unable to delete company.',
        );
        setIsDeleting(false);
        return;
      }

      // Offline fallback simulation of DependencyCheckService for seeded companies 1001 & 1002
      if (deleteTarget.compId === 1001 || deleteTarget.compId === 1002) {
        const branchCnt = deleteTarget.compId === 1001 ? 2 : 1;
        const fyCnt = deleteTarget.compId === 1001 ? 2 : 1;
        setDeleteError(
          `Cannot delete COMPANY #${deleteTarget.compId} because it is referenced in: Plant / Branches (${branchCnt}), Financial Years (${fyCnt}), User Company Role Assignments (1).`,
        );
        setDeleteDependencies([
          {
            table: 'tbl_org_branch',
            label: 'Plant / Branches',
            count: branchCnt,
          },
          {
            table: 'tbl_org_financial_year',
            label: 'Financial Years',
            count: fyCnt,
          },
          {
            table: 'tbl_sec_user_company_role',
            label: 'User Company Role Assignments',
            count: 1,
          },
        ]);
        setIsDeleting(false);
        return;
      }

      setCompanies((prev) =>
        prev.filter((c) => c.compId !== deleteTarget.compId),
      );
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: MasterTableColumn<CompanyEntity>[] = [
    {
      key: 'compCode',
      header: 'Code & ID',
      sortable: true,
      sortValue: (r) => r.compCode,
      render: (r) => (
        <div>
          <div className="font-mono-code font-bold text-[var(--brand-600)] dark:text-[var(--brand-300)]">
            {r.compCode}
          </div>
          <div className="font-mono-code text-[10px] text-[var(--text-muted)]">
            ID #{r.compId}
          </div>
        </div>
      ),
    },
    {
      key: 'compName',
      header: 'Company & Legal Entity Name',
      sortable: true,
      sortValue: (r) => r.compName,
      render: (r) => (
        <div>
          <div className="font-bold text-[var(--text-primary)]">
            {r.compName}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            {r.legalName}
          </div>
        </div>
      ),
    },
    {
      key: 'gstin',
      header: 'GSTIN / PAN / CIN',
      sortable: true,
      sortValue: (r) => r.gstin || '',
      render: (r) => (
        <div className="font-mono-code">
          <div className="font-bold text-[var(--text-primary)]">
            {r.gstin || '—'}
          </div>
          <div className="text-[10px] text-[var(--text-muted)]">
            PAN: {r.panNo || '—'} {r.cinNo ? `• ${r.cinNo}` : ''}
          </div>
        </div>
      ),
    },
    {
      key: 'city',
      header: 'Registered Location',
      sortable: true,
      sortValue: (r) => `${r.stateName || ''} ${r.city || ''}`,
      render: (r) => (
        <div>
          <div className="font-semibold text-[var(--text-secondary)]">
            {r.city || '—'}, {r.stateName || '—'}{' '}
            {r.stateCode ? `(${r.stateCode})` : ''}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] truncate max-w-56">
            {r.registeredAddress || '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Contact & Currency',
      render: (r) => (
        <div>
          <div className="font-semibold text-[var(--text-secondary)]">
            {r.email || '—'}
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            {r.phone || '—'} •{' '}
            <span className="font-mono-code font-bold text-[var(--text-primary)]">
              {r.baseCurrencyCode}
            </span>
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

  const groupByOptions: GroupByOption<CompanyEntity>[] = [
    {
      key: 'stateName',
      label: 'Registered State',
      groupValue: (r) =>
        r.stateName ? `${r.stateName} (State Code ${r.stateCode})` : 'Other',
    },
    {
      key: 'status',
      label: 'Operational Status',
      groupValue: (r) => (r.isActive ? 'Active Companies' : 'Inactive Companies'),
    },
  ];

  return (
    <>
      <MasterDataTable<CompanyEntity>
        title="Company Master"
        subtitle="Manage legal manufacturing entities, GSTIN/PAN/CIN compliance, and base accounting currency"
        screenCode="COMPANY_MASTER"
        tableNameBadge="tbl_org_company"
        data={filteredData}
        rowKey={(r) => r.compId}
        columns={columns}
        isLoading={isLoading}
        addButtonLabel="Add Company"
        onAddClick={openAddModal}
        onPrintClick={() => {
          void apiClient.post('/org/companies/action/PRINT').catch(() => {});
        }}
        onExportClick={() => {
          void apiClient.post('/org/companies/action/EXPORT').catch(() => {});
        }}
        searchPlaceholder="Search by company code, legal name, GSTIN, PAN, city, or state..."
        searchPredicate={(r, q) =>
          r.compCode.toLowerCase().includes(q) ||
          r.compName.toLowerCase().includes(q) ||
          r.legalName.toLowerCase().includes(q) ||
          (r.gstin || '').toLowerCase().includes(q) ||
          (r.panNo || '').toLowerCase().includes(q) ||
          (r.city || '').toLowerCase().includes(q) ||
          (r.stateName || '').toLowerCase().includes(q)
        }
        groupByOptions={groupByOptions}
        filterToolbarSlot={
          <>
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
              >
                <option value="ALL">All States</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s.code} value={s.name}>
                    {s.code} — {s.name}
                  </option>
                ))}
              </select>
            </div>

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
            <PermissionGate screen="COMPANY_MASTER" action="EDIT">
              <button
                type="button"
                onClick={() => openEditModal(row)}
                title="Edit Company"
                className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--brand-500)] transition cursor-pointer"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            </PermissionGate>

            <PermissionGate screen="COMPANY_MASTER" action="DELETE">
              <button
                type="button"
                onClick={() => openDeleteModal(row)}
                title="Delete Company (Pre-Checked by DependencyCheckService)"
                className="rounded-lg p-1.5 text-[var(--text-secondary)] hover:bg-rose-500/10 hover:text-rose-500 transition cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </PermissionGate>
          </div>
        )}
      />

      {/* Add / Edit Company Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-600)] text-white">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-[var(--text-primary)]">
                    {editingCompany
                      ? `Edit Company — ${editingCompany.compCode} (#${editingCompany.compId})`
                      : 'Create New Legal Company Entity'}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Persisted in `tbl_org_company` with field-level delta audit
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

              {/* Row 1: Code, Short Name, Currency */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
                <div className="sm:col-span-3">
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Company Code *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={20}
                    placeholder="e.g. KSMFG"
                    value={formData.compCode}
                    onChange={(e) =>
                      setFormData((s) => ({
                        ...s,
                        compCode: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono-code font-bold text-[var(--text-primary)]"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Display / Short Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kashvira Manufacturing ERP"
                    value={formData.compName}
                    onChange={(e) =>
                      setFormData((s) => ({ ...s, compName: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Base Currency *
                  </label>
                  <select
                    value={formData.baseCurrencyCode}
                    onChange={(e) =>
                      setFormData((s) => ({
                        ...s,
                        baseCurrencyCode: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono-code font-bold text-[var(--text-primary)]"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Legal Name */}
              <div>
                <label className="block font-bold text-[var(--text-secondary)] mb-1">
                  Registered Legal Entity Name (For Tax Invoices & Statutory Filings) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kashvira Precision Manufacturing Pvt. Ltd."
                  value={formData.legalName}
                  onChange={(e) =>
                    setFormData((s) => ({ ...s, legalName: e.target.value }))
                  }
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-semibold text-[var(--text-primary)]"
                />
              </div>

              {/* Row 3: GSTIN, PAN, CIN */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    GSTIN (Auto-fills State & PAN)
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
                    PAN Number
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    placeholder="AABCK1234F"
                    value={formData.panNo}
                    onChange={(e) =>
                      setFormData((s) => ({
                        ...s,
                        panNo: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono-code text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    CIN / LLPIN No.
                  </label>
                  <input
                    type="text"
                    maxLength={25}
                    placeholder="U29100GJ2020PTC112233"
                    value={formData.cinNo}
                    onChange={(e) =>
                      setFormData((s) => ({
                        ...s,
                        cinNo: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono-code text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {/* Row 4: IEC Code, MSME Udyam, Status */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    IEC (Import-Export Code)
                  </label>
                  <input
                    type="text"
                    placeholder="0820001122"
                    value={formData.iecCode}
                    onChange={(e) =>
                      setFormData((s) => ({ ...s, iecCode: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono-code text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    MSME / Udyam Reg. No.
                  </label>
                  <input
                    type="text"
                    placeholder="UDYAM-GJ-01-0011223"
                    value={formData.msmeRegNo}
                    onChange={(e) =>
                      setFormData((s) => ({ ...s, msmeRegNo: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 font-mono-code text-[var(--text-primary)]"
                  />
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

              {/* Row 5: Registered Address */}
              <div>
                <label className="block font-bold text-[var(--text-secondary)] mb-1">
                  Registered Office / Factory Address
                </label>
                <input
                  type="text"
                  placeholder="Plot 42, GIDC Industrial Estate, Sanand"
                  value={formData.registeredAddress}
                  onChange={(e) =>
                    setFormData((s) => ({
                      ...s,
                      registeredAddress: e.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text-primary)]"
                />
              </div>

              {/* Row 6: City, State, Pincode */}
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

              {/* Row 7: Phone, Email, Website */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Phone Number
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
                    Official Email
                  </label>
                  <input
                    type="email"
                    placeholder="info@ksmfg.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((s) => ({ ...s, email: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block font-bold text-[var(--text-secondary)] mb-1">
                    Website URL
                  </label>
                  <div className="relative">
                    <Globe className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      placeholder="https://www.ksmfg.com"
                      value={formData.website}
                      onChange={(e) =>
                        setFormData((s) => ({ ...s, website: e.target.value }))
                      }
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] pl-8 pr-3 py-2 text-[var(--text-primary)]"
                    />
                  </div>
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
                    : editingCompany
                      ? 'Update Company'
                      : 'Create Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pre-Deletion Dependency Check Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        entityType="Company"
        entityName={deleteTarget?.compName || ''}
        entityCode={deleteTarget?.compCode}
        isDeleting={isDeleting}
        errorMessage={deleteError}
        dependencies={deleteDependencies}
        onConfirm={() => void handleConfirmDelete()}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
};
