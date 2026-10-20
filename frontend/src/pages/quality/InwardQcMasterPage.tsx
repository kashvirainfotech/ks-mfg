import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSearch,
  FileSpreadsheet,
  FileText,
  Filter,
  FlaskConical,
  Layers,
  Package,
  Plus,
  Printer,
  Scale,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Tag,
  Trash2,
  Truck,
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

export type QcOverallResult =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ACCEPTED_UNDER_DEVIATION';

export type QcInspectionStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type QcInspectionType =
  | 'INCOMING_RAW_MATERIAL'
  | 'SUBCONTRACT_JOBWORK'
  | 'CONSUMABLE_CHEMICAL'
  | 'BOUGHT_OUT_COMPONENT';

export type QcCheckResult = 'PASS' | 'FAIL' | 'NA';

export interface QcItemRecord {
  qcItemId?: number;
  qcId?: number;
  grnItemId: number;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  itemDescription?: string;
  uomId: number;
  uomCode?: string;
  uomName?: string;
  receivedQty: number;
  sampleQty: number;
  acceptedQty: number;
  rejectedQty: number;
  disposition: string;
  defectCode?: string | null;
  batchNo?: string | null;
  heatNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  quarantineBinId?: number | null;
  quarantineBinCode?: string | null;
  quarantineBinName?: string | null;
  destinationBinId?: number | null;
  destinationBinCode?: string | null;
  destinationBinName?: string | null;
  visualCheck?: QcCheckResult;
  dimensionCheck?: QcCheckResult;
  chemicalTest?: QcCheckResult;
  hardnessTest?: QcCheckResult;
  observedParameters?: Record<string, any> | null;
  remarks?: string | null;
  isActive?: boolean;
}

export interface QcHeaderRecord {
  qcId: number;
  qcNo: string;
  qcDate: string;
  grnId: number;
  grnNo: string;
  grnDate?: string;
  challanNo?: string;
  challanDate?: string;
  vehicleNo?: string;
  warehouseId: number;
  warehouseCode?: string;
  warehouseName: string;
  vendorId: number;
  vendorCode?: string;
  vendorName: string;
  vendorGstin?: string | null;
  vendorAddress?: string | null;
  poId?: number | null;
  poNo?: string | null;
  gateInwardId?: number | null;
  gateInwardNo?: string | null;
  sampleSize: number;
  inspectionType: string;
  overallResult: QcOverallResult;
  inspectorId?: number | null;
  inspectorName?: string | null;
  inspectionDate?: string | null;
  approverId?: number | null;
  approverName?: string | null;
  approvalDate?: string | null;
  remarks?: string | null;
  deviationReason?: string | null;
  testCertNo?: string | null;
  testCertDate?: string | null;
  status: QcInspectionStatus;
  isActive: boolean;
  createdDate: string;
  itemCount: number;
  totalReceivedQty: number;
  totalAcceptedQty: number;
  totalRejectedQty: number;
  items?: QcItemRecord[];
}

export interface QcSummary {
  totalInspections: number;
  pendingCount: number;
  acceptedCount: number;
  rejectedDeviatedCount: number;
}

export interface WarehouseOption {
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
}

export interface SupplierOption {
  partyId: number;
  partyCode: string;
  partyName: string;
}

export interface StorageBinOption {
  binId: number;
  warehouseId: number;
  warehouseName?: string;
  binCode: string;
  binName: string;
  binType: string;
  isReceivingStaging?: boolean;
}

export interface PendingGrnOption {
  grnId: number;
  grnNo: string;
  grnDate: string;
  warehouseId: number;
  warehouseName: string;
  vendorId: number;
  vendorName: string;
  poId?: number | null;
  poNo?: string | null;
  gateInwardId?: number | null;
  challanNo: string;
  challanDate: string;
  vehicleNo?: string | null;
  status: string;
}

export interface GrnItemOption {
  grnItemId: number;
  grnId: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  itemDescription?: string;
  uomId: number;
  uomCode: string;
  receivedQty: number;
  quarantineQty: number;
  batchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  quarantineBinId?: number | null;
  storageBinId?: number | null;
}

// ============================================================================
// STYLING & STATUS CONFIG
// ============================================================================

const STATUS_CONFIG: Record<
  QcInspectionStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  DRAFT: {
    label: 'Draft Report',
    bg: 'bg-slate-500/10 dark:bg-slate-400/10',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
  IN_PROGRESS: {
    label: 'Testing In Progress',
    bg: 'bg-amber-500/10 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-300 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  COMPLETED: {
    label: 'Inspection Completed',
    bg: 'bg-emerald-500/10 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-300 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  CANCELLED: {
    label: 'Voided / Cancelled',
    bg: 'bg-rose-500/10 dark:bg-rose-950/30',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-300 dark:border-rose-800',
    dot: 'bg-rose-500',
  },
};

const RESULT_CONFIG: Record<
  QcOverallResult,
  { label: string; bg: string; text: string; border: string }
