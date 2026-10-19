import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Factory,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Repeat,
  Scale,
  Search,
  Send,
  ShieldCheck,
  Tag,
  Trash2,
  TrendingUp,
  Truck,
  User,
  X,
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

// ----------------------------------------------------------------------------
// Interfaces & Types
// ----------------------------------------------------------------------------
interface JobWorkSummary {
  totalChallans: number;
  activeChallans: number;
  completedChallans: number;
  draftChallans: number;
  totalEstimatedValue: number;
  totalSentQty: number;
  totalReceipts: number;
}

interface JobWorkLookups {
  subcontractors: Array<{
    party_id: number;
    party_code: string;
    party_name: string;
    gst_treatment_type: string;
  }>;
  workOrders: Array<{
    wo_id: number;
    wo_no: string;
    item_id: number;
    item_code: string;
    item_name: string;
    planned_qty: number;
    status: string;
  }>;
  warehouses: Array<{
    warehouse_id: number;
    warehouse_code: string;
    warehouse_name: string;
    warehouse_type: string;
  }>;
  items: Array<{
    item_id: number;
    item_code: string;
    item_name: string;
    hsn_code: string;
    standard_rate: number;
    uom_id: number;
    uom_code: string;
    uom_name: string;
  }>;
  routingOperations: Array<{
    wo_routing_op_id: number;
    wo_id: number;
    op_sequence: number;
    operation_name: string;
    work_center_id: number;
    work_center_name: string;
    work_center_type: string;
  }>;
}

interface JobWorkChallanItem {
  challan_item_id: number;
  challan_id: number;
  item_id: number;
  item_code: string;
  item_description: string;
  uom_id: number;
  uom_code: string;
  sent_qty: number;
  unit_rate: number;
  total_value: number;
  hsn_code?: string;
  batch_no?: string;
  heat_no?: string;
  received_qty: number;
  scrap_returned_qty: number;
  loss_qty: number;
  pending_qty: number;
  remarks?: string;
}

interface JobWorkChallan {
  challan_id: number;
  challan_no: string;
  challan_date: string;
  vendor_id: number;
  vendor_name: string;
  vendor_code: string;
  wo_id?: number;
  wo_no?: string;
  nature_of_processing: string;
  from_warehouse_id: number;
  from_warehouse_name: string;
  expected_return_date?: string;
  transporter_name?: string;
  vehicle_no?: string;
  eway_bill_no?: string;
  status: 'DRAFT' | 'DISPATCHED' | 'PARTIALLY_RECEIVED' | 'COMPLETED' | 'CANCELLED';
  total_items: number;
  total_sent_qty: number;
  total_estimated_value: number;
  dispatched_at?: string;
  dispatched_by_name?: string;
  remarks?: string;
  created_date: string;
  total_received_qty: number;
  total_pending_qty: number;
  items?: JobWorkChallanItem[];
  receipts?: any[];
}

interface JobWorkReceiptItem {
  receipt_item_id: number;
  receipt_id: number;
  challan_item_id?: number;
  received_item_id: number;
  item_code: string;
  item_name: string;
  uom_id: number;
  uom_code: string;
  received_qty: number;
  accepted_qty: number;
  rejected_qty: number;
  rework_qty: number;
  scrap_qty: number;
  loss_qty: number;
  processing_rate: number;
  processing_amount: number;
  batch_no?: string;
  heat_no?: string;
  remarks?: string;
}

interface JobWorkReceipt {
  receipt_id: number;
  receipt_no: string;
  receipt_date: string;
  challan_id: number;
  challan_no: string;
  vendor_id: number;
  vendor_name: string;
  wo_id?: number;
  wo_no?: string;
  vendor_dc_no?: string;
  vendor_dc_date?: string;
  vendor_invoice_no?: string;
  to_warehouse_id: number;
  to_warehouse_name: string;
  service_charges: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  qc_status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'DEVIATION_ACCEPTED';
  received_by_name?: string;
  remarks?: string;
  created_date: string;
  total_items: number;
  total_received_qty: number;
  total_accepted_qty: number;
  total_scrap_qty: number;
  items?: JobWorkReceiptItem[];
}

interface ChallanFormLine {
  itemId: number;
  itemDescription?: string;
  uomId: number;
  sentQty: number;
  unitRate: number;
  hsnCode?: string;
  batchNo?: string;
  heatNo?: string;
  remarks?: string;
}

