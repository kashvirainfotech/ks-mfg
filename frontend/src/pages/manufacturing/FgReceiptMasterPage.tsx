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
  Scale,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  Warehouse,
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

// ----------------------------------------------------------------------------
// Interfaces & Types
// ----------------------------------------------------------------------------
interface FgReceiptSummary {
  totalReceipts: number;
  postedReceipts: number;
  draftReceipts: number;
  totalAcceptedQty: number;
  totalAbsorbedCost: number;
  totalByproductCredit: number;
}

interface FgReceiptByproduct {
  receipt_byproduct_id?: number;
  item_id: number;
  item_code?: string;
  item_name?: string;
  uom_id: number;
  uom_code?: string;
  product_type: string;
  quantity: number;
  recovery_rate: number;
  total_recovery_value: number;
  to_warehouse_id: number;
  warehouse_code?: string;
  warehouse_name?: string;
  to_bin_id?: number | null;
  bin_code?: string;
  remarks?: string;
}

interface FgReceipt {
  fg_receipt_id: number;
  receipt_no: string;
  receipt_date: string;
  wo_id: number;
  wo_no: string;
  wo_planned_qty?: number;
  wo_completed_qty?: number;
  wo_batch_no?: string;
  item_id: number;
  item_code: string;
  item_name: string;
  drawing_no?: string;
  revision_no?: string;
  uom_id: number;
  uom_code: string;
  uom_name?: string;
  to_warehouse_id: number;
  warehouse_code?: string;
  warehouse_name?: string;
  to_bin_id?: number | null;
  bin_code?: string;
  bin_name?: string;
  batch_no?: string;
  heat_no?: string;
  manufacturing_date: string;
  expiry_date?: string | null;
  received_qty: number;
  accepted_qty: number;
  rejected_qty: number;
  rework_qty: number;
  qc_status: string;
  qc_inspected_by?: number | null;
  qc_inspector_name?: string;
  qc_inspected_at?: string | null;
  qc_remarks?: string | null;
  material_cost: number;
  operation_cost: number;
  byproduct_credit: number;
  total_cost: number;
  unit_cost: number;
  status: string;
  posted_by?: number | null;
  posted_by_name?: string;
  posted_at?: string | null;
  remarks?: string | null;
  byproduct_count?: number;
  byproducts?: FgReceiptByproduct[];
}

interface FgReceiptLookups {
  workOrders: Array<{
    wo_id: number;
    wo_no: string;
    item_id: number;
    bom_id: number | null;
    routing_id: number | null;
    planned_qty: number;
    completed_qty: number;
    scrapped_qty: number;
    batch_no: string;
    target_warehouse_id: number;
    status: string;
    actual_material_cost: number;
    actual_operation_cost: number;
    actual_total_cost: number;
    item_code: string;
    item_name: string;
    drawing_no?: string;
    revision_no?: string;
    uom_id: number;
    uom_code: string;
    uom_name: string;
    target_warehouse_code?: string;
    target_warehouse_name?: string;
  }>;
  warehouses: Array<{
    warehouse_id: number;
    warehouse_code: string;
    warehouse_name: string;
    warehouse_type: string;
  }>;
  bins: Array<{
    bin_id: number;
    warehouse_id: number;
    bin_code: string;
    bin_name: string;
    zone_code?: string;
  }>;
  items: Array<{
    item_id: number;
    item_code: string;
    item_name: string;
    item_type: string;
    standard_cost: number;
    uom_id: number;
    uom_code: string;
    uom_name: string;
  }>;
  uoms: Array<{
    uom_id: number;
    uom_code: string;
    uom_name: string;
    uom_type: string;
  }>;
}

