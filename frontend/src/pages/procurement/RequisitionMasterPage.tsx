import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Edit3,
  FileCheck2,
  FileText,
  Filter,
  Layers,
  Package,
  Plus,
  Printer,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Trash2,
  User,
  Warehouse,
  X,
  XCircle,
} from 'lucide-react';
import { apiClient, type ApiResponse } from '../../lib/apiClient';
import {
  MasterDataTable,
  type MasterTableColumn,
  type GroupByOption,
} from '../../components/common/MasterDataTable';
import {
  ConfirmDeleteModal,
  type DependencyConflictItem,
} from '../../components/common/ConfirmDeleteModal';
import { PermissionGate } from '../../components/common/PermissionGate';

// ============================================================================
// TYPES & CATALOGUES
// ============================================================================

export type PrStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONVERTED'
  | 'CANCELLED';

export type PrPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL_URGENT';

export type PrType =
  | 'RAW_MATERIAL'
  | 'CAPITAL_ASSET'
  | 'CONSUMABLE_MRO'
  | 'TOOLING_SPARE'
  | 'JOB_WORK_SERVICE';

export interface PrItemRecord {
  prItemId?: number;
  prId?: number;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  itemType?: string;
  uomId: number;
  uomCode?: string;
  uomName?: string;
  requiredQty: number;
  approvedQty?: number;
  orderedQty?: number;
  estimatedRate: number;
  estimatedAmount?: number;
  suggestedVendorId?: number | null;
  suggestedVendorName?: string | null;
  remarks?: string;
  isActive?: boolean;
}

export interface RequisitionHeaderRecord {
  prId: number;
  prNo: string;
  prDate: string;
  requiredByDate: string;
  departmentId: number;
  departmentCode: string;
  departmentName: string;
  requesterUserId: number;
  requesterName: string;
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  priority: PrPriority;
  prType: PrType;
  status: PrStatus;
  totalEstimatedAmount: number;
  purpose: string;
  approvalRemarks?: string | null;
  approvedBy?: number | null;
  approvedByName?: string | null;
  approvedDate?: string | null;
  rejectedBy?: number | null;
  rejectedByName?: string | null;
  rejectedDate?: string | null;
  isActive: boolean;
  createdDate: string;
  itemsCount: number;
  items?: PrItemRecord[];
}

export interface RequisitionSummary {
  totalRequisitions: number;
  pendingCount: number;
  approvedCount: number;
  criticalCount: number;
  draftCount: number;
}

export interface DepartmentOption {
  deptId: number;
  deptCode: string;
  deptName: string;
}

export interface WarehouseOption {
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
}

export interface ItemLookupOption {
  itemId: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  baseUomId: number;
  baseUomCode?: string;
  purchaseRate?: number;
}

export interface UomLookupOption {
  uomId: number;
  uomCode: string;
  uomName: string;
}

export interface SupplierOption {
  partyId: number;
  partyCode: string;
  partyName: string;
}

const STATUS_BADGE_MAP: Record<
  PrStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  DRAFT: {
    label: 'Draft',
    bg: 'bg-muted/80',
    text: 'text-muted-foreground',
    border: 'border-border',
  },
  SUBMITTED: {
    label: 'Pending Approval',
    bg: 'bg-amber-500/10 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-300 dark:border-amber-800',
  },
  APPROVED: {
    label: 'Authorized / Approved',
    bg: 'bg-emerald-500/10 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-300 dark:border-emerald-800',
  },
  REJECTED: {
    label: 'Rejected',
    bg: 'bg-red-500/10 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-300 dark:border-red-800',
  },
  CONVERTED: {
    label: 'PO / RFQ Converted',
    bg: 'bg-blue-500/10 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-300 dark:border-blue-800',
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-stone-500/10 dark:bg-stone-900/30',
    text: 'text-stone-600 dark:text-stone-400',
    border: 'border-stone-300 dark:border-stone-800',
  },
};

const PRIORITY_BADGE_MAP: Record<
  PrPriority,
  { label: string; bg: string; text: string; dot: string }
