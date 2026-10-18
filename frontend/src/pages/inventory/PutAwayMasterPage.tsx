import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  Boxes,
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
  Layers,
  Package,
  Play,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  Truck,
  User,
  UserCheck,
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

export type PutAwayStatus =
  | 'DRAFT'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export type PutAwayType =
  | 'GRN_INWARD'
  | 'QC_RELEASE'
  | 'INTERNAL_TRANSFER'
  | 'REWORK_RETURN';

export interface PutAwayItemRecord {
  putawayItemId?: number;
  putawayId?: number;
  grnItemId?: number | null;
  qcItemId?: number | null;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  itemDescription?: string;
  uomId: number;
  uomCode?: string;
  uomName?: string;
  sourceBinId?: number | null;
  sourceBinCode?: string;
  sourceBinName?: string;
  destinationBinId: number;
  destinationBinCode?: string;
  destinationBinName?: string;
  allocatedQty: number;
  putawayQty: number;
  batchNo?: string | null;
  heatNo?: string | null;
  mfgDate?: string | null;
  expiryDate?: string | null;
  status?: 'PENDING' | 'COMPLETED';
  remarks?: string | null;
}

export interface PutAwayHeaderRecord {
  putawayId: number;
  putawayNo: string;
  putawayDate: string;
  warehouseId: number;
  warehouseName: string;
  warehouseCode: string;
  grnId?: number | null;
  grnNo?: string | null;
  qcId?: number | null;
  qcNo?: string | null;
  assignedTo?: number | null;
  assignedToName?: string | null;
  putawayType: PutAwayType;
  status: PutAwayStatus;
  totalItems: number;
  totalQty: number;
  completedDate?: string | null;
  completedBy?: number | null;
  completedByName?: string | null;
  remarks?: string | null;
  cancelReason?: string | null;
  createdDate?: string;
  items?: PutAwayItemRecord[];
}

export interface PutAwaySummary {
  totalTasks: number;
  pendingCount: number;
  inProgressCount: number;
  completedCount: number;
  totalPutawayQty: number;
}

export interface PendingQcOption {
  qcId: number;
  qcNo: string;
  qcDate: string;
  grnId: number;
  grnNo: string;
  warehouseId: number;
  warehouseName: string;
  vendorId: number;
  vendorName: string;
  overallResult: string;
}

export interface StorageBinOption {
  binId: number;
  binCode: string;
  binName: string;
  zoneCode: string;
  rackCode: string;
  shelfLevel: string;
  binPosition: string;
  binType: string;
  isReceivingStaging: boolean;
  isBlockedForPutaway: boolean;
}

