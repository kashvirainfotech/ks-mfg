import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Award,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSpreadsheet,
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

export type PoStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'RELEASED'
  | 'CLOSED'
  | 'CANCELLED';

export type PoType =
  | 'STANDARD'
  | 'BLANKET'
  | 'SUBCONTRACTING'
  | 'SERVICE'
  | 'CAPITAL_EXPENDITURE';

export interface PurchaseOrderItemRecord {
  poItemId?: number;
  poId?: number;
  prItemId?: number | null;
  prNo?: string | null;
  rfqItemId?: number | null;
  rfqNo?: string | null;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  itemType?: string;
  itemDescription?: string;
  uomId: number;
  uomCode?: string;
  uomName?: string;
  orderedQty: number;
  receivedQty?: number;
  rejectedQty?: number;
  unitRate: number;
  discountPct: number;
  discountAmount?: number;
  taxPct: number;
  taxAmount?: number;
  grossAmount?: number;
  netAmount?: number;
  deliveryDate?: string | null;
  remarks?: string | null;
  isActive?: boolean;
}

export interface PurchaseOrderHeaderRecord {
  poId: number;
  poNo: string;
  poDate: string;
  expectedDeliveryDate: string;
  vendorId: number;
  vendorCode: string;
  vendorName: string;
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  poType: PoType;
  status: PoStatus;
  grossAmount: number;
  discountAmount: number;
  taxAmount: number;
  netAmount: number;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  shippingAddress?: string | null;
  billingAddress?: string | null;
  releaseDate?: string | null;
  releasedBy?: number | null;
  releasedByName?: string | null;
  releaseRemarks?: string | null;
  cancelReason?: string | null;
  remarks?: string | null;
  isActive: boolean;
  createdDate: string;
  itemsCount: number;
  items?: PurchaseOrderItemRecord[];
}

export interface PurchaseOrderSummary {
  totalPos: number;
  pendingReleaseCount: number;
  releasedCount: number;
  totalSpendValue: number;
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
  email?: string;
  phone?: string;
  gstin?: string;
  address?: string;
}

export interface ApprovedPrOption {
  prId: number;
  prNo: string;
  prDate: string;
  itemsCount: number;
  items: {
    prItemId: number;
    itemId: number;
    itemCode: string;
    itemName: string;
    uomId: number;
    uomCode: string;
    approvedQty: number;
    estimatedRate: number;
  }[];
}

export interface AwardedRfqOption {
  rfqId: number;
  rfqNo: string;
  rfqDate: string;
  warehouseId: number;
  warehouseCode?: string;
  warehouseName?: string;
  awardedVendorId: number;
  awardedVendorCode?: string;
  awardedVendorName?: string;
  paymentTerms?: string;
  deliveryTerms?: string;
  items: {
    rfqItemId: number;
    prItemId?: number;
    itemId: number;
    itemCode: string;
    itemName: string;
    uomId: number;
    uomCode: string;
    requiredQty: number;
    targetRate: number;
  }[];
}

const STATUS_BADGE_MAP: Record<
  PoStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  DRAFT: {
    label: 'Draft Order',
    bg: 'bg-muted/80',
    text: 'text-muted-foreground',
    border: 'border-border',
    dot: 'bg-slate-400',
  },
  SUBMITTED: {
    label: 'Pending Release',
    bg: 'bg-amber-500/10 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-300 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  RELEASED: {
    label: 'Commercially Released',
    bg: 'bg-emerald-500/10 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-300 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  CLOSED: {
    label: 'Fulfilled / Closed',
    bg: 'bg-blue-500/10 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-300 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-rose-500/10 dark:bg-rose-950/30',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-300 dark:border-rose-800',
    dot: 'bg-rose-500',
  },
};

const PO_TYPE_LABELS: Record<PoType, string> = {
  STANDARD: 'Standard PO',
  BLANKET: 'Blanket Agreement',
  SUBCONTRACTING: 'Subcontracting Job-Work',
  SERVICE: 'Service PO',
  CAPITAL_EXPENDITURE: 'Capital Asset (CapEx)',
};

