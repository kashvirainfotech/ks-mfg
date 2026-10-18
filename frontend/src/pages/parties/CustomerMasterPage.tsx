import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  CreditCard,
  Edit3,
  ExternalLink,
  Factory,
  Globe,
  Hash,
  Layers,
  Mail,
  MapPin,
  Phone,
  Plus,
  Printer,
  Search,
  ShieldAlert,
  Tag,
  Trash2,
  Truck,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { apiClient, type ApiResponse } from '../../lib/apiClient';
import {
  MasterDataTable,
  type MasterTableColumn,
  type GroupByOption,
} from '../../components/common/MasterDataTable';
import { ConfirmDeleteModal } from '../../components/common/ConfirmDeleteModal';
import { PermissionGate } from '../../components/common/PermissionGate';

// ============================================================================
// TYPES & CATALOGUES
// ============================================================================

export type PartyGroup =
  | 'OEM_AUTOMOTIVE'
  | 'TIER_1_EXPORT'
  | 'HEAVY_ENGINEERING'
  | 'RAW_MATERIAL_VENDOR'
  | 'CONSUMABLE_VENDOR'
  | 'JOB_WORK_CONTRACTOR'
  | 'LOGISTICS_PARTNER';

export type PaymentTerms =
  | 'IMMEDIATE'
  | 'NET_15'
  | 'NET_30'
  | 'NET_45'
  | 'NET_60'
  | 'NET_90'
  | 'ADVANCE';

export type GstTreatmentType =
  | 'REGISTERED_REGULAR'
  | 'REGISTERED_COMPOSITION'
  | 'UNREGISTERED'
  | 'SEZ_DEVELOPER'
  | 'OVERSEAS_EXPORT';

export type AddressType = 'BILLING' | 'SHIPPING' | 'BOTH' | 'PLANT_SITE';

export interface PartyAddressRecord {
  addressId?: number;
  addressLabel: string;
  addressType: AddressType;
  gstin?: string | null;
  stateCode: string;
  stateName: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  pincode: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  isDefaultBilling: boolean;
  isDefaultShipping: boolean;
  isActive: boolean;
}

export interface PartyRecord {
  partyId: number;
  partyCode: string;
  partyName: string;
  tradeName: string | null;
  isCustomer: boolean;
  isSupplier: boolean;
  isJobWorker: boolean;
  isTransporter: boolean;
  partyGroup: PartyGroup;
  panNo: string | null;
  msmeRegNo: string | null;
  primaryContactName: string;
  primaryEmail: string | null;
  primaryPhone: string;
  website: string | null;
  creditLimit: number;
  creditDays: number;
  paymentTerms: PaymentTerms;
  currencyCode: string;
  gstTreatmentType: GstTreatmentType;
  isActive: boolean;
  remarks: string | null;
  createdDate: string;
  updatedDate: string | null;
  addresses: PartyAddressRecord[];
}

export interface PartySummary {
  totalParties: number;
  customersCount: number;
  suppliersCount: number;
  jobWorkersCount: number;
  transportersCount: number;
}

const PARTY_GROUP_META: Record<PartyGroup, { label: string; badgeClass: string }> = {
  OEM_AUTOMOTIVE: {
    label: 'OEM Automotive',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
  },
  TIER_1_EXPORT: {
    label: 'Tier-1 Export',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
  },
  HEAVY_ENGINEERING: {
    label: 'Heavy Engineering',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
  },
  RAW_MATERIAL_VENDOR: {
    label: 'Raw Material Supplier',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  },
  CONSUMABLE_VENDOR: {
    label: 'MRO / Tooling Vendor',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  },
  JOB_WORK_CONTRACTOR: {
    label: 'Job-Work Subcontractor',
    badgeClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
  },
  LOGISTICS_PARTNER: {
    label: 'Logistics / Fleet Carrier',
    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
  },
};

