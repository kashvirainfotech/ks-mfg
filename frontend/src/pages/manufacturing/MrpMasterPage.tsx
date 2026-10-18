import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Boxes,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  Cpu,
  DollarSign,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  GitBranch,
  Layers,
  Package,
  Play,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShoppingCart,
  Sliders,
  Sparkles,
  Tag,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
  Workflow,
  Wrench,
  X,
  Zap,
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
// TYPES & INTERFACES
// ============================================================================

export type OrderType = 'MAKE' | 'BUY' | 'SUBCONTRACT';
export type PlannedOrderStatus =
  | 'SUGGESTED'
  | 'CONFIRMED'
  | 'CONVERTED_TO_PR'
  | 'CONVERTED_TO_WO'
  | 'CANCELLED';

export interface PlannedOrder {
  planned_order_id: number;
  mrp_run_id: number;
  mrp_run_no?: string;
  planned_order_no: string;
  item_id: number;
  item_code: string;
  item_name: string;
  item_type: string;
  bom_id?: number | null;
  bom_code?: string | null;
  bom_name?: string | null;
  routing_id?: number | null;
  routing_code?: string | null;
  routing_name?: string | null;
  order_type: OrderType;
  source_demand_type: string;
  parent_planned_order_id?: number | null;
  parent_planned_order_no?: string | null;
  bom_level: number;
  gross_requirement_qty: number;
  on_hand_stock_qty: number;
  scheduled_receipts_qty: number;
  safety_stock_qty: number;
  net_requirement_qty: number;
  planned_order_qty: number;
  uom_id: number;
  uom_code: string;
  uom_name: string;
  lead_time_days: number;
  required_by_date: string;
  order_release_date: string;
  estimated_unit_cost: number;
  estimated_total_cost: number;
  status: PlannedOrderStatus;
  converted_pr_id?: number | null;
  converted_pr_no?: string | null;
  converted_pr_status?: string | null;
  converted_wo_id?: number | null;
  remarks?: string | null;
  is_past_due?: boolean;
}

export interface MrpRunHeader {
  mrp_run_id: number;
  mrp_run_no: string;
  run_date: string;
  planning_horizon_days: number;
  demand_source: string;
  status: string;
  total_items_analyzed: number;
  total_planned_orders: number;
  total_planned_buy_qty: number;
  total_planned_make_qty: number;
  total_estimated_spend: number;
  execution_time_ms: number;
  run_by?: number | null;
  run_by_name?: string | null;
  remarks?: string | null;
  created_date?: string;
  past_due_order_count?: number;
  plannedOrders?: PlannedOrder[];
}

export interface MrpSummary {
  totalRuns: number;
  totalPlannedOrders: number;
  totalPlannedBuySpend: number;
  totalPlannedMakeOrders: number;
  criticalPastDueCount: number;
}

export interface MrpLookups {
  items: Array<{
    item_id: number;
    item_code: string;
    item_name: string;
    item_type: string;
    base_uom_id: number;
    uom_code: string;
    uom_name: string;
    standard_cost: number;
    purchase_rate: number;
    reorder_point: number;
    safety_stock: number;
    lead_time_days: number;
  }>;
  warehouses: Array<{
    warehouse_id: number;
    warehouse_code: string;
    warehouse_name: string;
    warehouse_type: string;
  }>;
  departments: Array<{
    dept_id: number;
    dept_code: string;
    dept_name: string;
    dept_category: string;
  }>;
  vendors: Array<{
    party_id: number;
    party_code: string;
    party_name: string;
  }>;
}

// Badge Mappings
const ORDER_TYPE_MAP: Record<OrderType, { label: string; bg: string; text: string; icon: any }> = {
  MAKE: {
    label: 'MAKE (In-House Work Order)',
    bg: 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/30',
    text: 'text-blue-700 dark:text-blue-300',
    icon: Workflow,
  },
  BUY: {
    label: 'BUY (Purchase Requisition)',
    bg: 'bg-purple-500/10 dark:bg-purple-500/20 border-purple-500/30',
    text: 'text-purple-700 dark:text-purple-300',
    icon: ShoppingCart,
  },
  SUBCONTRACT: {
    label: 'SUBCONTRACT (Outsourced)',
    bg: 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-300',
    icon: GitBranch,
  },
};