const PO_TYPE_COLORS: Record<PoType, string> = {
  STANDARD: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  BLANKET: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  SUBCONTRACTING: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  SERVICE: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-800',
  CAPITAL_EXPENDITURE: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const PurchaseOrderMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [poTypeFilter, setPoTypeFilter] = useState<string>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Modals & Panels State
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingPo, setEditingPo] = useState<PurchaseOrderHeaderRecord | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [selectedPo, setSelectedPo] = useState<PurchaseOrderHeaderRecord | null>(null);

  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState<boolean>(false);
  const [releaseTargetPo, setReleaseTargetPo] = useState<PurchaseOrderHeaderRecord | null>(null);
  const [releaseRemarks, setReleaseRemarks] = useState<string>('');

  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelTargetPo, setCancelTargetPo] = useState<PurchaseOrderHeaderRecord | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printTargetPo, setPrintTargetPo] = useState<PurchaseOrderHeaderRecord | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<PurchaseOrderHeaderRecord | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [deleteConflicts, setDeleteConflicts] = useState<DependencyConflictItem[]>([]);

  // Sourcing Import Drawers
  const [isImportRfqOpen, setIsImportRfqOpen] = useState<boolean>(false);
  const [isImportPrOpen, setIsImportPrOpen] = useState<boolean>(false);

  // Form State
  const [formPoNo, setFormPoNo] = useState<string>('');
  const [formPoDate, setFormPoDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [formDeliveryDate, setFormDeliveryDate] = useState<string>(
    new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
  );
  const [formVendorId, setFormVendorId] = useState<number | ''>('');
  const [formWarehouseId, setFormWarehouseId] = useState<number | ''>('');
  const [formPoType, setFormPoType] = useState<PoType>('STANDARD');
  const [formPaymentTerms, setFormPaymentTerms] = useState<string>('30 Days Net from GRN');
  const [formDeliveryTerms, setFormDeliveryTerms] = useState<string>('FOR Destination Plant');
  const [formShippingAddress, setFormShippingAddress] = useState<string>(
    'Plant 1, Kashvira Mfg Hub, Industrial Zone, Ahmedabad, Gujarat - 382445',
  );
  const [formBillingAddress, setFormBillingAddress] = useState<string>(
    'Kashvira Infotech Pvt Ltd, Corporate Tower, SG Highway, Ahmedabad, Gujarat - 380054',
  );
  const [formRemarks, setFormRemarks] = useState<string>('');
  const [formItems, setFormItems] = useState<PurchaseOrderItemRecord[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // DATA FETCHING
  // --------------------------------------------------------------------------

  // 1. KPI Summary
  const { data: summary, isLoading: isSummaryLoading } = useQuery<PurchaseOrderSummary>({
    queryKey: ['procurement', 'purchase-orders', 'summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PurchaseOrderSummary>>(
        '/procurement/purchase-orders/summary',
      );
      return res.data.data;
    },
  });

  // 2. Purchase Orders Register
  const { data: purchaseOrders = [], isLoading: isPoListLoading } = useQuery<
    PurchaseOrderHeaderRecord[]
  >({
    queryKey: [
      'procurement',
      'purchase-orders',
      'list',
      statusFilter,
      poTypeFilter,
      vendorFilter,
      warehouseFilter,
      globalSearch,
    ],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (poTypeFilter !== 'ALL') params.poType = poTypeFilter;
      if (vendorFilter !== 'ALL') params.vendorId = vendorFilter;
      if (warehouseFilter !== 'ALL') params.warehouseId = warehouseFilter;
      if (globalSearch.trim()) params.search = globalSearch.trim();

      const res = await apiClient.get<ApiResponse<PurchaseOrderHeaderRecord[]>>(
        '/procurement/purchase-orders',
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
        email: p.email,
        phone: p.phone,
        gstin: p.taxNumber || p.gstin || '',
        address: p.addressLine1 ? `${p.addressLine1}, ${p.city || ''}` : '',
      }));
    },
    staleTime: 60_000,
  });

  // Approved PRs for sourcing import
  const { data: approvedPrs = [] } = useQuery<ApprovedPrOption[]>({
    queryKey: ['procurement', 'requisitions', 'approved-for-po'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>(
        '/procurement/requisitions',
        { params: { status: 'APPROVED' } },
      );
      return res.data.data || [];
    },
    staleTime: 30_000,
  });

  // Awarded RFQs for sourcing import
  const { data: awardedRfqs = [] } = useQuery<AwardedRfqOption[]>({
    queryKey: ['procurement', 'rfqs', 'awarded-for-po'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>(
        '/procurement/rfqs',
        { params: { status: 'AWARDED' } },
      );
      return res.data.data || [];
    },
    staleTime: 30_000,
  });

  // --------------------------------------------------------------------------
  // MUTATIONS
  // --------------------------------------------------------------------------

  // Create / Update Purchase Order
  const savePoMutation = useMutation({
    mutationFn: async () => {
      if (!formVendorId) throw new Error('Please select a Supplier/Vendor');
      if (!formWarehouseId) throw new Error('Please select a Receiving Warehouse');
      if (formItems.length === 0)
        throw new Error('Please add at least one line item to the Purchase Order');

      const payload = {
        poNo: formPoNo.trim() || undefined,
        poDate: formPoDate,
        expectedDeliveryDate: formDeliveryDate,
        vendorId: Number(formVendorId),
        warehouseId: Number(formWarehouseId),
        poType: formPoType,
        paymentTerms: formPaymentTerms.trim() || undefined,
        deliveryTerms: formDeliveryTerms.trim() || undefined,
        shippingAddress: formShippingAddress.trim() || undefined,
        billingAddress: formBillingAddress.trim() || undefined,
        remarks: formRemarks.trim() || undefined,
        items: formItems.map((it) => ({
          prItemId: it.prItemId || undefined,
          rfqItemId: it.rfqItemId || undefined,
          itemId: it.itemId,
          itemDescription: it.itemDescription?.trim() || undefined,
          uomId: it.uomId,
          orderedQty: Number(it.orderedQty),
          unitRate: Number(it.unitRate),
          discountPct: Number(it.discountPct) || 0,
          taxPct: Number(it.taxPct) || 0,
          deliveryDate: it.deliveryDate || formDeliveryDate,
          remarks: it.remarks?.trim() || undefined,
        })),
      };

      if (editingPo) {
        const res = await apiClient.put<ApiResponse<PurchaseOrderHeaderRecord>>(
          `/procurement/purchase-orders/${editingPo.poId}`,
          payload,
        );
        return res.data.data;
      } else {
        const res = await apiClient.post<ApiResponse<PurchaseOrderHeaderRecord>>(
          '/procurement/purchase-orders',
          payload,
        );
        return res.data.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['procurement', 'purchase-orders'],
      });
      setIsEditorOpen(false);
      setEditingPo(null);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(
        err.response?.data?.message || err.message || 'Failed to save purchase order',
      );
    },
  });

  // Submit PO
  const submitPoMutation = useMutation({
    mutationFn: async (poId: number) => {
      const res = await apiClient.post<ApiResponse<PurchaseOrderHeaderRecord>>(
        `/procurement/purchase-orders/${poId}/submit`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['procurement', 'purchase-orders'],
      });
      if (selectedPo) {
        handleViewPoDetails(selectedPo.poId);
      }
    },
  });

  // Release PO (Commercial Sign-Off)
  const releasePoMutation = useMutation({
    mutationFn: async ({
      poId,
      releaseRemarks,
    }: {
      poId: number;
      releaseRemarks: string;
    }) => {
      const res = await apiClient.post<ApiResponse<PurchaseOrderHeaderRecord>>(
        `/procurement/purchase-orders/${poId}/release`,
        { releaseRemarks },
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['procurement', 'purchase-orders'],
      });
      setIsReleaseModalOpen(false);
      setReleaseTargetPo(null);
      setReleaseRemarks('');
      if (selectedPo) {
        handleViewPoDetails(selectedPo.poId);
      }
    },
  });

  // Cancel PO
  const cancelPoMutation = useMutation({
    mutationFn: async ({
      poId,
      cancelReason,
    }: {
      poId: number;
      cancelReason: string;
    }) => {
      const res = await apiClient.post<ApiResponse<PurchaseOrderHeaderRecord>>(
        `/procurement/purchase-orders/${poId}/cancel`,
        { cancelReason },
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['procurement', 'purchase-orders'],
      });
      setIsCancelModalOpen(false);
      setCancelTargetPo(null);
      setCancelReason('');
      if (selectedPo) {
        handleViewPoDetails(selectedPo.poId);
      }
    },
  });

  // Delete PO
  const deletePoMutation = useMutation({
    mutationFn: async (poId: number) => {
      await apiClient.delete(`/procurement/purchase-orders/${poId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['procurement', 'purchase-orders'],
      });
      setDeleteTarget(null);
      setDeleteErrorMessage(null);
      setDeleteConflicts([]);
      if (selectedPo && selectedPo.poId === deleteTarget?.poId) {
        setIsDetailOpen(false);
        setSelectedPo(null);
      }
    },
    onError: (err: any) => {
      const data = err.response?.data;
      if (data?.details?.conflicts) {
        setDeleteConflicts(data.details.conflicts);
        setDeleteErrorMessage(data.message || 'Cannot delete purchase order.');
      } else {
        setDeleteErrorMessage(
          data?.message || err.message || 'Failed to delete purchase order',
        );
      }
    },
  });

  // Audit Screen Action Logger
  const logActionMutation = useMutation({
    mutationFn: async (actionType: 'PRINT' | 'EXPORT') => {
      await apiClient.post('/procurement/purchase-orders/actions/log', {
        actionType,
      });
    },
  });

  // --------------------------------------------------------------------------
  // HANDLERS & HELPERS
  // --------------------------------------------------------------------------

  const handleOpenCreateModal = () => {
    setEditingPo(null);
    setFormPoNo('');
    setFormPoDate(new Date().toISOString().split('T')[0]);
    setFormDeliveryDate(
      new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    );
    setFormVendorId(suppliers[0]?.partyId || '');
    setFormWarehouseId(warehouses[0]?.warehouseId || '');
    setFormPoType('STANDARD');
    setFormPaymentTerms('30 Days Net from GRN');
    setFormDeliveryTerms('FOR Destination Plant');
    setFormShippingAddress(
      'Plant 1, Kashvira Mfg Hub, Industrial Zone, Ahmedabad, Gujarat - 382445',
    );
    setFormBillingAddress(
      'Kashvira Infotech Pvt Ltd, Corporate Tower, SG Highway, Ahmedabad, Gujarat - 380054',
    );
    setFormRemarks('');
    setFormItems([]);
    setFormError(null);
    setIsEditorOpen(true);
  };

  const handleOpenEditModal = async (po: PurchaseOrderHeaderRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<PurchaseOrderHeaderRecord>>(
        `/procurement/purchase-orders/${po.poId}`,
      );
      const full = res.data.data;
      setEditingPo(full);
      setFormPoNo(full.poNo);
      setFormPoDate(full.poDate);
      setFormDeliveryDate(full.expectedDeliveryDate);
      setFormVendorId(full.vendorId);
      setFormWarehouseId(full.warehouseId);
      setFormPoType(full.poType);
      setFormPaymentTerms(full.paymentTerms || '30 Days Net from GRN');
      setFormDeliveryTerms(full.deliveryTerms || 'FOR Destination Plant');
      setFormShippingAddress(full.shippingAddress || '');
      setFormBillingAddress(full.billingAddress || '');
      setFormRemarks(full.remarks || '');
      setFormItems(
        (full.items || []).map((it) => ({
          poItemId: it.poItemId,
          prItemId: it.prItemId,
          rfqItemId: it.rfqItemId,
          itemId: it.itemId,
          itemCode: it.itemCode,
          itemName: it.itemName,
          itemType: it.itemType,
          itemDescription: it.itemDescription,
          uomId: it.uomId,
          uomCode: it.uomCode,
          orderedQty: it.orderedQty,
          unitRate: it.unitRate,
          discountPct: it.discountPct,
          taxPct: it.taxPct,
          deliveryDate: it.deliveryDate,
          remarks: it.remarks,
        })),
      );
      setFormError(null);
      setIsEditorOpen(true);
    } catch (err: any) {
      alert('Failed to load purchase order details for editing: ' + err.message);
    }
  };

  const handleViewPoDetails = async (poId: number) => {
    try {
      const res = await apiClient.get<ApiResponse<PurchaseOrderHeaderRecord>>(
        `/procurement/purchase-orders/${poId}`,
      );
      setSelectedPo(res.data.data);
      setIsDetailOpen(true);
    } catch (err: any) {
      alert('Failed to fetch purchase order details: ' + err.message);
    }
  };

  const handleOpenReleaseModal = (po: PurchaseOrderHeaderRecord) => {
    setReleaseTargetPo(po);
    setReleaseRemarks('Commercial verification completed. Approved for supplier release.');
    setIsReleaseModalOpen(true);
  };

  const handleOpenCancelModal = (po: PurchaseOrderHeaderRecord) => {
    setCancelTargetPo(po);
    setCancelReason('');
    setIsCancelModalOpen(true);
  };

  const handleOpenPrintVoucher = async (po: PurchaseOrderHeaderRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<PurchaseOrderHeaderRecord>>(
        `/procurement/purchase-orders/${po.poId}`,
      );
      setPrintTargetPo(res.data.data);
      setIsPrintModalOpen(true);
      logActionMutation.mutate('PRINT');
    } catch (err: any) {
      alert('Failed to prepare purchase order print voucher: ' + err.message);
    }
  };

  // Add Item Line in Form
  const handleAddItemRow = () => {
    const defaultItem = itemsCatalog[0];
    if (!defaultItem) return;

    const defaultUom =
      uomsCatalog.find((u) => u.uomId === defaultItem.baseUomId) || uomsCatalog[0];

    const newItem: PurchaseOrderItemRecord = {
      itemId: defaultItem.itemId,
      itemCode: defaultItem.itemCode,
      itemName: defaultItem.itemName,
      itemType: defaultItem.itemType,
      itemDescription: defaultItem.itemName,
      uomId: defaultUom?.uomId || defaultItem.baseUomId,
      uomCode: defaultUom?.uomCode,
      orderedQty: 10,
      unitRate: defaultItem.purchaseRate || 100,
      discountPct: 0,
      taxPct: 18,
      deliveryDate: formDeliveryDate,
      remarks: '',
    };
    setFormItems([...formItems, newItem]);
  };

  // Update Item Line in Form
  const handleUpdateItemRow = (
    index: number,
    field: keyof PurchaseOrderItemRecord,
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
        item.itemDescription = selected.itemName;
        item.uomId = selected.baseUomId;
        const uomObj = uomsCatalog.find((u) => u.uomId === selected.baseUomId);
        item.uomCode = uomObj?.uomCode;
        item.unitRate = selected.purchaseRate || 0;
      }
    } else if (field === 'uomId') {
      item.uomId = Number(val);
      const uomObj = uomsCatalog.find((u) => u.uomId === Number(val));
      item.uomCode = uomObj?.uomCode;
    } else if (field === 'orderedQty') {
      item.orderedQty = Math.max(0, Number(val));
    } else if (field === 'unitRate') {
      item.unitRate = Math.max(0, Number(val));
    } else if (field === 'discountPct') {
      item.discountPct = Math.max(0, Math.min(100, Number(val)));
    } else if (field === 'taxPct') {
      item.taxPct = Math.max(0, Number(val));
    } else if (field === 'itemDescription') {
      item.itemDescription = String(val);
    } else if (field === 'deliveryDate') {
      item.deliveryDate = String(val);
    } else if (field === 'remarks') {
      item.remarks = String(val);
    }

    // Auto calculate gross, discount, tax, net for preview
    const gross = (Number(item.orderedQty) || 0) * (Number(item.unitRate) || 0);
    const disc = gross * ((Number(item.discountPct) || 0) / 100);
    const taxable = gross - disc;
    const tax = taxable * ((Number(item.taxPct) || 0) / 100);
    const net = taxable + tax;

    item.grossAmount = gross;
    item.discountAmount = disc;
    item.taxAmount = tax;
    item.netAmount = net;

    updated[index] = item;
    setFormItems(updated);
  };

  // Remove Item Line
  const handleRemoveItemRow = (index: number) => {
    setFormItems(formItems.filter((_, idx) => idx !== index));
  };

  // Quick Sourcing: Import Awarded RFQ
  const handleImportRfq = (rfq: AwardedRfqOption) => {
    if (rfq.awardedVendorId) {
      setFormVendorId(rfq.awardedVendorId);
    }
    if (rfq.warehouseId) {
      setFormWarehouseId(rfq.warehouseId);
    }
    if (rfq.paymentTerms) {
      setFormPaymentTerms(rfq.paymentTerms);
    }
    if (rfq.deliveryTerms) {
      setFormDeliveryTerms(rfq.deliveryTerms);
    }

    const importedItems: PurchaseOrderItemRecord[] = (rfq.items || []).map((it) => {
      const gross = it.requiredQty * it.targetRate;
      const tax = gross * 0.18; // Default 18% GST
      return {
        rfqItemId: it.rfqItemId,
        prItemId: it.prItemId,
        itemId: it.itemId,
        itemCode: it.itemCode,
        itemName: it.itemName,
        itemDescription: it.itemName,
        uomId: it.uomId,
        uomCode: it.uomCode,
        orderedQty: it.requiredQty,
        unitRate: it.targetRate,
        discountPct: 0,
        taxPct: 18,
        grossAmount: gross,
        discountAmount: 0,
        taxAmount: tax,
        netAmount: gross + tax,
        deliveryDate: formDeliveryDate,
        remarks: `Imported from RFQ ${rfq.rfqNo}`,
      };
    });

    setFormItems(importedItems);
    setIsImportRfqOpen(false);
  };

  // Quick Sourcing: Import PR Item
  const handleImportPrItem = (pr: ApprovedPrOption, item: ApprovedPrOption['items'][0]) => {
    const gross = item.approvedQty * item.estimatedRate;
    const tax = gross * 0.18;
    const newItem: PurchaseOrderItemRecord = {
      prItemId: item.prItemId,
      itemId: item.itemId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      itemDescription: item.itemName,
      uomId: item.uomId,
      uomCode: item.uomCode,
      orderedQty: item.approvedQty,
      unitRate: item.estimatedRate,
      discountPct: 0,
      taxPct: 18,
      grossAmount: gross,
      discountAmount: 0,
      taxAmount: tax,
      netAmount: gross + tax,
      deliveryDate: formDeliveryDate,
      remarks: `Sourced from PR ${pr.prNo}`,
    };
    setFormItems([...formItems, newItem]);
  };

  // Calculated Totals for Form
  const formCalculatedTotals = useMemo(() => {
    let gross = 0;
    let discount = 0;
    let tax = 0;
    let net = 0;

    for (const item of formItems) {
      const g = (Number(item.orderedQty) || 0) * (Number(item.unitRate) || 0);
      const d = g * ((Number(item.discountPct) || 0) / 100);
      const taxable = g - d;
      const t = taxable * ((Number(item.taxPct) || 0) / 100);
      const n = taxable + t;

      gross += g;
      discount += d;
      tax += t;
      net += n;
    }

    return { gross, discount, tax, net };
  }, [formItems]);

  // Export CSV
  const handleExportCsv = () => {
    if (purchaseOrders.length === 0) return;
    const headers = [
      'PO Number',
      'PO Date',
      'Delivery Date',
      'Vendor Code',
      'Vendor Name',
      'Warehouse',
      'PO Type',
      'Gross (INR)',
      'Discount (INR)',
      'Tax (INR)',
      'Net (INR)',
      'Status',
      'Items Count',
      'Payment Terms',
      'Remarks',
    ];

    const rows = purchaseOrders.map((po) => [
      `"${po.poNo}"`,
      `"${po.poDate}"`,
      `"${po.expectedDeliveryDate}"`,
      `"${po.vendorCode}"`,
      `"${po.vendorName.replace(/"/g, '""')}"`,
      `"${po.warehouseName.replace(/"/g, '""')}"`,
      `"${po.poType}"`,
      po.grossAmount.toFixed(2),
      po.discountAmount.toFixed(2),
      po.taxAmount.toFixed(2),
      po.netAmount.toFixed(2),
      `"${po.status}"`,
      po.itemsCount,
      `"${(po.paymentTerms || '').replace(/"/g, '""')}"`,
      `"${(po.remarks || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Purchase_Orders_Export_${new Date().toISOString().split('T')[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    logActionMutation.mutate('EXPORT');
  };

  // --------------------------------------------------------------------------
  // TABLE COLUMNS CONFIGURATION
  // --------------------------------------------------------------------------

  const columns: MasterTableColumn<PurchaseOrderHeaderRecord>[] = [
    {
      key: 'poNo',
      header: 'Purchase Order #',
      sortable: true,
      sortValue: (r) => r.poNo,
      render: (row) => (
        <div className="flex flex-col">
          <button
            onClick={() => handleViewPoDetails(row.poId)}
            className="font-mono font-semibold text-primary hover:underline text-left flex items-center gap-1.5"
          >
            <FileText className="w-3.5 h-3.5 text-primary" />
            {row.poNo}
          </button>
          <div className="flex items-center gap-1.5 mt-1">
            <span
              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                PO_TYPE_COLORS[row.poType] || 'bg-muted text-muted-foreground'
              }`}
            >
              {PO_TYPE_LABELS[row.poType] || row.poType}
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">
              {row.itemsCount} {row.itemsCount === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Order & Delivery Date',
      sortable: true,
      sortValue: (r) => r.poDate,
      render: (row) => (
        <div className="flex flex-col text-xs">
          <span className="font-mono font-medium text-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            PO: {row.poDate}
          </span>
          <span className="font-mono text-muted-foreground flex items-center gap-1 mt-0.5">
            <Truck className="w-3 h-3 text-primary" />
            Due: {row.expectedDeliveryDate}
          </span>
        </div>
      ),
    },
    {
      key: 'vendor',
      header: 'Vendor / Supplier',
      sortable: true,
      sortValue: (r) => r.vendorName,
      render: (row) => (
        <div className="flex flex-col text-xs max-w-[200px]">
          <span className="font-semibold text-foreground truncate" title={row.vendorName}>
            {row.vendorName}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground">
            Code: {row.vendorCode}
          </span>
        </div>
      ),
    },
    {
      key: 'warehouse',
      header: 'Receiving Plant',
      sortable: true,
      sortValue: (r) => r.warehouseName,
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-foreground">
          <Warehouse className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="truncate" title={row.warehouseName}>
            {row.warehouseName}
          </span>
        </div>
      ),
    },
    {
      key: 'netAmount',
      header: 'Net Order Value',
      sortable: true,
      sortValue: (r) => r.netAmount,
      render: (row) => (
        <div className="flex flex-col text-right">
          <span className="font-mono font-bold text-sm text-foreground">
            ₹{row.netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className="text-[11px] text-muted-foreground font-mono">
            Tax: ₹{row.taxAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Order Status',
      sortable: true,
      sortValue: (r) => r.status,
      render: (row) => {
        const badge = STATUS_BADGE_MAP[row.status] || STATUS_BADGE_MAP.DRAFT;
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1">
          {/* View Details */}
          <button
            onClick={() => handleViewPoDetails(row.poId)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Print Voucher */}
          <PermissionGate screen="PURCHASE_ORDER" action="PRINT">
            <button
              onClick={() => handleOpenPrintVoucher(row)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Print Purchase Order Voucher"
            >
              <Printer className="w-4 h-4 text-primary" />
            </button>
          </PermissionGate>

          {/* Submit action for DRAFT */}
          {row.status === 'DRAFT' && (
            <PermissionGate screen="PURCHASE_ORDER" action="SUBMIT">
              <button
                onClick={() => submitPoMutation.mutate(row.poId)}
                disabled={submitPoMutation.isPending}
                className="p-1 rounded hover:bg-amber-500/10 text-amber-600 hover:text-amber-700 transition-colors"
                title="Submit for Approval / Release"
              >
                <Send className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {/* Release sign-off for SUBMITTED */}
          {row.status === 'SUBMITTED' && (
            <PermissionGate screen="PURCHASE_ORDER" action="RELEASE">
              <button
                onClick={() => handleOpenReleaseModal(row)}
                className="p-1 rounded hover:bg-emerald-500/10 text-emerald-600 hover:text-emerald-700 transition-colors"
                title="Commercial Release Sign-Off"
              >
                <ShieldCheck className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {/* Edit (if DRAFT or SUBMITTED) */}
          {['DRAFT', 'SUBMITTED'].includes(row.status) && (
            <PermissionGate screen="PURCHASE_ORDER" action="EDIT">
              <button
                onClick={() => handleOpenEditModal(row)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Edit Order"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {/* Cancel (if DRAFT, SUBMITTED, or RELEASED) */}
          {['DRAFT', 'SUBMITTED', 'RELEASED'].includes(row.status) && (
            <PermissionGate screen="PURCHASE_ORDER" action="CANCEL">
              <button
                onClick={() => handleOpenCancelModal(row)}
                className="p-1 rounded hover:bg-rose-500/10 text-rose-500 hover:text-rose-600 transition-colors"
                title="Cancel Order"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {/* Delete (if DRAFT only) */}
          {row.status === 'DRAFT' && (
            <PermissionGate screen="PURCHASE_ORDER" action="DELETE">
              <button
                onClick={() => {
                  setDeleteTarget(row);
                  setDeleteErrorMessage(null);
                  setDeleteConflicts([]);
                }}
                className="p-1 rounded hover:bg-rose-500/10 text-rose-500 hover:text-rose-700 transition-colors"
                title="Delete Draft PO"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}
        </div>
      ),
    },
  ];

  const groupByOptions: GroupByOption<PurchaseOrderHeaderRecord>[] = [
    {
      key: 'status',
      label: 'Order Status',
      groupValue: (r) => r.status,
    },
    {
      key: 'vendor',
      label: 'Vendor / Supplier',
      groupValue: (r) => r.vendorName,
    },
    {
      key: 'poType',
      label: 'Purchase Order Type',
      groupValue: (r) => PO_TYPE_LABELS[r.poType] || r.poType,
    },
    {
      key: 'warehouse',
      label: 'Receiving Plant / Warehouse',
      groupValue: (r) => r.warehouseName,
    },
  ];

  // --------------------------------------------------------------------------
  // RENDER UI
  // --------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Purchase Orders & Commercial Release
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Enterprise procurement lifecycle, supplier contracting, GST breakdown, and commercial release authorization.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <PermissionGate screen="PURCHASE_ORDER" action="EXPORT">
            <button
              onClick={handleExportCsv}
              disabled={purchaseOrders.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
              Export Register
            </button>
          </PermissionGate>

          <PermissionGate screen="PURCHASE_ORDER" action="ADD">
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Purchase Order
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* KPI Cards (4 summary cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Orders */}
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Total Purchase Orders
            </span>
            <div className="text-2xl font-bold font-mono text-foreground">
              {isSummaryLoading ? '...' : summary?.totalPos || 0}
            </div>
            <p className="text-xs text-muted-foreground">All contracts & orders</p>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Pending Release */}
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-500/5 backdrop-blur-sm shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Pending Authorization
            </span>
            <div className="text-2xl font-bold font-mono text-amber-800 dark:text-amber-300">
              {isSummaryLoading ? '...' : summary?.pendingReleaseCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">Draft & submitted sign-offs</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Released Active Orders */}
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-500/5 backdrop-blur-sm shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Commercially Released
            </span>
            <div className="text-2xl font-bold font-mono text-emerald-800 dark:text-emerald-300">
              {isSummaryLoading ? '...' : summary?.releasedCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">Dispatched to suppliers</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Total Spend Value */}
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Committed Spend Value
            </span>
            <div className="text-2xl font-bold font-mono text-foreground">
              {isSummaryLoading
                ? '...'
                : `₹${(summary?.totalSpendValue || 0).toLocaleString('en-IN', {
                    maximumFractionDigits: 0,
                  })}`}
            </div>
            <p className="text-xs text-muted-foreground">Active order valuation</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
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
                ['RELEASED', 'Released'],
                ['CLOSED', 'Closed'],
                ['CANCELLED', 'Cancelled'],
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

          {/* PO Type Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Type:</span>
            <select
              value={poTypeFilter}
              onChange={(e) => setPoTypeFilter(e.target.value)}
              className="text-xs px-2.5 py-1 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Types</option>
              <option value="STANDARD">Standard PO</option>
              <option value="BLANKET">Blanket Agreement</option>
              <option value="SUBCONTRACTING">Subcontracting Job-Work</option>
              <option value="SERVICE">Service PO</option>
              <option value="CAPITAL_EXPENDITURE">Capital Expenditure</option>
            </select>
          </div>

          {/* Vendor Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Vendor:</span>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="text-xs px-2.5 py-1 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[180px]"
            >
              <option value="ALL">All Vendors</option>
              {suppliers.map((v) => (
                <option key={v.partyId} value={v.partyId}>
                  {v.partyName}
                </option>
              ))}
            </select>
          </div>

          {/* Warehouse Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Plant:</span>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="text-xs px-2.5 py-1 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Plants</option>
              {warehouses.map((w) => (
                <option key={w.warehouseId} value={w.warehouseId}>
                  {w.warehouseName}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="ml-auto w-full sm:w-auto relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search PO #, vendor, remarks..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="text-xs pl-8 pr-3 py-1.5 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <MasterDataTable<PurchaseOrderHeaderRecord>
        title="Purchase Orders Register"
        subtitle="Active enterprise purchase contracts, supplier orders, GST breakdowns, and commercial release authorization"
        screenCode="PURCHASE_ORDER"
        tableNameBadge="tbl_pur_po_header"
        data={purchaseOrders}
        rowKey={(row) => row.poId}
        isLoading={isPoListLoading}
        columns={columns}
        groupByOptions={groupByOptions}
        searchPlaceholder="Search PO #, vendor, warehouse, terms..."
        searchPredicate={(row, query) => {
          const q = query.toLowerCase();
          return (
            row.poNo.toLowerCase().includes(q) ||
            row.vendorName.toLowerCase().includes(q) ||
            row.vendorCode.toLowerCase().includes(q) ||
            row.warehouseName.toLowerCase().includes(q) ||
            (row.remarks ? row.remarks.toLowerCase().includes(q) : false) ||
            (row.paymentTerms ? row.paymentTerms.toLowerCase().includes(q) : false)
          );
        }}
        addButtonLabel="New Purchase Order"
        onAddClick={handleOpenCreateModal}
        onExportClick={handleExportCsv}
      />

      {/* ==================================================================== */}
      {/* MODAL 1: CREATE / EDIT PURCHASE ORDER                                */}
      {/* ==================================================================== */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-5xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">
                  {editingPo ? `Edit Purchase Order (${editingPo.poNo})` : 'New Purchase Order'}
                </h2>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Form */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Sourcing Quick-Import Toolbar */}
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <Package className="w-4 h-4" />
                  <span>Sourcing Acceleration:</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsImportRfqOpen(true)}
                    className="px-2.5 py-1 rounded bg-background border border-primary/30 hover:bg-primary/10 text-primary font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Award className="w-3.5 h-3.5" />
                    Import Awarded RFQ ({awardedRfqs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsImportPrOpen(true)}
                    className="px-2.5 py-1 rounded bg-background border border-border hover:bg-muted text-foreground font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                    Import Approved PR Items ({approvedPrs.length})
                  </button>
                </div>
              </div>

              {/* Header Configuration Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Vendor Selector */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Vendor / Supplier <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formVendorId}
                    onChange={(e) => setFormVendorId(Number(e.target.value) || '')}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground"
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.partyId} value={s.partyId}>
                        {s.partyName} ({s.partyCode})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Warehouse Selector */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Receiving Warehouse <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formWarehouseId}
                    onChange={(e) => setFormWarehouseId(Number(e.target.value) || '')}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground"
                  >
                    <option value="">-- Select Receiving Plant --</option>
                    {warehouses.map((w) => (
                      <option key={w.warehouseId} value={w.warehouseId}>
                        {w.warehouseName} ({w.warehouseCode})
                      </option>
                    ))}
                  </select>
                </div>

                {/* PO Type */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Purchase Order Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formPoType}
                    onChange={(e) => setFormPoType(e.target.value as PoType)}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground font-medium"
                  >
                    <option value="STANDARD">Standard PO (Stock / RM)</option>
                    <option value="BLANKET">Blanket Agreement (Contract)</option>
                    <option value="SUBCONTRACTING">Subcontracting Job-Work</option>
                    <option value="SERVICE">Service PO</option>
                    <option value="CAPITAL_EXPENDITURE">Capital Asset (CapEx)</option>
                  </select>
                </div>

                {/* PO Date */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Order Date
                  </label>
                  <input
                    type="date"
                    value={formPoDate}
                    onChange={(e) => setFormPoDate(e.target.value)}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground font-mono"
                  />
                </div>

                {/* Expected Delivery Date */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Expected Delivery Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formDeliveryDate}
                    onChange={(e) => setFormDeliveryDate(e.target.value)}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground font-mono"
                  />
                </div>

                {/* Custom PO Number (Optional) */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    PO Number <span className="text-muted-foreground text-[10px]">(Auto if blank)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. PO-AHM-2627-0006"
                    value={formPoNo}
                    onChange={(e) => setFormPoNo(e.target.value)}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground font-mono"
                  />
                </div>

                {/* Payment Terms */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 30 Days Net from GRN"
                    value={formPaymentTerms}
                    onChange={(e) => setFormPaymentTerms(e.target.value)}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground"
                  />
                </div>

                {/* Delivery Terms */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Delivery Terms / Incoterms
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. FOR Destination Plant"
                    value={formDeliveryTerms}
                    onChange={(e) => setFormDeliveryTerms(e.target.value)}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground"
                  />
                </div>

                {/* Remarks */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Commercial Remarks
                  </label>
                  <input
                    type="text"
                    placeholder="Inspection, packaging or unloading instructions"
                    value={formRemarks}
                    onChange={(e) => setFormRemarks(e.target.value)}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground"
                  />
                </div>
              </div>

              {/* Shipping & Billing Addresses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Shipping / Delivery Address
                  </label>
                  <textarea
                    rows={2}
                    value={formShippingAddress}
                    onChange={(e) => setFormShippingAddress(e.target.value)}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Billing / Invoicing Address
                  </label>
                  <textarea
                    rows={2}
                    value={formBillingAddress}
                    onChange={(e) => setFormBillingAddress(e.target.value)}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground"
                  />
                </div>
              </div>

              {/* Line Items Table */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">Order Items & Schedule</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground font-mono">
                      {formItems.length} lines
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Item Line
                  </button>
                </div>

                {formItems.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-border rounded-lg bg-muted/20">
                    <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-muted-foreground font-medium">No line items added yet.</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Click "+ Add Item Line" or import lines from Awarded RFQ / Approved PR.
                    </p>
                  </div>
                ) : (
                  <div className="border border-border rounded-lg overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                          <th className="p-2 w-8 text-center">#</th>
                          <th className="p-2 min-w-[200px]">Item & Description</th>
                          <th className="p-2 w-24">Qty</th>
                          <th className="p-2 w-24">UOM</th>
                          <th className="p-2 w-28">Rate (₹)</th>
                          <th className="p-2 w-20">Disc %</th>
                          <th className="p-2 w-20">GST %</th>
                          <th className="p-2 w-28 text-right">Net Line (₹)</th>
                          <th className="p-2 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {formItems.map((item, idx) => {
                          const gross = (Number(item.orderedQty) || 0) * (Number(item.unitRate) || 0);
                          const disc = gross * ((Number(item.discountPct) || 0) / 100);
                          const tax = (gross - disc) * ((Number(item.taxPct) || 0) / 100);
                          const net = gross - disc + tax;

                          return (
                            <tr key={idx} className="hover:bg-muted/30">
                              <td className="p-2 text-center text-muted-foreground font-mono">
                                {idx + 1}
                              </td>
                              <td className="p-2 space-y-1">
                                <select
                                  value={item.itemId}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, 'itemId', e.target.value)
                                  }
                                  className="w-full p-1.5 rounded border border-border bg-background text-foreground font-medium"
                                >
                                  {itemsCatalog.map((i) => (
                                    <option key={i.itemId} value={i.itemId}>
                                      {i.itemCode} - {i.itemName}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  type="text"
                                  placeholder="Specification / technical note"
                                  value={item.itemDescription || ''}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, 'itemDescription', e.target.value)
                                  }
                                  className="w-full p-1 rounded border border-border/60 bg-background/50 text-[11px] text-muted-foreground"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="0.001"
                                  step="any"
                                  value={item.orderedQty}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, 'orderedQty', e.target.value)
                                  }
                                  className="w-full p-1.5 rounded border border-border bg-background text-foreground font-mono font-medium"
                                />
                              </td>
                              <td className="p-2">
                                <select
                                  value={item.uomId}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, 'uomId', e.target.value)
                                  }
                                  className="w-full p-1.5 rounded border border-border bg-background text-foreground"
                                >
                                  {uomsCatalog.map((u) => (
                                    <option key={u.uomId} value={u.uomId}>
                                      {u.uomCode}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={item.unitRate}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, 'unitRate', e.target.value)
                                  }
                                  className="w-full p-1.5 rounded border border-border bg-background text-foreground font-mono font-medium"
                                />
                              </td>
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.1"
                                  value={item.discountPct}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, 'discountPct', e.target.value)
                                  }
                                  className="w-full p-1.5 rounded border border-border bg-background text-foreground font-mono"
                                />
                              </td>
                              <td className="p-2">
                                <select
                                  value={item.taxPct}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, 'taxPct', e.target.value)
                                  }
                                  className="w-full p-1.5 rounded border border-border bg-background text-foreground font-mono"
                                >
                                  <option value="0">0%</option>
                                  <option value="5">5%</option>
                                  <option value="12">12%</option>
                                  <option value="18">18%</option>
                                  <option value="28">28%</option>
                                </select>
                              </td>
                              <td className="p-2 text-right font-mono font-bold text-foreground">
                                ₹{net.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemRow(idx)}
                                  className="p-1 rounded text-rose-500 hover:bg-rose-500/10"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Calculation Footer */}
                {formItems.length > 0 && (
                  <div className="p-4 rounded-lg bg-muted/40 border border-border flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
                    <div className="flex items-center gap-6 text-xs text-muted-foreground">
                      <div>
                        Gross Total: <span className="font-bold text-foreground">₹{formCalculatedTotals.gross.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        Discount: <span className="font-bold text-amber-600">₹{formCalculatedTotals.discount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                      <div>
                        Tax (GST): <span className="font-bold text-blue-600">₹{formCalculatedTotals.tax.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground block">Net Payable Amount</span>
                      <span className="text-lg font-bold text-primary">
                        ₹{formCalculatedTotals.net.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-border bg-muted/40">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => savePoMutation.mutate()}
                disabled={savePoMutation.isPending}
                className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow hover:bg-primary/90 disabled:opacity-50"
              >
                {savePoMutation.isPending ? 'Saving...' : editingPo ? 'Update Purchase Order' : 'Create Purchase Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SOURCING DRAWER 1: IMPORT FROM AWARDED RFQ                           */}
      {/* ==================================================================== */}
      {isImportRfqOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-foreground">Import from Awarded RFQ</h3>
              </div>
              <button
                onClick={() => setIsImportRfqOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              <p className="text-muted-foreground">
                Select an Awarded RFQ to auto-populate the Supplier, Receiving Warehouse, Payment Terms, and negotiated Item Lines into this Purchase Order.
              </p>
              {awardedRfqs.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  No awarded RFQs available to import.
                </div>
              ) : (
                awardedRfqs.map((rfq) => (
                  <div
                    key={rfq.rfqId}
                    className="p-3 rounded-lg border border-border hover:border-primary/50 bg-card hover:bg-primary/5 transition-colors flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">{rfq.rfqNo}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-300">
                          Awarded
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-0.5">
                        Awarded Vendor:{' '}
                        <span className="font-semibold text-foreground">
                          {rfq.awardedVendorName || 'Selected Vendor'}
                        </span>
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                        {rfq.items?.length || 0} line items | Plant: {rfq.warehouseName || 'Assigned Warehouse'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleImportRfq(rfq)}
                      className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-semibold hover:bg-primary/90 text-xs shrink-0"
                    >
                      Import into PO
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SOURCING DRAWER 2: IMPORT APPROVED PR ITEMS                          */}
      {/* ==================================================================== */}
      {isImportPrOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-foreground">Import Approved Requisition Lines</h3>
              </div>
              <button
                onClick={() => setIsImportPrOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4 flex-1 text-xs">
              <p className="text-muted-foreground">
                Approved material requisitions ready for purchasing. Click "Add Line" to append to order items.
              </p>
              {approvedPrs.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  No approved purchase requisitions available.
                </div>
              ) : (
                approvedPrs.map((pr) => (
                  <div key={pr.prId} className="border border-border rounded-lg overflow-hidden">
                    <div className="bg-muted/50 p-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2 font-mono font-semibold text-foreground">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        {pr.prNo} ({pr.prDate})
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {pr.items?.length || 0} approved items
                      </span>
                    </div>
                    <div className="p-2 space-y-1.5">
                      {pr.items?.map((it) => (
                        <div
                          key={it.prItemId}
                          className="flex items-center justify-between gap-3 p-2 rounded bg-background border border-border/60 hover:border-primary/40 text-xs"
                        >
                          <div>
                            <span className="font-semibold text-foreground">
                              {it.itemCode} - {it.itemName}
                            </span>
                            <div className="text-[11px] text-muted-foreground font-mono">
                              Approved: {it.approvedQty} {it.uomCode} @ ₹{it.estimatedRate}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleImportPrItem(pr, it)}
                            className="px-2.5 py-1 rounded bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />
                            Add Line
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: PO DETAIL DRAWER                                            */}
      {/* ==================================================================== */}
      {isDetailOpen && selectedPo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    {selectedPo.poNo}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        STATUS_BADGE_MAP[selectedPo.status].bg
                      } ${STATUS_BADGE_MAP[selectedPo.status].text} ${
                        STATUS_BADGE_MAP[selectedPo.status].border
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${STATUS_BADGE_MAP[selectedPo.status].dot}`}
                      />
                      {STATUS_BADGE_MAP[selectedPo.status].label}
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Created on {selectedPo.createdDate} | Type:{' '}
                    {PO_TYPE_LABELS[selectedPo.poType]}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Order Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/30 border border-border">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Vendor / Supplier</span>
                  <span className="font-semibold text-foreground">{selectedPo.vendorName}</span>
                  <span className="font-mono text-[10px] text-muted-foreground block">
                    Code: {selectedPo.vendorCode}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Receiving Plant</span>
                  <span className="font-semibold text-foreground">{selectedPo.warehouseName}</span>
                  <span className="font-mono text-[10px] text-muted-foreground block">
                    {selectedPo.warehouseCode}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Order & Due Dates</span>
                  <span className="font-mono font-medium text-foreground block">
                    PO: {selectedPo.poDate}
                  </span>
                  <span className="font-mono text-primary block text-[11px]">
                    Due: {selectedPo.expectedDeliveryDate}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Payment & Delivery</span>
                  <span className="text-foreground block">{selectedPo.paymentTerms || 'Standard'}</span>
                  <span className="text-muted-foreground block text-[10px]">
                    {selectedPo.deliveryTerms || 'FOR Destination'}
                  </span>
                </div>
              </div>

              {/* Release / Sign-Off Audit Banner */}
              {selectedPo.status === 'RELEASED' && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">
                      Commercial Release Authorized
                    </span>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      Released by {selectedPo.releasedByName || 'Authorized Signatory'} on{' '}
                      {selectedPo.releaseDate}
                    </p>
                    {selectedPo.releaseRemarks && (
                      <p className="text-[11px] text-muted-foreground italic">
                        "{selectedPo.releaseRemarks}"
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Cancellation Banner */}
              {selectedPo.status === 'CANCELLED' && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-rose-800 dark:text-rose-300">
                      Purchase Order Cancelled
                    </span>
                    <p className="text-[11px] text-rose-700 dark:text-rose-400">
                      Reason: {selectedPo.cancelReason || 'Administrative cancellation'}
                    </p>
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-2">
                <h3 className="font-bold text-foreground text-sm">Line Items & Valuation</h3>
                <div className="border border-border rounded-lg overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                        <th className="p-2 w-8 text-center">#</th>
                        <th className="p-2">Item Code & Name</th>
                        <th className="p-2 text-right">Ordered Qty</th>
                        <th className="p-2">UOM</th>
                        <th className="p-2 text-right">Unit Rate (₹)</th>
                        <th className="p-2 text-right">Disc %</th>
                        <th className="p-2 text-right">GST %</th>
                        <th className="p-2 text-right">Net Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedPo.items?.map((it, idx) => (
                        <tr key={it.poItemId || idx} className="hover:bg-muted/20">
                          <td className="p-2 text-center text-muted-foreground font-mono">
                            {idx + 1}
                          </td>
                          <td className="p-2">
                            <span className="font-semibold text-foreground">{it.itemCode}</span>
                            <span className="text-muted-foreground block text-[11px]">
                              {it.itemName}
                            </span>
                            {it.itemDescription && (
                              <span className="text-[10px] text-muted-foreground italic">
                                {it.itemDescription}
                              </span>
                            )}
                          </td>
                          <td className="p-2 text-right font-mono font-medium">{it.orderedQty}</td>
                          <td className="p-2 font-mono text-muted-foreground">{it.uomCode}</td>
                          <td className="p-2 text-right font-mono">₹{it.unitRate.toFixed(2)}</td>
                          <td className="p-2 text-right font-mono">{it.discountPct}%</td>
                          <td className="p-2 text-right font-mono">{it.taxPct}%</td>
                          <td className="p-2 text-right font-mono font-bold text-foreground">
                            ₹{(it.netAmount || 0).toLocaleString('en-IN', {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Order Cost Breakdown */}
              <div className="flex justify-end">
                <div className="w-72 p-3 rounded-lg bg-muted/40 border border-border space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Gross Value:</span>
                    <span>₹{selectedPo.grossAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Discount:</span>
                    <span>₹{selectedPo.discountAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>GST (Tax):</span>
                    <span>₹{selectedPo.taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-border pt-1.5 flex justify-between font-bold text-sm text-foreground">
                    <span>Net Order Value:</span>
                    <span className="text-primary">
                      ₹{selectedPo.netAmount.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between p-4 border-t border-border bg-muted/40">
              <div className="flex items-center gap-2">
                <PermissionGate screen="PURCHASE_ORDER" action="PRINT">
                  <button
                    onClick={() => handleOpenPrintVoucher(selectedPo)}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5 text-primary" />
                    Print Voucher
                  </button>
                </PermissionGate>
              </div>

              <div className="flex items-center gap-2">
                {selectedPo.status === 'DRAFT' && (
                  <PermissionGate screen="PURCHASE_ORDER" action="SUBMIT">
                    <button
                      onClick={() => submitPoMutation.mutate(selectedPo.poId)}
                      disabled={submitPoMutation.isPending}
                      className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1.5 hover:bg-primary/90"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Submit Order
                    </button>
                  </PermissionGate>
                )}

                {selectedPo.status === 'SUBMITTED' && (
                  <PermissionGate screen="PURCHASE_ORDER" action="RELEASE">
                    <button
                      onClick={() => handleOpenReleaseModal(selectedPo)}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-700"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Commercial Release
                    </button>
                  </PermissionGate>
                )}

                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: COMMERCIAL RELEASE SIGN-OFF                                 */}
      {/* ==================================================================== */}
      {isReleaseModalOpen && releaseTargetPo && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2 text-emerald-600">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="font-bold text-foreground">Commercial Release Sign-Off</h3>
              </div>
              <button
                onClick={() => setIsReleaseModalOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300">
                <p className="font-semibold">Authorizing Commercial Release</p>
                <p className="text-[11px] mt-0.5">
                  Releasing PO <span className="font-mono font-bold">{releaseTargetPo.poNo}</span> to{' '}
                  <span className="font-bold">{releaseTargetPo.vendorName}</span> for value of{' '}
                  <span className="font-mono font-bold">
                    ₹{releaseTargetPo.netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                  . This will mark the order active for plant inward GRN receipt.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Commercial Sign-Off Notes / Remarks <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={releaseRemarks}
                  onChange={(e) => setReleaseRemarks(e.target.value)}
                  placeholder="e.g. Terms verified against RFQ comparison. Approved for delivery schedule."
                  className="w-full p-2.5 rounded-md border border-border bg-background text-foreground"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/40">
              <button
                onClick={() => setIsReleaseModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  releasePoMutation.mutate({
                    poId: releaseTargetPo.poId,
                    releaseRemarks: releaseRemarks.trim(),
                  })
                }
                disabled={releasePoMutation.isPending || !releaseRemarks.trim()}
                className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow hover:bg-emerald-700 disabled:opacity-50"
              >
                {releasePoMutation.isPending ? 'Authorizing...' : 'Authorize & Release Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: CANCEL PURCHASE ORDER                                       */}
      {/* ==================================================================== */}
      {isCancelModalOpen && cancelTargetPo && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2 text-rose-600">
                <XCircle className="w-5 h-5" />
                <h3 className="font-bold text-foreground">Cancel Purchase Order</h3>
              </div>
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300">
                <p className="font-semibold">Are you sure you want to cancel this order?</p>
                <p className="text-[11px] mt-0.5">
                  Order <span className="font-mono font-bold">{cancelTargetPo.poNo}</span> will be marked
                  as CANCELLED. Any open material receipt lines will be blocked.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Reason for Cancellation <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Vendor delivery delay / design revision / supplier declined."
                  className="w-full p-2.5 rounded-md border border-border bg-background text-foreground"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/40">
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted text-xs font-semibold"
              >
                Dismiss
              </button>
              <button
                onClick={() =>
                  cancelPoMutation.mutate({
                    poId: cancelTargetPo.poId,
                    cancelReason: cancelReason.trim(),
                  })
                }
                disabled={cancelPoMutation.isPending || !cancelReason.trim()}
                className="px-5 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold shadow hover:bg-rose-700 disabled:opacity-50"
              >
                {cancelPoMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: PRINTABLE OFFICIAL PURCHASE ORDER VOUCHER                   */}
      {/* ==================================================================== */}
      {isPrintModalOpen && printTargetPo && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl my-8 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-foreground">Purchase Order Voucher Preview</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 hover:bg-primary/90"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Document
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Paper */}
            <div className="p-8 overflow-y-auto bg-white text-slate-900 font-sans text-xs space-y-6">
              {/* Document Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    KASHVIRA INFOTECH PRIVATE LIMITED
                  </h1>
                  <p className="text-[11px] text-slate-600">
                    Industrial Manufacturing Division | Plant 1: SG Industrial Corridor, Ahmedabad, Gujarat - 382445
                  </p>
                  <p className="text-[11px] text-slate-600 font-mono">
                    GSTIN: 24AABCK1234F1Z8 | CIN: U72900GJ2026PTC099881 | Email: purchase@kashvirainfotech.com
                  </p>
                </div>
                <div className="text-right">
                  <div className="inline-block px-3 py-1 bg-slate-900 text-white font-bold text-sm tracking-wider uppercase rounded">
                    PURCHASE ORDER
                  </div>
                  <p className="font-mono font-bold text-sm text-slate-900 mt-2">
                    {printTargetPo.poNo}
                  </p>
                  <p className="text-[11px] text-slate-600 font-mono">
                    Date: {printTargetPo.poDate}
                  </p>
                </div>
              </div>

              {/* Vendor & Shipping Details Grid */}
              <div className="grid grid-cols-2 gap-6 border border-slate-300 rounded p-4 text-xs">
                <div>
                  <h4 className="font-bold text-slate-800 uppercase text-[11px] mb-1">
                    VENDOR / SUPPLIER (BILL TO):
                  </h4>
                  <p className="font-bold text-slate-900 text-sm">{printTargetPo.vendorName}</p>
                  <p className="font-mono text-[11px] text-slate-600">Vendor Code: {printTargetPo.vendorCode}</p>
                  <p className="text-slate-700 mt-1">
                    Payment Terms: <span className="font-semibold">{printTargetPo.paymentTerms || '30 Days Net'}</span>
                  </p>
                  <p className="text-slate-700">
                    Incoterms: <span className="font-semibold">{printTargetPo.deliveryTerms || 'FOR Destination'}</span>
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 uppercase text-[11px] mb-1">
                    DELIVER TO (SHIP TO PLANT):
                  </h4>
                  <p className="font-bold text-slate-900">{printTargetPo.warehouseName}</p>
                  <p className="text-slate-600 text-[11px] mt-0.5">
                    {printTargetPo.shippingAddress || 'Plant 1, Kashvira Mfg Hub, Industrial Zone, Ahmedabad'}
                  </p>
                  <p className="text-slate-700 mt-1 font-mono">
                    Expected Delivery Due: <span className="font-bold">{printTargetPo.expectedDeliveryDate}</span>
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className="p-2 border-r border-slate-300 w-8 text-center">#</th>
                    <th className="p-2 border-r border-slate-300">Item Description & Specifications</th>
                    <th className="p-2 border-r border-slate-300 text-right w-20">Qty</th>
                    <th className="p-2 border-r border-slate-300 text-center w-16">UOM</th>
                    <th className="p-2 border-r border-slate-300 text-right w-24">Rate (₹)</th>
                    <th className="p-2 border-r border-slate-300 text-right w-16">Disc %</th>
                    <th className="p-2 border-r border-slate-300 text-right w-16">GST %</th>
                    <th className="p-2 text-right w-28">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300">
                  {printTargetPo.items?.map((it, idx) => (
                    <tr key={it.poItemId || idx}>
                      <td className="p-2 border-r border-slate-300 text-center font-mono">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-slate-300">
                        <span className="font-bold text-slate-900">{it.itemCode}</span> - {it.itemName}
                        {it.itemDescription && (
                          <span className="block text-[11px] text-slate-600 italic">
                            {it.itemDescription}
                          </span>
                        )}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-right font-mono font-medium">
                        {it.orderedQty}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-center font-mono text-slate-600">
                        {it.uomCode}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-right font-mono">
                        {it.unitRate.toFixed(2)}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-right font-mono">
                        {it.discountPct}%
                      </td>
                      <td className="p-2 border-r border-slate-300 text-right font-mono">
                        {it.taxPct}%
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-slate-900">
                        {(it.netAmount || 0).toLocaleString('en-IN', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary and Sign-off */}
              <div className="grid grid-cols-2 gap-6 pt-2">
                <div className="space-y-2 text-[11px] text-slate-600">
                  <h4 className="font-bold text-slate-800 uppercase">Terms & Conditions:</h4>
                  <ul className="list-disc pl-4 space-y-1">
                    <li>Materials subject to physical count and quality laboratory inspection at inward GRN.</li>
                    <li>Rejection/Damages will be debited to vendor account with replacement within 7 business days.</li>
                    <li>Invoice must quote this Purchase Order number and attached Test Certificates (MTC).</li>
                    <li>Disputes subject to Ahmedabad, Gujarat jurisdiction.</li>
                  </ul>
                </div>
                <div className="border border-slate-300 rounded p-3 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal Gross:</span>
                    <span>₹{printTargetPo.grossAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Discount:</span>
                    <span>₹{printTargetPo.discountAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Total Tax (GST):</span>
                    <span>₹{printTargetPo.taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="border-t border-slate-300 pt-1.5 flex justify-between font-bold text-sm text-slate-900">
                    <span>Grand Total:</span>
                    <span>
                      ₹{printTargetPo.netAmount.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signature Blocks */}
              <div className="grid grid-cols-3 gap-6 pt-12 border-t border-slate-300 text-center text-xs">
                <div>
                  <div className="border-b border-slate-400 pb-1 font-semibold text-slate-800">
                    Prepared By
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Procurement Department</p>
                </div>
                <div>
                  <div className="border-b border-slate-400 pb-1 font-semibold text-slate-800">
                    Checked & Verified
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Material Planning (QA/Stores)</p>
                </div>
                <div>
                  <div className="border-b border-slate-400 pb-1 font-semibold text-slate-800">
                    Commercial Signatory
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">
                    {printTargetPo.releasedByName || 'Authorized Commercial Signatory'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 6: CONFIRM DELETE MODAL                                        */}
      {/* ==================================================================== */}
      {deleteTarget && (
        <ConfirmDeleteModal
          isOpen={!!deleteTarget}
          entityType="Purchase Order"
          entityName={deleteTarget.poNo}
          entityCode={deleteTarget.vendorName}
          isDeleting={deletePoMutation.isPending}
          errorMessage={deleteErrorMessage}
          dependencies={deleteConflicts}
          onConfirm={() => deletePoMutation.mutate(deleteTarget.poId)}
          onClose={() => {
            setDeleteTarget(null);
            setDeleteErrorMessage(null);
            setDeleteConflicts([]);
          }}
        />
      )}
    </div>
  );
};
