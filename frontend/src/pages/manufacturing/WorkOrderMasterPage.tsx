import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Calendar,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Cpu,
  Download,
  Eye,
  Factory,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  Layers,
  Package,
  Pencil,
  Play,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  Workflow,
  Wrench,
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

// ============================================================================
// TYPES & ENUMS
// ============================================================================

export type WorkOrderStatus =
  | 'DRAFT'
  | 'RELEASED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CLOSED'
  | 'CANCELLED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL_URGENT';

export interface WorkOrderSummary {
  totalWorkOrders: number;
  activeJobs: number;
  completedQtyTotal: number;
  overdueCount: number;
  totalEstimatedCost: number;
}

export interface WorkOrderRow {
  wo_id: number;
  wo_no: string;
  wo_date: string;
  item_id: number;
  item_code: string;
  item_name: string;
  item_type: string;
  bom_id: number | null;
  bom_code: string | null;
  bom_version: string | null;
  routing_id: number | null;
  routing_code: string | null;
  routing_version: string | null;
  target_warehouse_id: number;
  target_warehouse_name: string;
  wip_warehouse_id: number | null;
  wip_warehouse_name: string | null;
  planned_qty: number;
  completed_qty: number;
  scrapped_qty: number;
  uom_id: number;
  uom_code: string;
  uom_name: string;
  scheduled_start_date: string;
  scheduled_end_date: string;
  actual_start_date: string | null;
  actual_end_date: string | null;
  priority: Priority;
  status: WorkOrderStatus;
  mrp_planned_order_id: number | null;
  mrp_planned_order_no: string | null;
  batch_no: string | null;
  estimated_material_cost: number;
  estimated_operation_cost: number;
  estimated_total_cost: number;
  actual_material_cost: number;
  actual_operation_cost: number;
  actual_total_cost: number;
  released_by: number | null;
  released_by_name: string | null;
  released_date: string | null;
  remarks: string | null;
  is_overdue: boolean;
  bom_item_count: number;
  routing_op_count: number;
}

export interface WoBomItem {
  wo_bom_item_id: number;
  wo_id: number;
  item_id: number;
  item_code: string;
  item_name: string;
  item_type?: string;
  item_description?: string;
  uom_id: number;
  uom_code: string;
  standard_qty_per_unit: number;
  scrap_factor_percent: number;
  required_qty: number;
  issued_qty: number;
  consumed_qty: number;
  unit_cost: number;
  estimated_cost: number;
  actual_cost: number;
  source_type: 'PURCHASED' | 'MANUFACTURED' | 'SUBCONTRACT';
  operation_seq: number | null;
  is_critical: boolean;
  remarks: string | null;
}

export interface WoRoutingOp {
  wo_routing_op_id: number;
  wo_id: number;
  op_sequence: number;
  op_code: string;
  op_name: string;
  work_center_id: number;
  work_center_code: string;
  work_center_name: string;
  machine_id: number | null;
  machine_code: string | null;
  machine_name: string | null;
  planned_setup_time_mins: number;
  planned_run_time_mins: number;
  actual_setup_time_mins: number;
  actual_run_time_mins: number;
  planned_cost: number;
  actual_cost: number;
  planned_qty: number;
  completed_qty: number;
  scrapped_qty: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  scheduled_start_date: string | null;
  scheduled_end_date: string | null;
  is_inspection_required: boolean;
  is_subcontracted: boolean;
  subcontract_vendor_id: number | null;
  subcontract_vendor_name: string | null;
  remarks: string | null;
}

export interface WorkOrderDetail extends WorkOrderRow {
  bomItems: WoBomItem[];
  routingOps: WoRoutingOp[];
  created_by_name?: string;
  created_date?: string;
  updated_by_name?: string;
  updated_date?: string;
}

export interface LookupsResponse {
  items: Array<{
    item_id: number;
    item_code: string;
    item_name: string;
    item_type: string;
    base_uom_id: number;
    uom_code: string;
    uom_name: string;
    standard_cost: number;
    lead_time_days: number;
    default_warehouse_id: number;
  }>;
  boms: Array<{
    bom_id: number;
    bom_code: string;
    bom_name: string;
    item_id: number;
    version_no: string;
    batch_size: number;
    is_default: boolean;
    routing_id: number | null;
  }>;
  routings: Array<{
    routing_id: number;
    routing_code: string;
    routing_name: string;
    item_id: number;
    version_no: string;
    batch_size: number;
    total_cost_per_unit: number;
    is_default: boolean;
  }>;
  warehouses: Array<{
    warehouse_id: number;
    warehouse_code: string;
    warehouse_name: string;
    warehouse_type: string;
  }>;
  openMrpMakeOrders: Array<{
    planned_order_id: number;
    planned_order_no: string;
    item_id: number;
    item_code: string;
    item_name: string;
    bom_id: number | null;
    routing_id: number | null;
    planned_order_qty: number;
    uom_id: number;
    uom_code: string;
    required_by_date: string;
    order_release_date: string;
    status: string;
  }>;
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export const WorkOrderMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters & Pagination State
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState<number | ''>('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<(string | number)[]>([]);

  // Modals & Drawers
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingWoId, setEditingWoId] = useState<number | null>(null);
  const [detailsWoId, setDetailsWoId] = useState<number | null>(null);
  const [releaseWoId, setReleaseWoId] = useState<number | null>(null);
  const [closeWoId, setCloseWoId] = useState<number | null>(null);
  const [printWoId, setPrintWoId] = useState<number | null>(null);
  const [isConvertMrpOpen, setIsConvertMrpOpen] = useState(false);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<WorkOrderRow | null>(null);
  const [deleteConflicts, setDeleteConflicts] = useState<DependencyConflictItem[]>([]);

  // ============================================================================
  // QUERIES
  // ============================================================================