const STATUS_BADGE_MAP: Record<PlannedOrderStatus, { label: string; bg: string; text: string; dot: string }> = {
  SUGGESTED: {
    label: 'Suggested',
    bg: 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  CONFIRMED: {
    label: 'Confirmed',
    bg: 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/30',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  CONVERTED_TO_PR: {
    label: 'Converted to PR',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  CONVERTED_TO_WO: {
    label: 'Converted to WO',
    bg: 'bg-cyan-500/10 dark:bg-cyan-500/20 border-cyan-500/30',
    text: 'text-cyan-700 dark:text-cyan-300',
    dot: 'bg-cyan-500',
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-zinc-500/10 dark:bg-zinc-500/20 border-zinc-500/30',
    text: 'text-zinc-600 dark:text-zinc-400',
    dot: 'bg-zinc-400',
  },
};

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export const MrpMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'ORDERS' | 'RUNS' | 'TREE'>('ORDERS');

  // Filters State
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [bomLevelFilter, setBomLevelFilter] = useState<string>('');
  const [pastDueOnlyFilter, setPastDueOnlyFilter] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selection for 1-Click PR Conversion
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);

  // Modals
  const [isRunMrpModalOpen, setIsRunMrpModalOpen] = useState<boolean>(false);
  const [isConvertPrModalOpen, setIsConvertPrModalOpen] = useState<boolean>(false);
  const [viewingOrder, setViewingOrder] = useState<PlannedOrder | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  // Delete State
  const [deleteRunTarget, setDeleteRunTarget] = useState<MrpRunHeader | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  // Run MRP Form State
  const [runForm, setRunForm] = useState({
    planningHorizonDays: 30,
    demandSource: 'BUFFER_DEFICIT',
    includeSafetyStock: true,
    remarks: '',
  });

  // Convert to PR Form State
  const [prForm, setPrForm] = useState({
    warehouseId: 0,
    departmentId: 0,
    requiredByDate: '',
    priority: 'MEDIUM',
    purpose: '',
  });

  // --------------------------------------------------------------------------
  // QUERIES
  // --------------------------------------------------------------------------

  // 1. KPI Summary
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    refetch: refetchSummary,
  } = useQuery<ApiResponse<MrpSummary>>({
    queryKey: ['mrp-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<MrpSummary>>('/manufacturing/mrp/summary');
      return res.data;
    },
  });

  // 2. Lookups
  const { data: lookupsData } = useQuery<ApiResponse<MrpLookups>>({
    queryKey: ['mrp-lookups'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<MrpLookups>>('/manufacturing/mrp/lookups');
      return res.data;
    },
  });

  // 3. Runs List
  const {
    data: runsData,
    isLoading: isRunsLoading,
    refetch: refetchRuns,
  } = useQuery<ApiResponse<{ data: MrpRunHeader[] }>>({
    queryKey: ['mrp-runs'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<{ data: MrpRunHeader[] }>>(
        '/manufacturing/mrp/runs?limit=50',
      );
      return res.data;
    },
  });

  // 4. Planned Orders (Filtered)
  const {
    data: ordersData,
    isLoading: isOrdersLoading,
    refetch: refetchOrders,
  } = useQuery<ApiResponse<{ data: PlannedOrder[]; meta: { total: number } }>>({
    queryKey: [
      'mrp-planned-orders',
      selectedRunId,
      orderTypeFilter,
      statusFilter,
      bomLevelFilter,
      pastDueOnlyFilter,
      searchQuery,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('limit', '100');
      if (selectedRunId) params.append('mrpRunId', String(selectedRunId));
      if (orderTypeFilter) params.append('orderType', orderTypeFilter);
      if (statusFilter) params.append('status', statusFilter);
      if (bomLevelFilter !== '') params.append('bomLevel', bomLevelFilter);
      if (pastDueOnlyFilter) params.append('isPastDue', 'true');
      if (searchQuery.trim()) params.append('search', searchQuery.trim());

      const res = await apiClient.get<ApiResponse<{ data: PlannedOrder[]; meta: { total: number } }>>(
        `/manufacturing/mrp/planned-orders?${params.toString()}`,
      );
      return res.data;
    },
  });

  // Summary Shortcuts
  const summary = summaryData?.data || {
    totalRuns: 0,
    totalPlannedOrders: 0,
    totalPlannedBuySpend: 0,
    totalPlannedMakeOrders: 0,
    criticalPastDueCount: 0,
  };

  const runsList = runsData?.data?.data || [];
  const plannedOrders = ordersData?.data?.data || [];
  const lookups = lookupsData?.data;

  // --------------------------------------------------------------------------
  // MUTATIONS
  // --------------------------------------------------------------------------

  // Run MRP Mutation
  const runMrpMutation = useMutation({
    mutationFn: async (payload: typeof runForm) => {
      const res = await apiClient.post<ApiResponse<MrpRunHeader>>('/manufacturing/mrp/run', payload);
      return res.data;
    },
    onSuccess: (data) => {
      setIsRunMrpModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['mrp-summary'] });
      queryClient.invalidateQueries({ queryKey: ['mrp-runs'] });
      queryClient.invalidateQueries({ queryKey: ['mrp-planned-orders'] });
      if (data?.data?.mrp_run_id) {
        setSelectedRunId(data.data.mrp_run_id);
      }
      setActiveTab('ORDERS');
    },
  });

  // Convert to PR Mutation
  const convertPrMutation = useMutation({
    mutationFn: async (payload: {
      plannedOrderIds: number[];
      warehouseId?: number;
      departmentId?: number;
      requiredByDate?: string;
      priority?: string;
      purpose?: string;
    }) => {
      const res = await apiClient.post<ApiResponse<any>>('/manufacturing/mrp/convert-to-pr', payload);
      return res.data;
    },
    onSuccess: () => {
      setIsConvertPrModalOpen(false);
      setSelectedOrderIds([]);
      queryClient.invalidateQueries({ queryKey: ['mrp-summary'] });
      queryClient.invalidateQueries({ queryKey: ['mrp-planned-orders'] });
    },
  });

  // Status Change Mutation
  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: 'SUGGESTED' | 'CONFIRMED' | 'CANCELLED' }) => {
      const res = await apiClient.put<ApiResponse<any>>(
        `/manufacturing/mrp/planned-orders/${id}/status`,
        { status },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mrp-planned-orders'] });
      queryClient.invalidateQueries({ queryKey: ['mrp-summary'] });
    },
  });

  // Delete Run Mutation
  const deleteRunMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete<ApiResponse<any>>(`/manufacturing/mrp/runs/${id}`);
      return res.data;
    },
    onSuccess: () => {
      setIsDeleteModalOpen(false);
      setDeleteRunTarget(null);
      if (selectedRunId === deleteRunTarget?.mrp_run_id) {
        setSelectedRunId(null);
      }
      queryClient.invalidateQueries({ queryKey: ['mrp-summary'] });
      queryClient.invalidateQueries({ queryKey: ['mrp-runs'] });
      queryClient.invalidateQueries({ queryKey: ['mrp-planned-orders'] });
    },
    onError: (err: any) => {
      setDeleteErrorMessage(
        err?.response?.data?.message || err?.message || 'Failed to delete MRP run',
      );
    },
  });

  // --------------------------------------------------------------------------
  // HANDLERS
  // --------------------------------------------------------------------------

  const handleSelectAllBuyOrders = () => {
    const selectable = plannedOrders.filter(
      (o) => o.order_type === 'BUY' && o.status !== 'CONVERTED_TO_PR',
    );
    if (selectedOrderIds.length === selectable.length) {
      setSelectedOrderIds([]);
    } else {
      setSelectedOrderIds(selectable.map((o) => o.planned_order_id));
    }
  };

  const handleToggleOrderSelection = (id: number) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const selectedBuyOrders = useMemo(() => {
    return plannedOrders.filter((o) => selectedOrderIds.includes(o.planned_order_id));
  }, [plannedOrders, selectedOrderIds]);

  const selectedBuyTotalSpend = useMemo(() => {
    return selectedBuyOrders.reduce((sum, o) => sum + (o.estimated_total_cost || 0), 0);
  }, [selectedBuyOrders]);

  const handleOpenConvertModal = () => {
    if (selectedBuyOrders.length === 0) return;
    const defaultWh = lookups?.warehouses?.[0]?.warehouse_id || 1001;
    const defaultDept =
      lookups?.departments?.find((d) => d.dept_category === 'SUPPLY_CHAIN')?.dept_id ||
      lookups?.departments?.[0]?.dept_id ||
      1004;

    const earliestDate = [...selectedBuyOrders]
      .map((o) => o.required_by_date)
      .sort()[0];

    setPrForm({
      warehouseId: defaultWh,
      departmentId: defaultDept,
      requiredByDate: earliestDate || new Date().toISOString().split('T')[0],
      priority: 'MEDIUM',
      purpose: `MRP Replenishment for ${selectedBuyOrders.length} planned items`,
    });
    setIsConvertPrModalOpen(true);
  };

  const handleRefreshAll = () => {
    refetchSummary();
    refetchRuns();
    refetchOrders();
  };

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 p-4 md:p-6 space-y-6">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/20">
              <Compass className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-50">
                  Material Requirements Planning (MRP-I)
                </h1>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
                  Gross-to-Net Engine
                </span>
              </div>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-0.5">
                Multi-level BOM recursive explosion, buffer stock deficit forecasting & 1-click Purchase Requisition conversion
              </p>
            </div>
          </div>
        </div>

        {/* Global Header Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRefreshAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 transition"
            title="Refresh All"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isOrdersLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <PermissionGate screen="MFG_MRP" action="PRINT">
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-800 transition text-slate-700 dark:text-zinc-300"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Schedule
            </button>
          </PermissionGate>

          {selectedOrderIds.length > 0 && (
            <PermissionGate screen="MFG_MRP" action="CONVERT">
              <button
                onClick={handleOpenConvertModal}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition animate-bounce"
              >
                <ShoppingCart className="w-4 h-4" />
                Convert to PR ({selectedOrderIds.length})
              </button>
            </PermissionGate>
          )}

          <PermissionGate screen="MFG_MRP" action="RUN_MRP">
            <button
              onClick={() => setIsRunMrpModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white shadow-md shadow-indigo-500/25 transition"
            >
              <Play className="w-4 h-4 fill-current" />
              Execute MRP Run
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* 2. Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Runs */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              MRP Engine Executions
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
              <Timer className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              {summary.totalRuns}
            </span>
            <span className="text-xs text-slate-500">Completed Runs</span>
          </div>
          <div className="mt-3 flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Latest: {runsList[0]?.mrp_run_no || 'None'}
          </div>
        </div>

        {/* KPI 2: Total Planned Orders */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Total Planned Orders
            </span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              {summary.totalPlannedOrders}
            </span>
            <span className="text-xs text-slate-500">Orders Scheduled</span>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 font-medium">
              {summary.totalPlannedMakeOrders} MAKE
            </span>
            <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 font-medium">
              {summary.totalPlannedOrders - summary.totalPlannedMakeOrders} BUY
            </span>
          </div>
        </div>

        {/* KPI 3: Planned Buy Spend */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-zinc-400">
              Planned BUY Spend
            </span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
              ₹{Number(summary.totalPlannedBuySpend || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-zinc-400">
            Estimated procurement outflow across planned items
          </div>
        </div>

        {/* KPI 4: Past-Due Orders Warning */}
        <div
          className={`p-4 rounded-xl border ${
            summary.criticalPastDueCount > 0
              ? 'border-red-300 dark:border-red-800/80 bg-red-50/50 dark:bg-red-950/20'
              : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
          } shadow-sm relative overflow-hidden`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-medium uppercase tracking-wider ${
                summary.criticalPastDueCount > 0
                  ? 'text-red-700 dark:text-red-300'
                  : 'text-slate-500 dark:text-zinc-400'
              }`}
            >
              Past-Due Expedite Alerts
            </span>
            <div
              className={`p-2 rounded-lg ${
                summary.criticalPastDueCount > 0
                  ? 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 animate-pulse'
                  : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {summary.criticalPastDueCount > 0 ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold tracking-tight ${
                summary.criticalPastDueCount > 0
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-slate-900 dark:text-zinc-100'
              }`}
            >
              {summary.criticalPastDueCount}
            </span>
            <span className="text-xs text-slate-500">Orders Requiring Action</span>
          </div>
          <div className="mt-3 text-xs text-slate-500 dark:text-zinc-400">
            {summary.criticalPastDueCount > 0 ? (
              <span className="text-red-600 dark:text-red-400 font-semibold">
                Release date is earlier than today — expedite supplier/shopfloor!
              </span>
            ) : (
              'All planned release dates are within scheduled lead times'
            )}
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('ORDERS')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
            activeTab === 'ORDERS'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <Boxes className="w-4 h-4" />
          Planned Orders Register ({plannedOrders.length})
        </button>

        <button
          onClick={() => setActiveTab('RUNS')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
            activeTab === 'RUNS'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <Timer className="w-4 h-4" />
          MRP Execution Runs ({runsList.length})
        </button>

        <button
          onClick={() => setActiveTab('TREE')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
            activeTab === 'TREE'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-zinc-200'
          }`}
        >
          <Workflow className="w-4 h-4" />
          Multi-Level BOM Hierarchy
        </button>
      </div>

      {/* 4. TAB 1: PLANNED ORDERS REGISTER */}
      {activeTab === 'ORDERS' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* MRP Run Selector */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 dark:text-zinc-400 font-medium">Run:</span>
                <select
                  value={selectedRunId || ''}
                  onChange={(e) => setSelectedRunId(e.target.value ? Number(e.target.value) : null)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-medium focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">All MRP Runs</option>
                  {runsList.map((r) => (
                    <option key={r.mrp_run_id} value={r.mrp_run_id}>
                      {r.mrp_run_no} ({new Date(r.run_date).toLocaleDateString('en-IN')})
                    </option>
                  ))}
                </select>
              </div>

              {/* Order Type Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 dark:text-zinc-400 font-medium">Type:</span>
                <select
                  value={orderTypeFilter}
                  onChange={(e) => setOrderTypeFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-medium focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">All Types (MAKE / BUY)</option>
                  <option value="MAKE">MAKE (Work Orders)</option>
                  <option value="BUY">BUY (Procurement)</option>
                  <option value="SUBCONTRACT">SUBCONTRACT</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 dark:text-zinc-400 font-medium">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-medium focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">All Statuses</option>
                  <option value="SUGGESTED">SUGGESTED</option>
                  <option value="CONFIRMED">CONFIRMED</option>
                  <option value="CONVERTED_TO_PR">CONVERTED_TO_PR</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>

              {/* BOM Level Filter */}
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-500 dark:text-zinc-400 font-medium">Level:</span>
                <select
                  value={bomLevelFilter}
                  onChange={(e) => setBomLevelFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 font-medium focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">All BOM Levels</option>
                  <option value="0">Level 0 (Finished Assembly)</option>
                  <option value="1">Level 1 (Sub-Assembly / Component)</option>
                  <option value="2">Level 2 (Raw Material / Tooling)</option>
                </select>
              </div>

              {/* Past-Due Toggle */}
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800 transition">
                <input
                  type="checkbox"
                  checked={pastDueOnlyFilter}
                  onChange={(e) => setPastDueOnlyFilter(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                <span className={pastDueOnlyFilter ? 'text-red-600 font-semibold' : 'text-slate-600 dark:text-zinc-400'}>
                  Past-Due Expeditations Only
                </span>
              </label>
            </div>

            {/* Search Box */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search order #, item, remarks..."
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Batch Action Bar if any items selected */}
          {selectedOrderIds.length > 0 && (
            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold">
                  {selectedOrderIds.length}
                </span>
                <div className="text-xs">
                  <span className="font-semibold text-indigo-900 dark:text-indigo-200">
                    {selectedOrderIds.length} BUY Order(s) Selected
                  </span>
                  <span className="text-slate-500 dark:text-zinc-400 ml-2">
                    Total Estimated Spend: ₹{selectedBuyTotalSpend.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedOrderIds([])}
                  className="px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Clear Selection
                </button>
                <PermissionGate screen="MFG_MRP" action="CONVERT">
                  <button
                    onClick={handleOpenConvertModal}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    Convert to Purchase Requisition
                  </button>
                </PermissionGate>
              </div>
            </div>
          )}

          {/* Planned Orders Table */}
          <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-600 dark:text-zinc-400 font-semibold border-b border-slate-200 dark:border-zinc-800">
                  <tr>
                    <th className="p-3 w-10 text-center">
                      <input
                        type="checkbox"
                        checked={
                          plannedOrders.filter((o) => o.order_type === 'BUY' && o.status !== 'CONVERTED_TO_PR').length > 0 &&
                          selectedOrderIds.length ===
                            plannedOrders.filter((o) => o.order_type === 'BUY' && o.status !== 'CONVERTED_TO_PR').length
                        }
                        onChange={handleSelectAllBuyOrders}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                        title="Select All Eligible BUY Orders"
                      />
                    </th>
                    <th className="p-3 font-semibold">Order / Run No</th>
                    <th className="p-3 font-semibold">Level</th>
                    <th className="p-3 font-semibold">Item & Type</th>
                    <th className="p-3 font-semibold">Action Type</th>
                    <th className="p-3 font-semibold text-right">Gross Req</th>
                    <th className="p-3 font-semibold text-right">On-Hand</th>
                    <th className="p-3 font-semibold text-right">Sched PO</th>
                    <th className="p-3 font-semibold text-right">Safety</th>
                    <th className="p-3 font-semibold text-right">Planned Qty</th>
                    <th className="p-3 font-semibold">Lead Time</th>
                    <th className="p-3 font-semibold">Release Date</th>
                    <th className="p-3 font-semibold">Required Date</th>
                    <th className="p-3 font-semibold text-right">Est. Spend (₹)</th>
                    <th className="p-3 font-semibold text-center">Status</th>
                    <th className="p-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                  {plannedOrders.length === 0 ? (
                    <tr>
                      <td colSpan={16} className="p-8 text-center text-slate-400 dark:text-zinc-500">
                        {isOrdersLoading ? 'Calculating material requirements...' : 'No planned orders found matching current criteria.'}
                      </td>
                    </tr>
                  ) : (
                    plannedOrders.map((order) => {
                      const typeBadge = ORDER_TYPE_MAP[order.order_type];
                      const statusBadge = STATUS_BADGE_MAP[order.status] || STATUS_BADGE_MAP.SUGGESTED;
                      const isPastDue = order.is_past_due;
                      const isSelected = selectedOrderIds.includes(order.planned_order_id);
                      const isConvertible = order.order_type === 'BUY' && order.status !== 'CONVERTED_TO_PR';

                      return (
                        <tr
                          key={order.planned_order_id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition ${
                            isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                          } ${isPastDue ? 'bg-red-50/30 dark:bg-red-950/10' : ''}`}
                        >
                          <td className="p-3 text-center">
                            {isConvertible ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleOrderSelection(order.planned_order_id)}
                                className="rounded text-indigo-600 focus:ring-indigo-500"
                              />
                            ) : order.status === 'CONVERTED_TO_PR' ? (
                              <span title="Already converted to PR">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
                              </span>
                            ) : (
                              <span className="text-slate-300 dark:text-zinc-700">•</span>
                            )}
                          </td>

                          {/* Planned Order No */}
                          <td className="p-3">
                            <div className="font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-1.5">
                              {order.planned_order_no}
                              {order.parent_planned_order_no && (
                                <span
                                  className="text-[10px] px-1 py-0.2 rounded bg-slate-100 dark:bg-zinc-800 text-slate-500"
                                  title={`Parent: ${order.parent_planned_order_no}`}
                                >
                                  ↳ {order.parent_planned_order_no}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                              {order.mrp_run_no}
                            </div>
                          </td>

                          {/* BOM Level */}
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                                order.bom_level === 0
                                  ? 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20'
                                  : order.bom_level === 1
                                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20'
                                    : 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20'
                              }`}
                            >
                              L{order.bom_level}
                            </span>
                          </td>

                          {/* Item & Type */}
                          <td className="p-3 max-w-[220px]">
                            <div className="font-medium text-slate-900 dark:text-zinc-100 truncate" title={order.item_name}>
                              {order.item_name}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-zinc-500 font-mono">
                              {order.item_code}
                            </div>
                          </td>

                          {/* Action Type */}
                          <td className="p-3">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${typeBadge.bg} ${typeBadge.text}`}
                            >
                              <typeBadge.icon className="w-3 h-3" />
                              {order.order_type}
                            </span>
                          </td>

                          {/* Gross Req */}
                          <td className="p-3 text-right font-mono text-slate-600 dark:text-zinc-400">
                            {Number(order.gross_requirement_qty).toFixed(2)}
                          </td>

                          {/* On-Hand */}
                          <td className="p-3 text-right font-mono text-slate-600 dark:text-zinc-400">
                            {Number(order.on_hand_stock_qty).toFixed(2)}
                          </td>

                          {/* Sched PO */}
                          <td className="p-3 text-right font-mono text-slate-600 dark:text-zinc-400">
                            {Number(order.scheduled_receipts_qty).toFixed(2)}
                          </td>

                          {/* Safety Stock */}
                          <td className="p-3 text-right font-mono text-slate-600 dark:text-zinc-400">
                            {Number(order.safety_stock_qty).toFixed(2)}
                          </td>

                          {/* Planned Order Qty */}
                          <td className="p-3 text-right">
                            <span className="font-bold font-mono text-slate-900 dark:text-zinc-100">
                              {Number(order.planned_order_qty).toFixed(2)}
                            </span>{' '}
                            <span className="text-[10px] text-slate-400">{order.uom_code}</span>
                          </td>

                          {/* Lead Time */}
                          <td className="p-3 font-mono text-slate-600 dark:text-zinc-400">
                            {order.lead_time_days} days
                          </td>

                          {/* Release Date */}
                          <td className="p-3">
                            <div className="flex items-center gap-1.5 font-mono">
                              <span>{order.order_release_date}</span>
                              {isPastDue && (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-500/10 text-red-600 border border-red-500/20">
                                  PAST DUE
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Required Date */}
                          <td className="p-3 font-mono text-slate-600 dark:text-zinc-400">
                            {order.required_by_date}
                          </td>

                          {/* Estimated Spend */}
                          <td className="p-3 text-right font-mono font-medium text-slate-900 dark:text-zinc-100">
                            ₹{Number(order.estimated_total_cost).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </td>

                          {/* Status */}
                          <td className="p-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusBadge.bg} ${statusBadge.text}`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${statusBadge.dot}`} />
                              {order.status}
                            </span>
                            {order.converted_pr_no && (
                              <div className="text-[10px] text-emerald-600 font-mono mt-0.5">
                                PR: {order.converted_pr_no}
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setViewingOrder(order)}
                                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-500 hover:text-slate-900 dark:hover:text-zinc-100"
                                title="View Order Calculation Breakdown"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {order.order_type === 'BUY' && order.status !== 'CONVERTED_TO_PR' && (
                                <PermissionGate screen="MFG_MRP" action="CONVERT">
                                  <button
                                    onClick={() => {
                                      setSelectedOrderIds([order.planned_order_id]);
                                      handleOpenConvertModal();
                                    }}
                                    className="p-1 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-emerald-600"
                                    title="Convert this item to PR"
                                  >
                                    <ShoppingCart className="w-3.5 h-3.5" />
                                  </button>
                                </PermissionGate>
                              )}

                              {order.status === 'SUGGESTED' && (
                                <PermissionGate screen="MFG_MRP" action="RUN_MRP">
                                  <button
                                    onClick={() =>
                                      statusMutation.mutate({
                                        id: order.planned_order_id,
                                        status: 'CONFIRMED',
                                      })
                                    }
                                    className="p-1 rounded hover:bg-blue-50 dark:hover:bg-blue-950/50 text-blue-600"
                                    title="Confirm Order"
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>
                                </PermissionGate>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB 2: MRP EXECUTION RUNS HISTORY */}
      {activeTab === 'RUNS' && (
        <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-zinc-800/60 text-slate-600 dark:text-zinc-400 font-semibold border-b border-slate-200 dark:border-zinc-800">
                <tr>
                  <th className="p-3 font-semibold">MRP Run No</th>
                  <th className="p-3 font-semibold">Run Timestamp</th>
                  <th className="p-3 font-semibold">Horizon</th>
                  <th className="p-3 font-semibold">Demand Source</th>
                  <th className="p-3 font-semibold text-right">Items Analyzed</th>
                  <th className="p-3 font-semibold text-right">Orders Generated</th>
                  <th className="p-3 font-semibold text-right">Planned BUY (₹)</th>
                  <th className="p-3 font-semibold">Execution Time</th>
                  <th className="p-3 font-semibold">Triggered By</th>
                  <th className="p-3 font-semibold text-center">Status</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
                {runsList.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8 text-center text-slate-400 dark:text-zinc-500">
                      No MRP runs recorded yet. Click "Execute MRP Run" to run calculation.
                    </td>
                  </tr>
                ) : (
                  runsList.map((run) => (
                    <tr
                      key={run.mrp_run_id}
                      className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition"
                    >
                      <td className="p-3 font-bold font-mono text-indigo-600 dark:text-indigo-400">
                        {run.mrp_run_no}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-zinc-400 font-mono">
                        {new Date(run.run_date).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 font-medium text-slate-900 dark:text-zinc-100">
                        {run.planning_horizon_days} Days
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                          {run.demand_source}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-medium">{run.total_items_analyzed}</td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-zinc-100">
                        {run.total_planned_orders}
                      </td>
                      <td className="p-3 text-right font-mono font-medium text-purple-700 dark:text-purple-300">
                        ₹{Number(run.total_estimated_spend).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 font-mono text-slate-500">{run.execution_time_ms} ms</td>
                      <td className="p-3 text-slate-600 dark:text-zinc-300">{run.run_by_name || 'System Admin'}</td>
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                          {run.status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedRunId(run.mrp_run_id);
                              setActiveTab('ORDERS');
                            }}
                            className="px-2 py-1 text-xs rounded bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 font-medium transition"
                          >
                            View Orders
                          </button>
                          <PermissionGate screen="MFG_MRP" action="RUN_MRP">
                            <button
                              onClick={() => {
                                setDeleteRunTarget(run);
                                setDeleteErrorMessage(null);
                                setIsDeleteModalOpen(true);
                              }}
                              className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50"
                              title="Delete MRP Run"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </PermissionGate>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. TAB 3: MULTI-LEVEL BOM HIERARCHY TREE */}
      {activeTab === 'TREE' && (
        <div className="p-6 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Workflow className="w-5 h-5 text-indigo-600" />
                Multi-Level Exploded Assembly Structure
              </h3>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                Visual relationship mapping showing Level 0 Finished Goods leading to Level 1 Sub-Assemblies and Level 2 Purchased Components
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-blue-500" /> MAKE
              </span>
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 rounded bg-purple-500" /> BUY
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Level 0 Orders */}
            {plannedOrders
              .filter((o) => o.bom_level === 0)
              .map((parentOrder) => {
                const childOrders = plannedOrders.filter(
                  (c) => c.parent_planned_order_id === parentOrder.planned_order_id,
                );

                return (
                  <div
                    key={parentOrder.planned_order_id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-800/30 space-y-3"
                  >
                    {/* Parent Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-zinc-700/60 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-0.5 rounded bg-sky-500 text-white font-bold text-[10px]">
                          LEVEL 0
                        </span>
                        <div>
                          <span className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                            {parentOrder.item_name}
                          </span>
                          <span className="ml-2 text-xs font-mono text-slate-500">
                            ({parentOrder.item_code})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs">
                        <span className="px-2.5 py-0.5 rounded-full font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20">
                          MAKE: {Number(parentOrder.planned_order_qty).toFixed(1)} {parentOrder.uom_code}
                        </span>
                        <span className="font-mono text-slate-600 dark:text-zinc-400">
                          Release: {parentOrder.order_release_date}
                        </span>
                        <span className="font-mono text-slate-600 dark:text-zinc-400">
                          Due: {parentOrder.required_by_date}
                        </span>
                      </div>
                    </div>

                    {/* Child Components */}
                    <div className="pl-6 space-y-2 border-l-2 border-indigo-500/30 ml-4">
                      {childOrders.length === 0 ? (
                        <div className="text-xs text-slate-400 italic">
                          No direct child component orders required (or fulfilled from stock).
                        </div>
                      ) : (
                        childOrders.map((child) => {
                          const subChildren = plannedOrders.filter(
                            (sc) => sc.parent_planned_order_id === child.planned_order_id,
                          );

                          return (
                            <div key={child.planned_order_id} className="space-y-2">
                              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-zinc-700/80 bg-white dark:bg-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                      child.order_type === 'MAKE'
                                        ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300'
                                        : 'bg-purple-500/20 text-purple-700 dark:text-purple-300'
                                    }`}
                                  >
                                    L{child.bom_level} • {child.order_type}
                                  </span>
                                  <span className="font-semibold text-xs text-slate-800 dark:text-zinc-200">
                                    {child.item_name}
                                  </span>
                                  <span className="text-[11px] font-mono text-slate-400">
                                    ({child.item_code})
                                  </span>
                                </div>

                                <div className="flex items-center gap-3 text-xs">
                                  <span className="font-mono font-medium">
                                    Qty: {Number(child.planned_order_qty).toFixed(2)} {child.uom_code}
                                  </span>
                                  <span className="font-mono text-slate-500">
                                    LT: {child.lead_time_days}d
                                  </span>
                                  <span className="font-mono text-slate-500">
                                    Rel: {child.order_release_date}
                                  </span>
                                  <span className="font-mono font-semibold text-slate-900 dark:text-zinc-100">
                                    ₹{Number(child.estimated_total_cost).toLocaleString('en-IN')}
                                  </span>
                                </div>
                              </div>

                              {/* Level 2 Sub-Children */}
                              {subChildren.length > 0 && (
                                <div className="pl-6 space-y-1.5 border-l-2 border-purple-500/30 ml-4">
                                  {subChildren.map((sub) => (
                                    <div
                                      key={sub.planned_order_id}
                                      className="p-2 rounded-lg border border-slate-200/60 dark:border-zinc-700/50 bg-white/70 dark:bg-zinc-900/60 flex items-center justify-between text-xs"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300">
                                          L2 • {sub.order_type}
                                        </span>
                                        <span className="font-medium text-slate-700 dark:text-zinc-300">
                                          {sub.item_name}
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-400">
                                          ({sub.item_code})
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-3 font-mono text-[11px]">
                                        <span>
                                          Qty: {Number(sub.planned_order_qty).toFixed(2)} {sub.uom_code}
                                        </span>
                                        <span className="text-slate-500">LT: {sub.lead_time_days}d</span>
                                        <span className={sub.is_past_due ? 'text-red-500 font-bold' : 'text-slate-500'}>
                                          Rel: {sub.order_release_date}
                                        </span>
                                        <span className="font-semibold text-purple-600 dark:text-purple-400">
                                          ₹{Number(sub.estimated_total_cost).toLocaleString('en-IN')}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 7. EXECUTE MRP RUN MODAL */}
      {isRunMrpModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-indigo-500/5 to-transparent">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Play className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-zinc-100">
                    Execute MRP-I Calculation Engine
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Calculates gross-to-net material deficits, BOM explosions and backward scheduling
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRunMrpModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              {/* Planning Horizon */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Planning Horizon (Days)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 30, 60, 90].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setRunForm({ ...runForm, planningHorizonDays: days })}
                      className={`py-2 text-xs font-semibold rounded-lg border transition ${
                        runForm.planningHorizonDays === days
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-500'
                          : 'border-slate-300 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {days} Days
                    </button>
                  ))}
                </div>
              </div>

              {/* Demand Source */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  Demand Identification Source
                </label>
                <select
                  value={runForm.demandSource}
                  onChange={(e) => setRunForm({ ...runForm, demandSource: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                >
                  <option value="BUFFER_DEFICIT">
                    BUFFER_DEFICIT — Buffer Stock & Reorder Point Deficits
                  </option>
                  <option value="ALL">
                    ALL — Buffer Deficits + Open Sales Orders + Manual Forecasts
                  </option>
                </select>
              </div>

              {/* Include Safety Stock */}
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 cursor-pointer">
                <input
                  type="checkbox"
                  checked={runForm.includeSafetyStock}
                  onChange={(e) => setRunForm({ ...runForm, includeSafetyStock: e.target.checked })}
                  className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                />
                <div>
                  <span className="font-semibold text-slate-800 dark:text-zinc-200 block">
                    Include Safety Stock Deficit Protection
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                    Ensures planned net requirements replenish warehouse inventory back to safety stock levels.
                  </span>
                </div>
              </label>

              {/* Remarks */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Run Notes / Justification
                </label>
                <textarea
                  rows={2}
                  value={runForm.remarks}
                  onChange={(e) => setRunForm({ ...runForm, remarks: e.target.value })}
                  placeholder="e.g. Monthly buffer stock replenishment run for Plant 1"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-xs"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsRunMrpModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => runMrpMutation.mutate(runForm)}
                disabled={runMrpMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20 transition disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                {runMrpMutation.isPending ? 'Executing Engine...' : 'Run MRP Engine'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. CONVERT TO PURCHASE REQUISITION MODAL */}
      {isConvertPrModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/5 to-transparent">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-zinc-100">
                    1-Click Convert to Purchase Requisition (PR)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    Generates official procurement document from {selectedBuyOrders.length} planned order items
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsConvertPrModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Selected Items Summary */}
              <div className="rounded-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
                <div className="bg-slate-50 dark:bg-zinc-800/60 px-3 py-2 font-semibold border-b border-slate-200 dark:border-zinc-800 flex justify-between">
                  <span>Selected Line Items ({selectedBuyOrders.length})</span>
                  <span className="font-mono text-purple-600 dark:text-purple-400">
                    Total: ₹{selectedBuyTotalSpend.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="max-h-36 overflow-y-auto divide-y divide-slate-200 dark:divide-zinc-800">
                  {selectedBuyOrders.map((o) => (
                    <div key={o.planned_order_id} className="p-2.5 flex items-center justify-between">
                      <div>
                        <div className="font-medium text-slate-900 dark:text-zinc-100">{o.item_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {o.planned_order_no} • {o.item_code}
                        </div>
                      </div>
                      <div className="text-right font-mono">
                        <div>
                          {Number(o.planned_order_qty).toFixed(2)} {o.uom_code}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          ₹{Number(o.estimated_total_cost).toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Warehouse & Department */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Delivery Warehouse
                  </label>
                  <select
                    value={prForm.warehouseId}
                    onChange={(e) => setPrForm({ ...prForm, warehouseId: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                  >
                    {lookups?.warehouses.map((wh) => (
                      <option key={wh.warehouse_id} value={wh.warehouse_id}>
                        {wh.warehouse_name} ({wh.warehouse_code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Requesting Department
                  </label>
                  <select
                    value={prForm.departmentId}
                    onChange={(e) => setPrForm({ ...prForm, departmentId: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                  >
                    {lookups?.departments.map((dept) => (
                      <option key={dept.dept_id} value={dept.dept_id}>
                        {dept.dept_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Priority & Required Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Requisition Priority
                  </label>
                  <select
                    value={prForm.priority}
                    onChange={(e) => setPrForm({ ...prForm, priority: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH (Expedited)</option>
                    <option value="CRITICAL_URGENT">CRITICAL_URGENT</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                    Required Delivery Date
                  </label>
                  <input
                    type="date"
                    value={prForm.requiredByDate}
                    onChange={(e) => setPrForm({ ...prForm, requiredByDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label className="block font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                  Requisition Purpose
                </label>
                <textarea
                  rows={2}
                  value={prForm.purpose}
                  onChange={(e) => setPrForm({ ...prForm, purpose: e.target.value })}
                  placeholder="Purpose of requisition..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-200 dark:border-zinc-800 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsConvertPrModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  convertPrMutation.mutate({
                    plannedOrderIds: selectedOrderIds,
                    warehouseId: prForm.warehouseId,
                    departmentId: prForm.departmentId,
                    requiredByDate: prForm.requiredByDate,
                    priority: prForm.priority,
                    purpose: prForm.purpose,
                  })
                }
                disabled={convertPrMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/20 transition disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                {convertPrMutation.isPending ? 'Generating PR...' : 'Create Purchase Requisition'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. VIEW ORDER DETAILS DRAWER */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between bg-slate-50 dark:bg-zinc-800/50">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-indigo-600" />
                  Planned Order {viewingOrder.planned_order_no}
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400">
                  Run: {viewingOrder.mrp_run_no} • Level {viewingOrder.bom_level}
                </p>
              </div>
              <button
                onClick={() => setViewingOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800/40 border border-slate-200 dark:border-zinc-700/60">
                <div className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                  {viewingOrder.item_name}
                </div>
                <div className="text-xs font-mono text-slate-500">
                  {viewingOrder.item_code} • {viewingOrder.item_type}
                </div>
              </div>

              {/* Gross to Net Calculation Formula */}
              <div className="space-y-2">
                <div className="font-semibold text-slate-700 dark:text-zinc-300">
                  Gross-to-Net Balance Equation:
                </div>
                <div className="p-3 rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 font-mono text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Gross Requirement:</span>
                    <span>{Number(viewingOrder.gross_requirement_qty).toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600">
                    <span>(-) On-Hand Warehouse Stock:</span>
                    <span>{Number(viewingOrder.on_hand_stock_qty).toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between text-blue-600">
                    <span>(-) Scheduled Purchase Receipts:</span>
                    <span>{Number(viewingOrder.scheduled_receipts_qty).toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between text-amber-600">
                    <span>(+) Safety Stock Buffer:</span>
                    <span>{Number(viewingOrder.safety_stock_qty).toFixed(3)}</span>
                  </div>
                  <div className="border-t border-slate-200 dark:border-zinc-800 pt-1 flex justify-between font-bold text-indigo-600 dark:text-indigo-400">
                    <span>(=) Net Requirement / Planned Qty:</span>
                    <span>
                      {Number(viewingOrder.planned_order_qty).toFixed(3)} {viewingOrder.uom_code}
                    </span>
                  </div>
                </div>
              </div>

              {/* Scheduling Timeline */}
              <div className="space-y-2">
                <div className="font-semibold text-slate-700 dark:text-zinc-300">
                  Lead Time & Backward Schedule:
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40">
                    <span className="text-[10px] text-slate-500 block">Release Date (Order Launch)</span>
                    <span className="font-bold text-slate-900 dark:text-zinc-100">
                      {viewingOrder.order_release_date}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40">
                    <span className="text-[10px] text-slate-500 block">Required Date (Plant Receipt)</span>
                    <span className="font-bold text-slate-900 dark:text-zinc-100">
                      {viewingOrder.required_by_date}
                    </span>
                  </div>
                </div>
              </div>

              {/* Remarks */}
              {viewingOrder.remarks && (
                <div>
                  <span className="text-slate-500 font-medium block">Calculation Notes:</span>
                  <p className="text-slate-700 dark:text-zinc-300 mt-0.5">{viewingOrder.remarks}</p>
                </div>
              )}
            </div>

            <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 border-t border-slate-200 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setViewingOrder(null)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10. PRINTABLE SCHEDULE MODAL */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white text-slate-900 shadow-2xl overflow-y-auto p-8 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h2 className="text-xl font-bold">KASHVIRA MANUFACTURING ERP</h2>
                <h3 className="text-sm font-semibold text-slate-600">
                  MRP-I Gross-to-Net Planning & Procurement Schedule
                </h3>
              </div>
              <div className="text-right text-xs">
                <div>Printed: {new Date().toLocaleString('en-IN')}</div>
                <div>Status: Released Planning Orders</div>
              </div>
            </div>

            <table className="w-full text-xs text-left border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300">
                  <th className="p-2 border border-slate-300">Order #</th>
                  <th className="p-2 border border-slate-300">Lvl</th>
                  <th className="p-2 border border-slate-300">Item Description</th>
                  <th className="p-2 border border-slate-300">Action</th>
                  <th className="p-2 border border-slate-300 text-right">Planned Qty</th>
                  <th className="p-2 border border-slate-300">Release Date</th>
                  <th className="p-2 border border-slate-300">Required Date</th>
                  <th className="p-2 border border-slate-300 text-right">Est. Spend (₹)</th>
                </tr>
              </thead>
              <tbody>
                {plannedOrders.map((o) => (
                  <tr key={o.planned_order_id} className="border-b border-slate-200">
                    <td className="p-2 border border-slate-200 font-mono font-bold">{o.planned_order_no}</td>
                    <td className="p-2 border border-slate-200 text-center font-bold">L{o.bom_level}</td>
                    <td className="p-2 border border-slate-200">
                      <div className="font-medium">{o.item_name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{o.item_code}</div>
                    </td>
                    <td className="p-2 border border-slate-200 font-semibold">{o.order_type}</td>
                    <td className="p-2 border border-slate-200 text-right font-mono font-bold">
                      {Number(o.planned_order_qty).toFixed(2)} {o.uom_code}
                    </td>
                    <td className="p-2 border border-slate-200 font-mono">{o.order_release_date}</td>
                    <td className="p-2 border border-slate-200 font-mono">{o.required_by_date}</td>
                    <td className="p-2 border border-slate-200 text-right font-mono">
                      ₹{Number(o.estimated_total_cost).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex items-center justify-between pt-4 border-t text-xs">
              <div>Total Orders: {plannedOrders.length}</div>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="px-4 py-2 rounded-lg border text-xs font-semibold"
                >
                  Close
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold"
                >
                  Trigger Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 11. CONFIRM DELETE RUN MODAL */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        entityType="MRP Calculation Run"
        entityName={deleteRunTarget?.mrp_run_no || ''}
        entityCode={deleteRunTarget?.mrp_run_no || ''}
        isDeleting={deleteRunMutation.isPending}
        errorMessage={deleteErrorMessage}
        dependencies={[]}
        onConfirm={() => {
          if (deleteRunTarget) {
            deleteRunMutation.mutate(deleteRunTarget.mrp_run_id);
          }
        }}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteRunTarget(null);
        }}
      />
    </div>
  );
};
