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
  TrendingDown,
  TrendingUp,
  Truck,
  User,
  Users,
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

export type RfqStatus =
  | 'DRAFT'
  | 'SENT'
  | 'QUOTES_RECEIVED'
  | 'COMPARISON_DONE'
  | 'AWARDED'
  | 'CANCELLED';

export interface RfqItemRecord {
  rfqItemId?: number;
  rfqId?: number;
  prItemId?: number | null;
  prNo?: string | null;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  itemType?: string;
  uomId: number;
  uomCode?: string;
  uomName?: string;
  requiredQty: number;
  targetRate: number;
  targetAmount?: number;
  technicalSpecs?: string;
  isActive?: boolean;
}

export interface RfqVendorRecord {
  rfqVendorId?: number;
  rfqId?: number;
  partyId: number;
  partyCode?: string;
  partyName?: string;
  vendorEmail?: string;
  vendorPhone?: string;
  invitationDate?: string;
  status?: 'INVITED' | 'QUOTED' | 'DECLINED' | 'SELECTED';
  vendorQuoteRef?: string | null;
  quoteDate?: string | null;
  totalQuoteAmount?: number;
  paymentTerms?: string | null;
  deliveryLeadTimeDays?: number;
  vendorRemarks?: string | null;
  isActive?: boolean;
}

export interface RfqHeaderRecord {
  rfqId: number;
  rfqNo: string;
  rfqDate: string;
  dueDate: string;
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  status: RfqStatus;
  paymentTerms?: string | null;
  deliveryTerms?: string | null;
  remarks?: string | null;
  awardedVendorId?: number | null;
  awardedVendorCode?: string | null;
  awardedVendorName?: string | null;
  awardedDate?: string | null;
  awardedRemarks?: string | null;
  isActive: boolean;
  createdDate: string;
  itemsCount: number;
  invitedVendorsCount: number;
  quotesReceivedCount: number;
  items?: RfqItemRecord[];
  vendors?: RfqVendorRecord[];
}

export interface RfqSummary {
  totalRfqs: number;
  openCount: number;
  evaluatingCount: number;
  awardedCount: number;
  totalQuotesReceived: number;
}

export interface ComparativeStatementData {
  rfq: RfqHeaderRecord;
  comparisonItems: {
    rfqItemId: number;
    itemId: number;
    itemCode: string;
    itemName: string;
    uomCode: string;
    requiredQty: number;
    targetRate: number;
    targetAmount: number;
    quotes: {
      rfqVendorItemId: number;
      rfqVendorId: number;
      partyId: number;
      partyCode: string;
      partyName: string;
      offeredQty: number;
      quotedRate: number;
      discountPct: number;
      netRate: number;
      taxPct: number;
      totalAmount: number;
      isL1: boolean;
      isAwarded: boolean;
      remarks?: string;
      leadTimeDays: number;
      paymentTerms: string;
      vendorQuoteRef: string;
    }[];
    l1Quote?: {
      partyId: number;
      partyName: string;
      netRate: number;
      totalAmount: number;
      variancePct: number;
    } | null;
  }[];
  vendorSummaries: {
    partyId: number;
    partyCode: string;
    partyName: string;
    status: string;
    vendorQuoteRef?: string;
    quoteDate?: string;
    totalQuoteAmount: number;
    deliveryLeadTimeDays: number;
    quotesCount: number;
    totalQuotedAmount: number;
    l1WinsCount: number;
  }[];
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

const STATUS_BADGE_MAP: Record<
  RfqStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  DRAFT: {
    label: 'Draft Inquiry',
    bg: 'bg-muted/80',
    text: 'text-muted-foreground',
    border: 'border-border',
  },
  SENT: {
    label: 'Sent to Vendors',
    bg: 'bg-blue-500/10 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-300 dark:border-blue-800',
  },
  QUOTES_RECEIVED: {
    label: 'Quotes Received',
    bg: 'bg-indigo-500/10 dark:bg-indigo-950/30',
    text: 'text-indigo-700 dark:text-indigo-400',
    border: 'border-indigo-300 dark:border-indigo-800',
  },
  COMPARISON_DONE: {
    label: 'CS Evaluated (L1 Identified)',
    bg: 'bg-amber-500/10 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-300 dark:border-amber-800',
  },
  AWARDED: {
    label: 'Awarded / Finalized',
    bg: 'bg-emerald-500/10 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-300 dark:border-emerald-800',
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-stone-500/10 dark:bg-stone-900/30',
    text: 'text-stone-600 dark:text-stone-400',
    border: 'border-stone-300 dark:border-stone-800',
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const RfqMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Modals State
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingRfq, setEditingRfq] = useState<RfqHeaderRecord | null>(null);

  const [isCsModalOpen, setIsCsModalOpen] = useState<boolean>(false);
  const [csTargetRfq, setCsTargetRfq] = useState<RfqHeaderRecord | null>(null);

  const [isQuoteModalOpen, setIsQuoteModalOpen] = useState<boolean>(false);
  const [quoteTargetRfq, setQuoteTargetRfq] = useState<RfqHeaderRecord | null>(
    null,
  );
  const [selectedVendorPartyId, setSelectedVendorPartyId] = useState<
    number | ''
  >('');
  const [quoteRef, setQuoteRef] = useState<string>('');
  const [quoteDate, setQuoteDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [quotePaymentTerms, setQuotePaymentTerms] =
    useState<string>('30 Days Net');
  const [quoteLeadTimeDays, setQuoteLeadTimeDays] = useState<number>(7);
  const [quoteRemarks, setQuoteRemarks] = useState<string>('');
  const [quoteItems, setQuoteItems] = useState<
    {
      rfqItemId: number;
      itemCode: string;
      itemName: string;
      uomCode: string;
      requiredQty: number;
      offeredQty: number;
      quotedRate: number;
      discountPct: number;
      taxPct: number;
      remarks: string;
    }[]
  >([]);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printTarget, setPrintTarget] = useState<RfqHeaderRecord | null>(null);
  const [printDocType, setPrintDocType] = useState<'INQUIRY' | 'CS'>('CS');

  const [deleteTarget, setDeleteTarget] = useState<RfqHeaderRecord | null>(
    null,
  );
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(
    null,
  );
  const [deleteConflicts, setDeleteConflicts] = useState<
    DependencyConflictItem[]
  >([]);