> = {
  PENDING: {
    label: 'QC Hold',
    bg: 'bg-amber-500/10 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-300 dark:border-amber-800',
  },
  ACCEPTED: {
    label: 'Accepted / Cleared',
    bg: 'bg-emerald-500/10 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-300 dark:border-emerald-800',
  },
  REJECTED: {
    label: 'Rejected',
    bg: 'bg-rose-500/10 dark:bg-rose-950/30',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-300 dark:border-rose-800',
  },
  ACCEPTED_UNDER_DEVIATION: {
    label: 'Deviation Concession',
    bg: 'bg-purple-500/10 dark:bg-purple-950/30',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-300 dark:border-purple-800',
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const InwardQcMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [resultFilter, setResultFilter] = useState<string>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Modals & Panels State
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingQc, setEditingQc] = useState<QcHeaderRecord | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [selectedQc, setSelectedQc] = useState<QcHeaderRecord | null>(null);

  const [isApproveModalOpen, setIsApproveModalOpen] = useState<boolean>(false);
  const [approveTarget, setApproveTarget] = useState<QcHeaderRecord | null>(null);
  const [approvalRemarks, setApprovalRemarks] = useState<string>('');
  const [approvalResult, setApprovalResult] = useState<QcOverallResult>('ACCEPTED');
  const [itemApprovalAllocations, setItemApprovalAllocations] = useState<
    Record<number, { acceptedQty: number; rejectedQty: number; destinationBinId?: number; disposition: string }>
  >({});

  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [rejectTarget, setRejectTarget] = useState<QcHeaderRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [defectCode, setDefectCode] = useState<string>('QC_NON_CONFORMING');

  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelTarget, setCancelTarget] = useState<QcHeaderRecord | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printTarget, setPrintTarget] = useState<QcHeaderRecord | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<QcHeaderRecord | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [deleteConflicts, setDeleteConflicts] = useState<DependencyConflictItem[]>([]);

  // Form State for Editor
  const [formQcNo, setFormQcNo] = useState<string>('');
  const [formQcDate, setFormQcDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [formGrnId, setFormGrnId] = useState<number | ''>('');
  const [formWarehouseId, setFormWarehouseId] = useState<number | ''>('');
  const [formVendorId, setFormVendorId] = useState<number | ''>('');
  const [formPoId, setFormPoId] = useState<number | ''>('');
  const [formGateInwardId, setFormGateInwardId] = useState<number | ''>('');
  const [formSampleSize, setFormSampleSize] = useState<number>(1.0);
  const [formInspectionType, setFormInspectionType] = useState<QcInspectionType>(
    'INCOMING_RAW_MATERIAL',
  );
  const [formOverallResult, setFormOverallResult] = useState<QcOverallResult>('PENDING');
  const [formRemarks, setFormRemarks] = useState<string>('');
  const [formDeviationReason, setFormDeviationReason] = useState<string>('');
  const [formTestCertNo, setFormTestCertNo] = useState<string>('');
  const [formTestCertDate, setFormTestCertDate] = useState<string>('');
  const [formItems, setFormItems] = useState<QcItemRecord[]>([]);

  // --------------------------------------------------------------------------
  // API Queries
  // --------------------------------------------------------------------------

  // 1. KPI Summary
  const { data: summary, isLoading: isSummaryLoading } = useQuery<QcSummary>({
    queryKey: ['quality', 'inward-qc', 'summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<QcSummary>>(
        '/quality/inward-qc/summary',
      );
      return res.data.data;
    },
    staleTime: 30_000,
  });

  // 2. Listing
  const { data: qcReports = [], isLoading: isListLoading } = useQuery<
    QcHeaderRecord[]
  >({
    queryKey: [
      'quality',
      'inward-qc',
      'list',
      statusFilter,
      resultFilter,
      warehouseFilter,
      vendorFilter,
      globalSearch,
    ],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (resultFilter !== 'ALL') params.overallResult = resultFilter;
      if (warehouseFilter !== 'ALL') params.warehouseId = warehouseFilter;
      if (vendorFilter !== 'ALL') params.vendorId = vendorFilter;
      if (globalSearch.trim()) params.search = globalSearch.trim();

      const res = await apiClient.get<ApiResponse<QcHeaderRecord[]>>(
        '/quality/inward-qc',
        { params },
      );
      return res.data.data;
    },
  });

  // 3. Dropdowns
  const { data: warehouses = [] } = useQuery<WarehouseOption[]>({
    queryKey: ['inventory', 'warehouses', 'options'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/inventory/warehouses');
      return (res.data.data || []).map((w: any) => ({
        warehouseId: w.warehouseId,
        warehouseCode: w.warehouseCode,
        warehouseName: w.warehouseName,
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

  const { data: pendingGrns = [] } = useQuery<PendingGrnOption[]>({
    queryKey: ['quality', 'inward-qc', 'pending-grns'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PendingGrnOption[]>>(
        '/quality/inward-qc/pending-grns',
      );
      return res.data.data;
    },
  });

  const { data: storageBins = [] } = useQuery<StorageBinOption[]>({
    queryKey: ['quality', 'inward-qc', 'storage-bins', formWarehouseId],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<StorageBinOption[]>>(
        '/quality/inward-qc/storage-bins',
        { params: formWarehouseId ? { warehouseId: formWarehouseId } : {} },
      );
      return res.data.data;
    },
  });

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  const createQcMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post<ApiResponse<QcHeaderRecord>>(
        '/quality/inward-qc',
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'inward-qc'] });
      setIsEditorOpen(false);
      resetEditorForm();
    },
  });

  const updateQcMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.put<ApiResponse<QcHeaderRecord>>(
        `/quality/inward-qc/${id}`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'inward-qc'] });
      setIsEditorOpen(false);
      resetEditorForm();
    },
  });

  const submitQcMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.post<ApiResponse<QcHeaderRecord>>(
        `/quality/inward-qc/${id}/submit`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'inward-qc'] });
    },
  });

  const approveQcMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.post<ApiResponse<QcHeaderRecord>>(
        `/quality/inward-qc/${id}/approve`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'inward-qc'] });
      setIsApproveModalOpen(false);
      setApproveTarget(null);
    },
  });

  const rejectQcMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.post<ApiResponse<QcHeaderRecord>>(
        `/quality/inward-qc/${id}/reject`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'inward-qc'] });
      setIsRejectModalOpen(false);
      setRejectTarget(null);
    },
  });

  const cancelQcMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await apiClient.post<ApiResponse<QcHeaderRecord>>(
        `/quality/inward-qc/${id}/cancel`,
        { cancelReason: reason },
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'inward-qc'] });
      setIsCancelModalOpen(false);
      setCancelTarget(null);
    },
  });

  const deleteQcMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete<ApiResponse<any>>(
        `/quality/inward-qc/${id}`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quality', 'inward-qc'] });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      setDeleteErrorMessage(
        err.response?.data?.message || 'Failed to delete QC inspection record.',
      );
      if (err.response?.data?.dependencies) {
        setDeleteConflicts(err.response.data.dependencies);
      }
    },
  });

  // --------------------------------------------------------------------------
  // Form Helpers
  // --------------------------------------------------------------------------

  const resetEditorForm = () => {
    setEditingQc(null);
    setFormQcNo('');
    setFormQcDate(new Date().toISOString().split('T')[0]);
    setFormGrnId('');
    setFormWarehouseId('');
    setFormVendorId('');
    setFormPoId('');
    setFormGateInwardId('');
    setFormSampleSize(1.0);
    setFormInspectionType('INCOMING_RAW_MATERIAL');
    setFormOverallResult('PENDING');
    setFormRemarks('');
    setFormDeviationReason('');
    setFormTestCertNo('');
    setFormTestCertDate('');
    setFormItems([]);
  };

  const openCreateModal = () => {
    resetEditorForm();
    if (warehouses.length > 0) setFormWarehouseId(warehouses[0].warehouseId);
    setIsEditorOpen(true);
  };

  const openEditModal = async (qc: QcHeaderRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<QcHeaderRecord>>(
        `/quality/inward-qc/${qc.qcId}`,
      );
      const full = res.data.data;
      setEditingQc(full);
      setFormQcNo(full.qcNo);
      setFormQcDate(full.qcDate);
      setFormGrnId(full.grnId);
      setFormWarehouseId(full.warehouseId);
      setFormVendorId(full.vendorId);
      setFormPoId(full.poId || '');
      setFormGateInwardId(full.gateInwardId || '');
      setFormSampleSize(full.sampleSize);
      setFormInspectionType(full.inspectionType as QcInspectionType);
      setFormOverallResult(full.overallResult);
      setFormRemarks(full.remarks || '');
      setFormDeviationReason(full.deviationReason || '');
      setFormTestCertNo(full.testCertNo || '');
      setFormTestCertDate(full.testCertDate || '');
      setFormItems(full.items || []);
      setIsEditorOpen(true);
    } catch {
      // fallback
    }
  };

  const openDetailDrawer = async (qc: QcHeaderRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<QcHeaderRecord>>(
        `/quality/inward-qc/${qc.qcId}`,
      );
      setSelectedQc(res.data.data);
      setIsDetailOpen(true);
    } catch {
      setSelectedQc(qc);
      setIsDetailOpen(true);
    }
  };

  const openPrintModal = async (qc: QcHeaderRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<QcHeaderRecord>>(
        `/quality/inward-qc/${qc.qcId}`,
      );
      setPrintTarget(res.data.data);
      setIsPrintModalOpen(true);
    } catch {
      setPrintTarget(qc);
      setIsPrintModalOpen(true);
    }
  };

  const handleSelectPendingGrn = async (grnId: number) => {
    setFormGrnId(grnId);
    const grn = pendingGrns.find((g) => g.grnId === grnId);
    if (!grn) return;

    setFormWarehouseId(grn.warehouseId);
    setFormVendorId(grn.vendorId);
    if (grn.poId) setFormPoId(grn.poId);
    if (grn.gateInwardId) setFormGateInwardId(grn.gateInwardId);

    try {
      const res = await apiClient.get<ApiResponse<GrnItemOption[]>>(
        `/quality/inward-qc/grn-items/${grnId}`,
      );
      const items = res.data.data || [];
      const mapped: QcItemRecord[] = items.map((it) => ({
        grnItemId: it.grnItemId,
        itemId: it.itemId,
        itemCode: it.itemCode,
        itemName: it.itemName,
        itemDescription: it.itemDescription,
        uomId: it.uomId,
        uomCode: it.uomCode,
        receivedQty: it.receivedQty,
        sampleQty: Math.min(5, it.receivedQty),
        acceptedQty: it.receivedQty,
        rejectedQty: 0,
        disposition: 'ACCEPTED',
        batchNo: it.batchNo || '',
        heatNo: '',
        mfgDate: it.mfgDate || '',
        expiryDate: it.expiryDate || '',
        quarantineBinId: it.quarantineBinId,
        destinationBinId: it.storageBinId,
        visualCheck: 'PASS',
        dimensionCheck: 'PASS',
        chemicalTest: 'PASS',
        hardnessTest: 'PASS',
        observedParameters: {},
      }));
      setFormItems(mapped);
    } catch {
      // ignore
    }
  };

  const handleUpdateItemRow = (index: number, patch: Partial<QcItemRecord>) => {
    setFormItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
  };

  const handleSaveQc = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formGrnId) {
      alert('Please select a Goods Receipt Note (GRN) to inspect.');
      return;
    }
    if (formItems.length === 0) {
      alert('Inspection report must contain at least one line item.');
      return;
    }

    const payload = {
      qcNo: formQcNo.trim() || undefined,
      qcDate: formQcDate,
      grnId: Number(formGrnId),
      warehouseId: Number(formWarehouseId),
      vendorId: Number(formVendorId),
      poId: formPoId ? Number(formPoId) : undefined,
      gateInwardId: formGateInwardId ? Number(formGateInwardId) : undefined,
      sampleSize: Number(formSampleSize || 1.0),
      inspectionType: formInspectionType,
      overallResult: formOverallResult,
      remarks: formRemarks.trim() || undefined,
      deviationReason: formDeviationReason.trim() || undefined,
      testCertNo: formTestCertNo.trim() || undefined,
      testCertDate: formTestCertDate || undefined,
      items: formItems.map((it) => ({
        grnItemId: it.grnItemId,
        itemId: it.itemId,
        uomId: it.uomId,
        receivedQty: Number(it.receivedQty || 0),
        sampleQty: Number(it.sampleQty || 1.0),
        acceptedQty: Number(it.acceptedQty || 0),
        rejectedQty: Number(it.rejectedQty || 0),
        disposition: it.disposition,
        defectCode: it.defectCode || undefined,
        batchNo: it.batchNo || undefined,
        heatNo: it.heatNo || undefined,
        mfgDate: it.mfgDate || undefined,
        expiryDate: it.expiryDate || undefined,
        quarantineBinId: it.quarantineBinId || undefined,
        destinationBinId: it.destinationBinId || undefined,
        visualCheck: it.visualCheck,
        dimensionCheck: it.dimensionCheck,
        chemicalTest: it.chemicalTest,
        hardnessTest: it.hardnessTest,
        observedParameters: it.observedParameters || undefined,
        remarks: it.remarks || undefined,
      })),
    };

    if (editingQc) {
      updateQcMutation.mutate({ id: editingQc.qcId, payload });
    } else {
      createQcMutation.mutate(payload);
    }
  };

  // --------------------------------------------------------------------------
  // Table Columns Definition
  // --------------------------------------------------------------------------

  const columns: MasterTableColumn<QcHeaderRecord>[] = [
    {
      key: 'qcNo',
      header: 'QC Inspection # & Date',
      render: (row) => (
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => openDetailDrawer(row)}
            className="font-mono font-semibold text-primary hover:underline flex items-center gap-1.5 text-left"
          >
            <FlaskConical className="w-4 h-4 text-primary shrink-0" />
            <span>{row.qcNo}</span>
          </button>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Calendar className="w-3 h-3" />
            <span>{row.qcDate}</span>
            <span className="mx-1">•</span>
            <Warehouse className="w-3 h-3" />
            <span>{row.warehouseName}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'grnNo',
      header: 'Receipt & PO Reference',
      render: (row) => (
        <div className="flex flex-col gap-1 text-xs">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-[11px] font-semibold border border-primary/20">
            <FileCheck2 className="w-3 h-3" />
            {row.grnNo}
          </span>
          {row.poNo && (
            <span className="text-[11px] font-mono text-muted-foreground">
              PO: {row.poNo}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'vendorName',
      header: 'Supplier / Vendor',
      render: (row) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium text-foreground line-clamp-1">
            {row.vendorName}
          </span>
          <span className="text-muted-foreground font-mono text-[11px]">
            {row.vendorCode}
          </span>
        </div>
      ),
    },
    {
      key: 'inspectionType',
      header: 'Test Scope & Sample',
      render: (row) => (
        <div className="flex flex-col text-xs">
          <span className="font-semibold text-foreground">
            {row.inspectionType.replace(/_/g, ' ')}
          </span>
          <span className="text-muted-foreground text-[11px]">
            Sample Size: {row.sampleSize}
          </span>
          {row.testCertNo && (
            <span className="text-[10px] text-primary font-mono">
              Cert: {row.testCertNo}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'itemQuantities',
      header: 'Accepted vs Rejected',
      render: (row) => (
        <div className="flex flex-col text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
              ✔ {row.totalAcceptedQty?.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-rose-600 dark:text-rose-400 font-bold">
              ✖ {row.totalRejectedQty?.toLocaleString('en-IN', { maximumFractionDigits: 3 })}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Of {row.totalReceivedQty?.toLocaleString('en-IN', { maximumFractionDigits: 3 })} Total
          </span>
        </div>
      ),
    },
    {
      key: 'overallResult',
      header: 'QC Disposition',
      render: (row) => {
        const conf = RESULT_CONFIG[row.overallResult] || RESULT_CONFIG.PENDING;
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${conf.bg} ${conf.text} ${conf.border}`}
          >
            {conf.label}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const conf = STATUS_CONFIG[row.status] || STATUS_CONFIG.DRAFT;
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${conf.bg} ${conf.text} ${conf.border}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
            {conf.label}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          {/* Quick Details */}
          <button
            type="button"
            title="View Inspection Report"
            onClick={() => openDetailDrawer(row)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Print Certificate */}
          <button
            type="button"
            title="Print Inspection Certificate"
            onClick={() => openPrintModal(row)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Edit (Draft or In-Progress) */}
          {['DRAFT', 'IN_PROGRESS'].includes(row.status) && (
            <PermissionGate screen="INWARD_QC" action="EDIT">
              <button
                type="button"
                title="Edit Inspection Data"
                onClick={() => openEditModal(row)}
                className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {/* Submit for Review (Draft only) */}
          {row.status === 'DRAFT' && (
            <PermissionGate screen="INWARD_QC" action="SUBMIT">
              <button
                type="button"
                title="Submit for QA Review"
                onClick={() => submitQcMutation.mutate(row.qcId)}
                className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-md transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {/* Approve & Release Stock */}
          {['DRAFT', 'IN_PROGRESS'].includes(row.status) && (
            <PermissionGate screen="INWARD_QC" action="APPROVE">
              <button
                type="button"
                title="Approve & Release Quarantine Stock"
                onClick={async () => {
                  const res = await apiClient.get<ApiResponse<QcHeaderRecord>>(
                    `/quality/inward-qc/${row.qcId}`,
                  );
                  const full = res.data.data;
                  setApproveTarget(full);
                  setApprovalRemarks('');
                  setApprovalResult('ACCEPTED');
                  const initAllocations: Record<number, any> = {};
                  full.items?.forEach((it) => {
                    initAllocations[it.qcItemId!] = {
                      acceptedQty: it.acceptedQty > 0 ? it.acceptedQty : it.receivedQty,
                      rejectedQty: it.rejectedQty || 0,
                      destinationBinId: it.destinationBinId || undefined,
                      disposition: it.disposition || 'ACCEPTED',
                    };
                  });
                  setItemApprovalAllocations(initAllocations);
                  setIsApproveModalOpen(true);
                }}
                className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-md transition-colors"
              >
                <ShieldCheck className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {/* Reject Consignment */}
          {['DRAFT', 'IN_PROGRESS'].includes(row.status) && (
            <PermissionGate screen="INWARD_QC" action="REJECT">
              <button
                type="button"
                title="Reject Consignment"
                onClick={() => {
                  setRejectTarget(row);
                  setRejectionReason('');
                  setDefectCode('QC_NON_CONFORMING');
                  setIsRejectModalOpen(true);
                }}
                className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-colors"
              >
                <ShieldAlert className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {/* Cancel */}
          {row.status !== 'CANCELLED' && (
            <PermissionGate screen="INWARD_QC" action="CANCEL">
              <button
                type="button"
                title="Void / Cancel Inspection"
                onClick={() => {
                  setCancelTarget(row);
                  setCancelReason('');
                  setIsCancelModalOpen(true);
                }}
                className="p-1.5 text-muted-foreground hover:text-rose-600 rounded-md transition-colors"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {/* Delete (DRAFT only) */}
          {row.status === 'DRAFT' && (
            <PermissionGate screen="INWARD_QC" action="DELETE">
              <button
                type="button"
                title="Delete Draft QC"
                onClick={() => {
                  setDeleteTarget(row);
                  setDeleteErrorMessage(null);
                  setDeleteConflicts([]);
                }}
                className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}
        </div>
      ),
    },
  ];

  const groupByOptions: GroupByOption<QcHeaderRecord>[] = [
    { label: 'Overall Result', key: 'overallResult', groupValue: (r) => r.overallResult },
    { label: 'Status', key: 'status', groupValue: (r) => r.status },
    { label: 'Plant Warehouse', key: 'warehouseName', groupValue: (r) => r.warehouseName },
    { label: 'Supplier / Vendor', key: 'vendorName', groupValue: (r) => r.vendorName },
  ];

  const searchPredicate = (row: QcHeaderRecord, query: string): boolean => {
    const q = query.toLowerCase();
    return Boolean(
      row.qcNo.toLowerCase().includes(q) ||
      row.grnNo.toLowerCase().includes(q) ||
      row.vendorName.toLowerCase().includes(q) ||
      (row.vendorCode && row.vendorCode.toLowerCase().includes(q)) ||
      (row.poNo && row.poNo.toLowerCase().includes(q)) ||
      (row.testCertNo && row.testCertNo.toLowerCase().includes(q)) ||
      (row.remarks && row.remarks.toLowerCase().includes(q))
    );
  };

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6 max-w-full">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Inward Material QC Inspection &amp; Quarantine Clearance
                </h1>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Incoming raw material metallurgy testing, dimensional CMM verification, supplier heat allocation, and quarantine release.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <PermissionGate screen="INWARD_QC" action="ADD">
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm shadow hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Log QC Inspection</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Inspections */}
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total QC Reports
            </span>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {isSummaryLoading ? '...' : summary?.totalInspections || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              All incoming inspection lots
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <FlaskConical className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Quarantine Hold */}
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Pending Testing Hold
            </span>
            <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {isSummaryLoading ? '...' : summary?.pendingCount || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              Inward quarantine staging cages
            </div>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Accepted & Stock Released */}
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Accepted &amp; Stock Released
            </span>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {isSummaryLoading ? '...' : summary?.acceptedCount || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              Put away to prime storage bins
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Rejected / Deviated */}
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-rose-600 dark:text-rose-400 uppercase tracking-wider">
              Rejected / Deviated Lots
            </span>
            <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {isSummaryLoading ? '...' : summary?.rejectedDeviatedCount || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              Non-conforming or concession
            </div>
          </div>
          <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Filter Toolbar */}
      <div className="p-4 rounded-xl border bg-card shadow-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded-md border border-input bg-background px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft Report</option>
              <option value="IN_PROGRESS">Testing In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Voided / Cancelled</option>
            </select>
          </div>

          {/* Overall Result Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Disposition:</span>
            <select
              value={resultFilter}
              onChange={(e) => setResultFilter(e.target.value)}
              className="text-xs rounded-md border border-input bg-background px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Dispositions</option>
              <option value="PENDING">QC Hold</option>
              <option value="ACCEPTED">Accepted / Cleared</option>
              <option value="REJECTED">Rejected</option>
              <option value="ACCEPTED_UNDER_DEVIATION">Concession / Deviation</option>
            </select>
          </div>

          {/* Warehouse Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Plant:</span>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="text-xs rounded-md border border-input bg-background px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Plants</option>
              {warehouses.map((w) => (
                <option key={w.warehouseId} value={String(w.warehouseId)}>
                  {w.warehouseName}
                </option>
              ))}
            </select>
          </div>

          {/* Vendor Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Supplier:</span>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="text-xs rounded-md border border-input bg-background px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary max-w-xs truncate"
            >
              <option value="ALL">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.partyId} value={String(s.partyId)}>
                  {s.partyName}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          {(statusFilter !== 'ALL' ||
            resultFilter !== 'ALL' ||
            warehouseFilter !== 'ALL' ||
            vendorFilter !== 'ALL' ||
            globalSearch) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setResultFilter('ALL');
                setWarehouseFilter('ALL');
                setVendorFilter('ALL');
                setGlobalSearch('');
              }}
              className="text-xs text-primary hover:underline ml-auto flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 4. MasterDataTable */}
      <MasterDataTable<QcHeaderRecord>
        title="Inward Material QC Inspections"
        subtitle="Laboratory spectroscopy, physical & dimensional incoming quality verification, heat/batch allocation, and quarantine clearance"
        screenCode="INWARD_QC"
        tableNameBadge="tbl_pur_inward_qc_header"
        data={qcReports}
        columns={columns}
        isLoading={isListLoading}
        rowKey={(row) => row.qcId}
        searchPredicate={searchPredicate}
        groupByOptions={groupByOptions}
        addButtonLabel="Log QC Inspection"
        onAddClick={openCreateModal}
        onExportClick={() => {
          const headers = [
            'QC No',
            'QC Date',
            'GRN No',
            'Vendor',
            'Scope',
            'Sample Size',
            'Overall Result',
            'Status',
          ];
          const rows = qcReports.map((q) => [
            q.qcNo,
            q.qcDate,
            q.grnNo,
            `"${q.vendorName}"`,
            q.inspectionType,
            q.sampleSize,
            q.overallResult,
            q.status,
          ]);
          const csvContent =
            'data:text/csv;charset=utf-8,' +
            [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement('a');
          link.setAttribute('href', encodedUri);
          link.setAttribute(
            'download',
            `Inward_QC_Register_${new Date().toISOString().split('T')[0]}.csv`,
          );
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }}
      />

      {/* ==================================================================== */}
      {/* 5. CREATE / EDIT QC INSPECTION MODAL                                 */}
      {/* ==================================================================== */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in-50">
            {/* Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">
                  {editingQc ? `Edit QC Report: ${editingQc.qcNo}` : 'Log Inward Material QC Inspection'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveQc} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Sourcing Accelerator */}
              {!editingQc && (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                    <FileCheck2 className="w-4 h-4" />
                    <span>Select Inward GRN from Quarantine Staging Hold:</span>
                  </div>
                  <select
                    value={formGrnId}
                    onChange={(e) =>
                      e.target.value
                        ? handleSelectPendingGrn(Number(e.target.value))
                        : setFormGrnId('')
                    }
                    className="w-full text-xs rounded-md border border-input bg-background p-2 font-mono"
                  >
                    <option value="">-- Choose Quarantine GRN Consignment --</option>
                    {pendingGrns.map((g) => (
                      <option key={g.grnId} value={g.grnId}>
                        {g.grnNo} • {g.vendorName} ({g.warehouseName}) [Ch: {g.challanNo}]
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Inspection Number <span className="text-muted-foreground text-[10px]">(Auto if blank)</span>
                  </label>
                  <input
                    type="text"
                    value={formQcNo}
                    onChange={(e) => setFormQcNo(e.target.value)}
                    placeholder="e.g. QC-AHM-2627-0001"
                    className="w-full text-xs rounded-md border border-input bg-background p-2 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Inspection Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formQcDate}
                    onChange={(e) => setFormQcDate(e.target.value)}
                    className="w-full text-xs rounded-md border border-input bg-background p-2"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Inspection Scope / Type
                  </label>
                  <select
                    value={formInspectionType}
                    onChange={(e) => setFormInspectionType(e.target.value as QcInspectionType)}
                    className="w-full text-xs rounded-md border border-input bg-background p-2"
                  >
                    <option value="INCOMING_RAW_MATERIAL">Incoming Raw Material / Alloy</option>
                    <option value="SUBCONTRACT_JOBWORK">Subcontract Job-Work Machining</option>
                    <option value="CONSUMABLE_CHEMICAL">Consumable & Cutting Chemical</option>
                    <option value="BOUGHT_OUT_COMPONENT">Bought-Out OEM Component</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Sample Quantity
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={formSampleSize}
                    onChange={(e) => setFormSampleSize(parseFloat(e.target.value) || 1)}
                    className="w-full text-xs rounded-md border border-input bg-background p-2 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Mill Test Cert (MTC) / COA #
                  </label>
                  <input
                    type="text"
                    value={formTestCertNo}
                    onChange={(e) => setFormTestCertNo(e.target.value)}
                    placeholder="e.g. MTC-JSW-2026-7789"
                    className="w-full text-xs rounded-md border border-input bg-background p-2 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Test Certificate Date
                  </label>
                  <input
                    type="date"
                    value={formTestCertDate}
                    onChange={(e) => setFormTestCertDate(e.target.value)}
                    className="w-full text-xs rounded-md border border-input bg-background p-2"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Overall Initial Result
                  </label>
                  <select
                    value={formOverallResult}
                    onChange={(e) => setFormOverallResult(e.target.value as QcOverallResult)}
                    className="w-full text-xs rounded-md border border-input bg-background p-2"
                  >
                    <option value="PENDING">Pending Test Completion</option>
                    <option value="ACCEPTED">Accepted / Passed</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="ACCEPTED_UNDER_DEVIATION">Concession / Deviation</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Testing Notes &amp; Observations
                  </label>
                  <input
                    type="text"
                    value={formRemarks}
                    onChange={(e) => setFormRemarks(e.target.value)}
                    placeholder="Spectro, hardness, visual remarks..."
                    className="w-full text-xs rounded-md border border-input bg-background p-2"
                  />
                </div>
              </div>

              {/* Items Verification Table */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary" />
                  <span>Incoming Lots to Test &amp; Allocate</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    ({formItems.length} items)
                  </span>
                </h3>

                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px] tracking-wider border-b">
                      <tr>
                        <th className="px-3 py-2 w-10 text-center">#</th>
                        <th className="px-3 py-2 min-w-[180px]">Material / SKU</th>
                        <th className="px-3 py-2 w-24 text-right">Received</th>
                        <th className="px-3 py-2 w-20 text-right">Sample</th>
                        <th className="px-3 py-2 min-w-[140px]">Supplier Heat / Melt</th>
                        <th className="px-3 py-2 w-20 text-center">Visual</th>
                        <th className="px-3 py-2 w-20 text-center">Dim</th>
                        <th className="px-3 py-2 w-20 text-center">Chem</th>
                        <th className="px-3 py-2 w-20 text-center">Hardness</th>
                        <th className="px-3 py-2 min-w-[150px]">Put-Away Prime Bin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {formItems.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="text-center py-6 text-muted-foreground">
                            No GRN selected. Select a quarantine GRN from the dropdown above.
                          </td>
                        </tr>
                      ) : (
                        formItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="px-3 py-2 text-center font-mono text-[11px] text-muted-foreground">
                              {idx + 1}
                            </td>
                            <td className="px-3 py-2">
                              <span className="font-semibold text-foreground block">
                                {item.itemCode}
                              </span>
                              <span className="text-[11px] text-muted-foreground">
                                {item.itemDescription || item.itemName}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-foreground">
                              {item.receivedQty} {item.uomCode}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.001"
                                value={item.sampleQty}
                                onChange={(e) =>
                                  handleUpdateItemRow(idx, {
                                    sampleQty: parseFloat(e.target.value) || 1,
                                  })
                                }
                                className="w-full text-xs rounded border border-input bg-background p-1 text-right font-mono"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                placeholder="Heat / Melt No"
                                value={item.heatNo || ''}
                                onChange={(e) =>
                                  handleUpdateItemRow(idx, { heatNo: e.target.value })
                                }
                                className="w-full text-xs rounded border border-input bg-background p-1 font-mono"
                              />
                              <input
                                type="text"
                                placeholder="Internal Batch Tag"
                                value={item.batchNo || ''}
                                onChange={(e) =>
                                  handleUpdateItemRow(idx, { batchNo: e.target.value })
                                }
                                className="w-full text-[10px] rounded border border-input bg-background px-1 py-0.5 mt-1 font-mono text-muted-foreground"
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <select
                                value={item.visualCheck || 'PASS'}
                                onChange={(e) =>
                                  handleUpdateItemRow(idx, {
                                    visualCheck: e.target.value as QcCheckResult,
                                  })
                                }
                                className={`text-[11px] rounded border p-1 font-semibold ${
                                  item.visualCheck === 'FAIL'
                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40'
                                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40'
                                }`}
                              >
                                <option value="PASS">PASS</option>
                                <option value="FAIL">FAIL</option>
                                <option value="NA">N/A</option>
                              </select>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <select
                                value={item.dimensionCheck || 'PASS'}
                                onChange={(e) =>
                                  handleUpdateItemRow(idx, {
                                    dimensionCheck: e.target.value as QcCheckResult,
                                  })
                                }
                                className={`text-[11px] rounded border p-1 font-semibold ${
                                  item.dimensionCheck === 'FAIL'
                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40'
                                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40'
                                }`}
                              >
                                <option value="PASS">PASS</option>
                                <option value="FAIL">FAIL</option>
                                <option value="NA">N/A</option>
                              </select>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <select
                                value={item.chemicalTest || 'PASS'}
                                onChange={(e) =>
                                  handleUpdateItemRow(idx, {
                                    chemicalTest: e.target.value as QcCheckResult,
                                  })
                                }
                                className={`text-[11px] rounded border p-1 font-semibold ${
                                  item.chemicalTest === 'FAIL'
                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40'
                                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40'
                                }`}
                              >
                                <option value="PASS">PASS</option>
                                <option value="FAIL">FAIL</option>
                                <option value="NA">N/A</option>
                              </select>
                            </td>
                            <td className="px-3 py-2 text-center">
                              <select
                                value={item.hardnessTest || 'PASS'}
                                onChange={(e) =>
                                  handleUpdateItemRow(idx, {
                                    hardnessTest: e.target.value as QcCheckResult,
                                  })
                                }
                                className={`text-[11px] rounded border p-1 font-semibold ${
                                  item.hardnessTest === 'FAIL'
                                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40'
                                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40'
                                }`}
                              >
                                <option value="PASS">PASS</option>
                                <option value="FAIL">FAIL</option>
                                <option value="NA">N/A</option>
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <select
                                value={item.destinationBinId || ''}
                                onChange={(e) =>
                                  handleUpdateItemRow(idx, {
                                    destinationBinId: Number(e.target.value) || undefined,
                                  })
                                }
                                className="w-full text-xs rounded border border-input bg-background p-1"
                              >
                                <option value="">-- Select Destination Bin --</option>
                                {storageBins.map((b) => (
                                  <option key={b.binId} value={b.binId}>
                                    {b.binCode} ({b.binName})
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-4 border-t flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  * Note: Submitting saves QC Report in DRAFT. You can immediately route to QA Supervisor approval.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    className="px-4 py-2 rounded-lg border text-xs font-medium hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createQcMutation.isPending || updateQcMutation.isPending}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingQc ? 'Update QC Report' : 'Save QC Report'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. APPROVE & RELEASE QUARANTINE STOCK MODAL                          */}
      {/* ==================================================================== */}
      {isApproveModalOpen && approveTarget && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
                <h2 className="text-lg font-bold text-foreground">
                  Quality Clearance &amp; Stock Release ({approveTarget.qcNo})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const itemsPayload = (approveTarget.items || []).map((it) => {
                  const alloc = itemApprovalAllocations[it.qcItemId!] || {
                    acceptedQty: it.acceptedQty > 0 ? it.acceptedQty : it.receivedQty,
                    rejectedQty: it.rejectedQty || 0,
                    destinationBinId: it.destinationBinId || undefined,
                    disposition: 'ACCEPTED',
                  };
                  return {
                    qcItemId: it.qcItemId!,
                    acceptedQty: Number(alloc.acceptedQty),
                    rejectedQty: Number(alloc.rejectedQty),
                    destinationBinId: alloc.destinationBinId,
                    disposition: alloc.disposition,
                  };
                });
                approveQcMutation.mutate({
                  id: approveTarget.qcId,
                  payload: {
                    approvalRemarks,
                    overallResult: approvalResult,
                    items: itemsPayload,
                  },
                });
              }}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                Confirming QC clearance releases materials from Quarantine staging bays to permanent warehouse bins,
                marks Goods Receipt Note <strong>{approveTarget.grnNo}</strong> as fully Approved, and updates
                Purchase Order <strong>{approveTarget.poNo || 'N/A'}</strong> received balances.
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Final Quality Disposition:
                  </label>
                  <select
                    value={approvalResult}
                    onChange={(e) => setApprovalResult(e.target.value as QcOverallResult)}
                    className="w-full text-xs rounded-md border border-input bg-background p-2"
                  >
                    <option value="ACCEPTED">ACCEPTED (Conforms to drawing &amp; ASTM specification)</option>
                    <option value="ACCEPTED_UNDER_DEVIATION">ACCEPTED UNDER DEVIATION (Engineering Concession)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    QA Head Sign-Off Remarks:
                  </label>
                  <input
                    type="text"
                    value={approvalRemarks}
                    onChange={(e) => setApprovalRemarks(e.target.value)}
                    placeholder="e.g. Spectro verified against mill cert. Released for CNC machining."
                    className="w-full text-xs rounded-md border border-input bg-background p-2"
                  />
                </div>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted text-muted-foreground text-[10px] uppercase font-semibold">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Received</th>
                      <th className="px-3 py-2 text-right w-24">Accepted Qty</th>
                      <th className="px-3 py-2 text-right w-24">Rejected Qty</th>
                      <th className="px-3 py-2 min-w-[160px]">Target Storage Bin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(approveTarget.items || []).map((it) => {
                      const cur = itemApprovalAllocations[it.qcItemId!] || {
                        acceptedQty: it.acceptedQty > 0 ? it.acceptedQty : it.receivedQty,
                        rejectedQty: it.rejectedQty || 0,
                        destinationBinId: it.destinationBinId || undefined,
                        disposition: 'ACCEPTED',
                      };
                      return (
                        <tr key={it.qcItemId}>
                          <td className="px-3 py-2">
                            <span className="font-semibold text-foreground block">
                              {it.itemCode}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {it.itemDescription || it.itemName}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold">
                            {it.receivedQty} {it.uomCode}
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.001"
                              value={cur.acceptedQty}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setItemApprovalAllocations((prev) => ({
                                  ...prev,
                                  [it.qcItemId!]: {
                                    ...prev[it.qcItemId!],
                                    acceptedQty: val,
                                    rejectedQty: Math.max(0, it.receivedQty - val),
                                  },
                                }));
                              }}
                              className="w-full text-xs rounded border border-input bg-background p-1 text-right font-mono text-emerald-600 font-bold"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.001"
                              value={cur.rejectedQty}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setItemApprovalAllocations((prev) => ({
                                  ...prev,
                                  [it.qcItemId!]: {
                                    ...prev[it.qcItemId!],
                                    rejectedQty: val,
                                    acceptedQty: Math.max(0, it.receivedQty - val),
                                  },
                                }));
                              }}
                              className="w-full text-xs rounded border border-input bg-background p-1 text-right font-mono text-rose-600 font-bold"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={cur.destinationBinId || ''}
                              onChange={(e) => {
                                const binId = Number(e.target.value);
                                setItemApprovalAllocations((prev) => ({
                                  ...prev,
                                  [it.qcItemId!]: {
                                    ...prev[it.qcItemId!],
                                    destinationBinId: binId || undefined,
                                  },
                                }));
                              }}
                              className="w-full text-xs rounded border border-input bg-background p-1"
                            >
                              <option value="">-- Warehouse Prime Bin --</option>
                              {storageBins.map((b) => (
                                <option key={b.binId} value={b.binId}>
                                  {b.binCode} ({b.binName})
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsApproveModalOpen(false)}
                  className="px-4 py-2 rounded-lg border text-xs font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approveQcMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Authorize Quality Clearance</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. REJECT CONSIGNMENT MODAL                                          */}
      {/* ==================================================================== */}
      {isRejectModalOpen && rejectTarget && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in-50">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2 text-rose-600">
                <ShieldAlert className="w-5 h-5" />
                <h2 className="text-lg font-bold text-foreground">
                  Reject Consignment ({rejectTarget.qcNo})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!rejectionReason.trim()) {
                  alert('Please enter reasons for non-conformance rejection.');
                  return;
                }
                rejectQcMutation.mutate({
                  id: rejectTarget.qcId,
                  payload: {
                    rejectionReason,
                    defectCode,
                  },
                });
              }}
              className="p-6 space-y-4"
            >
              <p className="text-xs text-muted-foreground">
                Rejecting consignment flags all items as non-conforming and marks them for supplier return/quarantine scrap.
              </p>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Defect Classification:
                </label>
                <select
                  value={defectCode}
                  onChange={(e) => setDefectCode(e.target.value)}
                  className="w-full text-xs rounded-md border border-input bg-background p-2"
                >
                  <option value="QC_NON_CONFORMING">Non-Conforming to Drawing Spec</option>
                  <option value="DIM_OUT_OF_SPEC">Dimensional Tolerance Failure</option>
                  <option value="CHEM_COMPOSITION_FAIL">Spectro Chemical Failure</option>
                  <option value="SURFACE_DEFECTS">Crack, Porosity or Burr Defects</option>
                  <option value="HARDNESS_OUT_OF_SPEC">Hardness Failure (HRC / BHN)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Detailed Rejection Justification <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Spectro results, dimensional deviations, test findings..."
                  className="w-full text-xs rounded-md border border-input bg-background p-2.5"
                />
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="px-4 py-2 rounded-lg border text-xs font-medium hover:bg-muted"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={rejectQcMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 flex items-center gap-1.5"
                >
                  <ShieldAlert className="w-4 h-4" />
                  <span>Confirm Lot Rejection</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 8. CANCEL INSPECTION MODAL                                           */}
      {/* ==================================================================== */}
      {isCancelModalOpen && cancelTarget && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in-50">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2 text-rose-600">
                <XCircle className="w-5 h-5" />
                <h2 className="text-lg font-bold text-foreground">
                  Cancel QC Inspection ({cancelTarget.qcNo})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!cancelReason.trim()) {
                  alert('Please enter cancellation reason.');
                  return;
                }
                cancelQcMutation.mutate({
                  id: cancelTarget.qcId,
                  reason: cancelReason,
                });
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Cancellation Reason <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Explain why this inspection report is voided..."
                  className="w-full text-xs rounded-md border border-input bg-background p-2.5"
                />
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 rounded-lg border text-xs font-medium hover:bg-muted"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={cancelQcMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-medium hover:bg-rose-700 flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Confirm Cancellation</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 9. DETAILS & LAB REPORT DRAWER                                       */}
      {/* ==================================================================== */}
      {isDetailOpen && selectedQc && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-card border-l h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-50">
            <div className="p-6 border-b flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2">
                <FlaskConical className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {selectedQc.qcNo}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Laboratory Inspection Certificate &amp; Analysis
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailOpen(false);
                    openPrintModal(selectedQc);
                  }}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                  title="Print Report"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsDetailOpen(false)}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Disposition Badge Banner */}
              <div className="p-4 rounded-xl border bg-muted/20 flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Final Inspection Disposition
                  </span>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-md text-xs font-bold mt-1 border ${
                      RESULT_CONFIG[selectedQc.overallResult]?.bg
                    } ${RESULT_CONFIG[selectedQc.overallResult]?.text} ${
                      RESULT_CONFIG[selectedQc.overallResult]?.border
                    }`}
                  >
                    {RESULT_CONFIG[selectedQc.overallResult]?.label}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">
                    Status
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mt-1 border ${
                      STATUS_CONFIG[selectedQc.status]?.bg
                    } ${STATUS_CONFIG[selectedQc.status]?.text} ${
                      STATUS_CONFIG[selectedQc.status]?.border
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        STATUS_CONFIG[selectedQc.status]?.dot
                      }`}
                    />
                    {STATUS_CONFIG[selectedQc.status]?.label}
                  </span>
                </div>
              </div>

              {/* Scope & Supplier Details */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-muted-foreground block">Supplier</span>
                  <span className="font-semibold text-foreground">
                    {selectedQc.vendorName} ({selectedQc.vendorCode})
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Receiving Plant</span>
                  <span className="font-semibold text-foreground">
                    {selectedQc.warehouseName}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Source GRN #</span>
                  <span className="font-mono text-primary font-bold">
                    {selectedQc.grnNo}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Challan / Vehicle</span>
                  <span className="font-mono text-foreground">
                    {selectedQc.challanNo || 'N/A'} {selectedQc.vehicleNo ? `(${selectedQc.vehicleNo})` : ''}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">MTC / Test Cert #</span>
                  <span className="font-mono text-foreground font-semibold">
                    {selectedQc.testCertNo || 'Not Provided'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Test Cert Date</span>
                  <span>{selectedQc.testCertDate || 'N/A'}</span>
                </div>
              </div>

              {/* Inspector & Signatures */}
              <div className="grid grid-cols-2 gap-4 text-xs p-3 rounded-lg border bg-muted/20">
                <div>
                  <span className="text-muted-foreground block">QA Inspector</span>
                  <span className="font-medium text-foreground">
                    {selectedQc.inspectorName || 'Pending'}
                  </span>
                  {selectedQc.inspectionDate && (
                    <span className="text-[11px] text-muted-foreground block font-mono">
                      {selectedQc.inspectionDate}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block">QA Manager Approval</span>
                  <span className="font-medium text-foreground">
                    {selectedQc.approverName || 'Pending Approval'}
                  </span>
                  {selectedQc.approvalDate && (
                    <span className="text-[11px] text-muted-foreground block font-mono">
                      {selectedQc.approvalDate}
                    </span>
                  )}
                </div>
              </div>

              {/* Remarks */}
              {selectedQc.remarks && (
                <div className="p-3 rounded-lg border bg-muted/10 text-xs">
                  <span className="font-semibold text-foreground block mb-0.5">
                    Laboratory Observations:
                  </span>
                  <p className="text-muted-foreground">{selectedQc.remarks}</p>
                </div>
              )}

              {/* Items Detail */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Inspected Line Items &amp; Parameters
                </h3>
                <div className="border rounded-lg divide-y text-xs">
                  {(selectedQc.items || []).map((it, i) => (
                    <div key={i} className="p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground">
                          {it.itemCode} - {it.itemName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            it.disposition === 'ACCEPTED'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300'
                          }`}
                        >
                          {it.disposition}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                        <span>Rec: {it.receivedQty} {it.uomCode}</span>
                        <span>•</span>
                        <span className="text-emerald-600 font-bold">Acc: {it.acceptedQty}</span>
                        <span>•</span>
                        <span className="text-rose-600 font-bold">Rej: {it.rejectedQty}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        {it.heatNo && (
                          <span className="px-1.5 py-0.5 rounded bg-muted font-mono">
                            Heat: {it.heatNo}
                          </span>
                        )}
                        {it.batchNo && (
                          <span className="px-1.5 py-0.5 rounded bg-muted font-mono">
                            Batch: {it.batchNo}
                          </span>
                        )}
                        {it.destinationBinCode && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Bin: {it.destinationBinCode}
                          </span>
                        )}
                      </div>

                      {/* Observed Parameters JSON */}
                      {it.observedParameters && Object.keys(it.observedParameters).length > 0 && (
                        <div className="p-2 rounded bg-muted/40 font-mono text-[11px] space-y-0.5 border">
                          <span className="text-[10px] text-muted-foreground uppercase font-bold block">
                            Observed Lab Readings:
                          </span>
                          <div className="grid grid-cols-2 gap-1 text-slate-800 dark:text-slate-200">
                            {Object.entries(it.observedParameters).map(([k, v]) => (
                              <div key={k}>
                                <span className="text-muted-foreground">{k.replace(/_/g, ' ')}:</span>{' '}
                                <strong>{String(v)}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 10. OFFICIAL PRINTABLE QC INSPECTION CERTIFICATE                      */}
      {/* ==================================================================== */}
      {isPrintModalOpen && printTarget && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 border rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between bg-slate-100 print:hidden">
              <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Printer className="w-4 h-4 text-primary" />
                Material Quality Inspection Certificate
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Certificate</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1 rounded-md text-slate-500 hover:bg-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 font-sans print:p-0">
              <div className="border border-slate-300 rounded-lg p-6 space-y-6">
                {/* Enterprise Header */}
                <div className="flex items-start justify-between border-b pb-4">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                      Kashvira Engineering &amp; Manufacturing Ltd.
                    </h1>
                    <p className="text-xs text-slate-600">
                      Central Metallurgy Assurance &amp; Quality Control Laboratory
                    </p>
                    <p className="text-xs text-slate-600">
                      Sanand Industrial Estate, Ahmedabad, Gujarat • NABL Calibrated Testing Bay
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold px-2 py-1 bg-emerald-100 text-emerald-800 rounded uppercase tracking-wider">
                      QC INSPECTION CERTIFICATE
                    </span>
                    <div className="font-mono font-bold text-base text-slate-900 mt-1">
                      {printTarget.qcNo}
                    </div>
                    <div className="text-xs text-slate-600">
                      Date: {printTarget.qcDate}
                    </div>
                  </div>
                </div>

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 text-xs border p-3 rounded bg-slate-50">
                  <div className="space-y-1">
                    <div><strong>Supplier:</strong> {printTarget.vendorName} ({printTarget.vendorCode})</div>
                    <div><strong>GRN Number:</strong> {printTarget.grnNo}</div>
                    {printTarget.poNo && <div><strong>Purchase Order:</strong> {printTarget.poNo}</div>}
                    <div><strong>Delivery Challan:</strong> {printTarget.challanNo || 'N/A'}</div>
                  </div>
                  <div className="space-y-1">
                    <div><strong>Inspection Scope:</strong> {printTarget.inspectionType.replace(/_/g, ' ')}</div>
                    <div><strong>MTC / COA Reference:</strong> {printTarget.testCertNo || 'N/A'}</div>
                    <div><strong>Test Cert Date:</strong> {printTarget.testCertDate || 'N/A'}</div>
                    <div>
                      <strong>Overall Result:</strong>{' '}
                      <span className="font-bold text-emerald-700">
                        {printTarget.overallResult}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Items & Test Parameter Verification Table */}
                <table className="w-full text-xs text-left border-collapse border border-slate-300">
                  <thead className="bg-slate-100 text-slate-800 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="border p-2 w-8 text-center">#</th>
                      <th className="border p-2">Item SKU &amp; Specs</th>
                      <th className="border p-2 w-16 text-center">UOM</th>
                      <th className="border p-2 w-20 text-right">Rec Qty</th>
                      <th className="border p-2 w-20 text-right">Acc Qty</th>
                      <th className="border p-2 w-20 text-right">Rej Qty</th>
                      <th className="border p-2 min-w-[140px]">Heat / Melt / Batch</th>
                      <th className="border p-2 text-center w-24">Visual / Dim / Chem / Hard</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(printTarget.items || []).map((it, idx) => (
                      <tr key={idx} className="border">
                        <td className="border p-2 text-center font-mono">{idx + 1}</td>
                        <td className="border p-2">
                          <div className="font-semibold">{it.itemCode}</div>
                          <div className="text-[11px] text-slate-600">{it.itemDescription || it.itemName}</div>
                        </td>
                        <td className="border p-2 text-center font-mono">{it.uomCode}</td>
                        <td className="border p-2 text-right font-mono">{it.receivedQty}</td>
                        <td className="border p-2 text-right font-mono font-bold text-emerald-700">
                          {it.acceptedQty}
                        </td>
                        <td className="border p-2 text-right font-mono font-bold text-rose-700">
                          {it.rejectedQty}
                        </td>
                        <td className="border p-2 font-mono text-[11px]">
                          {it.heatNo && <div>Heat: {it.heatNo}</div>}
                          {it.batchNo && <div>Batch: {it.batchNo}</div>}
                        </td>
                        <td className="border p-2 text-center font-mono text-[10px]">
                          {it.visualCheck}/{it.dimensionCheck}/{it.chemicalTest}/{it.hardnessTest}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Sign-off Block */}
                <div className="pt-4 border-t space-y-6">
                  {printTarget.remarks && (
                    <div className="text-xs text-slate-600">
                      <strong>Remarks:</strong> {printTarget.remarks}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-12 text-center text-xs pt-8">
                    <div className="border-t border-slate-400 pt-2">
                      <div className="font-semibold text-slate-800">
                        {printTarget.inspectorName || 'Metallurgy Inspector'}
                      </div>
                      <div className="text-[10px] text-slate-500">Inspecting Quality Engineer</div>
                    </div>
                    <div className="border-t border-slate-400 pt-2">
                      <div className="font-semibold text-slate-800">
                        {printTarget.approverName || 'QA & Metallurgy Head'}
                      </div>
                      <div className="text-[10px] text-slate-500">Authorized Signatory — Quality Assurance</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 11. CONFIRM DELETE MODAL                                             */}
      {/* ==================================================================== */}
      {deleteTarget && (
        <ConfirmDeleteModal
          isOpen={!!deleteTarget}
          entityType="Inward QC Inspection"
          entityName={deleteTarget.qcNo}
          entityCode={deleteTarget.qcNo}
          errorMessage={deleteErrorMessage}
          dependencies={deleteConflicts}
          isDeleting={deleteQcMutation.isPending}
          onConfirm={() => deleteQcMutation.mutate(deleteTarget.qcId)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default InwardQcMasterPage;
