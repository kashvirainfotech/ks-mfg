import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  Layers,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Tag,
  Timer,
  Trash2,
  TrendingUp,
  Users,
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
// TYPES & CATALOGUES
// ============================================================================

export type RoutingStatus = 'ACTIVE' | 'DRAFT' | 'UNDER_REVIEW' | 'OBSOLETE';

export interface RoutingOperation {
  routingOpId?: number;
  routingId?: number;
  opSequence: number;
  opCode: string;
  opName: string;
  workCenterId: number;
  workCenterCode?: string;
  workCenterName?: string;
  workCenterType?: string;
  machineId?: number | null;
  machineCode?: string | null;
  machineName?: string | null;
  setupTimeMins: number;
  runTimeMins: number;
  overlapPercent: number;
  machineHourlyRate: number;
  laborHourlyRate: number;
  overheadHourlyRate: number;
  totalHourlyRate: number;
  machineCostPerUnit: number;
  laborCostPerUnit: number;
  overheadCostPerUnit: number;
  totalCostPerUnit: number;
  toolingDescription?: string | null;
  fixtureNo?: string | null;
  isInspectionRequired: boolean;
  qcCheckpoints?: string | null;
  isSubcontracted: boolean;
  subcontractVendorId?: number | null;
  subcontractVendorName?: string | null;
  remarks?: string | null;
}

export interface RoutingHeader {
  routingId: number;
  routingCode: string;
  routingName: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  itemType?: string;
  uomCode?: string;
  uomName?: string;
  versionNo: string;
  status: RoutingStatus;
  isDefault: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
  batchSize: number;
  totalSetupTimeMins: number;
  totalRunTimeMins: number;
  totalLeadTimeDays: number;
  totalMachineCost: number;
  totalLaborCost: number;
  totalOverheadCost: number;
  totalCostPerUnit: number;
  approvedBy?: number | null;
  approvedByName?: string | null;
  approvedDate?: string | null;
  approvalRemarks?: string | null;
  remarks?: string | null;
  createdDate?: string;
  operationCount?: number;
  operations?: RoutingOperation[];
}

export interface RoutingSummary {
  totalRoutings: number;
  activeRoutings: number;
  distinctItems: number;
  avgCycleTimeMins: number;
  totalRoutingCost: number;
}

export interface ItemLookup {
  itemId: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  uomCode: string;
  uomName: string;
}

export interface WorkCenterLookup {
  workCenterId: number;
  workCenterCode: string;
  workCenterName: string;
  workCenterType: string;
  capacityPerDayHours: number;
  efficiencyPercent: number;
  costPerHour: number;
  labourCostPerHour: number;
  overheadCostPerHour: number;
  totalHourlyRate: number;
  status: string;
}

export interface MachineLookup {
  wcMachineId: number;
  workCenterId: number;
  machineCode: string;
  machineName: string;
  status: string;
  powerRatingKw: number;
}

export interface SubcontractVendorLookup {
  partyId: number;
  partyCode: string;
  partyName: string;
  city?: string;
}

export interface RoutingLookups {
  items: ItemLookup[];
  workCenters: WorkCenterLookup[];
  machines: MachineLookup[];
  subcontractVendors: SubcontractVendorLookup[];
}

