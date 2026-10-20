import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  FlaskConical,
  Gauge,
  Layers,
  Microscope,
  Package,
  Plus,
  Printer,
  RotateCcw,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Tag,
  Trash2,
  User,
  Wrench,
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
// Types & Interfaces
// ============================================================================
export type InspectionStage =
  | 'FIRST_PIECE'
  | 'PATROL_INSPECTION'
  | 'STAGE_COMPLETION'
  | 'LAST_PIECE';

export type OverallResult =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ACCEPTED_UNDER_DEVIATION';

export type DispositionType =
  | 'DIRECT_ACCEPT'
  | 'SCRAP'
  | 'REWORK_SAME_OP'
  | 'REWORK_NEW_OP'
  | 'CONCESSION_USE_AS_IS';

export type ParamCategory =
  | 'DIMENSIONAL'
  | 'METALLURGICAL'
  | 'SURFACE_FINISH'
  | 'VISUAL'
  | 'FUNCTIONAL'
  | 'TORQUE_TENSION';

export type VisualResult = 'PASS' | 'FAIL' | 'NA';
export type ParamResult = 'PASS' | 'FAIL' | 'CONCESSION';
export type InspectionStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

export interface InProcessQcParamItem {
  ipqcParamId?: number;
  paramSequence: number;
  paramName: string;
  paramCategory: ParamCategory;
  instrumentName?: string;
  nominalVal?: number | null;
  minTolerance?: number | null;
  maxTolerance?: number | null;
  uomCode?: string;
  obsVal1?: number | null;
  obsVal2?: number | null;
  obsVal3?: number | null;
  obsVal4?: number | null;
  obsVal5?: number | null;
  meanVal?: number | null;
  visualResult?: VisualResult;
  paramResult: ParamResult;
  deviationRemarks?: string;
}

export interface InProcessQcRecord {
  ipqcId: number;
  ipqcNo: string;
  ipqcDate: string;
  woId: number;
  woNo: string;
  jobCardId: number | null;
  jobCardNo?: string | null;
  opCode?: string | null;
  opName?: string | null;
  woRoutingOpId?: number | null;
  itemId: number;
  itemCode: string;
  itemName: string;
  workCenterId: number | null;
  wcCode?: string | null;
  wcName?: string | null;
  machineId: number | null;
  machineCode?: string | null;
  machineName?: string | null;
  assignedOperatorId: number | null;
  operatorName?: string | null;
  inspectorId: number;
  inspectorName?: string | null;
  inspectionStage: InspectionStage;
  shiftName: string;
  batchNo?: string | null;
  heatNo?: string | null;
  lotQty: number;
  sampleSize: number;
  acceptedQty: number;
  rejectedQty: number;
  reworkQty: number;
  overallResult: OverallResult;
  dispositionType?: DispositionType | null;
  deviationReason?: string | null;
  approverId?: number | null;
  approverName?: string | null;
  approvalDate?: string | null;
  isCapaRequired?: boolean;
  ncrNo?: string | null;
  remarks?: string | null;
  status: InspectionStatus;
  createdDate: string;
  paramCount?: number;
  passCount?: number;
  failCount?: number;
  concessionCount?: number;
  params?: InProcessQcParamItem[];
}

export interface InProcessQcSummary {
  totalInspections: number;
  firstPieceApproved: number;
  deviationCount: number;
  rejectedCount: number;
  activePendingCount: number;
}

export interface LookupsData {
  workOrders: {
    woId: number;
    woNo: string;
    woDate: string;
    itemId: number;
    plannedQty: number;
    status: string;
  }[];
  jobCards: {
    jobCardId: number;
    jobCardNo: string;
    woId: number;
    woRoutingOpId: number | null;
    opSequence: number;
    opCode: string;
    opName: string;
    workCenterId: number;
    machineId: number | null;
    assignedOperatorId: number | null;
    plannedQty: number;
    completedQty: number;
    uomId: number;
    status: string;
    inProcessQcStatus: string;
    batchNo?: string | null;
    heatNo?: string | null;
    itemId: number;
  }[];
  workCenters: {
    workCenterId: number;
    wcCode: string;
    wcName: string;
    wcType: string;
  }[];
  machines: {
    machineId: number;
    workCenterId: number;
    machineCode: string;
    machineName: string;
  }[];
  users: {
    userId: number;
    username: string;
    fullName: string;
  }[];
  items: {
    itemId: number;
    itemCode: string;
    itemName: string;
    uomId: number;
  }[];
}

