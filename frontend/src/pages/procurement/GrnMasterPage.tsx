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
  FileSpreadsheet,
  FileText,
  Filter,
  IndianRupee,
  Layers,
  Package,
  Plus,
  Printer,
  Scale,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
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

export type GrnStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'QC_IN_PROGRESS'
  | 'APPROVED'
  | 'CANCELLED';

export interface GrnItemRecord {
  grnItemId?: number;
  grnId?: number;
  poItemId?: number | null;
  gateInwardItemId?: number | null;
  itemId: number;
  itemCode?: string;
  itemDescription?: string;
  uomId: number;
  uomCode?: string;
  uomName?: string;
  orderQty: number;
  challanQty: number;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  quarantineQty: number;
  shortageQty: number;
  excessQty: number;
  unitRate: number;
  receivedAmount: number;
  batchNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  quarantineBinId?: number | null;
  quarantineBinCode?: string | null;
  quarantineBinName?: string | null;
  storageBinId?: number | null;
  storageBinCode?: string | null;
  storageBinName?: string | null;
  isQcRequired: boolean;
  remarks?: string | null;
  isActive?: boolean;
}

export interface GrnHeaderRecord {
  grnId: number;
  grnNo: string;
  grnDate: string;
  warehouseId: number;
  warehouseCode?: string;
  warehouseName: string;
  vendorId: number;
  vendorCode?: string;
  vendorName: string;
  vendorGstin?: string | null;
  vendorAddress?: string | null;
  vendorCity?: string | null;
  vendorState?: string | null;
  poId?: number | null;
  poNo?: string | null;
  poDate?: string | null;
  gateInwardId?: number | null;
  gateInwardNo?: string | null;
  challanNo: string;
  challanDate: string;
  invoiceNo?: string | null;
  invoiceDate?: string | null;
  vehicleNo?: string | null;
  ewayBillNo?: string | null;
  lrNo?: string | null;
  lrDate?: string | null;
  totalReceivedAmount: number;
  status: GrnStatus;
  storeRemarks?: string | null;
  inspectedBy?: number | null;
  inspectedByName?: string | null;
  inspectionDate?: string | null;
  approvedBy?: number | null;
  approvedByName?: string | null;
  approvalDate?: string | null;
  approvalRemarks?: string | null;
  cancelReason?: string | null;
  isActive: boolean;
  createdDate: string;
  itemCount: number;
  totalReceivedQty: number;
  items?: GrnItemRecord[];
}

export interface GrnSummary {
  totalGrns: number;
  qcPendingCount: number;
  approvedCount: number;
  draftCount: number;
  totalReceivedValuation: number;
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

export interface ItemLookupOption {
  itemId: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  baseUomId: number;
  baseUomCode?: string;
  standardCost?: number;
  purchaseRate?: number;
}

export interface UomLookupOption {
  uomId: number;
  uomCode: string;
  uomName: string;
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

export interface PendingGateInwardOption {
  gateInwardId: number;
  gateInwardNo: string;
  inwardDate: string;
  warehouseId: number;
  warehouseName: string;
  vendorId: number;
  vendorName: string;
  poId?: number | null;
  poNo?: string | null;
  challanNo: string;
  challanDate: string;
  vehicleNo?: string | null;
  ewayBillNo?: string | null;
  lrNo?: string | null;
  lrDate?: string | null;
  status: string;
}

export interface ApprovedPoOption {
  poId: number;
  poNo: string;
  poDate: string;
  vendorId: number;
  vendorName: string;
  status: string;
  totalAmount: number;
}

export interface PoItemOption {
  poItemId: number;
  poId: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  itemDescription?: string;
  uomId: number;
  uomCode: string;
  orderQty: number;
  receivedQty: number;
  pendingQty: number;
  unitRate: number;
  isQcRequired: boolean;
  defaultBinId?: number | null;
}

// ============================================================================
// STYLING & STATUS CONFIG
// ============================================================================

const STATUS_CONFIG: Record<
  GrnStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  DRAFT: {
    label: 'Draft Indent',
    bg: 'bg-slate-500/10 dark:bg-slate-400/10',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-300 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
  SUBMITTED: {
    label: 'Submitted for QC',
    bg: 'bg-blue-500/10 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-300 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  QC_IN_PROGRESS: {
    label: 'Quarantine Inspection',
    bg: 'bg-amber-500/10 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-300 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  APPROVED: {
    label: 'Stores Cleared',
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

const formatCurrencyINR = (amount?: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount || 0);
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const GrnMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Modals & Drawers State
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingGrn, setEditingGrn] = useState<GrnHeaderRecord | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [selectedGrn, setSelectedGrn] = useState<GrnHeaderRecord | null>(null);

  const [isQuarantineModalOpen, setIsQuarantineModalOpen] = useState<boolean>(false);
  const [quarantineTarget, setQuarantineTarget] = useState<GrnHeaderRecord | null>(null);
  const [quarantineRemarks, setQuarantineRemarks] = useState<string>('');
  const [quarantineBinId, setQuarantineBinId] = useState<number | ''>('');

  const [isApproveModalOpen, setIsApproveModalOpen] = useState<boolean>(false);
  const [approveTarget, setApproveTarget] = useState<GrnHeaderRecord | null>(null);
  const [approvalRemarks, setApprovalRemarks] = useState<string>('');
  const [approvalBinAssignments, setApprovalBinAssignments] = useState<
    Record<number, { storageBinId?: number; acceptedQty: number; rejectedQty: number }>
  >({});

  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelTarget, setCancelTarget] = useState<GrnHeaderRecord | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printTarget, setPrintTarget] = useState<GrnHeaderRecord | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<GrnHeaderRecord | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [deleteConflicts, setDeleteConflicts] = useState<DependencyConflictItem[]>([]);

  // Form State for Create/Edit Modal
  const [formGrnNo, setFormGrnNo] = useState<string>('');
  const [formGrnDate, setFormGrnDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [formWarehouseId, setFormWarehouseId] = useState<number | ''>('');
  const [formVendorId, setFormVendorId] = useState<number | ''>('');
  const [formPoId, setFormPoId] = useState<number | ''>('');
  const [formGateInwardId, setFormGateInwardId] = useState<number | ''>('');
  const [formChallanNo, setFormChallanNo] = useState<string>('');
  const [formChallanDate, setFormChallanDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [formInvoiceNo, setFormInvoiceNo] = useState<string>('');
  const [formInvoiceDate, setFormInvoiceDate] = useState<string>('');
  const [formVehicleNo, setFormVehicleNo] = useState<string>('');
  const [formEwayBillNo, setFormEwayBillNo] = useState<string>('');
  const [formLrNo, setFormLrNo] = useState<string>('');
  const [formLrDate, setFormLrDate] = useState<string>('');
  const [formStoreRemarks, setFormStoreRemarks] = useState<string>('');
  const [formItems, setFormItems] = useState<GrnItemRecord[]>([]);

  // --------------------------------------------------------------------------
  // API Queries
  // --------------------------------------------------------------------------

  // 1. KPI Summary
  const { data: summary, isLoading: isSummaryLoading } = useQuery<GrnSummary>({
    queryKey: ['procurement', 'grn', 'summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<GrnSummary>>(
        '/procurement/grn/summary',
      );
      return res.data.data;
    },
    staleTime: 30_000,
  });

  // 2. Listing
  const { data: grns = [], isLoading: isListLoading } = useQuery<
    GrnHeaderRecord[]
  >({
    queryKey: [
      'procurement',
      'grn',
      'list',
      statusFilter,
      warehouseFilter,
      vendorFilter,
      globalSearch,
    ],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (warehouseFilter !== 'ALL') params.warehouseId = warehouseFilter;
      if (vendorFilter !== 'ALL') params.vendorId = vendorFilter;
      if (globalSearch.trim()) params.search = globalSearch.trim();

      const res = await apiClient.get<ApiResponse<GrnHeaderRecord[]>>(
        '/procurement/grn',
        { params },
      );
      return res.data.data;
    },
  });