const STATUS_BADGE_MAP: Record<RoutingStatus, { label: string; bg: string; text: string; dot: string }> = {
  ACTIVE: {
    label: 'Active (Released)',
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/20 border-emerald-500/30',
    text: 'text-emerald-700 dark:text-emerald-300',
    dot: 'bg-emerald-500',
  },
  DRAFT: {
    label: 'Draft Engineering',
    bg: 'bg-amber-500/10 dark:bg-amber-500/20 border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
  },
  UNDER_REVIEW: {
    label: 'Under Review',
    bg: 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/30',
    text: 'text-blue-700 dark:text-blue-300',
    dot: 'bg-blue-500',
  },
  OBSOLETE: {
    label: 'Obsolete / Archived',
    bg: 'bg-zinc-500/10 dark:bg-zinc-500/20 border-zinc-500/30',
    text: 'text-zinc-700 dark:text-zinc-300',
    dot: 'bg-zinc-500',
  },
};

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export const RoutingMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [itemFilter, setItemFilter] = useState<string>('');
  const [defaultOnlyFilter, setDefaultOnlyFilter] = useState<boolean>(false);

  // Modals & Panels State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingRouting, setEditingRouting] = useState<RoutingHeader | null>(null);
  const [activeTab, setActiveTab] = useState<'HEADER' | 'OPERATIONS' | 'COSTING'>('HEADER');
  const [viewingRouting, setViewingRouting] = useState<RoutingHeader | null>(null);
  const [printingRouting, setPrintingRouting] = useState<RoutingHeader | null>(null);
  const [approvingRouting, setApprovingRouting] = useState<RoutingHeader | null>(null);
  const [cloningRouting, setCloningRouting] = useState<RoutingHeader | null>(null);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<RoutingHeader | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [deleteConflicts, setDeleteConflicts] = useState<DependencyConflictItem[]>([]);

  // Feedback Notification
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  // --------------------------------------------------------------------------
  // Server Queries
  // --------------------------------------------------------------------------
  const { data: summaryData, isLoading: isSummaryLoading, refetch: refetchSummary } = useQuery<RoutingSummary>({
    queryKey: ['routing-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<RoutingSummary>>('/manufacturing/routings/summary');
      return res.data.data;
    },
  });

  const { data: lookupsData } = useQuery<RoutingLookups>({
    queryKey: ['routing-lookups'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<RoutingLookups>>('/manufacturing/routings/lookups');
      return res.data.data;
    },
  });

  const {
    data: routingList = [],
    isLoading: isListLoading,
    refetch: refetchList,
  } = useQuery<RoutingHeader[]>({
    queryKey: ['routings-list', statusFilter, itemFilter, defaultOnlyFilter],
    queryFn: async () => {
      const params: Record<string, any> = { limit: 100 };
      if (statusFilter) params.status = statusFilter;
      if (itemFilter) params.itemId = itemFilter;
      if (defaultOnlyFilter) params.isDefault = true;

      const res = await apiClient.get<ApiResponse<{ data: RoutingHeader[]; meta: any }>>(
        '/manufacturing/routings',
        { params },
      );
      return res.data.data.data;
    },
  });

  // Selected Routing Full Detail Query (for modal/timeline viewing)
  const selectedRoutingId = viewingRouting?.routingId || editingRouting?.routingId || printingRouting?.routingId;
  const { data: singleRoutingDetail } = useQuery<RoutingHeader>({
    queryKey: ['routing-detail', selectedRoutingId],
    enabled: !!selectedRoutingId,
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<RoutingHeader>>(
        `/manufacturing/routings/${selectedRoutingId}`,
      );
      return res.data.data;
    },
  });

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------
  const deleteMutation = useMutation({
    mutationFn: async (routingId: number) => {
      return apiClient.delete(`/manufacturing/routings/${routingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routings-list'] });
      queryClient.invalidateQueries({ queryKey: ['routing-summary'] });
      setIsDeleteModalOpen(false);
      setDeleteTarget(null);
      showFeedback('success', 'Production routing deleted successfully.');
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to delete routing.';
      setDeleteErrorMessage(msg);
      setDeleteConflicts([
        {
          table: 'tbl_mfg_bom_header',
          label: 'Linked Bill of Materials (BOM)',
          count: 1,
        },
      ]);
      showFeedback('error', msg);
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({
      id,
      approvalRemarks,
      setAsDefault,
      syncToBom,
    }: {
      id: number;
      approvalRemarks?: string;
      setAsDefault?: boolean;
      syncToBom?: boolean;
    }) => {
      return apiClient.post(`/manufacturing/routings/${id}/approve`, {
        approvalRemarks,
        setAsDefault,
        syncToBom,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routings-list'] });
      queryClient.invalidateQueries({ queryKey: ['routing-summary'] });
      setApprovingRouting(null);
      showFeedback('success', 'Routing approved, released, and synced to default BOM.');
    },
    onError: (err: any) => {
      showFeedback('error', err?.response?.data?.message || 'Approval failed.');
    },
  });

  const cloneMutation = useMutation({
    mutationFn: async ({
      id,
      newVersionNo,
      newRoutingName,
      copyOperations,
    }: {
      id: number;
      newVersionNo: string;
      newRoutingName?: string;
      copyOperations?: boolean;
    }) => {
      return apiClient.post(`/manufacturing/routings/${id}/clone`, {
        newVersionNo,
        newRoutingName,
        copyOperations,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routings-list'] });
      queryClient.invalidateQueries({ queryKey: ['routing-summary'] });
      setCloningRouting(null);
      showFeedback('success', 'Routing successfully cloned to new revision draft.');
    },
    onError: (err: any) => {
      showFeedback('error', err?.response?.data?.message || 'Clone failed.');
    },
  });

  // --------------------------------------------------------------------------
  // Form State for Create / Edit Modal
  // --------------------------------------------------------------------------
  const [formData, setFormData] = useState<{
    routingCode: string;
    routingName: string;
    itemId: number | '';
    versionNo: string;
    status: RoutingStatus;
    isDefault: boolean;
    effectiveFrom: string;
    effectiveTo: string;
    batchSize: number;
    remarks: string;
    operations: RoutingOperation[];
  }>({
    routingCode: '',
    routingName: '',
    itemId: '',
    versionNo: '1.0',
    status: 'DRAFT',
    isDefault: true,
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveTo: '',
    batchSize: 10,
    remarks: '',
    operations: [],
  });

  const handleOpenCreateModal = () => {
    setEditingRouting(null);
    setActiveTab('HEADER');
    setFormData({
      routingCode: '',
      routingName: '',
      itemId: lookupsData?.items?.[0]?.itemId || '',
      versionNo: '1.0',
      status: 'DRAFT',
      isDefault: true,
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveTo: '',
      batchSize: 10,
      remarks: '',
      operations: [
        {
          opSequence: 10,
          opCode: 'OP-10',
          opName: 'Rough Machining / Stamping',
          workCenterId: lookupsData?.workCenters?.[0]?.workCenterId || 1001,
          setupTimeMins: 30,
          runTimeMins: 15,
          overlapPercent: 0,
          machineHourlyRate: lookupsData?.workCenters?.[0]?.costPerHour || 450,
          laborHourlyRate: lookupsData?.workCenters?.[0]?.labourCostPerHour || 180,
          overheadHourlyRate: lookupsData?.workCenters?.[0]?.overheadCostPerHour || 120,
          totalHourlyRate: 750,
          machineCostPerUnit: 135,
          laborCostPerUnit: 54,
          overheadCostPerUnit: 36,
          totalCostPerUnit: 225,
          toolingDescription: 'Standard indexable tooling inserts',
          fixtureNo: 'FIX-01',
          isInspectionRequired: true,
          qcCheckpoints: 'Dimensional tolerance ±0.05mm',
          isSubcontracted: false,
        },
      ],
    });
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = async (routing: RoutingHeader) => {
    setEditingRouting(routing);
    setActiveTab('HEADER');

    try {
      const res = await apiClient.get<ApiResponse<RoutingHeader>>(
        `/manufacturing/routings/${routing.routingId}`,
      );
      const detail = res.data.data;

      setFormData({
        routingCode: detail.routingCode,
        routingName: detail.routingName,
        itemId: detail.itemId,
        versionNo: detail.versionNo,
        status: detail.status,
        isDefault: detail.isDefault,
        effectiveFrom: detail.effectiveFrom?.split('T')[0] || '',
        effectiveTo: detail.effectiveTo?.split('T')[0] || '',
        batchSize: detail.batchSize || 10,
        remarks: detail.remarks || '',
        operations: detail.operations || [],
      });
      setIsCreateModalOpen(true);
    } catch {
      showFeedback('error', 'Failed to load routing operations for editing.');
    }
  };

  // Re-calculate operation costs when batchSize, setup, run, or rates change
  const calculateOpCost = (
    setupMins: number,
    runMins: number,
    batchSize: number,
    mRate: number,
    lRate: number,
    oRate: number,
  ) => {
    const bSize = batchSize > 0 ? batchSize : 1;
    const amortizedSetup = setupMins / bSize;
    const totalMins = runMins + amortizedSetup;
    const hours = totalMins / 60;
    const mCost = Math.round(hours * mRate * 10000) / 10000;
    const lCost = Math.round(hours * lRate * 10000) / 10000;
    const oCost = Math.round(hours * oRate * 10000) / 10000;
    const tCost = Math.round((mCost + lCost + oCost) * 10000) / 10000;
    return {
      machineCostPerUnit: mCost,
      laborCostPerUnit: lCost,
      overheadCostPerUnit: oCost,
      totalCostPerUnit: tCost,
      totalHourlyRate: mRate + lRate + oRate,
    };
  };

  const handleAddOperationRow = () => {
    const nextSeq = (formData.operations.length + 1) * 10;
    const defaultWc = lookupsData?.workCenters?.[0];
    const mRate = defaultWc?.costPerHour || 400;
    const lRate = defaultWc?.labourCostPerHour || 150;
    const oRate = defaultWc?.overheadCostPerHour || 100;

    const costs = calculateOpCost(15, 10, formData.batchSize, mRate, lRate, oRate);

    const newOp: RoutingOperation = {
      opSequence: nextSeq,
      opCode: `OP-${nextSeq}`,
      opName: 'New Operation Stage',
      workCenterId: defaultWc?.workCenterId || 1001,
      setupTimeMins: 15,
      runTimeMins: 10,
      overlapPercent: 0,
      machineHourlyRate: mRate,
      laborHourlyRate: lRate,
      overheadHourlyRate: oRate,
      totalHourlyRate: costs.totalHourlyRate,
      machineCostPerUnit: costs.machineCostPerUnit,
      laborCostPerUnit: costs.laborCostPerUnit,
      overheadCostPerUnit: costs.overheadCostPerUnit,
      totalCostPerUnit: costs.totalCostPerUnit,
      toolingDescription: '',
      fixtureNo: '',
      isInspectionRequired: false,
      qcCheckpoints: '',
      isSubcontracted: false,
    };

    setFormData((prev) => ({
      ...prev,
      operations: [...prev.operations, newOp],
    }));
  };

  const handleRemoveOperationRow = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      operations: prev.operations.filter((_, i) => i !== index),
    }));
  };

  const handleUpdateOperationField = (index: number, field: keyof RoutingOperation, value: any) => {
    setFormData((prev) => {
      const ops = [...prev.operations];
      const op = { ...ops[index], [field]: value };

      if (field === 'workCenterId') {
        const wc = lookupsData?.workCenters?.find((w) => w.workCenterId === Number(value));
        if (wc) {
          op.machineHourlyRate = wc.costPerHour;
          op.laborHourlyRate = wc.labourCostPerHour;
          op.overheadHourlyRate = wc.overheadCostPerHour;
        }
      }

      const costs = calculateOpCost(
        Number(op.setupTimeMins || 0),
        Number(op.runTimeMins || 0),
        Number(prev.batchSize || 1),
        Number(op.machineHourlyRate || 0),
        Number(op.laborHourlyRate || 0),
        Number(op.overheadHourlyRate || 0),
      );

      op.machineCostPerUnit = costs.machineCostPerUnit;
      op.laborCostPerUnit = costs.laborCostPerUnit;
      op.overheadCostPerUnit = costs.overheadCostPerUnit;
      op.totalCostPerUnit = costs.totalCostPerUnit;
      op.totalHourlyRate = costs.totalHourlyRate;

      ops[index] = op;
      return { ...prev, operations: ops };
    });
  };

  const handleMoveOperation = (index: number, direction: 'UP' | 'DOWN') => {
    if (direction === 'UP' && index === 0) return;
    if (direction === 'DOWN' && index === formData.operations.length - 1) return;

    setFormData((prev) => {
      const ops = [...prev.operations];
      const targetIndex = direction === 'UP' ? index - 1 : index + 1;
      const temp = ops[index];
      ops[index] = ops[targetIndex];
      ops[targetIndex] = temp;

      const resequenced = ops.map((op, i) => ({
        ...op,
        opSequence: (i + 1) * 10,
        opCode: `OP-${(i + 1) * 10}`,
      }));

      return { ...prev, operations: resequenced };
    });
  };

  // Live Totals for Create/Edit Modal
  const liveTotals = useMemo(() => {
    let setup = 0;
    let run = 0;
    let mCost = 0;
    let lCost = 0;
    let oCost = 0;
    let tCost = 0;

    formData.operations.forEach((op) => {
      setup += Number(op.setupTimeMins || 0);
      run += Number(op.runTimeMins || 0);
      mCost += Number(op.machineCostPerUnit || 0);
      lCost += Number(op.laborCostPerUnit || 0);
      oCost += Number(op.overheadCostPerUnit || 0);
      tCost += Number(op.totalCostPerUnit || 0);
    });

    const totalWorkingMins = setup + run * (formData.batchSize || 1);
    const estLeadTimeDays = Math.max(0.5, Math.round(((totalWorkingMins / (8 * 60)) * 1.2) * 100) / 100);

    return {
      setupMins: Math.round(setup * 100) / 100,
      runMins: Math.round(run * 100) / 100,
      machineCost: Math.round(mCost * 100) / 100,
      laborCost: Math.round(lCost * 100) / 100,
      overheadCost: Math.round(oCost * 100) / 100,
      totalCost: Math.round(tCost * 100) / 100,
      leadTimeDays: estLeadTimeDays,
    };
  }, [formData.operations, formData.batchSize]);

  // Save Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!formData.itemId) {
        throw new Error('Please select an Item for this routing.');
      }
      if (!formData.routingName.trim()) {
        throw new Error('Routing Name is required.');
      }
      if (formData.operations.length === 0) {
        throw new Error('At least one operation is required.');
      }

      const payload = {
        routingCode: formData.routingCode.trim() || undefined,
        routingName: formData.routingName.trim(),
        itemId: Number(formData.itemId),
        versionNo: formData.versionNo.trim() || '1.0',
        status: formData.status,
        isDefault: formData.isDefault,
        effectiveFrom: formData.effectiveFrom || undefined,
        effectiveTo: formData.effectiveTo || undefined,
        batchSize: Number(formData.batchSize || 1),
        remarks: formData.remarks || undefined,
        operations: formData.operations.map((o) => ({
          opSequence: o.opSequence,
          opCode: o.opCode,
          opName: o.opName,
          workCenterId: Number(o.workCenterId),
          machineId: o.machineId ? Number(o.machineId) : undefined,
          setupTimeMins: Number(o.setupTimeMins || 0),
          runTimeMins: Number(o.runTimeMins || 0),
          overlapPercent: Number(o.overlapPercent || 0),
          machineHourlyRate: Number(o.machineHourlyRate || 0),
          laborHourlyRate: Number(o.laborHourlyRate || 0),
          overheadHourlyRate: Number(o.overheadHourlyRate || 0),
          toolingDescription: o.toolingDescription || undefined,
          fixtureNo: o.fixtureNo || undefined,
          isInspectionRequired: Boolean(o.isInspectionRequired),
          qcCheckpoints: o.qcCheckpoints || undefined,
          isSubcontracted: Boolean(o.isSubcontracted),
          subcontractVendorId: o.subcontractVendorId ? Number(o.subcontractVendorId) : undefined,
          remarks: o.remarks || undefined,
        })),
      };

      if (editingRouting) {
        return apiClient.put(`/manufacturing/routings/${editingRouting.routingId}`, payload);
      } else {
        return apiClient.post('/manufacturing/routings', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routings-list'] });
      queryClient.invalidateQueries({ queryKey: ['routing-summary'] });
      setIsCreateModalOpen(false);
      setEditingRouting(null);
      showFeedback('success', `Routing successfully ${editingRouting ? 'updated' : 'created'}.`);
    },
    onError: (err: any) => {
      showFeedback('error', err?.response?.data?.message || err.message || 'Failed to save routing.');
    },
  });

  // --------------------------------------------------------------------------
  // MasterDataTable Columns Definition
  // --------------------------------------------------------------------------
  const columns: MasterTableColumn<RoutingHeader>[] = useMemo(
    () => [
      {
        key: 'routingCode',
        header: 'Routing Code',
        sortable: true,
        sortValue: (r) => r.routingCode,
        render: (r) => (
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 font-semibold text-primary dark:text-primary">
              <Workflow className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>{r.routingCode}</span>
              {r.isDefault && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  DEFAULT
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={r.routingName}>
              {r.routingName}
            </span>
          </div>
        ),
      },
      {
        key: 'item',
        header: 'Manufactured Item',
        sortable: true,
        sortValue: (r) => r.itemCode,
        render: (r) => (
          <div className="flex flex-col">
            <span className="font-mono text-xs font-semibold text-foreground">{r.itemCode}</span>
            <span className="text-xs text-muted-foreground line-clamp-1" title={r.itemName}>
              {r.itemName}
            </span>
          </div>
        ),
      },
      {
        key: 'versionNo',
        header: 'Ver.',
        sortable: true,
        sortValue: (r) => r.versionNo,
        render: (r) => (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-medium bg-muted text-foreground border border-border">
            v{r.versionNo}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        sortValue: (r) => r.status,
        render: (r) => {
          const cfg = STATUS_BADGE_MAP[r.status] || STATUS_BADGE_MAP.DRAFT;
          return (
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.text}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
          );
        },
      },
      {
        key: 'operationCount',
        header: 'Ops',
        sortable: true,
        sortValue: (r) => r.operationCount || 0,
        render: (r) => (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50">
            {r.operationCount || 0} Stages
          </span>
        ),
      },
      {
        key: 'totalSetupTimeMins',
        header: 'Setup Time',
        sortable: true,
        sortValue: (r) => r.totalSetupTimeMins,
        render: (r) => (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Timer className="w-3.5 h-3.5 text-amber-500" />
            <span>{r.totalSetupTimeMins}m</span>
          </div>
        ),
      },
      {
        key: 'totalRunTimeMins',
        header: 'Run / Cycle Time',
        sortable: true,
        sortValue: (r) => r.totalRunTimeMins,
        render: (r) => (
          <div className="flex items-center gap-1 text-xs font-medium text-foreground">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span>{r.totalRunTimeMins} min/u</span>
          </div>
        ),
      },
      {
        key: 'totalCostPerUnit',
        header: 'Cost / Unit (₹)',
        sortable: true,
        sortValue: (r) => Number(r.totalCostPerUnit || 0),
        render: (r) => (
          <div className="flex items-center gap-1 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
            <span>₹{Number(r.totalCostPerUnit || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
        ),
      },
    ],
    [],
  );

  const groupByOptions: GroupByOption<RoutingHeader>[] = [
    { key: 'status', label: 'Status', groupValue: (r) => r.status },
    { key: 'item', label: 'Manufactured Item', groupValue: (r) => `${r.itemCode} - ${r.itemName}` },
    { key: 'isDefault', label: 'Default Flag', groupValue: (r) => (r.isDefault ? 'Default Routings' : 'Alternative Versions') },
  ];

  // Export to CSV
  const handleExportSheet = () => {
    if (!routingList || routingList.length === 0) {
      showFeedback('error', 'No routings available to export.');
      return;
    }
    const headers = [
      'Routing Code',
      'Routing Name',
      'Item Code',
      'Item Name',
      'Version',
      'Status',
      'Default',
      'Operations Count',
      'Setup Mins',
      'Run Mins',
      'Standard Cost (INR)',
    ];
    const rows = routingList.map((r: RoutingHeader) => [
      r.routingCode,
      `"${r.routingName}"`,
      r.itemCode,
      `"${r.itemName}"`,
      r.versionNo,
      r.status,
      r.isDefault ? 'YES' : 'NO',
      r.operationCount,
      r.totalSetupTimeMins,
      r.totalRunTimeMins,
      r.totalCostPerUnit,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e: any[]) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Production_Routings_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showFeedback('success', 'Production routings sheet exported.');
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* -------------------------------------------------------------------- */}
      {/* 1. Feedback Alert Banner                                             */}
      {/* -------------------------------------------------------------------- */}
      {feedback && (
        <div
          className={`p-3.5 rounded-lg border flex items-center justify-between text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="p-1 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 2. KPI Header Metric Cards                                           */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Routings */}
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Workflow className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Routings</p>
            <h3 className="text-2xl font-bold text-foreground">
              {isSummaryLoading ? '...' : summaryData?.totalRoutings ?? 0}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Across all product revisions</p>
          </div>
        </div>

        {/* Active Released Routings */}
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Routings</p>
            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {isSummaryLoading ? '...' : summaryData?.activeRoutings ?? 0}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Shopfloor ready & released</p>
          </div>
        </div>

        {/* Distinct Manufactured Items */}
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
            <Layers className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Configured Assemblies</p>
            <h3 className="text-2xl font-bold text-foreground">
              {isSummaryLoading ? '...' : summaryData?.distinctItems ?? 0}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Discrete finished goods</p>
          </div>
        </div>

        {/* Avg Cycle Time */}
        <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Timer className="w-6 h-6 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Avg Run Cycle Time</p>
            <h3 className="text-2xl font-bold text-foreground">
              {isSummaryLoading ? '...' : `${summaryData?.avgCycleTimeMins ?? 0}m`}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">Standard run minutes per unit</p>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 3. Master Data Table with integrated filters and actions             */}
      {/* -------------------------------------------------------------------- */}
      <MasterDataTable<RoutingHeader>
        title="Production Routings & Operations"
        subtitle="Manage multi-stage operation sequences, work centers, tooling specifications, and absorption costing"
        screenCode="MFG_ROUTING"
        tableNameBadge="tbl_mfg_routing_header"
        data={routingList}
        rowKey={(r) => r.routingId}
        columns={columns}
        isLoading={isListLoading}
        addButtonLabel="New Routing"
        onAddClick={handleOpenCreateModal}
        onExportClick={handleExportSheet}
        onPrintClick={() => window.print()}
        groupByOptions={groupByOptions}
        searchPlaceholder="Filter routings by code, name, or assembly..."
        searchPredicate={(r, query) => {
          const q = query.toLowerCase();
          return (
            r.routingCode.toLowerCase().includes(q) ||
            r.routingName.toLowerCase().includes(q) ||
            r.itemCode.toLowerCase().includes(q) ||
            r.itemName.toLowerCase().includes(q)
          );
        }}
        filterToolbarSlot={
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-lg bg-background border border-border focus:ring-1 focus:ring-primary text-foreground"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="DRAFT">DRAFT</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW</option>
              <option value="OBSOLETE">OBSOLETE</option>
            </select>

            {/* Item Filter */}
            <select
              value={itemFilter}
              onChange={(e) => setItemFilter(e.target.value)}
              className="px-2.5 py-1 text-xs rounded-lg bg-background border border-border focus:ring-1 focus:ring-primary text-foreground max-w-[200px] truncate"
            >
              <option value="">All Assemblies</option>
              {lookupsData?.items?.map((it: ItemLookup) => (
                <option key={it.itemId} value={it.itemId}>
                  {it.itemCode} - {it.itemName}
                </option>
              ))}
            </select>

            {/* Default Only */}
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={defaultOnlyFilter}
                onChange={(e) => setDefaultOnlyFilter(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary"
              />
              <span>Default Only</span>
            </label>

            {(statusFilter || itemFilter || defaultOnlyFilter) && (
              <button
                onClick={() => {
                  setStatusFilter('');
                  setItemFilter('');
                  setDefaultOnlyFilter(false);
                }}
                className="px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded border border-border hover:bg-muted"
              >
                Clear
              </button>
            )}
          </div>
        }
        renderRowActions={(r) => (
          <div className="flex items-center justify-end gap-1">
            {/* View Details / Flow Timeline */}
            <button
              onClick={() => setViewingRouting(r)}
              title="View Operation Timeline"
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <Eye className="w-4 h-4" />
            </button>

            {/* Print Shopfloor Traveler */}
            <PermissionGate screen="MFG_ROUTING" action="PRINT">
              <button
                onClick={() => setPrintingRouting(r)}
                title="Print Shopfloor Route Traveler"
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <Printer className="w-4 h-4" />
              </button>
            </PermissionGate>

            {/* Approve / Release */}
            {r.status !== 'ACTIVE' && (
              <PermissionGate screen="MFG_ROUTING" action="APPROVE">
                <button
                  onClick={() => setApprovingRouting(r)}
                  title="Approve & Release Routing"
                  className="p-1.5 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {/* Clone / Revision */}
            <PermissionGate screen="MFG_ROUTING" action="CLONE">
              <button
                onClick={() => setCloningRouting(r)}
                title="Clone / Create New Revision"
                className="p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 text-blue-600 dark:text-blue-400 transition-colors"
              >
                <Copy className="w-4 h-4" />
              </button>
            </PermissionGate>

            {/* Edit */}
            <PermissionGate screen="MFG_ROUTING" action="EDIT">
              <button
                onClick={() => handleOpenEditModal(r)}
                title="Edit Routing & Operations"
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </PermissionGate>

            {/* Delete */}
            <PermissionGate screen="MFG_ROUTING" action="DELETE">
              <button
                onClick={() => {
                  setDeleteTarget(r);
                  setDeleteErrorMessage(null);
                  setDeleteConflicts([]);
                  setIsDeleteModalOpen(true);
                }}
                title="Delete Routing"
                className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </PermissionGate>
          </div>
        )}
      />

      {/* -------------------------------------------------------------------- */}
      {/* 4. Operation Flow Visualizer Modal / Detail Inspector                */}
      {/* -------------------------------------------------------------------- */}
      {viewingRouting && singleRoutingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Workflow className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg text-foreground">{singleRoutingDetail.routingCode}</h3>
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-muted border border-border">
                      v{singleRoutingDetail.versionNo}
                    </span>
                    {singleRoutingDetail.isDefault && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        DEFAULT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{singleRoutingDetail.routingName}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <PermissionGate screen="MFG_ROUTING" action="PRINT">
                  <button
                    onClick={() => {
                      setPrintingRouting(singleRoutingDetail);
                      setViewingRouting(null);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background hover:bg-muted text-foreground"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Traveler</span>
                  </button>
                </PermissionGate>
                <button
                  onClick={() => setViewingRouting(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Summary Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg bg-muted/40 border border-border text-xs">
                <div>
                  <span className="text-muted-foreground block">Item Part Number:</span>
                  <span className="font-semibold text-foreground">{singleRoutingDetail.itemCode}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Total Setup Time:</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {singleRoutingDetail.totalSetupTimeMins} mins
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Total Cycle Time / Unit:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">
                    {singleRoutingDetail.totalRunTimeMins} mins
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block">Standard Unit Cost:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    ₹{Number(singleRoutingDetail.totalCostPerUnit || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Sequential Operation Flow Timeline */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                  <Workflow className="w-4 h-4 text-primary" />
                  Sequential Manufacturing Stages ({singleRoutingDetail.operations?.length || 0} Operations)
                </h4>

                <div className="relative border-l-2 border-primary/30 ml-4 space-y-6 pb-2">
                  {singleRoutingDetail.operations?.map((op: RoutingOperation, idx: number) => (
                    <div key={op.routingOpId || idx} className="relative pl-6 group">
                      {/* Timeline Node Icon */}
                      <div className="absolute -left-[17px] top-1 w-8 h-8 rounded-full bg-background border-2 border-primary flex items-center justify-center font-bold text-xs text-primary shadow-sm">
                        {op.opSequence}
                      </div>

                      {/* Operation Card */}
                      <div className="p-4 rounded-xl border border-border bg-card shadow-sm hover:border-primary/50 transition-colors space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                              {op.opCode}
                            </span>
                            <h5 className="font-semibold text-sm text-foreground">{op.opName}</h5>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs px-2 py-0.5 rounded bg-muted text-foreground font-medium border border-border flex items-center gap-1">
                              <Settings className="w-3 h-3 text-muted-foreground" />
                              {op.workCenterName} ({op.workCenterCode})
                            </span>
                            {op.machineName && (
                              <span className="text-xs px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900/40">
                                {op.machineName}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Operational Parameters & Cycle Times */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-border text-xs">
                          <div>
                            <span className="text-muted-foreground block">Setup Time:</span>
                            <span className="font-medium text-foreground">{op.setupTimeMins} mins</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Run / Cycle Time:</span>
                            <span className="font-medium text-foreground">{op.runTimeMins} min/pc</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Total Op Hourly Rate:</span>
                            <span className="font-mono text-foreground font-semibold">₹{op.totalHourlyRate}/hr</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground block">Cost Contribution / Unit:</span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ₹{Number(op.totalCostPerUnit || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Tooling, Fixtures & QC Gate */}
                        {(op.toolingDescription || op.fixtureNo || op.isInspectionRequired || op.qcCheckpoints) && (
                          <div className="p-2.5 rounded-lg bg-muted/30 border border-border/60 text-xs space-y-1.5">
                            {op.toolingDescription && (
                              <div className="flex items-start gap-1.5">
                                <Wrench className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                <span>
                                  <strong className="text-foreground">Tooling:</strong> {op.toolingDescription}
                                </span>
                              </div>
                            )}
                            {op.fixtureNo && (
                              <div className="flex items-start gap-1.5">
                                <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                                <span>
                                  <strong className="text-foreground">Fixture / Jig:</strong> {op.fixtureNo}
                                </span>
                              </div>
                            )}
                            {op.isInspectionRequired && (
                              <div className="flex items-start gap-1.5 text-amber-700 dark:text-amber-300">
                                <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                <span>
                                  <strong>QC Checkpoint:</strong> {op.qcCheckpoints || 'Inspection sign-off required'}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-muted/20 flex justify-end">
              <button
                onClick={() => setViewingRouting(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Close Visualizer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 5. Create / Edit Production Routing 3-Tab Modal                      */}
      {/* -------------------------------------------------------------------- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2.5">
                <Workflow className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="font-bold text-lg text-foreground">
                    {editingRouting ? `Edit Routing: ${editingRouting.routingCode}` : 'Create Production Routing'}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Define operation sequences, assign work center equipment, and calculate unit manufacturing costs
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-border bg-muted/10 px-4 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('HEADER')}
                className={`py-3 px-4 border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'HEADER'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>1. Header & General Parameters</span>
              </button>

              <button
                onClick={() => setActiveTab('OPERATIONS')}
                className={`py-3 px-4 border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'OPERATIONS'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Workflow className="w-4 h-4" />
                <span>2. Operation Sequencer ({formData.operations.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('COSTING')}
                className={`py-3 px-4 border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'COSTING'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <DollarSign className="w-4 h-4" />
                <span>3. Absorption Costing & Summary</span>
              </button>
            </div>

            {/* Modal Body Tabs */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {/* TAB 1: Header */}
              {activeTab === 'HEADER' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Manufactured Assembly / Item *
                    </label>
                    <select
                      disabled={!!editingRouting}
                      value={formData.itemId}
                      onChange={(e) => {
                        const selectedId = Number(e.target.value);
                        const it = lookupsData?.items?.find((i: ItemLookup) => i.itemId === selectedId);
                        setFormData((prev) => ({
                          ...prev,
                          itemId: selectedId,
                          routingName: it ? `${it.itemName} Production Routing` : prev.routingName,
                          routingCode: it ? `ROUT-${it.itemCode}-V${prev.versionNo}` : prev.routingCode,
                        }));
                      }}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:ring-1 focus:ring-primary text-foreground disabled:opacity-60"
                    >
                      <option value="">-- Select Item --</option>
                      {lookupsData?.items?.map((it: ItemLookup) => (
                        <option key={it.itemId} value={it.itemId}>
                          {it.itemCode} - {it.itemName} ({it.uomCode})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Routing Document Code (Auto if blank)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ROUT-FG-VALVE-50-V1.0"
                      value={formData.routingCode}
                      onChange={(e) => setFormData({ ...formData, routingCode: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:ring-1 focus:ring-primary text-foreground"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-foreground block mb-1">Routing Description Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Industrial SS-316 Flanged Gate Valve 2 inch Class 150 Standard Routing"
                      value={formData.routingName}
                      onChange={(e) => setFormData({ ...formData, routingName: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:ring-1 focus:ring-primary text-foreground"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Revision / Version No *</label>
                    <input
                      type="text"
                      placeholder="1.0"
                      value={formData.versionNo}
                      onChange={(e) => setFormData({ ...formData, versionNo: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:ring-1 focus:ring-primary text-foreground"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Standard Batch / Lot Size (for Setup Amortization) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.batchSize}
                      onChange={(e) => setFormData({ ...formData, batchSize: Math.max(1, Number(e.target.value)) })}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:ring-1 focus:ring-primary text-foreground"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Effective Release Date</label>
                    <input
                      type="date"
                      value={formData.effectiveFrom}
                      onChange={(e) => setFormData({ ...formData, effectiveFrom: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:ring-1 focus:ring-primary text-foreground"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Effective Expiry Date</label>
                    <input
                      type="date"
                      value={formData.effectiveTo}
                      onChange={(e) => setFormData({ ...formData, effectiveTo: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:ring-1 focus:ring-primary text-foreground"
                    />
                  </div>

                  <div className="flex items-center gap-6 py-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.isDefault}
                        onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                      <span>Set as Default Primary Routing for this Item</span>
                    </label>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Engineering Notes & Special Instructions
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Add engineering change details, safety prerequisites, or tooling notes..."
                      value={formData.remarks}
                      onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg bg-background border border-border focus:ring-1 focus:ring-primary text-foreground"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: Operations Sequencer */}
              {activeTab === 'OPERATIONS' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <div>
                      <h4 className="text-sm font-bold text-foreground">Operation Stages Sequence</h4>
                      <p className="text-xs text-muted-foreground">
                        Define chronological machining steps, cycle times (minutes), and work center hourly rates
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddOperationRow}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Next Operation (+10)</span>
                    </button>
                  </div>

                  {formData.operations.length === 0 ? (
                    <div className="p-8 text-center border-2 border-dashed border-border rounded-xl">
                      <Workflow className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm font-medium text-foreground">No operations added yet</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Click "Add Next Operation" to configure your first manufacturing step.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formData.operations.map((op, idx) => {
                        const availableMachines = lookupsData?.machines?.filter(
                          (m: MachineLookup) => m.workCenterId === Number(op.workCenterId),
                        );

                        return (
                          <div
                            key={idx}
                            className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-3 relative group"
                          >
                            {/* Operation Bar Header */}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                                  {op.opSequence}
                                </span>
                                <input
                                  type="text"
                                  value={op.opCode}
                                  onChange={(e) => handleUpdateOperationField(idx, 'opCode', e.target.value)}
                                  className="w-20 px-2 py-1 text-xs font-mono font-bold rounded bg-background border border-border text-foreground"
                                  title="Operation Code"
                                />
                                <input
                                  type="text"
                                  value={op.opName}
                                  placeholder="Operation name e.g. Rough CNC Turning..."
                                  onChange={(e) => handleUpdateOperationField(idx, 'opName', e.target.value)}
                                  className="flex-1 min-w-[200px] px-3 py-1 text-xs font-semibold rounded bg-background border border-border text-foreground"
                                />
                              </div>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveOperation(idx, 'UP')}
                                  title="Move Earlier in Sequence"
                                  className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                                >
                                  <ArrowUp className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  disabled={idx === formData.operations.length - 1}
                                  onClick={() => handleMoveOperation(idx, 'DOWN')}
                                  title="Move Later in Sequence"
                                  className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"
                                >
                                  <ArrowDown className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOperationRow(idx)}
                                  title="Delete Operation"
                                  className="p-1 rounded text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Row 1: Work Center & Machines */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                              <div>
                                <label className="text-muted-foreground block mb-0.5">Work Center *</label>
                                <select
                                  value={op.workCenterId}
                                  onChange={(e) =>
                                    handleUpdateOperationField(idx, 'workCenterId', Number(e.target.value))
                                  }
                                  className="w-full px-2 py-1.5 rounded bg-background border border-border text-foreground font-medium"
                                >
                                  {lookupsData?.workCenters?.map((w: WorkCenterLookup) => (
                                    <option key={w.workCenterId} value={w.workCenterId}>
                                      {w.workCenterCode} - {w.workCenterName} (₹{w.totalHourlyRate}/hr)
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="text-muted-foreground block mb-0.5">Machine Asset (Optional)</label>
                                <select
                                  value={op.machineId || ''}
                                  onChange={(e) =>
                                    handleUpdateOperationField(
                                      idx,
                                      'machineId',
                                      e.target.value ? Number(e.target.value) : null,
                                    )
                                  }
                                  className="w-full px-2 py-1.5 rounded bg-background border border-border text-foreground font-medium"
                                >
                                  <option value="">-- Any Available Machine --</option>
                                  {availableMachines?.map((m: MachineLookup) => (
                                    <option key={m.wcMachineId} value={m.wcMachineId}>
                                      {m.machineCode} - {m.machineName} ({m.powerRatingKw} kW)
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="text-muted-foreground block mb-0.5">Total Hourly Rate (₹/hr)</label>
                                <input
                                  type="number"
                                  value={op.totalHourlyRate}
                                  readOnly
                                  className="w-full px-2 py-1.5 rounded bg-muted/50 border border-border text-foreground font-mono font-semibold"
                                />
                              </div>
                            </div>

                            {/* Row 2: Standard Times & Cost Rollup */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-muted/20 p-2.5 rounded-lg border border-border">
                              <div>
                                <label className="text-muted-foreground block mb-0.5">Setup Time (mins)</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={op.setupTimeMins}
                                  onChange={(e) =>
                                    handleUpdateOperationField(idx, 'setupTimeMins', Number(e.target.value))
                                  }
                                  className="w-full px-2 py-1 rounded bg-background border border-border text-foreground font-medium"
                                />
                              </div>

                              <div>
                                <label className="text-muted-foreground block mb-0.5">Run Time / Unit (mins) *</label>
                                <input
                                  type="number"
                                  min="0"
                                  value={op.runTimeMins}
                                  onChange={(e) =>
                                    handleUpdateOperationField(idx, 'runTimeMins', Number(e.target.value))
                                  }
                                  className="w-full px-2 py-1 rounded bg-background border border-border text-foreground font-medium"
                                />
                              </div>

                              <div>
                                <label className="text-muted-foreground block mb-0.5">Line Overlap %</label>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={op.overlapPercent}
                                  onChange={(e) =>
                                    handleUpdateOperationField(idx, 'overlapPercent', Number(e.target.value))
                                  }
                                  className="w-full px-2 py-1 rounded bg-background border border-border text-foreground font-medium"
                                />
                              </div>

                              <div>
                                <label className="text-muted-foreground block mb-0.5">Unit Op Cost (₹)</label>
                                <div className="px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                                  ₹{Number(op.totalCostPerUnit || 0).toFixed(2)}
                                </div>
                              </div>
                            </div>

                            {/* Row 3: Tooling & Quality Gate */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div>
                                <label className="text-muted-foreground block mb-0.5">Tooling / Inserts</label>
                                <input
                                  type="text"
                                  placeholder="e.g. CNMG 120408, live turning holder..."
                                  value={op.toolingDescription || ''}
                                  onChange={(e) =>
                                    handleUpdateOperationField(idx, 'toolingDescription', e.target.value)
                                  }
                                  className="w-full px-2 py-1 rounded bg-background border border-border text-foreground"
                                />
                              </div>

                              <div>
                                <label className="text-muted-foreground block mb-0.5">Fixture / Jig Number</label>
                                <input
                                  type="text"
                                  placeholder="e.g. FIX-CNC-01, JIG-VALVE-50"
                                  value={op.fixtureNo || ''}
                                  onChange={(e) => handleUpdateOperationField(idx, 'fixtureNo', e.target.value)}
                                  className="w-full px-2 py-1 rounded bg-background border border-border text-foreground"
                                />
                              </div>

                              <div className="sm:col-span-2 flex items-center gap-4 pt-1">
                                <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    checked={op.isInspectionRequired}
                                    onChange={(e) =>
                                      handleUpdateOperationField(idx, 'isInspectionRequired', e.target.checked)
                                    }
                                    className="rounded border-border text-amber-600 focus:ring-amber-500"
                                  />
                                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                                    Quality Gate / QC Checkpoint Required
                                  </span>
                                </label>

                                {op.isInspectionRequired && (
                                  <input
                                    type="text"
                                    placeholder="Inspection tolerance e.g. Bore Ø50.00 ± 0.02 mm, Ra <= 0.8 µm..."
                                    value={op.qcCheckpoints || ''}
                                    onChange={(e) =>
                                      handleUpdateOperationField(idx, 'qcCheckpoints', e.target.value)
                                    }
                                    className="flex-1 px-2 py-1 rounded bg-background border border-border text-foreground text-xs"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Costing & Lead Time Summary */}
              {activeTab === 'COSTING' && (
                <div className="space-y-6">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl border border-border bg-card">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                        Total Setup Time
                      </p>
                      <h4 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                        {liveTotals.setupMins} mins
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Amortized @ {formData.batchSize} pcs = {(liveTotals.setupMins / formData.batchSize).toFixed(1)}{' '}
                        min/pc
                      </p>
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-card">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                        Total Run Cycle Time
                      </p>
                      <h4 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                        {liveTotals.runMins} mins
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">Direct machine & operator processing</p>
                    </div>

                    <div className="p-4 rounded-xl border border-border bg-card">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                        Est. Shopfloor Lead Time
                      </p>
                      <h4 className="text-2xl font-bold text-primary mt-1">{liveTotals.leadTimeDays} Days</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">Based on 8 hr/day single-shift throughput</p>
                    </div>
                  </div>

                  {/* Standard Absorption Breakdown */}
                  <div className="p-5 rounded-xl border border-border bg-muted/20 space-y-4">
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-emerald-600" />
                      Standard Absorption Cost per Unit Breakdown
                    </h4>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center py-1.5 border-b border-border">
                        <span className="text-muted-foreground">Direct Machinery Cost (Absorption)</span>
                        <span className="font-mono font-semibold text-foreground">
                          ₹{liveTotals.machineCost.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1.5 border-b border-border">
                        <span className="text-muted-foreground">Direct Operator Labor Cost</span>
                        <span className="font-mono font-semibold text-foreground">
                          ₹{liveTotals.laborCost.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center py-1.5 border-b border-border">
                        <span className="text-muted-foreground">Factory Power & Space Overhead</span>
                        <span className="font-mono font-semibold text-foreground">
                          ₹{liveTotals.overheadCost.toFixed(2)}
                        </span>
                      </div>

                      <div className="flex justify-between items-center pt-2 text-base font-bold">
                        <span className="text-foreground">Total Standard Routing Cost per Unit</span>
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 text-lg">
                          ₹{liveTotals.totalCost.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Total Standard Unit Cost:{' '}
                <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                  ₹{liveTotals.totalCost.toFixed(2)}
                </strong>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {saveMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>{editingRouting ? 'Update Routing' : 'Create & Release Draft'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 6. Approval & Release Modal                                          */}
      {/* -------------------------------------------------------------------- */}
      {approvingRouting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-bold text-lg text-foreground">Approve & Release Routing</h3>
                <p className="text-xs text-muted-foreground">{approvingRouting.routingCode}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Releasing this routing version (v{approvingRouting.versionNo}) transitions its status to{' '}
              <strong className="text-foreground">ACTIVE</strong> and makes it available for Production Work Orders.
            </p>

            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  defaultChecked={true}
                  id="chk-set-default"
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span>Set as Default Routing for this Item</span>
              </label>

              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  defaultChecked={true}
                  id="chk-sync-bom"
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span>Sync & Link to Active Bill of Materials (BOM)</span>
              </label>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Approval Release Notes</label>
                <textarea
                  rows={2}
                  id="txt-approval-remarks"
                  defaultValue="Approved for active shopfloor production"
                  className="w-full px-3 py-1.5 text-sm rounded-lg bg-background border border-border text-foreground"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setApprovingRouting(null)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground"
              >
                Cancel
              </button>
              <button
                disabled={approveMutation.isPending}
                onClick={() => {
                  const remarks = (document.getElementById('txt-approval-remarks') as HTMLTextAreaElement)?.value;
                  const isDef = (document.getElementById('chk-set-default') as HTMLInputElement)?.checked;
                  const syncB = (document.getElementById('chk-sync-bom') as HTMLInputElement)?.checked;
                  approveMutation.mutate({
                    id: approvingRouting.routingId,
                    approvalRemarks: remarks,
                    setAsDefault: isDef,
                    syncToBom: syncB,
                  });
                }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
              >
                {approveMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>Approve & Release</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 7. Clone / Revise Routing Modal                                      */}
      {/* -------------------------------------------------------------------- */}
      {cloningRouting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
              <Copy className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-bold text-lg text-foreground">Clone / Revise Routing</h3>
                <p className="text-xs text-muted-foreground">{cloningRouting.routingCode}</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Create an engineering change revision (ECR) cloned from version {cloningRouting.versionNo}.
            </p>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Target Revision / Version No *</label>
                <input
                  type="text"
                  defaultValue={`${(parseFloat(cloningRouting.versionNo) + 0.1).toFixed(1)}`}
                  id="txt-clone-version"
                  className="w-full px-3 py-1.5 text-sm rounded-lg bg-background border border-border text-foreground font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">New Routing Description</label>
                <input
                  type="text"
                  defaultValue={`${cloningRouting.routingName} (Rev)`}
                  id="txt-clone-name"
                  className="w-full px-3 py-1.5 text-sm rounded-lg bg-background border border-border text-foreground"
                />
              </div>

              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  defaultChecked={true}
                  id="chk-copy-ops"
                  className="rounded border-border text-primary focus:ring-primary"
                />
                <span>Copy all {cloningRouting.operationCount || 0} operation stages</span>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setCloningRouting(null)}
                className="px-3 py-1.5 text-sm font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground"
              >
                Cancel
              </button>
              <button
                disabled={cloneMutation.isPending}
                onClick={() => {
                  const ver = (document.getElementById('txt-clone-version') as HTMLInputElement)?.value;
                  const name = (document.getElementById('txt-clone-name') as HTMLInputElement)?.value;
                  const copyOps = (document.getElementById('chk-copy-ops') as HTMLInputElement)?.checked;
                  cloneMutation.mutate({
                    id: cloningRouting.routingId,
                    newVersionNo: ver,
                    newRoutingName: name,
                    copyOperations: copyOps,
                  });
                }}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {cloneMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                <span>Create Revision</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 8. Printable Shopfloor Route Traveler Card Modal                     */}
      {/* -------------------------------------------------------------------- */}
      {printingRouting && singleRoutingDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-foreground">Shopfloor Master Route Traveler Card</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setPrintingRouting(null)}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Content */}
            <div className="p-8 overflow-y-auto space-y-6 text-foreground bg-white dark:bg-zinc-950 font-sans print:p-0 print:m-0">
              {/* Header */}
              <div className="border-b-2 border-black dark:border-zinc-700 pb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold tracking-tight uppercase">KASHVIRA MANUFACTURING ERP</h2>
                  <p className="text-xs text-muted-foreground">ISO 9001:2015 & IATF 16949 Certified Production System</p>
                  <h3 className="text-lg font-bold mt-2">SHOPFLOOR ROUTE TRAVELER</h3>
                </div>

                <div className="text-right text-xs space-y-1">
                  <div>
                    <span className="font-bold">Doc No:</span> {singleRoutingDetail.routingCode}
                  </div>
                  <div>
                    <span className="font-bold">Version:</span> v{singleRoutingDetail.versionNo}
                  </div>
                  <div>
                    <span className="font-bold">Date:</span> {new Date().toLocaleDateString('en-IN')}
                  </div>
                </div>
              </div>

              {/* Part Details Box */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 border border-zinc-300 dark:border-zinc-800 rounded text-xs bg-zinc-50 dark:bg-zinc-900/40">
                <div>
                  <span className="font-semibold text-muted-foreground block">Item Part Number:</span>
                  <span className="font-bold text-sm text-foreground">{singleRoutingDetail.itemCode}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block">Item Description:</span>
                  <span className="font-medium text-foreground">{singleRoutingDetail.itemName}</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block">Standard Batch Qty:</span>
                  <span className="font-bold text-sm text-foreground">{singleRoutingDetail.batchSize} Units</span>
                </div>
                <div>
                  <span className="font-semibold text-muted-foreground block">Total Cycle Time:</span>
                  <span className="font-bold text-sm text-foreground">{singleRoutingDetail.totalRunTimeMins} mins</span>
                </div>
              </div>

              {/* Operations Table */}
              <div className="border border-zinc-300 dark:border-zinc-800 rounded overflow-hidden">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-300 dark:border-zinc-800 text-left font-bold">
                      <th className="p-2.5 w-10">Seq</th>
                      <th className="p-2.5">Operation Description</th>
                      <th className="p-2.5">Work Center</th>
                      <th className="p-2.5">Machine / Tooling</th>
                      <th className="p-2.5 text-center">Setup (m)</th>
                      <th className="p-2.5 text-center">Run (m)</th>
                      <th className="p-2.5 text-center">Operator Sign</th>
                      <th className="p-2.5 text-center">QC Stamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {singleRoutingDetail.operations?.map((op: RoutingOperation, i: number) => (
                      <tr key={i} className="border-b border-zinc-200 dark:border-zinc-800/60">
                        <td className="p-2.5 font-bold font-mono">{op.opSequence}</td>
                        <td className="p-2.5">
                          <div className="font-bold text-foreground">{op.opName}</div>
                          {op.isInspectionRequired && (
                            <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-0.5">
                              QC GATE: {op.qcCheckpoints || 'Inspection required'}
                            </div>
                          )}
                        </td>
                        <td className="p-2.5">{op.workCenterCode}</td>
                        <td className="p-2.5">
                          <div>{op.machineName || 'Any Machine'}</div>
                          {op.toolingDescription && (
                            <div className="text-[10px] text-muted-foreground">{op.toolingDescription}</div>
                          )}
                        </td>
                        <td className="p-2.5 text-center font-mono">{op.setupTimeMins}</td>
                        <td className="p-2.5 text-center font-mono">{op.runTimeMins}</td>
                        <td className="p-2.5 text-center border-l border-zinc-200 dark:border-zinc-800 w-24"></td>
                        <td className="p-2.5 text-center border-l border-zinc-200 dark:border-zinc-800 w-24"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Signatures */}
              <div className="pt-12 grid grid-cols-3 gap-6 text-xs text-center border-t border-zinc-200 dark:border-zinc-800">
                <div>
                  <div className="border-b border-zinc-400 w-48 mx-auto mb-1"></div>
                  <span className="font-semibold text-muted-foreground">Production Engineer</span>
                </div>
                <div>
                  <div className="border-b border-zinc-400 w-48 mx-auto mb-1"></div>
                  <span className="font-semibold text-muted-foreground">Quality Assurance Head</span>
                </div>
                <div>
                  <div className="border-b border-zinc-400 w-48 mx-auto mb-1"></div>
                  <span className="font-semibold text-muted-foreground">Plant Operations Manager</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 9. Confirm Delete Modal                                              */}
      {/* -------------------------------------------------------------------- */}
      {deleteTarget && (
        <ConfirmDeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setDeleteTarget(null);
            setDeleteErrorMessage(null);
          }}
          onConfirm={() => deleteMutation.mutate(deleteTarget.routingId)}
          entityType="Production Routing"
          entityName={deleteTarget.routingName}
          entityCode={deleteTarget.routingCode}
          isDeleting={deleteMutation.isPending}
          errorMessage={deleteErrorMessage}
          dependencies={deleteConflicts}
        />
      )}
    </div>
  );
};

export default RoutingMasterPage;