> = {
  LOW: {
    label: 'Low',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-300',
    dot: 'bg-slate-400',
  },
  MEDIUM: {
    label: 'Medium',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  HIGH: {
    label: 'High',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  CRITICAL_URGENT: {
    label: 'Critical / Urgent',
    bg: 'bg-red-50 dark:bg-red-950/40',
    text: 'text-red-700 dark:text-red-300',
    dot: 'bg-red-500 animate-pulse',
  },
};

const PR_TYPE_LABELS: Record<PrType, string> = {
  RAW_MATERIAL: 'Raw Material',
  CAPITAL_ASSET: 'Capital Asset',
  CONSUMABLE_MRO: 'Consumables & MRO',
  TOOLING_SPARE: 'Tooling & Spares',
  JOB_WORK_SERVICE: 'Job Work Service',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const RequisitionMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [prTypeFilter, setPrTypeFilter] = useState<string>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Modal Dialogs
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingRequisition, setEditingRequisition] =
    useState<RequisitionHeaderRecord | null>(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authorizingPr, setAuthorizingPr] =
    useState<RequisitionHeaderRecord | null>(null);
  const [authAction, setAuthAction] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [authRemarks, setAuthRemarks] = useState<string>('');
  const [authItems, setAuthItems] = useState<
    { prItemId: number; itemCode: string; itemName: string; requiredQty: number; approvedQty: number; uomCode: string; estimatedRate: number }[]
  >([]);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printTarget, setPrintTarget] =
    useState<RequisitionHeaderRecord | null>(null);

  const [deleteTarget, setDeleteTarget] =
    useState<RequisitionHeaderRecord | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(
    null,
  );
  const [deleteConflicts, setDeleteConflicts] = useState<
    DependencyConflictItem[]
  >([]);

  // Form State
  const [formPrNo, setFormPrNo] = useState<string>('');
  const [formPrDate, setFormPrDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [formRequiredByDate, setFormRequiredByDate] = useState<string>(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
  );
  const [formDepartmentId, setFormDepartmentId] = useState<number | ''>('');
  const [formWarehouseId, setFormWarehouseId] = useState<number | ''>('');
  const [formPriority, setFormPriority] = useState<PrPriority>('MEDIUM');
  const [formPrType, setFormPrType] = useState<PrType>('RAW_MATERIAL');
  const [formPurpose, setFormPurpose] = useState<string>('');
  const [formItems, setFormItems] = useState<PrItemRecord[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // DATA FETCHING
  // --------------------------------------------------------------------------

  // 1. Summary Metrics
  const { data: summary, isLoading: isSummaryLoading } =
    useQuery<RequisitionSummary>({
      queryKey: ['procurement', 'requisitions', 'summary'],
      queryFn: async () => {
        const res = await apiClient.get<ApiResponse<RequisitionSummary>>(
          '/procurement/requisitions/summary',
        );
        return res.data.data;
      },
    });

  // 2. Requisition List
  const { data: requisitions = [], isLoading: isRequisitionsLoading } =
    useQuery<RequisitionHeaderRecord[]>({
      queryKey: [
        'procurement',
        'requisitions',
        'list',
        statusFilter,
        priorityFilter,
        prTypeFilter,
        departmentFilter,
        warehouseFilter,
        globalSearch,
      ],
      queryFn: async () => {
        const params: Record<string, string> = {};
        if (statusFilter !== 'ALL') params.status = statusFilter;
        if (priorityFilter !== 'ALL') params.priority = priorityFilter;
        if (prTypeFilter !== 'ALL') params.prType = prTypeFilter;
        if (departmentFilter !== 'ALL') params.departmentId = departmentFilter;
        if (warehouseFilter !== 'ALL') params.warehouseId = warehouseFilter;
        if (globalSearch.trim()) params.search = globalSearch.trim();

        const res = await apiClient.get<ApiResponse<RequisitionHeaderRecord[]>>(
          '/procurement/requisitions',
          { params },
        );
        return res.data.data;
      },
    });

  // 3. Dropdowns
  const { data: departments = [] } = useQuery<DepartmentOption[]>({
    queryKey: ['hr', 'departments', 'options'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/hr/departments');
      return (res.data.data || []).map((d: any) => ({
        deptId: d.deptId,
        deptCode: d.deptCode,
        deptName: d.deptName,
      }));
    },
    staleTime: 60_000,
  });

  const { data: warehouses = [] } = useQuery<WarehouseOption[]>({
    queryKey: ['inventory', 'warehouses', 'options'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>(
        '/inventory/warehouses',
      );
      return (res.data.data || []).map((w: any) => ({
        warehouseId: w.warehouseId,
        warehouseCode: w.warehouseCode,
        warehouseName: w.warehouseName,
      }));
    },
    staleTime: 60_000,
  });

  const { data: itemsCatalog = [] } = useQuery<ItemLookupOption[]>({
    queryKey: ['inventory', 'items', 'options'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/inventory/items');
      return (res.data.data || []).map((i: any) => ({
        itemId: i.itemId,
        itemCode: i.itemCode,
        itemName: i.itemName,
        itemType: i.itemType,
        baseUomId: i.baseUomId,
        baseUomCode: i.baseUomCode,
        purchaseRate: Number(i.purchaseRate) || 0,
      }));
    },
    staleTime: 60_000,
  });

  const { data: uomsCatalog = [] } = useQuery<UomLookupOption[]>({
    queryKey: ['inventory', 'uoms', 'options'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/inventory/uoms');
      return (res.data.data || []).map((u: any) => ({
        uomId: u.uomId,
        uomCode: u.uomCode,
        uomName: u.uomName,
      }));
    },
    staleTime: 60_000,
  });

  const { data: suppliers = [] } = useQuery<SupplierOption[]>({
    queryKey: ['parties', 'suppliers', 'options'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/parties', {
        params: { isSupplier: 'true' },
      });
      return (res.data.data || []).map((p: any) => ({
        partyId: p.partyId,
        partyCode: p.partyCode,
        partyName: p.partyName,
      }));
    },
    staleTime: 60_000,
  });

  // Query details for Print Voucher
  const { data: printDetailData, isLoading: isPrintDetailLoading } =
    useQuery<RequisitionHeaderRecord>({
      queryKey: ['procurement', 'requisition', printTarget?.prId],
      queryFn: async () => {
        if (!printTarget) return null as any;
        const res = await apiClient.get<ApiResponse<RequisitionHeaderRecord>>(
          `/procurement/requisitions/${printTarget.prId}`,
        );
        return res.data.data;
      },
      enabled: !!printTarget,
    });

  // Query details for Authorization Modal
  const { data: authDetailData, isLoading: isAuthDetailLoading } =
    useQuery<RequisitionHeaderRecord>({
      queryKey: ['procurement', 'requisition', 'auth', authorizingPr?.prId],
      queryFn: async () => {
        if (!authorizingPr) return null as any;
        const res = await apiClient.get<ApiResponse<RequisitionHeaderRecord>>(
          `/procurement/requisitions/${authorizingPr.prId}`,
        );
        return res.data.data;
      },
      enabled: !!authorizingPr,
    });

  // Synchronize auth items once auth detail is fetched
  React.useEffect(() => {
    if (authDetailData?.items) {
      setAuthItems(
        authDetailData.items.map((it) => ({
          prItemId: it.prItemId!,
          itemCode: it.itemCode || '',
          itemName: it.itemName || '',
          requiredQty: Number(it.requiredQty) || 0,
          approvedQty: Number(it.approvedQty) || Number(it.requiredQty) || 0,
          uomCode: it.uomCode || '',
          estimatedRate: Number(it.estimatedRate) || 0,
        })),
      );
    }
  }, [authDetailData]);

  // --------------------------------------------------------------------------
  // MUTATIONS
  // --------------------------------------------------------------------------

  // Create / Update
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!formDepartmentId) {
        throw new Error('Please select requesting department');
      }
      if (!formWarehouseId) {
        throw new Error('Please select receiving warehouse');
      }
      if (!formPurpose.trim()) {
        throw new Error('Please enter requisition purpose / justification');
      }
      if (formItems.length === 0) {
        throw new Error('Please add at least one line item');
      }

      for (let idx = 0; idx < formItems.length; idx++) {
        const it = formItems[idx];
        if (!it.itemId) {
          throw new Error(`Item line #${idx + 1}: SKU item is required`);
        }
        if (!it.requiredQty || it.requiredQty <= 0) {
          throw new Error(
            `Item line #${idx + 1}: Required Quantity must be greater than 0`,
          );
        }
      }

      const payload = {
        prNo: formPrNo.trim() ? formPrNo.trim().toUpperCase() : undefined,
        prDate: formPrDate,
        requiredByDate: formRequiredByDate,
        departmentId: Number(formDepartmentId),
        warehouseId: Number(formWarehouseId),
        priority: formPriority,
        prType: formPrType,
        purpose: formPurpose.trim(),
        items: formItems.map((it) => ({
          itemId: it.itemId,
          uomId: it.uomId,
          requiredQty: Number(it.requiredQty),
          estimatedRate: Number(it.estimatedRate) || 0,
          suggestedVendorId: it.suggestedVendorId || null,
          remarks: it.remarks?.trim() || undefined,
        })),
      };

      if (editingRequisition) {
        const res = await apiClient.put<ApiResponse<RequisitionHeaderRecord>>(
          `/procurement/requisitions/${editingRequisition.prId}`,
          payload,
        );
        return res.data.data;
      } else {
        const res = await apiClient.post<ApiResponse<RequisitionHeaderRecord>>(
          '/procurement/requisitions',
          payload,
        );
        return res.data.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['procurement', 'requisitions'],
      });
      setIsEditorOpen(false);
      setEditingRequisition(null);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(
        err.response?.data?.message || err.message || 'Failed to save requisition',
      );
    },
  });

  // Submit Requisition
  const submitMutation = useMutation({
    mutationFn: async (prId: number) => {
      const res = await apiClient.post<ApiResponse<RequisitionHeaderRecord>>(
        `/procurement/requisitions/${prId}/submit`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['procurement', 'requisitions'],
      });
    },
  });

  // Authorize (Approve / Reject)
  const authorizeMutation = useMutation({
    mutationFn: async () => {
      if (!authorizingPr) return;
      if (authAction === 'REJECT' && !authRemarks.trim()) {
        throw new Error(
          'Rejection justification remarks are mandatory when rejecting.',
        );
      }

      const payload = {
        action: authAction,
        remarks: authRemarks.trim() || undefined,
        items:
          authAction === 'APPROVE'
            ? authItems.map((it) => ({
                prItemId: it.prItemId,
                approvedQty: Number(it.approvedQty),
              }))
            : undefined,
      };

      const res = await apiClient.post<ApiResponse<RequisitionHeaderRecord>>(
        `/procurement/requisitions/${authorizingPr.prId}/authorize`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['procurement', 'requisitions'],
      });
      setIsAuthModalOpen(false);
      setAuthorizingPr(null);
      setAuthRemarks('');
    },
    onError: (err: any) => {
      alert(
        err.response?.data?.message ||
          err.message ||
          'Failed to authorize requisition',
      );
    },
  });

  // Delete Requisition
  const deleteMutation = useMutation({
    mutationFn: async (prId: number) => {
      const res = await apiClient.delete<ApiResponse<any>>(
        `/procurement/requisitions/${prId}`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['procurement', 'requisitions'],
      });
      setDeleteTarget(null);
      setDeleteErrorMessage(null);
      setDeleteConflicts([]);
    },
    onError: (err: any) => {
      const data = err.response?.data;
      setDeleteErrorMessage(
        data?.message || err.message || 'Unable to delete requisition.',
      );
      if (data?.details?.conflicts) {
        setDeleteConflicts(data.details.conflicts);
      }
    },
  });

  // --------------------------------------------------------------------------
  // MODAL HANDLERS
  // --------------------------------------------------------------------------

  const handleOpenCreateModal = () => {
    setEditingRequisition(null);
    setFormPrNo('');
    setFormPrDate(new Date().toISOString().split('T')[0]);
    setFormRequiredByDate(
      new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    );
    setFormDepartmentId(departments[0]?.deptId || '');
    setFormWarehouseId(warehouses[0]?.warehouseId || '');
    setFormPriority('MEDIUM');
    setFormPrType('RAW_MATERIAL');
    setFormPurpose('');
    setFormItems([]);
    setFormError(null);
    setIsEditorOpen(true);
  };

  const handleOpenEditModal = async (row: RequisitionHeaderRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<RequisitionHeaderRecord>>(
        `/procurement/requisitions/${row.prId}`,
      );
      const pr = res.data.data;
      setEditingRequisition(pr);
      setFormPrNo(pr.prNo);
      setFormPrDate(pr.prDate);
      setFormRequiredByDate(pr.requiredByDate);
      setFormDepartmentId(pr.departmentId);
      setFormWarehouseId(pr.warehouseId);
      setFormPriority(pr.priority);
      setFormPrType(pr.prType);
      setFormPurpose(pr.purpose);
      setFormItems(pr.items || []);
      setFormError(null);
      setIsEditorOpen(true);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch requisition details for editing');
    }
  };

  const handleOpenAuthModal = (row: RequisitionHeaderRecord) => {
    setAuthorizingPr(row);
    setAuthAction('APPROVE');
    setAuthRemarks('');
    setIsAuthModalOpen(true);
  };

  const handleOpenPrintModal = (row: RequisitionHeaderRecord) => {
    setPrintTarget(row);
    setIsPrintModalOpen(true);
    // Log PRINT action for audit trail
    apiClient
      .post('/procurement/requisitions/actions/log', { actionType: 'PRINT' })
      .catch(() => {});
  };

  const handleExportClick = () => {
    // Log EXPORT action for audit trail
    apiClient
      .post('/procurement/requisitions/actions/log', { actionType: 'EXPORT' })
      .catch(() => {});
  };

  // Add Item Line
  const handleAddItemRow = () => {
    if (itemsCatalog.length === 0) return;
    const defaultItem = itemsCatalog[0];
    const defaultUom =
      uomsCatalog.find((u) => u.uomId === defaultItem.baseUomId) ||
      uomsCatalog[0];

    const newItem: PrItemRecord = {
      itemId: defaultItem.itemId,
      itemCode: defaultItem.itemCode,
      itemName: defaultItem.itemName,
      itemType: defaultItem.itemType,
      uomId: defaultUom?.uomId || defaultItem.baseUomId,
      uomCode: defaultUom?.uomCode,
      requiredQty: 1,
      estimatedRate: defaultItem.purchaseRate || 0,
      suggestedVendorId: null,
      remarks: '',
    };
    setFormItems([...formItems, newItem]);
  };

  // Update Item Line
  const handleUpdateItemRow = (
    index: number,
    field: keyof PrItemRecord,
    val: any,
  ) => {
    const updated = [...formItems];
    const item = { ...updated[index] };

    if (field === 'itemId') {
      const selected = itemsCatalog.find((i) => i.itemId === Number(val));
      if (selected) {
        item.itemId = selected.itemId;
        item.itemCode = selected.itemCode;
        item.itemName = selected.itemName;
        item.itemType = selected.itemType;
        item.uomId = selected.baseUomId;
        const uomObj = uomsCatalog.find((u) => u.uomId === selected.baseUomId);
        item.uomCode = uomObj?.uomCode;
        item.estimatedRate = selected.purchaseRate || 0;
      }
    } else if (field === 'uomId') {
      item.uomId = Number(val);
      const uomObj = uomsCatalog.find((u) => u.uomId === Number(val));
      item.uomCode = uomObj?.uomCode;
    } else if (field === 'requiredQty') {
      item.requiredQty = Math.max(0, Number(val));
    } else if (field === 'estimatedRate') {
      item.estimatedRate = Math.max(0, Number(val));
    } else if (field === 'suggestedVendorId') {
      item.suggestedVendorId = val ? Number(val) : null;
    } else if (field === 'remarks') {
      item.remarks = val;
    }

    updated[index] = item;
    setFormItems(updated);
  };

  // Remove Item Line
  const handleRemoveItemRow = (index: number) => {
    setFormItems(formItems.filter((_, idx) => idx !== index));
  };

  // Form Calculated Total
  const calculatedFormTotal = useMemo(() => {
    return formItems.reduce(
      (sum, it) =>
        sum + (Number(it.requiredQty) || 0) * (Number(it.estimatedRate) || 0),
      0,
    );
  }, [formItems]);

  // --------------------------------------------------------------------------
  // TABLE COLUMNS CONFIGURATION
  // --------------------------------------------------------------------------

  const columns = useMemo<MasterTableColumn<RequisitionHeaderRecord>[]>(
    () => [
      {
        key: 'prNo',
        header: 'Requisition No & Priority',
        sortable: true,
        sortValue: (r) => r.prNo,
        render: (row) => {
          const pri = PRIORITY_BADGE_MAP[row.priority] || PRIORITY_BADGE_MAP.MEDIUM;
          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-foreground text-sm">
                  {row.prNo}
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${pri.bg} ${pri.text}`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${pri.dot}`} />
                  {pri.label}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Type: {PR_TYPE_LABELS[row.prType] || row.prType}
              </span>
            </div>
          );
        },
      },
      {
        key: 'dates',
        header: 'Dates (Raised / Req By)',
        sortable: true,
        sortValue: (r) => r.prDate,
        render: (row) => (
          <div className="flex flex-col text-xs">
            <span className="font-mono font-medium text-foreground flex items-center gap-1">
              <Calendar className="w-3 h-3 text-muted-foreground" />
              Raised: {row.prDate}
            </span>
            <span className="font-mono text-muted-foreground flex items-center gap-1 mt-0.5">
              <Clock className="w-3 h-3 text-amber-500" />
              Need By: {row.requiredByDate}
            </span>
          </div>
        ),
      },
      {
        key: 'department',
        header: 'Dept & Warehouse',
        sortable: true,
        sortValue: (r) => r.departmentName,
        render: (row) => (
          <div className="flex flex-col text-xs">
            <span className="font-medium text-foreground flex items-center gap-1">
              <Building2 className="w-3 h-3 text-muted-foreground" />
              {row.departmentName}
            </span>
            <span className="text-muted-foreground flex items-center gap-1 mt-0.5">
              <Warehouse className="w-3 h-3 text-muted-foreground" />
              {row.warehouseName}
            </span>
          </div>
        ),
      },
      {
        key: 'purpose',
        header: 'Purpose / Justification',
        sortable: false,
        render: (row) => (
          <div className="max-w-xs text-xs truncate text-muted-foreground" title={row.purpose}>
            {row.purpose}
          </div>
        ),
      },
      {
        key: 'users',
        header: 'Requester / Approver',
        sortable: false,
        render: (row) => (
          <div className="flex flex-col text-xs">
            <span className="text-foreground flex items-center gap-1">
              <User className="w-3 h-3 text-muted-foreground" />
              {row.requesterName}
            </span>
            {row.approvedByName ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="w-3 h-3" />
                {row.approvedByName}
              </span>
            ) : row.rejectedByName ? (
              <span className="text-red-600 dark:text-red-400 font-medium flex items-center gap-1 mt-0.5">
                <XCircle className="w-3 h-3" />
                {row.rejectedByName}
              </span>
            ) : (
              <span className="text-muted-foreground italic mt-0.5">
                Pending Approval
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'amount',
        header: 'Items & Est. Amount',
        sortable: true,
        sortValue: (r) => r.totalEstimatedAmount,
        render: (row) => (
          <div className="flex flex-col text-xs">
            <span className="font-mono font-bold text-foreground">
              ₹ {Number(row.totalEstimatedAmount).toLocaleString('en-IN', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span className="text-muted-foreground">
              {row.itemsCount} {row.itemsCount === 1 ? 'item' : 'items'}
            </span>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        sortValue: (r) => r.status,
        render: (row) => {
          const badge = STATUS_BADGE_MAP[row.status] || STATUS_BADGE_MAP.DRAFT;
          return (
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
            >
              {badge.label}
            </span>
          );
        },
      },
    ],
    [],
  );

  const groupByOptions = useMemo<GroupByOption<RequisitionHeaderRecord>[]>(
    () => [
      {
        key: 'status',
        label: 'Status',
        groupValue: (r) => STATUS_BADGE_MAP[r.status]?.label || r.status,
      },
      {
        key: 'priority',
        label: 'Priority',
        groupValue: (r) => PRIORITY_BADGE_MAP[r.priority]?.label || r.priority,
      },
      {
        key: 'department',
        label: 'Department',
        groupValue: (r) => r.departmentName,
      },
      {
        key: 'warehouse',
        label: 'Warehouse',
        groupValue: (r) => r.warehouseName,
      },
      {
        key: 'prType',
        label: 'Requisition Type',
        groupValue: (r) => PR_TYPE_LABELS[r.prType] || r.prType,
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Purchase Requisitions (MR)
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Procurement & Inventory
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Department material indenting, bill-of-materials stock reservations,
            and multi-tier approval workflow.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGate screen="PURCHASE_REQ" action="ADD">
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Material Requisition
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Requisitions */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Requisitions
            </p>
            <p className="text-2xl font-bold font-mono text-foreground">
              {isSummaryLoading ? '...' : summary?.totalRequisitions ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">All active indents</p>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pending Approvals
            </p>
            <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {isSummaryLoading ? '...' : summary?.pendingCount ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Awaiting manager sign-off</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Authorized Requisitions */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Authorized / Approved
            </p>
            <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {isSummaryLoading ? '...' : summary?.approvedCount ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Ready for PO / RFQ issue</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Critical / Urgent */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Critical & Urgent
            </p>
            <p className="text-2xl font-bold font-mono text-red-600 dark:text-red-400">
              {isSummaryLoading ? '...' : summary?.criticalCount ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Line-stoppage priority indents</p>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Status:
            </span>
            {(
              [
                ['ALL', 'All Statuses'],
                ['DRAFT', 'Draft'],
                ['SUBMITTED', 'Submitted'],
                ['APPROVED', 'Approved'],
                ['REJECTED', 'Rejected'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setStatusFilter(val)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === val
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="h-4 w-[1px] bg-border mx-1 hidden sm:block" />

          {/* Priority Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">
              Priority:
            </span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="text-xs px-2.5 py-1 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL_URGENT">Critical / Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">
              Dept:
            </span>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="text-xs px-2.5 py-1 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Departments</option>
              {departments.map((d) => (
                <option key={d.deptId} value={d.deptId}>
                  {d.deptName}
                </option>
              ))}
            </select>
          </div>

          {/* Warehouse Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">
              Warehouse:
            </span>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="text-xs px-2.5 py-1 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Warehouses</option>
              {warehouses.map((w) => (
                <option key={w.warehouseId} value={w.warehouseId}>
                  {w.warehouseName}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Requisitions Data Table */}
      <MasterDataTable<RequisitionHeaderRecord>
        title="Requisitions Register"
        subtitle="Live procurement indents with real-time stock routing and authorization state"
        screenCode="PURCHASE_REQ"
        data={requisitions}
        rowKey={(row) => row.prId}
        isLoading={isRequisitionsLoading}
        columns={columns}
        groupByOptions={groupByOptions}
        onExportClick={handleExportClick}
        searchPredicate={(row, query) => {
          const q = query.toLowerCase();
          return (
            row.prNo.toLowerCase().includes(q) ||
            row.purpose.toLowerCase().includes(q) ||
            row.departmentName.toLowerCase().includes(q) ||
            row.warehouseName.toLowerCase().includes(q) ||
            row.requesterName.toLowerCase().includes(q) ||
            (row.approvedByName ? row.approvedByName.toLowerCase().includes(q) : false)
          );
        }}
        renderRowActions={(row) => (
          <div className="flex items-center gap-1.5 justify-end">
            {/* Print Voucher */}
            <PermissionGate screen="PURCHASE_REQ" action="PRINT">
              <button
                onClick={() => handleOpenPrintModal(row)}
                title="Print Requisition Voucher"
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              >
                <Printer className="w-4 h-4" />
              </button>
            </PermissionGate>

            {/* Submit for Approval (Draft only) */}
            {row.status === 'DRAFT' && (
              <PermissionGate screen="PURCHASE_REQ" action="SUBMIT">
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        `Submit requisition ${row.prNo} for manager approval?`,
                      )
                    ) {
                      submitMutation.mutate(row.prId);
                    }
                  }}
                  title="Submit for Approval"
                  disabled={submitMutation.isPending}
                  className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-md transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {/* Authorize (Submitted only) */}
            {row.status === 'SUBMITTED' && (
              <PermissionGate screen="PURCHASE_REQ" action="AUTHORIZE">
                <button
                  onClick={() => handleOpenAuthModal(row)}
                  title="Authorize Requisition"
                  className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {/* Edit (Draft or Submitted only) */}
            {(row.status === 'DRAFT' || row.status === 'SUBMITTED') && (
              <PermissionGate screen="PURCHASE_REQ" action="EDIT">
                <button
                  onClick={() => handleOpenEditModal(row)}
                  title="Edit Requisition"
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {/* Delete (Draft or Cancelled only) */}
            {(row.status === 'DRAFT' || row.status === 'CANCELLED') && (
              <PermissionGate screen="PURCHASE_REQ" action="DELETE">
                <button
                  onClick={() => {
                    setDeleteTarget(row);
                    setDeleteErrorMessage(null);
                    setDeleteConflicts([]);
                  }}
                  title="Delete Requisition"
                  className="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-500/10 rounded-md transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}
          </div>
        )}
      />

      {/* ==================================================================== */}
      {/* CREATE / EDIT REQUISITION MODAL */}
      {/* ==================================================================== */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">
                    {editingRequisition
                      ? `Edit Requisition #${editingRequisition.prNo}`
                      : 'Create New Material Requisition'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Specify items, required quantities, target warehouse, and delivery deadline.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-xs rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Header Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* PR No */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    PR Number (Auto if blank)
                  </label>
                  <input
                    type="text"
                    value={formPrNo}
                    onChange={(e) => setFormPrNo(e.target.value)}
                    placeholder="PR-AHM-2627-XXXX"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background text-foreground font-mono uppercase focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* PR Date */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Requisition Date *
                  </label>
                  <input
                    type="date"
                    value={formPrDate}
                    onChange={(e) => setFormPrDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* Required By Date */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Required By Date *
                  </label>
                  <input
                    type="date"
                    value={formRequiredByDate}
                    onChange={(e) => setFormRequiredByDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* Requesting Department */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Requesting Department *
                  </label>
                  <select
                    value={formDepartmentId}
                    onChange={(e) =>
                      setFormDepartmentId(
                        e.target.value ? Number(e.target.value) : '',
                      )
                    }
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="">-- Select Department --</option>
                    {departments.map((d) => (
                      <option key={d.deptId} value={d.deptId}>
                        {d.deptName} ({d.deptCode})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Destination Warehouse */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Destination Warehouse *
                  </label>
                  <select
                    value={formWarehouseId}
                    onChange={(e) =>
                      setFormWarehouseId(
                        e.target.value ? Number(e.target.value) : '',
                      )
                    }
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="">-- Select Warehouse --</option>
                    {warehouses.map((w) => (
                      <option key={w.warehouseId} value={w.warehouseId}>
                        {w.warehouseName} ({w.warehouseCode})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Priority Level *
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as PrPriority)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="LOW">Low (Routine replenish)</option>
                    <option value="MEDIUM">Medium (Standard batch)</option>
                    <option value="HIGH">High (Upcoming work order)</option>
                    <option value="CRITICAL_URGENT">Critical / Urgent (Line Stoppage)</option>
                  </select>
                </div>

                {/* Indent Type */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Requisition Type *
                  </label>
                  <select
                    value={formPrType}
                    onChange={(e) => setFormPrType(e.target.value as PrType)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="RAW_MATERIAL">Raw Material</option>
                    <option value="CAPITAL_ASSET">Capital Asset</option>
                    <option value="CONSUMABLE_MRO">Consumable & MRO</option>
                    <option value="TOOLING_SPARE">Tooling & Spares</option>
                    <option value="JOB_WORK_SERVICE">Job Work Service</option>
                  </select>
                </div>

                {/* Purpose / Justification */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Purpose / Operational Justification *
                  </label>
                  <input
                    type="text"
                    value={formPurpose}
                    onChange={(e) => setFormPurpose(e.target.value)}
                    placeholder="e.g. For Job Order JO-AHM-2627-010, replacement for broken mill cutter"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Dynamic Line Items Section */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-primary" />
                    Material Line Items ({formItems.length})
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-semibold transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Item
                  </button>
                </div>

                {formItems.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-border rounded-xl text-muted-foreground text-xs space-y-2">
                    <p>No material line items added yet.</p>
                    <button
                      type="button"
                      onClick={handleAddItemRow}
                      className="inline-flex items-center gap-1 text-primary hover:underline font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add First Item
                    </button>
                  </div>
                ) : (
                  <div className="border border-border rounded-lg overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted text-muted-foreground border-b border-border">
                        <tr>
                          <th className="py-2.5 px-3 font-semibold min-w-[200px]">Item / SKU *</th>
                          <th className="py-2.5 px-2 font-semibold min-w-[100px]">UOM</th>
                          <th className="py-2.5 px-2 font-semibold min-w-[100px] text-right">Req. Qty *</th>
                          <th className="py-2.5 px-2 font-semibold min-w-[110px] text-right">Est. Rate (₹)</th>
                          <th className="py-2.5 px-2 font-semibold min-w-[110px] text-right">Est. Amount (₹)</th>
                          <th className="py-2.5 px-2 font-semibold min-w-[160px]">Suggested Vendor</th>
                          <th className="py-2.5 px-2 font-semibold min-w-[140px]">Remarks</th>
                          <th className="py-2.5 px-2 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {formItems.map((item, idx) => {
                          const lineAmt =
                            (Number(item.requiredQty) || 0) *
                            (Number(item.estimatedRate) || 0);

                          return (
                            <tr key={idx} className="hover:bg-muted/20">
                              {/* Item SKU */}
                              <td className="p-2">
                                <select
                                  value={item.itemId}
                                  onChange={(e) =>
                                    handleUpdateItemRow(
                                      idx,
                                      'itemId',
                                      e.target.value,
                                    )
                                  }
                                  className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                                >
                                  {itemsCatalog.map((i) => (
                                    <option key={i.itemId} value={i.itemId}>
                                      {i.itemCode} - {i.itemName}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* UOM */}
                              <td className="p-2">
                                <select
                                  value={item.uomId}
                                  onChange={(e) =>
                                    handleUpdateItemRow(
                                      idx,
                                      'uomId',
                                      e.target.value,
                                    )
                                  }
                                  className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                                >
                                  {uomsCatalog.map((u) => (
                                    <option key={u.uomId} value={u.uomId}>
                                      {u.uomCode}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Required Qty */}
                              <td className="p-2">
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={item.requiredQty}
                                  onChange={(e) =>
                                    handleUpdateItemRow(
                                      idx,
                                      'requiredQty',
                                      e.target.value,
                                    )
                                  }
                                  className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background text-foreground font-mono text-right focus:ring-1 focus:ring-primary focus:outline-none"
                                />
                              </td>

                              {/* Estimated Rate */}
                              <td className="p-2">
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={item.estimatedRate}
                                  onChange={(e) =>
                                    handleUpdateItemRow(
                                      idx,
                                      'estimatedRate',
                                      e.target.value,
                                    )
                                  }
                                  className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background text-foreground font-mono text-right focus:ring-1 focus:ring-primary focus:outline-none"
                                />
                              </td>

                              {/* Estimated Amount */}
                              <td className="p-2 text-right font-mono font-semibold text-foreground">
                                ₹ {lineAmt.toFixed(2)}
                              </td>

                              {/* Suggested Vendor */}
                              <td className="p-2">
                                <select
                                  value={item.suggestedVendorId || ''}
                                  onChange={(e) =>
                                    handleUpdateItemRow(
                                      idx,
                                      'suggestedVendorId',
                                      e.target.value,
                                    )
                                  }
                                  className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                                >
                                  <option value="">-- Optional Vendor --</option>
                                  {suppliers.map((s) => (
                                    <option key={s.partyId} value={s.partyId}>
                                      {s.partyName} ({s.partyCode})
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Remarks */}
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={item.remarks || ''}
                                  placeholder="Spec notes..."
                                  onChange={(e) =>
                                    handleUpdateItemRow(
                                      idx,
                                      'remarks',
                                      e.target.value,
                                    )
                                  }
                                  className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                                />
                              </td>

                              {/* Remove */}
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemRow(idx)}
                                  className="text-muted-foreground hover:text-red-600 p-1 rounded-md"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-muted/40 border-t border-border font-bold">
                        <tr>
                          <td colSpan={4} className="py-2.5 px-3 text-right">
                            Total Estimated Amount:
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono text-primary text-sm">
                            ₹ {calculatedFormTotal.toFixed(2)}
                          </td>
                          <td colSpan={3}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border flex items-center justify-between bg-muted/20">
              <span className="text-xs text-muted-foreground">
                All saved requisitions begin in DRAFT status until explicitly submitted.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-muted-foreground transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save Requisition'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MULTI-LEVEL AUTHORIZATION MODAL (APPROVE / REJECT) */}
      {/* ==================================================================== */}
      {isAuthModalOpen && authorizingPr && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">
                    Authorize Requisition #{authorizingPr.prNo}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Review requested items, adjust approved quantities, or reject with mandatory justification.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsAuthModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5">
              {/* Summary Info */}
              <div className="p-4 rounded-lg bg-muted/40 border border-border grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-muted-foreground block">Requester:</span>
                  <span className="font-semibold text-foreground">
                    {authorizingPr.requesterName}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Department:</span>
                  <span className="font-semibold text-foreground">
                    {authorizingPr.departmentName}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Warehouse:</span>
                  <span className="font-semibold text-foreground">
                    {authorizingPr.warehouseName}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Need By:</span>
                  <span className="font-semibold text-foreground font-mono">
                    {authorizingPr.requiredByDate}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-4 pt-1 border-t border-border/50">
                  <span className="text-muted-foreground block">Purpose:</span>
                  <span className="text-foreground">{authorizingPr.purpose}</span>
                </div>
              </div>

              {/* Action Toggle */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-muted-foreground">
                  Authorization Decision:
                </span>
                <button
                  type="button"
                  onClick={() => setAuthAction('APPROVE')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    authAction === 'APPROVE'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  <Check className="w-4 h-4" /> Approve Requisition
                </button>
                <button
                  type="button"
                  onClick={() => setAuthAction('REJECT')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    authAction === 'REJECT'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  <X className="w-4 h-4" /> Reject Requisition
                </button>
              </div>

              {/* Item Quantities (When Approving) */}
              {authAction === 'APPROVE' && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Approved Quantities by Line Item
                  </h4>
                  {isAuthDetailLoading ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      Loading line items...
                    </div>
                  ) : (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted text-muted-foreground border-b border-border">
                          <tr>
                            <th className="py-2 px-3 font-semibold">SKU / Item</th>
                            <th className="py-2 px-2 font-semibold">UOM</th>
                            <th className="py-2 px-2 font-semibold text-right">Requested</th>
                            <th className="py-2 px-3 font-semibold text-right min-w-[120px]">
                              Approved Qty *
                            </th>
                            <th className="py-2 px-3 font-semibold text-right">Est. Rate</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-mono">
                          {authItems.map((it, idx) => (
                            <tr key={it.prItemId} className="hover:bg-muted/20">
                              <td className="py-2 px-3">
                                <span className="font-bold text-foreground block">
                                  {it.itemCode}
                                </span>
                                <span className="font-sans text-muted-foreground text-[11px]">
                                  {it.itemName}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-muted-foreground font-sans">
                                {it.uomCode}
                              </td>
                              <td className="py-2 px-2 text-right text-muted-foreground">
                                {it.requiredQty}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={it.approvedQty}
                                  onChange={(e) => {
                                    const updated = [...authItems];
                                    updated[idx].approvedQty = Math.max(
                                      0,
                                      Number(e.target.value),
                                    );
                                    setAuthItems(updated);
                                  }}
                                  className="w-24 text-xs px-2 py-1 rounded-md border border-border bg-background text-foreground text-right font-mono font-bold focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                                />
                              </td>
                              <td className="py-2 px-3 text-right text-muted-foreground">
                                ₹ {Number(it.estimatedRate).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  {authAction === 'REJECT'
                    ? 'Rejection Justification (Mandatory) *'
                    : 'Approval Remarks (Optional)'}
                </label>
                <textarea
                  rows={3}
                  value={authRemarks}
                  onChange={(e) => setAuthRemarks(e.target.value)}
                  placeholder={
                    authAction === 'REJECT'
                      ? 'State reasons for rejection (budget constraint, duplicate indent, alternative available)...'
                      : 'Add notes for procurement team...'
                  }
                  className="w-full text-xs p-3 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border flex items-center justify-end gap-2 bg-muted/20">
              <button
                type="button"
                onClick={() => setIsAuthModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-muted-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => authorizeMutation.mutate()}
                disabled={authorizeMutation.isPending}
                className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-lg font-semibold text-xs text-white transition-colors shadow-sm disabled:opacity-50 ${
                  authAction === 'APPROVE'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {authorizeMutation.isPending
                  ? 'Processing...'
                  : authAction === 'APPROVE'
                    ? 'Confirm Approval'
                    : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PRINTABLE REQUISITION VOUCHER MODAL */}
      {/* ==================================================================== */}
      {isPrintModalOpen && printTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header toolbar */}
            <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-muted/30 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-primary" />
                <span className="font-bold text-sm text-foreground">
                  Print Material Requisition Voucher
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Document
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Voucher Sheet */}
            <div className="p-8 overflow-y-auto space-y-6 print:p-0 print:m-0">
              {/* Plant Header */}
              <div className="border-b-2 border-primary pb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">
                    Kashvira Manufacturing ERP
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Plant Operations • Material Purchase Requisition Voucher
                  </p>
                  <h2 className="text-base font-semibold text-primary mt-2">
                    PR VOUCHER: {printTarget.prNo}
                  </h2>
                </div>
                <div className="text-right text-xs space-y-1">
                  <div>
                    <span className="font-semibold text-muted-foreground">Date Raised: </span>
                    <span className="font-bold font-mono text-foreground">{printTarget.prDate}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Required By: </span>
                    <span className="font-bold font-mono text-foreground">{printTarget.requiredByDate}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Status: </span>
                    <span className="font-bold text-emerald-600">{printTarget.status}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Priority: </span>
                    <span className="font-bold text-foreground">{printTarget.priority}</span>
                  </div>
                </div>
              </div>

              {/* Department & Purpose Info */}
              <div className="grid grid-cols-2 gap-4 text-xs p-3 bg-muted/20 border border-border rounded-lg">
                <div>
                  <span className="font-semibold text-muted-foreground">Department: </span>
                  <span className="font-bold text-foreground">{printTarget.departmentName}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Warehouse / Store: </span>
                  <span className="font-bold text-foreground">{printTarget.warehouseName}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Requester: </span>
                  <span className="font-bold text-foreground">{printTarget.requesterName}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground">Requisition Type: </span>
                  <span className="font-bold text-foreground">{PR_TYPE_LABELS[printTarget.prType]}</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-border/50">
                  <span className="font-semibold text-muted-foreground">Operational Purpose: </span>
                  <span className="text-foreground">{printTarget.purpose}</span>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  Indent Line Items
                </h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted text-muted-foreground border-b border-border">
                        <th className="py-2 px-3 font-semibold">SKU Code</th>
                        <th className="py-2 px-3 font-semibold">Item Description</th>
                        <th className="py-2 px-2 font-semibold">UOM</th>
                        <th className="py-2 px-2 font-semibold text-right">Req. Qty</th>
                        <th className="py-2 px-2 font-semibold text-right">Appr. Qty</th>
                        <th className="py-2 px-3 font-semibold text-right">Est. Rate (₹)</th>
                        <th className="py-2 px-3 font-semibold text-right">Est. Amount (₹)</th>
                        <th className="py-2 px-3 font-semibold">Suggested Vendor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono">
                      {isPrintDetailLoading ? (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-muted-foreground">
                            Loading voucher items...
                          </td>
                        </tr>
                      ) : !printDetailData?.items || printDetailData.items.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-6 text-center text-muted-foreground">
                            No items registered.
                          </td>
                        </tr>
                      ) : (
                        printDetailData.items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-muted/10">
                            <td className="py-2 px-3 font-bold text-primary">{it.itemCode}</td>
                            <td className="py-2 px-3 font-sans text-foreground">{it.itemName}</td>
                            <td className="py-2 px-2 text-muted-foreground">{it.uomCode}</td>
                            <td className="py-2 px-2 text-right">{Number(it.requiredQty).toFixed(3)}</td>
                            <td className="py-2 px-2 text-right font-bold text-emerald-600">
                              {Number(it.approvedQty).toFixed(3)}
                            </td>
                            <td className="py-2 px-3 text-right">{Number(it.estimatedRate).toFixed(2)}</td>
                            <td className="py-2 px-3 text-right font-bold text-foreground">
                              {Number(it.estimatedAmount).toFixed(2)}
                            </td>
                            <td className="py-2 px-3 font-sans text-muted-foreground">
                              {it.suggestedVendorName || '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-muted/40 border-t border-border font-bold">
                      <tr>
                        <td colSpan={6} className="py-2 px-3 text-right">
                          Total Indent Value:
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-primary">
                          ₹{' '}
                          {Number(printTarget.totalEstimatedAmount).toLocaleString(
                            'en-IN',
                            { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                          )}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Signature Blocks */}
              <div className="grid grid-cols-3 gap-6 pt-10 text-center text-xs">
                <div className="border-t border-border pt-2">
                  <p className="font-semibold text-foreground">
                    {printTarget.requesterName}
                  </p>
                  <p className="text-muted-foreground">Requested By (Indenter)</p>
                </div>
                <div className="border-t border-border pt-2">
                  <p className="font-semibold text-foreground">
                    Store In-charge
                  </p>
                  <p className="text-muted-foreground">Verified & Stock Checked</p>
                </div>
                <div className="border-t border-border pt-2">
                  <p className="font-semibold text-foreground">
                    {printTarget.approvedByName || 'Pending Authorization'}
                  </p>
                  <p className="text-muted-foreground">Plant Head / Approver</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* DELETE CONFIRMATION MODAL */}
      {/* ==================================================================== */}
      <ConfirmDeleteModal
        isOpen={!!deleteTarget}
        entityType="Material Purchase Requisition"
        entityName={deleteTarget?.purpose || 'Requisition'}
        entityCode={deleteTarget?.prNo}
        isDeleting={deleteMutation.isPending}
        errorMessage={deleteErrorMessage}
        dependencies={deleteConflicts}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.prId);
          }
        }}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteErrorMessage(null);
          setDeleteConflicts([]);
        }}
      />
    </div>
  );
};