  // Award State
  const [awardVendorId, setAwardVendorId] = useState<number | ''>('');
  const [awardRemarks, setAwardRemarks] = useState<string>('');

  // Form State
  const [formRfqNo, setFormRfqNo] = useState<string>('');
  const [formRfqDate, setFormRfqDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [formDueDate, setFormDueDate] = useState<string>(
    new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
  );
  const [formWarehouseId, setFormWarehouseId] = useState<number | ''>('');
  const [formPaymentTerms, setFormPaymentTerms] =
    useState<string>('30 Days Net from GRN');
  const [formDeliveryTerms, setFormDeliveryTerms] =
    useState<string>('FOR Destination Plant');
  const [formRemarks, setFormRemarks] = useState<string>('');
  const [formItems, setFormItems] = useState<RfqItemRecord[]>([]);
  const [formVendorPartyIds, setFormVendorPartyIds] = useState<number[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // DATA FETCHING
  // --------------------------------------------------------------------------

  // 1. KPI Summary
  const { data: summary, isLoading: isSummaryLoading } = useQuery<RfqSummary>({
    queryKey: ['procurement', 'rfqs', 'summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<RfqSummary>>(
        '/procurement/rfqs/summary',
      );
      return res.data.data;
    },
  });

  // 2. RFQ Register
  const { data: rfqs = [], isLoading: isRfqsLoading } = useQuery<
    RfqHeaderRecord[]
  >({
    queryKey: [
      'procurement',
      'rfqs',
      'list',
      statusFilter,
      warehouseFilter,
      globalSearch,
    ],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (warehouseFilter !== 'ALL') params.warehouseId = warehouseFilter;
      if (globalSearch.trim()) params.search = globalSearch.trim();

      const res = await apiClient.get<ApiResponse<RfqHeaderRecord[]>>(
        '/procurement/rfqs',
        { params },
      );
      return res.data.data;
    },
  });