// ============================================================================
// Main Component: InProcessQcMasterPage
// ============================================================================
export const InProcessQcMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    'ALL' | 'FIRST_PIECE' | 'DEVIATIONS' | 'REJECTIONS'
  >('ALL');

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('ALL');
  const [verdictFilter, setVerdictFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<InProcessQcRecord | null>(
    null,
  );
  const [viewingRecord, setViewingRecord] = useState<InProcessQcRecord | null>(
    null,
  );
  const [approvingRecord, setApprovingRecord] =
    useState<InProcessQcRecord | null>(null);
  const [deviationRecord, setDeviationRecord] =
    useState<InProcessQcRecord | null>(null);
  const [printingRecord, setPrintingRecord] =
    useState<InProcessQcRecord | null>(null);
  const [deletingRecord, setDeletingRecord] =
    useState<InProcessQcRecord | null>(null);

  // Form State for Create/Edit
  const [formState, setFormState] = useState<{
    ipqcDate: string;
    woId: number | '';
    jobCardId: number | '';
    woRoutingOpId: number | '';
    itemId: number | '';
    workCenterId: number | '';
    machineId: number | '';
    assignedOperatorId: number | '';
    inspectorId: number | '';
    inspectionStage: InspectionStage;
    shiftName: string;
    batchNo: string;
    heatNo: string;
    lotQty: number;
    sampleSize: number;
    remarks: string;
    params: InProcessQcParamItem[];
  }>({
    ipqcDate: new Date().toISOString().split('T')[0],
    woId: '',
    jobCardId: '',
    woRoutingOpId: '',
    itemId: '',
    workCenterId: '',
    machineId: '',
    assignedOperatorId: '',
    inspectorId: '',
    inspectionStage: 'STAGE_COMPLETION',
    shiftName: 'Shift A',
    batchNo: '',
    heatNo: '',
    lotQty: 50,
    sampleSize: 5,
    remarks: '',
    params: [
      {
        paramSequence: 1,
        paramName: 'Outside Diameter (OD)',
        paramCategory: 'DIMENSIONAL',
        instrumentName: 'Digital Vernier Caliper (V-04)',
        nominalVal: 150.0,
        minTolerance: 149.8,
        maxTolerance: 150.2,
        uomCode: 'mm',
        obsVal1: 150.02,
        obsVal2: 150.05,
        obsVal3: 149.98,
        obsVal4: 150.01,
        obsVal5: 150.04,
        meanVal: 150.02,
        visualResult: 'PASS',
        paramResult: 'PASS',
        deviationRemarks: '',
      },
      {
        paramSequence: 2,
        paramName: 'Surface Roughness (Ra)',
        paramCategory: 'SURFACE_FINISH',
        instrumentName: 'Mitutoyo Surftest SJ-210',
        nominalVal: 0.8,
        minTolerance: 0.4,
        maxTolerance: 0.8,
        uomCode: 'µm',
        obsVal1: 0.65,
        obsVal2: 0.72,
        obsVal3: 0.68,
        obsVal4: 0.7,
        obsVal5: 0.66,
        meanVal: 0.682,
        visualResult: 'PASS',
        paramResult: 'PASS',
        deviationRemarks: '',
      },
    ],
  });

  // Form State for Approval
  const [approvalForm, setApprovalForm] = useState<{
    overallResult: OverallResult;
    acceptedQty: number;
    rejectedQty: number;
    reworkQty: number;
    dispositionType: DispositionType;
    deviationReason: string;
    isCapaRequired: boolean;
    ncrNo: string;
    remarks: string;
  }>({
    overallResult: 'ACCEPTED',
    acceptedQty: 50,
    rejectedQty: 0,
    reworkQty: 0,
    dispositionType: 'DIRECT_ACCEPT',
    deviationReason: '',
    isCapaRequired: false,
    ncrNo: '',
    remarks: '',
  });

  // Form State for Concession / Deviation
  const [deviationForm, setDeviationForm] = useState<{
    deviationReason: string;
    dispositionType: DispositionType;
    remarks: string;
  }>({
    deviationReason: '',
    dispositionType: 'CONCESSION_USE_AS_IS',
    remarks: '',
  });

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery<
    ApiResponse<InProcessQcSummary>
  >({
    queryKey: ['in-process-qc-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<InProcessQcSummary>>('/quality/in-process-qc/summary');
      return res.data;
    },
  });

  const { data: lookupsData } = useQuery<ApiResponse<LookupsData>>({
    queryKey: ['in-process-qc-lookups'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<LookupsData>>('/quality/in-process-qc/lookups');
      return res.data;
    },
  });

  const {
    data: listData,
    isLoading: isListLoading,
    refetch: refetchList,
  } = useQuery<ApiResponse<InProcessQcRecord[]>>({
    queryKey: [
      'in-process-qc-list',
      stageFilter,
      verdictFilter,
      statusFilter,
      searchTerm,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stageFilter !== 'ALL') params.append('inspectionStage', stageFilter);
      if (verdictFilter !== 'ALL') params.append('overallResult', verdictFilter);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (searchTerm) params.append('search', searchTerm);
      const res = await apiClient.get<ApiResponse<InProcessQcRecord[]>>(`/quality/in-process-qc?${params.toString()}`);
      return res.data;
    },
  });

  const summary = summaryData?.data || {
    totalInspections: 0,
    firstPieceApproved: 0,
    deviationCount: 0,
    rejectedCount: 0,
    activePendingCount: 0,
  };

  const records: InProcessQcRecord[] = Array.isArray(listData?.data)
    ? listData.data
    : Array.isArray((listData?.data as any)?.data)
    ? (listData?.data as any).data
    : [];
  const lookups = lookupsData?.data || {
    workOrders: [],
    jobCards: [],
    workCenters: [],
    machines: [],
    users: [],
    items: [],
  };

  // Filtered by tab
  const displayedRecords = useMemo(() => {
    if (activeTab === 'FIRST_PIECE') {
      return records.filter((r) => r.inspectionStage === 'FIRST_PIECE');
    }
    if (activeTab === 'DEVIATIONS') {
      return records.filter(
        (r) => r.overallResult === 'ACCEPTED_UNDER_DEVIATION',
      );
    }
    if (activeTab === 'REJECTIONS') {
      return records.filter((r) => r.overallResult === 'REJECTED');
    }
    return records;
  }, [records, activeTab]);

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: (payload: any) =>
      apiClient.post('/quality/in-process-qc', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['in-process-qc-list'] });
      queryClient.invalidateQueries({ queryKey: ['in-process-qc-summary'] });
      setIsCreateModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      alert(`Error creating inspection: ${err.message || 'Unknown error'}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      apiClient.put(`/quality/in-process-qc/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['in-process-qc-list'] });
      queryClient.invalidateQueries({ queryKey: ['in-process-qc-summary'] });
      setEditingRecord(null);
      resetForm();
    },
    onError: (err: any) => {
      alert(`Error updating inspection: ${err.message || 'Unknown error'}`);
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      apiClient.post(`/quality/in-process-qc/${id}/approve`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['in-process-qc-list'] });
      queryClient.invalidateQueries({ queryKey: ['in-process-qc-summary'] });
      setApprovingRecord(null);
    },
    onError: (err: any) => {
      alert(`Error recording verdict: ${err.message || 'Unknown error'}`);
    },
  });

  const deviationMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      apiClient.post(`/quality/in-process-qc/${id}/deviation`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['in-process-qc-list'] });
      queryClient.invalidateQueries({ queryKey: ['in-process-qc-summary'] });
      setDeviationRecord(null);
    },
    onError: (err: any) => {
      alert(`Error granting concession: ${err.message || 'Unknown error'}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiClient.delete(`/quality/in-process-qc/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['in-process-qc-list'] });
      queryClient.invalidateQueries({ queryKey: ['in-process-qc-summary'] });
      setDeletingRecord(null);
    },
    onError: (err: any) => {
      alert(`Error cancelling inspection: ${err.message || 'Unknown error'}`);
    },
  });

  // --------------------------------------------------------------------------
  // Helpers & Handlers
  // --------------------------------------------------------------------------
  const resetForm = () => {
    setFormState({
      ipqcDate: new Date().toISOString().split('T')[0],
      woId: '',
      jobCardId: '',
      woRoutingOpId: '',
      itemId: '',
      workCenterId: '',
      machineId: '',
      assignedOperatorId: '',
      inspectorId: '',
      inspectionStage: 'STAGE_COMPLETION',
      shiftName: 'Shift A',
      batchNo: '',
      heatNo: '',
      lotQty: 50,
      sampleSize: 5,
      remarks: '',
      params: [
        {
          paramSequence: 1,
          paramName: 'Outside Diameter (OD)',
          paramCategory: 'DIMENSIONAL',
          instrumentName: 'Digital Vernier Caliper (V-04)',
          nominalVal: 150.0,
          minTolerance: 149.8,
          maxTolerance: 150.2,
          uomCode: 'mm',
          obsVal1: 150.02,
          obsVal2: 150.05,
          obsVal3: 149.98,
          obsVal4: 150.01,
          obsVal5: 150.04,
          meanVal: 150.02,
          visualResult: 'PASS',
          paramResult: 'PASS',
          deviationRemarks: '',
        },
      ],
    });
  };

  const handleJobCardSelect = (jcId: number) => {
    const selected = lookups.jobCards.find((j) => j.jobCardId === jcId);
    if (!selected) return;

    setFormState((prev) => ({
      ...prev,
      jobCardId: jcId,
      woId: selected.woId,
      woRoutingOpId: selected.woRoutingOpId || '',
      itemId: selected.itemId,
      workCenterId: selected.workCenterId,
      machineId: selected.machineId || '',
      assignedOperatorId: selected.assignedOperatorId || '',
      batchNo: selected.batchNo || prev.batchNo,
      heatNo: selected.heatNo || prev.heatNo,
      lotQty: selected.completedQty > 0 ? selected.completedQty : selected.plannedQty,
    }));
  };

  const handleParamChange = (
    index: number,
    field: keyof InProcessQcParamItem,
    val: any,
  ) => {
    setFormState((prev) => {
      const nextParams = [...prev.params];
      const p = { ...nextParams[index], [field]: val };

      // Recompute mean if obs changed
      if (
        field === 'obsVal1' ||
        field === 'obsVal2' ||
        field === 'obsVal3' ||
        field === 'obsVal4' ||
        field === 'obsVal5'
      ) {
        const obsArr = [
          p.obsVal1,
          p.obsVal2,
          p.obsVal3,
          p.obsVal4,
          p.obsVal5,
        ].filter((v) => v !== null && v !== undefined && !isNaN(Number(v)));

        if (obsArr.length > 0) {
          const sum: number = obsArr.reduce(
            (acc: number, curr) => acc + Number(curr),
            0,
          );
          p.meanVal = parseFloat((sum / obsArr.length).toFixed(4));
        } else {
          p.meanVal = null;
        }

        // Auto determine pass/fail if min & max tolerance exist
        if (
          p.meanVal !== null &&
          p.minTolerance !== null &&
          p.minTolerance !== undefined &&
          p.maxTolerance !== null &&
          p.maxTolerance !== undefined
        ) {
          if (
            p.meanVal >= Number(p.minTolerance) &&
            p.meanVal <= Number(p.maxTolerance)
          ) {
            p.paramResult = 'PASS';
          } else {
            p.paramResult = 'FAIL';
          }
        }
      }

      nextParams[index] = p;
      return { ...prev, params: nextParams };
    });
  };

  const addParamRow = (category: ParamCategory = 'DIMENSIONAL') => {
    setFormState((prev) => ({
      ...prev,
      params: [
        ...prev.params,
        {
          paramSequence: prev.params.length + 1,
          paramName:
            category === 'DIMENSIONAL'
              ? 'Bore Internal Diameter'
              : category === 'SURFACE_FINISH'
                ? 'Surface Finish Ra'
                : category === 'METALLURGICAL'
                  ? 'Rockwell Hardness'
                  : 'Visual Defect Check',
          paramCategory: category,
          instrumentName:
            category === 'DIMENSIONAL'
              ? 'Internal Micrometer'
              : category === 'SURFACE_FINISH'
                ? 'Surface Tester'
                : category === 'METALLURGICAL'
                  ? 'Hardness Tester'
                  : '10x Magnifier',
          nominalVal: category === 'VISUAL' ? null : 50.0,
          minTolerance: category === 'VISUAL' ? null : 49.95,
          maxTolerance: category === 'VISUAL' ? null : 50.05,
          uomCode: category === 'SURFACE_FINISH' ? 'µm' : category === 'METALLURGICAL' ? 'HRC' : category === 'VISUAL' ? 'Visual' : 'mm',
          obsVal1: category === 'VISUAL' ? null : 50.01,
          obsVal2: null,
          obsVal3: null,
          obsVal4: null,
          obsVal5: null,
          meanVal: category === 'VISUAL' ? null : 50.01,
          visualResult: 'PASS',
          paramResult: 'PASS',
          deviationRemarks: '',
        },
      ],
    }));
  };

  const removeParamRow = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      params: prev.params.filter((_, i) => i !== index),
    }));
  };

  const handleEditClick = (rec: InProcessQcRecord) => {
    setEditingRecord(rec);
    setFormState({
      ipqcDate: rec.ipqcDate.split('T')[0],
      woId: rec.woId,
      jobCardId: rec.jobCardId || '',
      woRoutingOpId: rec.woRoutingOpId || '',
      itemId: rec.itemId,
      workCenterId: rec.workCenterId || '',
      machineId: rec.machineId || '',
      assignedOperatorId: rec.assignedOperatorId || '',
      inspectorId: rec.inspectorId,
      inspectionStage: rec.inspectionStage,
      shiftName: rec.shiftName,
      batchNo: rec.batchNo || '',
      heatNo: rec.heatNo || '',
      lotQty: rec.lotQty,
      sampleSize: rec.sampleSize,
      remarks: rec.remarks || '',
      params:
        rec.params && rec.params.length > 0
          ? rec.params
          : [
              {
                paramSequence: 1,
                paramName: 'Critical Dimension',
                paramCategory: 'DIMENSIONAL',
                instrumentName: 'Vernier Caliper',
                nominalVal: 50.0,
                minTolerance: 49.9,
                maxTolerance: 50.1,
                uomCode: 'mm',
                obsVal1: 50.02,
                meanVal: 50.02,
                visualResult: 'PASS',
                paramResult: 'PASS',
              },
            ],
    });
  };

  const handleApprovalClick = (rec: InProcessQcRecord) => {
    setApprovingRecord(rec);
    setApprovalForm({
      overallResult: rec.overallResult === 'PENDING' ? 'ACCEPTED' : rec.overallResult,
      acceptedQty: rec.acceptedQty > 0 ? rec.acceptedQty : rec.lotQty,
      rejectedQty: rec.rejectedQty,
      reworkQty: rec.reworkQty,
      dispositionType: rec.dispositionType || 'DIRECT_ACCEPT',
      deviationReason: rec.deviationReason || '',
      isCapaRequired: rec.isCapaRequired || false,
      ncrNo: rec.ncrNo || '',
      remarks: rec.remarks || '',
    });
  };

  const handleDeviationClick = (rec: InProcessQcRecord) => {
    setDeviationRecord(rec);
    setDeviationForm({
      deviationReason: rec.deviationReason || '',
      dispositionType: rec.dispositionType || 'CONCESSION_USE_AS_IS',
      remarks: rec.remarks || '',
    });
  };

  // --------------------------------------------------------------------------
  // Table Columns Definition
  // --------------------------------------------------------------------------
  const columns: MasterTableColumn<InProcessQcRecord>[] = [
    {
      key: 'ipqcNo',
      header: 'Inspection #',
      sortable: true,
      sortValue: (row) => row.ipqcId,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            {row.ipqcNo}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {new Date(row.ipqcDate).toLocaleDateString()} • {row.shiftName}
          </span>
        </div>
      ),
    },
    {
      key: 'workOrder',
      header: 'Work Order & Stage',
      sortable: true,
      sortValue: (row) => row.woNo,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {row.woNo}
          </span>
          <span className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
            <Layers className="w-3 h-3" />
            {row.opCode ? `${row.opCode} - ${row.opName}` : 'Operation Stage'}
          </span>
        </div>
      ),
    },
    {
      key: 'item',
      header: 'Component / Part',
      sortable: true,
      sortValue: (row) => row.itemName,
      render: (row) => (
        <div className="flex flex-col max-w-[200px]">
          <span className="font-medium text-slate-800 dark:text-slate-100 truncate" title={row.itemName}>
            {row.itemName}
          </span>
          <span className="text-xs text-slate-500 font-mono">
            {row.itemCode}
          </span>
        </div>
      ),
    },
    {
      key: 'stage',
      header: 'Stage Gate',
      sortable: true,
      sortValue: (row) => row.inspectionStage,
      render: (row) => {
        const stageColors: Record<InspectionStage, string> = {
          FIRST_PIECE: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800',
          PATROL_INSPECTION: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
          STAGE_COMPLETION: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
          LAST_PIECE: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
        };
        const stageLabels: Record<InspectionStage, string> = {
          FIRST_PIECE: '1st-Piece Setup',
          PATROL_INSPECTION: 'Patrol Check',
          STAGE_COMPLETION: 'Stage Clearance',
          LAST_PIECE: 'Last-Piece Tool',
        };
        const stg = row.inspectionStage as InspectionStage;
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${stageColors[stg] || stageColors.STAGE_COMPLETION}`}>
            {stageLabels[stg] || stg}
          </span>
        );
      },
    },
    {
      key: 'lotQuantities',
      header: 'Lot / Sample / Acc',
      render: (row) => (
        <div className="flex flex-col text-xs font-mono">
          <span className="text-slate-700 dark:text-slate-300">
            Lot: <strong>{row.lotQty}</strong> | Smpl: <strong>{row.sampleSize}</strong>
          </span>
          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
            Acc: {row.acceptedQty} | Rej: {row.rejectedQty}
          </span>
        </div>
      ),
    },
    {
      key: 'parameters',
      header: 'Parameters Checked',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono">
            {row.paramCount || 0} Chars
          </span>
          {(row.failCount || 0) > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 font-semibold dark:bg-rose-950/50 dark:text-rose-400">
              {row.failCount} Fail
            </span>
          )}
          {(row.concessionCount || 0) > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold dark:bg-amber-950/50 dark:text-amber-400">
              {row.concessionCount} Dev
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'overallResult',
      header: 'Verdict',
      sortable: true,
      sortValue: (row) => row.overallResult,
      render: (row) => {
        const resultBadge: Record<OverallResult, { label: string; cls: string; icon: any }> = {
          ACCEPTED: {
            label: 'ACCEPTED',
            cls: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-700',
            icon: CheckCircle2,
          },
          ACCEPTED_UNDER_DEVIATION: {
            label: 'CONCESSION / DEV',
            cls: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-700',
            icon: ShieldAlert,
          },
          REJECTED: {
            label: 'REJECTED',
            cls: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-700',
            icon: XCircle,
          },
          PENDING: {
            label: 'PENDING QA',
            cls: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
            icon: Clock,
          },
        };
        const b = resultBadge[row.overallResult as OverallResult] || resultBadge.PENDING;
        const Icon = b.icon;
        return (
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${b.cls}`}>
            <Icon className="w-3.5 h-3.5" />
            {b.label}
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
            onClick={async () => {
              const res = await apiClient.get<ApiResponse<InProcessQcRecord>>(
                `/quality/in-process-qc/${row.ipqcId}`,
              );
              setViewingRecord(res.data.data);
            }}
            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
            title="View Stage Parameters & Inspection Protocol"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Edit (if DRAFT or IN_PROGRESS) */}
          <PermissionGate screen="IN_PROCESS_QC" action="EDIT">
            {row.status !== 'COMPLETED' && (
              <button
                onClick={async () => {
                  const res = await apiClient.get<ApiResponse<InProcessQcRecord>>(
                    `/quality/in-process-qc/${row.ipqcId}`,
                  );
                  handleEditClick(res.data.data);
                }}
                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                title="Edit Inspection Data"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
          </PermissionGate>

          {/* Approve / Reject Verdict */}
          <PermissionGate screen="IN_PROCESS_QC" action="APPROVE">
            <button
              onClick={() => handleApprovalClick(row)}
              className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
              title="Record Final Verdict & Quality Clearance"
            >
              <FileCheck2 className="w-4 h-4" />
            </button>
          </PermissionGate>

          {/* Authorize Concession / Deviation */}
          <PermissionGate screen="IN_PROCESS_QC" action="DEVIATION">
            <button
              onClick={() => handleDeviationClick(row)}
              className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
              title="Authorize Technical Concession / Deviation"
            >
              <ShieldAlert className="w-4 h-4" />
            </button>
          </PermissionGate>

          {/* Print Certificate */}
          <PermissionGate screen="IN_PROCESS_QC" action="PRINT">
            <button
              onClick={async () => {
                const res = await apiClient.get<ApiResponse<InProcessQcRecord>>(
                  `/quality/in-process-qc/${row.ipqcId}`,
                );
                setPrintingRecord(res.data.data);
              }}
              className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
              title="Print ISO/IATF Stage Inspection Report"
            >
              <Printer className="w-4 h-4" />
            </button>
          </PermissionGate>

          {/* Delete / Cancel */}
          <PermissionGate screen="IN_PROCESS_QC" action="DELETE">
            {row.status !== 'COMPLETED' && (
              <button
                onClick={() => setDeletingRecord(row)}
                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                title="Cancel Inspection"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </PermissionGate>
        </div>
      ),
    },
  ];

  // Group By options
  const groupByOptions: GroupByOption<InProcessQcRecord>[] = [
    { label: 'Work Order', key: 'woNo', groupValue: (r) => r.woNo },
    { label: 'Inspection Stage', key: 'inspectionStage', groupValue: (r) => r.inspectionStage },
    { label: 'Quality Verdict', key: 'overallResult', groupValue: (r) => r.overallResult },
  ];

  return (
    <div className="space-y-6">
      {/* -------------------------------------------------------------------- */}
      {/* Page Header                                                          */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 rounded-lg text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            In-Process & Stage-Wise Quality Inspection
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            First-off approval, in-process patrol inspection, dimensional sampling, and technical concession gating across production job cards.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <PermissionGate screen="IN_PROCESS_QC" action="EXPORT">
            <button
              onClick={() => {
                // Export CSV
                const headers = 'InspectionNo,Date,WorkOrder,JobCard,Component,Stage,LotQty,SampleSize,Accepted,Rejected,Verdict,Status\n';
                const rows = displayedRecords
                  .map(
                    (r) =>
                      `"${r.ipqcNo}","${r.ipqcDate}","${r.woNo}","${r.jobCardNo || ''}","${r.itemCode}","${r.inspectionStage}",${r.lotQty},${r.sampleSize},${r.acceptedQty},${r.rejectedQty},"${r.overallResult}","${r.status}"`,
                  )
                  .join('\n');
                const blob = new Blob([headers + rows], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `InProcess_QC_Register_${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Export Register
            </button>
          </PermissionGate>

          <PermissionGate screen="IN_PROCESS_QC" action="ADD">
            <button
              onClick={() => {
                resetForm();
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Record Stage Inspection
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 4 KPI Summary Cards                                                  */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Inspections */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Stage Inspections
            </span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
              <FlaskConical className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">
              {summary.totalInspections}
            </span>
            <span className="text-xs text-slate-500">
              ({summary.activePendingCount} pending QA)
            </span>
          </div>
        </div>

        {/* Card 2: 1st Piece Setup Approvals */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              1st Piece Setup Passes
            </span>
            <div className="p-2 bg-purple-50 dark:bg-purple-950/50 rounded-lg text-purple-600 dark:text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {summary.firstPieceApproved}
            </span>
            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
              Tooling Verified
            </span>
          </div>
        </div>

        {/* Card 3: Concessions / Deviations */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Concessions / Deviations
            </span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 rounded-lg text-amber-600 dark:text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {summary.deviationCount}
            </span>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
              Use-As-Is Authorized
            </span>
          </div>
        </div>

        {/* Card 4: Rejections & Scraps */}
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Stage Rejections & Scraps
            </span>
            <div className="p-2 bg-rose-50 dark:bg-rose-950/50 rounded-lg text-rose-600 dark:text-rose-400">
              <XCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600 dark:text-rose-400">
              {summary.rejectedCount}
            </span>
            <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">
              CAPA Gated
            </span>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Tabs & Filters Bar                                                   */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-4 space-y-4">
        {/* Tab Buttons */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('ALL')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'ALL'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            All Inspections ({records.length})
          </button>
          <button
            onClick={() => setActiveTab('FIRST_PIECE')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'FIRST_PIECE'
                ? 'bg-purple-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            1st-Piece Setup Approvals
          </button>
          <button
            onClick={() => setActiveTab('DEVIATIONS')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'DEVIATIONS'
                ? 'bg-amber-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Technical Concessions & Deviations
          </button>
          <button
            onClick={() => setActiveTab('REJECTIONS')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeTab === 'REJECTIONS'
                ? 'bg-rose-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            Rejections & Scraps
          </button>
        </div>

        {/* Search & Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by IPQC #, WO #, Part..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Inspection Stages</option>
              <option value="FIRST_PIECE">First Piece Setup</option>
              <option value="PATROL_INSPECTION">Patrol Inspection</option>
              <option value="STAGE_COMPLETION">Stage Clearance</option>
              <option value="LAST_PIECE">Last Piece Tooling</option>
            </select>
          </div>

          <div>
            <select
              value={verdictFilter}
              onChange={(e) => setVerdictFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Quality Verdicts</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="ACCEPTED_UNDER_DEVIATION">Concession / Deviation</option>
              <option value="REJECTED">Rejected</option>
              <option value="PENDING">Pending QA</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Document Statuses</option>
              <option value="COMPLETED">Completed</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="DRAFT">Draft</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Master Data Table                                                    */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <MasterDataTable<InProcessQcRecord>
          title="In-Process & Stage Quality Inspections"
          subtitle="First-off approval, in-process patrol inspection, dimensional sampling, and technical concession gating"
          screenCode="IN_PROCESS_QC"
          tableNameBadge="tbl_qc_in_process_header"
          data={displayedRecords}
          columns={columns}
          isLoading={isListLoading}
          rowKey={(row) => row.ipqcId}
          searchPredicate={(row, q) => {
            const query = q.toLowerCase();
            return (
              row.ipqcNo.toLowerCase().includes(query) ||
              row.woNo.toLowerCase().includes(query) ||
              row.itemName.toLowerCase().includes(query) ||
              row.itemCode.toLowerCase().includes(query) ||
              (Boolean(row.batchNo) && Boolean(row.batchNo?.toLowerCase().includes(query))) ||
              (Boolean(row.jobCardNo) && Boolean(row.jobCardNo?.toLowerCase().includes(query)))
            );
          }}
          groupByOptions={groupByOptions}
          addButtonLabel="Record Stage Inspection"
          onAddClick={() => {
            resetForm();
            setIsCreateModalOpen(true);
          }}
        />
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Modal 1: Create / Edit Stage Inspection                              */}
      {/* -------------------------------------------------------------------- */}
      {(isCreateModalOpen || editingRecord) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-5xl my-8 overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 rounded-lg text-emerald-600 dark:text-emerald-400">
                  <Sliders className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {editingRecord
                      ? `Edit In-Process QC (#${editingRecord.ipqcNo})`
                      : 'Record In-Process & Stage-Wise Inspection'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Capture 5-point observations, tolerance limits, and operational stage gating.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingRecord(null);
                  resetForm();
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!formState.woId || !formState.itemId) {
                  alert('Please select a Work Order and Item.');
                  return;
                }
                const payload = {
                  ...formState,
                  woId: Number(formState.woId),
                  jobCardId: formState.jobCardId ? Number(formState.jobCardId) : undefined,
                  woRoutingOpId: formState.woRoutingOpId ? Number(formState.woRoutingOpId) : undefined,
                  itemId: Number(formState.itemId),
                  workCenterId: formState.workCenterId ? Number(formState.workCenterId) : undefined,
                  machineId: formState.machineId ? Number(formState.machineId) : undefined,
                  assignedOperatorId: formState.assignedOperatorId ? Number(formState.assignedOperatorId) : undefined,
                  inspectorId: formState.inspectorId ? Number(formState.inspectorId) : undefined,
                  lotQty: Number(formState.lotQty),
                  sampleSize: Number(formState.sampleSize),
                };

                if (editingRecord) {
                  updateMutation.mutate({ id: editingRecord.ipqcId, payload });
                } else {
                  createMutation.mutate(payload);
                }
              }}
              className="p-6 space-y-6 max-h-[80vh] overflow-y-auto"
            >
              {/* Row 1: Work Order & Job Card linking */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Select Job Card (Auto-Fills Details)
                  </label>
                  <select
                    value={formState.jobCardId}
                    onChange={(e) => handleJobCardSelect(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Select Active Job Card --</option>
                    {lookups.jobCards.map((jc) => (
                      <option key={jc.jobCardId} value={jc.jobCardId}>
                        {jc.jobCardNo} • {jc.opCode} ({jc.opName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Work Order *
                  </label>
                  <select
                    value={formState.woId}
                    onChange={(e) => {
                      const woId = Number(e.target.value);
                      const wo = lookups.workOrders.find((w) => w.woId === woId);
                      setFormState((prev) => ({
                        ...prev,
                        woId,
                        itemId: wo?.itemId || prev.itemId,
                      }));
                    }}
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Select Work Order --</option>
                    {lookups.workOrders.map((wo) => (
                      <option key={wo.woId} value={wo.woId}>
                        {wo.woNo} (Qty: {wo.plannedQty})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Component / Part *
                  </label>
                  <select
                    value={formState.itemId}
                    onChange={(e) => setFormState((prev) => ({ ...prev, itemId: Number(e.target.value) }))}
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Select Part --</option>
                    {lookups.items.map((it) => (
                      <option key={it.itemId} value={it.itemId}>
                        {it.itemCode} - {it.itemName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Stage, Shift, Work Center, Machine */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Inspection Stage Gate *
                  </label>
                  <select
                    value={formState.inspectionStage}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        inspectionStage: e.target.value as InspectionStage,
                      }))
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="FIRST_PIECE">First Piece Setup Approval</option>
                    <option value="PATROL_INSPECTION">Patrol Inspection</option>
                    <option value="STAGE_COMPLETION">Stage Clearance</option>
                    <option value="LAST_PIECE">Last Piece Tool Wear</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Shift *
                  </label>
                  <select
                    value={formState.shiftName}
                    onChange={(e) => setFormState((prev) => ({ ...prev, shiftName: e.target.value }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Shift A">Shift A (Morning 07:00 - 15:30)</option>
                    <option value="Shift B">Shift B (Evening 15:30 - 00:00)</option>
                    <option value="Shift C">Shift C (Night 00:00 - 07:00)</option>
                    <option value="General Shift">General Shift</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Work Center
                  </label>
                  <select
                    value={formState.workCenterId}
                    onChange={(e) => setFormState((prev) => ({ ...prev, workCenterId: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Work Center --</option>
                    {lookups.workCenters.map((wc) => (
                      <option key={wc.workCenterId} value={wc.workCenterId}>
                        {wc.wcCode} - {wc.wcName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Machine
                  </label>
                  <select
                    value={formState.machineId}
                    onChange={(e) => setFormState((prev) => ({ ...prev, machineId: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Machine / Tool Cell --</option>
                    {lookups.machines.map((mc) => (
                      <option key={mc.machineId} value={mc.machineId}>
                        {mc.machineCode} - {mc.machineName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 3: Batch, Heat, Lot Qty, Sample Size */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Batch / Lot #
                  </label>
                  <input
                    type="text"
                    value={formState.batchNo}
                    onChange={(e) => setFormState((prev) => ({ ...prev, batchNo: e.target.value }))}
                    placeholder="e.g. BATCH-VALVE-26-01"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Heat / Melt #
                  </label>
                  <input
                    type="text"
                    value={formState.heatNo}
                    onChange={(e) => setFormState((prev) => ({ ...prev, heatNo: e.target.value }))}
                    placeholder="e.g. HEAT-SS316-441"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Stage Lot Quantity *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={formState.lotQty}
                    onChange={(e) => setFormState((prev) => ({ ...prev, lotQty: Number(e.target.value) }))}
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Sample Size (Units) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formState.sampleSize}
                    onChange={(e) => setFormState((prev) => ({ ...prev, sampleSize: Number(e.target.value) }))}
                    required
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              {/* ------------------------------------------------------------ */}
              {/* Section: Dynamic Characteristic Parameters Matrix            */}
              {/* ------------------------------------------------------------ */}
              <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Gauge className="w-4 h-4 text-emerald-500" />
                      Characteristic Parameters & 5-Point Observations Matrix
                    </h4>
                    <p className="text-xs text-slate-500">
                      Record nominals, tolerance boundaries, instrument IDs, and up to 5 sample observations. Mean and Pass/Fail calculate automatically.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => addParamRow('DIMENSIONAL')}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      + Dimensional
                    </button>
                    <button
                      type="button"
                      onClick={() => addParamRow('SURFACE_FINISH')}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      + Surface (Ra)
                    </button>
                    <button
                      type="button"
                      onClick={() => addParamRow('METALLURGICAL')}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      + Hardness
                    </button>
                    <button
                      type="button"
                      onClick={() => addParamRow('VISUAL')}
                      className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      + Visual
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-3 py-2 w-8">#</th>
                        <th className="px-3 py-2 min-w-[140px]">Parameter Name</th>
                        <th className="px-3 py-2 min-w-[100px]">Category</th>
                        <th className="px-3 py-2 min-w-[120px]">Instrument Used</th>
                        <th className="px-2 py-2 w-16">Nominal</th>
                        <th className="px-2 py-2 w-16">Min Tol</th>
                        <th className="px-2 py-2 w-16">Max Tol</th>
                        <th className="px-2 py-2 w-12">UOM</th>
                        <th className="px-2 py-2 w-14">Obs 1</th>
                        <th className="px-2 py-2 w-14">Obs 2</th>
                        <th className="px-2 py-2 w-14">Obs 3</th>
                        <th className="px-2 py-2 w-14">Obs 4</th>
                        <th className="px-2 py-2 w-14">Obs 5</th>
                        <th className="px-2 py-2 w-16">Mean</th>
                        <th className="px-3 py-2 w-24">Verdict</th>
                        <th className="px-2 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                      {formState.params.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-3 py-2 text-slate-400 font-sans">{idx + 1}</td>
                          <td className="px-2 py-2 font-sans">
                            <input
                              type="text"
                              value={p.paramName}
                              onChange={(e) => handleParamChange(idx, 'paramName', e.target.value)}
                              className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs"
                            />
                          </td>
                          <td className="px-2 py-2 font-sans">
                            <select
                              value={p.paramCategory}
                              onChange={(e) => handleParamChange(idx, 'paramCategory', e.target.value)}
                              className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs"
                            >
                              <option value="DIMENSIONAL">Dimensional</option>
                              <option value="SURFACE_FINISH">Surface Ra</option>
                              <option value="METALLURGICAL">Hardness</option>
                              <option value="VISUAL">Visual</option>
                              <option value="FUNCTIONAL">Functional</option>
                            </select>
                          </td>
                          <td className="px-2 py-2 font-sans">
                            <input
                              type="text"
                              value={p.instrumentName || ''}
                              onChange={(e) => handleParamChange(idx, 'instrumentName', e.target.value)}
                              placeholder="e.g. Vernier V-04"
                              className="w-full px-2 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs"
                            />
                          </td>
                          <td className="px-1 py-2">
                            <input
                              type="number"
                              step="0.001"
                              value={p.nominalVal ?? ''}
                              onChange={(e) => handleParamChange(idx, 'nominalVal', e.target.value !== '' ? Number(e.target.value) : null)}
                              className="w-full px-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-right"
                            />
                          </td>
                          <td className="px-1 py-2">
                            <input
                              type="number"
                              step="0.001"
                              value={p.minTolerance ?? ''}
                              onChange={(e) => handleParamChange(idx, 'minTolerance', e.target.value !== '' ? Number(e.target.value) : null)}
                              className="w-full px-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-right"
                            />
                          </td>
                          <td className="px-1 py-2">
                            <input
                              type="number"
                              step="0.001"
                              value={p.maxTolerance ?? ''}
                              onChange={(e) => handleParamChange(idx, 'maxTolerance', e.target.value !== '' ? Number(e.target.value) : null)}
                              className="w-full px-1.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-right"
                            />
                          </td>
                          <td className="px-1 py-2">
                            <input
                              type="text"
                              value={p.uomCode || 'mm'}
                              onChange={(e) => handleParamChange(idx, 'uomCode', e.target.value)}
                              className="w-full px-1 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-center"
                            />
                          </td>
                          <td className="px-1 py-2">
                            <input
                              type="number"
                              step="0.001"
                              value={p.obsVal1 ?? ''}
                              onChange={(e) => handleParamChange(idx, 'obsVal1', e.target.value !== '' ? Number(e.target.value) : null)}
                              className="w-full px-1 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-right"
                            />
                          </td>
                          <td className="px-1 py-2">
                            <input
                              type="number"
                              step="0.001"
                              value={p.obsVal2 ?? ''}
                              onChange={(e) => handleParamChange(idx, 'obsVal2', e.target.value !== '' ? Number(e.target.value) : null)}
                              className="w-full px-1 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-right"
                            />
                          </td>
                          <td className="px-1 py-2">
                            <input
                              type="number"
                              step="0.001"
                              value={p.obsVal3 ?? ''}
                              onChange={(e) => handleParamChange(idx, 'obsVal3', e.target.value !== '' ? Number(e.target.value) : null)}
                              className="w-full px-1 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-right"
                            />
                          </td>
                          <td className="px-1 py-2">
                            <input
                              type="number"
                              step="0.001"
                              value={p.obsVal4 ?? ''}
                              onChange={(e) => handleParamChange(idx, 'obsVal4', e.target.value !== '' ? Number(e.target.value) : null)}
                              className="w-full px-1 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-right"
                            />
                          </td>
                          <td className="px-1 py-2">
                            <input
                              type="number"
                              step="0.001"
                              value={p.obsVal5 ?? ''}
                              onChange={(e) => handleParamChange(idx, 'obsVal5', e.target.value !== '' ? Number(e.target.value) : null)}
                              className="w-full px-1 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded text-xs text-right"
                            />
                          </td>
                          <td className="px-1 py-2 text-right font-bold text-slate-800 dark:text-slate-200">
                            {p.meanVal !== null && p.meanVal !== undefined ? p.meanVal : '-'}
                          </td>
                          <td className="px-2 py-2 font-sans">
                            <select
                              value={p.paramResult}
                              onChange={(e) => handleParamChange(idx, 'paramResult', e.target.value)}
                              className={`w-full px-1.5 py-1 rounded text-xs font-semibold ${
                                p.paramResult === 'PASS'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : p.paramResult === 'CONCESSION'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              <option value="PASS">PASS</option>
                              <option value="CONCESSION">CONCESSION</option>
                              <option value="FAIL">FAIL</option>
                            </select>
                          </td>
                          <td className="px-2 py-2 text-center">
                            {formState.params.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeParamRow(idx)}
                                className="text-slate-400 hover:text-rose-600 p-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Inspection Remarks / Observations
                </label>
                <textarea
                  rows={2}
                  value={formState.remarks}
                  onChange={(e) => setFormState((prev) => ({ ...prev, remarks: e.target.value }))}
                  placeholder="e.g. Visual burrs found at flange bolt circle; tool feed adjusted for next run..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingRecord(null);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingRecord
                      ? 'Save Changes'
                      : 'Save Inspection Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Modal 2: View Inspection Protocol & Observation Details              */}
      {/* -------------------------------------------------------------------- */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl my-8 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 rounded-lg text-indigo-600 dark:text-indigo-400">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    In-Process Inspection Passport: {viewingRecord.ipqcNo}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Stage: <strong>{viewingRecord.inspectionStage}</strong> • Verdict: <strong>{viewingRecord.overallResult}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingRecord(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Summary Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">Work Order</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                    {viewingRecord.woNo}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Job Card / Op</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {viewingRecord.jobCardNo || 'N/A'} ({viewingRecord.opCode})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Batch / Heat #</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    {viewingRecord.batchNo || 'N/A'} • {viewingRecord.heatNo || 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Inspector & Date</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {viewingRecord.inspectorName || 'QA Staff'} ({new Date(viewingRecord.ipqcDate).toLocaleDateString()})
                  </span>
                </div>
              </div>

              {/* Characteristic Parameters Table */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-500" />
                  Recorded Parameters & Observations
                </h4>
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Characteristic Name</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Instrument</th>
                        <th className="px-2 py-2 text-right">Nominal</th>
                        <th className="px-2 py-2 text-right">Tolerance</th>
                        <th className="px-2 py-2 text-right">Obs 1..5</th>
                        <th className="px-2 py-2 text-right font-bold">Mean</th>
                        <th className="px-3 py-2 text-center">Result</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-mono">
                      {viewingRecord.params?.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="px-3 py-2 text-slate-400 font-sans">{p.paramSequence}</td>
                          <td className="px-3 py-2 font-sans font-semibold text-slate-800 dark:text-slate-200">
                            {p.paramName}
                            {p.deviationRemarks && (
                              <span className="block text-xs font-normal text-amber-600 dark:text-amber-400 mt-0.5">
                                Note: {p.deviationRemarks}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 font-sans text-slate-500">{p.paramCategory}</td>
                          <td className="px-3 py-2 font-sans text-slate-500">{p.instrumentName || '-'}</td>
                          <td className="px-2 py-2 text-right text-slate-700 dark:text-slate-300">
                            {p.nominalVal !== null ? `${p.nominalVal} ${p.uomCode || ''}` : '-'}
                          </td>
                          <td className="px-2 py-2 text-right text-slate-500">
                            {p.minTolerance !== null && p.maxTolerance !== null
                              ? `${p.minTolerance} - ${p.maxTolerance}`
                              : '-'}
                          </td>
                          <td className="px-2 py-2 text-right text-slate-600 dark:text-slate-300">
                            {[p.obsVal1, p.obsVal2, p.obsVal3, p.obsVal4, p.obsVal5]
                              .filter((v) => v !== null && v !== undefined)
                              .join(', ') || '-'}
                          </td>
                          <td className="px-2 py-2 text-right font-bold text-slate-900 dark:text-white">
                            {p.meanVal !== null ? p.meanVal : '-'}
                          </td>
                          <td className="px-3 py-2 text-center font-sans">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold ${
                                p.paramResult === 'PASS'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : p.paramResult === 'CONCESSION'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {p.paramResult}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Disposition & Concession Details if present */}
              {viewingRecord.deviationReason && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-xl border border-amber-200 dark:border-amber-800/60 text-xs space-y-1">
                  <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4" />
                    Authorized Technical Concession / Engineering Deviation
                  </span>
                  <p className="text-amber-700 dark:text-amber-400">
                    {viewingRecord.deviationReason}
                  </p>
                  <span className="block text-slate-500 pt-1">
                    Disposition: <strong>{viewingRecord.dispositionType}</strong> • Approver: {viewingRecord.approverName || 'QA Head'}
                  </span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <button
                onClick={() => {
                  setPrintingRecord(viewingRecord);
                  setViewingRecord(null);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 transition-colors"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                Print Inspection Certificate
              </button>

              <button
                onClick={() => setViewingRecord(null)}
                className="px-4 py-1.5 bg-slate-900 text-white dark:bg-white dark:text-slate-900 rounded-lg text-xs font-semibold hover:opacity-90 transition-opacity"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Modal 3: Approval & Verdict Gating Modal                             */}
      {/* -------------------------------------------------------------------- */}
      {approvingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 rounded-lg text-emerald-600 dark:text-emerald-400">
                  <FileCheck2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Approve Stage Inspection Verdict
                  </h3>
                  <p className="text-xs text-slate-500">
                    Inspection: {approvingRecord.ipqcNo} • Lot Qty: {approvingRecord.lotQty}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setApprovingRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                approveMutation.mutate({
                  id: approvingRecord.ipqcId,
                  payload: {
                    ...approvalForm,
                    acceptedQty: Number(approvalForm.acceptedQty),
                    rejectedQty: Number(approvalForm.rejectedQty),
                    reworkQty: Number(approvalForm.reworkQty),
                  },
                });
              }}
              className="p-6 space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Overall Quality Verdict *
                </label>
                <select
                  value={approvalForm.overallResult}
                  onChange={(e) =>
                    setApprovalForm((prev) => ({
                      ...prev,
                      overallResult: e.target.value as OverallResult,
                      dispositionType:
                        e.target.value === 'REJECTED'
                          ? 'SCRAP'
                          : e.target.value === 'ACCEPTED_UNDER_DEVIATION'
                            ? 'CONCESSION_USE_AS_IS'
                            : 'DIRECT_ACCEPT',
                    }))
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-800 dark:text-slate-200"
                >
                  <option value="ACCEPTED">ACCEPTED (Pass to Next Stage / Lineside)</option>
                  <option value="ACCEPTED_UNDER_DEVIATION">ACCEPTED UNDER DEVIATION (Engineering Concession)</option>
                  <option value="REJECTED">REJECTED (Scrap / Hold / Quarantine)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Accepted Qty *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={approvalForm.acceptedQty}
                    onChange={(e) =>
                      setApprovalForm((prev) => ({
                        ...prev,
                        acceptedQty: Number(e.target.value),
                        rejectedQty: Math.max(0, approvingRecord.lotQty - Number(e.target.value)),
                      }))
                    }
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rejected Qty
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={approvalForm.rejectedQty}
                    onChange={(e) => setApprovalForm((prev) => ({ ...prev, rejectedQty: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-rose-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Rework Qty
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={approvalForm.reworkQty}
                    onChange={(e) => setApprovalForm((prev) => ({ ...prev, reworkQty: Number(e.target.value) }))}
                    className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg font-mono font-bold text-amber-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Material Disposition Action
                </label>
                <select
                  value={approvalForm.dispositionType}
                  onChange={(e) =>
                    setApprovalForm((prev) => ({
                      ...prev,
                      dispositionType: e.target.value as DispositionType,
                    }))
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-200"
                >
                  <option value="DIRECT_ACCEPT">DIRECT ACCEPT (Good Parts Forwarded)</option>
                  <option value="CONCESSION_USE_AS_IS">CONCESSION USE-AS-IS (Deviation Cleared)</option>
                  <option value="REWORK_SAME_OP">REWORK AT SAME WORK CENTER</option>
                  <option value="REWORK_NEW_OP">REWORK AT SPECIALIZED CELL</option>
                  <option value="SCRAP">SCRAP / QUARANTINE HOLD</option>
                </select>
              </div>

              {approvalForm.overallResult === 'ACCEPTED_UNDER_DEVIATION' && (
                <div>
                  <label className="block font-semibold text-amber-700 dark:text-amber-400 mb-1">
                    Deviation / Concession Justification *
                  </label>
                  <textarea
                    rows={2}
                    value={approvalForm.deviationReason}
                    onChange={(e) => setApprovalForm((prev) => ({ ...prev, deviationReason: e.target.value }))}
                    placeholder="Document engineering reasoning why part functions safely..."
                    required
                    className="w-full px-3 py-2 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-lg text-xs"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isCapaRequired"
                  checked={approvalForm.isCapaRequired}
                  onChange={(e) => setApprovalForm((prev) => ({ ...prev, isCapaRequired: e.target.checked }))}
                  className="w-4 h-4 text-emerald-600 rounded"
                />
                <label htmlFor="isCapaRequired" className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Mandate CAPA / Root Cause Corrective Action Report (8D / 5-Why)
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Final QA Remarks
                </label>
                <textarea
                  rows={2}
                  value={approvalForm.remarks}
                  onChange={(e) => setApprovalForm((prev) => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Official QA approval comments..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setApprovingRecord(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={approveMutation.isPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {approveMutation.isPending ? 'Committing Verdict...' : 'Authorize & Update Job Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Modal 4: Technical Concession / Engineering Deviation Modal          */}
      {/* -------------------------------------------------------------------- */}
      {deviationRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-amber-50 dark:bg-amber-950/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg text-amber-600 dark:text-amber-300">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Authorize Technical Concession
                  </h3>
                  <p className="text-xs text-slate-500">
                    Grant deviation waiver for #{deviationRecord.ipqcNo}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeviationRecord(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                deviationMutation.mutate({
                  id: deviationRecord.ipqcId,
                  payload: deviationForm,
                });
              }}
              className="p-6 space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Engineering Justification & Concession Reason *
                </label>
                <textarea
                  rows={3}
                  value={deviationForm.deviationReason}
                  onChange={(e) => setDeviationForm((prev) => ({ ...prev, deviationReason: e.target.value }))}
                  required
                  placeholder="e.g. Chamfer dimension is 1.2mm vs 1.0mm specified. Functional assembly confirmed zero leakage; approved for use-as-is without downstream re-machining."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Disposition Type
                </label>
                <select
                  value={deviationForm.dispositionType}
                  onChange={(e) =>
                    setDeviationForm((prev) => ({
                      ...prev,
                      dispositionType: e.target.value as DispositionType,
                    }))
                  }
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                >
                  <option value="CONCESSION_USE_AS_IS">CONCESSION USE-AS-IS (No Rework Required)</option>
                  <option value="REWORK_SAME_OP">CONDITIONAL REWORK AT WORK CENTER</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  QA Authority Notes
                </label>
                <textarea
                  rows={2}
                  value={deviationForm.remarks}
                  onChange={(e) => setDeviationForm((prev) => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Sign-off notes..."
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeviationRecord(null)}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deviationMutation.isPending}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {deviationMutation.isPending ? 'Signing Concession...' : 'Grant Technical Concession'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Modal 5: Printable ISO/IATF Stage Inspection Certificate             */}
      {/* -------------------------------------------------------------------- */}
      {printingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-4xl my-8 overflow-hidden print:border-none print:shadow-none print:m-0 print:max-w-none">
            {/* Header controls (hidden on print) */}
            <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 print:hidden">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Printer className="w-4 h-4 text-blue-500" />
                Statutory Quality Certificate Preview
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Now
                </button>
                <button
                  onClick={() => setPrintingRecord(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div className="p-8 space-y-6 text-slate-800 dark:text-slate-200 font-sans print:p-6 print:text-black">
              {/* Document Title Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-black tracking-wide text-slate-900 uppercase">
                    Kashvira Infotech Manufacturing ERP
                  </h2>
                  <p className="text-xs text-slate-500">
                    Ahmedabad High-Precision Valve & Discrete Engineering Plant • ISO 9001:2015 / IATF 16949
                  </p>
                  <h3 className="text-base font-bold text-slate-800 uppercase mt-2">
                    In-Process & Stage-Wise Inspection Report
                  </h3>
                </div>
                <div className="text-right text-xs">
                  <div className="font-mono font-bold text-sm text-slate-900">
                    {printingRecord.ipqcNo}
                  </div>
                  <div className="text-slate-500">
                    Date: {new Date(printingRecord.ipqcDate).toLocaleDateString()}
                  </div>
                  <div className="mt-1">
                    <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-300 font-bold uppercase text-[10px]">
                      {printingRecord.inspectionStage}
                    </span>
                  </div>
                </div>
              </div>

              {/* Inspection Metadata Table */}
              <div className="grid grid-cols-2 gap-4 text-xs border border-slate-300 p-3 rounded">
                <div className="space-y-1">
                  <div><strong>Work Order #:</strong> {printingRecord.woNo}</div>
                  <div><strong>Job Card #:</strong> {printingRecord.jobCardNo || 'N/A'} ({printingRecord.opCode} - {printingRecord.opName})</div>
                  <div><strong>Work Center:</strong> {printingRecord.wcCode} ({printingRecord.wcName || 'Shopfloor Cell'})</div>
                  <div><strong>Machine / Cell:</strong> {printingRecord.machineCode || 'Manual Bench'}</div>
                </div>
                <div className="space-y-1">
                  <div><strong>Part Number:</strong> {printingRecord.itemCode}</div>
                  <div><strong>Description:</strong> {printingRecord.itemName}</div>
                  <div><strong>Batch / Heat #:</strong> {printingRecord.batchNo || '-'} / {printingRecord.heatNo || '-'}</div>
                  <div><strong>Lot Qty / Sample:</strong> {printingRecord.lotQty} units / {printingRecord.sampleSize} units inspected</div>
                </div>
              </div>

              {/* Characteristic Observations Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Inspection Observations & Gauge Verification Matrix
                </h4>
                <table className="w-full text-xs border-collapse border border-slate-300">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border border-slate-300 px-2 py-1.5 w-6 text-center">#</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">Inspection Characteristic</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">Instrument / Gauge</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right">Nominal</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right">Tolerance</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right">Mean Obs</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-center">Verdict</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printingRecord.params?.map((p, i) => (
                      <tr key={i}>
                        <td className="border border-slate-300 px-2 py-1 text-center font-mono">{i + 1}</td>
                        <td className="border border-slate-300 px-2 py-1 font-semibold">
                          {p.paramName}
                          {p.deviationRemarks && (
                            <span className="block text-[10px] text-amber-600 font-normal">
                              ({p.deviationRemarks})
                            </span>
                          )}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-slate-600">{p.instrumentName || '-'}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono">
                          {p.nominalVal !== null ? `${p.nominalVal} ${p.uomCode || ''}` : '-'}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono">
                          {p.minTolerance !== null && p.maxTolerance !== null
                            ? `${p.minTolerance} - ${p.maxTolerance}`
                            : '-'}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold">
                          {p.meanVal !== null ? p.meanVal : '-'}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-center font-bold">
                          {p.paramResult}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Disposition & Remarks */}
              <div className="border border-slate-300 p-3 rounded text-xs space-y-1">
                <div>
                  <strong>Final Quality Verdict:</strong>{' '}
                  <span className="font-bold uppercase">{printingRecord.overallResult}</span> (Accepted: {printingRecord.acceptedQty} | Rejected: {printingRecord.rejectedQty})
                </div>
                {printingRecord.deviationReason && (
                  <div>
                    <strong>Deviation Waiver:</strong> {printingRecord.deviationReason}
                  </div>
                )}
                {printingRecord.remarks && (
                  <div>
                    <strong>QA Remarks:</strong> {printingRecord.remarks}
                  </div>
                )}
              </div>

              {/* Signatures */}
              <div className="pt-8 grid grid-cols-3 gap-4 text-center text-xs">
                <div className="border-t border-slate-400 pt-2">
                  <div className="font-semibold">{printingRecord.operatorName || 'Shopfloor Operator'}</div>
                  <div className="text-slate-500 text-[11px]">Operator Signature</div>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <div className="font-semibold">{printingRecord.inspectorName || 'QC Inspector'}</div>
                  <div className="text-slate-500 text-[11px]">Quality Inspector Signature</div>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <div className="font-semibold">{printingRecord.approverName || 'QA Head / Plant Manager'}</div>
                  <div className="text-slate-500 text-[11px]">QA Manager Authorization</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Modal 6: Confirm Cancel / Delete Modal                               */}
      {/* -------------------------------------------------------------------- */}
      {deletingRecord && (
        <ConfirmDeleteModal
          isOpen={true}
          entityType="In-Process Inspection Protocol"
          entityName={deletingRecord.ipqcNo}
          entityCode={deletingRecord.ipqcNo}
          isDeleting={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deletingRecord.ipqcId)}
          onClose={() => setDeletingRecord(null)}
        />
      )}
    </div>
  );
};