const PAYMENT_TERMS_META: Record<PaymentTerms, string> = {
  IMMEDIATE: 'Immediate / Cash',
  NET_15: 'Net 15 Days',
  NET_30: 'Net 30 Days',
  NET_45: 'Net 45 Days',
  NET_60: 'Net 60 Days',
  NET_90: 'Net 90 Days',
  ADVANCE: '100% Advance Payment',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const CustomerMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters & State
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'CUSTOMER' | 'SUPPLIER' | 'JOB_WORKER' | 'TRANSPORTER'>('ALL');
  const [groupFilter, setGroupFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<PartyRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'commercial' | 'addresses'>('profile');

  // Delete State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingParty, setDeletingParty] = useState<PartyRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConflicts, setDeleteConflicts] = useState<any[]>([]);

  // Print Preview Modal
  const [printParty, setPrintParty] = useState<PartyRecord | null>(null);

  // Form State
  const initialFormData = {
    partyCode: '',
    partyName: '',
    tradeName: '',
    isCustomer: true,
    isSupplier: false,
    isJobWorker: false,
    isTransporter: false,
    partyGroup: 'OEM_AUTOMOTIVE' as PartyGroup,
    panNo: '',
    msmeRegNo: '',
    primaryContactName: '',
    primaryEmail: '',
    primaryPhone: '',
    website: '',
    creditLimit: 0,
    creditDays: 30,
    paymentTerms: 'NET_30' as PaymentTerms,
    currencyCode: 'INR',
    gstTreatmentType: 'REGISTERED_REGULAR' as GstTreatmentType,
    isActive: true,
    remarks: '',
    addresses: [] as PartyAddressRecord[],
  };

  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ==========================================================================
  // DATA FETCHING
  // ==========================================================================

  const {
    data: parties = [],
    isLoading: isPartiesLoading,
  } = useQuery<PartyRecord[]>({
    queryKey: ['parties', roleFilter, groupFilter, statusFilter],
    queryFn: async () => {
      const params: Record<string, any> = {};
      if (roleFilter === 'CUSTOMER') params.isCustomer = true;
      if (roleFilter === 'SUPPLIER') params.isSupplier = true;
      if (roleFilter === 'JOB_WORKER') params.isJobWorker = true;
      if (roleFilter === 'TRANSPORTER') params.isTransporter = true;
      if (groupFilter !== 'ALL') params.partyGroup = groupFilter;
      if (statusFilter === 'ACTIVE') params.isActive = true;
      if (statusFilter === 'INACTIVE') params.isActive = false;

      const res = await apiClient.get<ApiResponse<PartyRecord[]>>('/parties', {
        params,
      });
      return res.data.data;
    },
  });

  const { data: summary } = useQuery<PartySummary>({
    queryKey: ['parties-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PartySummary>>(
        '/parties/summary',
      );
      return res.data.data;
    },
  });

  // ==========================================================================
  // MUTATIONS
  // ==========================================================================

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post<ApiResponse<PartyRecord>>(
        '/parties',
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      queryClient.invalidateQueries({ queryKey: ['parties-summary'] });
      setIsFormModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to create party record';
      setFormErrors((prev) => ({ ...prev, server: msg }));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.put<ApiResponse<PartyRecord>>(
        `/parties/${id}`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      queryClient.invalidateQueries({ queryKey: ['parties-summary'] });
      setIsFormModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to update party record';
      setFormErrors((prev) => ({ ...prev, server: msg }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete<ApiResponse<any>>(`/parties/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parties'] });
      queryClient.invalidateQueries({ queryKey: ['parties-summary'] });
      setIsDeleteModalOpen(false);
      setDeletingParty(null);
      setDeleteError(null);
      setDeleteConflicts([]);
    },
    onError: (err: any) => {
      const responseData = err.response?.data;
      if (err.response?.status === 409 && responseData?.dependencies) {
        setDeleteConflicts(responseData.dependencies);
        setDeleteError(
          responseData.message ||
            'Cannot delete this party as it is linked to active operational records.',
        );
      } else {
        setDeleteError(
          responseData?.message || 'Failed to delete party due to server error.',
        );
      }
    },
  });

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingParty(null);
    setFormErrors({});
    setActiveTab('profile');
  };

  const openCreateModal = () => {
    resetForm();
    // Pre-populate with one blank default billing address
    setFormData((prev) => ({
      ...prev,
      addresses: [
        {
          addressLabel: 'Head Office & Billing',
          addressType: 'BOTH',
          gstin: '',
          stateCode: '24',
          stateName: 'Gujarat',
          addressLine1: '',
          addressLine2: '',
          city: '',
          pincode: '',
          contactPerson: '',
          phone: '',
          email: '',
          isDefaultBilling: true,
          isDefaultShipping: true,
          isActive: true,
        },
      ],
    }));
    setIsFormModalOpen(true);
  };

  const openEditModal = (party: PartyRecord) => {
    setEditingParty(party);
    setFormData({
      partyCode: party.partyCode,
      partyName: party.partyName,
      tradeName: party.tradeName || '',
      isCustomer: party.isCustomer,
      isSupplier: party.isSupplier,
      isJobWorker: party.isJobWorker,
      isTransporter: party.isTransporter,
      partyGroup: party.partyGroup,
      panNo: party.panNo || '',
      msmeRegNo: party.msmeRegNo || '',
      primaryContactName: party.primaryContactName,
      primaryEmail: party.primaryEmail || '',
      primaryPhone: party.primaryPhone,
      website: party.website || '',
      creditLimit: party.creditLimit,
      creditDays: party.creditDays,
      paymentTerms: party.paymentTerms,
      currencyCode: party.currencyCode,
      gstTreatmentType: party.gstTreatmentType,
      isActive: party.isActive,
      remarks: party.remarks || '',
      addresses: party.addresses && party.addresses.length > 0 ? party.addresses : [],
    });
    setFormErrors({});
    setActiveTab('profile');
    setIsFormModalOpen(true);
  };

  const openDeleteModal = (party: PartyRecord) => {
    setDeletingParty(party);
    setDeleteError(null);
    setDeleteConflicts([]);
    setIsDeleteModalOpen(true);
  };

  const handleAddAddressRow = () => {
    setFormData((prev) => ({
      ...prev,
      addresses: [
        ...prev.addresses,
        {
          addressLabel: `Location #${prev.addresses.length + 1}`,
          addressType: 'SHIPPING',
          gstin: prev.addresses[0]?.gstin || '',
          stateCode: prev.addresses[0]?.stateCode || '24',
          stateName: prev.addresses[0]?.stateName || 'Gujarat',
          addressLine1: '',
          addressLine2: '',
          city: '',
          pincode: '',
          contactPerson: '',
          phone: '',
          email: '',
          isDefaultBilling: false,
          isDefaultShipping: false,
          isActive: true,
        },
      ],
    }));
  };

  const handleRemoveAddressRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      addresses: prev.addresses.filter((_, idx) => idx !== index),
    }));
  };

  const handleAddressChange = (index: number, field: keyof PartyAddressRecord, value: any) => {
    setFormData((prev) => {
      const nextAddrs = [...prev.addresses];
      const target = { ...nextAddrs[index], [field]: value };

      // If user marks this as default billing, unmark others
      if (field === 'isDefaultBilling' && value === true) {
        nextAddrs.forEach((a, i) => {
          if (i !== index) a.isDefaultBilling = false;
        });
      }
      // If user marks this as default shipping, unmark others
      if (field === 'isDefaultShipping' && value === true) {
        nextAddrs.forEach((a, i) => {
          if (i !== index) a.isDefaultShipping = false;
        });
      }

      nextAddrs[index] = target;
      return { ...prev, addresses: nextAddrs };
    });
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.partyCode.trim()) errors.partyCode = 'Party Code is required';
    if (!formData.partyName.trim()) errors.partyName = 'Party Legal Name is required';
    if (!formData.primaryContactName.trim()) errors.primaryContactName = 'Primary Contact Name is required';
    if (!formData.primaryPhone.trim()) errors.primaryPhone = 'Primary Phone is required';

    if (
      !formData.isCustomer &&
      !formData.isSupplier &&
      !formData.isJobWorker &&
      !formData.isTransporter
    ) {
      errors.roles = 'At least one commercial role flag must be enabled';
    }

    // Validate addresses
    if (formData.addresses.length > 0) {
      for (let i = 0; i < formData.addresses.length; i++) {
        const a = formData.addresses[i];
        if (!a.addressLine1.trim() || !a.city.trim() || !a.pincode.trim()) {
          errors.addresses = `Address #${i + 1} requires Address Line, City, and Pincode`;
          break;
        }
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload: any = {
      partyCode: formData.partyCode.trim().toUpperCase(),
      partyName: formData.partyName.trim(),
      tradeName: formData.tradeName.trim() || undefined,
      isCustomer: formData.isCustomer,
      isSupplier: formData.isSupplier,
      isJobWorker: formData.isJobWorker,
      isTransporter: formData.isTransporter,
      partyGroup: formData.partyGroup,
      panNo: formData.panNo.trim().toUpperCase() || undefined,
      msmeRegNo: formData.msmeRegNo.trim().toUpperCase() || undefined,
      primaryContactName: formData.primaryContactName.trim(),
      primaryEmail: formData.primaryEmail.trim().toLowerCase() || undefined,
      primaryPhone: formData.primaryPhone.trim(),
      website: formData.website.trim() || undefined,
      creditLimit: Number(formData.creditLimit) || 0,
      creditDays: Number(formData.creditDays) || 30,
      paymentTerms: formData.paymentTerms,
      currencyCode: formData.currencyCode || 'INR',
      gstTreatmentType: formData.gstTreatmentType,
      isActive: formData.isActive,
      remarks: formData.remarks.trim() || undefined,
      addresses: formData.addresses.map((a) => ({
        addressId: a.addressId,
        addressLabel: a.addressLabel.trim() || 'Office',
        addressType: a.addressType,
        gstin: a.gstin?.trim().toUpperCase() || undefined,
        stateCode: a.stateCode.trim() || '24',
        stateName: a.stateName.trim() || 'Gujarat',
        addressLine1: a.addressLine1.trim(),
        addressLine2: a.addressLine2?.trim() || undefined,
        city: a.city.trim(),
        pincode: a.pincode.trim(),
        contactPerson: a.contactPerson?.trim() || undefined,
        phone: a.phone?.trim() || undefined,
        email: a.email?.trim().toLowerCase() || undefined,
        isDefaultBilling: Boolean(a.isDefaultBilling),
        isDefaultShipping: Boolean(a.isDefaultShipping),
        isActive: Boolean(a.isActive),
      })),
    };

    if (editingParty) {
      updateMutation.mutate({ id: editingParty.partyId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleExportCsv = async () => {
    try {
      await apiClient.post('/parties/actions/log', { actionType: 'EXPORT' });
    } catch {
      // non-blocking audit call
    }

    if (parties.length === 0) return;

    const headers = [
      'Party Code',
      'Legal Name',
      'Trade Name',
      'Roles',
      'Classification Group',
      'PAN Number',
      'Primary Contact',
      'Phone',
      'Email',
      'Credit Limit (INR)',
      'Credit Days',
      'Payment Terms',
      'GSTIN (Primary)',
      'City',
      'State',
      'Status',
    ];

    const rows = parties.map((p) => {
      const primaryAddr = p.addresses?.find((a) => a.isDefaultBilling) || p.addresses?.[0];
      const roles = [
        p.isCustomer ? 'Customer' : null,
        p.isSupplier ? 'Supplier' : null,
        p.isJobWorker ? 'Job-Worker' : null,
        p.isTransporter ? 'Transporter' : null,
      ]
        .filter(Boolean)
        .join('; ');

      return [
        `"${p.partyCode}"`,
        `"${p.partyName.replace(/"/g, '""')}"`,
        `"${(p.tradeName || '').replace(/"/g, '""')}"`,
        `"${roles}"`,
        `"${p.partyGroup}"`,
        p.panNo || '',
        `"${p.primaryContactName}"`,
        `"${p.primaryPhone}"`,
        p.primaryEmail || '',
        p.creditLimit,
        p.creditDays,
        p.paymentTerms,
        primaryAddr?.gstin || '',
        primaryAddr?.city || '',
        primaryAddr?.stateName || '',
        p.isActive ? 'ACTIVE' : 'INACTIVE',
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `ks_mfg_parties_directory_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPartySheet = async (party: PartyRecord) => {
    setPrintParty(party);
    try {
      await apiClient.post('/parties/actions/log', { actionType: 'PRINT' });
    } catch {
      // non-blocking audit call
    }
  };

  // ==========================================================================
  // TABLE COLUMNS & GROUP BY
  // ==========================================================================

  const columns: MasterTableColumn<PartyRecord>[] = useMemo(
    () => [
      {
        key: 'partyCode',
        header: 'Party Code & Legal Name',
        sortable: true,
        sortValue: (row: PartyRecord) => row.partyCode,
        render: (row: PartyRecord) => (
          <div className="flex items-start gap-3 py-1">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/15 border-[var(--brand-300)] text-[var(--brand-600)] dark:text-[var(--brand-300)]">
              {row.isCustomer ? (
                <Building2 className="h-4 w-4" />
              ) : row.isSupplier ? (
                <Truck className="h-4 w-4" />
              ) : row.isJobWorker ? (
                <Wrench className="h-4 w-4" />
              ) : (
                <Users className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono-code font-bold text-[var(--text-primary)]">
                  {row.partyCode}
                </span>
                {row.panNo && (
                  <span className="inline-flex items-center rounded bg-slate-500/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                    PAN: {row.panNo}
                  </span>
                )}
              </div>
              <div className="truncate text-xs font-semibold text-[var(--text-primary)]">
                {row.partyName}
              </div>
              {row.tradeName && (
                <div className="truncate text-[11px] text-[var(--text-muted)] italic">
                  Trade: {row.tradeName}
                </div>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'roles',
        header: 'Commercial Roles & Group',
        render: (row: PartyRecord) => {
          const groupMeta = PARTY_GROUP_META[row.partyGroup] || PARTY_GROUP_META.OEM_AUTOMOTIVE;
          return (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1">
                {row.isCustomer && (
                  <span className="inline-flex items-center rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                    Customer
                  </span>
                )}
                {row.isSupplier && (
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Supplier
                  </span>
                )}
                {row.isJobWorker && (
                  <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                    Job-Worker
                  </span>
                )}
                {row.isTransporter && (
                  <span className="inline-flex items-center rounded-full bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] font-semibold text-purple-600 dark:text-purple-400">
                    Transporter
                  </span>
                )}
              </div>
              <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium border ${groupMeta.badgeClass}`}>
                {groupMeta.label}
              </span>
            </div>
          );
        },
      },
      {
        key: 'contact',
        header: 'Primary Contact',
        render: (row: PartyRecord) => (
          <div className="text-xs space-y-0.5">
            <div className="font-medium text-[var(--text-primary)]">
              {row.primaryContactName}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
              <Phone className="h-3 w-3 text-[var(--text-muted)]" />
              <span>{row.primaryPhone}</span>
            </div>
            {row.primaryEmail && (
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)] truncate max-w-xs">
                <Mail className="h-3 w-3 text-[var(--text-muted)]" />
                <span className="truncate">{row.primaryEmail}</span>
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'locations',
        header: 'Locations & GSTIN',
        render: (row: PartyRecord) => {
          const primary = row.addresses?.find((a) => a.isDefaultBilling) || row.addresses?.[0];
          return (
            <div className="text-xs space-y-0.5">
              {primary ? (
                <>
                  <div className="flex items-center gap-1 text-[var(--text-primary)] font-medium">
                    <MapPin className="h-3 w-3 text-rose-500" />
                    <span>{primary.city}, {primary.stateName}</span>
                  </div>
                  {primary.gstin && (
                    <div className="font-mono text-[10px] text-[var(--text-muted)]">
                      GSTIN: <span className="text-[var(--text-primary)]">{primary.gstin}</span>
                    </div>
                  )}
                  {row.addresses.length > 1 && (
                    <div className="text-[10px] text-[var(--brand-600)] dark:text-[var(--brand-400)] font-medium">
                      +{row.addresses.length - 1} more plant locations
                    </div>
                  )}
                </>
              ) : (
                <span className="text-[11px] text-[var(--text-muted)] italic">No address on file</span>
              )}
            </div>
          );
        },
      },
      {
        key: 'creditTerms',
        header: 'Credit Terms & Limit',
        sortable: true,
        sortValue: (row: PartyRecord) => row.creditLimit,
        render: (row: PartyRecord) => (
          <div className="text-xs space-y-0.5">
            <div className="font-bold text-[var(--text-primary)]">
              ₹{row.creditLimit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              {PAYMENT_TERMS_META[row.paymentTerms] || row.paymentTerms}
            </div>
            <div className="text-[10px] text-[var(--text-muted)]">
              Credit Period: {row.creditDays} Days
            </div>
          </div>
        ),
      },
      {
        key: 'isActive',
        header: 'Status',
        sortable: true,
        sortValue: (row: PartyRecord) => (row.isActive ? 1 : 0),
        render: (row: PartyRecord) => (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              row.isActive
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-500/15 text-slate-500'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                row.isActive ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            {row.isActive ? 'Active' : 'Inactive'}
          </span>
        ),
      },
    ],
    [],
  );

  const groupByOptions: GroupByOption<PartyRecord>[] = useMemo(
    () => [
      {
        key: 'partyGroup',
        label: 'Classification Group',
        groupValue: (row: PartyRecord) =>
          PARTY_GROUP_META[row.partyGroup]?.label || row.partyGroup,
      },
      {
        key: 'paymentTerms',
        label: 'Payment Terms',
        groupValue: (row: PartyRecord) =>
          PAYMENT_TERMS_META[row.paymentTerms] || row.paymentTerms,
      },
      {
        key: 'stateName',
        label: 'Primary State Location',
        groupValue: (row: PartyRecord) => {
          const primary = row.addresses?.find((a) => a.isDefaultBilling) || row.addresses?.[0];
          return primary?.stateName || 'Unspecified State';
        },
      },
    ],
    [],
  );

  const searchPredicate = (party: PartyRecord, query: string) => {
    const q = query.toLowerCase();
    const matchesCodeOrName =
      party.partyCode.toLowerCase().includes(q) ||
      party.partyName.toLowerCase().includes(q) ||
      (party.tradeName && party.tradeName.toLowerCase().includes(q)) ||
      party.primaryContactName.toLowerCase().includes(q) ||
      party.primaryPhone.toLowerCase().includes(q) ||
      (party.panNo && party.panNo.toLowerCase().includes(q));

    const matchesAddress = party.addresses?.some(
      (a) =>
        a.city.toLowerCase().includes(q) ||
        a.stateName.toLowerCase().includes(q) ||
        (a.gstin && a.gstin.toLowerCase().includes(q)),
    );

    return matchesCodeOrName || Boolean(matchesAddress);
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="space-y-6">
      {/* TOP 4 KPI CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Registered Parties */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs transition-all hover:border-[var(--brand-300)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              Total Master Parties
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/15 text-[var(--brand-600)] dark:text-[var(--brand-300)]">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[var(--text-primary)]">
              {summary?.totalParties ?? parties.length}
            </span>
            <span className="text-xs text-[var(--text-muted)]">corporate accounts</span>
          </div>
        </div>

        {/* Active Customers */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs transition-all hover:border-blue-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              Active Customers (OEM)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
              {summary?.customersCount ?? 0}
            </span>
            <span className="text-xs text-[var(--text-muted)]">purchasing clients</span>
          </div>
        </div>

        {/* Active Suppliers */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs transition-all hover:border-emerald-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              Active Suppliers (RM/MRO)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Truck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {summary?.suppliersCount ?? 0}
            </span>
            <span className="text-xs text-[var(--text-muted)]">material vendors</span>
          </div>
        </div>

        {/* Job-Workers & Transporters */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs transition-all hover:border-amber-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              Subcontractors & Fleet
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Wrench className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
              {(summary?.jobWorkersCount ?? 0) + (summary?.transportersCount ?? 0)}
            </span>
            <span className="text-xs text-[var(--text-muted)]">service partners</span>
          </div>
        </div>
      </div>

      {/* FILTER TOOLBAR */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Role Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL', label: 'All Accounts' },
              { id: 'CUSTOMER', label: 'Customers' },
              { id: 'SUPPLIER', label: 'Suppliers' },
              { id: 'JOB_WORKER', label: 'Job-Workers' },
              { id: 'TRANSPORTER', label: 'Transporters' },
            ].map((role) => {
              const isSelected = roleFilter === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => setRoleFilter(role.id as any)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    isSelected
                      ? 'bg-[var(--brand-500)] text-white shadow-xs'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]'
                  }`}
                >
                  {role.label}
                </button>
              );
            })}
          </div>

          {/* Right Select Dropdowns: Group & Status */}
          <div className="flex items-center gap-2">
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
            >
              <option value="ALL">All Classification Groups</option>
              {(Object.keys(PARTY_GROUP_META) as PartyGroup[]).map((g) => (
                <option key={g} value={g}>
                  {PARTY_GROUP_META[g].label}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* MASTER DATA TABLE */}
      <MasterDataTable<PartyRecord>
        title="Unified Party Master"
        subtitle="Customer, Supplier, Subcontractor & Transporter Corporate Accounts"
        screenCode="PARTY_MASTER"
        tableNameBadge="tbl_crm_party"
        data={parties}
        rowKey={(row) => row.partyId}
        columns={columns}
        searchPlaceholder="Search by party code, company name, contact, phone, GSTIN, PAN or city..."
        searchPredicate={searchPredicate}
        groupByOptions={groupByOptions}
        addButtonLabel="New Corporate Party"
        onAddClick={openCreateModal}
        onExportClick={handleExportCsv}
        pageSize={10}
        isLoading={isPartiesLoading}
        renderRowActions={(row: PartyRecord) => (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePrintPartySheet(row)}
              title="Print Party Datasheet & Ledger Card"
              className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Printer className="h-4 w-4" />
            </button>
            <PermissionGate screen="PARTY_MASTER" action="EDIT">
              <button
                onClick={() => openEditModal(row)}
                title="Edit Corporate Party"
                className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-500/10 dark:text-blue-400 transition-colors"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            </PermissionGate>
            <PermissionGate screen="PARTY_MASTER" action="DELETE">
              <button
                onClick={() => openDeleteModal(row)}
                title="Delete Corporate Party"
                className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </PermissionGate>
          </div>
        )}
      />

      {/* CREATE / EDIT MODAL */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-500)] text-white shadow-xs">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    {editingParty ? `Edit Account: ${editingParty.partyCode}` : 'Create Unified Corporate Party Account'}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Customer, Vendor, Subcontractor, Multi-Plant GSTINs & Credit Parameters
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsFormModalOpen(false);
                  resetForm();
                }}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Tabs Header */}
            <div className="flex border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 pt-2 gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('profile')}
                className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'profile'
                    ? 'border-[var(--brand-500)] text-[var(--brand-600)] dark:text-[var(--brand-300)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Tag className="h-3.5 w-3.5" />
                1. Corporate Identity & Roles
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('commercial')}
                className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'commercial'
                    ? 'border-[var(--brand-500)] text-[var(--brand-600)] dark:text-[var(--brand-300)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <CreditCard className="h-3.5 w-3.5" />
                2. Contact & Commercial Terms
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('addresses')}
                className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'addresses'
                    ? 'border-[var(--brand-500)] text-[var(--brand-600)] dark:text-[var(--brand-300)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <MapPin className="h-3.5 w-3.5" />
                3. Multi-Plant GSTINs & Addresses ({formData.addresses.length})
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {formErrors.server && (
                <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formErrors.server}</span>
                </div>
              )}

              {/* TAB 1: CORPORATE IDENTITY & ROLES */}
              {activeTab === 'profile' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Party Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. CUST-MARUTI-01 or SUPP-JSW-01"
                        value={formData.partyCode}
                        onChange={(e) =>
                          setFormData({ ...formData, partyCode: e.target.value.toUpperCase() })
                        }
                        className={`w-full rounded-xl border bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden ${
                          formErrors.partyCode ? 'border-rose-500' : 'border-[var(--border-subtle)]'
                        }`}
                      />
                      {formErrors.partyCode && (
                        <p className="mt-1 text-[11px] text-rose-500">{formErrors.partyCode}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Classification Group <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.partyGroup}
                        onChange={(e) =>
                          setFormData({ ...formData, partyGroup: e.target.value as PartyGroup })
                        }
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      >
                        {(Object.keys(PARTY_GROUP_META) as PartyGroup[]).map((g) => (
                          <option key={g} value={g}>
                            {PARTY_GROUP_META[g].label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Legal Registered Entity Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Maruti Suzuki India Limited"
                        value={formData.partyName}
                        onChange={(e) => setFormData({ ...formData, partyName: e.target.value })}
                        className={`w-full rounded-xl border bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden ${
                          formErrors.partyName ? 'border-rose-500' : 'border-[var(--border-subtle)]'
                        }`}
                      />
                      {formErrors.partyName && (
                        <p className="mt-1 text-[11px] text-rose-500">{formErrors.partyName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Trade Name / Division Alias
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Powertrain Component Division"
                        value={formData.tradeName}
                        onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Commercial Roles Checkboxes */}
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-2">
                    <label className="block text-xs font-bold text-[var(--text-primary)]">
                      Commercial Roles (Unified Party Architecture) <span className="text-rose-500">*</span>
                    </label>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      A single corporate entity can serve multiple operational functions across Sales, Sourcing, and Job-Work.
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[var(--text-primary)]">
                        <input
                          type="checkbox"
                          checked={formData.isCustomer}
                          onChange={(e) => setFormData({ ...formData, isCustomer: e.target.checked })}
                          className="h-4 w-4 rounded border-[var(--border-subtle)] text-[var(--brand-500)]"
                        />
                        <span>Customer (Sales)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[var(--text-primary)]">
                        <input
                          type="checkbox"
                          checked={formData.isSupplier}
                          onChange={(e) => setFormData({ ...formData, isSupplier: e.target.checked })}
                          className="h-4 w-4 rounded border-[var(--border-subtle)] text-[var(--brand-500)]"
                        />
                        <span>Supplier (Vendor)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[var(--text-primary)]">
                        <input
                          type="checkbox"
                          checked={formData.isJobWorker}
                          onChange={(e) => setFormData({ ...formData, isJobWorker: e.target.checked })}
                          className="h-4 w-4 rounded border-[var(--border-subtle)] text-[var(--brand-500)]"
                        />
                        <span>Job-Worker (Subcon)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[var(--text-primary)]">
                        <input
                          type="checkbox"
                          checked={formData.isTransporter}
                          onChange={(e) => setFormData({ ...formData, isTransporter: e.target.checked })}
                          className="h-4 w-4 rounded border-[var(--border-subtle)] text-[var(--brand-500)]"
                        />
                        <span>Transporter (Fleet)</span>
                      </label>
                    </div>
                    {formErrors.roles && (
                      <p className="mt-1 text-[11px] text-rose-500">{formErrors.roles}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Permanent Account Number (PAN)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. AAACM1234F"
                        maxLength={10}
                        value={formData.panNo}
                        onChange={(e) => setFormData({ ...formData, panNo: e.target.value.toUpperCase() })}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        MSME / Udyam Registration Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. UDYAM-GJ-01-0012345"
                        value={formData.msmeRegNo}
                        onChange={(e) => setFormData({ ...formData, msmeRegNo: e.target.value.toUpperCase() })}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <input
                      type="checkbox"
                      id="partyIsActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="h-4 w-4 rounded border-[var(--border-subtle)] text-[var(--brand-500)] focus:ring-[var(--brand-500)]"
                    />
                    <label htmlFor="partyIsActive" className="text-xs font-medium text-[var(--text-primary)] cursor-pointer">
                      Party is Active and authorized for Orders, Invoices, and Gate Receipts
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 2: CONTACT & COMMERCIAL TERMS */}
              {activeTab === 'commercial' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Primary Key Contact Person <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rakesh Sharma (Head of SCM)"
                        value={formData.primaryContactName}
                        onChange={(e) => setFormData({ ...formData, primaryContactName: e.target.value })}
                        className={`w-full rounded-xl border bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden ${
                          formErrors.primaryContactName ? 'border-rose-500' : 'border-[var(--border-subtle)]'
                        }`}
                      />
                      {formErrors.primaryContactName && (
                        <p className="mt-1 text-[11px] text-rose-500">{formErrors.primaryContactName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Primary Mobile / Phone <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. +91-9811012345"
                        value={formData.primaryPhone}
                        onChange={(e) => setFormData({ ...formData, primaryPhone: e.target.value })}
                        className={`w-full rounded-xl border bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden ${
                          formErrors.primaryPhone ? 'border-rose-500' : 'border-[var(--border-subtle)]'
                        }`}
                      />
                      {formErrors.primaryPhone && (
                        <p className="mt-1 text-[11px] text-rose-500">{formErrors.primaryPhone}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Primary Corporate Email
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. procurement@maruti.co.in"
                        value={formData.primaryEmail}
                        onChange={(e) => setFormData({ ...formData, primaryEmail: e.target.value })}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Corporate Website URL
                      </label>
                      <input
                        type="url"
                        placeholder="e.g. https://www.marutisuzuki.com"
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Credit Limit (₹)
                      </label>
                      <input
                        type="number"
                        step="1000"
                        value={formData.creditLimit}
                        onChange={(e) => setFormData({ ...formData, creditLimit: Number(e.target.value) })}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Credit Days Period
                      </label>
                      <input
                        type="number"
                        value={formData.creditDays}
                        onChange={(e) => setFormData({ ...formData, creditDays: Number(e.target.value) })}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Standard Payment Terms
                      </label>
                      <select
                        value={formData.paymentTerms}
                        onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value as PaymentTerms })}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      >
                        {(Object.keys(PAYMENT_TERMS_META) as PaymentTerms[]).map((t) => (
                          <option key={t} value={t}>
                            {PAYMENT_TERMS_META[t]}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        GST Statutory Registration Type
                      </label>
                      <select
                        value={formData.gstTreatmentType}
                        onChange={(e) => setFormData({ ...formData, gstTreatmentType: e.target.value as GstTreatmentType })}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      >
                        <option value="REGISTERED_REGULAR">Registered Regular Taxpayer</option>
                        <option value="REGISTERED_COMPOSITION">Composition Scheme</option>
                        <option value="UNREGISTERED">Unregistered Business / Individual</option>
                        <option value="SEZ_DEVELOPER">Special Economic Zone (SEZ Unit / Developer)</option>
                        <option value="OVERSEAS_EXPORT">Overseas International Client</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Commercial Remarks & Notes
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Vendor rating A+, Annual rate contract ref #2026-X"
                        value={formData.remarks}
                        onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: MULTI-LOCATION ADDRESSES & GSTINs */}
              {activeTab === 'addresses' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[var(--text-primary)]">
                        Multi-Plant & Billing Addresses
                      </h4>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        State-wise GSTIN numbers, dispatch plant sites, and corporate billing offices
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddAddressRow}
                      className="flex items-center gap-1.5 rounded-xl bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/20 px-3 py-1.5 text-xs font-semibold text-[var(--brand-600)] dark:text-[var(--brand-300)] hover:bg-[var(--brand-100)] transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Location
                    </button>
                  </div>

                  {formErrors.addresses && (
                    <p className="text-[11px] text-rose-500 font-semibold">{formErrors.addresses}</p>
                  )}

                  <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
                    {formData.addresses.map((addr, index) => (
                      <div
                        key={index}
                        className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-3 relative"
                      >
                        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-500)] text-white text-[10px] font-bold">
                              {index + 1}
                            </span>
                            <input
                              type="text"
                              value={addr.addressLabel}
                              onChange={(e) => handleAddressChange(index, 'addressLabel', e.target.value)}
                              placeholder="Location Label (e.g. Sanand Plant Dock 2)"
                              className="font-bold text-xs bg-transparent border-b border-dashed border-[var(--border-subtle)] focus:border-[var(--brand-500)] focus:outline-hidden text-[var(--text-primary)]"
                            />
                          </div>

                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={addr.isDefaultBilling}
                                onChange={(e) => handleAddressChange(index, 'isDefaultBilling', e.target.checked)}
                                className="h-3.5 w-3.5 rounded text-[var(--brand-500)]"
                              />
                              <span>Default Billing</span>
                            </label>

                            <label className="flex items-center gap-1 text-[11px] text-[var(--text-secondary)] cursor-pointer">
                              <input
                                type="checkbox"
                                checked={addr.isDefaultShipping}
                                onChange={(e) => handleAddressChange(index, 'isDefaultShipping', e.target.checked)}
                                className="h-3.5 w-3.5 rounded text-[var(--brand-500)]"
                              />
                              <span>Default Shipping</span>
                            </label>

                            {formData.addresses.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveAddressRow(index)}
                                className="text-rose-500 hover:text-rose-700 p-1 rounded"
                                title="Remove Address"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                          <div>
                            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5">
                              Address Type
                            </label>
                            <select
                              value={addr.addressType}
                              onChange={(e) => handleAddressChange(index, 'addressType', e.target.value as AddressType)}
                              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
                            >
                              <option value="BOTH">Billing & Shipping</option>
                              <option value="BILLING">Billing Only</option>
                              <option value="SHIPPING">Shipping Only</option>
                              <option value="PLANT_SITE">Plant Job-Work Site</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5">
                              State-Wise GSTIN
                            </label>
                            <input
                              type="text"
                              maxLength={15}
                              placeholder="e.g. 24AAACM1234F1Z1"
                              value={addr.gstin || ''}
                              onChange={(e) => handleAddressChange(index, 'gstin', e.target.value.toUpperCase())}
                              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs font-mono-code text-[var(--text-primary)]"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5">
                              State Name
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. Gujarat"
                              value={addr.stateName}
                              onChange={(e) => handleAddressChange(index, 'stateName', e.target.value)}
                              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5">
                              State Code (GST)
                            </label>
                            <input
                              type="text"
                              maxLength={2}
                              placeholder="e.g. 24"
                              value={addr.stateCode}
                              onChange={(e) => handleAddressChange(index, 'stateCode', e.target.value)}
                              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs font-mono-code text-[var(--text-primary)]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5">
                              Address Line 1 <span className="text-rose-500">*</span>
                            </label>
                            <input
                              type="text"
                              placeholder="Plot / Survey No, Industrial Estate, Street"
                              value={addr.addressLine1}
                              onChange={(e) => handleAddressChange(index, 'addressLine1', e.target.value)}
                              className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-medium text-[var(--text-secondary)] mb-0.5">
                              City & Pincode <span className="text-rose-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="text"
                                placeholder="City"
                                value={addr.city}
                                onChange={(e) => handleAddressChange(index, 'city', e.target.value)}
                                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs text-[var(--text-primary)]"
                              />
                              <input
                                type="text"
                                placeholder="PIN"
                                maxLength={10}
                                value={addr.pincode}
                                onChange={(e) => handleAddressChange(index, 'pincode', e.target.value)}
                                className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 text-xs font-mono-code text-[var(--text-primary)]"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
                <div className="flex gap-2">
                  {activeTab !== 'profile' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeTab === 'commercial') setActiveTab('profile');
                        if (activeTab === 'addresses') setActiveTab('commercial');
                      }}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
                    >
                      Previous Tab
                    </button>
                  )}
                  {activeTab !== 'addresses' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeTab === 'profile') setActiveTab('commercial');
                        if (activeTab === 'commercial') setActiveTab('addresses');
                      }}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2 text-xs font-semibold text-[var(--brand-600)] dark:text-[var(--brand-300)] hover:bg-[var(--brand-50)] dark:hover:bg-[var(--brand-500)]/20 transition-colors"
                    >
                      Next Tab
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormModalOpen(false);
                      resetForm();
                    }}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="flex items-center gap-2 rounded-xl bg-[var(--brand-500)] px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-[var(--brand-600)] transition-all disabled:opacity-50"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? 'Saving Account...'
                      : editingParty
                      ? 'Save Changes'
                      : 'Create Corporate Party'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        entityType="Corporate Party Account"
        entityName={deletingParty?.partyName || ''}
        entityCode={deletingParty?.partyCode}
        isDeleting={deleteMutation.isPending}
        errorMessage={deleteError}
        dependencies={deleteConflicts}
        onConfirm={() => {
          if (deletingParty) {
            deleteMutation.mutate(deletingParty.partyId);
          }
        }}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingParty(null);
          setDeleteError(null);
          setDeleteConflicts([]);
        }}
      />

      {/* PRINT PREVIEW MODAL */}
      {printParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border-subtle)] bg-white text-slate-900 shadow-2xl p-8 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <span className="text-xs font-bold tracking-widest uppercase text-slate-500">
                  KS-MFG ERP Master Account Card
                </span>
                <h2 className="text-xl font-black text-slate-900">
                  {printParty.partyCode}
                </h2>
                <p className="text-sm font-semibold text-slate-700">
                  {printParty.partyName}
                </p>
                {printParty.tradeName && (
                  <p className="text-xs italic text-slate-500">
                    Trade Alias: {printParty.tradeName}
                  </p>
                )}
              </div>
              <button
                onClick={() => setPrintParty(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="border rounded-lg p-3 space-y-1">
                <div className="text-slate-500 font-semibold uppercase text-[10px]">Commercial Classification</div>
                <div>Group: <strong>{PARTY_GROUP_META[printParty.partyGroup]?.label || printParty.partyGroup}</strong></div>
                <div>Roles: {[printParty.isCustomer && 'Customer', printParty.isSupplier && 'Supplier', printParty.isJobWorker && 'Job-Worker', printParty.isTransporter && 'Transporter'].filter(Boolean).join(', ')}</div>
                <div>PAN: <strong>{printParty.panNo || 'N/A'}</strong></div>
                <div>MSME: {printParty.msmeRegNo || 'N/A'}</div>
              </div>

              <div className="border rounded-lg p-3 space-y-1">
                <div className="text-slate-500 font-semibold uppercase text-[10px]">Primary Key Contact</div>
                <div>Contact: <strong>{printParty.primaryContactName}</strong></div>
                <div>Phone: {printParty.primaryPhone}</div>
                <div>Email: {printParty.primaryEmail || 'N/A'}</div>
                <div>Website: {printParty.website || 'N/A'}</div>
              </div>

              <div className="border rounded-lg p-3 space-y-1">
                <div className="text-slate-500 font-semibold uppercase text-[10px]">Credit Terms & Limits</div>
                <div>Credit Limit: <strong>₹{printParty.creditLimit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></div>
                <div>Payment Terms: {PAYMENT_TERMS_META[printParty.paymentTerms] || printParty.paymentTerms}</div>
                <div>Credit Days: {printParty.creditDays} Days</div>
                <div>GST Treatment: {printParty.gstTreatmentType}</div>
              </div>

              <div className="border rounded-lg p-3 space-y-1">
                <div className="text-slate-500 font-semibold uppercase text-[10px]">Location Breakdown</div>
                <div>Registered Locations: {printParty.addresses?.length || 0}</div>
                {printParty.addresses?.[0] && (
                  <div className="text-[11px] text-slate-600">
                    Primary: {printParty.addresses[0].city}, {printParty.addresses[0].stateName}
                    <br />
                    GSTIN: {printParty.addresses[0].gstin || 'Unregistered'}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setPrintParty(null)}
                className="rounded-lg border px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-black"
              >
                <Printer className="h-4 w-4" />
                Print Account Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