interface ReceiptFormLine {
  challanItemId?: number;
  receivedItemId: number;
  uomId: number;
  receivedQty: number;
  acceptedQty: number;
  rejectedQty: number;
  reworkQty: number;
  scrapQty: number;
  lossQty: number;
  processingRate: number;
  batchNo?: string;
  heatNo?: string;
  remarks?: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------
export const JobWorkMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Navigation & Tab State
  const [activeTab, setActiveTab] = useState<'challans' | 'receipts'>('challans');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Modals & Drawers
  const [isChallanModalOpen, setIsChallanModalOpen] = useState(false);
  const [editingChallanId, setEditingChallanId] = useState<number | null>(null);

  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [dispatchChallanTarget, setDispatchChallanTarget] = useState<JobWorkChallan | null>(null);

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptChallanTarget, setReceiptChallanTarget] = useState<JobWorkChallan | null>(null);

  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
  const [reconcileTarget, setReconcileTarget] = useState<JobWorkChallan | null>(null);

  const [detailsChallanId, setDetailsChallanId] = useState<number | null>(null);
  const [detailsReceiptId, setDetailsReceiptId] = useState<number | null>(null);

  const [printChallanId, setPrintChallanId] = useState<number | null>(null);
  const [printReceiptId, setPrintReceiptId] = useState<number | null>(null);

  const [deleteChallanTarget, setDeleteChallanTarget] = useState<JobWorkChallan | null>(null);

  // Form State: Challan
  const [challanForm, setChallanForm] = useState({
    challanNo: '',
    challanDate: new Date().toISOString().split('T')[0],
    vendorId: 0,
    woId: 0,
    woRoutingOpId: 0,
    natureOfProcessing: '',
    fromWarehouseId: 0,
    expectedReturnDate: '',
    transporterName: '',
    vehicleNo: '',
    ewayBillNo: '',
    remarks: '',
  });
  const [challanItems, setChallanItems] = useState<ChallanFormLine[]>([]);

  // Form State: Dispatch
  const [dispatchForm, setDispatchForm] = useState({
    transporterName: '',
    vehicleNo: '',
    ewayBillNo: '',
    remarks: '',
  });

  // Form State: Receipt
  const [receiptForm, setReceiptForm] = useState({
    receiptNo: '',
    receiptDate: new Date().toISOString().split('T')[0],
    vendorDcNo: '',
    vendorDcDate: new Date().toISOString().split('T')[0],
    vendorInvoiceNo: '',
    toWarehouseId: 0,
    taxAmount: 0,
    qcStatus: 'ACCEPTED',
    remarks: '',
  });
  const [receiptItems, setReceiptItems] = useState<ReceiptFormLine[]>([]);

  // Form State: Reconcile
  const [reconcileForm, setReconcileForm] = useState({
    remarks: '',
    forceClose: false,
  });

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------
  const { data: summaryData } = useQuery<JobWorkSummary>({
    queryKey: ['job-work-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<JobWorkSummary>>('/manufacturing/job-work/summary');
      return res.data.data;
    },
  });

  const { data: lookupsData } = useQuery<JobWorkLookups>({
    queryKey: ['job-work-lookups'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<JobWorkLookups>>('/manufacturing/job-work/lookups');
      return res.data.data;
    },
  });

  const { data: challansList = [], isLoading: isChallansLoading } = useQuery<JobWorkChallan[]>({
    queryKey: ['job-work-challans', statusFilter, vendorFilter, searchFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (vendorFilter !== 'ALL') params.append('vendorId', vendorFilter);
      if (searchFilter) params.append('search', searchFilter);
      const res = await apiClient.get<ApiResponse<JobWorkChallan[]>>(`/manufacturing/job-work/challans?${params.toString()}`);
      return res.data.data;
    },
    enabled: activeTab === 'challans',
  });

  const { data: receiptsList = [], isLoading: isReceiptsLoading } = useQuery<JobWorkReceipt[]>({
    queryKey: ['job-work-receipts', searchFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchFilter) params.append('search', searchFilter);
      const res = await apiClient.get<ApiResponse<JobWorkReceipt[]>>(`/manufacturing/job-work/receipts?${params.toString()}`);
      return res.data.data;
    },
    enabled: activeTab === 'receipts',
  });

  const { data: singleChallanDetails } = useQuery<JobWorkChallan>({
    queryKey: ['job-work-challan-details', detailsChallanId || printChallanId],
    queryFn: async () => {
      const id = detailsChallanId || printChallanId;
      const res = await apiClient.get<ApiResponse<JobWorkChallan>>(`/manufacturing/job-work/challans/${id}`);
      return res.data.data;
    },
    enabled: Boolean(detailsChallanId || printChallanId),
  });

  const { data: singleReceiptDetails } = useQuery<JobWorkReceipt>({
    queryKey: ['job-work-receipt-details', detailsReceiptId || printReceiptId],
    queryFn: async () => {
      const id = detailsReceiptId || printReceiptId;
      const res = await apiClient.get<ApiResponse<JobWorkReceipt>>(`/manufacturing/job-work/receipts/${id}`);
      return res.data.data;
    },
    enabled: Boolean(detailsReceiptId || printReceiptId),
  });

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------
  const createChallanMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post<ApiResponse<any>>('/manufacturing/job-work/challans', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-work-challans'] });
      queryClient.invalidateQueries({ queryKey: ['job-work-summary'] });
      setIsChallanModalOpen(false);
      resetChallanForm();
    },
  });

  const updateChallanMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.put<ApiResponse<any>>(`/manufacturing/job-work/challans/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-work-challans'] });
      queryClient.invalidateQueries({ queryKey: ['job-work-summary'] });
      setIsChallanModalOpen(false);
      setEditingChallanId(null);
      resetChallanForm();
    },
  });

  const dispatchChallanMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.post<ApiResponse<any>>(`/manufacturing/job-work/challans/${id}/dispatch`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-work-challans'] });
      queryClient.invalidateQueries({ queryKey: ['job-work-summary'] });
      setIsDispatchModalOpen(false);
      setDispatchChallanTarget(null);
    },
  });

  const deleteChallanMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete<ApiResponse<any>>(`/manufacturing/job-work/challans/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-work-challans'] });
      queryClient.invalidateQueries({ queryKey: ['job-work-summary'] });
      setDeleteChallanTarget(null);
    },
  });

  const createReceiptMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post<ApiResponse<any>>('/manufacturing/job-work/receipts', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-work-challans'] });
      queryClient.invalidateQueries({ queryKey: ['job-work-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['job-work-summary'] });
      setIsReceiptModalOpen(false);
      setReceiptChallanTarget(null);
      resetReceiptForm();
    },
  });

  const reconcileChallanMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.post<ApiResponse<any>>(`/manufacturing/job-work/challans/${id}/reconcile`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-work-challans'] });
      queryClient.invalidateQueries({ queryKey: ['job-work-summary'] });
      setIsReconcileModalOpen(false);
      setReconcileTarget(null);
    },
  });

  // --------------------------------------------------------------------------
  // Form Helpers
  // --------------------------------------------------------------------------
  const resetChallanForm = () => {
    setChallanForm({
      challanNo: '',
      challanDate: new Date().toISOString().split('T')[0],
      vendorId: 0,
      woId: 0,
      woRoutingOpId: 0,
      natureOfProcessing: '',
      fromWarehouseId: lookupsData?.warehouses?.[0]?.warehouse_id || 0,
      expectedReturnDate: '',
      transporterName: '',
      vehicleNo: '',
      ewayBillNo: '',
      remarks: '',
    });
    setChallanItems([]);
    setEditingChallanId(null);
  };

  const handleOpenCreateChallan = () => {
    resetChallanForm();
    if (lookupsData?.warehouses?.length) {
      setChallanForm((prev) => ({
        ...prev,
        fromWarehouseId: lookupsData.warehouses[0].warehouse_id,
      }));
    }
    if (lookupsData?.items?.length) {
      const firstItem = lookupsData.items[0];
      setChallanItems([
        {
          itemId: firstItem.item_id,
          itemDescription: firstItem.item_name,
          uomId: firstItem.uom_id,
          sentQty: 10,
          unitRate: firstItem.standard_rate || 500,
          hsnCode: firstItem.hsn_code,
          batchNo: '',
          heatNo: '',
          remarks: '',
        },
      ]);
    }
    setIsChallanModalOpen(true);
  };

  const handleAddChallanItem = () => {
    if (!lookupsData?.items?.length) return;
    const firstItem = lookupsData.items[0];
    setChallanItems((prev) => [
      ...prev,
      {
        itemId: firstItem.item_id,
        itemDescription: firstItem.item_name,
        uomId: firstItem.uom_id,
        sentQty: 1,
        unitRate: firstItem.standard_rate || 500,
        hsnCode: firstItem.hsn_code,
        batchNo: '',
        heatNo: '',
        remarks: '',
      },
    ]);
  };

  const handleRemoveChallanItem = (idx: number) => {
    setChallanItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleOpenDispatchModal = (challan: JobWorkChallan) => {
    setDispatchChallanTarget(challan);
    setDispatchForm({
      transporterName: challan.transporter_name || '',
      vehicleNo: challan.vehicle_no || '',
      ewayBillNo: challan.eway_bill_no || '',
      remarks: '',
    });
    setIsDispatchModalOpen(true);
  };

  const handleOpenReceiptModal = async (challan: JobWorkChallan) => {
    setReceiptChallanTarget(challan);

    try {
      const res = await apiClient.get<ApiResponse<JobWorkChallan>>(`/manufacturing/job-work/challans/${challan.challan_id}`);
      const full = res.data.data;
      const targetItems = full.items || [];

      setReceiptForm({
        receiptNo: '',
        receiptDate: new Date().toISOString().split('T')[0],
        vendorDcNo: '',
        vendorDcDate: new Date().toISOString().split('T')[0],
        vendorInvoiceNo: '',
        toWarehouseId: challan.from_warehouse_id,
        taxAmount: 0,
        qcStatus: 'ACCEPTED',
        remarks: `Inward receipt against ${challan.challan_no}`,
      });

      const initialReceiptItems: ReceiptFormLine[] = targetItems
        .filter((it) => it.pending_qty > 0)
        .map((it) => ({
          challanItemId: it.challan_item_id,
          receivedItemId: it.item_id,
          uomId: it.uom_id,
          receivedQty: it.pending_qty,
          acceptedQty: it.pending_qty,
          rejectedQty: 0,
          reworkQty: 0,
          scrapQty: 0,
          lossQty: 0,
          processingRate: 250,
          batchNo: it.batch_no || '',
          heatNo: it.heat_no || '',
          remarks: '',
        }));

      setReceiptItems(initialReceiptItems.length > 0 ? initialReceiptItems : [
        {
          receivedItemId: lookupsData?.items?.[0]?.item_id || 1001,
          uomId: lookupsData?.items?.[0]?.uom_id || 1001,
          receivedQty: 1,
          acceptedQty: 1,
          rejectedQty: 0,
          reworkQty: 0,
          scrapQty: 0,
          lossQty: 0,
          processingRate: 250,
        },
      ]);

      setIsReceiptModalOpen(true);
    } catch (e) {
      console.error('Error fetching challan details for receipt', e);
    }
  };

  const resetReceiptForm = () => {
    setReceiptForm({
      receiptNo: '',
      receiptDate: new Date().toISOString().split('T')[0],
      vendorDcNo: '',
      vendorDcDate: new Date().toISOString().split('T')[0],
      vendorInvoiceNo: '',
      toWarehouseId: 0,
      taxAmount: 0,
      qcStatus: 'ACCEPTED',
      remarks: '',
    });
    setReceiptItems([]);
    setReceiptChallanTarget(null);
  };

  const handleOpenReconcileModal = (challan: JobWorkChallan) => {
    setReconcileTarget(challan);
    setReconcileForm({
      remarks: `Reconciled under GST Rule 55. Balances verified.`,
      forceClose: false,
    });
    setIsReconcileModalOpen(true);
  };

  // --------------------------------------------------------------------------
  // Table Columns
  // --------------------------------------------------------------------------
  const challansColumns = useMemo<MasterTableColumn<JobWorkChallan>[]>(() => [
    {
      key: 'challan_no',
      header: 'Challan # & Status',
      sortable: true,
      sortValue: (row) => row.challan_no,
      render: (row) => {
        let badgeColor = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
        if (row.status === 'DISPATCHED') badgeColor = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
        if (row.status === 'PARTIALLY_RECEIVED') badgeColor = 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
        if (row.status === 'COMPLETED') badgeColor = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
        if (row.status === 'CANCELLED') badgeColor = 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';

        return (
          <div className="space-y-1">
            <span className="font-mono-code font-bold text-sm text-[var(--text-primary)]">
              {row.challan_no}
            </span>
            <div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${badgeColor}`}>
                {row.status.replace(/_/g, ' ')}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: 'challan_date',
      header: 'Challan Date',
      sortable: true,
      sortValue: (row) => row.challan_date,
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.challan_date ? new Date(row.challan_date).toLocaleDateString() : '-'}</span>
        </div>
      ),
    },
    {
      key: 'vendor_name',
      header: 'Subcontractor / Job Worker',
      sortable: true,
      sortValue: (row) => row.vendor_name,
      render: (row) => (
        <div>
          <div className="font-medium text-sm text-[var(--text-primary)]">{row.vendor_name}</div>
          <div className="text-xs font-mono-code text-[var(--text-muted)]">{row.vendor_code}</div>
        </div>
      ),
    },
    {
      key: 'nature_of_processing',
      header: 'Nature of Processing',
      render: (row) => (
        <span className="text-xs font-medium text-slate-700 dark:text-slate-300 max-w-xs truncate block" title={row.nature_of_processing}>
          {row.nature_of_processing}
        </span>
      ),
    },
    {
      key: 'wo_no',
      header: 'Linked Work Order',
      render: (row) => (
        row.wo_no ? (
          <span className="inline-flex items-center gap-1 font-mono-code text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[var(--text-secondary)]">
            <Factory className="w-3 h-3 text-slate-400" />
            {row.wo_no}
          </span>
        ) : (
          <span className="text-xs text-slate-400">Direct Sourcing</span>
        )
      ),
    },
    {
      key: 'total_sent_qty',
      header: 'Sent vs Received Balance',
      sortable: true,
      sortValue: (row) => row.total_sent_qty,
      render: (row) => {
        const received = row.total_received_qty || 0;
        const total = row.total_sent_qty || 1;
        const pct = Math.min(100, Math.round((received / total) * 100));

        return (
          <div className="w-40 space-y-1">
            <div className="flex justify-between text-xs font-mono-code">
              <span>{received.toFixed(1)} / {total.toFixed(1)}</span>
              <span className="font-semibold">{pct}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full ${pct === 100 ? 'bg-emerald-500' : pct > 0 ? 'bg-amber-500' : 'bg-blue-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {row.total_pending_qty > 0 && (
              <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                Pending: {row.total_pending_qty.toFixed(1)} units
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: 'total_estimated_value',
      header: 'Material Valuation',
      sortable: true,
      sortValue: (row) => row.total_estimated_value,
      render: (row) => (
        <span className="font-mono-code font-semibold text-xs text-[var(--text-primary)]">
          ₹{Number(row.total_estimated_value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          {/* Details Drawer */}
          <button
            onClick={() => setDetailsChallanId(row.challan_id)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="View Challan Details"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Dispatch Action */}
          {row.status === 'DRAFT' && (
            <button
              onClick={() => handleOpenDispatchModal(row)}
              className="p-1.5 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition"
              title="Dispatch to Subcontractor"
            >
              <Send className="w-4 h-4" />
            </button>
          )}

          {/* Receive Inward Goods */}
          {(row.status === 'DISPATCHED' || row.status === 'PARTIALLY_RECEIVED') && (
            <button
              onClick={() => handleOpenReceiptModal(row)}
              className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition"
              title="Receive Subcontracted Goods"
            >
              <Repeat className="w-4 h-4" />
            </button>
          )}

          {/* Reconcile & Close */}
          {row.status !== 'COMPLETED' && row.status !== 'CANCELLED' && (
            <button
              onClick={() => handleOpenReconcileModal(row)}
              className="p-1.5 rounded-lg text-amber-600 hover:text-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition"
              title="Reconcile Materials & Close"
            >
              <Scale className="w-4 h-4" />
            </button>
          )}

          {/* Print Section 143 Challan */}
          <button
            onClick={() => setPrintChallanId(row.challan_id)}
            className="p-1.5 rounded-lg text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition"
            title="Print GST Delivery Challan"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Delete Draft */}
          {(row.status === 'DRAFT' || row.status === 'CANCELLED') && (
            <button
              onClick={() => setDeleteChallanTarget(row)}
              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition"
              title="Delete Challan"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ], []);

  const receiptsColumns = useMemo<MasterTableColumn<JobWorkReceipt>[]>(() => [
    {
      key: 'receipt_no',
      header: 'Receipt # & Status',
      sortable: true,
      sortValue: (row) => row.receipt_no,
      render: (row) => (
        <div className="space-y-1">
          <span className="font-mono-code font-bold text-sm text-[var(--text-primary)]">
            {row.receipt_no}
          </span>
          <div>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
              {row.status}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'receipt_date',
      header: 'Receipt Date',
      sortable: true,
      sortValue: (row) => row.receipt_date,
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{row.receipt_date ? new Date(row.receipt_date).toLocaleDateString() : '-'}</span>
        </div>
      ),
    },
    {
      key: 'challan_no',
      header: 'Outward Challan Ref',
      sortable: true,
      sortValue: (row) => row.challan_no,
      render: (row) => (
        <span className="font-mono-code text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[var(--text-primary)] font-semibold">
          {row.challan_no}
        </span>
      ),
    },
    {
      key: 'vendor_name',
      header: 'Subcontractor',
      sortable: true,
      sortValue: (row) => row.vendor_name,
      render: (row) => (
        <span className="font-medium text-xs text-[var(--text-primary)]">{row.vendor_name}</span>
      ),
    },
    {
      key: 'vendor_dc_no',
      header: 'Vendor DC & Invoice',
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <div className="font-mono-code text-slate-700 dark:text-slate-300">DC: {row.vendor_dc_no || 'N/A'}</div>
          <div className="font-mono-code text-slate-500 text-[11px]">Inv: {row.vendor_invoice_no || 'N/A'}</div>
        </div>
      ),
    },
    {
      key: 'total_accepted_qty',
      header: 'Accepted / Scrap Units',
      sortable: true,
      sortValue: (row) => row.total_accepted_qty,
      render: (row) => (
        <div className="text-xs space-y-0.5">
          <div className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono-code">
            +{row.total_accepted_qty.toFixed(1)} Good
          </div>
          {row.total_scrap_qty > 0 && (
            <div className="text-rose-500 font-mono-code text-[11px]">
              {row.total_scrap_qty.toFixed(1)} Scrap
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'total_amount',
      header: 'Processing Charges',
      sortable: true,
      sortValue: (row) => row.total_amount,
      render: (row) => (
        <div className="text-xs font-mono-code">
          <div className="font-bold text-[var(--text-primary)]">
            ₹{row.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-[10px] text-slate-400">
            Base: ₹{row.service_charges.toFixed(2)} + GST
          </div>
        </div>
      ),
    },
    {
      key: 'qc_status',
      header: 'Inward QC Disposition',
      sortable: true,
      sortValue: (row) => row.qc_status,
      render: (row) => {
        let badge = 'bg-slate-100 text-slate-700';
        if (row.qc_status === 'ACCEPTED') badge = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400';
        if (row.qc_status === 'REJECTED') badge = 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400';
        if (row.qc_status === 'DEVIATION_ACCEPTED') badge = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400';
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${badge}`}>
            {row.qc_status.replace(/_/g, ' ')}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => setDetailsReceiptId(row.receipt_id)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="View Receipt Details"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPrintReceiptId(row.receipt_id)}
            className="p-1.5 rounded-lg text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition"
            title="Print Inward Receipt"
          >
            <Printer className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ], []);

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  return (
    <PermissionGate screen="MFG_JOB_WORK" action="VIEW">
      <div className="space-y-6 pb-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Truck className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
                  Subcontractor Job-Work & Reconciliation
                </h1>
                <p className="text-xs text-[var(--text-muted)]">
                  GST Section 143 Outward Challans, Inward Material Receipts, Scrap Accounting & Balance Settlement
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <PermissionGate screen="MFG_JOB_WORK" action="ADD">
              <button
                onClick={handleOpenCreateChallan}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--brand-600)] text-white hover:bg-[var(--brand-700)] shadow-sm font-semibold text-xs transition"
              >
                <Plus className="w-4 h-4" />
                <span>New Job-Work Challan</span>
              </button>
            </PermissionGate>
          </div>
        </div>

        {/* 4 Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Total Challans</span>
              <FileSpreadsheet className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono-code text-[var(--text-primary)]">
              {summaryData?.totalChallans ?? 0}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Fleet outward travelers</div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Active at Subcontractors</span>
              <Repeat className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono-code text-blue-600 dark:text-blue-400">
              {summaryData?.activeChallans ?? 0}
            </div>
            <div className="text-[11px] text-blue-500 mt-1">Dispatched & awaiting return</div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Material Valuation at Vendors</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono-code text-emerald-600 dark:text-emerald-400">
              ₹{(summaryData?.totalEstimatedValue ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] text-emerald-500 mt-1">Total inputs sent value</div>
          </div>

          <div className="p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Inward Receipts Processed</span>
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
            </div>
            <div className="mt-2 text-2xl font-bold font-mono-code text-indigo-600 dark:text-indigo-400">
              {summaryData?.totalReceipts ?? 0}
            </div>
            <div className="text-[11px] text-indigo-500 mt-1">Processed goods returned & QC stamped</div>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="border-b border-[var(--border-subtle)] flex items-center gap-6">
          <button
            onClick={() => setActiveTab('challans')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'challans'
                ? 'border-[var(--brand-600)] text-[var(--brand-600)]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>Outward Delivery Challans (GST Sec 143)</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono-code bg-slate-100 dark:bg-slate-800 text-slate-600">
              {summaryData?.totalChallans ?? 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('receipts')}
            className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'receipts'
                ? 'border-[var(--brand-600)] text-[var(--brand-600)]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <PackageCheck className="w-4 h-4" />
            <span>Inward Receipts & Scrap Return</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono-code bg-slate-100 dark:bg-slate-800 text-slate-600">
              {summaryData?.totalReceipts ?? 0}
            </span>
          </button>
        </div>

        {/* Master Data Table */}
        {activeTab === 'challans' ? (
          <MasterDataTable<JobWorkChallan>
            title="Outward Job-Work Challans Register"
            subtitle="GST Section 143 Delivery Challans & Subcontractor Dispatches"
            screenCode="MFG_JOB_WORK"
            tableNameBadge="tbl_mfg_job_work_challan"
            data={challansList}
            isLoading={isChallansLoading}
            rowKey={(r) => r.challan_id}
            columns={challansColumns}
            searchPlaceholder="Filter outward challans table..."
            searchPredicate={(r, q) => {
              const query = q.toLowerCase();
              return Boolean(
                r.challan_no.toLowerCase().includes(query) ||
                r.vendor_name.toLowerCase().includes(query) ||
                r.nature_of_processing.toLowerCase().includes(query) ||
                (r.wo_no && r.wo_no.toLowerCase().includes(query)) ||
                (r.eway_bill_no && r.eway_bill_no.toLowerCase().includes(query)),
              );
            }}
          />
        ) : (
          <MasterDataTable<JobWorkReceipt>
            title="Inward Job-Work Receipts Register"
            subtitle="Processed Components Received Back from Subcontractors & QC Inward"
            screenCode="MFG_JOB_WORK"
            tableNameBadge="tbl_mfg_job_work_receipt"
            data={receiptsList}
            isLoading={isReceiptsLoading}
            rowKey={(r) => r.receipt_id}
            columns={receiptsColumns}
            searchPlaceholder="Filter inward receipts table..."
            searchPredicate={(r, q) => {
              const query = q.toLowerCase();
              return Boolean(
                r.receipt_no.toLowerCase().includes(query) ||
                r.challan_no.toLowerCase().includes(query) ||
                r.vendor_name.toLowerCase().includes(query) ||
                (r.vendor_dc_no && r.vendor_dc_no.toLowerCase().includes(query)),
              );
            }}
          />
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MODAL 1: Create / Edit Outward Job-Work Challan                   */}
        {/* ------------------------------------------------------------------ */}
        {isChallanModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Truck className="w-5 h-5 text-amber-600" />
                    <span>Create GST Sec 143 Job-Work Delivery Challan</span>
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Prepare outward movement slip for third-party processing, heat treatment or job work
                  </p>
                </div>
                <button
                  onClick={() => setIsChallanModalOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Header Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Subcontractor Vendor *
                  </label>
                  <select
                    value={challanForm.vendorId}
                    onChange={(e) => setChallanForm({ ...challanForm, vendorId: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)]"
                  >
                    <option value={0}>-- Select Subcontractor --</option>
                    {lookupsData?.subcontractors.map((v) => (
                      <option key={v.party_id} value={v.party_id}>
                        {v.party_name} ({v.party_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Source Work Order (Optional)
                  </label>
                  <select
                    value={challanForm.woId}
                    onChange={(e) => setChallanForm({ ...challanForm, woId: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)]"
                  >
                    <option value={0}>-- Direct Material Outward --</option>
                    {lookupsData?.workOrders.map((w) => (
                      <option key={w.wo_id} value={w.wo_id}>
                        {w.wo_no} — {w.item_code} ({w.planned_qty} pcs)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Source Dispatch Warehouse *
                  </label>
                  <select
                    value={challanForm.fromWarehouseId}
                    onChange={(e) => setChallanForm({ ...challanForm, fromWarehouseId: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)]"
                  >
                    {lookupsData?.warehouses.map((w) => (
                      <option key={w.warehouse_id} value={w.warehouse_id}>
                        {w.warehouse_name} ({w.warehouse_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Nature of Processing / Job-Work Description *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Induction Hardening to 58-62 HRC, CNC Turning, Bore Chrome Plating"
                    value={challanForm.natureOfProcessing}
                    onChange={(e) => setChallanForm({ ...challanForm, natureOfProcessing: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Expected Return Date (Statutory Limit: 1 Year)
                  </label>
                  <input
                    type="date"
                    value={challanForm.expectedReturnDate}
                    onChange={(e) => setChallanForm({ ...challanForm, expectedReturnDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Transporter Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. VRL Logistics, Self Delivery"
                    value={challanForm.transporterName}
                    onChange={(e) => setChallanForm({ ...challanForm, transporterName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Vehicle Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GJ-01-BX-8842"
                    value={challanForm.vehicleNo}
                    onChange={(e) => setChallanForm({ ...challanForm, vehicleNo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    E-Way Bill Number
                  </label>
                  <input
                    type="text"
                    placeholder="12-digit E-Way Bill Number"
                    value={challanForm.ewayBillNo}
                    onChange={(e) => setChallanForm({ ...challanForm, ewayBillNo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] font-mono-code"
                  />
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-slate-500" />
                    <span>Outward Material Items Sent</span>
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddChallanItem}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-[var(--text-primary)]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-[var(--border-subtle)]">
                        <th className="p-3 font-semibold text-[var(--text-secondary)]">Item / Material</th>
                        <th className="p-3 font-semibold text-[var(--text-secondary)] w-28">Sent Qty</th>
                        <th className="p-3 font-semibold text-[var(--text-secondary)] w-28">Unit Rate (₹)</th>
                        <th className="p-3 font-semibold text-[var(--text-secondary)] w-32">Total Value</th>
                        <th className="p-3 font-semibold text-[var(--text-secondary)] w-28">Batch / Heat</th>
                        <th className="p-3 text-right font-semibold text-[var(--text-secondary)] w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {challanItems.map((item, idx) => {
                        const lineVal = item.sentQty * item.unitRate;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="p-3">
                              <select
                                value={item.itemId}
                                onChange={(e) => {
                                  const selectedId = Number(e.target.value);
                                  const catItem = lookupsData?.items.find((i) => i.item_id === selectedId);
                                  const newItems = [...challanItems];
                                  newItems[idx] = {
                                    ...newItems[idx],
                                    itemId: selectedId,
                                    itemDescription: catItem?.item_name || '',
                                    uomId: catItem?.uom_id || 1001,
                                    hsnCode: catItem?.hsn_code,
                                    unitRate: catItem?.standard_rate || 500,
                                  };
                                  setChallanItems(newItems);
                                }}
                                className="w-full px-2 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)]"
                              >
                                {lookupsData?.items.map((i) => (
                                  <option key={i.item_id} value={i.item_id}>
                                    {i.item_code} — {i.item_name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-3">
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                value={item.sentQty}
                                onChange={(e) => {
                                  const newItems = [...challanItems];
                                  newItems[idx].sentQty = Number(e.target.value);
                                  setChallanItems(newItems);
                                }}
                                className="w-full px-2 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] font-mono-code"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.unitRate}
                                onChange={(e) => {
                                  const newItems = [...challanItems];
                                  newItems[idx].unitRate = Number(e.target.value);
                                  setChallanItems(newItems);
                                }}
                                className="w-full px-2 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] font-mono-code"
                              />
                            </td>
                            <td className="p-3 font-mono-code font-semibold text-xs text-[var(--text-primary)]">
                              ₹{lineVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td className="p-3">
                              <input
                                type="text"
                                placeholder="Heat / Lot #"
                                value={item.heatNo || ''}
                                onChange={(e) => {
                                  const newItems = [...challanItems];
                                  newItems[idx].heatNo = e.target.value;
                                  setChallanItems(newItems);
                                }}
                                className="w-full px-2 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11px] text-[var(--text-primary)] font-mono-code"
                              />
                            </td>
                            <td className="p-3 text-right">
                              {challanItems.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveChallanItem(idx)}
                                  className="text-slate-400 hover:text-rose-500"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsChallanModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!challanForm.vendorId || !challanForm.natureOfProcessing || challanItems.length === 0 || createChallanMutation.isPending}
                  onClick={() => {
                    const payload = {
                      ...challanForm,
                      items: challanItems,
                    };
                    createChallanMutation.mutate(payload);
                  }}
                  className="px-5 py-2 rounded-xl bg-[var(--brand-600)] text-white hover:bg-[var(--brand-700)] text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {createChallanMutation.isPending ? 'Saving...' : 'Create Draft Challan'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MODAL 2: Dispatch Outward Challan                                 */}
        {/* ------------------------------------------------------------------ */}
        {isDispatchModalOpen && dispatchChallanTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="relative w-full max-w-md rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Send className="w-5 h-5 text-blue-600" />
                  <span>Dispatch Job-Work Challan</span>
                </h3>
                <button onClick={() => setIsDispatchModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300">
                  <span className="font-bold">Challan #: {dispatchChallanTarget.challan_no}</span>
                  <div className="mt-1 text-[11px]">
                    Subcontractor: {dispatchChallanTarget.vendor_name}
                  </div>
                  <div className="text-[11px]">
                    Total Sent Quantity: {dispatchChallanTarget.total_sent_qty} units (₹{dispatchChallanTarget.total_estimated_value.toFixed(2)})
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Transporter Name
                  </label>
                  <input
                    type="text"
                    value={dispatchForm.transporterName}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, transporterName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Vehicle Number
                  </label>
                  <input
                    type="text"
                    value={dispatchForm.vehicleNo}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, vehicleNo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    E-Way Bill Number
                  </label>
                  <input
                    type="text"
                    value={dispatchForm.ewayBillNo}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, ewayBillNo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] font-mono-code"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Dispatch Notes / Gate Clearance
                  </label>
                  <textarea
                    rows={2}
                    value={dispatchForm.remarks}
                    onChange={(e) => setDispatchForm({ ...dispatchForm, remarks: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsDispatchModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={dispatchChallanMutation.isPending}
                  onClick={() => {
                    dispatchChallanMutation.mutate({
                      id: dispatchChallanTarget.challan_id,
                      payload: dispatchForm,
                    });
                  }}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-xs font-bold shadow-sm"
                >
                  {dispatchChallanMutation.isPending ? 'Dispatching...' : 'Confirm Dispatch & Deduct Stock'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MODAL 3: Inward Job-Work Goods Receipt                            */}
        {/* ------------------------------------------------------------------ */}
        {isReceiptModalOpen && receiptChallanTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl p-6 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Repeat className="w-5 h-5 text-emerald-600" />
                    <span>Inward Job-Work Receipt & Material Acceptance</span>
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Receive processed components from subcontractor against Challan #{receiptChallanTarget.challan_no}
                  </p>
                </div>
                <button onClick={() => setIsReceiptModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Receipt Header Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Vendor DC Number *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MP-DC-2026-144"
                    value={receiptForm.vendorDcNo}
                    onChange={(e) => setReceiptForm({ ...receiptForm, vendorDcNo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] font-mono-code"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Vendor Service Tax Invoice #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. MP-INV-8891"
                    value={receiptForm.vendorInvoiceNo}
                    onChange={(e) => setReceiptForm({ ...receiptForm, vendorInvoiceNo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] font-mono-code"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Receiving Warehouse *
                  </label>
                  <select
                    value={receiptForm.toWarehouseId}
                    onChange={(e) => setReceiptForm({ ...receiptForm, toWarehouseId: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)]"
                  >
                    {lookupsData?.warehouses.map((w) => (
                      <option key={w.warehouse_id} value={w.warehouse_id}>
                        {w.warehouse_name} ({w.warehouse_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Inward QC Inspection Clearance *
                  </label>
                  <select
                    value={receiptForm.qcStatus}
                    onChange={(e) => setReceiptForm({ ...receiptForm, qcStatus: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] font-semibold"
                  >
                    <option value="ACCEPTED">ACCEPTED (Cleared for Production)</option>
                    <option value="DEVIATION_ACCEPTED">DEVIATION_ACCEPTED (Authorized Concession)</option>
                    <option value="REJECTED">REJECTED (Return to Subcontractor)</option>
                    <option value="PENDING">PENDING (Quarantine Hold)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Inward Remarks & QA Lab Notes
                  </label>
                  <input
                    type="text"
                    value={receiptForm.remarks}
                    onChange={(e) => setReceiptForm({ ...receiptForm, remarks: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {/* Line Items Table */}
              <div className="space-y-3 pt-4 border-t border-[var(--border-subtle)]">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-600" />
                  <span>Processed Goods & Scrap Received</span>
                </h4>

                <div className="border border-[var(--border-subtle)] rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-[var(--border-subtle)]">
                        <th className="p-3 font-semibold text-[var(--text-secondary)]">Item</th>
                        <th className="p-3 font-semibold text-[var(--text-secondary)] w-24">Recv Qty</th>
                        <th className="p-3 font-semibold text-[var(--text-secondary)] w-24 text-emerald-600">Accepted</th>
                        <th className="p-3 font-semibold text-[var(--text-secondary)] w-24 text-rose-500">Scrap</th>
                        <th className="p-3 font-semibold text-[var(--text-secondary)] w-24 text-amber-500">Loss</th>
                        <th className="p-3 font-semibold text-[var(--text-secondary)] w-28">Rate (₹/pc)</th>
                        <th className="p-3 font-semibold text-[var(--text-secondary)] w-32">Charges</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {receiptItems.map((item, idx) => {
                        const lineCharge = item.receivedQty * item.processingRate;
                        const catItem = lookupsData?.items.find((i) => i.item_id === item.receivedItemId);
                        return (
                          <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="p-3">
                              <span className="font-semibold text-[var(--text-primary)] block">
                                {catItem?.item_code || `Item #${item.receivedItemId}`}
                              </span>
                              <span className="text-[11px] text-[var(--text-muted)] truncate block max-w-xs">
                                {catItem?.item_name || ''}
                              </span>
                            </td>
                            <td className="p-3">
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                value={item.receivedQty}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  const newItems = [...receiptItems];
                                  newItems[idx].receivedQty = val;
                                  newItems[idx].acceptedQty = val;
                                  setReceiptItems(newItems);
                                }}
                                className="w-full px-2 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] font-mono-code"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.acceptedQty}
                                onChange={(e) => {
                                  const newItems = [...receiptItems];
                                  newItems[idx].acceptedQty = Number(e.target.value);
                                  setReceiptItems(newItems);
                                }}
                                className="w-full px-2 py-1 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-[var(--bg-surface)] text-xs text-emerald-700 dark:text-emerald-400 font-mono-code font-bold"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.scrapQty}
                                onChange={(e) => {
                                  const newItems = [...receiptItems];
                                  newItems[idx].scrapQty = Number(e.target.value);
                                  setReceiptItems(newItems);
                                }}
                                className="w-full px-2 py-1 rounded-lg border border-rose-300 dark:border-rose-800 bg-[var(--bg-surface)] text-xs text-rose-600 font-mono-code"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.lossQty}
                                onChange={(e) => {
                                  const newItems = [...receiptItems];
                                  newItems[idx].lossQty = Number(e.target.value);
                                  setReceiptItems(newItems);
                                }}
                                className="w-full px-2 py-1 rounded-lg border border-amber-300 dark:border-amber-800 bg-[var(--bg-surface)] text-xs text-amber-600 font-mono-code"
                              />
                            </td>
                            <td className="p-3">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.processingRate}
                                onChange={(e) => {
                                  const newItems = [...receiptItems];
                                  newItems[idx].processingRate = Number(e.target.value);
                                  setReceiptItems(newItems);
                                }}
                                className="w-full px-2 py-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] font-mono-code"
                              />
                            </td>
                            <td className="p-3 font-mono-code font-bold text-xs text-[var(--text-primary)]">
                              ₹{lineCharge.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={createReceiptMutation.isPending || receiptItems.length === 0}
                  onClick={() => {
                    const payload = {
                      challanId: receiptChallanTarget.challan_id,
                      vendorId: receiptChallanTarget.vendor_id,
                      woId: receiptChallanTarget.wo_id,
                      ...receiptForm,
                      items: receiptItems,
                    };
                    createReceiptMutation.mutate(payload);
                  }}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {createReceiptMutation.isPending ? 'Posting Receipt...' : 'Post Inward Receipt & QC Clearance'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* MODAL 4: Reconcile Materials & Close Challan                      */}
        {/* ------------------------------------------------------------------ */}
        {isReconcileModalOpen && reconcileTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="relative w-full max-w-md rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
                <h3 className="text-base font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Scale className="w-5 h-5 text-amber-600" />
                  <span>Reconcile Job-Work Materials</span>
                </h3>
                <button onClick={() => setIsReconcileModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 space-y-1.5 font-mono-code">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Total Sent:</span>
                    <span className="font-bold">{reconcileTarget.total_sent_qty} units</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>Received Returned:</span>
                    <span className="font-bold">{reconcileTarget.total_received_qty} units</span>
                  </div>
                  <div className="flex justify-between text-amber-600 border-t border-slate-200 dark:border-slate-700 pt-1">
                    <span>Pending at Vendor:</span>
                    <span className="font-bold">{reconcileTarget.total_pending_qty} units</span>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Reconciliation Audit Sign-Off Notes
                  </label>
                  <textarea
                    rows={3}
                    value={reconcileForm.remarks}
                    onChange={(e) => setReconcileForm({ ...reconcileForm, remarks: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIsReconcileModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={reconcileChallanMutation.isPending}
                  onClick={() => {
                    reconcileChallanMutation.mutate({
                      id: reconcileTarget.challan_id,
                      payload: reconcileForm,
                    });
                  }}
                  className="px-5 py-2 rounded-xl bg-amber-600 text-white hover:bg-amber-700 text-xs font-bold shadow-sm"
                >
                  {reconcileChallanMutation.isPending ? 'Closing...' : 'Close & Settle Challan'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* DRAWER 1: Challan Details Slideout                                */}
        {/* ------------------------------------------------------------------ */}
        {detailsChallanId && singleChallanDetails && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs">
            <div className="w-full max-w-2xl h-full bg-[var(--bg-surface)] shadow-2xl p-6 overflow-y-auto space-y-6 animate-in slide-in-from-right duration-200">
              <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Truck className="w-5 h-5 text-amber-600" />
                    <span>Challan Details: {singleChallanDetails.challan_no}</span>
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Dispatched under GST Rule 55 & Section 143
                  </p>
                </div>
                <button onClick={() => setDetailsChallanId(null)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status Header */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 space-y-2 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 block">Subcontractor:</span>
                    <span className="font-bold text-[var(--text-primary)]">{singleChallanDetails.vendor_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Status:</span>
                    <span className="font-bold text-blue-600 uppercase">{singleChallanDetails.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Nature of Process:</span>
                    <span className="font-medium text-[var(--text-primary)]">{singleChallanDetails.nature_of_processing}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">E-Way Bill #:</span>
                    <span className="font-mono-code font-bold">{singleChallanDetails.eway_bill_no || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Dispatched Material Items
                </h4>
                <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-100 dark:bg-slate-800">
                      <tr>
                        <th className="p-2.5">Item</th>
                        <th className="p-2.5">Sent</th>
                        <th className="p-2.5">Received</th>
                        <th className="p-2.5">Pending</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)] font-mono-code">
                      {singleChallanDetails.items?.map((it) => (
                        <tr key={it.challan_item_id}>
                          <td className="p-2.5">
                            <div className="font-sans font-medium text-[var(--text-primary)]">{it.item_code}</div>
                            <div className="text-[10px] text-slate-400 font-sans">{it.item_description}</div>
                          </td>
                          <td className="p-2.5">{it.sent_qty} {it.uom_code}</td>
                          <td className="p-2.5 text-emerald-600 font-semibold">{it.received_qty}</td>
                          <td className="p-2.5 text-amber-600 font-semibold">{it.pending_qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Linked Receipts History */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Inward Receipts History
                </h4>
                {singleChallanDetails.receipts && singleChallanDetails.receipts.length > 0 ? (
                  <div className="border border-[var(--border-subtle)] rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-slate-100 dark:bg-slate-800">
                        <tr>
                          <th className="p-2.5">Receipt #</th>
                          <th className="p-2.5">Date</th>
                          <th className="p-2.5">Vendor DC #</th>
                          <th className="p-2.5">Charges</th>
                          <th className="p-2.5">QC</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {singleChallanDetails.receipts.map((r) => (
                          <tr key={r.receipt_id}>
                            <td className="p-2.5 font-mono-code font-bold text-emerald-600">{r.receipt_no}</td>
                            <td className="p-2.5">{new Date(r.receipt_date).toLocaleDateString()}</td>
                            <td className="p-2.5 font-mono-code">{r.vendor_dc_no || '-'}</td>
                            <td className="p-2.5 font-mono-code">₹{r.total_amount?.toFixed(2)}</td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                {r.qc_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-[var(--border-subtle)] text-center text-xs text-slate-400">
                    No inward receipts recorded yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* PRINTABLE 1: GST Rule 55 / Sec 143 Job-Work Delivery Challan       */}
        {/* ------------------------------------------------------------------ */}
        {printChallanId && singleChallanDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-3xl bg-white text-slate-900 p-8 shadow-2xl print:p-0 print:m-0 print:w-full print:shadow-none space-y-6">
              <div className="flex items-center justify-between border-b pb-4 print:hidden">
                <span className="font-bold text-sm text-slate-500">Print Preview — Delivery Challan</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-xs"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Challan</span>
                  </button>
                  <button
                    onClick={() => setPrintChallanId(null)}
                    className="p-2 rounded-xl text-slate-400 hover:bg-slate-100"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Body */}
              <div className="space-y-6 text-xs text-slate-900 font-sans">
                {/* Header */}
                <div className="text-center border-b pb-4 space-y-1">
                  <h2 className="text-xl font-black uppercase tracking-wider text-slate-900">
                    Kashvira Manufacturing ERP
                  </h2>
                  <p className="text-xs text-slate-600">
                    Plot 44, GIDC Industrial Estate, Vatva, Ahmedabad - 382445, Gujarat, India | GSTIN: 24AABCK1234F1Z8
                  </p>
                  <div className="inline-block px-4 py-1 mt-2 font-black uppercase tracking-widest text-xs border border-slate-900 rounded">
                    DELIVERY CHALLAN FOR JOB-WORK (Rule 55 & Section 143 of CGST Act, 2017)
                  </div>
                </div>

                {/* Consignor & Consignee */}
                <div className="grid grid-cols-2 gap-4 p-4 border rounded-xl text-xs">
                  <div className="space-y-1 border-r pr-4">
                    <span className="font-bold text-slate-500 uppercase tracking-wider block text-[10px]">
                      Details of Consignor (Sender)
                    </span>
                    <div className="font-bold text-sm text-slate-900">Kashvira Manufacturing Plant 1</div>
                    <div>Plot 44, GIDC Estate, Vatva, Ahmedabad</div>
                    <div>GSTIN: 24AABCK1234F1Z8 | State: Gujarat (24)</div>
                    <div>Dispatch Warehouse: {singleChallanDetails.from_warehouse_name}</div>
                  </div>

                  <div className="space-y-1 pl-2">
                    <span className="font-bold text-slate-500 uppercase tracking-wider block text-[10px]">
                      Details of Consignee (Subcontractor / Job Worker)
                    </span>
                    <div className="font-bold text-sm text-slate-900">{singleChallanDetails.vendor_name}</div>
                    <div>Code: {singleChallanDetails.vendor_code}</div>
                    <div>Nature of Process: <span className="font-semibold">{singleChallanDetails.nature_of_processing}</span></div>
                    <div>Expected Return: {singleChallanDetails.expected_return_date || 'Within 180 Days'}</div>
                  </div>
                </div>

                {/* Metadata Row */}
                <div className="grid grid-cols-4 gap-2 p-3 bg-slate-50 border rounded-xl font-mono-code text-[11px]">
                  <div>
                    <span className="text-slate-500 block text-[10px] font-sans">Challan No:</span>
                    <span className="font-bold">{singleChallanDetails.challan_no}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-sans">Challan Date:</span>
                    <span>{new Date(singleChallanDetails.challan_date).toLocaleDateString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-sans">Vehicle No:</span>
                    <span>{singleChallanDetails.vehicle_no || 'By Hand'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] font-sans">E-Way Bill #:</span>
                    <span className="font-bold">{singleChallanDetails.eway_bill_no || 'EXEMPT'}</span>
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full text-left border text-xs">
                  <thead className="bg-slate-100 font-bold border-b">
                    <tr>
                      <th className="p-2 border-r w-12 text-center">Sr.</th>
                      <th className="p-2 border-r">Description of Goods</th>
                      <th className="p-2 border-r w-24">HSN Code</th>
                      <th className="p-2 border-r w-20">UOM</th>
                      <th className="p-2 border-r w-24 text-right">Quantity</th>
                      <th className="p-2 border-r w-28 text-right">Unit Rate (₹)</th>
                      <th className="p-2 text-right w-32">Taxable Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono-code">
                    {singleChallanDetails.items?.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2 border-r text-center">{idx + 1}</td>
                        <td className="p-2 border-r font-sans">
                          <span className="font-bold">{it.item_code}</span> — {it.item_description}
                          {it.heat_no && <div className="text-[10px] text-slate-500">Heat/Lot: {it.heat_no}</div>}
                        </td>
                        <td className="p-2 border-r">{it.hsn_code || '8481'}</td>
                        <td className="p-2 border-r">{it.uom_code}</td>
                        <td className="p-2 border-r text-right font-bold">{it.sent_qty.toFixed(2)}</td>
                        <td className="p-2 border-r text-right">{it.unit_rate.toFixed(2)}</td>
                        <td className="p-2 text-right font-bold">{it.total_value.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t font-bold bg-slate-50">
                    <tr>
                      <td colSpan={4} className="p-2 text-right uppercase">Total Valuation:</td>
                      <td className="p-2 border-r text-right font-mono-code">
                        {singleChallanDetails.total_sent_qty.toFixed(2)}
                      </td>
                      <td className="p-2 border-r"></td>
                      <td className="p-2 text-right font-mono-code">
                        ₹{singleChallanDetails.total_estimated_value.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Statutory Declarations */}
                <div className="p-3 border rounded-xl bg-slate-50 text-[10px] text-slate-600 space-y-1">
                  <p className="font-bold uppercase text-slate-800">Statutory GST Declaration (Section 143):</p>
                  <p>
                    1. Certified that the goods described above are being sent to the job-worker for carrying out job-work operations under Section 143 read with Rule 55 of CGST Rules, 2017, and are not intended for sale.
                  </p>
                  <p>
                    2. The said goods shall be brought back to the principal plant within one year of being sent out, or supplied on payment of tax.
                  </p>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-8 pt-8 text-center text-xs">
                  <div className="border-t pt-2">
                    <span className="font-bold block">For Kashvira Manufacturing ERP</span>
                    <span className="text-[11px] text-slate-500">(Authorized Signatory / Stores Head)</span>
                  </div>
                  <div className="border-t pt-2">
                    <span className="font-bold block">Received Above Goods in Good Order</span>
                    <span className="text-[11px] text-slate-500">(Signature & Stamp of Subcontractor)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* CONFIRM DELETE MODAL                                              */}
        {/* ------------------------------------------------------------------ */}
        <ConfirmDeleteModal
          isOpen={Boolean(deleteChallanTarget)}
          entityType="Job-Work Challan"
          entityName={deleteChallanTarget?.challan_no || 'Challan'}
          isDeleting={deleteChallanMutation.isPending}
          onClose={() => setDeleteChallanTarget(null)}
          onConfirm={async () => {
            if (deleteChallanTarget) {
              await deleteChallanMutation.mutateAsync(deleteChallanTarget.challan_id);
            }
          }}
        />
      </div>
    </PermissionGate>
  );
};
