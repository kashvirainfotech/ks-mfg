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
  CheckSquare,
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
  Pause,
  Pencil,
  Play,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Tag,
  Timer,
  Trash2,
  TrendingUp,
  User,
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

export type JobCardStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED';

export type InProcessQcStatus =
  | 'NA'
  | 'PENDING'
  | 'INSPECTION_IN_PROGRESS'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'DEVIATION_ACCEPTED';

export interface JobCardSummary {
  totalJobCards: number;
  inProgressCount: number;
  completedCount: number;
  pendingCount: number;
  totalCompletedQty: number;
  totalScrappedQty: number;
  pendingQcCount: number;
  qcPassRate: number;
  totalActualCost: number;
}

export interface JobCardRow {
  job_card_id: number;
  job_card_no: string;
  job_card_date: string;
  wo_id: number;
  wo_no: string;
  wo_item_id: number;
  wo_item_code: string;
  wo_item_name: string;
  wo_planned_qty: number;
  wo_status: string;
  wo_routing_op_id: number;
  op_sequence: number;
  op_code: string;
  op_name: string;
  work_center_id: number;
  work_center_code: string;
  work_center_name: string;
  machine_id: number | null;
  machine_code: string | null;
  machine_name: string | null;
  assigned_operator_id: number | null;
  operator_name: string | null;
  planned_qty: number;
  input_qty: number;
  completed_qty: number;
  scrapped_qty: number;
  rework_qty: number;
  uom_id: number;
  uom_code: string;
  status: JobCardStatus;
  scheduled_start_date: string | null;
  scheduled_end_date: string | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  planned_setup_mins: number;
  planned_run_mins: number;
  actual_setup_mins: number;
  actual_run_mins: number;
  downtime_mins: number;
  downtime_reason: string | null;
  hourly_rate: number;
  actual_cost: number;
  is_inspection_required: boolean;
  in_process_qc_status: InProcessQcStatus;
  qc_inspector_id: number | null;
  qc_inspector_name: string | null;
  qc_inspected_at: string | null;
  qc_sample_size: number;
  qc_accepted_qty: number;
  qc_rejected_qty: number;
  qc_remarks: string | null;
  batch_no: string | null;
  heat_no: string | null;
  remarks: string | null;
  created_date: string;
  time_log_count: number;
}

export interface JobCardTimeLogRow {
  log_id: number;
  job_card_id: number;
  operator_id: number | null;
  operator_name: string | null;
  machine_id: number | null;
  machine_name: string | null;
  start_time: string;
  end_time: string | null;
  setup_mins: number;
  run_mins: number;
  downtime_mins: number;
  downtime_reason: string | null;
  completed_qty: number;
  scrapped_qty: number;
  rework_qty: number;
  remarks: string | null;
  created_date: string;
}

export interface JobCardDetail extends JobCardRow {
  timeLogs?: JobCardTimeLogRow[];
  uom_name?: string;
  wo_priority?: string;
  wo_completed_qty?: number;
  created_by_name?: string | null;
  updated_by_name?: string | null;
}