export const FgReceiptMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters state
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [woFilter, setWoFilter] = useState<string>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals & Drawers state
  const [drawerReceipt, setDrawerReceipt] = useState<FgReceipt | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingReceipt, setEditingReceipt] = useState<FgReceipt | null>(null);
  const [qcModalReceipt, setQcModalReceipt] = useState<FgReceipt | null>(null);
  const [postModalReceipt, setPostModalReceipt] = useState<FgReceipt | null>(null);
  const [printReceipt, setPrintReceipt] = useState<FgReceipt | null>(null);
  const [deleteReceipt, setDeleteReceipt] = useState<FgReceipt | null>(null);

  // --------------------------------------------------------------------------
  // Data Queries
  // --------------------------------------------------------------------------
  const { data: summaryData } = useQuery({
    queryKey: ['fg-receipts-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<FgReceiptSummary>>(
        '/manufacturing/fg-receipts/summary',
      );
      return res.data.data;
    },
  });

  const { data: lookupsData } = useQuery({
    queryKey: ['fg-receipts-lookups'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<FgReceiptLookups>>(
        '/manufacturing/fg-receipts/lookups',
      );
      return res.data.data;
    },
  });

  const { data: receiptsData, isLoading } = useQuery({
    queryKey: [
      'fg-receipts',
      statusFilter,
      woFilter,
      warehouseFilter,
      searchTerm,
    ],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (woFilter !== 'ALL') params.woId = woFilter;
      if (warehouseFilter !== 'ALL') params.warehouseId = warehouseFilter;
      if (searchTerm) params.search = searchTerm;
      params.limit = '100';

      const res = await apiClient.get<ApiResponse<{ data: FgReceipt[] }>>(
        '/manufacturing/fg-receipts',
        { params },
      );
      return res.data.data.data;
    },
  });

  // Drawer single receipt fetch
  const { data: fullDrawerReceipt } = useQuery({
    queryKey: ['fg-receipt-detail', drawerReceipt?.fg_receipt_id],
    enabled: !!drawerReceipt?.fg_receipt_id,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<FgReceipt>>(
        `/manufacturing/fg-receipts/${drawerReceipt!.fg_receipt_id}`,
      );
      return res.data.data;
    },
  });

  // Print full receipt fetch
  const { data: fullPrintReceipt } = useQuery({
    queryKey: ['fg-receipt-print', printReceipt?.fg_receipt_id],
    enabled: !!printReceipt?.fg_receipt_id,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<FgReceipt>>(
        `/manufacturing/fg-receipts/${printReceipt!.fg_receipt_id}`,
      );
      return res.data.data;
    },
  });

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/manufacturing/fg-receipts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fg-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['fg-receipts-summary'] });
      setDeleteReceipt(null);
    },
  });

  const qcMutation = useMutation({
    mutationFn: async ({
      id,
      dto,
    }: {
      id: number;
      dto: {
        acceptedQty: number;
        rejectedQty: number;
        reworkQty: number;
        qcStatus: string;
        qcRemarks: string;
      };
    }) => {
      await apiClient.post(`/manufacturing/fg-receipts/${id}/qc-inspection`, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fg-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['fg-receipts-summary'] });
      setQcModalReceipt(null);
    },
  });

  const postMutation = useMutation({
    mutationFn: async ({
      id,
      dto,
    }: {
      id: number;
      dto: {
        toWarehouseId?: number;
        toBinId?: number | null;
        remarks?: string;
      };
    }) => {
      await apiClient.post(`/manufacturing/fg-receipts/${id}/post`, dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fg-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['fg-receipts-summary'] });
      setPostModalReceipt(null);
    },
  });

  // --------------------------------------------------------------------------
  // Table Columns Definition
  // --------------------------------------------------------------------------
  const columns = useMemo<MasterTableColumn<FgReceipt>[]>(
    () => [
      {
        key: 'receipt_no',
        header: 'Receipt # & Date',
        sortable: true,
        sortValue: (row: FgReceipt) => row.receipt_no,
        render: (row: FgReceipt) => (
          <div>
            <div className="font-semibold text-xs text-[var(--text-primary)]">
              {row.receipt_no}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
              <Calendar className="w-3 h-3" />
              {row.receipt_date}
            </div>
          </div>
        ),
      },
      {
        key: 'wo_no',
        header: 'Work Order & Lot',
        sortable: true,
        sortValue: (row: FgReceipt) => row.wo_no,
        render: (row: FgReceipt) => (
          <div>
            <div className="font-medium text-xs text-[var(--brand-600)] dark:text-[var(--brand-400)]">
              {row.wo_no}
            </div>
            <div className="text-[11px] text-[var(--text-secondary)] font-mono">
              Lot: {row.batch_no || 'NA'}
            </div>
          </div>
        ),
      },
      {
        key: 'item_name',
        header: 'Finished Good Item',
        sortable: true,
        sortValue: (row: FgReceipt) => row.item_name,
        render: (row: FgReceipt) => (
          <div className="max-w-[200px]">
            <div className="font-semibold text-xs text-[var(--text-primary)] truncate">
              {row.item_name}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] font-mono">
              {row.item_code}
            </div>
          </div>
        ),
      },
      {
        key: 'quantities',
        header: 'Output Quantities',
        sortable: true,
        sortValue: (row: FgReceipt) => row.accepted_qty,
        render: (row: FgReceipt) => {
          const yieldPercent =
            row.received_qty > 0
              ? ((row.accepted_qty / row.received_qty) * 100).toFixed(1)
              : '0.0';
          return (
            <div>
              <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <span className="text-[var(--text-success)]">{row.accepted_qty}</span>
                <span className="text-[var(--text-muted)]">/ {row.received_qty} {row.uom_code}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                {row.rejected_qty > 0 && (
                  <span className="text-rose-500 font-medium">Rej: {row.rejected_qty}</span>
                )}
                {row.rework_qty > 0 && (
                  <span className="text-amber-500 font-medium">Rew: {row.rework_qty}</span>
                )}
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                  {yieldPercent}% Yield
                </span>
              </div>
            </div>
          );
        },
      },
      {
        key: 'warehouse_name',
        header: 'Target Warehouse',
        sortable: true,
        sortValue: (row: FgReceipt) => row.warehouse_name || row.warehouse_code || '',
        render: (row: FgReceipt) => (
          <div>
            <div className="text-xs font-medium text-[var(--text-primary)] truncate max-w-[150px]">
              {row.warehouse_name || row.warehouse_code}
            </div>
            {row.bin_code && (
              <div className="text-[11px] text-[var(--text-muted)] font-mono">
                Bin: {row.bin_code}
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'costing',
        header: 'Absorption Cost',
        sortable: true,
        sortValue: (row: FgReceipt) => row.total_cost,
        render: (row: FgReceipt) => (
          <div>
            <div className="text-xs font-bold text-[var(--text-primary)]">
              ₹{row.total_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] text-[var(--text-muted)] font-mono">
              @ ₹{row.unit_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}/unit
            </div>
          </div>
        ),
      },
      {
        key: 'qc_status',
        header: 'QC Inspection',
        sortable: true,
        sortValue: (row: FgReceipt) => row.qc_status,
        render: (row: FgReceipt) => {
          let badgeClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
          if (row.qc_status === 'ACCEPTED')
            badgeClass = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300';
          else if (row.qc_status === 'DEVIATION_ACCEPTED')
            badgeClass = 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';
          else if (row.qc_status === 'REJECTED')
            badgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';

          return (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${badgeClass}`}
            >
              {row.qc_status}
            </span>
          );
        },
      },
      {
        key: 'status',
        header: 'Receipt Status',
        sortable: true,
        sortValue: (row: FgReceipt) => row.status,
        render: (row: FgReceipt) => {
          let badgeClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
          if (row.status === 'POSTED')
            badgeClass = 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300';
          else if (row.status === 'CANCELLED')
            badgeClass = 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300';

          return (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${badgeClass}`}
            >
              {row.status === 'POSTED' ? 'POSTED TO STOCK' : row.status}
            </span>
          );
        },
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row: FgReceipt) => (
          <div className="flex items-center gap-1">
            {/* View Details */}
            <button
              onClick={() => setDrawerReceipt(row)}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition"
              title="View Details"
            >
              <Eye className="w-4 h-4" />
            </button>

            {/* Print Slip */}
            <PermissionGate screen="MFG_FG_RECEIPT" action="PRINT">
              <button
                onClick={() => setPrintReceipt(row)}
                className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition"
                title="Print FG Inward Slip"
              >
                <Printer className="w-4 h-4" />
              </button>
            </PermissionGate>

            {/* QC Inspection (Draft only) */}
            {row.status === 'DRAFT' && (
              <PermissionGate screen="MFG_FG_RECEIPT" action="APPROVE">
                <button
                  onClick={() => setQcModalReceipt(row)}
                  className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded transition"
                  title="QC Inspection Clearance"
                >
                  <ShieldCheck className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {/* Post to Stock (Draft with QC cleared) */}
            {row.status === 'DRAFT' && (
              <PermissionGate screen="MFG_FG_RECEIPT" action="POST">
                <button
                  onClick={() => setPostModalReceipt(row)}
                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded transition"
                  title="Post to Finished Goods Stock & Complete WO"
                >
                  <Send className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {/* Edit (Draft only) */}
            {row.status === 'DRAFT' && (
              <PermissionGate screen="MFG_FG_RECEIPT" action="EDIT">
                <button
                  onClick={() => setEditingReceipt(row)}
                  className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded transition"
                  title="Edit Draft Receipt"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {/* Delete (Draft only) */}
            {row.status === 'DRAFT' && (
              <PermissionGate screen="MFG_FG_RECEIPT" action="DELETE">
                <button
                  onClick={() => setDeleteReceipt(row)}
                  className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition"
                  title="Delete Draft"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}
          </div>
        ),
      },
    ],
    [],
  );

  const groupByOptions: GroupByOption<FgReceipt>[] = [
    { key: 'wo_no', label: 'Work Order', groupValue: (r) => r.wo_no || 'NA' },
    {
      key: 'warehouse_name',
      label: 'Warehouse',
      groupValue: (r) => r.warehouse_name || r.warehouse_code || 'NA',
    },
    { key: 'status', label: 'Receipt Status', groupValue: (r) => r.status || 'NA' },
    { key: 'qc_status', label: 'QC Status', groupValue: (r) => r.qc_status || 'NA' },
  ];

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------------- */}
      {/* Page Header */}
      {/* ---------------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Finished Goods Receipt & Absorption Costing
            </h1>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Shopfloor production receipts, scrap/by-product accounting, automated WMS stock ledger posting, and Work Order absorption cost rollups.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGate screen="MFG_FG_RECEIPT" action="ADD">
            <button
              onClick={() => {
                setEditingReceipt(null);
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[var(--brand-600)] hover:bg-[var(--brand-700)] rounded-lg shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              New FG Receipt
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* Executive Summary & KPI Metrics */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Receipts */}
        <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              Total FG Receipts
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
            {summaryData?.totalReceipts || 0}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Across active production lines
          </div>
        </div>

        {/* Posted / In-Stock */}
        <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              Posted & In-Stock
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <Warehouse className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
            {summaryData?.postedReceipts || 0}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
            {summaryData?.totalAcceptedQty.toLocaleString('en-IN') || 0} units transferred to WMS
          </div>
        </div>

        {/* Pending QC / Draft */}
        <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              Pending QC Clearance
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
            {summaryData?.draftReceipts || 0}
          </div>
          <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
            Awaiting inspection or staging signoff
          </div>
        </div>

        {/* Total Absorbed Cost */}
        <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-muted)]">
              Absorbed Production Cost
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-[var(--text-primary)]">
            ₹
            {(summaryData?.totalAbsorbedCost || 0).toLocaleString('en-IN', {
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="text-[11px] text-[var(--text-muted)] mt-1">
            Less ₹{(summaryData?.totalByproductCredit || 0).toLocaleString('en-IN')} scrap credit
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* Filters Bar */}
      {/* ---------------------------------------------------------------------- */}
      <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search by receipt #, Work Order, batch/lot, item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs bg-transparent border-0 focus:outline-hidden text-[var(--text-primary)] placeholder-[var(--text-muted)]"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] focus:outline-hidden"
          >
            <option value="ALL">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="POSTED">Posted to Stock</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Work Order Filter */}
          <select
            value={woFilter}
            onChange={(e) => setWoFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] focus:outline-hidden max-w-[180px]"
          >
            <option value="ALL">All Work Orders</option>
            {lookupsData?.workOrders?.map((wo) => (
              <option key={wo.wo_id} value={wo.wo_id}>
                {wo.wo_no} ({wo.item_code})
              </option>
            ))}
          </select>

          {/* Target Warehouse Filter */}
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] focus:outline-hidden max-w-[180px]"
          >
            <option value="ALL">All Warehouses</option>
            {lookupsData?.warehouses?.map((wh) => (
              <option key={wh.warehouse_id} value={wh.warehouse_id}>
                {wh.warehouse_code} - {wh.warehouse_name}
              </option>
            ))}
          </select>

          {(statusFilter !== 'ALL' || woFilter !== 'ALL' || warehouseFilter !== 'ALL' || searchTerm) && (
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setWoFilter('ALL');
                setWarehouseFilter('ALL');
                setSearchTerm('');
              }}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* Master Data Table */}
      {/* ---------------------------------------------------------------------- */}
      <MasterDataTable<FgReceipt>
        title="Finished Goods Receipts Register"
        subtitle="Shopfloor Production Receipts, Scrap Accounting & Absorption Costing"
        screenCode="MFG_FG_RECEIPT"
        tableNameBadge="tbl_mfg_fg_receipt_header"
        data={receiptsData || []}
        isLoading={isLoading}
        rowKey={(r) => r.fg_receipt_id}
        columns={columns}
        searchPlaceholder="Filter finished goods receipts..."
        searchPredicate={(r, q) => {
          const query = q.toLowerCase();
          return Boolean(
            r.receipt_no.toLowerCase().includes(query) ||
            r.wo_no.toLowerCase().includes(query) ||
            r.item_name.toLowerCase().includes(query) ||
            r.item_code.toLowerCase().includes(query) ||
            (r.batch_no && r.batch_no.toLowerCase().includes(query)) ||
            (r.warehouse_name && r.warehouse_name.toLowerCase().includes(query)) ||
            (r.qc_status && r.qc_status.toLowerCase().includes(query))
          );
        }}
        groupByOptions={groupByOptions}
        addButtonLabel="New FG Receipt"
        onAddClick={() => {
          setEditingReceipt(null);
          setIsCreateModalOpen(true);
        }}
      />

      {/* ---------------------------------------------------------------------- */}
      {/* Details Slide-Over Drawer */}
      {/* ---------------------------------------------------------------------- */}
      {drawerReceipt && fullDrawerReceipt && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-[var(--bg-surface)] h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right">
            {/* Drawer Header */}
            <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-[var(--brand-50)] text-[var(--brand-600)] dark:bg-[var(--brand-500)]/20 dark:text-[var(--brand-400)]">
                  <PackageCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[var(--text-primary)]">
                    {fullDrawerReceipt.receipt_no}
                  </h2>
                  <div className="text-[11px] text-[var(--text-muted)]">
                    Work Order: {fullDrawerReceipt.wo_no} • {fullDrawerReceipt.receipt_date}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPrintReceipt(fullDrawerReceipt)}
                  className="p-1.5 text-slate-500 hover:text-indigo-600 rounded transition"
                  title="Print Slip"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDrawerReceipt(null)}
                  className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
              {/* Status Header Block */}
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-[var(--text-muted)]">Receipt Status</span>
                  <div className="font-bold text-xs mt-0.5">{fullDrawerReceipt.status}</div>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--text-muted)]">QC Status</span>
                  <div className="font-bold text-xs mt-0.5 text-emerald-600 dark:text-emerald-400">
                    {fullDrawerReceipt.qc_status}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--text-muted)]">Target Warehouse</span>
                  <div className="font-bold text-xs mt-0.5">
                    {fullDrawerReceipt.warehouse_code}
                  </div>
                </div>
                <div>
                  <span className="text-[11px] text-[var(--text-muted)]">Storage Bin</span>
                  <div className="font-mono text-xs mt-0.5">
                    {fullDrawerReceipt.bin_code || 'Unassigned'}
                  </div>
                </div>
              </div>

              {/* Item & Lot Identification */}
              <div className="space-y-2">
                <h3 className="font-bold text-slate-700 dark:text-slate-300">
                  Produced Item & Lot Traceability
                </h3>
                <div className="grid grid-cols-2 gap-3 p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)]">Item Name</span>
                    <div className="font-semibold text-xs mt-0.5">{fullDrawerReceipt.item_name}</div>
                    <div className="text-[11px] font-mono text-[var(--text-muted)]">{fullDrawerReceipt.item_code}</div>
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)]">Engineering Drawing / Rev</span>
                    <div className="font-mono text-xs mt-0.5">
                      {fullDrawerReceipt.drawing_no || 'NA'} (Rev: {fullDrawerReceipt.revision_no || '0'})
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)]">Shopfloor Batch / Lot #</span>
                    <div className="font-mono font-semibold text-xs mt-0.5">
                      {fullDrawerReceipt.batch_no || 'NA'}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)]">Melt / Heat #</span>
                    <div className="font-mono text-xs mt-0.5">{fullDrawerReceipt.heat_no || 'NA'}</div>
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)]">Manufacturing Date</span>
                    <div className="mt-0.5">{fullDrawerReceipt.manufacturing_date}</div>
                  </div>
                  <div>
                    <span className="text-[11px] text-[var(--text-muted)]">Expiry / Retest Date</span>
                    <div className="mt-0.5">{fullDrawerReceipt.expiry_date || 'NA'}</div>
                  </div>
                </div>
              </div>

              {/* Quantity Breakdown */}
              <div className="space-y-2">
                <h3 className="font-bold text-slate-700 dark:text-slate-300">
                  Quantity & QC Yield Breakdown
                </h3>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30">
                    <span className="text-[10px] text-[var(--text-muted)]">Submitted</span>
                    <div className="text-sm font-bold mt-0.5">
                      {fullDrawerReceipt.received_qty} {fullDrawerReceipt.uom_code}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20">
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Accepted</span>
                    <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {fullDrawerReceipt.accepted_qty} {fullDrawerReceipt.uom_code}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20">
                    <span className="text-[10px] text-rose-600 dark:text-rose-400">Rejected</span>
                    <div className="text-sm font-bold text-rose-700 dark:text-rose-300 mt-0.5">
                      {fullDrawerReceipt.rejected_qty} {fullDrawerReceipt.uom_code}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
                    <span className="text-[10px] text-amber-600 dark:text-amber-400">Rework</span>
                    <div className="text-sm font-bold text-amber-700 dark:text-amber-300 mt-0.5">
                      {fullDrawerReceipt.rework_qty} {fullDrawerReceipt.uom_code}
                    </div>
                  </div>
                </div>

                {fullDrawerReceipt.qc_remarks && (
                  <div className="p-2.5 rounded bg-slate-50 dark:bg-slate-900/40 text-[11px] text-[var(--text-secondary)] italic">
                    <span className="font-semibold not-italic">QC Remarks:</span> {fullDrawerReceipt.qc_remarks}
                  </div>
                )}
              </div>

              {/* Absorption Costing Rollup */}
              <div className="space-y-2">
                <h3 className="font-bold text-slate-700 dark:text-slate-300">
                  Absorption Costing Rollup
                </h3>
                <div className="p-3 rounded-lg border border-[var(--border-subtle)] space-y-2 bg-[var(--bg-surface)]">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[var(--text-muted)]">Actual Raw Material Cost</span>
                    <span className="font-mono font-medium">
                      ₹{fullDrawerReceipt.material_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-[var(--text-muted)]">Actual Operation & Machining Cost</span>
                    <span className="font-mono font-medium">
                      + ₹{fullDrawerReceipt.operation_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-emerald-600 dark:text-emerald-400">
                    <span>Less: Scrap / By-Product Recovery Credit</span>
                    <span className="font-mono font-medium">
                      - ₹{fullDrawerReceipt.byproduct_credit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-[var(--border-subtle)] flex justify-between items-center text-xs font-bold">
                    <span>Net Absorbed Production Cost</span>
                    <span className="font-mono text-sm text-[var(--brand-600)] dark:text-[var(--brand-400)]">
                      ₹{fullDrawerReceipt.total_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-[var(--text-muted)] pt-1">
                    <span>Unit Production Cost (Net / Accepted Qty)</span>
                    <span className="font-mono font-semibold text-[var(--text-primary)]">
                      ₹{fullDrawerReceipt.unit_cost.toLocaleString('en-IN', { minimumFractionDigits: 4 })} / {fullDrawerReceipt.uom_code}
                    </span>
                  </div>
                </div>
              </div>

              {/* By-Products & Recoverable Scrap */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-700 dark:text-slate-300">
                    Scrap & By-Product Accounting ({fullDrawerReceipt.byproducts?.length || 0})
                  </h3>
                </div>

                {(!fullDrawerReceipt.byproducts || fullDrawerReceipt.byproducts.length === 0) ? (
                  <div className="p-3 text-center text-slate-400 italic rounded border border-dashed border-slate-200 dark:border-slate-800">
                    No recoverable scrap or by-products generated in this run.
                  </div>
                ) : (
                  <div className="border border-[var(--border-subtle)] rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-[var(--border-subtle)]">
                        <tr>
                          <th className="p-2 font-semibold text-[11px]">Item / Type</th>
                          <th className="p-2 font-semibold text-[11px]">Quantity</th>
                          <th className="p-2 font-semibold text-[11px]">Recovery Rate</th>
                          <th className="p-2 font-semibold text-[11px]">Credit Value</th>
                          <th className="p-2 font-semibold text-[11px]">Warehouse</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border-subtle)]">
                        {fullDrawerReceipt.byproducts.map((bp) => (
                          <tr key={bp.receipt_byproduct_id || Math.random()}>
                            <td className="p-2">
                              <div className="font-medium text-[var(--text-primary)]">{bp.item_name}</div>
                              <div className="text-[10px] text-[var(--text-muted)]">{bp.product_type}</div>
                            </td>
                            <td className="p-2 font-mono">
                              {bp.quantity} {bp.uom_code}
                            </td>
                            <td className="p-2 font-mono">₹{bp.recovery_rate}</td>
                            <td className="p-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ₹{bp.total_recovery_value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 text-[11px] text-[var(--text-secondary)]">
                              {bp.warehouse_code}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Signoff Audit Block */}
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-[var(--border-subtle)] space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">QC Inspected By:</span>
                  <span className="font-medium">{fullDrawerReceipt.qc_inspector_name || 'Pending'}</span>
                </div>
                {fullDrawerReceipt.posted_by_name && (
                  <div className="flex justify-between">
                    <span className="text-[var(--text-muted)]">Posted to Stock By:</span>
                    <span className="font-medium">{fullDrawerReceipt.posted_by_name} ({fullDrawerReceipt.posted_at?.slice(0, 10)})</span>
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-[var(--border-subtle)] bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
              <button
                onClick={() => setDrawerReceipt(null)}
                className="px-3.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {fullDrawerReceipt.status === 'DRAFT' && (
                  <PermissionGate screen="MFG_FG_RECEIPT" action="POST">
                    <button
                      onClick={() => {
                        setDrawerReceipt(null);
                        setPostModalReceipt(fullDrawerReceipt);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Post to Stock
                    </button>
                  </PermissionGate>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Create / Edit Modal */}
      {/* ---------------------------------------------------------------------- */}
      {(isCreateModalOpen || editingReceipt) && (
        <CreateEditFgReceiptModal
          initialData={editingReceipt}
          lookups={lookupsData}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingReceipt(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['fg-receipts'] });
            queryClient.invalidateQueries({ queryKey: ['fg-receipts-summary'] });
            setIsCreateModalOpen(false);
            setEditingReceipt(null);
          }}
        />
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* QC Clearance Modal */}
      {/* ---------------------------------------------------------------------- */}
      {qcModalReceipt && (
        <QcInspectionModal
          receipt={qcModalReceipt}
          onClose={() => setQcModalReceipt(null)}
          onConfirm={(dto) => qcMutation.mutate({ id: qcModalReceipt.fg_receipt_id, dto })}
          isLoading={qcMutation.isPending}
        />
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Post to Stock Modal */}
      {/* ---------------------------------------------------------------------- */}
      {postModalReceipt && (
        <PostFgReceiptModal
          receipt={postModalReceipt}
          warehouses={lookupsData?.warehouses || []}
          bins={lookupsData?.bins || []}
          onClose={() => setPostModalReceipt(null)}
          onConfirm={(dto) => postMutation.mutate({ id: postModalReceipt.fg_receipt_id, dto })}
          isLoading={postMutation.isPending}
        />
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Printable FG Inward Slip Modal */}
      {/* ---------------------------------------------------------------------- */}
      {printReceipt && fullPrintReceipt && (
        <PrintFgInwardSlipModal
          receipt={fullPrintReceipt}
          onClose={() => setPrintReceipt(null)}
        />
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Delete Confirmation Modal */}
      {/* ---------------------------------------------------------------------- */}
      {deleteReceipt && (
        <ConfirmDeleteModal
          isOpen={true}
          entityType="Finished Goods Receipt"
          entityName={deleteReceipt.receipt_no}
          isDeleting={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteReceipt.fg_receipt_id)}
          onClose={() => setDeleteReceipt(null)}
        />
      )}
    </div>
  );
};

// ----------------------------------------------------------------------------
// Create / Edit FG Receipt Modal Component
// ----------------------------------------------------------------------------
interface CreateEditModalProps {
  initialData: FgReceipt | null;
  lookups?: FgReceiptLookups;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateEditFgReceiptModal: React.FC<CreateEditModalProps> = ({
  initialData,
  lookups,
  onClose,
  onSuccess,
}) => {
  const isEditing = !!initialData;

  const [selectedWoId, setSelectedWoId] = useState<number>(initialData?.wo_id || 0);
  const [receiptDate, setReceiptDate] = useState<string>(
    initialData?.receipt_date || new Date().toISOString().slice(0, 10),
  );
  const [batchNo, setBatchNo] = useState<string>(initialData?.batch_no || '');
  const [heatNo, setHeatNo] = useState<string>(initialData?.heat_no || '');
  const [manufacturingDate, setManufacturingDate] = useState<string>(
    initialData?.manufacturing_date || new Date().toISOString().slice(0, 10),
  );
  const [expiryDate, setExpiryDate] = useState<string>(initialData?.expiry_date || '');
  const [toWarehouseId, setToWarehouseId] = useState<number>(initialData?.to_warehouse_id || 0);
  const [toBinId, setToBinId] = useState<number | null>(initialData?.to_bin_id || null);

  const [receivedQty, setReceivedQty] = useState<number>(initialData?.received_qty || 1);
  const [acceptedQty, setAcceptedQty] = useState<number>(
    initialData?.accepted_qty !== undefined ? initialData.accepted_qty : 1,
  );
  const [rejectedQty, setRejectedQty] = useState<number>(initialData?.rejected_qty || 0);
  const [reworkQty, setReworkQty] = useState<number>(initialData?.rework_qty || 0);

  const [materialCost, setMaterialCost] = useState<number>(initialData?.material_cost || 0);
  const [operationCost, setOperationCost] = useState<number>(initialData?.operation_cost || 0);
  const [remarks, setRemarks] = useState<string>(initialData?.remarks || '');

  // By-products line items
  const [byproducts, setByproducts] = useState<FgReceiptByproduct[]>(
    initialData?.byproducts || [],
  );

  const [isSuggestingByproducts, setIsSuggestingByproducts] = useState<boolean>(false);
  const [isEstimatingCosts, setIsEstimatingCosts] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected Work Order object
  const selectedWo = useMemo(
    () => lookups?.workOrders.find((w) => w.wo_id === selectedWoId),
    [lookups, selectedWoId],
  );

  // When WO changes, set defaults
  const handleWoChange = (woId: number) => {
    setSelectedWoId(woId);
    const wo = lookups?.workOrders.find((w) => w.wo_id === woId);
    if (wo) {
      if (wo.target_warehouse_id) setToWarehouseId(wo.target_warehouse_id);
      if (wo.batch_no) setBatchNo(wo.batch_no);

      const pendingQty = Math.max(1, wo.planned_qty - wo.completed_qty);
      setReceivedQty(pendingQty);
      setAcceptedQty(pendingQty);

      // Auto-estimate absorption costs
      estimateCosts(woId, pendingQty);
    }
  };

  // 1-Click Suggest from BOM By-Products
  const suggestBomByproducts = async () => {
    if (!selectedWoId) return;
    try {
      setIsSuggestingByproducts(true);
      const res = await apiClient.get<ApiResponse<FgReceiptByproduct[]>>(
        `/manufacturing/fg-receipts/wo-byproducts/${selectedWoId}?receivedQty=${receivedQty}`,
      );
      if (res.data.data && res.data.data.length > 0) {
        setByproducts(res.data.data);
      } else {
        alert('No co-products or scrap items defined in the BOM for this Work Order.');
      }
    } catch (err: any) {
      alert(`Could not fetch BOM by-products: ${err.message}`);
    } finally {
      setIsSuggestingByproducts(false);
    }
  };

  // 1-Click Auto Estimate Absorption Costs
  const estimateCosts = async (woId: number, qty: number) => {
    try {
      setIsEstimatingCosts(true);
      const res = await apiClient.get<ApiResponse<any>>(
        `/manufacturing/fg-receipts/wo-cost-estimate/${woId}?receivedQty=${qty}`,
      );
      if (res.data.data) {
        setMaterialCost(res.data.data.estimatedMaterialCost);
        setOperationCost(res.data.data.estimatedOperationCost);
      }
    } catch {
      // ignore
    } finally {
      setIsEstimatingCosts(false);
    }
  };

  // Byproducts calculation
  const byproductCredit = useMemo(() => {
    return byproducts.reduce((sum, bp) => sum + (bp.quantity || 0) * (bp.recovery_rate || 0), 0);
  }, [byproducts]);

  const totalCost = useMemo(() => {
    return Math.max(0, Number((materialCost + operationCost - byproductCredit).toFixed(2)));
  }, [materialCost, operationCost, byproductCredit]);

  const unitCost = useMemo(() => {
    return acceptedQty > 0 ? Number((totalCost / acceptedQty).toFixed(4)) : 0;
  }, [totalCost, acceptedQty]);

  // Handle by-product row changes
  const addByproductRow = () => {
    const firstItem = lookups?.items[0];
    const defaultScrapWh =
      lookups?.warehouses.find((w) => w.warehouse_type === 'SCRAP_REJECTION')?.warehouse_id ||
      lookups?.warehouses[0]?.warehouse_id ||
      1001;

    setByproducts([
      ...byproducts,
      {
        item_id: firstItem?.item_id || 1001,
        item_code: firstItem?.item_code,
        item_name: firstItem?.item_name,
        uom_id: firstItem?.uom_id || 1001,
        product_type: 'RECOVERABLE_SCRAP',
        quantity: 1,
        recovery_rate: 50,
        total_recovery_value: 50,
        to_warehouse_id: defaultScrapWh,
        remarks: '',
      },
    ]);
  };

  const updateByproductRow = (index: number, field: string, val: any) => {
    const updated = [...byproducts];
    const row = { ...updated[index], [field]: val };
    if (field === 'quantity' || field === 'recovery_rate') {
      const q = field === 'quantity' ? Number(val) : row.quantity;
      const r = field === 'recovery_rate' ? Number(val) : row.recovery_rate;
      row.total_recovery_value = Number((q * r).toFixed(2));
    }
    if (field === 'item_id') {
      const it = lookups?.items.find((i) => i.item_id === Number(val));
      if (it) {
        row.item_code = it.item_code;
        row.item_name = it.item_name;
        row.uom_id = it.uom_id;
        row.recovery_rate = it.standard_cost || 0;
        row.total_recovery_value = Number((row.quantity * row.recovery_rate).toFixed(2));
      }
    }
    updated[index] = row;
    setByproducts(updated);
  };

  const removeByproductRow = (index: number) => {
    setByproducts(byproducts.filter((_, i) => i !== index));
  };

  // Submit Handler
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedWoId) {
      setErrorMsg('Please select a valid Work Order.');
      return;
    }

    if (!toWarehouseId) {
      setErrorMsg('Please select a target finished goods warehouse.');
      return;
    }

    if (receivedQty <= 0) {
      setErrorMsg('Received quantity must be greater than 0.');
      return;
    }

    if (acceptedQty + rejectedQty + reworkQty > receivedQty) {
      setErrorMsg('Sum of accepted, rejected, and rework quantities exceeds received quantity.');
      return;
    }

    const payload = {
      woId: selectedWoId,
      itemId: selectedWo?.item_id || initialData?.item_id,
      uomId: selectedWo?.uom_id || initialData?.uom_id,
      receiptDate,
      batchNo,
      heatNo,
      manufacturingDate,
      expiryDate: expiryDate || null,
      toWarehouseId,
      toBinId: toBinId || null,
      receivedQty,
      acceptedQty,
      rejectedQty,
      reworkQty,
      materialCost,
      operationCost,
      byproductCredit,
      totalCost,
      unitCost,
      remarks,
      byproducts: byproducts.map((bp) => ({
        itemId: bp.item_id,
        uomId: bp.uom_id,
        productType: bp.product_type,
        quantity: bp.quantity,
        recoveryRate: bp.recovery_rate,
        totalRecoveryValue: bp.total_recovery_value,
        toWarehouseId: bp.to_warehouse_id,
        toBinId: bp.to_bin_id || null,
        remarks: bp.remarks,
      })),
    };

    try {
      setIsSubmitting(true);
      if (isEditing) {
        await apiClient.put(`/manufacturing/fg-receipts/${initialData.fg_receipt_id}`, payload);
      } else {
        await apiClient.post('/manufacturing/fg-receipts', payload);
      }
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || err.message || 'Failed to save FG receipt.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredBins = useMemo(
    () => lookups?.bins.filter((b) => b.warehouse_id === toWarehouseId) || [],
    [lookups, toWarehouseId],
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-4xl max-h-[90vh] bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-subtle)] bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-[var(--brand-50)] text-[var(--brand-600)] dark:bg-[var(--brand-500)]/20 dark:text-[var(--brand-400)]">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)]">
                {isEditing ? `Edit Draft Receipt #${initialData.receipt_no}` : 'New Finished Goods Production Receipt'}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Receive finished products from shopfloor, record scrap/by-products, and rollup absorption costs.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Work Order Selection & Date Header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3.5 rounded-xl border border-[var(--border-subtle)] bg-slate-50/50 dark:bg-slate-900/20">
            <div>
              <label className="block font-semibold text-[var(--text-primary)] mb-1">
                Parent Work Order <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedWoId}
                onChange={(e) => handleWoChange(Number(e.target.value))}
                disabled={isEditing}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] font-medium focus:ring-1 focus:ring-[var(--brand-500)]"
              >
                <option value={0}>Select Active Work Order...</option>
                {lookups?.workOrders.map((wo) => (
                  <option key={wo.wo_id} value={wo.wo_id}>
                    {wo.wo_no} — {wo.item_name} ({wo.completed_qty}/{wo.planned_qty} {wo.uom_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[var(--text-primary)] mb-1">
                Receipt Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--brand-500)]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[var(--text-primary)] mb-1">
                Shopfloor Batch / Lot #
              </label>
              <input
                type="text"
                placeholder="e.g. BAT-2026-VLV-001"
                value={batchNo}
                onChange={(e) => setBatchNo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] font-mono focus:ring-1 focus:ring-[var(--brand-500)]"
              />
            </div>
          </div>

          {/* Produced Item Snapshot */}
          {selectedWo && (
            <div className="p-3 rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                  Finished Item Specification
                </span>
                <div className="font-bold text-xs text-[var(--text-primary)] mt-0.5">
                  {selectedWo.item_name}
                </div>
                <div className="text-[11px] font-mono text-[var(--text-muted)]">
                  Code: {selectedWo.item_code} • UOM: {selectedWo.uom_code}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[var(--text-muted)]">WO Progress</span>
                <div className="text-xs font-bold text-[var(--text-primary)]">
                  {selectedWo.completed_qty} / {selectedWo.planned_qty} {selectedWo.uom_code} completed
                </div>
              </div>
            </div>
          )}

          {/* Target Storage Location & Dates */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block font-semibold text-[var(--text-primary)] mb-1">
                Target Warehouse <span className="text-rose-500">*</span>
              </label>
              <select
                value={toWarehouseId}
                onChange={(e) => {
                  setToWarehouseId(Number(e.target.value));
                  setToBinId(null);
                }}
                required
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--brand-500)]"
              >
                <option value={0}>Select Warehouse...</option>
                {lookups?.warehouses.map((wh) => (
                  <option key={wh.warehouse_id} value={wh.warehouse_id}>
                    {wh.warehouse_code} - {wh.warehouse_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[var(--text-primary)] mb-1">
                Storage Bin
              </label>
              <select
                value={toBinId || ''}
                onChange={(e) => setToBinId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] font-mono focus:ring-1 focus:ring-[var(--brand-500)]"
              >
                <option value="">Unassigned / Bulk Floor</option>
                {filteredBins.map((b) => (
                  <option key={b.bin_id} value={b.bin_id}>
                    {b.bin_code} ({b.bin_name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[var(--text-primary)] mb-1">
                Manufacturing Date
              </label>
              <input
                type="date"
                value={manufacturingDate}
                onChange={(e) => setManufacturingDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--brand-500)]"
              />
            </div>

            <div>
              <label className="block font-semibold text-[var(--text-primary)] mb-1">
                Melt / Heat #
              </label>
              <input
                type="text"
                placeholder="e.g. HT-SS316-2026-04"
                value={heatNo}
                onChange={(e) => setHeatNo(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] font-mono focus:ring-1 focus:ring-[var(--brand-500)]"
              />
            </div>
          </div>

          {/* Quantities & Yield */}
          <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[var(--text-primary)]">Output Quantities & Disposition</h3>
              <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                {receivedQty > 0 ? ((acceptedQty / receivedQty) * 100).toFixed(1) : 0}% Yield
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-[var(--text-primary)] mb-1">
                  Submitted Qty <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={receivedQty}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setReceivedQty(val);
                    setAcceptedQty(val);
                    if (selectedWoId) estimateCosts(selectedWoId, val);
                  }}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold focus:ring-1 focus:ring-[var(--brand-500)]"
                />
              </div>

              <div>
                <label className="block font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                  Accepted Qty (Good) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={acceptedQty}
                  onChange={(e) => setAcceptedQty(Number(e.target.value))}
                  required
                  className="w-full px-3 py-2 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/20 text-[var(--text-primary)] font-bold focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-rose-600 dark:text-rose-400 mb-1">
                  Rejected Qty (Scrap)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={rejectedQty}
                  onChange={(e) => setRejectedQty(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--brand-500)]"
                />
              </div>

              <div>
                <label className="block font-semibold text-amber-600 dark:text-amber-400 mb-1">
                  Rework Qty
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={reworkQty}
                  onChange={(e) => setReworkQty(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--brand-500)]"
                />
              </div>
            </div>
          </div>

          {/* By-Products & Recoverable Scrap Grid */}
          <div className="p-3.5 rounded-xl border border-[var(--border-subtle)] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[var(--text-primary)]">
                  Recoverable Scrap & By-Products
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Co-products and scrap offcuts generated during this batch. Total recovery credit is deducted from production cost.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={suggestBomByproducts}
                  disabled={!selectedWoId || isSuggestingByproducts}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 rounded-lg transition disabled:opacity-50"
                  title="Auto-fill co-products and recoverable scrap from parent BOM"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isSuggestingByproducts ? 'Suggesting...' : 'Suggest from BOM'}
                </button>
                <button
                  type="button"
                  onClick={addByproductRow}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[var(--brand-600)] bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/20 hover:bg-[var(--brand-100)] rounded-lg transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Row
                </button>
              </div>
            </div>

            {byproducts.length === 0 ? (
              <div className="p-3 text-center text-slate-400 italic rounded border border-dashed border-slate-200 dark:border-slate-800">
                No scrap or by-products specified. Click &quot;Suggest from BOM&quot; or &quot;Add Row&quot;.
              </div>
            ) : (
              <div className="space-y-2 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-[var(--border-subtle)]">
                    <tr>
                      <th className="p-2 font-semibold">Item Material</th>
                      <th className="p-2 font-semibold">Type</th>
                      <th className="p-2 font-semibold w-24">Qty</th>
                      <th className="p-2 font-semibold w-24">Recovery Rate</th>
                      <th className="p-2 font-semibold w-28">Total Credit</th>
                      <th className="p-2 font-semibold">Warehouse</th>
                      <th className="p-2 font-semibold w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {byproducts.map((bp, idx) => (
                      <tr key={idx}>
                        <td className="p-2">
                          <select
                            value={bp.item_id}
                            onChange={(e) => updateByproductRow(idx, 'item_id', e.target.value)}
                            className="w-full p-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs"
                          >
                            {lookups?.items.map((it) => (
                              <option key={it.item_id} value={it.item_id}>
                                {it.item_code} - {it.item_name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <select
                            value={bp.product_type}
                            onChange={(e) => updateByproductRow(idx, 'product_type', e.target.value)}
                            className="w-full p-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs"
                          >
                            <option value="RECOVERABLE_SCRAP">Recoverable Scrap</option>
                            <option value="BY_PRODUCT">By-Product</option>
                            <option value="CO_PRODUCT">Co-Product</option>
                            <option value="HAZARDOUS_WASTE">Hazardous Waste</option>
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.001"
                            min="0"
                            value={bp.quantity}
                            onChange={(e) => updateByproductRow(idx, 'quantity', e.target.value)}
                            className="w-full p-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] font-mono text-xs"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={bp.recovery_rate}
                            onChange={(e) => updateByproductRow(idx, 'recovery_rate', e.target.value)}
                            className="w-full p-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] font-mono text-xs"
                          />
                        </td>
                        <td className="p-2 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          ₹{bp.total_recovery_value.toFixed(2)}
                        </td>
                        <td className="p-2">
                          <select
                            value={bp.to_warehouse_id}
                            onChange={(e) => updateByproductRow(idx, 'to_warehouse_id', Number(e.target.value))}
                            className="w-full p-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs"
                          >
                            {lookups?.warehouses.map((wh) => (
                              <option key={wh.warehouse_id} value={wh.warehouse_id}>
                                {wh.warehouse_code}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeByproductRow(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition"
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

          {/* Absorption Cost Rollup Summary Card */}
          <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-slate-50 dark:bg-slate-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-[var(--text-primary)]">
                Absorption Cost Rollup Breakdown
              </h3>
              <button
                type="button"
                onClick={() => selectedWoId && estimateCosts(selectedWoId, receivedQty)}
                disabled={!selectedWoId || isEstimatingCosts}
                className="text-[11px] font-semibold text-[var(--brand-600)] hover:underline flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className="w-3 h-3" />
                {isEstimatingCosts ? 'Recalculating...' : 'Sync with WO Actuals'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  Actual Material Cost (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={materialCost}
                  onChange={(e) => setMaterialCost(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  Actual Operation Cost (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={operationCost}
                  onChange={(e) => setOperationCost(Number(e.target.value))}
                  className="w-full px-3 py-1.5 rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[var(--text-muted)] mb-1">
                  Scrap Recovery Credit (₹)
                </label>
                <div className="w-full px-3 py-1.5 rounded border border-[var(--border-subtle)] bg-slate-100 dark:bg-slate-800 font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                  - ₹{byproductCredit.toFixed(2)}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-[11px] text-[var(--text-muted)]">Net Production Cost:</span>
                <span className="text-sm font-bold text-[var(--brand-600)] dark:text-[var(--brand-400)] ml-1 font-mono">
                  ₹{totalCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-[var(--text-muted)]">Net Unit Cost:</span>
                <span className="text-sm font-extrabold text-[var(--text-primary)] ml-1 font-mono">
                  ₹{unitCost.toLocaleString('en-IN', { minimumFractionDigits: 4 })} / unit
                </span>
              </div>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[var(--text-primary)] mb-1">
              Production & QC Remarks
            </label>
            <textarea
              rows={2}
              placeholder="Inspector test observations, melt lot certificates, or shopfloor notes..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:ring-1 focus:ring-[var(--brand-500)]"
            />
          </div>

          {/* Modal Footer */}
          <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[var(--brand-600)] hover:bg-[var(--brand-700)] rounded-lg shadow-sm transition disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {isSubmitting ? 'Saving...' : isEditing ? 'Update Receipt' : 'Save Draft Receipt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// QC Inspection Modal Component
// ----------------------------------------------------------------------------
interface QcInspectionModalProps {
  receipt: FgReceipt;
  onClose: () => void;
  onConfirm: (dto: {
    acceptedQty: number;
    rejectedQty: number;
    reworkQty: number;
    qcStatus: string;
    qcRemarks: string;
  }) => void;
  isLoading: boolean;
}

const QcInspectionModal: React.FC<QcInspectionModalProps> = ({
  receipt,
  onClose,
  onConfirm,
  isLoading,
}) => {
  const [acceptedQty, setAcceptedQty] = useState<number>(receipt.accepted_qty);
  const [rejectedQty, setRejectedQty] = useState<number>(receipt.rejected_qty);
  const [reworkQty, setReworkQty] = useState<number>(receipt.rework_qty);
  const [qcStatus, setQcStatus] = useState<string>(
    receipt.qc_status !== 'PENDING' ? receipt.qc_status : 'ACCEPTED',
  );
  const [qcRemarks, setQcRemarks] = useState<string>(receipt.qc_remarks || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (acceptedQty + rejectedQty + reworkQty > receipt.received_qty) {
      setErrorMsg('Sum of accepted, rejected, and rework quantities exceeds received quantity.');
      return;
    }
    onConfirm({
      acceptedQty,
      rejectedQty,
      reworkQty,
      qcStatus,
      qcRemarks,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                QC Inspection Clearance
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                Receipt #{receipt.receipt_no} • {receipt.item_code}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-2.5 rounded bg-rose-50 text-rose-700 text-xs">{errorMsg}</div>
          )}

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 border border-[var(--border-subtle)] flex justify-between">
            <div>
              <span className="text-[11px] text-[var(--text-muted)]">Submitted Qty:</span>
              <div className="font-bold text-sm">{receipt.received_qty} {receipt.uom_code}</div>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-[var(--text-muted)]">Lot #:</span>
              <div className="font-mono font-medium">{receipt.batch_no || 'NA'}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block font-semibold text-emerald-600 mb-1">Accepted</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={acceptedQty}
                onChange={(e) => setAcceptedQty(Number(e.target.value))}
                required
                className="w-full px-2.5 py-1.5 rounded border border-emerald-300 dark:border-emerald-800 font-bold text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-rose-600 mb-1">Rejected</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={rejectedQty}
                onChange={(e) => setRejectedQty(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded border border-rose-300 dark:border-rose-800 text-xs"
              />
            </div>
            <div>
              <label className="block font-semibold text-amber-600 mb-1">Rework</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={reworkQty}
                onChange={(e) => setReworkQty(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded border border-amber-300 dark:border-amber-800 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[var(--text-primary)] mb-1">
              Inspection Disposition Decision
            </label>
            <select
              value={qcStatus}
              onChange={(e) => setQcStatus(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] font-bold text-xs"
            >
              <option value="ACCEPTED">ACCEPTED (Pass 100%)</option>
              <option value="DEVIATION_ACCEPTED">DEVIATION_ACCEPTED (Concession Clearance)</option>
              <option value="REJECTED">REJECTED (Total Lot Failure)</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-[var(--text-primary)] mb-1">
              Quality Observations & Remarks
            </label>
            <textarea
              rows={3}
              placeholder="Dimensional checks, tensile/hardness test results, or hydrostatic pressure readings..."
              value={qcRemarks}
              onChange={(e) => setQcRemarks(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs"
            />
          </div>

          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              {isLoading ? 'Saving...' : 'Confirm Clearance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// Post to Stock Modal Component
// ----------------------------------------------------------------------------
interface PostFgReceiptModalProps {
  receipt: FgReceipt;
  warehouses: Array<{ warehouse_id: number; warehouse_code: string; warehouse_name: string }>;
  bins: Array<{ bin_id: number; warehouse_id: number; bin_code: string; bin_name: string }>;
  onClose: () => void;
  onConfirm: (dto: { toWarehouseId?: number; toBinId?: number | null; remarks?: string }) => void;
  isLoading: boolean;
}

const PostFgReceiptModal: React.FC<PostFgReceiptModalProps> = ({
  receipt,
  warehouses,
  bins,
  onClose,
  onConfirm,
  isLoading,
}) => {
  const [targetWhId, setTargetWhId] = useState<number>(receipt.to_warehouse_id);
  const [targetBinId, setTargetBinId] = useState<number | null>(receipt.to_bin_id || null);
  const [postingNotes, setPostingNotes] = useState<string>('');

  const filteredBins = bins.filter((b) => b.warehouse_id === targetWhId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm({
      toWarehouseId: targetWhId,
      toBinId: targetBinId,
      remarks: postingNotes,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg bg-[var(--bg-surface)] rounded-2xl shadow-2xl border border-[var(--border-subtle)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border-subtle)] bg-blue-50 dark:bg-blue-950/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-600 text-white">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-blue-950 dark:text-blue-100">
                Post FG Receipt to Warehouse Stock
              </h2>
              <p className="text-[11px] text-blue-700 dark:text-blue-300">
                Receipt #{receipt.receipt_no} • Work Order: {receipt.wo_no}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-[var(--border-subtle)] space-y-2">
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Finished Item:</span>
              <span className="font-semibold">{receipt.item_name} ({receipt.item_code})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Accepted Qty to Credit:</span>
              <span className="font-bold text-emerald-600 font-mono">
                {receipt.accepted_qty} {receipt.uom_code}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">Total Valuation to Inward:</span>
              <span className="font-bold font-mono">
                ₹{receipt.total_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (@ ₹{receipt.unit_cost.toFixed(2)}/unit)
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-muted)]">QC Status:</span>
              <span className="font-bold text-emerald-600">{receipt.qc_status}</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 space-y-1 text-[11px]">
            <div className="font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              Automated WMS & Manufacturing Synchronizations:
            </div>
            <ul className="list-disc pl-5 space-y-0.5">
              <li>Debits WIP floor and credits target FG Warehouse stock ledger (`PUTAWAY_INWARD`).</li>
              <li>Updates on-hand quantities in bin storage matrix.</li>
              <li>Posts recoverable scrap/by-products to scrap warehouse ledger.</li>
              <li>Increments Work Order completed quantity. If target is met, marks WO as COMPLETED.</li>
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-[var(--text-primary)] mb-1">
                Target FG Warehouse
              </label>
              <select
                value={targetWhId}
                onChange={(e) => {
                  setTargetWhId(Number(e.target.value));
                  setTargetBinId(null);
                }}
                required
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs"
              >
                {warehouses.map((wh) => (
                  <option key={wh.warehouse_id} value={wh.warehouse_id}>
                    {wh.warehouse_code} - {wh.warehouse_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-[var(--text-primary)] mb-1">
                Storage Rack / Bin
              </label>
              <select
                value={targetBinId || ''}
                onChange={(e) => setTargetBinId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] font-mono text-xs"
              >
                <option value="">Unassigned / Bulk Staging</option>
                {filteredBins.map((b) => (
                  <option key={b.bin_id} value={b.bin_id}>
                    {b.bin_code} ({b.bin_name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-[var(--text-primary)] mb-1">
              Store Inward Handoff Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Palletized and wrapped on rack Bay 2"
              value={postingNotes}
              onChange={(e) => setPostingNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs"
            />
          </div>

          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              {isLoading ? 'Posting...' : 'Confirm Post to Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// Printable FG Inward Slip Modal Component
// ----------------------------------------------------------------------------
interface PrintModalProps {
  receipt: FgReceipt;
  onClose: () => void;
}

const PrintFgInwardSlipModal: React.FC<PrintModalProps> = ({ receipt, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-3xl max-h-[92vh] bg-white text-slate-900 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Actions Bar */}
        <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-100 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-slate-700" />
            <span className="font-bold text-xs">FG Production Inward Slip / Transfer Voucher</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded transition"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Voucher
            </button>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Area */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 text-xs bg-white" id="printable-area">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-extrabold uppercase tracking-tight text-slate-900">
                KASHVIRA INFOTECH MFG ERP
              </h1>
              <p className="text-[11px] text-slate-600">
                Advanced Discrete & Process Manufacturing • Plant #1 (Ahmedabad)
              </p>
              <p className="text-[10px] text-slate-500 font-mono">GSTIN: 24AAACK1234F1Z8</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-2.5 py-1 rounded bg-slate-900 text-white font-bold text-xs uppercase tracking-wider">
                FG PRODUCTION INWARD VOUCHER
              </span>
              <div className="text-xs font-mono font-bold mt-1">Voucher #: {receipt.receipt_no}</div>
              <div className="text-[11px] text-slate-600">Date: {receipt.receipt_date}</div>
            </div>
          </div>

          {/* Reference Meta Grid */}
          <div className="grid grid-cols-2 gap-4 p-3 border border-slate-300 rounded text-[11px]">
            <div>
              <div><span className="font-semibold">Work Order #:</span> {receipt.wo_no}</div>
              <div><span className="font-semibold">Lot / Melt Batch #:</span> {receipt.batch_no || 'NA'}</div>
              <div><span className="font-semibold">Heat Number:</span> {receipt.heat_no || 'NA'}</div>
            </div>
            <div>
              <div><span className="font-semibold">Target Warehouse:</span> {receipt.warehouse_name || receipt.warehouse_code}</div>
              <div><span className="font-semibold">Storage Bin:</span> {receipt.bin_code || 'Bulk Staging'}</div>
              <div><span className="font-semibold">Manufacturing Date:</span> {receipt.manufacturing_date}</div>
            </div>
          </div>

          {/* Output Line Items Table */}
          <div className="space-y-1">
            <h3 className="font-bold uppercase text-[11px] text-slate-800">
              Finished Product Specifications
            </h3>
            <table className="w-full border-collapse border border-slate-300 text-[11px]">
              <thead className="bg-slate-100 border-b border-slate-300">
                <tr>
                  <th className="border border-slate-300 p-2 text-left">Item Code</th>
                  <th className="border border-slate-300 p-2 text-left">Description</th>
                  <th className="border border-slate-300 p-2 text-center">UOM</th>
                  <th className="border border-slate-300 p-2 text-right">Submitted</th>
                  <th className="border border-slate-300 p-2 text-right">Accepted (Good)</th>
                  <th className="border border-slate-300 p-2 text-right">Unit Cost</th>
                  <th className="border border-slate-300 p-2 text-right">Total Valuation</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-300 p-2 font-mono font-semibold">{receipt.item_code}</td>
                  <td className="border border-slate-300 p-2">
                    <div>{receipt.item_name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Dwg: {receipt.drawing_no || 'NA'} (Rev: {receipt.revision_no || '0'})
                    </div>
                  </td>
                  <td className="border border-slate-300 p-2 text-center">{receipt.uom_code}</td>
                  <td className="border border-slate-300 p-2 text-right font-mono">{receipt.received_qty}</td>
                  <td className="border border-slate-300 p-2 text-right font-mono font-bold text-emerald-800">
                    {receipt.accepted_qty}
                  </td>
                  <td className="border border-slate-300 p-2 text-right font-mono">
                    ₹{receipt.unit_cost.toFixed(2)}
                  </td>
                  <td className="border border-slate-300 p-2 text-right font-mono font-bold">
                    ₹{receipt.total_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* By-Products / Scrap Section if any */}
          {receipt.byproducts && receipt.byproducts.length > 0 && (
            <div className="space-y-1">
              <h3 className="font-bold uppercase text-[11px] text-slate-800">
                Recoverable Scrap & Co-Products Generated
              </h3>
              <table className="w-full border-collapse border border-slate-300 text-[11px]">
                <thead className="bg-slate-100 border-b border-slate-300">
                  <tr>
                    <th className="border border-slate-300 p-1.5 text-left">Scrap Material</th>
                    <th className="border border-slate-300 p-1.5 text-left">Type</th>
                    <th className="border border-slate-300 p-1.5 text-right">Qty</th>
                    <th className="border border-slate-300 p-1.5 text-right">Recovery Rate</th>
                    <th className="border border-slate-300 p-1.5 text-right">Credit Value</th>
                  </tr>
                </thead>
                <tbody>
                  {receipt.byproducts.map((bp, i) => (
                    <tr key={i}>
                      <td className="border border-slate-300 p-1.5">{bp.item_name}</td>
                      <td className="border border-slate-300 p-1.5">{bp.product_type}</td>
                      <td className="border border-slate-300 p-1.5 text-right font-mono">
                        {bp.quantity} {bp.uom_code}
                      </td>
                      <td className="border border-slate-300 p-1.5 text-right font-mono">
                        ₹{bp.recovery_rate.toFixed(2)}
                      </td>
                      <td className="border border-slate-300 p-1.5 text-right font-mono font-bold">
                        ₹{bp.total_recovery_value.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Absorption Cost Rollup Table */}
          <div className="p-3 border border-slate-300 rounded space-y-1 text-[11px]">
            <div className="font-bold uppercase text-slate-800 pb-1 border-b border-slate-200">
              Manufacturing Absorption Cost Rollup
            </div>
            <div className="flex justify-between">
              <span>Actual Raw Material Cost:</span>
              <span className="font-mono">₹{receipt.material_cost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Actual Machining & Operation Cost:</span>
              <span className="font-mono">+ ₹{receipt.operation_cost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-emerald-800">
              <span>Less Scrap / By-Product Recovery Value:</span>
              <span className="font-mono">- ₹{receipt.byproduct_credit.toFixed(2)}</span>
            </div>
            <div className="pt-1 border-t border-slate-300 flex justify-between font-bold text-xs">
              <span>Net Production Valuation Transferred to Inventory:</span>
              <span className="font-mono">₹{receipt.total_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>

          {/* Signatures */}
          <div className="pt-12 grid grid-cols-3 gap-6 text-center text-xs">
            <div className="border-t border-slate-400 pt-1">
              <div className="font-bold">Production Supervisor</div>
              <div className="text-[10px] text-slate-500">Shopfloor Handover</div>
            </div>
            <div className="border-t border-slate-400 pt-1">
              <div className="font-bold">Quality Inspector</div>
              <div className="text-[10px] text-slate-500">{receipt.qc_status} Clearance Stamp</div>
            </div>
            <div className="border-t border-slate-400 pt-1">
              <div className="font-bold">Store / WMS Officer</div>
              <div className="text-[10px] text-slate-500">Putaway Acknowledgement</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