export interface OperatorOption {
  userId: number;
  username: string;
  fullName: string;
  email: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const PutAwayMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters state
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Drawers state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<PutAwayHeaderRecord | null>(null);

  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [assignTaskId, setAssignTaskId] = useState<number | null>(null);
  const [selectedOperatorId, setSelectedOperatorId] = useState<number | ''>('');
  const [assignRemarks, setAssignRemarks] = useState('');

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [confirmTask, setConfirmTask] = useState<PutAwayHeaderRecord | null>(null);
  const [confirmRemarks, setConfirmRemarks] = useState('');
  const [confirmItemBins, setConfirmItemBins] = useState<Record<number, number>>({});
  const [confirmItemQtys, setConfirmItemQtys] = useState<Record<number, number>>({});

  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelTaskId, setCancelTaskId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printTask, setPrintTask] = useState<PutAwayHeaderRecord | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PutAwayHeaderRecord | null>(null);
  const [deleteConflicts, setDeleteConflicts] = useState<DependencyConflictItem[]>([]);

  // Form inputs state
  const [formWarehouseId, setFormWarehouseId] = useState<number | ''>('');
  const [formPutawayType, setFormPutawayType] = useState<PutAwayType>('GRN_INWARD');
  const [formPutawayDate, setFormPutawayDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [formGrnId, setFormGrnId] = useState<number | null>(null);
  const [formQcId, setFormQcId] = useState<number | null>(null);
  const [formAssignedTo, setFormAssignedTo] = useState<number | ''>('');
  const [formRemarks, setFormRemarks] = useState('');
  const [formItems, setFormItems] = useState<PutAwayItemRecord[]>([]);

  // --------------------------------------------------------------------------
  // API Queries
  // --------------------------------------------------------------------------

  const { data: summary } = useQuery<PutAwaySummary>({
    queryKey: ['putaway-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PutAwaySummary>>(
        '/inventory/put-away/summary',
      );
      return res.data.data;
    },
  });

  const { data: tasks = [], isLoading: isTasksLoading } = useQuery<PutAwayHeaderRecord[]>({
    queryKey: ['putaway-tasks', statusFilter, typeFilter, warehouseFilter, searchQuery],
    queryFn: async () => {
      const params: Record<string, any> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (typeFilter !== 'ALL') params.putawayType = typeFilter;
      if (warehouseFilter !== 'ALL') params.warehouseId = Number(warehouseFilter);
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await apiClient.get<ApiResponse<PutAwayHeaderRecord[]>>(
        '/inventory/put-away',
        { params },
      );
      return res.data.data || [];
    },
  });

  const { data: pendingQcList = [] } = useQuery<PendingQcOption[]>({
    queryKey: ['putaway-pending-qc'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PendingQcOption[]>>(
        '/inventory/put-away/pending-qc',
      );
      return res.data.data || [];
    },
  });

  const { data: operators = [] } = useQuery<OperatorOption[]>({
    queryKey: ['putaway-operators'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<OperatorOption[]>>(
        '/inventory/put-away/operators',
      );
      return res.data.data || [];
    },
  });

  const activeWarehouseIdForBins = formWarehouseId || (confirmTask ? confirmTask.warehouseId : null);
  const { data: storageBins = [] } = useQuery<StorageBinOption[]>({
    queryKey: ['putaway-storage-bins', activeWarehouseIdForBins],
    queryFn: async () => {
      if (!activeWarehouseIdForBins) return [];
      const res = await apiClient.get<ApiResponse<StorageBinOption[]>>(
        `/inventory/put-away/storage-bins/${activeWarehouseIdForBins}`,
      );
      return res.data.data || [];
    },
    enabled: Boolean(activeWarehouseIdForBins),
  });

  // Extract unique warehouses for filter
  const warehouseOptions = useMemo(() => {
    const map = new Map<number, string>();
    tasks.forEach((t) => {
      if (t.warehouseId && t.warehouseName) {
        map.set(t.warehouseId, t.warehouseName);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingId) {
        return apiClient.put(`/inventory/put-away/${editingId}`, payload);
      }
      return apiClient.post('/inventory/put-away', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['putaway-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['putaway-summary'] });
      setIsFormOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to save put-away task');
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ taskId, operatorId, remarks }: { taskId: number; operatorId: number; remarks?: string }) => {
      return apiClient.post(`/inventory/put-away/${taskId}/assign`, {
        assignedTo: operatorId,
        remarks,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['putaway-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['putaway-summary'] });
      setIsAssignModalOpen(false);
      setAssignTaskId(null);
      setSelectedOperatorId('');
      setAssignRemarks('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to assign operator');
    },
  });

  const startMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return apiClient.post(`/inventory/put-away/${taskId}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['putaway-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['putaway-summary'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to start task');
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async ({
      taskId,
      remarks,
      items,
    }: {
      taskId: number;
      remarks?: string;
      items?: Array<{ putawayItemId: number; destinationBinId: number; putawayQty: number }>;
    }) => {
      return apiClient.post(`/inventory/put-away/${taskId}/confirm`, {
        remarks,
        items,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['putaway-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['putaway-summary'] });
      setIsConfirmModalOpen(false);
      setConfirmTask(null);
      setConfirmRemarks('');
      setConfirmItemBins({});
      setConfirmItemQtys({});
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to confirm put-away and post stock');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ taskId, reason }: { taskId: number; reason: string }) => {
      return apiClient.post(`/inventory/put-away/${taskId}/cancel`, { cancelReason: reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['putaway-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['putaway-summary'] });
      setIsCancelModalOpen(false);
      setCancelTaskId(null);
      setCancelReason('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to cancel put-away task');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (taskId: number) => {
      return apiClient.delete(`/inventory/put-away/${taskId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['putaway-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['putaway-summary'] });
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to delete task');
    },
  });

  // --------------------------------------------------------------------------
  // Form & Workflow Handlers
  // --------------------------------------------------------------------------

  const resetForm = () => {
    setEditingId(null);
    setFormWarehouseId('');
    setFormPutawayType('GRN_INWARD');
    setFormPutawayDate(new Date().toISOString().split('T')[0]);
    setFormGrnId(null);
    setFormQcId(null);
    setFormAssignedTo('');
    setFormRemarks('');
    setFormItems([]);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleOpenEdit = async (task: PutAwayHeaderRecord) => {
    setEditingId(task.putawayId);
    setFormWarehouseId(task.warehouseId);
    setFormPutawayType(task.putawayType);
    setFormPutawayDate(task.putawayDate);
    setFormGrnId(task.grnId || null);
    setFormQcId(task.qcId || null);
    setFormAssignedTo(task.assignedTo || '');
    setFormRemarks(task.remarks || '');

    // Fetch full task details with items
    const res = await apiClient.get<ApiResponse<PutAwayHeaderRecord>>(
      `/inventory/put-away/${task.putawayId}`,
    );
    setFormItems(res.data.data.items || []);
    setIsFormOpen(true);
  };

  const handleSelectPendingQc = async (qcId: number) => {
    const selectedQc = pendingQcList.find((q) => q.qcId === qcId);
    if (!selectedQc) return;

    setFormQcId(selectedQc.qcId);
    setFormGrnId(selectedQc.grnId);
    setFormWarehouseId(selectedQc.warehouseId);
    setFormPutawayType('QC_RELEASE');

    const res = await apiClient.get<ApiResponse<any[]>>(
      `/inventory/put-away/qc-items/${qcId}`,
    );
    const loadedItems: PutAwayItemRecord[] = res.data.data.map((qi: any) => ({
      grnItemId: qi.grnItemId,
      qcItemId: qi.qcItemId,
      itemId: qi.itemId,
      itemCode: qi.itemCode,
      itemName: qi.itemName,
      uomId: qi.uomId,
      uomCode: qi.uomCode,
      sourceBinId: qi.sourceBinId,
      sourceBinCode: qi.sourceBinCode,
      destinationBinId: qi.destinationBinId || (storageBins[0]?.binId || 0),
      destinationBinCode: qi.destinationBinCode,
      allocatedQty: qi.allocatedQty,
      putawayQty: qi.putawayQty || qi.allocatedQty,
      batchNo: qi.batchNo,
      heatNo: qi.heatNo,
      status: 'PENDING',
    }));

    setFormItems(loadedItems);
  };

  const handleOpenConfirm = async (task: PutAwayHeaderRecord) => {
    const res = await apiClient.get<ApiResponse<PutAwayHeaderRecord>>(
      `/inventory/put-away/${task.putawayId}`,
    );
    const fullTask = res.data.data;
    setConfirmTask(fullTask);

    const initialBins: Record<number, number> = {};
    const initialQtys: Record<number, number> = {};
    fullTask.items?.forEach((it) => {
      if (it.putawayItemId) {
        initialBins[it.putawayItemId] = it.destinationBinId;
        initialQtys[it.putawayItemId] = it.putawayQty || it.allocatedQty;
      }
    });
    setConfirmItemBins(initialBins);
    setConfirmItemQtys(initialQtys);
    setConfirmRemarks('');
    setIsConfirmModalOpen(true);
  };

  const handleOpenDetails = async (task: PutAwayHeaderRecord) => {
    const res = await apiClient.get<ApiResponse<PutAwayHeaderRecord>>(
      `/inventory/put-away/${task.putawayId}`,
    );
    setSelectedTask(res.data.data);
    setIsDetailsOpen(true);
  };

  const handleOpenPrint = async (task: PutAwayHeaderRecord) => {
    const res = await apiClient.get<ApiResponse<PutAwayHeaderRecord>>(
      `/inventory/put-away/${task.putawayId}`,
    );
    setPrintTask(res.data.data);
    setIsPrintModalOpen(true);

    // Audit log PRINT action
    await apiClient.post('/inventory/put-away/actions/log', {
      actionType: 'PRINT',
      recordId: task.putawayId,
      details: { putawayNo: task.putawayNo },
    });
  };

  const handleOpenAssign = (task: PutAwayHeaderRecord) => {
    setAssignTaskId(task.putawayId);
    setSelectedOperatorId(task.assignedTo || '');
    setAssignRemarks('');
    setIsAssignModalOpen(true);
  };

  const handleOpenCancel = (task: PutAwayHeaderRecord) => {
    setCancelTaskId(task.putawayId);
    setCancelReason('');
    setIsCancelModalOpen(true);
  };

  const handleOpenDelete = (task: PutAwayHeaderRecord) => {
    setDeleteTarget(task);
    setDeleteConflicts([]);
    setIsDeleteModalOpen(true);
  };

  // --------------------------------------------------------------------------
  // Table Columns Definition
  // --------------------------------------------------------------------------

  const columns: MasterTableColumn<PutAwayHeaderRecord>[] = [
    {
      key: 'putawayNo',
      header: 'Put-Away Task',
      render: (row) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[var(--text-primary)] hover:text-[var(--brand-600)] cursor-pointer" onClick={() => handleOpenDetails(row)}>
              {row.putawayNo}
            </span>
            <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-subtle)]">
              {row.putawayType}
            </span>
          </div>
          <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
            <Calendar className="w-3 h-3" /> {row.putawayDate}
          </span>
        </div>
      ),
    },
    {
      key: 'grnNo',
      header: 'Source Inward Reference',
      render: (row) => (
        <div className="flex flex-col text-xs">
          {row.qcNo ? (
            <span className="font-medium text-[var(--text-primary)] flex items-center gap-1">
              <FileCheck2 className="w-3.5 h-3.5 text-emerald-500" /> {row.qcNo}
            </span>
          ) : null}
          {row.grnNo ? (
            <span className="text-[11px] text-[var(--text-muted)] flex items-center gap-1">
              <Package className="w-3 h-3 text-blue-500" /> GRN: {row.grnNo}
            </span>
          ) : (
            <span className="text-[11px] text-[var(--text-muted)] italic">Direct Warehouse Task</span>
          )}
        </div>
      ),
    },
    {
      key: 'warehouseName',
      header: 'Facility & Storage Bay',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-xs text-[var(--text-primary)] flex items-center gap-1">
            <Warehouse className="w-3.5 h-3.5 text-[var(--brand-500)]" /> {row.warehouseName}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">Code: {row.warehouseCode}</span>
        </div>
      ),
    },
    {
      key: 'assignedToName',
      header: 'Assigned Operator',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs">
          <User className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span className={row.assignedToName ? 'text-[var(--text-primary)] font-medium' : 'text-amber-500 italic'}>
            {row.assignedToName || 'Unassigned'}
          </span>
        </div>
      ),
    },
    {
      key: 'totalQty',
      header: 'Items & Put-Away Qty',
      render: (row) => (
        <div className="flex flex-col text-xs">
          <span className="font-bold text-[var(--text-primary)]">
            {Number(row.totalQty).toLocaleString('en-IN', { maximumFractionDigits: 3 })}
          </span>
          <span className="text-[11px] text-[var(--text-muted)]">
            {row.totalItems} {row.totalItems === 1 ? 'line item' : 'line items'}
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const badgeColors: Record<PutAwayStatus, string> = {
          DRAFT: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
          ASSIGNED: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800',
          IN_PROGRESS: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          COMPLETED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          CANCELLED: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800',
        };

        return (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
              badgeColors[row.status] || badgeColors.DRAFT
            }`}
          >
            {row.status.replace('_', ' ')}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="p-1 text-[var(--text-muted)] hover:text-[var(--brand-600)] transition-colors"
            title="View Details"
            onClick={() => handleOpenDetails(row)}
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            type="button"
            className="p-1 text-[var(--text-muted)] hover:text-emerald-600 transition-colors"
            title="Print Task Voucher"
            onClick={() => handleOpenPrint(row)}
          >
            <Printer className="w-4 h-4" />
          </button>

          {['DRAFT', 'ASSIGNED'].includes(row.status) && (
            <PermissionGate screen="BIN_PUTAWAY" action="ASSIGN">
              <button
                type="button"
                className="p-1 text-[var(--text-muted)] hover:text-blue-600 transition-colors"
                title="Assign Operator"
                onClick={() => handleOpenAssign(row)}
              >
                <UserCheck className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {row.status === 'ASSIGNED' && (
            <PermissionGate screen="BIN_PUTAWAY" action="EDIT">
              <button
                type="button"
                className="p-1 text-[var(--text-muted)] hover:text-amber-600 transition-colors"
                title="Start Put-Away"
                onClick={() => startMutation.mutate(row.putawayId)}
              >
                <Play className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {['ASSIGNED', 'IN_PROGRESS', 'DRAFT'].includes(row.status) && (
            <PermissionGate screen="BIN_PUTAWAY" action="CONFIRM">
              <button
                type="button"
                className="p-1 text-[var(--text-muted)] hover:text-emerald-600 transition-colors"
                title="Confirm & Post Stock"
                onClick={() => handleOpenConfirm(row)}
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {['DRAFT', 'ASSIGNED'].includes(row.status) && (
            <PermissionGate screen="BIN_PUTAWAY" action="EDIT">
              <button
                type="button"
                className="p-1 text-[var(--text-muted)] hover:text-[var(--brand-600)] transition-colors"
                title="Edit Task"
                onClick={() => handleOpenEdit(row)}
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {row.status !== 'COMPLETED' && row.status !== 'CANCELLED' && (
            <PermissionGate screen="BIN_PUTAWAY" action="CANCEL">
              <button
                type="button"
                className="p-1 text-[var(--text-muted)] hover:text-rose-600 transition-colors"
                title="Cancel Task"
                onClick={() => handleOpenCancel(row)}
              >
                <XCircle className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {row.status === 'DRAFT' && (
            <PermissionGate screen="BIN_PUTAWAY" action="DELETE">
              <button
                type="button"
                className="p-1 text-[var(--text-muted)] hover:text-rose-600 transition-colors"
                title="Delete Draft Task"
                onClick={() => handleOpenDelete(row)}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}
        </div>
      ),
    },
  ];

  const groupByOptions: GroupByOption<PutAwayHeaderRecord>[] = [
    {
      key: 'status',
      label: 'Status',
      groupValue: (row) => row.status,
    },
    {
      key: 'warehouseName',
      label: 'Warehouse',
      groupValue: (row) => row.warehouseName,
    },
    {
      key: 'putawayType',
      label: 'Put-Away Type',
      groupValue: (row) => row.putawayType,
    },
    {
      key: 'assignedToName',
      label: 'Assigned Operator',
      groupValue: (row) => row.assignedToName || 'Unassigned',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Metrics Header */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Total Put-Away Tasks
            </p>
            <p className="text-2xl font-black text-[var(--text-primary)] mt-1">
              {summary?.totalTasks || 0}
            </p>
            <span className="text-[11px] text-[var(--text-muted)] mt-0.5 block">
              Cumulative store movements
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Pending Assignment
            </p>
            <p className="text-2xl font-black text-amber-600 mt-1">
              {summary?.pendingCount || 0}
            </p>
            <span className="text-[11px] text-[var(--text-muted)] mt-0.5 block">
              Awaiting operator dispatch
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 flex items-center justify-center">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              In-Progress Moves
            </p>
            <p className="text-2xl font-black text-blue-600 mt-1">
              {summary?.inProgressCount || 0}
            </p>
            <span className="text-[11px] text-[var(--text-muted)] mt-0.5 block">
              Forklift & bay staging active
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 flex items-center justify-center">
            <RefreshCw className="w-6 h-6" />
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
              Completed & Stock Posted
            </p>
            <p className="text-2xl font-black text-emerald-600 mt-1">
              {summary?.completedCount || 0}
            </p>
            <span className="text-[11px] text-[var(--text-muted)] mt-0.5 block">
              On-hand ledger balances posted
            </span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs">
        {/* Custom Toolbar Filters */}
        <div className="p-4 border-b border-[var(--border-subtle)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-[var(--text-muted)] flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5" /> Filters:
            </span>

            {/* Status Pills */}
            {['ALL', 'DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((st) => (
              <button
                key={st}
                type="button"
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  statusFilter === st
                    ? 'bg-[var(--brand-600)] text-white shadow-xs'
                    : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-muted)]'
                }`}
                onClick={() => setStatusFilter(st)}
              >
                {st.replace('_', ' ')}
              </button>
            ))}

            {/* Warehouse Filter */}
            <select
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)] ml-2"
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
            >
              <option value="ALL">All Warehouses</option>
              {warehouseOptions.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <PermissionGate screen="BIN_PUTAWAY" action="ADD">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[var(--brand-700)] transition-colors"
                onClick={handleOpenCreate}
              >
                <Plus className="w-4 h-4" /> + Create Put-Away Task
              </button>
            </PermissionGate>
          </div>
        </div>

        {/* Master Table */}
        <MasterDataTable<PutAwayHeaderRecord>
          title="Warehouse Put-Away & Bin Allocation"
          subtitle="Track physical material movement from receiving quarantine bays into permanent warehouse storage bins and post real-time stock ledger"
          screenCode="BIN_PUTAWAY"
          tableNameBadge="WMS Execution"
          rowKey={(row) => row.putawayId}
          columns={columns}
          data={tasks}
          isLoading={isTasksLoading}
          groupByOptions={groupByOptions}
          searchPredicate={(row, term) => {
            const t = term.toLowerCase();
            return Boolean(
              row.putawayNo?.toLowerCase().includes(t) ||
                row.warehouseName?.toLowerCase().includes(t) ||
                row.grnNo?.toLowerCase().includes(t) ||
                row.qcNo?.toLowerCase().includes(t) ||
                row.assignedToName?.toLowerCase().includes(t),
            );
          }}
        />
      </div>

      {/* ==================================================================== */}
      {/* MODAL 1: Create / Edit Put-Away Task */}
      {/* ==================================================================== */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-[var(--text-primary)]">
                  {editingId ? 'Edit Put-Away Task' : 'Create Warehouse Put-Away Task'}
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Allocate accepted materials from receiving docks into target storage bins.
                </p>
              </div>
              <button
                type="button"
                className="p-1 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] transition-colors"
                onClick={() => setIsFormOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sourcing Accelerator: Import from QC Inspection */}
            {!editingId && (
              <div className="rounded-xl border border-[var(--brand-200)] dark:border-[var(--brand-800)] bg-[var(--brand-50)]/50 dark:bg-[var(--brand-900)]/10 p-4 space-y-2">
                <span className="text-xs font-bold text-[var(--brand-700)] dark:text-[var(--brand-300)] flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4" /> 1-Click Import from Approved QC Lab Inspection
                </span>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Automatically extracts cleared materials, quantities, heat numbers, and target rack bins from QC Inspection certificates.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <select
                    className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)]"
                    onChange={(e) => {
                      if (e.target.value) handleSelectPendingQc(Number(e.target.value));
                    }}
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Select an Approved QC Inspection Certificate...
                    </option>
                    {pendingQcList.map((q) => (
                      <option key={q.qcId} value={q.qcId}>
                        {q.qcNo} — {q.vendorName} ({q.warehouseName}) [GRN: {q.grnNo}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Header Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Destination Warehouse *
                </label>
                <select
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)]"
                  value={formWarehouseId}
                  onChange={(e) => setFormWarehouseId(Number(e.target.value))}
                >
                  <option value="" disabled>Select Warehouse...</option>
                  {warehouseOptions.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Put-Away Type
                </label>
                <select
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)]"
                  value={formPutawayType}
                  onChange={(e) => setFormPutawayType(e.target.value as PutAwayType)}
                >
                  <option value="QC_RELEASE">QC Inspection Release (Standard)</option>
                  <option value="GRN_INWARD">Direct GRN Inward</option>
                  <option value="INTERNAL_TRANSFER">Internal Bay Relocation</option>
                  <option value="REWORK_RETURN">Reworked Stock Return</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Task Date
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)]"
                  value={formPutawayDate}
                  onChange={(e) => setFormPutawayDate(e.target.value)}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Assign Forklift / Store Operator
                </label>
                <select
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)]"
                  value={formAssignedTo}
                  onChange={(e) => setFormAssignedTo(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">Leave Unassigned (Pending Dispatch)</option>
                  {operators.map((op) => (
                    <option key={op.userId} value={op.userId}>
                      {op.fullName} ({op.username})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                  Move Instructions / Operator Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Move from quarantine bay to cantilever bar rack A1 using 3-ton forklift."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)]"
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                />
              </div>
            </div>

            {/* Line Items Table */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                  Material Lines to Put Away ({formItems.length})
                </h4>
              </div>

              {formItems.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border-subtle)] p-6 text-center text-xs text-[var(--text-muted)]">
                  No line items loaded. Select an approved QC Inspection above to import materials.
                </div>
              ) : (
                <div className="rounded-xl border border-[var(--border-subtle)] overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--bg-subtle)] text-[var(--text-muted)] font-semibold border-b border-[var(--border-subtle)]">
                      <tr>
                        <th className="p-3">Item Details</th>
                        <th className="p-3">Batch / Heat #</th>
                        <th className="p-3">Source Bay</th>
                        <th className="p-3">Target Storage Bin *</th>
                        <th className="p-3 text-right">Allocated Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {formItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-[var(--bg-subtle)]/30">
                          <td className="p-3">
                            <span className="font-semibold text-[var(--text-primary)] block">
                              {item.itemName || `Item #${item.itemId}`}
                            </span>
                            <span className="text-[10px] text-[var(--text-muted)]">
                              Code: {item.itemCode} | UOM: {item.uomCode}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className="font-mono-code text-[11px] text-[var(--text-primary)] block">
                              {item.batchNo || 'N/A'}
                            </span>
                            {item.heatNo && (
                              <span className="text-[10px] text-[var(--text-muted)] block">
                                Heat: {item.heatNo}
                              </span>
                            )}
                          </td>
                          <td className="p-3 text-[var(--text-muted)]">
                            {item.sourceBinCode || 'Receiving Staging Bay'}
                          </td>
                          <td className="p-3">
                            <select
                              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)]"
                              value={item.destinationBinId}
                              onChange={(e) => {
                                const newId = Number(e.target.value);
                                const updated = [...formItems];
                                updated[idx].destinationBinId = newId;
                                setFormItems(updated);
                              }}
                            >
                              {storageBins.map((b) => (
                                <option key={b.binId} value={b.binId}>
                                  {b.binCode} — {b.binName}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3 text-right">
                            <input
                              type="number"
                              step="0.001"
                              className="w-24 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-right font-bold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)]"
                              value={item.allocatedQty}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                const updated = [...formItems];
                                updated[idx].allocatedQty = val;
                                updated[idx].putawayQty = val;
                                setFormItems(updated);
                              }}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-[var(--border-subtle)] pt-4">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] transition-colors"
                onClick={() => setIsFormOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveMutation.isPending || formItems.length === 0 || !formWarehouseId}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[var(--brand-700)] disabled:opacity-50 transition-colors"
                onClick={() => {
                  const payload = {
                    warehouseId: Number(formWarehouseId),
                    putawayType: formPutawayType,
                    putawayDate: formPutawayDate,
                    grnId: formGrnId,
                    qcId: formQcId,
                    assignedTo: formAssignedTo ? Number(formAssignedTo) : undefined,
                    remarks: formRemarks,
                    items: formItems.map((it) => ({
                      grnItemId: it.grnItemId,
                      qcItemId: it.qcItemId,
                      itemId: it.itemId,
                      itemDescription: it.itemDescription,
                      uomId: it.uomId,
                      sourceBinId: it.sourceBinId,
                      destinationBinId: it.destinationBinId,
                      allocatedQty: it.allocatedQty,
                      putawayQty: it.allocatedQty,
                      batchNo: it.batchNo,
                      heatNo: it.heatNo,
                      mfgDate: it.mfgDate,
                      expiryDate: it.expiryDate,
                      remarks: it.remarks,
                    })),
                  };
                  saveMutation.mutate(payload);
                }}
              >
                {saveMutation.isPending ? 'Saving Task...' : editingId ? 'Update Put-Away Task' : 'Save Put-Away Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: Assign Operator */}
      {/* ==================================================================== */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-600" /> Dispatch Put-Away Task
              </h3>
              <button
                type="button"
                className="p-1 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
                onClick={() => setIsAssignModalOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              Assign this material relocation task to an active forklift operator or storekeeper.
            </p>

            <div>
              <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                Select Store / Forklift Operator *
              </label>
              <select
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)]"
                value={selectedOperatorId}
                onChange={(e) => setSelectedOperatorId(Number(e.target.value))}
              >
                <option value="" disabled>Choose an operator...</option>
                {operators.map((op) => (
                  <option key={op.userId} value={op.userId}>
                    {op.fullName} ({op.username})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                Dispatch Remarks / Bay Instructions
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Use 3-ton crane; stack pallets no higher than 2 tiers in aisle 4."
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)]"
                value={assignRemarks}
                onChange={(e) => setAssignRemarks(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] pt-3">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
                onClick={() => setIsAssignModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={assignMutation.isPending || !selectedOperatorId}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50"
                onClick={() => {
                  if (assignTaskId && selectedOperatorId) {
                    assignMutation.mutate({
                      taskId: assignTaskId,
                      operatorId: Number(selectedOperatorId),
                      remarks: assignRemarks,
                    });
                  }
                }}
              >
                {assignMutation.isPending ? 'Assigning...' : 'Dispatch Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: Confirm Put-Away & Post Stock */}
      {/* ==================================================================== */}
      {isConfirmModalOpen && confirmTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Confirm Physical Put-Away & Post Stock Ledger
              </h3>
              <button
                type="button"
                className="p-1 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
                onClick={() => setIsConfirmModalOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/10 p-3 text-xs text-emerald-800 dark:text-emerald-300">
              <strong>Stock Ledger Posting Notice:</strong> Confirming this put-away will atomically update the live on-hand balance in <code>tbl_inv_bin_stock</code> and insert permanent audit records into <code>tbl_inv_stock_ledger</code> for Task #{confirmTask.putawayNo}.
            </div>

            {/* Line items verification */}
            <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--bg-subtle)] text-[var(--text-muted)] font-semibold border-b border-[var(--border-subtle)]">
                  <tr>
                    <th className="p-3">Material & Batch</th>
                    <th className="p-3">Source Bay</th>
                    <th className="p-3">Destination Storage Bin</th>
                    <th className="p-3 text-right">Confirmed Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {confirmTask.items?.map((item) => (
                    <tr key={item.putawayItemId} className="hover:bg-[var(--bg-subtle)]/30">
                      <td className="p-3">
                        <span className="font-semibold text-[var(--text-primary)] block">
                          {item.itemName}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                          Batch: {item.batchNo || 'N/A'} {item.heatNo ? `| Heat: ${item.heatNo}` : ''}
                        </span>
                      </td>
                      <td className="p-3 text-[var(--text-muted)]">
                        {item.sourceBinCode || 'Quarantine Cage'}
                      </td>
                      <td className="p-3">
                        <select
                          className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)]"
                          value={item.putawayItemId ? confirmItemBins[item.putawayItemId] : item.destinationBinId}
                          onChange={(e) => {
                            if (item.putawayItemId) {
                              setConfirmItemBins({
                                ...confirmItemBins,
                                [item.putawayItemId]: Number(e.target.value),
                              });
                            }
                          }}
                        >
                          {storageBins.map((b) => (
                            <option key={b.binId} value={b.binId}>
                              {b.binCode} — {b.binName}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3 text-right">
                        <input
                          type="number"
                          step="0.001"
                          className="w-24 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-right font-bold text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)]"
                          value={item.putawayItemId ? confirmItemQtys[item.putawayItemId] : item.putawayQty}
                          onChange={(e) => {
                            if (item.putawayItemId) {
                              setConfirmItemQtys({
                                ...confirmItemQtys,
                                [item.putawayItemId]: Number(e.target.value),
                              });
                            }
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                Completion Remarks & Verification Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Verified weight and barcode tags; bin capacity verified."
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)]"
                value={confirmRemarks}
                onChange={(e) => setConfirmRemarks(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] pt-3">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
                onClick={() => setIsConfirmModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmMutation.isPending}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50"
                onClick={() => {
                  const itemsPayload = confirmTask.items?.map((it) => ({
                    putawayItemId: it.putawayItemId!,
                    destinationBinId: confirmItemBins[it.putawayItemId!] || it.destinationBinId,
                    putawayQty: confirmItemQtys[it.putawayItemId!] || it.allocatedQty,
                  }));
                  confirmMutation.mutate({
                    taskId: confirmTask.putawayId,
                    remarks: confirmRemarks,
                    items: itemsPayload,
                  });
                }}
              >
                {confirmMutation.isPending ? 'Posting Stock...' : 'Confirm Put-Away & Post Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: Cancel Put-Away Task */}
      {/* ==================================================================== */}
      {isCancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <h3 className="text-base font-extrabold text-rose-600 flex items-center gap-2">
                <XCircle className="w-5 h-5" /> Void Put-Away Task
              </h3>
              <button
                type="button"
                className="p-1 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
                onClick={() => setIsCancelModalOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-muted)]">
              Provide a mandatory reason for cancelling this warehouse put-away order.
            </p>

            <div>
              <label className="text-xs font-semibold text-[var(--text-primary)] block mb-1">
                Cancellation Reason *
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Target racking undergoing preventive maintenance; reallocation required."
                className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-500)]"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] pt-3">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
                onClick={() => setIsCancelModalOpen(false)}
              >
                Back
              </button>
              <button
                type="button"
                disabled={cancelMutation.isPending || !cancelReason.trim()}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50"
                onClick={() => {
                  if (cancelTaskId && cancelReason.trim()) {
                    cancelMutation.mutate({
                      taskId: cancelTaskId,
                      reason: cancelReason.trim(),
                    });
                  }
                }}
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Void Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* DRAWER: Task Details & Traceability */}
      {/* ==================================================================== */}
      {isDetailsOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] p-6 shadow-2xl overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div>
                <h3 className="text-lg font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[var(--brand-600)]" /> {selectedTask.putawayNo}
                </h3>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  Put-Away Task & Inventory Allocation Traceability
                </p>
              </div>
              <button
                type="button"
                className="p-1 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
                onClick={() => setIsDetailsOpen(false)}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Header Details Card */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-[var(--bg-subtle)]/50 p-4 rounded-xl border border-[var(--border-subtle)]">
              <div>
                <span className="text-[var(--text-muted)] block text-[10px]">Status:</span>
                <span className="font-bold text-[var(--text-primary)]">{selectedTask.status}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-[10px]">Put-Away Type:</span>
                <span className="font-semibold text-[var(--text-primary)]">{selectedTask.putawayType}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-[10px]">Warehouse:</span>
                <span className="font-semibold text-[var(--text-primary)]">{selectedTask.warehouseName}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-[10px]">Task Date:</span>
                <span className="font-semibold text-[var(--text-primary)]">{selectedTask.putawayDate}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-[10px]">Source QC / GRN:</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {selectedTask.qcNo ? `QC: ${selectedTask.qcNo}` : ''} {selectedTask.grnNo ? `| GRN: ${selectedTask.grnNo}` : ''}
                </span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block text-[10px]">Assigned Operator:</span>
                <span className="font-semibold text-[var(--text-primary)]">
                  {selectedTask.assignedToName || 'Unassigned'}
                </span>
              </div>
              {selectedTask.completedDate && (
                <div className="col-span-2">
                  <span className="text-[var(--text-muted)] block text-[10px]">Completed On:</span>
                  <span className="font-semibold text-emerald-600">
                    {selectedTask.completedDate} by {selectedTask.completedByName}
                  </span>
                </div>
              )}
            </div>

            {/* Line items list with bin routing */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Material Line Routing ({selectedTask.items?.length || 0})
              </h4>
              <div className="space-y-2">
                {selectedTask.items?.map((it) => (
                  <div
                    key={it.putawayItemId}
                    className="p-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--text-primary)]">
                        {it.itemName} ({it.itemCode})
                      </span>
                      <span className="font-mono-code font-bold text-[var(--brand-600)]">
                        {it.putawayQty || it.allocatedQty} {it.uomCode}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] bg-[var(--bg-subtle)] p-2 rounded-lg">
                      <span className="text-[var(--text-muted)]">From:</span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {it.sourceBinCode || 'Quarantine Cage'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--brand-500)]" />
                      <span className="text-[var(--text-muted)]">To:</span>
                      <span className="font-bold text-emerald-600">
                        {it.destinationBinCode} ({it.destinationBinName})
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[10px] text-[var(--text-muted)]">
                      <span>Batch: <strong className="text-[var(--text-primary)]">{it.batchNo || 'N/A'}</strong></span>
                      {it.heatNo && <span>Heat: <strong className="text-[var(--text-primary)]">{it.heatNo}</strong></span>}
                      <span>Status: <strong className="text-[var(--text-primary)]">{it.status}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                className="rounded-xl px-4 py-2 text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
                onClick={() => setIsDetailsOpen(false)}
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: Printable Put-Away Voucher / Transfer Pass (@media print) */}
      {/* ==================================================================== */}
      {isPrintModalOpen && printTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6 shadow-xl max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3 print:hidden">
              <h3 className="text-base font-extrabold text-[var(--text-primary)] flex items-center gap-2">
                <Printer className="w-5 h-5 text-[var(--brand-600)]" /> Official Put-Away Voucher & Stock Transfer Slip
              </h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-xl bg-[var(--brand-600)] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-[var(--brand-700)]"
                  onClick={() => window.print()}
                >
                  Print Voucher
                </button>
                <button
                  type="button"
                  className="p-1 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
                  onClick={() => setIsPrintModalOpen(false)}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="p-8 border border-[var(--border-subtle)] rounded-xl bg-white text-slate-900 space-y-6 print:border-none print:p-0">
              {/* Corporate Header */}
              <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                <div>
                  <h2 className="text-xl font-black tracking-tight text-slate-900">
                    KASHVIRA INFOTECH MANUFACTURING ERP
                  </h2>
                  <p className="text-xs text-slate-600">
                    Precision Discrete & Process Engineering Unit • CIN: U72900GJ2026PTC109821
                  </p>
                  <p className="text-xs text-slate-600">
                    GSTIN: 24AAACK9812K1Z9 • Plant Warehouse: {printTask.warehouseName}
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block rounded-md bg-slate-900 px-3 py-1 text-xs font-bold text-white tracking-widest uppercase">
                    PUT-AWAY VOUCHER
                  </span>
                  <p className="text-sm font-mono-code font-bold mt-1 text-slate-900">
                    {printTask.putawayNo}
                  </p>
                  <p className="text-xs text-slate-500">Date: {printTask.putawayDate}</p>
                </div>
              </div>

              {/* Document Metadata Grid */}
              <div className="grid grid-cols-3 gap-4 text-xs border border-slate-200 p-4 rounded-lg bg-slate-50">
                <div>
                  <span className="text-slate-500 block text-[10px]">Put-Away Type:</span>
                  <strong className="text-slate-900">{printTask.putawayType}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Source QC Lab Pass:</span>
                  <strong className="text-slate-900">{printTask.qcNo || 'Direct Dock'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Source GRN #:</span>
                  <strong className="text-slate-900">{printTask.grnNo || 'Direct GRN'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Assigned Operator:</span>
                  <strong className="text-slate-900">{printTask.assignedToName || 'Unassigned'}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Task Status:</span>
                  <strong className="text-slate-900 uppercase">{printTask.status}</strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">Total Put-Away Qty:</span>
                  <strong className="text-slate-900 font-bold">{printTask.totalQty} Units</strong>
                </div>
              </div>

              {/* Movement Table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">#</th>
                      <th className="p-2.5">Material Description</th>
                      <th className="p-2.5">Heat / Batch #</th>
                      <th className="p-2.5">From Bay</th>
                      <th className="p-2.5">Target Storage Bin</th>
                      <th className="p-2.5 text-right">Verified Qty</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {printTask.items?.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 text-slate-500">{idx + 1}</td>
                        <td className="p-2.5">
                          <strong className="block text-slate-900">{it.itemName}</strong>
                          <span className="text-[10px] text-slate-500">
                            Code: {it.itemCode} | UOM: {it.uomCode}
                          </span>
                        </td>
                        <td className="p-2.5 font-mono-code text-[11px]">
                          {it.batchNo || 'N/A'} {it.heatNo ? `(${it.heatNo})` : ''}
                        </td>
                        <td className="p-2.5 text-slate-600">{it.sourceBinCode || 'Quarantine Staging'}</td>
                        <td className="p-2.5 font-bold text-slate-900">
                          {it.destinationBinCode}
                        </td>
                        <td className="p-2.5 text-right font-bold text-slate-900">
                          {it.putawayQty || it.allocatedQty} {it.uomCode}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Instructions / Remarks */}
              {printTask.remarks && (
                <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <strong>Special Instructions:</strong> {printTask.remarks}
                </div>
              )}

              {/* Dual Signature Blocks */}
              <div className="grid grid-cols-2 gap-8 pt-10 border-t border-slate-200 text-xs">
                <div className="text-center space-y-1">
                  <div className="border-b border-slate-400 w-48 mx-auto pb-6" />
                  <p className="font-bold text-slate-900">Forklift / Material Operator</p>
                  <p className="text-[10px] text-slate-500">Physical Stock Movement & Bin Stacking Verified</p>
                </div>
                <div className="text-center space-y-1">
                  <div className="border-b border-slate-400 w-48 mx-auto pb-6" />
                  <p className="font-bold text-slate-900">Warehouse & Stores Manager</p>
                  <p className="text-[10px] text-slate-500">Authorized Stock Ledger Posting & Bin Allocation Sign-Off</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 6: Confirm Delete Modal */}
      {/* ==================================================================== */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        entityType="Put-Away Task"
        entityName={deleteTarget?.putawayNo || ''}
        entityCode={deleteTarget?.putawayNo}
        isDeleting={deleteMutation.isPending}
        dependencies={deleteConflicts}
        onConfirm={() => {
          if (deleteTarget) {
            deleteMutation.mutate(deleteTarget.putawayId);
          }
        }}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
};