  // 3. Dropdowns
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
        email: p.email,
        phone: p.phone,
      }));
    },
    staleTime: 60_000,
  });

  // Approved PRs to pull from
  const { data: approvedPrs = [] } = useQuery<ApprovedPrOption[]>({
    queryKey: ['procurement', 'requisitions', 'approved-for-rfq'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>(
        '/procurement/requisitions',
        { params: { status: 'APPROVED' } },
      );
      return res.data.data || [];
    },
    staleTime: 30_000,
  });

  // Comparative Statement Data for CS Target
  const { data: csData, isLoading: isCsLoading } =
    useQuery<ComparativeStatementData>({
      queryKey: [
        'procurement',
        'rfq',
        'comparative-statement',
        csTargetRfq?.rfqId,
      ],
      queryFn: async () => {
        if (!csTargetRfq) return null as any;
        const res = await apiClient.get<ApiResponse<ComparativeStatementData>>(
          `/procurement/rfqs/${csTargetRfq.rfqId}/comparative-statement`,
        );
        return res.data.data;
      },
      enabled: !!csTargetRfq,
    });

  // RFQ Details for Print / Quote modal
  const { data: printDetailData, isLoading: isPrintLoading } =
    useQuery<ComparativeStatementData>({
      queryKey: ['procurement', 'rfq', 'print-cs', printTarget?.rfqId],
      queryFn: async () => {
        if (!printTarget) return null as any;
        const res = await apiClient.get<ApiResponse<ComparativeStatementData>>(
          `/procurement/rfqs/${printTarget.rfqId}/comparative-statement`,
        );
        return res.data.data;
      },
      enabled: !!printTarget,
    });

  // --------------------------------------------------------------------------
  // MUTATIONS
  // --------------------------------------------------------------------------

  // Save RFQ (Create / Update)
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!formWarehouseId) {
        throw new Error('Please select receiving warehouse / store');
      }
      if (!formDueDate) {
        throw new Error('Please specify quotation deadline date');
      }
      if (formItems.length === 0) {
        throw new Error('Please add at least one line item to inquiry');
      }

      for (let idx = 0; idx < formItems.length; idx++) {
        const it = formItems[idx];
        if (!it.itemId) {
          throw new Error(`Line #${idx + 1}: SKU Item is required`);
        }
        if (!it.requiredQty || it.requiredQty <= 0) {
          throw new Error(
            `Line #${idx + 1}: Required Quantity must be greater than 0`,
          );
        }
      }

      const payload = {
        rfqNo: formRfqNo.trim() ? formRfqNo.trim().toUpperCase() : undefined,
        rfqDate: formRfqDate,
        dueDate: formDueDate,
        warehouseId: Number(formWarehouseId),
        paymentTerms: formPaymentTerms.trim() || undefined,
        deliveryTerms: formDeliveryTerms.trim() || undefined,
        remarks: formRemarks.trim() || undefined,
        items: formItems.map((it) => ({
          itemId: it.itemId,
          uomId: it.uomId,
          requiredQty: Number(it.requiredQty),
          targetRate: Number(it.targetRate) || 0,
          technicalSpecs: it.technicalSpecs?.trim() || undefined,
          prItemId: it.prItemId || null,
        })),
        vendorPartyIds: formVendorPartyIds,
      };

      if (editingRfq) {
        const res = await apiClient.put<ApiResponse<RfqHeaderRecord>>(
          `/procurement/rfqs/${editingRfq.rfqId}`,
          payload,
        );
        return res.data.data;
      } else {
        const res = await apiClient.post<ApiResponse<RfqHeaderRecord>>(
          '/procurement/rfqs',
          payload,
        );
        return res.data.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'rfqs'] });
      setIsEditorOpen(false);
      setEditingRfq(null);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(
        err.response?.data?.message || err.message || 'Failed to save RFQ',
      );
    },
  });

  // Issue RFQ to Vendors (Send)
  const sendMutation = useMutation({
    mutationFn: async (rfqId: number) => {
      const res = await apiClient.post<ApiResponse<RfqHeaderRecord>>(
        `/procurement/rfqs/${rfqId}/send`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'rfqs'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || 'Failed to send RFQ');
    },
  });

  // Record Vendor Quotation
  const recordQuoteMutation = useMutation({
    mutationFn: async () => {
      if (!quoteTargetRfq || !selectedVendorPartyId) {
        throw new Error('Please select vendor');
      }
      if (!quoteRef.trim()) {
        throw new Error('Please enter Vendor Quotation Reference No');
      }

      const payload = {
        vendorQuoteRef: quoteRef.trim(),
        quoteDate,
        paymentTerms: quotePaymentTerms.trim() || undefined,
        deliveryLeadTimeDays: Number(quoteLeadTimeDays) || 0,
        vendorRemarks: quoteRemarks.trim() || undefined,
        items: quoteItems.map((it) => ({
          rfqItemId: it.rfqItemId,
          offeredQty: Number(it.offeredQty),
          quotedRate: Number(it.quotedRate),
          discountPct: Number(it.discountPct) || 0,
          taxPct: Number(it.taxPct) || 18.0,
          remarks: it.remarks?.trim() || undefined,
        })),
      };

      const res = await apiClient.post<ApiResponse<any>>(
        `/procurement/rfqs/${quoteTargetRfq.rfqId}/vendors/${selectedVendorPartyId}/quote`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'rfqs'] });
      setIsQuoteModalOpen(false);
      setQuoteTargetRfq(null);
    },
    onError: (err: any) => {
      alert(
        err.response?.data?.message ||
          err.message ||
          'Failed to record vendor quotation',
      );
    },
  });

  // Award RFQ
  const awardMutation = useMutation({
    mutationFn: async () => {
      if (!csTargetRfq || !awardVendorId) {
        throw new Error('Please select winning vendor to award');
      }
      if (!awardRemarks.trim()) {
        throw new Error('Please specify selection justification remarks');
      }

      const res = await apiClient.post<ApiResponse<RfqHeaderRecord>>(
        `/procurement/rfqs/${csTargetRfq.rfqId}/award`,
        {
          awardedVendorId: Number(awardVendorId),
          awardedRemarks: awardRemarks.trim(),
        },
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'rfqs'] });
      setIsCsModalOpen(false);
      setCsTargetRfq(null);
      setAwardVendorId('');
      setAwardRemarks('');
    },
    onError: (err: any) => {
      alert(
        err.response?.data?.message || err.message || 'Failed to award RFQ',
      );
    },
  });

  // Delete RFQ
  const deleteMutation = useMutation({
    mutationFn: async (rfqId: number) => {
      const res = await apiClient.delete<ApiResponse<any>>(
        `/procurement/rfqs/${rfqId}`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'rfqs'] });
      setDeleteTarget(null);
      setDeleteErrorMessage(null);
      setDeleteConflicts([]);
    },
    onError: (err: any) => {
      const data = err.response?.data;
      setDeleteErrorMessage(
        data?.message || err.message || 'Unable to delete RFQ.',
      );
      if (data?.details?.conflicts) {
        setDeleteConflicts(data.details.conflicts);
      }
    },
  });

  // --------------------------------------------------------------------------
  // HANDLERS
  // --------------------------------------------------------------------------

  const handleOpenCreateModal = () => {
    setEditingRfq(null);
    setFormRfqNo('');
    setFormRfqDate(new Date().toISOString().split('T')[0]);
    setFormDueDate(
      new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
    );
    setFormWarehouseId(warehouses[0]?.warehouseId || '');
    setFormPaymentTerms('30 Days Net from GRN');
    setFormDeliveryTerms('FOR Destination Plant');
    setFormRemarks('');
    setFormItems([]);
    setFormVendorPartyIds([]);
    setFormError(null);
    setIsEditorOpen(true);
  };

  const handleOpenEditModal = async (row: RfqHeaderRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<RfqHeaderRecord>>(
        `/procurement/rfqs/${row.rfqId}`,
      );
      const r = res.data.data;
      setEditingRfq(r);
      setFormRfqNo(r.rfqNo);
      setFormRfqDate(r.rfqDate);
      setFormDueDate(r.dueDate);
      setFormWarehouseId(r.warehouseId);
      setFormPaymentTerms(r.paymentTerms || '');
      setFormDeliveryTerms(r.deliveryTerms || '');
      setFormRemarks(r.remarks || '');
      setFormItems(r.items || []);
      setFormVendorPartyIds((r.vendors || []).map((v) => v.partyId));
      setFormError(null);
      setIsEditorOpen(true);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch RFQ details');
    }
  };

  const handleOpenQuoteModal = async (row: RfqHeaderRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<RfqHeaderRecord>>(
        `/procurement/rfqs/${row.rfqId}`,
      );
      const r = res.data.data;
      setQuoteTargetRfq(r);
      setSelectedVendorPartyId(r.vendors?.[0]?.partyId || '');
      setQuoteRef('');
      setQuoteDate(new Date().toISOString().split('T')[0]);
      setQuotePaymentTerms('30 Days Net');
      setQuoteLeadTimeDays(7);
      setQuoteRemarks('');
      setQuoteItems(
        (r.items || []).map((it) => ({
          rfqItemId: it.rfqItemId!,
          itemCode: it.itemCode || '',
          itemName: it.itemName || '',
          uomCode: it.uomCode || '',
          requiredQty: it.requiredQty,
          offeredQty: it.requiredQty,
          quotedRate: it.targetRate || 0,
          discountPct: 0,
          taxPct: 18.0,
          remarks: '',
        })),
      );
      setIsQuoteModalOpen(true);
    } catch (err: any) {
      alert(err.message || 'Failed to load RFQ items');
    }
  };

  const handleOpenCsModal = (row: RfqHeaderRecord) => {
    setCsTargetRfq(row);
    setAwardVendorId(row.awardedVendorId || '');
    setAwardRemarks(row.awardedRemarks || '');
    setIsCsModalOpen(true);
  };

  const handleOpenPrintModal = (
    row: RfqHeaderRecord,
    type: 'INQUIRY' | 'CS' = 'CS',
  ) => {
    setPrintTarget(row);
    setPrintDocType(type);
    setIsPrintModalOpen(true);
    apiClient
      .post('/procurement/rfqs/actions/log', { actionType: 'PRINT' })
      .catch(() => {});
  };

  const handleExportClick = () => {
    apiClient
      .post('/procurement/rfqs/actions/log', { actionType: 'EXPORT' })
      .catch(() => {});
  };

  // Line item helpers
  const handleAddItemRow = () => {
    if (itemsCatalog.length === 0) return;
    const defaultItem = itemsCatalog[0];
    const defaultUom =
      uomsCatalog.find((u) => u.uomId === defaultItem.baseUomId) ||
      uomsCatalog[0];

    const newItem: RfqItemRecord = {
      itemId: defaultItem.itemId,
      itemCode: defaultItem.itemCode,
      itemName: defaultItem.itemName,
      itemType: defaultItem.itemType,
      uomId: defaultUom?.uomId || defaultItem.baseUomId,
      uomCode: defaultUom?.uomCode,
      requiredQty: 10,
      targetRate: defaultItem.purchaseRate || 0,
      technicalSpecs: '',
    };
    setFormItems([...formItems, newItem]);
  };

  const handleUpdateItemRow = (
    idx: number,
    field: keyof RfqItemRecord,
    val: any,
  ) => {
    const updated = [...formItems];
    const item = { ...updated[idx] };

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
        item.targetRate = selected.purchaseRate || 0;
      }
    } else if (field === 'uomId') {
      item.uomId = Number(val);
      const uomObj = uomsCatalog.find((u) => u.uomId === Number(val));
      item.uomCode = uomObj?.uomCode;
    } else if (field === 'requiredQty') {
      item.requiredQty = Math.max(0, Number(val));
    } else if (field === 'targetRate') {
      item.targetRate = Math.max(0, Number(val));
    } else if (field === 'technicalSpecs') {
      item.technicalSpecs = val;
    }

    updated[idx] = item;
    setFormItems(updated);
  };

  const handleRemoveItemRow = (idx: number) => {
    setFormItems(formItems.filter((_, i) => i !== idx));
  };

  // Toggle Invited Vendor
  const handleToggleVendor = (partyId: number) => {
    if (formVendorPartyIds.includes(partyId)) {
      setFormVendorPartyIds(formVendorPartyIds.filter((id) => id !== partyId));
    } else {
      setFormVendorPartyIds([...formVendorPartyIds, partyId]);
    }
  };

  // Import from Approved PR
  const handleImportFromPr = (pr: ApprovedPrOption) => {
    if (!pr.items || pr.items.length === 0) return;
    const newItems: RfqItemRecord[] = pr.items.map((it) => ({
      prItemId: it.prItemId,
      prNo: pr.prNo,
      itemId: it.itemId,
      itemCode: it.itemCode,
      itemName: it.itemName,
      uomId: it.uomId,
      uomCode: it.uomCode,
      requiredQty: it.approvedQty,
      targetRate: it.estimatedRate,
      technicalSpecs: `Imported from Requisition #${pr.prNo}`,
    }));
    setFormItems([...formItems, ...newItems]);
  };

  // --------------------------------------------------------------------------
  // TABLE COLUMNS CONFIGURATION
  // --------------------------------------------------------------------------

  const columns = useMemo<MasterTableColumn<RfqHeaderRecord>[]>(
    () => [
      {
        key: 'rfqNo',
        header: 'RFQ No & Status',
        sortable: true,
        sortValue: (r) => r.rfqNo,
        render: (row) => {
          const badge = STATUS_BADGE_MAP[row.status] || STATUS_BADGE_MAP.DRAFT;
          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-foreground text-sm">
                  {row.rfqNo}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                >
                  {badge.label}
                </span>
              </div>
              <span
                className="text-xs text-muted-foreground truncate max-w-xs"
                title={row.remarks || ''}
              >
                {row.remarks || 'Standard Material Sourcing'}
              </span>
            </div>
          );
        },
      },
      {
        key: 'dates',
        header: 'Issue / Due Date',
        sortable: true,
        sortValue: (r) => r.dueDate,
        render: (row) => {
          const isOverdue =
            new Date(row.dueDate) < new Date() &&
            row.status !== 'AWARDED' &&
            row.status !== 'CANCELLED';
          return (
            <div className="flex flex-col text-xs">
              <span className="font-mono text-muted-foreground flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Issued: {row.rfqDate}
              </span>
              <span
                className={`font-mono flex items-center gap-1 mt-0.5 font-semibold ${
                  isOverdue
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                <Clock className="w-3 h-3" />
                Due: {row.dueDate} {isOverdue && '(Closed)'}
              </span>
            </div>
          );
        },
      },
      {
        key: 'warehouse',
        header: 'Plant / Warehouse',
        sortable: true,
        sortValue: (r) => r.warehouseName,
        render: (row) => (
          <div className="flex flex-col text-xs">
            <span className="font-medium text-foreground flex items-center gap-1">
              <Warehouse className="w-3 h-3 text-muted-foreground" />
              {row.warehouseName}
            </span>
            <span className="text-muted-foreground">
              Terms: {row.deliveryTerms || 'FOR Destination'}
            </span>
          </div>
        ),
      },
      {
        key: 'vendors',
        header: 'Invited / Quoted',
        sortable: false,
        render: (row) => (
          <div className="flex flex-col text-xs">
            <span className="text-foreground flex items-center gap-1">
              <Users className="w-3 h-3 text-muted-foreground" />
              {row.invitedVendorsCount} Vendors Invited
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
              <CheckCircle2 className="w-3 h-3" />
              {row.quotesReceivedCount} Quotes Received
            </span>
          </div>
        ),
      },
      {
        key: 'award',
        header: 'Awarded Supplier',
        sortable: false,
        render: (row) =>
          row.awardedVendorName ? (
            <div className="flex flex-col text-xs">
              <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                {row.awardedVendorName}
              </span>
              <span className="text-muted-foreground font-mono text-[11px]">
                Awarded: {row.awardedDate?.split('T')[0]}
              </span>
            </div>
          ) : row.status === 'COMPARISON_DONE' ? (
            <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
              <Clock className="w-3 h-3" /> Ready for Award
            </span>
          ) : (
            <span className="text-muted-foreground text-xs italic">
              In Evaluation
            </span>
          ),
      },
    ],
    [],
  );

  const groupByOptions = useMemo<GroupByOption<RfqHeaderRecord>[]>(
    () => [
      {
        key: 'status',
        label: 'Status',
        groupValue: (r) => STATUS_BADGE_MAP[r.status]?.label || r.status,
      },
      {
        key: 'warehouse',
        label: 'Warehouse',
        groupValue: (r) => r.warehouseName,
      },
      {
        key: 'awarded',
        label: 'Awarded Supplier',
        groupValue: (r) => r.awardedVendorName || 'Not Awarded',
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      {/* Title & Top Action */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Requests for Quotation (RFQ) & CS
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Procurement & Sourcing
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Supplier multi-vendor tenders, quotation bid entry, automated L1
            comparative statements, and purchase awarding.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGate screen="PROCUREMENT_RFQ" action="ADD">
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New RFQ Tender
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total RFQs */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total RFQ Tenders
            </p>
            <p className="text-2xl font-bold font-mono text-foreground">
              {isSummaryLoading ? '...' : summary?.totalRfqs ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">All sourcing rounds</p>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
        </div>

        {/* Open Inquiries */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Open Inquiries
            </p>
            <p className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
              {isSummaryLoading ? '...' : summary?.openCount ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Drafts & Sent to vendors</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Send className="w-6 h-6" />
          </div>
        </div>

        {/* In Evaluation / Comparison */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Comparative Analysis
            </p>
            <p className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
              {isSummaryLoading ? '...' : summary?.evaluatingCount ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Bids received & CS ready</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Awarded / Finalized */}
        <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Contracts Awarded
            </p>
            <p className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {isSummaryLoading ? '...' : summary?.awardedCount ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">Ready for Purchase Order</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Award className="w-6 h-6" />
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
                ['ALL', 'All Tenders'],
                ['DRAFT', 'Draft'],
                ['SENT', 'Sent'],
                ['QUOTES_RECEIVED', 'Quotes In'],
                ['COMPARISON_DONE', 'CS Ready'],
                ['AWARDED', 'Awarded'],
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

          {/* Warehouse Selector */}
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

      {/* Master Data Table */}
      <MasterDataTable<RfqHeaderRecord>
        title="RFQ Inquiries & Comparative Register"
        subtitle="Multi-vendor supplier tenders with bid analysis and contract award audit"
        screenCode="PROCUREMENT_RFQ"
        data={rfqs}
        rowKey={(row) => row.rfqId}
        isLoading={isRfqsLoading}
        columns={columns}
        groupByOptions={groupByOptions}
        onExportClick={handleExportClick}
        searchPredicate={(row, query) => {
          const q = query.toLowerCase();
          return (
            row.rfqNo.toLowerCase().includes(q) ||
            (row.remarks ? row.remarks.toLowerCase().includes(q) : false) ||
            row.warehouseName.toLowerCase().includes(q) ||
            (row.awardedVendorName
              ? row.awardedVendorName.toLowerCase().includes(q)
              : false)
          );
        }}
        renderRowActions={(row) => (
          <div className="flex items-center gap-1.5 justify-end">
            {/* View / Evaluate Comparative Statement (CS) */}
            <PermissionGate screen="PROCUREMENT_RFQ" action="VIEW">
              <button
                onClick={() => handleOpenCsModal(row)}
                title="View Comparative Statement (CS)"
                className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>
            </PermissionGate>

            {/* Print Inquiries / CS */}
            <PermissionGate screen="PROCUREMENT_RFQ" action="PRINT">
              <button
                onClick={() => handleOpenPrintModal(row, 'CS')}
                title="Print CS Sheet & Inquiry Voucher"
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              >
                <Printer className="w-4 h-4" />
              </button>
            </PermissionGate>

            {/* Enter Vendor Quotation (Sent or In Evaluation) */}
            {row.status !== 'AWARDED' && row.status !== 'CANCELLED' && (
              <PermissionGate screen="PROCUREMENT_RFQ" action="EDIT">
                <button
                  onClick={() => handleOpenQuoteModal(row)}
                  title="Record Supplier Quotation Bid"
                  className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors"
                >
                  <DollarSign className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {/* Send to Vendors (Draft only) */}
            {row.status === 'DRAFT' && (
              <PermissionGate screen="PROCUREMENT_RFQ" action="SEND">
                <button
                  onClick={() => {
                    if (
                      window.confirm(
                        `Issue RFQ inquiry ${row.rfqNo} to invited suppliers?`,
                      )
                    ) {
                      sendMutation.mutate(row.rfqId);
                    }
                  }}
                  title="Issue to Invited Vendors"
                  disabled={sendMutation.isPending}
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {/* Edit (Draft or Sent only) */}
            {(row.status === 'DRAFT' || row.status === 'SENT') && (
              <PermissionGate screen="PROCUREMENT_RFQ" action="EDIT">
                <button
                  onClick={() => handleOpenEditModal(row)}
                  title="Edit RFQ Tender"
                  className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {/* Delete (Draft or Cancelled only) */}
            {(row.status === 'DRAFT' || row.status === 'CANCELLED') && (
              <PermissionGate screen="PROCUREMENT_RFQ" action="DELETE">
                <button
                  onClick={() => {
                    setDeleteTarget(row);
                    setDeleteErrorMessage(null);
                    setDeleteConflicts([]);
                  }}
                  title="Delete RFQ"
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
      {/* CREATE / EDIT RFQ TENDER MODAL */}
      {/* ==================================================================== */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 text-primary rounded-lg">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">
                    {editingRfq
                      ? `Edit RFQ Inquiry #${editingRfq.rfqNo}`
                      : 'Create Supplier Request for Quotation (RFQ)'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Define tender specifications, line items, and select invited vendor suppliers.
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

              {/* Quick Import from Approved PR */}
              {approvedPrs.length > 0 && !editingRfq && (
                <div className="p-3 bg-muted/30 border border-border rounded-lg text-xs space-y-1.5">
                  <span className="font-bold text-foreground flex items-center gap-1.5">
                    <FileCheck2 className="w-4 h-4 text-emerald-600" />
                    Quick Sourcing: Pull Items from Approved Purchase Requisitions
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {approvedPrs.map((pr) => (
                      <button
                        key={pr.prId}
                        type="button"
                        onClick={() => handleImportFromPr(pr)}
                        className="px-2.5 py-1 rounded-md bg-card border border-border hover:border-primary text-foreground font-mono text-[11px] transition-colors"
                      >
                        + {pr.prNo} ({pr.itemsCount} items)
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Header Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* RFQ No */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    RFQ Number (Auto if blank)
                  </label>
                  <input
                    type="text"
                    value={formRfqNo}
                    onChange={(e) => setFormRfqNo(e.target.value)}
                    placeholder="RFQ-AHM-2627-XXXX"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background text-foreground font-mono uppercase focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* RFQ Date */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Issue Date *
                  </label>
                  <input
                    type="date"
                    value={formRfqDate}
                    onChange={(e) => setFormRfqDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* Due Date */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Quotation Due Date *
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* Warehouse */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Receiving Warehouse / Plant *
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
                    <option value="">-- Select Destination --</option>
                    {warehouses.map((w) => (
                      <option key={w.warehouseId} value={w.warehouseId}>
                        {w.warehouseName} ({w.warehouseCode})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Terms */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    value={formPaymentTerms}
                    onChange={(e) => setFormPaymentTerms(e.target.value)}
                    placeholder="e.g. 30 Days Net from GRN"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* Delivery Terms */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Delivery Terms
                  </label>
                  <input
                    type="text"
                    value={formDeliveryTerms}
                    onChange={(e) => setFormDeliveryTerms(e.target.value)}
                    placeholder="e.g. FOR Destination Plant"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* Remarks */}
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Tender Scope / Inquiry Description
                  </label>
                  <input
                    type="text"
                    value={formRemarks}
                    onChange={(e) => setFormRemarks(e.target.value)}
                    placeholder="e.g. Bulk procurement of cold-rolled coils for Q1 production run"
                    className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Line Items Section */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-primary" />
                    Inquiry Line Items ({formItems.length})
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
                    <p>No items added to inquiry yet.</p>
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
                          <th className="py-2.5 px-2 font-semibold min-w-[110px] text-right">Req. Qty *</th>
                          <th className="py-2.5 px-2 font-semibold min-w-[120px] text-right">Target Rate (₹)</th>
                          <th className="py-2.5 px-2 font-semibold min-w-[200px]">Technical Specs / Tolerance</th>
                          <th className="py-2.5 px-2 text-center w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {formItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/20">
                            {/* SKU Item */}
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

                            {/* Target Rate */}
                            <td className="p-2">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={item.targetRate}
                                onChange={(e) =>
                                  handleUpdateItemRow(
                                    idx,
                                    'targetRate',
                                    e.target.value,
                                  )
                                }
                                className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background text-foreground font-mono text-right focus:ring-1 focus:ring-primary focus:outline-none"
                              />
                            </td>

                            {/* Technical Specs */}
                            <td className="p-2">
                              <input
                                type="text"
                                value={item.technicalSpecs || ''}
                                placeholder="Grade, tolerance, packaging..."
                                onChange={(e) =>
                                  handleUpdateItemRow(
                                    idx,
                                    'technicalSpecs',
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Invited Vendors Selection */}
              <div className="space-y-3 pt-2 border-t border-border">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-primary" />
                  Invite Qualified Suppliers ({formVendorPartyIds.length} Selected)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1 border border-border rounded-lg">
                  {suppliers.map((s) => {
                    const isSelected = formVendorPartyIds.includes(s.partyId);
                    return (
                      <div
                        key={s.partyId}
                        onClick={() => handleToggleVendor(s.partyId)}
                        className={`p-2.5 rounded-lg border text-xs cursor-pointer transition-colors flex items-center justify-between ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-foreground'
                            : 'bg-card border-border hover:bg-muted/40 text-muted-foreground'
                        }`}
                      >
                        <div className="truncate">
                          <p className="font-semibold text-foreground truncate">
                            {s.partyName}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {s.partyCode}
                          </p>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded text-primary focus:ring-primary pointer-events-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border flex items-center justify-between bg-muted/20">
              <span className="text-xs text-muted-foreground">
                RFQ will save as DRAFT until issued to suppliers.
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
                  {saveMutation.isPending ? 'Saving...' : 'Save RFQ Tender'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* VENDOR QUOTATION ENTRY MODAL */}
      {/* ==================================================================== */}
      {isQuoteModalOpen && quoteTargetRfq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">
                    Record Supplier Quotation Bid ({quoteTargetRfq.rfqNo})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Enter received rates, discounts, delivery lead time, and payment terms.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsQuoteModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Select Vendor */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Quoting Vendor *
                  </label>
                  <select
                    value={selectedVendorPartyId}
                    onChange={(e) =>
                      setSelectedVendorPartyId(
                        e.target.value ? Number(e.target.value) : '',
                      )
                    }
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-border bg-background text-foreground font-semibold focus:ring-1 focus:ring-primary focus:outline-none"
                  >
                    <option value="">-- Select Vendor --</option>
                    {(quoteTargetRfq.vendors || []).map((v) => (
                      <option key={v.partyId} value={v.partyId}>
                        {v.partyName} ({v.partyCode})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quote Ref */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Vendor Quote Reference *
                  </label>
                  <input
                    type="text"
                    value={quoteRef}
                    onChange={(e) => setQuoteRef(e.target.value)}
                    placeholder="e.g. JSW-QT-2026-99"
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-border bg-background text-foreground font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* Quote Date */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Quotation Date *
                  </label>
                  <input
                    type="date"
                    value={quoteDate}
                    onChange={(e) => setQuoteDate(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* Payment Terms */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Offered Payment Terms
                  </label>
                  <input
                    type="text"
                    value={quotePaymentTerms}
                    onChange={(e) => setQuotePaymentTerms(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* Lead Time Days */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Lead Time (Days)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={quoteLeadTimeDays}
                    onChange={(e) => setQuoteLeadTimeDays(Number(e.target.value))}
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-border bg-background text-foreground font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    Vendor Remarks
                  </label>
                  <input
                    type="text"
                    value={quoteRemarks}
                    onChange={(e) => setQuoteRemarks(e.target.value)}
                    placeholder="Stockyard location, freight terms..."
                    className="w-full text-xs px-2.5 py-2 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Line Items Bid Grid */}
              <div className="space-y-2 pt-2 border-t border-border">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Quoted Rates & Taxes by Line Item
                </h4>
                <div className="border border-border rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-2 px-3 font-semibold">SKU / Item</th>
                        <th className="py-2 px-2 font-semibold">UOM</th>
                        <th className="py-2 px-2 font-semibold text-right">Req. Qty</th>
                        <th className="py-2 px-2 font-semibold text-right">Quoted Rate (₹)</th>
                        <th className="py-2 px-2 font-semibold text-right">Disc %</th>
                        <th className="py-2 px-2 font-semibold text-right">Tax %</th>
                        <th className="py-2 px-3 font-semibold text-right">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {quoteItems.map((it, idx) => {
                        const netRate =
                          (Number(it.quotedRate) || 0) *
                          (1 - (Number(it.discountPct) || 0) / 100);
                        const lineTotal =
                          netRate *
                          (Number(it.offeredQty) || 0) *
                          (1 + (Number(it.taxPct) || 18) / 100);

                        return (
                          <tr key={it.rfqItemId} className="hover:bg-muted/20">
                            <td className="p-2">
                              <span className="font-bold text-foreground block">
                                {it.itemCode}
                              </span>
                              <span className="font-sans text-muted-foreground text-[11px]">
                                {it.itemName}
                              </span>
                            </td>
                            <td className="p-2 text-muted-foreground font-sans">
                              {it.uomCode}
                            </td>
                            <td className="p-2 text-right font-mono">
                              {it.requiredQty}
                            </td>
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={it.quotedRate}
                                onChange={(e) => {
                                  const updated = [...quoteItems];
                                  updated[idx].quotedRate = Math.max(
                                    0,
                                    Number(e.target.value),
                                  );
                                  setQuoteItems(updated);
                                }}
                                className="w-24 text-xs px-2 py-1 rounded-md border border-border bg-background text-foreground text-right font-mono font-bold focus:ring-1 focus:ring-primary focus:outline-none"
                              />
                            </td>
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                max="100"
                                value={it.discountPct}
                                onChange={(e) => {
                                  const updated = [...quoteItems];
                                  updated[idx].discountPct = Math.max(
                                    0,
                                    Number(e.target.value),
                                  );
                                  setQuoteItems(updated);
                                }}
                                className="w-16 text-xs px-2 py-1 rounded-md border border-border bg-background text-foreground text-right font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                              />
                            </td>
                            <td className="p-2 text-right">
                              <input
                                type="number"
                                step="any"
                                min="0"
                                value={it.taxPct}
                                onChange={(e) => {
                                  const updated = [...quoteItems];
                                  updated[idx].taxPct = Math.max(
                                    0,
                                    Number(e.target.value),
                                  );
                                  setQuoteItems(updated);
                                }}
                                className="w-16 text-xs px-2 py-1 rounded-md border border-border bg-background text-foreground text-right font-mono focus:ring-1 focus:ring-primary focus:outline-none"
                              />
                            </td>
                            <td className="p-2 text-right font-mono font-bold text-foreground">
                              ₹ {lineTotal.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border flex items-center justify-end gap-2 bg-muted/20">
              <button
                type="button"
                onClick={() => setIsQuoteModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-muted-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => recordQuoteMutation.mutate()}
                disabled={recordQuoteMutation.isPending}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-sm disabled:opacity-50"
              >
                {recordQuoteMutation.isPending
                  ? 'Saving Quote...'
                  : 'Save Vendor Quotation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* COMPARATIVE STATEMENT (CS) & CONTRACT AWARD MODAL */}
      {/* ==================================================================== */}
      {isCsModalOpen && csTargetRfq && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-foreground">
                    Comparative Statement (CS): {csTargetRfq.rfqNo}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Item-by-item bid comparison with automatic L1 bidder identification and price variance.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {isCsLoading ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  Evaluating comparative statements...
                </div>
              ) : !csData?.comparisonItems || csData.comparisonItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No line items or quotation bids recorded yet.
                </div>
              ) : (
                <>
                  {/* Vendor Grand Totals Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {csData.vendorSummaries.map((v) => (
                      <div
                        key={v.partyId}
                        className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                          v.totalQuotedAmount > 0
                            ? 'bg-card border-border'
                            : 'bg-muted/20 border-dashed border-border opacity-60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground truncate">
                            {v.partyName}
                          </span>
                          {v.l1WinsCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              L1 in {v.l1WinsCount} item(s)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground flex justify-between">
                          <span>Quote Ref: {v.vendorQuoteRef || 'Awaiting'}</span>
                          <span>Lead: {v.deliveryLeadTimeDays}d</span>
                        </div>
                        <div className="pt-1 border-t border-border flex justify-between items-center font-mono">
                          <span className="text-muted-foreground">Total Bid:</span>
                          <span className="font-bold text-foreground">
                            ₹ {Number(v.totalQuotedAmount).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Matrix Table */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-primary" />
                      Item-by-Item Rate Comparison Matrix
                    </h4>
                    <div className="border border-border rounded-lg overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-muted text-muted-foreground border-b border-border">
                            <th className="py-2.5 px-3 font-semibold min-w-[180px]">SKU / Description</th>
                            <th className="py-2.5 px-2 font-semibold">UOM</th>
                            <th className="py-2.5 px-2 font-semibold text-right">Req. Qty</th>
                            <th className="py-2.5 px-2 font-semibold text-right">Target (₹)</th>
                            <th className="py-2.5 px-3 font-semibold min-w-[240px]">Lowest (L1) Bidder</th>
                            <th className="py-2.5 px-2 font-semibold text-right">L1 Net Rate</th>
                            <th className="py-2.5 px-2 font-semibold text-right">Variance</th>
                            <th className="py-2.5 px-3 font-semibold text-right">Total L1 (₹)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {csData.comparisonItems.map((item) => (
                            <tr key={item.rfqItemId} className="hover:bg-muted/10">
                              <td className="py-2 px-3">
                                <span className="font-bold text-foreground block">
                                  {item.itemCode}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {item.itemName}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-muted-foreground">
                                {item.uomCode}
                              </td>
                              <td className="py-2 px-2 text-right font-mono">
                                {item.requiredQty}
                              </td>
                              <td className="py-2 px-2 text-right font-mono text-muted-foreground">
                                ₹ {Number(item.targetRate).toFixed(2)}
                              </td>
                              <td className="py-2 px-3">
                                {item.l1Quote ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                      {item.l1Quote.partyName}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground italic">
                                    No quotes received
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-bold text-foreground">
                                {item.l1Quote
                                  ? `₹ ${Number(item.l1Quote.netRate).toFixed(2)}`
                                  : '—'}
                              </td>
                              <td className="py-2 px-2 text-right font-mono">
                                {item.l1Quote ? (
                                  <span
                                    className={`font-semibold inline-flex items-center gap-0.5 ${
                                      item.l1Quote.variancePct <= 0
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-amber-600 dark:text-amber-400'
                                    }`}
                                  >
                                    {item.l1Quote.variancePct <= 0 ? (
                                      <TrendingDown className="w-3 h-3" />
                                    ) : (
                                      <TrendingUp className="w-3 h-3" />
                                    )}
                                    {item.l1Quote.variancePct}%
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                                {item.l1Quote
                                  ? `₹ ${Number(item.l1Quote.totalAmount).toFixed(2)}`
                                  : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Award Contract Section */}
                  {csTargetRfq.status !== 'AWARDED' && (
                    <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-3">
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-amber-500" />
                        Finalize & Award Purchase Contract
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1">
                            Winning Vendor *
                          </label>
                          <select
                            value={awardVendorId}
                            onChange={(e) =>
                              setAwardVendorId(
                                e.target.value ? Number(e.target.value) : '',
                              )
                            }
                            className="w-full text-xs px-2.5 py-2 rounded-lg border border-border bg-background text-foreground font-semibold focus:ring-1 focus:ring-primary focus:outline-none"
                          >
                            <option value="">-- Choose Awardee Supplier --</option>
                            {csData.vendorSummaries
                              .filter((v) => v.totalQuotedAmount > 0)
                              .map((v) => (
                                <option key={v.partyId} value={v.partyId}>
                                  {v.partyName} (Total: ₹{' '}
                                  {v.totalQuotedAmount.toFixed(2)})
                                </option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-muted-foreground mb-1">
                            Award Justification / Remarks *
                          </label>
                          <input
                            type="text"
                            value={awardRemarks}
                            onChange={(e) => setAwardRemarks(e.target.value)}
                            placeholder="e.g. L1 lowest quote with proven metallurgical quality certs"
                            className="w-full text-xs px-2.5 py-2 rounded-lg border border-border bg-background text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end pt-1">
                        <PermissionGate screen="PROCUREMENT_RFQ" action="FINALIZE">
                          <button
                            type="button"
                            onClick={() => awardMutation.mutate()}
                            disabled={awardMutation.isPending}
                            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors shadow-sm disabled:opacity-50"
                          >
                            <Award className="w-4 h-4" />
                            {awardMutation.isPending
                              ? 'Awarding...'
                              : 'Confirm Contract Award'}
                          </button>
                        </PermissionGate>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border flex items-center justify-end bg-muted/20">
              <button
                type="button"
                onClick={() => setIsCsModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border hover:bg-muted text-xs font-semibold text-muted-foreground transition-colors"
              >
                Close Statement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PRINTABLE VOUCHER / CS MODAL */}
      {/* ==================================================================== */}
      {isPrintModalOpen && printTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header toolbar */}
            <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-muted/30 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-primary" />
                <span className="font-bold text-sm text-foreground">
                  Print Document: {printTarget.rfqNo}
                </span>
                <div className="flex gap-1 ml-4">
                  <button
                    onClick={() => setPrintDocType('CS')}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      printDocType === 'CS'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    Comparative Sheet
                  </button>
                  <button
                    onClick={() => setPrintDocType('INQUIRY')}
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      printDocType === 'INQUIRY'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    Supplier Inquiry Form
                  </button>
                </div>
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

            {/* Print Sheet */}
            <div className="p-8 overflow-y-auto space-y-6 print:p-0 print:m-0">
              <div className="border-b-2 border-primary pb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">
                    Kashvira Manufacturing ERP
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Procurement & Supply Chain Operations • Sourcing Division
                  </p>
                  <h2 className="text-base font-semibold text-primary mt-2">
                    {printDocType === 'CS'
                      ? `COMPARATIVE STATEMENT (CS): ${printTarget.rfqNo}`
                      : `SUPPLIER INQUIRY TENDER: ${printTarget.rfqNo}`}
                  </h2>
                </div>
                <div className="text-right text-xs space-y-1">
                  <div>
                    <span className="font-semibold text-muted-foreground">Issue Date: </span>
                    <span className="font-bold font-mono text-foreground">{printTarget.rfqDate}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Due Date: </span>
                    <span className="font-bold font-mono text-foreground">{printTarget.dueDate}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Status: </span>
                    <span className="font-bold text-emerald-600">{printTarget.status}</span>
                  </div>
                </div>
              </div>

              {/* Items & Quotations */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-2">
                  Line Items & Specifications
                </h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted text-muted-foreground border-b border-border">
                        <th className="py-2 px-3 font-semibold">SKU Code</th>
                        <th className="py-2 px-3 font-semibold">Description & Specs</th>
                        <th className="py-2 px-2 font-semibold">UOM</th>
                        <th className="py-2 px-2 font-semibold text-right">Req. Qty</th>
                        <th className="py-2 px-3 font-semibold text-right">Target Rate (₹)</th>
                        <th className="py-2 px-3 font-semibold">L1 Awardee / Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono">
                      {isPrintLoading ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-muted-foreground">
                            Loading items...
                          </td>
                        </tr>
                      ) : !printDetailData?.comparisonItems ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-muted-foreground">
                            No items registered.
                          </td>
                        </tr>
                      ) : (
                        printDetailData.comparisonItems.map((it, idx) => (
                          <tr key={idx} className="hover:bg-muted/10">
                            <td className="py-2 px-3 font-bold text-primary">{it.itemCode}</td>
                            <td className="py-2 px-3 font-sans text-foreground">
                              {it.itemName}
                            </td>
                            <td className="py-2 px-2 text-muted-foreground">{it.uomCode}</td>
                            <td className="py-2 px-2 text-right">{it.requiredQty}</td>
                            <td className="py-2 px-3 text-right">{Number(it.targetRate).toFixed(2)}</td>
                            <td className="py-2 px-3 font-sans">
                              {it.l1Quote ? (
                                <span className="font-bold text-emerald-600">
                                  {it.l1Quote.partyName} (₹{it.l1Quote.netRate})
                                </span>
                              ) : (
                                'Pending Bids'
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-6 pt-10 text-center text-xs">
                <div className="border-t border-border pt-2">
                  <p className="font-semibold text-foreground">Purchase Executive</p>
                  <p className="text-muted-foreground">Prepared & Inquiries Sent</p>
                </div>
                <div className="border-t border-border pt-2">
                  <p className="font-semibold text-foreground">Technical Reviewer</p>
                  <p className="text-muted-foreground">Specs & Tolerances Checked</p>
                </div>
                <div className="border-t border-border pt-2">
                  <p className="font-semibold text-foreground">
                    {printTarget.awardedVendorName
                      ? `Awarded to ${printTarget.awardedVendorName}`
                      : 'Plant Purchase Committee'}
                  </p>
                  <p className="text-muted-foreground">Commercial Approval</p>
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
        entityType="Request for Quotation (RFQ)"
        entityName={deleteTarget?.remarks || 'RFQ Inquiry'}
        entityCode={deleteTarget?.rfqNo}
        isDeleting={deleteMutation.isPending}
        errorMessage={deleteErrorMessage}
        dependencies={deleteConflicts}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.rfqId);
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