  // 1. KPI Summary
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery<WorkOrderSummary>({
    queryKey: ['manufacturing', 'work-orders', 'summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<WorkOrderSummary>>(
        '/manufacturing/work-orders/summary',
      );
      return res.data.data;
    },
  });

  // 2. Lookups
  const { data: lookups } = useQuery<LookupsResponse>({
    queryKey: ['manufacturing', 'work-orders', 'lookups'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<LookupsResponse>>(
        '/manufacturing/work-orders/lookups',
      );
      return res.data.data;
    },
  });

  // 3. Work Order List
  const {
    data: listData,
    isLoading: isListLoading,
    refetch: refetchList,
  } = useQuery<{ data: WorkOrderRow[]; total: number }>({
    queryKey: [
      'manufacturing',
      'work-orders',
      'list',
      page,
      pageSize,
      search,
      statusFilter,
      priorityFilter,
      warehouseFilter,
      overdueOnly,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(pageSize));
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);
      if (priorityFilter) params.append('priority', priorityFilter);
      if (warehouseFilter) params.append('targetWarehouseId', String(warehouseFilter));
      if (overdueOnly) params.append('isOverdue', 'true');

      const res = await apiClient.get<ApiResponse<{ data: WorkOrderRow[]; total: number }>>(
        `/manufacturing/work-orders?${params.toString()}`,
      );
      return res.data.data;
    },
  });

  // 4. Detail Query
  const { data: activeDetail, isLoading: isDetailLoading } = useQuery<WorkOrderDetail>({
    queryKey: ['manufacturing', 'work-orders', 'detail', detailsWoId],
    queryFn: async () => {
      if (!detailsWoId) throw new Error('No WO ID');
      const res = await apiClient.get<ApiResponse<WorkOrderDetail>>(
        `/manufacturing/work-orders/${detailsWoId}`,
      );
      return res.data.data;
    },
    enabled: !!detailsWoId,
  });

  // 5. Print Query
  const { data: printData, isLoading: isPrintLoading } = useQuery<WorkOrderDetail>({
    queryKey: ['manufacturing', 'work-orders', 'print', printWoId],
    queryFn: async () => {
      if (!printWoId) throw new Error('No WO ID');
      const res = await apiClient.get<ApiResponse<WorkOrderDetail>>(
        `/manufacturing/work-orders/${printWoId}`,
      );
      return res.data.data;
    },
    enabled: !!printWoId,
  });

  // ============================================================================
  // MUTATIONS
  // ============================================================================

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/manufacturing/work-orders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturing', 'work-orders'] });
      setDeleteTarget(null);
    },
  });

  const releaseMutation = useMutation({
    mutationFn: async ({ id, remarks }: { id: number; remarks?: string }) => {
      await apiClient.post(`/manufacturing/work-orders/${id}/release`, {
        releaseRemarks: remarks,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturing', 'work-orders'] });
      setReleaseWoId(null);
      if (detailsWoId) {
        queryClient.invalidateQueries({
          queryKey: ['manufacturing', 'work-orders', 'detail', detailsWoId],
        });
      }
    },
  });

  const closeMutation = useMutation({
    mutationFn: async ({
      id,
      completedQty,
      scrappedQty,
      remarks,
    }: {
      id: number;
      completedQty: number;
      scrappedQty: number;
      remarks?: string;
    }) => {
      await apiClient.post(`/manufacturing/work-orders/${id}/close`, {
        completedQty,
        scrappedQty,
        closeRemarks: remarks,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturing', 'work-orders'] });
      setCloseWoId(null);
      if (detailsWoId) {
        queryClient.invalidateQueries({
          queryKey: ['manufacturing', 'work-orders', 'detail', detailsWoId],
        });
      }
    },
  });

  const convertMrpMutation = useMutation({
    mutationFn: async (payload: {
      plannedOrderId: number;
      targetWarehouseId?: number;
      wipWarehouseId?: number;
      scheduledStartDate?: string;
      scheduledEndDate?: string;
      priority?: Priority;
      batchNo?: string;
      remarks?: string;
    }) => {
      const res = await apiClient.post<ApiResponse<WorkOrderRow>>(
        '/manufacturing/work-orders/convert-mrp',
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturing', 'work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['manufacturing', 'mrp'] });
      setIsConvertMrpOpen(false);
    },
  });

  // ============================================================================
  // STATUS / PRIORITY FORMATTERS
  // ============================================================================

  const renderStatusBadge = (status: WorkOrderStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
            <Clock className="w-3 h-3 text-gray-500" /> Draft
          </span>
        );
      case 'RELEASED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <Play className="w-3 h-3 text-blue-600 dark:text-blue-400" /> Released
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse">
            <Factory className="w-3 h-3 text-amber-600 dark:text-amber-400" /> In Progress
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Completed
          </span>
        );
      case 'CLOSED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700">
            <CheckCheck className="w-3 h-3 text-slate-600 dark:text-slate-400" /> Closed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <X className="w-3 h-3 text-rose-600 dark:text-rose-400" /> Cancelled
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const renderPriorityBadge = (priority: Priority) => {
    switch (priority) {
      case 'CRITICAL_URGENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <Flame className="w-3 h-3 text-rose-600" /> CRITICAL
          </span>
        );
      case 'HIGH':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
            High
          </span>
        );
      case 'MEDIUM':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            Medium
          </span>
        );
      case 'LOW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-normal bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            Low
          </span>
        );
    }
  };

  // ============================================================================
  // MASTER DATA TABLE COLUMNS
  // ============================================================================

  const columns: MasterTableColumn<WorkOrderRow>[] = useMemo(
    () => [
      {
        key: 'wo_no',
        header: 'Work Order #',
        sortable: true,
        render: (row: WorkOrderRow) => (
          <div className="flex flex-col">
            <button
              type="button"
              onClick={() => setDetailsWoId(row.wo_id)}
              className="font-mono-code font-bold text-sm text-[var(--brand-600)] dark:text-[var(--brand-400)] hover:underline flex items-center gap-1 text-left"
            >
              {row.wo_no}
            </button>
            <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
              <Calendar className="w-3 h-3" /> {row.wo_date}
            </span>
          </div>
        ),
        sortValue: (row: WorkOrderRow) => row.wo_no,
        exportValue: (row: WorkOrderRow) => row.wo_no,
      },
      {
        key: 'item_info',
        header: 'Product Item',
        sortable: true,
        render: (row: WorkOrderRow) => (
          <div className="flex flex-col max-w-[240px]">
            <span className="font-semibold text-sm text-[var(--text-primary)] truncate">
              {row.item_name}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-mono-code">
              <span>{row.item_code}</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {row.item_type}
              </span>
            </div>
          </div>
        ),
        sortValue: (row: WorkOrderRow) => row.item_name,
        exportValue: (row: WorkOrderRow) => `${row.item_code} - ${row.item_name}`,
      },
      {
        key: 'progress',
        header: 'Planned vs Done',
        render: (row: WorkOrderRow) => {
          const pct =
            row.planned_qty > 0
              ? Math.min(100, Math.round((row.completed_qty / row.planned_qty) * 100))
              : 0;
          return (
            <div className="flex flex-col gap-1 w-32">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-[var(--text-primary)]">
                  {row.completed_qty} / {row.planned_qty} {row.uom_code}
                </span>
                <span className="text-[11px] font-bold text-[var(--brand-600)] dark:text-[var(--brand-400)]">
                  {pct}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    pct === 100
                      ? 'bg-emerald-500'
                      : pct > 50
                      ? 'bg-[var(--brand-500)]'
                      : 'bg-amber-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {row.scrapped_qty > 0 && (
                <span className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                  Scrapped: {row.scrapped_qty} {row.uom_code}
                </span>
              )}
            </div>
          );
        },
        sortValue: (row: WorkOrderRow) =>
          row.planned_qty ? row.completed_qty / row.planned_qty : 0,
        exportValue: (row: WorkOrderRow) =>
          `${row.completed_qty} / ${row.planned_qty} ${row.uom_code}`,
      },
      {
        key: 'schedule',
        header: 'Schedule & Dates',
        sortable: true,
        render: (row: WorkOrderRow) => (
          <div className="flex flex-col text-xs">
            <span className="text-[var(--text-muted)]">
              Start:{' '}
              <span className="text-[var(--text-primary)] font-medium">
                {row.scheduled_start_date}
              </span>
            </span>
            <span className="text-[var(--text-muted)] flex items-center gap-1">
              End:{' '}
              <span
                className={`font-medium ${
                  row.is_overdue
                    ? 'text-rose-600 dark:text-rose-400 font-bold'
                    : 'text-[var(--text-primary)]'
                }`}
              >
                {row.scheduled_end_date}
              </span>
              {row.is_overdue && (
                <span className="px-1 py-0.2 rounded text-[10px] bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 font-bold uppercase">
                  Overdue
                </span>
              )}
            </span>
          </div>
        ),
        sortValue: (row: WorkOrderRow) => row.scheduled_end_date,
        exportValue: (row: WorkOrderRow) =>
          `${row.scheduled_start_date} to ${row.scheduled_end_date}`,
      },
      {
        key: 'bom_routing',
        header: 'BOM & Routing',
        render: (row: WorkOrderRow) => (
          <div className="flex flex-col text-xs gap-0.5">
            <span className="inline-flex items-center gap-1 text-[var(--text-primary)]">
              <Layers className="w-3 h-3 text-[var(--brand-500)]" />
              {row.bom_code ? `${row.bom_code} (v${row.bom_version})` : '—'}
            </span>
            <span className="inline-flex items-center gap-1 text-[var(--text-muted)]">
              <Workflow className="w-3 h-3 text-cyan-500" />
              {row.routing_code ? `${row.routing_code} (v${row.routing_version})` : '—'}
            </span>
          </div>
        ),
        exportValue: (row: WorkOrderRow) =>
          `BOM: ${row.bom_code || 'N/A'}, Routing: ${row.routing_code || 'N/A'}`,
      },
      {
        key: 'warehouse',
        header: 'Warehouse',
        sortable: true,
        render: (row: WorkOrderRow) => (
          <div className="text-xs">
            <span className="font-medium text-[var(--text-primary)]">
              {row.target_warehouse_name}
            </span>
            {row.batch_no && (
              <div className="text-[11px] text-[var(--text-muted)]">
                Batch: <span className="font-mono-code">{row.batch_no}</span>
              </div>
            )}
          </div>
        ),
        sortValue: (row: WorkOrderRow) => row.target_warehouse_name,
        exportValue: (row: WorkOrderRow) =>
          `${row.target_warehouse_name}${row.batch_no ? ` (Batch: ${row.batch_no})` : ''}`,
      },
      {
        key: 'priority',
        header: 'Priority',
        sortable: true,
        render: (row: WorkOrderRow) => renderPriorityBadge(row.priority),
        sortValue: (row: WorkOrderRow) => row.priority,
        exportValue: (row: WorkOrderRow) => row.priority,
      },
      {
        key: 'cost',
        header: 'Est. Total Cost',
        align: 'right',
        sortable: true,
        render: (row: WorkOrderRow) => (
          <div className="text-right font-mono-code text-xs font-semibold text-[var(--text-primary)]">
            ₹{row.estimated_total_cost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
          </div>
        ),
        sortValue: (row: WorkOrderRow) => row.estimated_total_cost,
        exportValue: (row: WorkOrderRow) => row.estimated_total_cost,
      },
      {
        key: 'status',
        header: 'Status',
        align: 'center',
        sortable: true,
        render: (row: WorkOrderRow) => renderStatusBadge(row.status),
        sortValue: (row: WorkOrderRow) => row.status,
        exportValue: (row: WorkOrderRow) => row.status,
      },
    ],
    [],
  );

  const groupByOptions: GroupByOption<WorkOrderRow>[] = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        groupValue: (row: WorkOrderRow) => row.status,
      },
      {
        key: 'priority',
        label: 'Priority',
        groupValue: (row: WorkOrderRow) => row.priority,
      },
      {
        key: 'item',
        label: 'Finished Item',
        groupValue: (row: WorkOrderRow) => `${row.item_code} - ${row.item_name}`,
      },
      {
        key: 'warehouse',
        label: 'Target Warehouse',
        groupValue: (row: WorkOrderRow) => row.target_warehouse_name,
      },
    ],
    [],
  );

  const searchPredicate = (row: WorkOrderRow, q: string): boolean => {
    const query = q.toLowerCase();
    return (
      row.wo_no.toLowerCase().includes(query) ||
      row.item_code.toLowerCase().includes(query) ||
      row.item_name.toLowerCase().includes(query) ||
      (row.batch_no || '').toLowerCase().includes(query) ||
      (row.remarks || '').toLowerCase().includes(query)
    );
  };

  // ============================================================================
  // RENDER UI
  // ============================================================================

  return (
    <div className="space-y-6 p-6 max-w-full">
      {/* ---------------------------------------------------------------------- */}
      {/* HEADER SECTION */}
      {/* ---------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Production Work Orders
            </h1>
          </div>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Discrete manufacturing work order execution, BOM frozen snapshots, sequential
            operation routing dispatches, and shopfloor route travelers.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Refresh */}
          <button
            type="button"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['manufacturing', 'work-orders'] });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors shadow-xs"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>

          {/* 1-Click Convert MRP Make Order */}
          <PermissionGate screen="MFG_WORK_ORDER" action="ADD">
            <button
              type="button"
              onClick={() => setIsConvertMrpOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 text-sm font-semibold transition-colors shadow-xs"
            >
              <Sparkles className="w-4 h-4" />
              <span>Convert MRP Make Orders</span>
              {lookups?.openMrpMakeOrders && lookups.openMrpMakeOrders.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-xs bg-cyan-600 text-white font-bold">
                  {lookups.openMrpMakeOrders.length}
                </span>
              )}
            </button>
          </PermissionGate>

          {/* New Work Order Button */}
          <PermissionGate screen="MFG_WORK_ORDER" action="ADD">
            <button
              type="button"
              onClick={() => {
                setEditingWoId(null);
                setIsCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] text-white text-sm font-semibold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create Work Order</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* TOP KPI CARDS */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Work Orders */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Total Work Orders
            </p>
            <p className="text-2xl font-black text-[var(--text-primary)] mt-1">
              {isSummaryLoading ? '...' : summaryData?.totalWorkOrders ?? 0}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">All life-cycle jobs</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Factory className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Active In-Progress */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Active Shopfloor Jobs
            </p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
              {isSummaryLoading ? '...' : summaryData?.activeJobs ?? 0}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Released & In-Progress</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Play className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Total Completed Output */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Total Output Delivered
            </p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {isSummaryLoading ? '...' : summaryData?.completedQtyTotal ?? 0}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Finished good units produced</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Overdue Alert */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Overdue Alerts
            </p>
            <p
              className={`text-2xl font-black mt-1 ${
                (summaryData?.overdueCount ?? 0) > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-[var(--text-primary)]'
              }`}
            >
              {isSummaryLoading ? '...' : summaryData?.overdueCount ?? 0}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Passed scheduled end date</p>
          </div>
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              (summaryData?.overdueCount ?? 0) > 0
                ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 animate-bounce'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* FILTER TOOLBAR */}
      {/* ---------------------------------------------------------------------- */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search WO #, Item code/name, batch, remarks..."
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
          >
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="RELEASED">Released</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="CLOSED">Closed</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
          >
            <option value="">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="CRITICAL_URGENT">Critical / Urgent</option>
          </select>

          {/* Warehouse Filter */}
          <select
            value={warehouseFilter}
            onChange={(e) => {
              setWarehouseFilter(e.target.value ? Number(e.target.value) : '');
              setPage(1);
            }}
            className="px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
          >
            <option value="">All Target Warehouses</option>
            {lookups?.warehouses.map((wh) => (
              <option key={wh.warehouse_id} value={wh.warehouse_id}>
                {wh.warehouse_name} ({wh.warehouse_code})
              </option>
            ))}
          </select>

          {/* Overdue Only Toggle */}
          <label className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] font-medium cursor-pointer select-none bg-[var(--bg-subtle)] px-3 py-2 rounded-xl border border-[var(--border-default)]">
            <input
              type="checkbox"
              checked={overdueOnly}
              onChange={(e) => {
                setOverdueOnly(e.target.checked);
                setPage(1);
              }}
              className="rounded text-[var(--brand-600)] focus:ring-[var(--brand-500)]"
            />
            <span className={overdueOnly ? 'text-rose-600 font-bold' : ''}>
              Overdue Only
            </span>
          </label>

          {/* Reset Filters */}
          {(search || statusFilter || priorityFilter || warehouseFilter || overdueOnly) && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('');
                setPriorityFilter('');
                setWarehouseFilter('');
                setOverdueOnly(false);
                setPage(1);
              }}
              className="text-xs font-semibold text-[var(--brand-600)] hover:underline flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" /> Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* HIGH DENSITY MASTER DATA TABLE */}
      {/* ---------------------------------------------------------------------- */}
      <MasterDataTable<WorkOrderRow>
        title="Production Work Orders"
        subtitle="Discrete manufacturing order execution, frozen BOM snapshotting, and sequential routing release"
        screenCode="MFG_WORK_ORDER"
        tableNameBadge="tbl_mfg_wo_header"
        data={listData?.data || []}
        columns={columns}
        rowKey={(row: WorkOrderRow) => row.wo_id}
        isLoading={isListLoading}
        searchPlaceholder="Search by Work Order #, product item, batch #, or remarks..."
        searchPredicate={searchPredicate}
        groupByOptions={groupByOptions}
        addButtonLabel="New Work Order"
        onAddClick={() => {
          setEditingWoId(null);
          setIsCreateOpen(true);
        }}
        pageSize={pageSize}
        renderRowActions={(row: WorkOrderRow) => (
          <div className="flex items-center justify-end gap-1">
            {/* View Details */}
            <button
              type="button"
              onClick={() => setDetailsWoId(row.wo_id)}
              className="p-1.5 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--brand-600)] transition-colors"
              title="View Work Order Traveler & Details"
            >
              <Eye className="w-4 h-4" />
            </button>

            {/* Print Traveler */}
            <PermissionGate screen="MFG_WORK_ORDER" action="PRINT">
              <button
                type="button"
                onClick={() => setPrintWoId(row.wo_id)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                title="Print Route Traveler / Job Card"
              >
                <Printer className="w-4 h-4" />
              </button>
            </PermissionGate>

            {/* Edit (Draft only) */}
            {row.status === 'DRAFT' && (
              <PermissionGate screen="MFG_WORK_ORDER" action="EDIT">
                <button
                  type="button"
                  onClick={() => {
                    setEditingWoId(row.wo_id);
                    setIsCreateOpen(true);
                  }}
                  className="p-1.5 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-amber-600 transition-colors"
                  title="Edit Work Order"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {/* Release to Shopfloor (Draft only) */}
            {row.status === 'DRAFT' && (
              <PermissionGate screen="MFG_WORK_ORDER" action="RELEASE">
                <button
                  type="button"
                  onClick={() => setReleaseWoId(row.wo_id)}
                  className="p-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 transition-colors"
                  title="Release to Shopfloor"
                >
                  <Play className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {/* Complete / Close (Released or In Progress) */}
            {(row.status === 'RELEASED' || row.status === 'IN_PROGRESS') && (
              <PermissionGate screen="MFG_WORK_ORDER" action="CLOSE">
                <button
                  type="button"
                  onClick={() => setCloseWoId(row.wo_id)}
                  className="p-1.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 transition-colors"
                  title="Complete / Close Work Order"
                >
                  <CheckCheck className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {/* Delete (Draft or Cancelled only) */}
            {(row.status === 'DRAFT' || row.status === 'CANCELLED') && (
              <PermissionGate screen="MFG_WORK_ORDER" action="DELETE">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(row)}
                  className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/40 text-[var(--text-muted)] hover:text-rose-600 transition-colors"
                  title="Delete Draft Work Order"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}
          </div>
        )}
      />

      {/* ---------------------------------------------------------------------- */}
      {/* CREATE / EDIT WORK ORDER MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {isCreateOpen && (
        <CreateEditWorkOrderModal
          isOpen={isCreateOpen}
          woId={editingWoId}
          lookups={lookups}
          onClose={() => {
            setIsCreateOpen(false);
            setEditingWoId(null);
          }}
          onSuccess={() => {
            setIsCreateOpen(false);
            setEditingWoId(null);
            queryClient.invalidateQueries({ queryKey: ['manufacturing', 'work-orders'] });
          }}
        />
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 1-CLICK CONVERT MRP MAKE ORDERS MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {isConvertMrpOpen && (
        <ConvertMrpModal
          isOpen={isConvertMrpOpen}
          lookups={lookups}
          onClose={() => setIsConvertMrpOpen(false)}
          onConvert={(payload) => convertMrpMutation.mutate(payload)}
          isSubmitting={convertMrpMutation.isPending}
        />
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* DETAILS DRAWER */}
      {/* ---------------------------------------------------------------------- */}
      {detailsWoId && (
        <WorkOrderDetailsDrawer
          woId={detailsWoId}
          detail={activeDetail}
          isLoading={isDetailLoading}
          onClose={() => setDetailsWoId(null)}
          onRelease={(id) => setReleaseWoId(id)}
          onCloseWo={(id) => setCloseWoId(id)}
          onPrint={(id) => setPrintWoId(id)}
        />
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* RELEASE CONFIRMATION MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {releaseWoId && (
        <ReleaseWorkOrderModal
          woId={releaseWoId}
          onClose={() => setReleaseWoId(null)}
          onConfirm={(remarks) => releaseMutation.mutate({ id: releaseWoId, remarks })}
          isSubmitting={releaseMutation.isPending}
        />
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* COMPLETE / CLOSE WORK ORDER MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {closeWoId && (
        <CloseWorkOrderModal
          woId={closeWoId}
          workOrder={listData?.data.find((w) => w.wo_id === closeWoId) || activeDetail}
          onClose={() => setCloseWoId(null)}
          onConfirm={(completedQty, scrappedQty, remarks) =>
            closeMutation.mutate({
              id: closeWoId,
              completedQty,
              scrappedQty,
              remarks,
            })
          }
          isSubmitting={closeMutation.isPending}
        />
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* PRINTABLE ROUTE TRAVELER / JOB CARD MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {printWoId && printData && (
        <PrintJobCardModal
          wo={printData}
          onClose={() => setPrintWoId(null)}
        />
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* CONFIRM DELETE MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {deleteTarget && (
        <ConfirmDeleteModal
          isOpen={!!deleteTarget}
          entityType="Work Order"
          entityName={deleteTarget.wo_no}
          entityCode={deleteTarget.wo_no}
          onConfirm={() => deleteMutation.mutate(deleteTarget.wo_id)}
          onClose={() => {
            setDeleteTarget(null);
            setDeleteConflicts([]);
          }}
          isDeleting={deleteMutation.isPending}
          dependencies={deleteConflicts}
        />
      )}
    </div>
  );
};

// ============================================================================
// CREATE / EDIT WORK ORDER MODAL (3 TABS)
// ============================================================================

interface CreateEditWorkOrderModalProps {
  isOpen: boolean;
  woId: number | null;
  lookups?: LookupsResponse;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateEditWorkOrderModal: React.FC<CreateEditWorkOrderModalProps> = ({
  isOpen,
  woId,
  lookups,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'HEADER' | 'BOM' | 'ROUTING'>('HEADER');

  // Form State
  const [itemId, setItemId] = useState<number | ''>('');
  const [bomId, setBomId] = useState<number | ''>('');
  const [routingId, setRoutingId] = useState<number | ''>('');
  const [targetWarehouseId, setTargetWarehouseId] = useState<number | ''>('');
  const [wipWarehouseId, setWipWarehouseId] = useState<number | ''>('');
  const [plannedQty, setPlannedQty] = useState<number>(1);
  const [uomId, setUomId] = useState<number | ''>('');
  const [scheduledStartDate, setScheduledStartDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [scheduledEndDate, setScheduledEndDate] = useState<string>(
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  );
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [batchNo, setBatchNo] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Auto-calculated preview components and operations from active BOM & Routing
  const selectedItem = lookups?.items.find((i) => i.item_id === Number(itemId));
  const availableBoms = lookups?.boms.filter((b) => b.item_id === Number(itemId)) || [];
  const availableRoutings =
    lookups?.routings.filter((r) => r.item_id === Number(itemId)) || [];

  // When Item changes, auto-select default BOM, default Routing, default warehouse, and UOM
  const handleItemSelect = (selectedId: number) => {
    setItemId(selectedId);
    const it = lookups?.items.find((i) => i.item_id === selectedId);
    if (it) {
      setUomId(it.base_uom_id);
      if (it.default_warehouse_id) {
        setTargetWarehouseId(it.default_warehouse_id);
      }
      // Pick default BOM
      const defaultBom = lookups?.boms.find((b) => b.item_id === selectedId && b.is_default);
      if (defaultBom) {
        setBomId(defaultBom.bom_id);
        if (defaultBom.routing_id) {
          setRoutingId(defaultBom.routing_id);
        }
      } else {
        const firstBom = lookups?.boms.find((b) => b.item_id === selectedId);
        setBomId(firstBom?.bom_id || '');
      }

      // Pick default Routing
      const defaultRouting = lookups?.routings.find(
        (r) => r.item_id === selectedId && r.is_default,
      );
      if (defaultRouting) {
        setRoutingId(defaultRouting.routing_id);
      } else {
        const firstRouting = lookups?.routings.find((r) => r.item_id === selectedId);
        if (firstRouting) {
          setRoutingId(firstRouting.routing_id);
        }
      }
    }
  };

  // Fetch full details if editing
  const { data: existingData, isLoading: isEditLoading } = useQuery({
    queryKey: ['manufacturing', 'work-orders', 'edit-detail', woId],
    queryFn: async () => {
      if (!woId) return null;
      const res = await apiClient.get<ApiResponse<WorkOrderDetail>>(
        `/manufacturing/work-orders/${woId}`,
      );
      return res.data.data;
    },
    enabled: !!woId,
  });

  // Populate edit fields
  React.useEffect(() => {
    if (existingData) {
      setItemId(existingData.item_id);
      setBomId(existingData.bom_id || '');
      setRoutingId(existingData.routing_id || '');
      setTargetWarehouseId(existingData.target_warehouse_id);
      setWipWarehouseId(existingData.wip_warehouse_id || '');
      setPlannedQty(existingData.planned_qty);
      setUomId(existingData.uom_id);
      setScheduledStartDate(existingData.scheduled_start_date);
      setScheduledEndDate(existingData.scheduled_end_date);
      setPriority(existingData.priority);
      setBatchNo(existingData.batch_no || '');
      setRemarks(existingData.remarks || '');
    }
  }, [existingData]);

  // Query selected BOM details for preview
  const { data: bomPreview } = useQuery({
    queryKey: ['manufacturing', 'boms', 'preview-for-wo', bomId],
    queryFn: async () => {
      if (!bomId) return null;
      const res = await apiClient.get<ApiResponse<any>>(`/manufacturing/boms/${bomId}`);
      return res.data.data;
    },
    enabled: !!bomId,
  });

  // Query selected Routing details for preview
  const { data: routingPreview } = useQuery({
    queryKey: ['manufacturing', 'routings', 'preview-for-wo', routingId],
    queryFn: async () => {
      if (!routingId) return null;
      const res = await apiClient.get<ApiResponse<any>>(`/manufacturing/routings/${routingId}`);
      return res.data.data;
    },
    enabled: !!routingId,
  });

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!itemId || !targetWarehouseId || !plannedQty || !uomId) {
        throw new Error('Please fill all mandatory fields (Item, Warehouse, Planned Qty).');
      }

      const payload = {
        itemId: Number(itemId),
        bomId: bomId ? Number(bomId) : undefined,
        routingId: routingId ? Number(routingId) : undefined,
        targetWarehouseId: Number(targetWarehouseId),
        wipWarehouseId: wipWarehouseId ? Number(wipWarehouseId) : undefined,
        plannedQty: Number(plannedQty),
        uomId: Number(uomId),
        scheduledStartDate,
        scheduledEndDate,
        priority,
        batchNo: batchNo || undefined,
        remarks: remarks || undefined,
      };

      if (woId) {
        await apiClient.put(`/manufacturing/work-orders/${woId}`, payload);
      } else {
        await apiClient.post('/manufacturing/work-orders', payload);
      }
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      setErrorMessage(
        err?.response?.data?.message || err.message || 'Failed to save Work Order.',
      );
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-subtle)]/50">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[var(--brand-50)] dark:bg-[var(--brand-950)] text-[var(--brand-600)] flex items-center justify-center">
              <Factory className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                {woId ? `Edit Work Order #${existingData?.wo_no || woId}` : 'Create New Work Order'}
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Snapshot Bill of Materials, freeze routing operations, and schedule production.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="flex items-center gap-1 px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <button
            type="button"
            onClick={() => setActiveTab('HEADER')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'HEADER'
                ? 'border-[var(--brand-600)] text-[var(--brand-600)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <FileText className="w-4 h-4" /> 1. Order Specifications
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('BOM')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'BOM'
                ? 'border-[var(--brand-600)] text-[var(--brand-600)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Layers className="w-4 h-4" /> 2. BOM Materials Snapshot Preview
            {bomPreview?.items?.length ? ` (${bomPreview.items.length})` : ''}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ROUTING')}
            className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-2 transition-colors ${
              activeTab === 'ROUTING'
                ? 'border-[var(--brand-600)] text-[var(--brand-600)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Workflow className="w-4 h-4" /> 3. Routing Operations Workflow
            {routingPreview?.operations?.length ? ` (${routingPreview.operations.length})` : ''}
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* TAB 1: ORDER SPECIFICATIONS */}
          {activeTab === 'HEADER' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Product Item Selection */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Manufacturing Item <span className="text-rose-500">*</span>
                </label>
                <select
                  disabled={!!woId}
                  value={itemId}
                  onChange={(e) => handleItemSelect(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)] disabled:opacity-60"
                >
                  <option value="">-- Select Finished / Semi-Finished Item --</option>
                  {lookups?.items.map((it) => (
                    <option key={it.item_id} value={it.item_id}>
                      {it.item_code} - {it.item_name} ({it.item_type})
                    </option>
                  ))}
                </select>
              </div>

              {/* Planned Batch Quantity */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Planned Batch Quantity <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0.001"
                    step="any"
                    value={plannedQty}
                    onChange={(e) => setPlannedQty(Number(e.target.value))}
                    className="flex-1 px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
                  />
                  <select
                    value={uomId}
                    onChange={(e) => setUomId(Number(e.target.value))}
                    className="w-28 px-2 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
                  >
                    <option value="">UOM</option>
                    {lookups?.items.map((it) => (
                      <option key={it.item_id} value={it.base_uom_id}>
                        {it.uom_code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bill of Materials (BOM) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Active Bill of Materials (BOM)
                </label>
                <select
                  value={bomId}
                  onChange={(e) => {
                    const newBomId = Number(e.target.value);
                    setBomId(newBomId);
                    const b = lookups?.boms.find((bm) => bm.bom_id === newBomId);
                    if (b?.routing_id) {
                      setRoutingId(b.routing_id);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
                >
                  <option value="">-- No BOM (Manual Component Entry) --</option>
                  {availableBoms.map((b) => (
                    <option key={b.bom_id} value={b.bom_id}>
                      {b.bom_code} (v{b.version_no}) - {b.bom_name} {b.is_default ? '★ Default' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Routing Selection */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Active Production Routing
                </label>
                <select
                  value={routingId}
                  onChange={(e) => setRoutingId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
                >
                  <option value="">-- No Routing (Unrouted Work Order) --</option>
                  {availableRoutings.map((r) => (
                    <option key={r.routing_id} value={r.routing_id}>
                      {r.routing_code} (v{r.version_no}) - {r.routing_name}{' '}
                      {r.is_default ? '★ Default' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Target Warehouse (Finished Goods Store) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Target Finished Goods Warehouse <span className="text-rose-500">*</span>
                </label>
                <select
                  value={targetWarehouseId}
                  onChange={(e) => setTargetWarehouseId(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
                >
                  <option value="">-- Select Receiving Warehouse --</option>
                  {lookups?.warehouses.map((wh) => (
                    <option key={wh.warehouse_id} value={wh.warehouse_id}>
                      {wh.warehouse_name} ({wh.warehouse_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* WIP Warehouse (Lineside Store) */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  WIP / Lineside Staging Store
                </label>
                <select
                  value={wipWarehouseId}
                  onChange={(e) => setWipWarehouseId(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
                >
                  <option value="">-- None (Direct Raw Material Issues) --</option>
                  {lookups?.warehouses.map((wh) => (
                    <option key={wh.warehouse_id} value={wh.warehouse_id}>
                      {wh.warehouse_name} ({wh.warehouse_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Scheduled Start Date */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Scheduled Start Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={scheduledStartDate}
                  onChange={(e) => setScheduledStartDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
                />
              </div>

              {/* Scheduled End Date */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Scheduled Completion Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={scheduledEndDate}
                  onChange={(e) => setScheduledEndDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
                />
              </div>

              {/* Priority */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Production Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL_URGENT">Critical / Urgent</option>
                </select>
              </div>

              {/* Batch / Lot Number */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Production Batch / Heat / Lot #
                </label>
                <input
                  type="text"
                  placeholder="e.g. BATCH-2026-X1"
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] font-mono-code focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
                />
              </div>

              {/* Remarks */}
              <div className="md:col-span-2 space-y-1">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Shopfloor Instructions & Notes
                </label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional operator notes or customer order requirements..."
                  className="w-full px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
                />
              </div>
            </div>
          )}

          {/* TAB 2: BOM MATERIALS PREVIEW */}
          {activeTab === 'BOM' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Materials Snapshot to be Frozen on WO Creation
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Calculated for planned batch size: {plannedQty}{' '}
                    {selectedItem?.uom_code || 'units'}.
                  </p>
                </div>
                {bomPreview && (
                  <span className="text-xs font-mono-code text-[var(--brand-600)] font-semibold">
                    BOM: {bomPreview.bom_code} (v{bomPreview.version_no})
                  </span>
                )}
              </div>

              {!bomPreview?.items || bomPreview.items.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[var(--border-default)] rounded-xl text-xs text-[var(--text-muted)]">
                  No BOM selected or BOM has no component lines.
                </div>
              ) : (
                <div className="overflow-x-auto border border-[var(--border-subtle)] rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[var(--bg-subtle)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-3 py-2">Seq</th>
                        <th className="px-3 py-2">Component Item</th>
                        <th className="px-3 py-2 text-right">Qty/Unit</th>
                        <th className="px-3 py-2 text-right">Scrap %</th>
                        <th className="px-3 py-2 text-right font-bold">Required Qty</th>
                        <th className="px-3 py-2">UOM</th>
                        <th className="px-3 py-2 text-right">Est. Unit Cost</th>
                        <th className="px-3 py-2 text-right">Est. Total Cost</th>
                        <th className="px-3 py-2">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-primary)]">
                      {bomPreview.items.map((bi: any, index: number) => {
                        const standardQty = Number(bi.gross_quantity || bi.quantity || 1);
                        const bomBatchSize = Number(bomPreview.output_qty || bomPreview.batch_size || 1);
                        const requiredQty = (plannedQty * standardQty) / bomBatchSize;
                        const unitCost = Number(bi.unit_cost || 0);
                        const totalLineCost = requiredQty * unitCost;

                        return (
                          <tr key={index} className="hover:bg-[var(--bg-subtle)]/50">
                            <td className="px-3 py-2 font-mono-code text-[var(--text-muted)]">
                              {bi.operation_seq || index + 1}
                            </td>
                            <td className="px-3 py-2">
                              <span className="font-semibold block">{bi.item_name}</span>
                              <span className="font-mono-code text-[11px] text-[var(--text-muted)]">
                                {bi.item_code}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-mono-code">
                              {standardQty}
                            </td>
                            <td className="px-3 py-2 text-right font-mono-code">
                              {bi.scrap_factor_percent || 0}%
                            </td>
                            <td className="px-3 py-2 text-right font-mono-code font-bold text-[var(--brand-600)]">
                              {Math.round(requiredQty * 1000) / 1000}
                            </td>
                            <td className="px-3 py-2 font-mono-code text-[var(--text-muted)]">
                              {bi.uom_code}
                            </td>
                            <td className="px-3 py-2 text-right font-mono-code">
                              ₹{unitCost.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono-code font-semibold">
                              ₹{totalLineCost.toFixed(2)}
                            </td>
                            <td className="px-3 py-2">
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                {bi.source_type || 'PURCHASED'}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ROUTING OPERATIONS PREVIEW */}
          {activeTab === 'ROUTING' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    Sequential Routing Steps Snapshot
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Work centers, cycle times, and machine allocations.
                  </p>
                </div>
                {routingPreview && (
                  <span className="text-xs font-mono-code text-cyan-600 font-semibold">
                    Routing: {routingPreview.routing_code} (v{routingPreview.version_no})
                  </span>
                )}
              </div>

              {!routingPreview?.operations || routingPreview.operations.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[var(--border-default)] rounded-xl text-xs text-[var(--text-muted)]">
                  No Routing selected or Routing has no operation steps.
                </div>
              ) : (
                <div className="overflow-x-auto border border-[var(--border-subtle)] rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[var(--bg-subtle)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-3 py-2">Seq</th>
                        <th className="px-3 py-2">Operation Code & Name</th>
                        <th className="px-3 py-2">Work Center</th>
                        <th className="px-3 py-2">Machine Asset</th>
                        <th className="px-3 py-2 text-right">Setup Mins</th>
                        <th className="px-3 py-2 text-right">Run Mins</th>
                        <th className="px-3 py-2 text-right">Est. Op Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-primary)]">
                      {routingPreview.operations.map((ro: any, index: number) => {
                        const totalRun = Number(ro.run_time_mins || 0) * plannedQty;
                        const estCost = Number(ro.planned_cost || ro.cost_per_unit || 0) * plannedQty;

                        return (
                          <tr key={index} className="hover:bg-[var(--bg-subtle)]/50">
                            <td className="px-3 py-2 font-mono-code font-bold text-[var(--brand-600)]">
                              OP-{ro.op_sequence}
                            </td>
                            <td className="px-3 py-2">
                              <span className="font-semibold block">{ro.op_name}</span>
                              <span className="font-mono-code text-[11px] text-[var(--text-muted)]">
                                {ro.op_code}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <span className="font-medium">{ro.work_center_name}</span>
                              <span className="block text-[10px] text-[var(--text-muted)] font-mono-code">
                                {ro.work_center_code}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-[var(--text-muted)]">
                              {ro.machine_name || 'Generic / Manual'}
                            </td>
                            <td className="px-3 py-2 text-right font-mono-code">
                              {ro.setup_time_mins || 0}m
                            </td>
                            <td className="px-3 py-2 text-right font-mono-code">
                              {Math.round(totalRun * 10) / 10}m
                            </td>
                            <td className="px-3 py-2 text-right font-mono-code font-semibold">
                              ₹{estCost.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 flex items-center justify-between">
          <div className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>
              On creation, BOM & Routing will be permanently snapshot into this Work Order.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
            >
              {saveMutation.isPending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" /> {woId ? 'Update Work Order' : 'Create Work Order'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 1-CLICK CONVERT MRP PLANNED ORDER MODAL
// ============================================================================

interface ConvertMrpModalProps {
  isOpen: boolean;
  lookups?: LookupsResponse;
  onClose: () => void;
  onConvert: (payload: any) => void;
  isSubmitting: boolean;
}

const ConvertMrpModal: React.FC<ConvertMrpModalProps> = ({
  isOpen,
  lookups,
  onClose,
  onConvert,
  isSubmitting,
}) => {
  const [selectedOrderId, setSelectedOrderId] = useState<number | ''>('');
  const [targetWarehouseId, setTargetWarehouseId] = useState<number | ''>('');
  const [priority, setPriority] = useState<Priority>('MEDIUM');
  const [batchNo, setBatchNo] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  const selectedOrder = lookups?.openMrpMakeOrders.find(
    (o) => o.planned_order_id === Number(selectedOrderId),
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-cyan-50/50 dark:bg-cyan-950/20">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-cyan-100 dark:bg-cyan-900/60 text-cyan-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">
                Convert MRP Planned Order to Work Order
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Select an open MRP MAKE order to auto-populate production requirements.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Order Selection */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">
              Open MRP MAKE Order <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedOrderId}
              onChange={(e) => setSelectedOrderId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
            >
              <option value="">-- Select Planned Make Order --</option>
              {lookups?.openMrpMakeOrders.map((o) => (
                <option key={o.planned_order_id} value={o.planned_order_id}>
                  {o.planned_order_no} | {o.item_code} - {o.item_name} ({o.planned_order_qty}{' '}
                  {o.uom_code}) Due: {o.required_by_date}
                </option>
              ))}
            </select>
          </div>

          {selectedOrder && (
            <div className="p-3 rounded-xl bg-cyan-50/60 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Product:</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {selectedOrder.item_name} ({selectedOrder.item_code})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Planned Quantity:</span>
                <span className="font-bold text-cyan-600 dark:text-cyan-400">
                  {selectedOrder.planned_order_qty} {selectedOrder.uom_code}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Required Delivery Date:</span>
                <span className="font-semibold">{selectedOrder.required_by_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Suggested Release Date:</span>
                <span className="font-semibold">{selectedOrder.order_release_date}</span>
              </div>
            </div>
          )}

          {/* Target Warehouse */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">
              Target Finished Goods Warehouse
            </label>
            <select
              value={targetWarehouseId}
              onChange={(e) => setTargetWarehouseId(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
            >
              <option value="">-- Item's Default Warehouse --</option>
              {lookups?.warehouses.map((wh) => (
                <option key={wh.warehouse_id} value={wh.warehouse_id}>
                  {wh.warehouse_name} ({wh.warehouse_code})
                </option>
              ))}
            </select>
          </div>

          {/* Priority */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">
              Work Order Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL_URGENT">Critical / Urgent</option>
            </select>
          </div>

          {/* Batch No */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">
              Batch / Lot Number (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. MRP-BATCH-01"
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] font-mono-code focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
            />
          </div>

          {/* Remarks */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">
              Conversion Remarks
            </label>
            <input
              type="text"
              placeholder="Converted from MRP run..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!selectedOrderId || isSubmitting}
            onClick={() =>
              onConvert({
                plannedOrderId: Number(selectedOrderId),
                targetWarehouseId: targetWarehouseId ? Number(targetWarehouseId) : undefined,
                priority,
                batchNo: batchNo || undefined,
                remarks: remarks || undefined,
              })
            }
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Generating WO...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" /> Generate Work Order
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// WORK ORDER DETAILS DRAWER
// ============================================================================

interface WorkOrderDetailsDrawerProps {
  woId: number;
  detail?: WorkOrderDetail;
  isLoading: boolean;
  onClose: () => void;
  onRelease: (id: number) => void;
  onCloseWo: (id: number) => void;
  onPrint: (id: number) => void;
}

const WorkOrderDetailsDrawer: React.FC<WorkOrderDetailsDrawerProps> = ({
  woId,
  detail,
  isLoading,
  onClose,
  onRelease,
  onCloseWo,
  onPrint,
}) => {
  const [drawerTab, setDrawerTab] = useState<'BOM' | 'ROUTING' | 'SCHEDULE_COST'>('BOM');

  if (isLoading || !detail) {
    return (
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-4xl bg-[var(--bg-surface)] border-l border-[var(--border-default)] p-8 flex items-center justify-center shadow-2xl">
        <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <RefreshCw className="w-5 h-5 animate-spin" /> Loading Work Order #{woId}...
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-4xl bg-[var(--bg-surface)] border-l border-[var(--border-default)] shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-6 border-b border-[var(--border-subtle)] bg-[var(--bg-subtle)]/50 flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono-code text-xl font-bold text-[var(--text-primary)]">
              {detail.wo_no}
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {detail.status}
            </span>
            {detail.is_overdue && (
              <span className="px-2 py-0.5 rounded text-xs font-bold uppercase bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
                Overdue
              </span>
            )}
          </div>
          <h2 className="text-base font-semibold text-[var(--text-primary)]">
            {detail.item_name}{' '}
            <span className="font-mono-code text-xs text-[var(--text-muted)]">
              ({detail.item_code})
            </span>
          </h2>
          <div className="flex items-center gap-4 text-xs text-[var(--text-muted)] flex-wrap pt-1">
            <span>
              Planned:{' '}
              <strong className="text-[var(--text-primary)]">
                {detail.planned_qty} {detail.uom_code}
              </strong>
            </span>
            <span>
              Done:{' '}
              <strong className="text-emerald-600">
                {detail.completed_qty} {detail.uom_code}
              </strong>
            </span>
            <span>
              Scrapped:{' '}
              <strong className="text-rose-600">
                {detail.scrapped_qty} {detail.uom_code}
              </strong>
            </span>
            <span>
              Target WH:{' '}
              <strong className="text-[var(--text-primary)]">
                {detail.target_warehouse_name}
              </strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Print */}
          <button
            type="button"
            onClick={() => onPrint(detail.wo_id)}
            className="p-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
            title="Print Job Card"
          >
            <Printer className="w-4 h-4" />
          </button>

          {/* Release Action */}
          {detail.status === 'DRAFT' && (
            <button
              type="button"
              onClick={() => onRelease(detail.wo_id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-xs"
            >
              <Play className="w-3.5 h-3.5" /> Release
            </button>
          )}

          {/* Complete / Close Action */}
          {(detail.status === 'RELEASED' || detail.status === 'IN_PROGRESS') && (
            <button
              type="button"
              onClick={() => onCloseWo(detail.wo_id)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-xs"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Close Job
            </button>
          )}

          {/* Close Drawer */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-6 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <button
          type="button"
          onClick={() => setDrawerTab('BOM')}
          className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
            drawerTab === 'BOM'
              ? 'border-[var(--brand-600)] text-[var(--brand-600)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Layers className="w-4 h-4" /> Frozen BOM Components ({detail.bomItems?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setDrawerTab('ROUTING')}
          className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
            drawerTab === 'ROUTING'
              ? 'border-[var(--brand-600)] text-[var(--brand-600)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Workflow className="w-4 h-4" /> Routing Operations ({detail.routingOps?.length || 0})
        </button>
        <button
          type="button"
          onClick={() => setDrawerTab('SCHEDULE_COST')}
          className={`px-4 py-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors ${
            drawerTab === 'SCHEDULE_COST'
              ? 'border-[var(--brand-600)] text-[var(--brand-600)]'
              : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Clock className="w-4 h-4" /> Timeline & Cost Analysis
        </button>
      </div>

      {/* Drawer Content */}
      <div className="p-6 overflow-y-auto flex-1 space-y-6">
        {/* TAB: BOM COMPONENTS */}
        {drawerTab === 'BOM' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>
                Source BOM: <strong>{detail.bom_code || 'Manual / Custom'}</strong> (v
                {detail.bom_version || '1.0'})
              </span>
              <span>
                Total Est. Material Cost:{' '}
                <strong className="text-[var(--text-primary)] font-mono-code">
                  ₹{detail.estimated_material_cost.toFixed(2)}
                </strong>
              </span>
            </div>

            <div className="overflow-x-auto border border-[var(--border-subtle)] rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-[var(--bg-subtle)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-3 py-2">Seq</th>
                    <th className="px-3 py-2">Component Item</th>
                    <th className="px-3 py-2 text-right">Required</th>
                    <th className="px-3 py-2 text-right">Issued</th>
                    <th className="px-3 py-2 text-right">Consumed</th>
                    <th className="px-3 py-2">UOM</th>
                    <th className="px-3 py-2 text-right">Unit Cost</th>
                    <th className="px-3 py-2 text-right">Est. Total</th>
                    <th className="px-3 py-2">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-primary)]">
                  {detail.bomItems?.map((bi, index) => (
                    <tr key={bi.wo_bom_item_id} className="hover:bg-[var(--bg-subtle)]/50">
                      <td className="px-3 py-2 font-mono-code text-[var(--text-muted)]">
                        {bi.operation_seq || index + 1}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-semibold block">{bi.item_name}</span>
                        <span className="font-mono-code text-[11px] text-[var(--text-muted)]">
                          {bi.item_code}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono-code font-bold text-[var(--brand-600)]">
                        {bi.required_qty}
                      </td>
                      <td className="px-3 py-2 text-right font-mono-code text-blue-600">
                        {bi.issued_qty}
                      </td>
                      <td className="px-3 py-2 text-right font-mono-code text-emerald-600">
                        {bi.consumed_qty}
                      </td>
                      <td className="px-3 py-2 font-mono-code text-[var(--text-muted)]">
                        {bi.uom_code}
                      </td>
                      <td className="px-3 py-2 text-right font-mono-code">
                        ₹{Number(bi.unit_cost).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono-code font-semibold">
                        ₹{Number(bi.estimated_cost).toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {bi.source_type}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: ROUTING OPERATIONS */}
        {drawerTab === 'ROUTING' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>
                Source Routing: <strong>{detail.routing_code || 'Manual / Custom'}</strong> (v
                {detail.routing_version || '1.0'})
              </span>
              <span>
                Total Est. Operation Cost:{' '}
                <strong className="text-[var(--text-primary)] font-mono-code">
                  ₹{detail.estimated_operation_cost.toFixed(2)}
                </strong>
              </span>
            </div>

            <div className="overflow-x-auto border border-[var(--border-subtle)] rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-[var(--bg-subtle)] text-[var(--text-secondary)] font-semibold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="px-3 py-2">Seq</th>
                    <th className="px-3 py-2">Operation</th>
                    <th className="px-3 py-2">Work Center</th>
                    <th className="px-3 py-2">Machine</th>
                    <th className="px-3 py-2 text-right">Setup Mins</th>
                    <th className="px-3 py-2 text-right">Run Mins</th>
                    <th className="px-3 py-2 text-right">Done Qty</th>
                    <th className="px-3 py-2 text-right">Est. Cost</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-primary)]">
                  {detail.routingOps?.map((ro) => (
                    <tr key={ro.wo_routing_op_id} className="hover:bg-[var(--bg-subtle)]/50">
                      <td className="px-3 py-2 font-mono-code font-bold text-[var(--brand-600)]">
                        OP-{ro.op_sequence}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-semibold block">{ro.op_name}</span>
                        <span className="font-mono-code text-[11px] text-[var(--text-muted)]">
                          {ro.op_code}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-medium">{ro.work_center_name}</span>
                      </td>
                      <td className="px-3 py-2 text-[var(--text-muted)]">
                        {ro.machine_name || 'Generic'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono-code">
                        {ro.planned_setup_time_mins}m
                      </td>
                      <td className="px-3 py-2 text-right font-mono-code">
                        {ro.planned_run_time_mins}m
                      </td>
                      <td className="px-3 py-2 text-right font-mono-code font-semibold text-emerald-600">
                        {ro.completed_qty} / {ro.planned_qty}
                      </td>
                      <td className="px-3 py-2 text-right font-mono-code">
                        ₹{Number(ro.planned_cost).toFixed(2)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {ro.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB: TIMELINE & COST VARIANCE */}
        {drawerTab === 'SCHEDULE_COST' && (
          <div className="space-y-6">
            {/* Timeline Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/30 space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Scheduled Timeline
                </span>
                <div className="text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-[var(--text-muted)]">Scheduled Start:</span>
                    <span className="font-medium">{detail.scheduled_start_date}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[var(--text-muted)]">Scheduled End:</span>
                    <span className="font-medium">{detail.scheduled_end_date}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[var(--text-muted)]">Release Date:</span>
                    <span className="font-medium">
                      {detail.released_date ? String(detail.released_date).slice(0, 10) : '—'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[var(--text-muted)]">Released By:</span>
                    <span className="font-medium">{detail.released_by_name || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/30 space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Cost Summary & Absorption
                </span>
                <div className="text-sm">
                  <div className="flex justify-between py-1">
                    <span className="text-[var(--text-muted)]">Est. Material:</span>
                    <span className="font-mono-code font-medium">
                      ₹{detail.estimated_material_cost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-[var(--text-muted)]">Est. Operations:</span>
                    <span className="font-mono-code font-medium">
                      ₹{detail.estimated_operation_cost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-t border-[var(--border-subtle)] pt-1 font-bold">
                    <span>Est. Total Cost:</span>
                    <span className="font-mono-code text-[var(--brand-600)]">
                      ₹{detail.estimated_total_cost.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 text-xs text-[var(--text-muted)]">
                    <span>Cost per Finished Unit:</span>
                    <span className="font-mono-code font-semibold">
                      ₹
                      {(
                        detail.estimated_total_cost / Math.max(1, detail.planned_qty)
                      ).toFixed(2)}{' '}
                      / {detail.uom_code}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Audit Tracking */}
            <div className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)]/20 text-xs text-[var(--text-muted)] flex justify-between">
              <span>
                Created by <strong>{detail.created_by_name || 'System'}</strong> on{' '}
                {detail.created_date ? String(detail.created_date).slice(0, 16) : '—'}
              </span>
              {detail.updated_date && (
                <span>
                  Updated on {String(detail.updated_date).slice(0, 16)}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// RELEASE WORK ORDER MODAL
// ============================================================================

interface ReleaseWorkOrderModalProps {
  woId: number;
  onClose: () => void;
  onConfirm: (remarks?: string) => void;
  isSubmitting: boolean;
}

const ReleaseWorkOrderModal: React.FC<ReleaseWorkOrderModalProps> = ({
  woId,
  onClose,
  onConfirm,
  isSubmitting,
}) => {
  const [remarks, setRemarks] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 flex items-center justify-center">
            <Play className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              Release Work Order to Shopfloor
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Authorizes production lines and allows material reservations.
            </p>
          </div>
        </div>

        <p className="text-xs text-[var(--text-secondary)]">
          Releasing Work Order #{woId} will change its status to <strong>RELEASED</strong>,
          record your user credentials as the releasing authority, and allow route traveler
          printing and shopfloor dispatching.
        </p>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Release Remarks / Shift Notes (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Scheduled for Morning Shift Line 1..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onConfirm(remarks || undefined)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Releasing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Release Order
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// COMPLETE & CLOSE WORK ORDER MODAL
// ============================================================================

interface CloseWorkOrderModalProps {
  woId: number;
  workOrder?: WorkOrderRow | WorkOrderDetail;
  onClose: () => void;
  onConfirm: (completedQty: number, scrappedQty: number, remarks?: string) => void;
  isSubmitting: boolean;
}

const CloseWorkOrderModal: React.FC<CloseWorkOrderModalProps> = ({
  woId,
  workOrder,
  onClose,
  onConfirm,
  isSubmitting,
}) => {
  const [completedQty, setCompletedQty] = useState<number>(workOrder?.planned_qty || 1);
  const [scrappedQty, setScrappedQty] = useState<number>(0);
  const [remarks, setRemarks] = useState('');

  const planned = workOrder?.planned_qty || 1;
  const yieldPct = Math.round((completedQty / planned) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center">
            <CheckCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)]">
              Complete & Close Work Order
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Record final production output and archive active job.
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-[var(--bg-subtle)] text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Order #:</span>
            <span className="font-mono-code font-bold">{workOrder?.wo_no}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--text-muted)]">Planned Batch Qty:</span>
            <span className="font-semibold">
              {planned} {workOrder?.uom_code}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">
              Completed Good Qty <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={completedQty}
              onChange={(e) => setCompletedQty(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm font-bold text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">
              Scrapped / Reject Qty
            </label>
            <input
              type="number"
              min="0"
              step="any"
              value={scrappedQty}
              onChange={(e) => setScrappedQty(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-sm font-semibold text-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-[var(--text-muted)]">Batch Yield Efficiency:</span>
          <span
            className={`font-bold ${
              yieldPct >= 100
                ? 'text-emerald-600'
                : yieldPct >= 90
                ? 'text-blue-600'
                : 'text-amber-600'
            }`}
          >
            {yieldPct}%
          </span>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Closing Remarks / QC Signoff
          </label>
          <textarea
            rows={2}
            placeholder="Batch passed QC inspection, output transferred to finished warehouse..."
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting || completedQty < 0}
            onClick={() => onConfirm(completedQty, scrappedQty, remarks || undefined)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Closing...
              </>
            ) : (
              <>
                <CheckCheck className="w-4 h-4" /> Close & Archive Work Order
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// PRINTABLE ROUTE TRAVELER / JOB CARD MODAL
// ============================================================================

interface PrintJobCardModalProps {
  wo: WorkOrderDetail;
  onClose: () => void;
}

const PrintJobCardModal: React.FC<PrintJobCardModalProps> = ({ wo, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white text-black rounded-2xl w-full max-w-4xl shadow-2xl p-8 flex flex-col max-h-[92vh] overflow-y-auto print:p-0 print:m-0 print:shadow-none print:max-w-none print:rounded-none">
        {/* Print Action Bar (Hidden when printing) */}
        <div className="flex items-center justify-between pb-6 border-b border-gray-300 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-gray-700" />
            <h3 className="text-base font-bold text-gray-900">
              Job Card / Route Traveler Preview
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-900 text-white text-xs font-semibold hover:bg-black transition-colors"
            >
              <Printer className="w-4 h-4" /> Print Document
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Route Traveler Content */}
        <div className="pt-4 space-y-6">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-black pb-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight">KASHVIRA INFOTECH MFG ERP</h1>
              <p className="text-xs text-gray-600">
                Plant Route Traveler & Shopfloor Production Job Card
              </p>
              <p className="text-xs font-mono mt-1 text-gray-500">
                Generated: {new Date().toLocaleString()}
              </p>
            </div>
            <div className="text-right">
              <div className="inline-block p-2 border-2 border-black font-mono font-bold text-lg">
                {wo.wo_no}
              </div>
              <p className="text-[10px] font-mono mt-1 text-gray-600">
                |||| | ||||| ||||||| ||| ||||||
              </p>
            </div>
          </div>

          {/* Key Job Specifications */}
          <div className="grid grid-cols-3 gap-4 p-4 border border-gray-300 rounded-lg text-xs">
            <div>
              <span className="text-gray-500 block">Finished Product:</span>
              <strong className="text-sm block">{wo.item_name}</strong>
              <span className="font-mono text-gray-600">{wo.item_code}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Planned Batch Size:</span>
              <strong className="text-base font-mono block">
                {wo.planned_qty} {wo.uom_code}
              </strong>
              <span className="text-gray-600">Priority: {wo.priority}</span>
            </div>
            <div>
              <span className="text-gray-500 block">Scheduled Window:</span>
              <span className="block font-medium">
                {wo.scheduled_start_date} to {wo.scheduled_end_date}
              </span>
              <span className="text-gray-600 block">
                Batch #: {wo.batch_no || 'Unassigned'}
              </span>
            </div>
          </div>

          {/* Section 1: Frozen BOM Components Picking List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider bg-gray-100 px-3 py-1.5 border-l-4 border-black">
              1. Raw Material Staging & Picking Verification
            </h4>
            <table className="w-full text-xs border border-gray-300 text-left">
              <thead className="bg-gray-50 border-b border-gray-300">
                <tr>
                  <th className="p-2 border-r border-gray-300">Seq</th>
                  <th className="p-2 border-r border-gray-300">Item Code & Name</th>
                  <th className="p-2 border-r border-gray-300 text-right">Required Qty</th>
                  <th className="p-2 border-r border-gray-300">UOM</th>
                  <th className="p-2 border-r border-gray-300">Issued Lot #</th>
                  <th className="p-2 text-center">Store Signoff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {wo.bomItems?.map((bi, i) => (
                  <tr key={bi.wo_bom_item_id}>
                    <td className="p-2 border-r border-gray-300 font-mono text-center">
                      {bi.operation_seq || i + 1}
                    </td>
                    <td className="p-2 border-r border-gray-300">
                      <strong>{bi.item_name}</strong>
                      <span className="font-mono text-[11px] text-gray-600 block">
                        {bi.item_code}
                      </span>
                    </td>
                    <td className="p-2 border-r border-gray-300 text-right font-mono font-bold">
                      {bi.required_qty}
                    </td>
                    <td className="p-2 border-r border-gray-300 font-mono">{bi.uom_code}</td>
                    <td className="p-2 border-r border-gray-300 font-mono text-gray-400">
                      __________________
                    </td>
                    <td className="p-2 text-center text-gray-400">[ &nbsp; &nbsp; &nbsp; &nbsp; ]</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 2: Sequential Routing Operations Traveler */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider bg-gray-100 px-3 py-1.5 border-l-4 border-black">
              2. Shopfloor Routing Operations Sign-off & Inspection
            </h4>
            <table className="w-full text-xs border border-gray-300 text-left">
              <thead className="bg-gray-50 border-b border-gray-300">
                <tr>
                  <th className="p-2 border-r border-gray-300">Step</th>
                  <th className="p-2 border-r border-gray-300">Operation & Code</th>
                  <th className="p-2 border-r border-gray-300">Work Center</th>
                  <th className="p-2 border-r border-gray-300">Machine Asset</th>
                  <th className="p-2 border-r border-gray-300 text-right">Good Qty</th>
                  <th className="p-2 border-r border-gray-300 text-right">Scrap</th>
                  <th className="p-2 border-r border-gray-300 text-center">Operator Initials</th>
                  <th className="p-2 text-center">QC Stamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {wo.routingOps?.map((ro) => (
                  <tr key={ro.wo_routing_op_id}>
                    <td className="p-2 border-r border-gray-300 font-mono font-bold">
                      OP-{ro.op_sequence}
                    </td>
                    <td className="p-2 border-r border-gray-300">
                      <strong>{ro.op_name}</strong>
                      <span className="font-mono text-[10px] text-gray-500 block">
                        {ro.op_code}
                      </span>
                    </td>
                    <td className="p-2 border-r border-gray-300">{ro.work_center_name}</td>
                    <td className="p-2 border-r border-gray-300 text-gray-600">
                      {ro.machine_name || 'Standard Bench'}
                    </td>
                    <td className="p-2 border-r border-gray-300 text-right font-mono">
                      ______
                    </td>
                    <td className="p-2 border-r border-gray-300 text-right font-mono">
                      ______
                    </td>
                    <td className="p-2 border-r border-gray-300 text-center font-mono text-gray-400">
                      ______
                    </td>
                    <td className="p-2 text-center text-gray-400">[ &nbsp; &nbsp; &nbsp; &nbsp; ]</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 3: Final Signatures */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-gray-300 text-xs">
            <div className="text-center space-y-8">
              <div className="border-b border-gray-400 w-3/4 mx-auto" />
              <p className="font-semibold text-gray-700">Production Supervisor</p>
            </div>
            <div className="text-center space-y-8">
              <div className="border-b border-gray-400 w-3/4 mx-auto" />
              <p className="font-semibold text-gray-700">Quality Assurance Lead</p>
            </div>
            <div className="text-center space-y-8">
              <div className="border-b border-gray-400 w-3/4 mx-auto" />
              <p className="font-semibold text-gray-700">FG Warehouse Receiver</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