  // 3. Dropdowns & Catalogs
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
        standardCost: Number(i.standardCost || 0),
        purchaseRate: Number(i.purchaseRate || 0),
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

  const { data: pendingGateInwards = [] } = useQuery<PendingGateInwardOption[]>({
    queryKey: ['procurement', 'grn', 'pending-gate-inwards'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PendingGateInwardOption[]>>(
        '/procurement/grn/pending-gate-inwards',
      );
      return res.data.data;
    },
  });

  const { data: approvedPos = [] } = useQuery<ApprovedPoOption[]>({
    queryKey: ['procurement', 'grn', 'approved-pos'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ApprovedPoOption[]>>(
        '/procurement/grn/approved-pos',
      );
      return res.data.data;
    },
  });

  const { data: storageBins = [] } = useQuery<StorageBinOption[]>({
    queryKey: ['procurement', 'grn', 'storage-bins', formWarehouseId],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<StorageBinOption[]>>(
        '/procurement/grn/storage-bins',
        { params: formWarehouseId ? { warehouseId: formWarehouseId } : {} },
      );
      return res.data.data;
    },
    enabled: true,
  });

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  const createGrnMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post<ApiResponse<GrnHeaderRecord>>(
        '/procurement/grn',
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'grn'] });
      setIsEditorOpen(false);
      resetEditorForm();
    },
  });

  const updateGrnMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.put<ApiResponse<GrnHeaderRecord>>(
        `/procurement/grn/${id}`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'grn'] });
      setIsEditorOpen(false);
      resetEditorForm();
    },
  });

  const submitGrnMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.post<ApiResponse<GrnHeaderRecord>>(
        `/procurement/grn/${id}/submit`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'grn'] });
    },
  });

  const putAwayMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.post<ApiResponse<GrnHeaderRecord>>(
        `/procurement/grn/${id}/put-away`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'grn'] });
      setIsQuarantineModalOpen(false);
      setQuarantineTarget(null);
    },
  });

  const approveGrnMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.post<ApiResponse<GrnHeaderRecord>>(
        `/procurement/grn/${id}/approve`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'grn'] });
      setIsApproveModalOpen(false);
      setApproveTarget(null);
    },
  });

  const cancelGrnMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await apiClient.post<ApiResponse<GrnHeaderRecord>>(
        `/procurement/grn/${id}/cancel`,
        { cancelReason: reason },
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'grn'] });
      setIsCancelModalOpen(false);
      setCancelTarget(null);
    },
  });

  const deleteGrnMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete<ApiResponse<any>>(
        `/procurement/grn/${id}`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'grn'] });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      setDeleteErrorMessage(
        err.response?.data?.message || 'Failed to delete GRN indent.',
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
    setEditingGrn(null);
    setFormGrnNo('');
    setFormGrnDate(new Date().toISOString().split('T')[0]);
    setFormWarehouseId('');
    setFormVendorId('');
    setFormPoId('');
    setFormGateInwardId('');
    setFormChallanNo('');
    setFormChallanDate(new Date().toISOString().split('T')[0]);
    setFormInvoiceNo('');
    setFormInvoiceDate('');
    setFormVehicleNo('');
    setFormEwayBillNo('');
    setFormLrNo('');
    setFormLrDate('');
    setFormStoreRemarks('');
    setFormItems([]);
  };

  const openCreateModal = () => {
    resetEditorForm();
    if (warehouses.length > 0) setFormWarehouseId(warehouses[0].warehouseId);
    setIsEditorOpen(true);
  };

  const openEditModal = async (grn: GrnHeaderRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<GrnHeaderRecord>>(
        `/procurement/grn/${grn.grnId}`,
      );
      const full = res.data.data;
      setEditingGrn(full);
      setFormGrnNo(full.grnNo);
      setFormGrnDate(full.grnDate);
      setFormWarehouseId(full.warehouseId);
      setFormVendorId(full.vendorId);
      setFormPoId(full.poId || '');
      setFormGateInwardId(full.gateInwardId || '');
      setFormChallanNo(full.challanNo);
      setFormChallanDate(full.challanDate);
      setFormInvoiceNo(full.invoiceNo || '');
      setFormInvoiceDate(full.invoiceDate || '');
      setFormVehicleNo(full.vehicleNo || '');
      setFormEwayBillNo(full.ewayBillNo || '');
      setFormLrNo(full.lrNo || '');
      setFormLrDate(full.lrDate || '');
      setFormStoreRemarks(full.storeRemarks || '');
      setFormItems(full.items || []);
      setIsEditorOpen(true);
    } catch {
      // fallback
    }
  };

  const openDetailDrawer = async (grn: GrnHeaderRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<GrnHeaderRecord>>(
        `/procurement/grn/${grn.grnId}`,
      );
      setSelectedGrn(res.data.data);
      setIsDetailOpen(true);
    } catch {
      setSelectedGrn(grn);
      setIsDetailOpen(true);
    }
  };

  const openPrintModal = async (grn: GrnHeaderRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<GrnHeaderRecord>>(
        `/procurement/grn/${grn.grnId}`,
      );
      setPrintTarget(res.data.data);
      setIsPrintModalOpen(true);
    } catch {
      setPrintTarget(grn);
      setIsPrintModalOpen(true);
    }
  };

  const handleSelectPendingGateInward = async (ginId: number) => {
    setFormGateInwardId(ginId);
    const gin = pendingGateInwards.find((g) => g.gateInwardId === ginId);
    if (!gin) return;

    setFormWarehouseId(gin.warehouseId);
    setFormVendorId(gin.vendorId);
    if (gin.poId) setFormPoId(gin.poId);
    setFormChallanNo(gin.challanNo);
    setFormChallanDate(gin.challanDate);
    if (gin.vehicleNo) setFormVehicleNo(gin.vehicleNo);
    if (gin.ewayBillNo) setFormEwayBillNo(gin.ewayBillNo);
    if (gin.lrNo) setFormLrNo(gin.lrNo);
    if (gin.lrDate) setFormLrDate(gin.lrDate);

    // Fetch gate inward full details with items
    try {
      const res = await apiClient.get<ApiResponse<any>>(
        `/procurement/gate-inward/${ginId}`,
      );
      const ginFull = res.data.data;
      if (ginFull?.items && ginFull.items.length > 0) {
        const mappedItems: GrnItemRecord[] = ginFull.items.map((it: any) => {
          const itemCat = itemsCatalog.find((x) => x.itemId === it.itemId);
          const rate = itemCat?.purchaseRate || itemCat?.standardCost || 100;
          const rQty = Number(it.challanQty || 0);
          return {
            gateInwardItemId: it.gateInwardItemId,
            poItemId: it.poItemId,
            itemId: it.itemId,
            itemCode: it.itemCode,
            itemDescription: it.itemDescription,
            uomId: it.uomId,
            uomCode: it.uomCode,
            orderQty: Number(it.challanQty || 0),
            challanQty: Number(it.challanQty || 0),
            receivedQty: rQty,
            acceptedQty: 0,
            rejectedQty: 0,
            quarantineQty: rQty,
            shortageQty: 0,
            excessQty: 0,
            unitRate: rate,
            receivedAmount: rQty * rate,
            isQcRequired: true,
            batchNo: '',
          };
        });
        setFormItems(mappedItems);
      }
    } catch {
      // ignore
    }
  };

  const handleSelectApprovedPo = async (poId: number) => {
    setFormPoId(poId);
    const po = approvedPos.find((p) => p.poId === poId);
    if (!po) return;

    setFormVendorId(po.vendorId);

    try {
      const res = await apiClient.get<ApiResponse<PoItemOption[]>>(
        `/procurement/grn/po-items/${poId}`,
      );
      const poItems = res.data.data || [];
      const mappedItems: GrnItemRecord[] = poItems.map((poi) => {
        const pQty = poi.pendingQty > 0 ? poi.pendingQty : poi.orderQty;
        return {
          poItemId: poi.poItemId,
          itemId: poi.itemId,
          itemCode: poi.itemCode,
          itemDescription: poi.itemDescription,
          uomId: poi.uomId,
          uomCode: poi.uomCode,
          orderQty: poi.orderQty,
          challanQty: pQty,
          receivedQty: pQty,
          acceptedQty: poi.isQcRequired ? 0 : pQty,
          rejectedQty: 0,
          quarantineQty: poi.isQcRequired ? pQty : 0,
          shortageQty: 0,
          excessQty: 0,
          unitRate: poi.unitRate,
          receivedAmount: pQty * poi.unitRate,
          isQcRequired: poi.isQcRequired,
          storageBinId: poi.defaultBinId,
        };
      });
      setFormItems(mappedItems);
    } catch {
      // ignore
    }
  };

  const handleAddItemRow = () => {
    if (itemsCatalog.length === 0 || uomsCatalog.length === 0) return;
    const firstItem = itemsCatalog[0];
    const firstUom = uomsCatalog[0];
    const rate = firstItem.purchaseRate || firstItem.standardCost || 100;

    const newItem: GrnItemRecord = {
      itemId: firstItem.itemId,
      itemCode: firstItem.itemCode,
      itemDescription: firstItem.itemName,
      uomId: firstUom.uomId,
      uomCode: firstUom.uomCode,
      orderQty: 10,
      challanQty: 10,
      receivedQty: 10,
      acceptedQty: 0,
      rejectedQty: 0,
      quarantineQty: 10,
      shortageQty: 0,
      excessQty: 0,
      unitRate: rate,
      receivedAmount: 10 * rate,
      isQcRequired: true,
    };
    setFormItems([...formItems, newItem]);
  };

  const handleUpdateItemRow = (index: number, patch: Partial<GrnItemRecord>) => {
    setFormItems((prev) => {
      const next = [...prev];
      const cur = { ...next[index], ...patch };

      // Update derived quantities and valuation
      const cQty = Number(cur.challanQty || 0);
      const rQty = Number(cur.receivedQty || 0);
      cur.shortageQty = Math.max(0, cQty - rQty);
      cur.excessQty = Math.max(0, rQty - cQty);
      cur.receivedAmount = rQty * Number(cur.unitRate || 0);

      if (cur.isQcRequired) {
        cur.quarantineQty = rQty;
        cur.acceptedQty = 0;
      } else {
        cur.quarantineQty = 0;
        cur.acceptedQty = rQty;
      }

      next[index] = cur;
      return next;
    });
  };

  const handleRemoveItemRow = (index: number) => {
    setFormItems(formItems.filter((_, idx) => idx !== index));
  };

  const totalCalculatedFormValuation = useMemo(() => {
    return formItems.reduce(
      (sum, it) => sum + Number(it.receivedQty || 0) * Number(it.unitRate || 0),
      0,
    );
  }, [formItems]);

  const handleSaveGrn = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formWarehouseId) {
      alert('Please select a receiving plant warehouse.');
      return;
    }
    if (!formVendorId) {
      alert('Please select an active supplier vendor.');
      return;
    }
    if (!formChallanNo.trim()) {
      alert('Supplier delivery challan number is mandatory.');
      return;
    }
    if (formItems.length === 0) {
      alert('Please add at least one line item to the GRN.');
      return;
    }

    const payload = {
      grnNo: formGrnNo.trim() || undefined,
      grnDate: formGrnDate,
      warehouseId: Number(formWarehouseId),
      vendorId: Number(formVendorId),
      poId: formPoId ? Number(formPoId) : undefined,
      gateInwardId: formGateInwardId ? Number(formGateInwardId) : undefined,
      challanNo: formChallanNo.trim(),
      challanDate: formChallanDate,
      invoiceNo: formInvoiceNo.trim() || undefined,
      invoiceDate: formInvoiceDate || undefined,
      vehicleNo: formVehicleNo.trim() || undefined,
      ewayBillNo: formEwayBillNo.trim() || undefined,
      lrNo: formLrNo.trim() || undefined,
      lrDate: formLrDate || undefined,
      storeRemarks: formStoreRemarks.trim() || undefined,
      items: formItems.map((it) => ({
        poItemId: it.poItemId || undefined,
        gateInwardItemId: it.gateInwardItemId || undefined,
        itemId: it.itemId,
        itemDescription: it.itemDescription,
        uomId: it.uomId,
        orderQty: Number(it.orderQty || 0),
        challanQty: Number(it.challanQty || 0),
        receivedQty: Number(it.receivedQty || 0),
        acceptedQty: Number(it.acceptedQty || 0),
        rejectedQty: Number(it.rejectedQty || 0),
        quarantineQty: Number(it.quarantineQty || 0),
        shortageQty: Number(it.shortageQty || 0),
        excessQty: Number(it.excessQty || 0),
        unitRate: Number(it.unitRate || 0),
        receivedAmount: Number(it.receivedAmount || 0),
        batchNo: it.batchNo || undefined,
        mfgDate: it.mfgDate || undefined,
        expiryDate: it.expiryDate || undefined,
        quarantineBinId: it.quarantineBinId || undefined,
        storageBinId: it.storageBinId || undefined,
        isQcRequired: it.isQcRequired,
        remarks: it.remarks || undefined,
      })),
    };

    if (editingGrn) {
      updateGrnMutation.mutate({ id: editingGrn.grnId, payload });
    } else {
      createGrnMutation.mutate(payload);
    }
  };

  // --------------------------------------------------------------------------
  // Table Columns Definition
  // --------------------------------------------------------------------------

  const columns: MasterTableColumn<GrnHeaderRecord>[] = [
    {
      key: 'grnNo',
      header: 'GRN Number & Date',
      render: (row) => (
        <div className="flex flex-col">
          <button
            type="button"
            onClick={() => openDetailDrawer(row)}
            className="font-mono font-semibold text-primary hover:underline flex items-center gap-1.5 text-left"
          >
            <FileCheck2 className="w-4 h-4 text-primary shrink-0" />
            <span>{row.grnNo}</span>
          </button>
          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
            <Calendar className="w-3 h-3" />
            <span>{row.grnDate}</span>
            <span className="mx-1">•</span>
            <Warehouse className="w-3 h-3" />
            <span>{row.warehouseName}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'vendorName',
      header: 'Supplier / Vendor',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground text-sm line-clamp-1">
            {row.vendorName}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {row.vendorCode}
          </span>
        </div>
      ),
    },
    {
      key: 'gateInwardNo',
      header: 'Inward Reference',
      render: (row) => (
        <div className="flex flex-col gap-1 text-xs">
          {row.gateInwardNo ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-mono text-[11px] border border-indigo-200 dark:border-indigo-800">
              <Truck className="w-3 h-3" />
              {row.gateInwardNo}
            </span>
          ) : (
            <span className="text-muted-foreground italic text-[11px]">Direct Store Entry</span>
          )}
          {row.poNo && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px]">
              PO: {row.poNo}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'challanNo',
      header: 'Challan & Vehicle',
      render: (row) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium text-foreground">{row.challanNo}</span>
          <span className="text-muted-foreground">Dt: {row.challanDate}</span>
          {row.vehicleNo && (
            <span className="font-mono text-[11px] text-muted-foreground mt-0.5">
              🚚 {row.vehicleNo}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'itemCount',
      header: 'Items & Received',
      render: (row) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium text-foreground">
            {row.itemCount} Line{row.itemCount === 1 ? '' : 's'}
          </span>
          <span className="text-muted-foreground">
            {row.totalReceivedQty?.toLocaleString('en-IN', {
              maximumFractionDigits: 3,
            })}{' '}
            Total Qty
          </span>
        </div>
      ),
    },
    {
      key: 'totalReceivedAmount',
      header: 'Receipt Valuation',
      render: (row) => (
        <span className="font-semibold text-foreground text-sm font-mono">
          {formatCurrencyINR(row.totalReceivedAmount)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Store / QC Status',
      render: (row) => {
        const conf = STATUS_CONFIG[row.status] || STATUS_CONFIG.DRAFT;
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${conf.bg} ${conf.text} ${conf.border}`}
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
            title="Inspect GRN Details"
            onClick={() => openDetailDrawer(row)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Print Voucher */}
          <button
            type="button"
            title="Print Official GRN Voucher"
            onClick={() => openPrintModal(row)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Edit (Draft only) */}
          {row.status === 'DRAFT' && (
            <PermissionGate screen="PURCHASE_GRN" action="EDIT">
              <button
                type="button"
                title="Edit Draft GRN"
                onClick={() => openEditModal(row)}
                className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {/* Submit (Draft -> Submitted) */}
          {row.status === 'DRAFT' && (
            <PermissionGate screen="PURCHASE_GRN" action="SUBMIT">
              <button
                type="button"
                title="Submit for QC Quarantine"
                onClick={() => submitGrnMutation.mutate(row.grnId)}
                className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-md transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {/* Put-Away to Quarantine (Submitted -> QC_IN_PROGRESS) */}
          {['DRAFT', 'SUBMITTED'].includes(row.status) && (
            <PermissionGate screen="PURCHASE_GRN" action="EDIT">
              <button
                type="button"
                title="Quarantine Put-Away & Batch Logging"
                onClick={async () => {
                  const res = await apiClient.get<ApiResponse<GrnHeaderRecord>>(
                    `/procurement/grn/${row.grnId}`,
                  );
                  setQuarantineTarget(res.data.data);
                  setQuarantineRemarks('');
                  setQuarantineBinId('');
                  setIsQuarantineModalOpen(true);
                }}
                className="p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-md transition-colors"
              >
                <Layers className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {/* Store Approval (QC_IN_PROGRESS / SUBMITTED -> APPROVED) */}
          {['SUBMITTED', 'QC_IN_PROGRESS'].includes(row.status) && (
            <PermissionGate screen="PURCHASE_GRN" action="APPROVE">
              <button
                type="button"
                title="Store Inward Clearance & PO Put-Away"
                onClick={async () => {
                  const res = await apiClient.get<ApiResponse<GrnHeaderRecord>>(
                    `/procurement/grn/${row.grnId}`,
                  );
                  const full = res.data.data;
                  setApproveTarget(full);
                  setApprovalRemarks('');
                  const initBins: Record<
                    number,
                    { storageBinId?: number; acceptedQty: number; rejectedQty: number }
                  > = {};
                  full.items?.forEach((it) => {
                    initBins[it.grnItemId!] = {
                      storageBinId: it.storageBinId || undefined,
                      acceptedQty: it.receivedQty,
                      rejectedQty: 0,
                    };
                  });
                  setApprovalBinAssignments(initBins);
                  setIsApproveModalOpen(true);
                }}
                className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-md transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {/* Cancel */}
          {row.status !== 'CANCELLED' && (
            <PermissionGate screen="PURCHASE_GRN" action="CANCEL">
              <button
                type="button"
                title="Cancel / Void GRN"
                onClick={() => {
                  setCancelTarget(row);
                  setCancelReason('');
                  setIsCancelModalOpen(true);
                }}
                className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-colors"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {/* Delete (DRAFT only) */}
          {row.status === 'DRAFT' && (
            <PermissionGate screen="PURCHASE_GRN" action="DELETE">
              <button
                type="button"
                title="Permanently Delete Draft GRN"
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

  // Group By options
  const groupByOptions: GroupByOption<GrnHeaderRecord>[] = [
    { label: 'Status', key: 'status', groupValue: (r) => r.status },
    { label: 'Plant Warehouse', key: 'warehouseName', groupValue: (r) => r.warehouseName },
    { label: 'Supplier / Vendor', key: 'vendorName', groupValue: (r) => r.vendorName },
  ];

  const searchPredicate = (row: GrnHeaderRecord, query: string): boolean => {
    const q = query.toLowerCase();
    return Boolean(
      row.grnNo.toLowerCase().includes(q) ||
      row.vendorName.toLowerCase().includes(q) ||
      (row.vendorCode && row.vendorCode.toLowerCase().includes(q)) ||
      row.challanNo.toLowerCase().includes(q) ||
      (row.vehicleNo && row.vehicleNo.toLowerCase().includes(q)) ||
      (row.poNo && row.poNo.toLowerCase().includes(q)) ||
      (row.gateInwardNo && row.gateInwardNo.toLowerCase().includes(q)) ||
      (row.invoiceNo && row.invoiceNo.toLowerCase().includes(q))
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
              <FileCheck2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Goods Receipt Note (GRN) & Quarantine Put-Away
                </h1>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wide uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                  Live
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Physical dock verification, shortage/excess logging, quarantine staging bay put-away, and PO auto-sync.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <PermissionGate screen="PURCHASE_GRN" action="ADD">
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm shadow hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create GRN Indent</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total GRNs */}
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total GRNs Logged
            </span>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {isSummaryLoading ? '...' : summary?.totalGrns || 0}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <span>{summary?.draftCount || 0} Draft Indents</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: QC / Staging Pending */}
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Quarantine / QC Hold
            </span>
            <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
              {isSummaryLoading ? '...' : summary?.qcPendingCount || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              Awaiting metallurgy / CMM test
            </div>
          </div>
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Cleared & Approved */}
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Store Approved & Cleared
            </span>
            <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {isSummaryLoading ? '...' : summary?.approvedCount || 0}
            </div>
            <div className="text-xs text-muted-foreground">
              Put-away into bin inventory
            </div>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Total Receipt Valuation */}
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Receipt Valuation (INR)
            </span>
            <div className="text-xl font-bold tracking-tight text-blue-600 dark:text-blue-400 font-mono">
              {isSummaryLoading
                ? '...'
                : formatCurrencyINR(summary?.totalReceivedValuation)}
            </div>
            <div className="text-xs text-muted-foreground">
              Cumulative active inward stock
            </div>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Scale className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Filter Bar */}
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
              <option value="DRAFT">Draft Indent</option>
              <option value="SUBMITTED">Submitted for QC</option>
              <option value="QC_IN_PROGRESS">Quarantine Inspection</option>
              <option value="APPROVED">Stores Cleared</option>
              <option value="CANCELLED">Voided / Cancelled</option>
            </select>
          </div>

          {/* Warehouse Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Warehouse:</span>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="text-xs rounded-md border border-input bg-background px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Warehouses</option>
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
            warehouseFilter !== 'ALL' ||
            vendorFilter !== 'ALL' ||
            globalSearch) && (
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
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
      <MasterDataTable<GrnHeaderRecord>
        title="Goods Receipt Notes (GRN)"
        subtitle="Physical dock verification, shortage/excess logging, quarantine staging bay put-away, and PO auto-sync"
        screenCode="PURCHASE_GRN"
        tableNameBadge="Live"
        data={grns}
        columns={columns}
        isLoading={isListLoading}
        rowKey={(row) => row.grnId}
        searchPredicate={searchPredicate}
        groupByOptions={groupByOptions}
        addButtonLabel="New GRN Indent"
        onAddClick={openCreateModal}
        onExportClick={() => {
          // Export basic CSV
          const headers = [
            'GRN No',
            'Date',
            'Warehouse',
            'Vendor',
            'PO No',
            'Gate Inward No',
            'Challan No',
            'Vehicle No',
            'Status',
            'Received Amount (INR)',
          ];
          const rows = grns.map((g) => [
            g.grnNo,
            g.grnDate,
            `"${g.warehouseName}"`,
            `"${g.vendorName}"`,
            g.poNo || '',
            g.gateInwardNo || '',
            g.challanNo,
            g.vehicleNo || '',
            g.status,
            g.totalReceivedAmount,
          ]);
          const csvContent =
            'data:text/csv;charset=utf-8,' +
            [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement('a');
          link.setAttribute('href', encodedUri);
          link.setAttribute(
            'download',
            `GRN_Register_${new Date().toISOString().split('T')[0]}.csv`,
          );
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }}
      />

      {/* ==================================================================== */}
      {/* 5. CREATE / EDIT GRN MODAL                                           */}
      {/* ==================================================================== */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in-50">
            {/* Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">
                  {editingGrn ? `Edit GRN: ${editingGrn.grnNo}` : 'Create New Goods Receipt Note (GRN)'}
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
            <form onSubmit={handleSaveGrn} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Quick Sourcing Accelerator */}
              {!editingGrn && (
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                    <Truck className="w-4 h-4" />
                    <span>Quick Accelerator: Populate from Security Gate Inward or PO</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">
                        Select Pending Gate Inward Consignment:
                      </label>
                      <select
                        value={formGateInwardId}
                        onChange={(e) =>
                          e.target.value
                            ? handleSelectPendingGateInward(Number(e.target.value))
                            : setFormGateInwardId('')
                        }
                        className="w-full text-xs rounded-md border border-input bg-background p-2"
                      >
                        <option value="">-- Manual Entry / No Gate Inward --</option>
                        {pendingGateInwards.map((g) => (
                          <option key={g.gateInwardId} value={g.gateInwardId}>
                            {g.gateInwardNo} • {g.vendorName} (Ch: {g.challanNo})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-foreground block mb-1">
                        Or Link directly to Approved Purchase Order:
                      </label>
                      <select
                        value={formPoId}
                        onChange={(e) =>
                          e.target.value
                            ? handleSelectApprovedPo(Number(e.target.value))
                            : setFormPoId('')
                        }
                        className="w-full text-xs rounded-md border border-input bg-background p-2"
                      >
                        <option value="">-- No Direct PO Link --</option>
                        {approvedPos.map((p) => (
                          <option key={p.poId} value={p.poId}>
                            {p.poNo} • {p.vendorName} ({formatCurrencyINR(p.totalAmount)})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    GRN Number <span className="text-muted-foreground text-[10px]">(Auto if blank)</span>
                  </label>
                  <input
                    type="text"
                    value={formGrnNo}
                    onChange={(e) => setFormGrnNo(e.target.value)}
                    placeholder="e.g. GRN-AHM-2627-0001"
                    className="w-full text-xs rounded-md border border-input bg-background p-2 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    GRN Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formGrnDate}
                    onChange={(e) => setFormGrnDate(e.target.value)}
                    className="w-full text-xs rounded-md border border-input bg-background p-2"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Receiving Warehouse <span className="text-destructive">*</span>
                  </label>
                  <select
                    required
                    value={formWarehouseId}
                    onChange={(e) => setFormWarehouseId(Number(e.target.value))}
                    className="w-full text-xs rounded-md border border-input bg-background p-2"
                  >
                    <option value="">Select Warehouse</option>
                    {warehouses.map((w) => (
                      <option key={w.warehouseId} value={w.warehouseId}>
                        {w.warehouseName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Supplier / Vendor <span className="text-destructive">*</span>
                  </label>
                  <select
                    required
                    value={formVendorId}
                    onChange={(e) => setFormVendorId(Number(e.target.value))}
                    className="w-full text-xs rounded-md border border-input bg-background p-2"
                  >
                    <option value="">Select Vendor</option>
                    {suppliers.map((s) => (
                      <option key={s.partyId} value={s.partyId}>
                        {s.partyName} ({s.partyCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Challan Number <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formChallanNo}
                    onChange={(e) => setFormChallanNo(e.target.value)}
                    placeholder="Supplier Delivery Challan"
                    className="w-full text-xs rounded-md border border-input bg-background p-2"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Challan Date <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formChallanDate}
                    onChange={(e) => setFormChallanDate(e.target.value)}
                    className="w-full text-xs rounded-md border border-input bg-background p-2"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Tax Invoice No
                  </label>
                  <input
                    type="text"
                    value={formInvoiceNo}
                    onChange={(e) => setFormInvoiceNo(e.target.value)}
                    placeholder="e.g. INV-2026-901"
                    className="w-full text-xs rounded-md border border-input bg-background p-2"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Vehicle Number
                  </label>
                  <input
                    type="text"
                    value={formVehicleNo}
                    onChange={(e) => setFormVehicleNo(e.target.value)}
                    placeholder="e.g. GJ-01-BX-4421"
                    className="w-full text-xs rounded-md border border-input bg-background p-2 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    E-Way Bill No
                  </label>
                  <input
                    type="text"
                    value={formEwayBillNo}
                    onChange={(e) => setFormEwayBillNo(e.target.value)}
                    placeholder="12-digit eway bill"
                    className="w-full text-xs rounded-md border border-input bg-background p-2 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground block mb-1">
                    LR / Consignment No
                  </label>
                  <input
                    type="text"
                    value={formLrNo}
                    onChange={(e) => setFormLrNo(e.target.value)}
                    placeholder="Lorry receipt #"
                    className="w-full text-xs rounded-md border border-input bg-background p-2"
                  />
                </div>

                <div className="lg:col-span-2">
                  <label className="text-xs font-medium text-foreground block mb-1">
                    Store Receiving Remarks
                  </label>
                  <input
                    type="text"
                    value={formStoreRemarks}
                    onChange={(e) => setFormStoreRemarks(e.target.value)}
                    placeholder="Damage inspection, seal verification, unloading bay notes..."
                    className="w-full text-xs rounded-md border border-input bg-background p-2"
                  />
                </div>
              </div>

              {/* Line Items Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    <span>Received Material Line Items</span>
                    <span className="text-xs font-normal text-muted-foreground">
                      ({formItems.length} lines)
                    </span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-secondary text-secondary-foreground text-xs font-medium hover:bg-secondary/80"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item Line</span>
                  </button>
                </div>

                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px] tracking-wider border-b">
                      <tr>
                        <th className="px-3 py-2 w-10 text-center">#</th>
                        <th className="px-3 py-2 min-w-[200px]">Item Description</th>
                        <th className="px-3 py-2 w-24">UOM</th>
                        <th className="px-3 py-2 w-24 text-right">Challan Qty</th>
                        <th className="px-3 py-2 w-24 text-right">Received Qty</th>
                        <th className="px-3 py-2 w-20 text-right">Variance</th>
                        <th className="px-3 py-2 w-28 text-right">Unit Rate (₹)</th>
                        <th className="px-3 py-2 w-28 text-right">Amount (₹)</th>
                        <th className="px-3 py-2 min-w-[140px]">Batch / Heat No</th>
                        <th className="px-3 py-2 w-20 text-center">QC Req.</th>
                        <th className="px-3 py-2 w-12 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {formItems.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="text-center py-6 text-muted-foreground">
                            No line items added yet. Click &quot;Add Item Line&quot; or select a Gate Inward / PO above.
                          </td>
                        </tr>
                      ) : (
                        formItems.map((item, idx) => {
                          const shortage = Math.max(0, Number(item.challanQty || 0) - Number(item.receivedQty || 0));
                          const excess = Math.max(0, Number(item.receivedQty || 0) - Number(item.challanQty || 0));
                          return (
                            <tr key={idx} className="hover:bg-muted/30">
                              <td className="px-3 py-2 text-center font-mono text-[11px] text-muted-foreground">
                                {idx + 1}
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={item.itemId}
                                  onChange={(e) => {
                                    const itId = Number(e.target.value);
                                    const opt = itemsCatalog.find((x) => x.itemId === itId);
                                    handleUpdateItemRow(idx, {
                                      itemId: itId,
                                      itemCode: opt?.itemCode,
                                      itemDescription: opt?.itemName,
                                      uomId: opt?.baseUomId || item.uomId,
                                      unitRate: opt?.purchaseRate || opt?.standardCost || item.unitRate,
                                    });
                                  }}
                                  className="w-full text-xs rounded border border-input bg-background p-1.5"
                                >
                                  {itemsCatalog.map((cat) => (
                                    <option key={cat.itemId} value={cat.itemId}>
                                      {cat.itemCode} - {cat.itemName}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  placeholder="Specs / Drawing note"
                                  value={item.itemDescription || ''}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, { itemDescription: e.target.value })
                                  }
                                  className="w-full text-[11px] rounded border border-input bg-background px-1.5 py-0.5 mt-1 text-muted-foreground"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  value={item.uomId}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, { uomId: Number(e.target.value) })
                                  }
                                  className="w-full text-xs rounded border border-input bg-background p-1.5"
                                >
                                  {uomsCatalog.map((u) => (
                                    <option key={u.uomId} value={u.uomId}>
                                      {u.uomCode}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  value={item.challanQty}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, {
                                      challanQty: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-full text-xs rounded border border-input bg-background p-1.5 text-right font-mono"
                                />
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  value={item.receivedQty}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, {
                                      receivedQty: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-full text-xs rounded border border-input bg-background p-1.5 text-right font-mono font-bold text-primary"
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-mono text-[11px]">
                                {shortage > 0 && (
                                  <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                    -{shortage}
                                  </span>
                                )}
                                {excess > 0 && (
                                  <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                    +{excess}
                                  </span>
                                )}
                                {shortage === 0 && excess === 0 && (
                                  <span className="text-muted-foreground">0</span>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  step="0.0001"
                                  min="0"
                                  value={item.unitRate}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, {
                                      unitRate: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-full text-xs rounded border border-input bg-background p-1.5 text-right font-mono"
                                />
                              </td>
                              <td className="px-3 py-2 text-right font-mono font-semibold text-foreground">
                                {formatCurrencyINR(
                                  Number(item.receivedQty || 0) * Number(item.unitRate || 0),
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  placeholder="Melt/Heat/Batch"
                                  value={item.batchNo || ''}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, { batchNo: e.target.value })
                                  }
                                  className="w-full text-xs rounded border border-input bg-background p-1.5 font-mono"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={item.isQcRequired}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, { isQcRequired: e.target.checked })
                                  }
                                  className="rounded border-input text-primary focus:ring-primary w-4 h-4"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemRow(idx)}
                                  className="p-1 text-muted-foreground hover:text-destructive rounded"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                    {formItems.length > 0 && (
                      <tfoot className="bg-muted/40 font-semibold text-foreground border-t">
                        <tr>
                          <td colSpan={7} className="px-3 py-2 text-right">
                            Total Received Valuation:
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-primary text-sm">
                            {formatCurrencyINR(totalCalculatedFormValuation)}
                          </td>
                          <td colSpan={3}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="pt-4 border-t flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  * Note: Submitting saves GRN in DRAFT. You can immediately route to QC inspection.
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
                    disabled={createGrnMutation.isPending || updateGrnMutation.isPending}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingGrn ? 'Update GRN Indent' : 'Save GRN Indent'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. QUARANTINE PUT-AWAY & QC MODAL                                    */}
      {/* ==================================================================== */}
      {isQuarantineModalOpen && quarantineTarget && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in fade-in-50">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Layers className="w-5 h-5" />
                <h2 className="text-lg font-bold text-foreground">
                  Quarantine Staging Put-Away ({quarantineTarget.grnNo})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsQuarantineModalOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                putAwayMutation.mutate({
                  id: quarantineTarget.grnId,
                  payload: {
                    quarantineBinId: quarantineBinId ? Number(quarantineBinId) : undefined,
                    inspectionRemarks: quarantineRemarks,
                  },
                });
              }}
              className="p-6 space-y-4"
            >
              <p className="text-xs text-muted-foreground">
                Move inward materials into dedicated metallurgy inspection quarantine staging cages.
                This sets GRN status to <strong className="text-amber-600">QC_IN_PROGRESS</strong>.
              </p>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Select Quarantine / Receiving Staging Bin:
                </label>
                <select
                  value={quarantineBinId}
                  onChange={(e) => setQuarantineBinId(Number(e.target.value))}
                  className="w-full text-xs rounded-md border border-input bg-background p-2"
                >
                  <option value="">-- Auto-Assign Default Quarantine Bay --</option>
                  {storageBins.map((b) => (
                    <option key={b.binId} value={b.binId}>
                      {b.binCode} - {b.binName} ({b.binType})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Initial Visual & Metallurgy Inspection Remarks:
                </label>
                <textarea
                  rows={3}
                  value={quarantineRemarks}
                  onChange={(e) => setQuarantineRemarks(e.target.value)}
                  placeholder="e.g. Test coupons cut for tensile spectro test. Placed in Cage 01."
                  className="w-full text-xs rounded-md border border-input bg-background p-2.5"
                />
              </div>

              <div className="pt-3 border-t flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsQuarantineModalOpen(false)}
                  className="px-4 py-2 rounded-lg border text-xs font-medium hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={putAwayMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm Quarantine Put-Away</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. STORE APPROVAL & PO SYNC MODAL                                    */}
      {/* ==================================================================== */}
      {isApproveModalOpen && approveTarget && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in-50">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <h2 className="text-lg font-bold text-foreground">
                  Final Store Inward Approval & PO Update ({approveTarget.grnNo})
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
                  const assignment = approvalBinAssignments[it.grnItemId!] || {
                    acceptedQty: it.receivedQty,
                    rejectedQty: 0,
                  };
                  return {
                    grnItemId: it.grnItemId!,
                    acceptedQty: Number(assignment.acceptedQty),
                    rejectedQty: Number(assignment.rejectedQty),
                    storageBinId: assignment.storageBinId || it.storageBinId || undefined,
                  };
                });
                approveGrnMutation.mutate({
                  id: approveTarget.grnId,
                  payload: {
                    approvalRemarks,
                    items: itemsPayload,
                  },
                });
              }}
              className="flex-1 overflow-y-auto p-6 space-y-4"
            >
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
                Approving this GRN marks items as accepted in plant inventory, automatically increments
                received quantities on Purchase Order <strong>{approveTarget.poNo || 'N/A'}</strong>, and
                completes Security Gate Entry <strong>{approveTarget.gateInwardNo || 'N/A'}</strong>.
              </div>

              {/* Items disposition table */}
              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted text-muted-foreground text-[10px] uppercase font-semibold">
                    <tr>
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2 text-right">Received</th>
                      <th className="px-3 py-2 text-right w-24">Accepted Qty</th>
                      <th className="px-3 py-2 text-right w-24">Rejected Qty</th>
                      <th className="px-3 py-2 min-w-[160px]">Put-Away Storage Bin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {(approveTarget.items || []).map((it) => {
                      const cur = approvalBinAssignments[it.grnItemId!] || {
                        acceptedQty: it.receivedQty,
                        rejectedQty: 0,
                      };
                      return (
                        <tr key={it.grnItemId}>
                          <td className="px-3 py-2">
                            <span className="font-medium text-foreground block">
                              {it.itemCode}
                            </span>
                            <span className="text-[11px] text-muted-foreground">
                              {it.itemDescription}
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
                                setApprovalBinAssignments((prev) => ({
                                  ...prev,
                                  [it.grnItemId!]: {
                                    ...prev[it.grnItemId!],
                                    acceptedQty: val,
                                    rejectedQty: Math.max(0, it.receivedQty - val),
                                  },
                                }));
                              }}
                              className="w-full text-xs rounded border border-input bg-background p-1 text-right font-mono"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              step="0.001"
                              value={cur.rejectedQty}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0;
                                setApprovalBinAssignments((prev) => ({
                                  ...prev,
                                  [it.grnItemId!]: {
                                    ...prev[it.grnItemId!],
                                    rejectedQty: val,
                                    acceptedQty: Math.max(0, it.receivedQty - val),
                                  },
                                }));
                              }}
                              className="w-full text-xs rounded border border-input bg-background p-1 text-right font-mono text-rose-600"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <select
                              value={cur.storageBinId || ''}
                              onChange={(e) => {
                                const binId = Number(e.target.value);
                                setApprovalBinAssignments((prev) => ({
                                  ...prev,
                                  [it.grnItemId!]: {
                                    ...prev[it.grnItemId!],
                                    storageBinId: binId || undefined,
                                  },
                                }));
                              }}
                              className="w-full text-xs rounded border border-input bg-background p-1"
                            >
                              <option value="">-- Warehouse Default Bin --</option>
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

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Store Approval Sign-Off Remarks:
                </label>
                <input
                  type="text"
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  placeholder="e.g. Mill test certificate verified. Material cleared for production consumption."
                  className="w-full text-xs rounded-md border border-input bg-background p-2"
                />
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
                  disabled={approveGrnMutation.isPending}
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Approve & Update PO</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 8. CANCEL GRN MODAL                                                  */}
      {/* ==================================================================== */}
      {isCancelModalOpen && cancelTarget && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in-50">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2 text-rose-600">
                <XCircle className="w-5 h-5" />
                <h2 className="text-lg font-bold text-foreground">
                  Cancel GRN ({cancelTarget.grnNo})
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
                  alert('Please enter a cancellation reason.');
                  return;
                }
                cancelGrnMutation.mutate({
                  id: cancelTarget.grnId,
                  reason: cancelReason,
                });
              }}
              className="p-6 space-y-4"
            >
              <p className="text-xs text-muted-foreground">
                Cancelling this GRN voids receipt confirmation and rolls back any PO received balances.
              </p>

              <div>
                <label className="text-xs font-medium text-foreground block mb-1">
                  Cancellation Reason <span className="text-destructive">*</span>
                </label>
                <textarea
                  rows={3}
                  required
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Explain why this GRN is being cancelled..."
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
                  disabled={cancelGrnMutation.isPending}
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
      {/* 9. DETAILS & INSPECTION DRAWER                                       */}
      {/* ==================================================================== */}
      {isDetailOpen && selectedGrn && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-card border-l h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-50">
            {/* Drawer Header */}
            <div className="p-6 border-b flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {selectedGrn.grnNo}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Goods Receipt Note Details
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDetailOpen(false);
                    openPrintModal(selectedGrn);
                  }}
                  className="p-1.5 rounded-md text-muted-foreground hover:bg-muted"
                  title="Print Voucher"
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

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Status Badge & Valuation */}
              <div className="p-4 rounded-xl border bg-muted/20 flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Current Workflow Status
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold mt-1 border ${
                      STATUS_CONFIG[selectedGrn.status]?.bg
                    } ${STATUS_CONFIG[selectedGrn.status]?.text} ${
                      STATUS_CONFIG[selectedGrn.status]?.border
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        STATUS_CONFIG[selectedGrn.status]?.dot
                      }`}
                    />
                    {STATUS_CONFIG[selectedGrn.status]?.label}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground block">
                    Total Valuation
                  </span>
                  <span className="text-xl font-bold font-mono text-primary">
                    {formatCurrencyINR(selectedGrn.totalReceivedAmount)}
                  </span>
                </div>
              </div>

              {/* Vendor & Logistics Section */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-1">
                  <span className="text-muted-foreground block">Supplier Name</span>
                  <span className="font-semibold text-foreground">
                    {selectedGrn.vendorName} ({selectedGrn.vendorCode})
                  </span>
                  {selectedGrn.vendorGstin && (
                    <span className="text-[11px] text-muted-foreground block">
                      GSTIN: {selectedGrn.vendorGstin}
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block">Receiving Plant</span>
                  <span className="font-semibold text-foreground">
                    {selectedGrn.warehouseName}
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block">Delivery Challan</span>
                  <span className="font-mono text-foreground font-medium">
                    {selectedGrn.challanNo} (Dt: {selectedGrn.challanDate})
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground block">Vehicle & Transport</span>
                  <span className="font-mono text-foreground font-medium">
                    {selectedGrn.vehicleNo || 'N/A'}
                  </span>
                </div>
                {selectedGrn.poNo && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground block">Purchase Order</span>
                    <span className="font-mono text-primary font-semibold">
                      {selectedGrn.poNo}
                    </span>
                  </div>
                )}
                {selectedGrn.gateInwardNo && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground block">Gate Security Entry</span>
                    <span className="font-mono text-indigo-600 font-semibold">
                      {selectedGrn.gateInwardNo}
                    </span>
                  </div>
                )}
              </div>

              {/* Remarks */}
              {selectedGrn.storeRemarks && (
                <div className="p-3 rounded-lg border bg-muted/10 text-xs">
                  <span className="font-medium text-foreground block mb-0.5">
                    Store Receiving Remarks:
                  </span>
                  <p className="text-muted-foreground">{selectedGrn.storeRemarks}</p>
                </div>
              )}

              {/* QC / Approval Signatures */}
              <div className="grid grid-cols-2 gap-4 text-xs p-3 rounded-lg border bg-muted/20">
                <div>
                  <span className="text-muted-foreground block">Inspected By</span>
                  <span className="font-medium text-foreground">
                    {selectedGrn.inspectedByName || 'Pending QC'}
                  </span>
                  {selectedGrn.inspectionDate && (
                    <span className="text-[11px] text-muted-foreground block">
                      {selectedGrn.inspectionDate}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block">Approved By</span>
                  <span className="font-medium text-foreground">
                    {selectedGrn.approvedByName || 'Pending Clearance'}
                  </span>
                  {selectedGrn.approvalDate && (
                    <span className="text-[11px] text-muted-foreground block">
                      {selectedGrn.approvalDate}
                    </span>
                  )}
                </div>
              </div>

              {/* Line Items List */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Line Items & Storage Bins
                </h3>
                <div className="border rounded-lg divide-y text-xs">
                  {(selectedGrn.items || []).map((it, i) => (
                    <div key={i} className="p-3 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">
                          {it.itemCode} - {it.itemDescription}
                        </span>
                        <span className="font-mono font-bold text-primary">
                          {formatCurrencyINR(it.receivedAmount)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>
                          Challan: {it.challanQty} {it.uomCode}
                        </span>
                        <span>•</span>
                        <span className="font-semibold text-foreground">
                          Received: {it.receivedQty} {it.uomCode}
                        </span>
                        <span>•</span>
                        <span>Rate: ₹{it.unitRate}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {it.batchNo && (
                          <span className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">
                            Batch: {it.batchNo}
                          </span>
                        )}
                        {it.quarantineBinCode && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px]">
                            QC Bay: {it.quarantineBinCode}
                          </span>
                        )}
                        {it.storageBinCode && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px]">
                            Bin: {it.storageBinCode}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 10. OFFICIAL PRINTABLE GRN VOUCHER MODAL                             */}
      {/* ==================================================================== */}
      {isPrintModalOpen && printTarget && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white text-slate-900 border rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden">
            {/* Action Bar */}
            <div className="p-4 border-b flex items-center justify-between bg-slate-100 print:hidden">
              <span className="font-bold text-sm text-slate-800 flex items-center gap-2">
                <Printer className="w-4 h-4 text-primary" />
                Goods Receipt Note Voucher Preview
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Document</span>
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

            {/* Printable Document Sheet */}
            <div className="flex-1 overflow-y-auto p-8 font-sans print:p-0">
              <div className="border border-slate-300 rounded-lg p-6 space-y-6">
                {/* Enterprise Header */}
                <div className="flex items-start justify-between border-b pb-4">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900 uppercase">
                      Kashvira Engineering &amp; Manufacturing Ltd.
                    </h1>
                    <p className="text-xs text-slate-600">
                      Sanand Industrial Park, Plot 42-A, Ahmedabad, Gujarat — 382110
                    </p>
                    <p className="text-xs text-slate-600">
                      GSTIN: 24AAACK1928E1Z4 • CIN: U28100GJ2026PLC098122
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold px-2 py-1 bg-slate-200 rounded uppercase tracking-wider text-slate-800">
                      GOODS RECEIPT NOTE (GRN)
                    </span>
                    <div className="font-mono font-bold text-base text-slate-900 mt-1">
                      {printTarget.grnNo}
                    </div>
                    <div className="text-xs text-slate-600">
                      Date: {printTarget.grnDate}
                    </div>
                  </div>
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-2 gap-4 text-xs border p-3 rounded bg-slate-50">
                  <div>
                    <span className="text-slate-500 uppercase font-semibold text-[10px] block">
                      SUPPLIER / VENDOR DETAILS:
                    </span>
                    <div className="font-bold text-slate-900 text-sm">
                      {printTarget.vendorName}
                    </div>
                    <div className="text-slate-700">Code: {printTarget.vendorCode}</div>
                    {printTarget.vendorGstin && (
                      <div className="text-slate-700">GSTIN: {printTarget.vendorGstin}</div>
                    )}
                    {printTarget.vendorAddress && (
                      <div className="text-slate-600">{printTarget.vendorAddress}</div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-500 uppercase font-semibold text-[10px] block">
                      DELIVERY &amp; SOURCING REFERENCES:
                    </span>
                    <div><strong>Warehouse:</strong> {printTarget.warehouseName}</div>
                    <div><strong>Challan No &amp; Dt:</strong> {printTarget.challanNo} ({printTarget.challanDate})</div>
                    <div><strong>Vehicle No:</strong> {printTarget.vehicleNo || 'N/A'}</div>
                    {printTarget.poNo && <div><strong>PO Number:</strong> {printTarget.poNo}</div>}
                    {printTarget.gateInwardNo && <div><strong>Gate Entry No:</strong> {printTarget.gateInwardNo}</div>}
                    {printTarget.lrNo && <div><strong>LR No:</strong> {printTarget.lrNo}</div>}
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full text-xs text-left border-collapse border border-slate-300">
                  <thead className="bg-slate-100 text-slate-800 font-semibold uppercase text-[10px]">
                    <tr>
                      <th className="border p-2 w-8 text-center">#</th>
                      <th className="border p-2">Item Description</th>
                      <th className="border p-2 w-16 text-center">UOM</th>
                      <th className="border p-2 w-20 text-right">Challan Qty</th>
                      <th className="border p-2 w-20 text-right">Received Qty</th>
                      <th className="border p-2 w-24 text-right">Unit Rate (₹)</th>
                      <th className="border p-2 w-28 text-right">Amount (₹)</th>
                      <th className="border p-2 min-w-[120px]">Batch / Bin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(printTarget.items || []).map((it, idx) => (
                      <tr key={idx} className="border">
                        <td className="border p-2 text-center font-mono">{idx + 1}</td>
                        <td className="border p-2">
                          <div className="font-semibold">{it.itemCode}</div>
                          <div className="text-[11px] text-slate-600">{it.itemDescription}</div>
                        </td>
                        <td className="border p-2 text-center font-mono">{it.uomCode}</td>
                        <td className="border p-2 text-right font-mono">{it.challanQty}</td>
                        <td className="border p-2 text-right font-mono font-bold">
                          {it.receivedQty}
                        </td>
                        <td className="border p-2 text-right font-mono">{it.unitRate}</td>
                        <td className="border p-2 text-right font-mono font-bold">
                          {formatCurrencyINR(it.receivedAmount)}
                        </td>
                        <td className="border p-2 text-[11px]">
                          {it.batchNo && <div>Batch: {it.batchNo}</div>}
                          {it.storageBinCode && <div>Bin: {it.storageBinCode}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold">
                      <td colSpan={6} className="border p-2 text-right uppercase">
                        Total Inward Material Value:
                      </td>
                      <td className="border p-2 text-right font-mono text-slate-900">
                        {formatCurrencyINR(printTarget.totalReceivedAmount)}
                      </td>
                      <td className="border p-2"></td>
                    </tr>
                  </tfoot>
                </table>

                {/* Remarks & Signatures */}
                <div className="pt-4 border-t space-y-6">
                  {printTarget.storeRemarks && (
                    <div className="text-xs text-slate-600">
                      <strong>Remarks:</strong> {printTarget.storeRemarks}
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-6 text-center text-xs pt-8">
                    <div className="border-t border-slate-400 pt-2">
                      <div className="font-semibold text-slate-800">Prepared By</div>
                      <div className="text-[10px] text-slate-500">Receiving Clerk / Unloader</div>
                    </div>
                    <div className="border-t border-slate-400 pt-2">
                      <div className="font-semibold text-slate-800">
                        {printTarget.inspectedByName || 'Metallurgy Inspector'}
                      </div>
                      <div className="text-[10px] text-slate-500">QC &amp; Quarantine Inspector</div>
                    </div>
                    <div className="border-t border-slate-400 pt-2">
                      <div className="font-semibold text-slate-800">
                        {printTarget.approvedByName || 'Store Manager'}
                      </div>
                      <div className="text-[10px] text-slate-500">Authorized Stores In-Charge</div>
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
          entityType="Goods Receipt Note"
          entityName={deleteTarget.grnNo}
          entityCode={deleteTarget.grnNo}
          errorMessage={deleteErrorMessage}
          dependencies={deleteConflicts}
          isDeleting={deleteGrnMutation.isPending}
          onConfirm={() => deleteGrnMutation.mutate(deleteTarget.grnId)}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
};

export default GrnMasterPage;