export interface JobCardLookups {
  activeWorkOrders: Array<{
    wo_id: number;
    wo_no: string;
    wo_date: string;
    item_id: number;
    item_code: string;
    item_name: string;
    planned_qty: number;
    completed_qty: number;
    uom_id: number;
    uom_code: string;
    status: string;
    priority: string;
    batch_no: string | null;
    total_ops: number;
    generated_job_cards: number;
  }>;
  workCenters: Array<{
    work_center_id: number;
    work_center_code: string;
    work_center_name: string;
    work_center_type: string;
    hourly_rate: number;
  }>;
  machines: Array<{
    machine_id: number;
    work_center_id: number;
    machine_code: string;
    machine_name: string;
    status: string;
  }>;
  operators: Array<{
    user_id: number;
    username: string;
    full_name: string;
    email: string;
  }>;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const JobCardMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterWorkCenter, setFilterWorkCenter] = useState<string>('ALL');
  const [filterWoId, setFilterWoId] = useState<string>('ALL');
  const [filterQcStatus, setFilterQcStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Drawers
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [selectedGenerateWoId, setSelectedGenerateWoId] = useState<number | ''>('');
  const [generateRemarks, setGenerateRemarks] = useState('');

  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [selectedJobCardForStart, setSelectedJobCardForStart] = useState<JobCardRow | null>(null);
  const [startOperatorId, setStartOperatorId] = useState<number | ''>('');
  const [startMachineId, setStartMachineId] = useState<number | ''>('');
  const [startRemarks, setStartRemarks] = useState('');

  const [isLogTimeModalOpen, setIsLogTimeModalOpen] = useState(false);
  const [selectedJobCardForLog, setSelectedJobCardForLog] = useState<JobCardRow | null>(null);
  const [logForm, setLogForm] = useState({
    operatorId: '' as number | '',
    machineId: '' as number | '',
    setupMins: 0,
    runMins: 60,
    downtimeMins: 0,
    downtimeReason: '',
    completedQty: 10,
    scrappedQty: 0,
    reworkQty: 0,
    remarks: '',
  });

  const [isQcModalOpen, setIsQcModalOpen] = useState(false);
  const [selectedJobCardForQc, setSelectedJobCardForQc] = useState<JobCardRow | null>(null);
  const [qcForm, setQcForm] = useState({
    qcStatus: 'ACCEPTED' as 'ACCEPTED' | 'REJECTED' | 'DEVIATION_ACCEPTED',
    sampleSize: 5,
    acceptedQty: 0,
    rejectedQty: 0,
    qcRemarks: '',
  });

  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [selectedJobCardForComplete, setSelectedJobCardForComplete] = useState<JobCardRow | null>(null);
  const [completeRemarks, setCompleteRemarks] = useState('');

  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
  const [selectedViewId, setSelectedViewId] = useState<number | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printJobCardData, setPrintJobCardData] = useState<JobCardDetail | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [jobCardToDelete, setJobCardToDelete] = useState<JobCardRow | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  const { data: summaryData, isLoading: isLoadingSummary } = useQuery<JobCardSummary>({
    queryKey: ['job-card-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<JobCardSummary>>(
        '/manufacturing/job-cards/summary',
      );
      return (
        res.data?.data || {
          totalJobCards: 0,
          inProgressCount: 0,
          completedCount: 0,
          pendingCount: 0,
          totalCompletedQty: 0,
          totalScrappedQty: 0,
          pendingQcCount: 0,
          qcPassRate: 100,
          totalActualCost: 0,
        }
      );
    },
    staleTime: 1000 * 30,
  });

  const { data: lookups } = useQuery<JobCardLookups>({
    queryKey: ['job-card-lookups'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<JobCardLookups>>(
        '/manufacturing/job-cards/lookups',
      );
      return (
        res.data?.data || {
          activeWorkOrders: [],
          workCenters: [],
          machines: [],
          operators: [],
        }
      );
    },
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: jobCardsData,
    isLoading: isLoadingJobCards,
  } = useQuery<JobCardRow[]>({
    queryKey: [
      'job-cards',
      filterStatus,
      filterWorkCenter,
      filterWoId,
      filterQcStatus,
      searchQuery,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== 'ALL') params.append('status', filterStatus);
      if (filterWorkCenter !== 'ALL') params.append('workCenterId', filterWorkCenter);
      if (filterWoId !== 'ALL') params.append('woId', filterWoId);
      if (filterQcStatus !== 'ALL') params.append('qcStatus', filterQcStatus);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      params.append('limit', '200');

      const res = await apiClient.get<ApiResponse<{ data: JobCardRow[] }>>(
        `/manufacturing/job-cards?${params.toString()}`,
      );
      return res.data?.data?.data || [];
    },
  });

  const { data: viewDetailData, isLoading: isLoadingDetail } = useQuery<JobCardDetail | null>({
    queryKey: ['job-card-detail', selectedViewId],
    queryFn: async () => {
      if (!selectedViewId) return null;
      const res = await apiClient.get<ApiResponse<JobCardDetail>>(
        `/manufacturing/job-cards/${selectedViewId}`,
      );
      return res.data?.data || null;
    },
    enabled: Boolean(selectedViewId),
  });

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  const generateJobCardsMutation = useMutation({
    mutationFn: async (payload: { woId: number; remarks?: string }) => {
      return apiClient.post('/manufacturing/job-cards/generate', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['job-card-summary'] });
      queryClient.invalidateQueries({ queryKey: ['job-card-lookups'] });
      setIsGenerateModalOpen(false);
      setSelectedGenerateWoId('');
      setGenerateRemarks('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to generate Job Cards from Work Order');
    },
  });

  const startJobMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      return apiClient.post(`/manufacturing/job-cards/${id}/start`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['job-card-summary'] });
      if (selectedViewId) {
        queryClient.invalidateQueries({ queryKey: ['job-card-detail', selectedViewId] });
      }
      setIsStartModalOpen(false);
      setSelectedJobCardForStart(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to start Job Card');
    },
  });

  const logTimeMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      return apiClient.post(`/manufacturing/job-cards/${id}/log-time`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['job-card-summary'] });
      if (selectedViewId) {
        queryClient.invalidateQueries({ queryKey: ['job-card-detail', selectedViewId] });
      }
      setIsLogTimeModalOpen(false);
      setSelectedJobCardForLog(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to log operation time and output');
    },
  });

  const inProcessQcMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      return apiClient.post(`/manufacturing/job-cards/${id}/qc`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['job-card-summary'] });
      if (selectedViewId) {
        queryClient.invalidateQueries({ queryKey: ['job-card-detail', selectedViewId] });
      }
      setIsQcModalOpen(false);
      setSelectedJobCardForQc(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to record in-process QC inspection');
    },
  });

  const completeJobMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      return apiClient.post(`/manufacturing/job-cards/${id}/complete`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['job-card-summary'] });
      if (selectedViewId) {
        queryClient.invalidateQueries({ queryKey: ['job-card-detail', selectedViewId] });
      }
      setIsCompleteModalOpen(false);
      setSelectedJobCardForComplete(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to complete Job Card operation');
    },
  });

  const deleteJobCardMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiClient.delete(`/manufacturing/job-cards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-cards'] });
      queryClient.invalidateQueries({ queryKey: ['job-card-summary'] });
      setIsDeleteModalOpen(false);
      setJobCardToDelete(null);
    },
    onError: (err: any) => {
      setDeleteErrorMessage(err.response?.data?.message || 'Failed to delete Job Card');
    },
  });

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  const handleOpenPrintModal = async (jcId: number) => {
    try {
      const res = await apiClient.get<ApiResponse<JobCardDetail>>(
        `/manufacturing/job-cards/${jcId}`,
      );
      if (res.data?.data) {
        setPrintJobCardData(res.data.data);
        setIsPrintModalOpen(true);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to fetch Job Card details for printing');
    }
  };

  // --------------------------------------------------------------------------
  // Table Setup
  // --------------------------------------------------------------------------

  const columns: MasterTableColumn<JobCardRow>[] = [
    {
      key: 'job_card_no',
      header: 'Job Card #',
      sortable: true,
      sortValue: (r) => r.job_card_no,
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-semibold text-[var(--text-primary)] font-mono">{r.job_card_no}</span>
          <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
            <Calendar className="h-3 w-3" />
            <span>{r.job_card_date}</span>
          </span>
        </div>
      ),
    },
    {
      key: 'wo_no',
      header: 'Work Order & FG Item',
      sortable: true,
      sortValue: (r) => r.wo_no,
      render: (r) => (
        <div className="flex flex-col max-w-[220px]">
          <span className="font-medium text-xs text-[var(--text-primary)] flex items-center gap-1">
            <Factory className="h-3 w-3 text-indigo-500" />
            <span className="font-mono">{r.wo_no}</span>
          </span>
          <span className="text-[11px] text-[var(--text-muted)] truncate" title={r.wo_item_name}>
            {r.wo_item_code} — {r.wo_item_name}
          </span>
        </div>
      ),
    },
    {
      key: 'stage_op',
      header: 'Operation Stage',
      sortable: true,
      sortValue: (r) => r.op_sequence,
      render: (r) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              OP-{r.op_sequence}
            </span>
            <span className="font-medium text-xs text-[var(--text-primary)]">{r.op_name}</span>
          </div>
          <span className="text-[11px] text-[var(--text-muted)] mt-0.5">
            Code: <strong className="font-mono">{r.op_code}</strong>
          </span>
        </div>
      ),
    },
    {
      key: 'work_center',
      header: 'Work Center & Machine',
      render: (r) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium text-[var(--text-secondary)]">{r.work_center_name}</span>
          <span className="text-[11px] text-[var(--text-muted)]">
            {r.machine_name ? `Asset: ${r.machine_name}` : 'Manual Bench'}
          </span>
        </div>
      ),
    },
    {
      key: 'operator',
      header: 'Assigned Operator',
      render: (r) => (
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <User className="h-3.5 w-3.5 text-slate-400" />
          <span>{r.operator_name || 'Unassigned Queue'}</span>
        </div>
      ),
    },
    {
      key: 'quantities',
      header: 'Progress / Units',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.completed_qty,
      render: (r) => {
        const percent = r.planned_qty > 0 ? Math.min(100, Math.round((r.completed_qty / r.planned_qty) * 100)) : 0;
        return (
          <div className="text-right flex flex-col items-end">
            <div className="font-semibold text-xs text-[var(--text-primary)] font-mono">
              {r.completed_qty} / {r.planned_qty} {r.uom_code}
            </div>
            <div className="w-24 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1">
              <div
                className={`h-full ${
                  r.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
            {r.scrapped_qty > 0 && (
              <span className="text-[10px] text-rose-500 font-semibold mt-0.5">
                {r.scrapped_qty} scrap
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'in_process_qc',
      header: 'In-Process QC',
      render: (r) => {
        if (!r.is_inspection_required) {
          return <span className="text-[11px] text-[var(--text-muted)] italic">Not Required</span>;
        }
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
              r.in_process_qc_status === 'ACCEPTED'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                : r.in_process_qc_status === 'PENDING'
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                : r.in_process_qc_status === 'DEVIATION_ACCEPTED'
                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
            }`}
          >
            {r.in_process_qc_status === 'ACCEPTED' && <ShieldCheck className="h-3 w-3" />}
            {r.in_process_qc_status === 'PENDING' && <Clock className="h-3 w-3" />}
            {r.in_process_qc_status === 'REJECTED' && <ShieldAlert className="h-3 w-3" />}
            <span>{r.in_process_qc_status.replace(/_/g, ' ')}</span>
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
            r.status === 'COMPLETED'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : r.status === 'IN_PROGRESS'
              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
              : r.status === 'PENDING'
              ? 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
          }`}
        >
          {r.status === 'COMPLETED' && <CheckCircle2 className="h-3 w-3" />}
          {r.status === 'IN_PROGRESS' && <Activity className="h-3 w-3 animate-pulse" />}
          {r.status === 'PENDING' && <Clock className="h-3 w-3" />}
          <span>{r.status}</span>
        </span>
      ),
    },
  ];

  const groupByOptions: GroupByOption<JobCardRow>[] = [
    {
      key: 'status',
      label: 'Operation Status',
      groupValue: (r) => r.status,
    },
    {
      key: 'wo_no',
      label: 'Work Order',
      groupValue: (r) => `${r.wo_no} (${r.wo_item_code})`,
    },
    {
      key: 'work_center_name',
      label: 'Work Center',
      groupValue: (r) => r.work_center_name,
    },
    {
      key: 'operator_name',
      label: 'Assigned Operator',
      groupValue: (r) => r.operator_name || 'Unassigned Queue',
    },
  ];

  const searchPredicate = (row: JobCardRow, query: string) => {
    const q = query.toLowerCase();
    return Boolean(
      row.job_card_no.toLowerCase().includes(q) ||
      row.wo_no.toLowerCase().includes(q) ||
      row.op_code.toLowerCase().includes(q) ||
      row.op_name.toLowerCase().includes(q) ||
      row.wo_item_code.toLowerCase().includes(q) ||
      row.wo_item_name.toLowerCase().includes(q) ||
      row.work_center_name.toLowerCase().includes(q) ||
      (row.machine_name && row.machine_name.toLowerCase().includes(q)) ||
      (row.operator_name && row.operator_name.toLowerCase().includes(q)),
    );
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6 p-6">
      {/* Top Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Production Job Cards & Operation Execution
            </h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Stage-wise routing operation dispatch, shopfloor time logging, machine asset tracking, and in-process quality inspection clearance
          </p>
        </div>

        {/* Global Action Button */}
        <div className="flex items-center gap-2.5">
          <PermissionGate screen="MFG_JOB_CARD" action="ADD">
            <button
              onClick={() => {
                setSelectedGenerateWoId('');
                setGenerateRemarks('');
                setIsGenerateModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs"
            >
              <Sparkles className="h-4 w-4" />
              <span>Generate Job Cards from WO</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)]">Total Job Cards</p>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mt-1 font-mono">
              {isLoadingSummary ? '...' : summaryData?.totalJobCards ?? 0}
            </h3>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {summaryData?.pendingCount ?? 0} Pending Dispatch
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <CheckSquare className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)]">Active Operations</p>
            <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1 font-mono">
              {isLoadingSummary ? '...' : summaryData?.inProgressCount ?? 0}
            </h3>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Live machining & assembly
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Activity className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)]">Total Output Delivered</p>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mt-1 font-mono">
              {isLoadingSummary ? '...' : (summaryData?.totalCompletedQty ?? 0).toLocaleString()}
            </h3>
            <p className="text-[11px] text-rose-500 mt-0.5 font-medium">
              {summaryData?.totalScrappedQty ?? 0} Scrap Units
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <PackageCheck className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)]">In-Process QC Pass Rate</p>
            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
              {isLoadingSummary ? '...' : `${summaryData?.qcPassRate ?? 100}%`}
            </h3>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              {summaryData?.pendingQcCount ?? 0} Pending Clearance
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Master Data Table */}
      <MasterDataTable<JobCardRow>
        title="Shopfloor Job Cards Register"
        subtitle="Track sequential routing operations, clock operator times, record scrap, and verify quality"
        screenCode="MFG_JOB_CARD"
        tableNameBadge="tbl_mfg_job_card"
        data={jobCardsData || []}
        isLoading={isLoadingJobCards}
        rowKey={(r) => r.job_card_id}
        columns={columns}
        searchPredicate={searchPredicate}
        groupByOptions={groupByOptions}
        filterToolbarSlot={
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-primary)]"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            {/* Work Center Filter */}
            <select
              value={filterWorkCenter}
              onChange={(e) => setFilterWorkCenter(e.target.value)}
              className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-primary)]"
            >
              <option value="ALL">All Work Centers</option>
              {lookups?.workCenters.map((wc) => (
                <option key={wc.work_center_id} value={wc.work_center_id}>
                  {wc.work_center_name}
                </option>
              ))}
            </select>

            {/* Work Order Filter */}
            <select
              value={filterWoId}
              onChange={(e) => setFilterWoId(e.target.value)}
              className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-primary)] max-w-xs truncate"
            >
              <option value="ALL">All Work Orders</option>
              {lookups?.activeWorkOrders.map((wo) => (
                <option key={wo.wo_id} value={wo.wo_id}>
                  {wo.wo_no} — {wo.item_code}
                </option>
              ))}
            </select>

            {/* QC Filter */}
            <select
              value={filterQcStatus}
              onChange={(e) => setFilterQcStatus(e.target.value)}
              className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-primary)]"
            >
              <option value="ALL">All QC Statuses</option>
              <option value="PENDING">QC Pending</option>
              <option value="ACCEPTED">QC Accepted</option>
              <option value="REJECTED">QC Rejected</option>
              <option value="DEVIATION_ACCEPTED">Deviation Accepted</option>
            </select>
          </div>
        }
        renderRowActions={(row) => (
          <div className="flex items-center justify-end gap-1">
            {/* View Details Drawer */}
            <button
              onClick={() => {
                setSelectedViewId(row.job_card_id);
                setIsDetailsDrawerOpen(true);
              }}
              title="View Job Card Traveler & Time Logs"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <Eye className="h-4 w-4" />
            </button>

            {/* Print Job Card */}
            <PermissionGate screen="MFG_JOB_CARD" action="PRINT">
              <button
                onClick={() => handleOpenPrintModal(row.job_card_id)}
                title="Print Shopfloor Job Card Traveler"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <Printer className="h-4 w-4" />
              </button>
            </PermissionGate>

            {/* Start Operation (Pending only) */}
            {row.status === 'PENDING' && (
              <PermissionGate screen="MFG_JOB_CARD" action="START">
                <button
                  onClick={() => {
                    setSelectedJobCardForStart(row);
                    setStartOperatorId(row.assigned_operator_id || '');
                    setStartMachineId(row.machine_id || '');
                    setStartRemarks('');
                    setIsStartModalOpen(true);
                  }}
                  title="Start Operation / Clock In"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-500/10 dark:text-blue-400 transition-colors"
                >
                  <Play className="h-4 w-4" />
                </button>
              </PermissionGate>
            )}

            {/* Log Time & Production Output (In-Progress only) */}
            {row.status === 'IN_PROGRESS' && (
              <PermissionGate screen="MFG_JOB_CARD" action="COMPLETE">
                <button
                  onClick={() => {
                    setSelectedJobCardForLog(row);
                    setLogForm({
                      operatorId: row.assigned_operator_id || '',
                      machineId: row.machine_id || '',
                      setupMins: 0,
                      runMins: 60,
                      downtimeMins: 0,
                      downtimeReason: '',
                      completedQty: Math.max(1, row.planned_qty - row.completed_qty),
                      scrappedQty: 0,
                      reworkQty: 0,
                      remarks: '',
                    });
                    setIsLogTimeModalOpen(true);
                  }}
                  title="Log Machine Time & Units Produced"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-400 transition-colors"
                >
                  <Timer className="h-4 w-4" />
                </button>
              </PermissionGate>
            )}

            {/* In-Process QC (If inspection required) */}
            {row.is_inspection_required && (
              <PermissionGate screen="MFG_JOB_CARD" action="APPROVE">
                <button
                  onClick={() => {
                    setSelectedJobCardForQc(row);
                    setQcForm({
                      qcStatus: 'ACCEPTED',
                      sampleSize: 5,
                      acceptedQty: row.completed_qty || row.planned_qty,
                      rejectedQty: row.scrapped_qty || 0,
                      qcRemarks: 'All critical dimensions within drawing tolerance.',
                    });
                    setIsQcModalOpen(true);
                  }}
                  title="In-Process QC Clearance"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-amber-600 hover:bg-amber-500/10 dark:text-amber-400 transition-colors"
                >
                  <ShieldCheck className="h-4 w-4" />
                </button>
              </PermissionGate>
            )}

            {/* Complete Operation (In Progress only) */}
            {row.status === 'IN_PROGRESS' && (
              <PermissionGate screen="MFG_JOB_CARD" action="COMPLETE">
                <button
                  onClick={() => {
                    setSelectedJobCardForComplete(row);
                    setCompleteRemarks('Completed operation stage and handed over to next queue');
                    setIsCompleteModalOpen(true);
                  }}
                  title="Finalize & Complete Operation"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400 transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              </PermissionGate>
            )}

            {/* Delete (Pending only) */}
            {row.status === 'PENDING' && (
              <PermissionGate screen="MFG_JOB_CARD" action="DELETE">
                <button
                  onClick={() => {
                    setJobCardToDelete(row);
                    setDeleteErrorMessage(null);
                    setIsDeleteModalOpen(true);
                  }}
                  title="Delete Pending Job Card"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-500/10 dark:text-rose-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </PermissionGate>
            )}
          </div>
        )}
      />

      {/* ==================================================================== */}
      {/* 1-CLICK GENERATE JOB CARDS MODAL                                     */}
      {/* ==================================================================== */}
      {isGenerateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">
                    Generate Job Cards from Work Order
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Automatically create sequential shopfloor job cards for active production
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsGenerateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Select Target Work Order <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedGenerateWoId}
                  onChange={(e) => setSelectedGenerateWoId(Number(e.target.value))}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                >
                  <option value="">-- Select Active Work Order --</option>
                  {lookups?.activeWorkOrders.map((wo) => (
                    <option key={wo.wo_id} value={wo.wo_id}>
                      {wo.wo_no} — {wo.item_code} ({wo.item_name}) [Qty: {wo.planned_qty} {wo.uom_code}]
                    </option>
                  ))}
                </select>
              </div>

              {selectedGenerateWoId && (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-xs space-y-1.5">
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400 uppercase text-[10px] tracking-wider">
                    Work Order Overview
                  </span>
                  {(() => {
                    const wo = lookups?.activeWorkOrders.find((w) => w.wo_id === selectedGenerateWoId);
                    if (!wo) return null;
                    return (
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Finished Good:</span>
                          <span className="font-semibold text-[var(--text-primary)]">{wo.item_code} - {wo.item_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Planned Batch Qty:</span>
                          <span className="font-semibold text-[var(--text-primary)]">{wo.planned_qty} {wo.uom_code}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--text-secondary)]">Routing Operations:</span>
                          <span className="font-semibold text-indigo-600">{wo.total_ops} Stage(s) Configured</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Dispatch Notes / Instructions
                </label>
                <textarea
                  rows={2}
                  value={generateRemarks}
                  onChange={(e) => setGenerateRemarks(e.target.value)}
                  placeholder="e.g. Expedite CNC machining stage for priority delivery..."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <button
                type="button"
                onClick={() => setIsGenerateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedGenerateWoId || generateJobCardsMutation.isPending}
                onClick={() =>
                  generateJobCardsMutation.mutate({
                    woId: Number(selectedGenerateWoId),
                    remarks: generateRemarks,
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                <span>Generate Job Cards</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* START JOB CARD MODAL                                                 */}
      {/* ==================================================================== */}
      {isStartModalOpen && selectedJobCardForStart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Play className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">
                    Start Operation / Clock In
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] font-mono">
                    {selectedJobCardForStart.job_card_no} • OP-{selectedJobCardForStart.op_sequence}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsStartModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Assigned Operator
                </label>
                <select
                  value={startOperatorId}
                  onChange={(e) => setStartOperatorId(Number(e.target.value))}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
                >
                  <option value="">-- Current Logged Operator --</option>
                  {lookups?.operators.map((u) => (
                    <option key={u.user_id} value={u.user_id}>
                      {u.full_name} ({u.username})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Machine Asset
                </label>
                <select
                  value={startMachineId}
                  onChange={(e) => setStartMachineId(Number(e.target.value))}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
                >
                  <option value="">-- Default Work Center Machine --</option>
                  {lookups?.machines
                    .filter((m) => m.work_center_id === selectedJobCardForStart.work_center_id)
                    .map((m) => (
                      <option key={m.machine_id} value={m.machine_id}>
                        {m.machine_code} - {m.machine_name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Start Notes
                </label>
                <input
                  type="text"
                  value={startRemarks}
                  onChange={(e) => setStartRemarks(e.target.value)}
                  placeholder="e.g. Shift 1 morning batch started..."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <button
                type="button"
                onClick={() => setIsStartModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={startJobMutation.isPending}
                onClick={() =>
                  startJobMutation.mutate({
                    id: selectedJobCardForStart.job_card_id,
                    payload: {
                      operatorId: startOperatorId ? Number(startOperatorId) : undefined,
                      machineId: startMachineId ? Number(startMachineId) : undefined,
                      remarks: startRemarks,
                    },
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-xs"
              >
                <Play className="h-4 w-4" />
                <span>Confirm Clock In</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* LOG TIME & OUTPUT MODAL                                              */}
      {/* ==================================================================== */}
      {isLogTimeModalOpen && selectedJobCardForLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Timer className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">
                    Log Machine Time & Output
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] font-mono">
                    {selectedJobCardForLog.job_card_no} • {selectedJobCardForLog.op_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsLogTimeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Setup Time (mins)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={logForm.setupMins}
                    onChange={(e) => setLogForm({ ...logForm, setupMins: Number(e.target.value) })}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-mono font-semibold text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Machining Run Time (mins)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={logForm.runMins}
                    onChange={(e) => setLogForm({ ...logForm, runMins: Number(e.target.value) })}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-mono font-semibold text-[var(--text-primary)]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Downtime (mins)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={logForm.downtimeMins}
                    onChange={(e) => setLogForm({ ...logForm, downtimeMins: Number(e.target.value) })}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-mono font-semibold text-[var(--text-primary)]"
                  />
                </div>
              </div>

              {logForm.downtimeMins > 0 && (
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Downtime Reason / Stoppage Cause <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={logForm.downtimeReason}
                    onChange={(e) => setLogForm({ ...logForm, downtimeReason: e.target.value })}
                    placeholder="e.g. Tool insert chipped, Coolant pump cleaning, Power glitch..."
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
                  />
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1 text-emerald-600">
                    Good Units Produced <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={logForm.completedQty}
                    onChange={(e) => setLogForm({ ...logForm, completedQty: Number(e.target.value) })}
                    className="w-full rounded-xl border border-emerald-500/30 bg-[var(--bg-surface)] px-3 py-2 text-xs font-mono font-bold text-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1 text-rose-500">
                    Scrap Units Rejected
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={logForm.scrappedQty}
                    onChange={(e) => setLogForm({ ...logForm, scrappedQty: Number(e.target.value) })}
                    className="w-full rounded-xl border border-rose-500/30 bg-[var(--bg-surface)] px-3 py-2 text-xs font-mono font-bold text-rose-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1 text-purple-600">
                    Rework Required
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={logForm.reworkQty}
                    onChange={(e) => setLogForm({ ...logForm, reworkQty: Number(e.target.value) })}
                    className="w-full rounded-xl border border-purple-500/30 bg-[var(--bg-surface)] px-3 py-2 text-xs font-mono font-bold text-purple-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Shift Notes / Handover Remarks
                </label>
                <input
                  type="text"
                  value={logForm.remarks}
                  onChange={(e) => setLogForm({ ...logForm, remarks: e.target.value })}
                  placeholder="e.g. Dimensions verified with vernier calliper..."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <button
                type="button"
                onClick={() => setIsLogTimeModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={logTimeMutation.isPending}
                onClick={() =>
                  logTimeMutation.mutate({
                    id: selectedJobCardForLog.job_card_id,
                    payload: logForm,
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-xs"
              >
                <Check className="h-4 w-4" />
                <span>Save Production Log</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* IN-PROCESS QC CLEARANCE MODAL                                        */}
      {/* ==================================================================== */}
      {isQcModalOpen && selectedJobCardForQc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">
                    In-Process Quality Inspection Clearance
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] font-mono">
                    {selectedJobCardForQc.job_card_no} • OP-{selectedJobCardForQc.op_sequence}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsQcModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Work Order:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{selectedJobCardForQc.wo_no}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Product:</span>
                  <span className="font-semibold text-[var(--text-primary)]">{selectedJobCardForQc.wo_item_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Completed Qty for Inspection:</span>
                  <span className="font-bold text-emerald-600">{selectedJobCardForQc.completed_qty} {selectedJobCardForQc.uom_code}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Inspection Decision <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={qcForm.qcStatus}
                    onChange={(e) => setQcForm({ ...qcForm, qcStatus: e.target.value as any })}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
                  >
                    <option value="ACCEPTED">ACCEPTED (Pass to Next Stage)</option>
                    <option value="DEVIATION_ACCEPTED">DEVIATION ACCEPTED (Concession)</option>
                    <option value="REJECTED">REJECTED (Scrap / Hold)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                    Sample Pieces Inspected
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={qcForm.sampleSize}
                    onChange={(e) => setQcForm({ ...qcForm, sampleSize: Number(e.target.value) })}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-mono font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1 text-emerald-600">
                    Passed / Accepted Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={qcForm.acceptedQty}
                    onChange={(e) => setQcForm({ ...qcForm, acceptedQty: Number(e.target.value) })}
                    className="w-full rounded-xl border border-emerald-500/30 bg-[var(--bg-surface)] px-3 py-2 text-xs font-mono font-bold text-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[var(--text-secondary)] mb-1 text-rose-500">
                    Rejected Qty
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={qcForm.rejectedQty}
                    onChange={(e) => setQcForm({ ...qcForm, rejectedQty: Number(e.target.value) })}
                    className="w-full rounded-xl border border-rose-500/30 bg-[var(--bg-surface)] px-3 py-2 text-xs font-mono font-bold text-rose-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Inspector Remarks & Test Observations
                </label>
                <textarea
                  rows={2}
                  value={qcForm.qcRemarks}
                  onChange={(e) => setQcForm({ ...qcForm, qcRemarks: e.target.value })}
                  placeholder="e.g. Surface finish Ra 0.8 achieved; concentricity within 0.02 mm..."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <button
                type="button"
                onClick={() => setIsQcModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={inProcessQcMutation.isPending}
                onClick={() =>
                  inProcessQcMutation.mutate({
                    id: selectedJobCardForQc.job_card_id,
                    payload: qcForm,
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-xs"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Sign Off Quality Inspection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* COMPLETE OPERATION CONFIRMATION MODAL                                */}
      {/* ==================================================================== */}
      {isCompleteModalOpen && selectedJobCardForComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">
                    Complete Operation Stage
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] font-mono">
                    {selectedJobCardForComplete.job_card_no}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCompleteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Good Units Output:</span>
                  <span className="font-bold text-emerald-600">{selectedJobCardForComplete.completed_qty} {selectedJobCardForComplete.uom_code}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Machine Time Logged:</span>
                  <span className="font-mono">{selectedJobCardForComplete.actual_setup_mins + selectedJobCardForComplete.actual_run_mins} mins</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">Absorbed Operation Cost:</span>
                  <span className="font-mono font-bold">₹{selectedJobCardForComplete.actual_cost.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-1 text-slate-500 text-[11px]">
                <p>✓ Operation stage will be marked COMPLETED.</p>
                <p>✓ Output quantity will be transferred to next operation queue.</p>
                <p>✓ Machine actual operation costs will be accumulated onto Work Order #{selectedJobCardForComplete.wo_no}.</p>
              </div>

              <div>
                <label className="block font-semibold text-[var(--text-secondary)] mb-1">
                  Final Handover Remarks
                </label>
                <input
                  type="text"
                  value={completeRemarks}
                  onChange={(e) => setCompleteRemarks(e.target.value)}
                  placeholder="e.g. Staged at Assembly bay..."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <button
                type="button"
                onClick={() => setIsCompleteModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={completeJobMutation.isPending}
                onClick={() =>
                  completeJobMutation.mutate({
                    id: selectedJobCardForComplete.job_card_id,
                    payload: { finalRemarks: completeRemarks },
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirm & Complete Stage</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* DETAILS DRAWER                                                       */}
      {/* ==================================================================== */}
      {isDetailsDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs transition-opacity"
          onClick={() => setIsDetailsDrawerOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] shadow-2xl h-full flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <CheckSquare className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[var(--text-primary)] font-mono">
                      {viewDetailData?.job_card_no || 'Loading...'}
                    </h2>
                    {viewDetailData && (
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          viewDetailData.status === 'COMPLETED'
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : viewDetailData.status === 'IN_PROGRESS'
                            ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                            : 'bg-slate-500/10 text-slate-600 border border-slate-500/20'
                        }`}
                      >
                        {viewDetailData.status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    OP-{viewDetailData?.op_sequence}: {viewDetailData?.op_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailsDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {isLoadingDetail || !viewDetailData ? (
                <div className="flex items-center justify-center py-12 text-xs text-[var(--text-muted)]">
                  Loading Job Card details...
                </div>
              ) : (
                <>
                  {/* Linked WO Box */}
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm text-[var(--text-primary)] font-mono flex items-center gap-2">
                        <Factory className="h-4 w-4 text-indigo-500" />
                        <span>Work Order: {viewDetailData.wo_no}</span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 font-medium">
                        WO Status: {viewDetailData.wo_status}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      Finished Good: <strong className="text-[var(--text-primary)]">{viewDetailData.wo_item_code}</strong> — {viewDetailData.wo_item_name}
                    </div>
                  </div>

                  {/* Operation & Progress Stats */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                        Work Center & Machine
                      </span>
                      <p className="font-semibold text-[var(--text-primary)] mt-1">
                        {viewDetailData.work_center_name}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Asset: {viewDetailData.machine_name || 'Manual'} (Rate: ₹{viewDetailData.hourly_rate}/hr)
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                        Quantities Handled
                      </span>
                      <p className="font-semibold text-[var(--text-primary)] mt-1">
                        Completed: {viewDetailData.completed_qty} / {viewDetailData.planned_qty} {viewDetailData.uom_code}
                      </p>
                      <p className="text-[11px] text-rose-500 font-medium">
                        Scrap: {viewDetailData.scrapped_qty} | Rework: {viewDetailData.rework_qty}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                        Logged Time & Cost
                      </span>
                      <p className="font-semibold text-[var(--text-primary)] mt-1 font-mono">
                        Run: {viewDetailData.actual_run_mins}m | Setup: {viewDetailData.actual_setup_mins}m
                      </p>
                      <p className="text-[11px] text-emerald-600 font-semibold font-mono">
                        Actual Cost: ₹{viewDetailData.actual_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                        In-Process Quality
                      </span>
                      <p className="font-semibold text-[var(--text-primary)] mt-1">
                        Status: {viewDetailData.in_process_qc_status}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        {viewDetailData.qc_remarks || 'Inspection checklist pending'}
                      </p>
                    </div>
                  </div>

                  {/* Operator Time Log History */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-indigo-500" />
                      <span>Operator Time & Output Log ({viewDetailData.timeLogs?.length || 0})</span>
                    </h3>

                    <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] text-[var(--text-secondary)] font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Start & End</th>
                            <th className="py-2.5 px-2">Operator</th>
                            <th className="py-2.5 px-2 text-right">Setup (m)</th>
                            <th className="py-2.5 px-2 text-right">Run (m)</th>
                            <th className="py-2.5 px-2 text-right">Good Qty</th>
                            <th className="py-2.5 px-2 text-right">Scrap</th>
                            <th className="py-2.5 px-2">Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                          {!viewDetailData.timeLogs || viewDetailData.timeLogs.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-6 text-center text-xs text-[var(--text-muted)]">
                                No operator shift time logged yet. Click "Log Machine Time" to record production output.
                              </td>
                            </tr>
                          ) : (
                            viewDetailData.timeLogs.map((log) => (
                              <tr key={log.log_id} className="hover:bg-slate-500/5 transition-colors">
                                <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--text-secondary)]">
                                  {new Date(log.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {log.end_time && ` - ${new Date(log.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                </td>
                                <td className="py-2.5 px-2 font-medium text-[var(--text-primary)]">
                                  {log.operator_name || 'Operator'}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono text-[var(--text-muted)]">
                                  {log.setup_mins}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono font-semibold text-[var(--text-primary)]">
                                  {log.run_mins}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                  {log.completed_qty}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono text-rose-500">
                                  {log.scrapped_qty > 0 ? log.scrapped_qty : '—'}
                                </td>
                                <td className="py-2.5 px-2 text-[11px] text-[var(--text-muted)] truncate max-w-[140px]" title={log.downtime_reason || log.remarks || ''}>
                                  {log.downtime_reason ? `Downtime: ${log.downtime_reason}` : log.remarks || '—'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <button
                type="button"
                onClick={() => setIsDetailsDrawerOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <PermissionGate screen="MFG_JOB_CARD" action="PRINT">
                  <button
                    type="button"
                    onClick={() => {
                      if (viewDetailData) {
                        setPrintJobCardData(viewDetailData);
                        setIsPrintModalOpen(true);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--text-primary)] transition-colors shadow-xs"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Print Traveler</span>
                  </button>
                </PermissionGate>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PRINTABLE JOB CARD TRAVELER SHEET MODAL                              */}
      {/* ==================================================================== */}
      {isPrintModalOpen && printJobCardData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl border border-[var(--border-subtle)] bg-white text-slate-900 shadow-2xl overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-6 py-3 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-slate-700" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Job Card Traveler Preview
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Sheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="text-slate-500 hover:text-slate-800 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Sheet */}
            <div className="p-8 space-y-6 text-slate-900 print:p-0">
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    KASHVIRA PRECISION MANUFACTURING LTD
                  </h1>
                  <p className="text-xs text-slate-600">
                    ISO 9001:2015 / IATF 16949 Certified Production Facility
                  </p>
                  <p className="text-xs font-bold text-indigo-700 mt-1 uppercase tracking-wide">
                    SHOPFLOOR OPERATION JOB CARD TRAVELER
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-mono text-base font-bold text-slate-900">
                    {printJobCardData.job_card_no}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Date: <strong>{printJobCardData.job_card_date}</strong>
                  </div>
                  <div className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-slate-200 text-slate-800">
                    STATUS: {printJobCardData.status}
                  </div>
                </div>
              </div>

              {/* Order & Operation Details */}
              <div className="grid grid-cols-2 gap-4 text-xs border border-slate-300 rounded-lg p-3 bg-slate-50">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    Work Order Reference
                  </span>
                  <p className="font-bold text-slate-900 font-mono">{printJobCardData.wo_no}</p>
                  <p className="text-slate-700">
                    Part: <strong>{printJobCardData.wo_item_code}</strong> — {printJobCardData.wo_item_name}
                  </p>
                  <p className="text-slate-600">
                    Planned Batch Qty: {printJobCardData.planned_qty} {printJobCardData.uom_code}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    Stage & Work Center
                  </span>
                  <p className="font-bold text-slate-900">
                    OP-{printJobCardData.op_sequence}: {printJobCardData.op_name}
                  </p>
                  <p className="text-slate-700">
                    Cell: <strong>{printJobCardData.work_center_name}</strong>
                  </p>
                  <p className="text-slate-600">
                    Machine Asset: {printJobCardData.machine_name || 'Manual Bench'}
                  </p>
                </div>
              </div>

              {/* Operation Specs & Time Records */}
              <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                <thead className="bg-slate-200 border-b border-slate-300 text-slate-800 font-bold">
                  <tr>
                    <th className="py-2 px-2 border-r border-slate-300">Target Qty</th>
                    <th className="py-2 px-2 border-r border-slate-300">Good Produced</th>
                    <th className="py-2 px-2 border-r border-slate-300">Scrap / Defect</th>
                    <th className="py-2 px-2 border-r border-slate-300">Actual Setup (m)</th>
                    <th className="py-2 px-2 border-r border-slate-300">Actual Run (m)</th>
                    <th className="py-2 px-2">QC Decision</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-3 px-2 border-r border-slate-300 font-mono font-bold">
                      {printJobCardData.planned_qty} {printJobCardData.uom_code}
                    </td>
                    <td className="py-3 px-2 border-r border-slate-300 font-mono font-bold text-emerald-700">
                      {printJobCardData.completed_qty} {printJobCardData.uom_code}
                    </td>
                    <td className="py-3 px-2 border-r border-slate-300 font-mono text-rose-600">
                      {printJobCardData.scrapped_qty}
                    </td>
                    <td className="py-3 px-2 border-r border-slate-300 font-mono">
                      {printJobCardData.actual_setup_mins} mins
                    </td>
                    <td className="py-3 px-2 border-r border-slate-300 font-mono">
                      {printJobCardData.actual_run_mins} mins
                    </td>
                    <td className="py-3 px-2 font-bold text-slate-800">
                      {printJobCardData.in_process_qc_status}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-6 pt-12 text-center text-xs text-slate-700">
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold">
                    {printJobCardData.operator_name || 'Machine Operator'}
                  </div>
                  <span className="text-[10px] text-slate-500">Operator Sign & Date</span>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold">
                    {printJobCardData.qc_inspector_name || 'Quality Inspector'}
                  </div>
                  <span className="text-[10px] text-slate-500">QC Stamp & Sign</span>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold">
                    Plant Supervisor
                  </div>
                  <span className="text-[10px] text-slate-500">Stage Handover Sign</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* CONFIRM DELETE MODAL                                                 */}
      {/* ==================================================================== */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        entityType="Job Card"
        entityName={jobCardToDelete?.job_card_no || ''}
        entityCode={jobCardToDelete?.job_card_no}
        isDeleting={deleteJobCardMutation.isPending}
        errorMessage={deleteErrorMessage}
        onConfirm={() => {
          if (jobCardToDelete) {
            deleteJobCardMutation.mutate(jobCardToDelete.job_card_id);
          }
        }}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setJobCardToDelete(null);
          setDeleteErrorMessage(null);
        }}
      />
    </div>
  );
};

export default JobCardMasterPage;
