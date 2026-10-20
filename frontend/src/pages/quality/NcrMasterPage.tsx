import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  HelpCircle,
  Layers,
  ListOrdered,
  Lock,
  Package,
  Plus,
  Printer,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  User,
  Users,
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
import { ConfirmDeleteModal } from '../../components/common/ConfirmDeleteModal';
import { PermissionGate } from '../../components/common/PermissionGate';

// ============================================================================
// Types & Interfaces
// ============================================================================
export type NcrType =
  | 'INWARD_REJECTION'
  | 'IN_PROCESS_DEFECT'
  | 'PDI_FAILURE'
  | 'CUSTOMER_RMA_RETURN'
  | 'INTERNAL_AUDIT';

export type DefectSeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';

export type DefectCategory =
  | 'DIMENSIONAL'
  | 'METALLURGICAL'
  | 'SURFACE_FINISH'
  | 'PRESSURE_LEAK'
  | 'VISUAL_PACKAGING'
  | 'DOCUMENTATION'
  | 'ASSEMBLY_FIT';

export type MrbDisposition =
  | 'PENDING'
  | 'SCRAP'
  | 'REWORK_SAME_OP'
  | 'REWORK_NEW_OP'
  | 'USE_AS_IS_CONCESSION'
  | 'RETURN_TO_VENDOR';

export type CapaStatus =
  | 'NOT_INITIATED'
  | 'INITIATED'
  | 'UNDER_INVESTIGATION'
  | 'IMPLEMENTED'
  | 'VERIFIED_CLOSED';

export type NcrStatus =
  | 'DRAFT'
  | 'UNDER_MRB_REVIEW'
  | 'DISPOSITIONED'
  | 'CAPA_ASSIGNED'
  | 'CLOSED'
  | 'CANCELLED';

export interface MrbVoteRecord {
  voteId: number;
  ncrId: number;
  voterId: number;
  voterName: string;
  voterRole: string;
  recommendedDisposition: MrbDisposition;
  voteComments?: string;
  votedAt: string;
}

export interface CapaActionRecord {
  capaId: number;
  capaNo: string;
  ncrId: number;
  initiationDate: string;
  targetCompletionDate: string;
  actualClosureDate?: string | null;
  rootCauseMethod: string;
  rootCauseAnalysis: string;
  containmentActionPlan?: string | null;
  correctiveActionPlan: string;
  preventiveActionPlan: string;
  assignedToId: number;
  assignedToName: string;
  verifierId?: number | null;
  verifierName?: string | null;
  verificationRemarks?: string | null;
  effectivenessStatus: string;
  status: string;
}

export interface NcrRecord {
  ncrId: number;
  ncrNo: string;
  ncrDate: string;
  ncrType: NcrType;
  sourceDocType: string;
  sourceDocId?: number | null;
  sourceDocNo?: string | null;
  sourceDocDate?: string | null;
  itemId: number;
  itemCode: string;
  itemName: string;
  batchNo?: string | null;
  heatNo?: string | null;
  defectSeverity: DefectSeverity;
  defectCategory: DefectCategory;
  defectDescription: string;
  inspectedQty: number;
  rejectedQty: number;
  uomId: number;
  uomCode?: string;
  containmentAction?: string;
  quarantineLocation?: string;
  redTagNo?: string;
  mrbDisposition: MrbDisposition;
  mrbApproverId?: number | null;
  mrbApproverName?: string | null;
  mrbApprovalDate?: string | null;
  mrbNotes?: string | null;
  isCapaRequired: boolean;
  capaStatus: CapaStatus;
  status: NcrStatus;
  createdBy: number;
  createdDate: string;
  voteCount?: number;
  linkedCapaNo?: string | null;
  mrbVotes?: MrbVoteRecord[];
  capaActions?: CapaActionRecord[];
}

interface NcrSummary {
  totalNcrs: number;
  underMrbReview: number;
  capaActive: number;
  closedCount: number;
  scrapCount: number;
  reworkCount: number;
  returnToVendorCount: number;
}

interface LookupsData {
  items: { itemId: number; itemCode: string; itemName: string; uomId: number }[];
  uoms: { uomId: number; uomCode: string; uomName: string }[];
  users: { userId: number; userName: string; fullName: string; roleId: number }[];
  ncrTypes: { value: string; label: string }[];
  defectSeverities: { value: string; label: string }[];
  defectCategories: { value: string; label: string }[];
  mrbDispositions: { value: string; label: string }[];
  ncrStatuses: { value: string; label: string }[];
}

// ============================================================================
// Main Component: NcrMasterPage
// ============================================================================
export const NcrMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'ALL' | 'MRB_REVIEW' | 'ACTIVE_CAPA' | 'CLOSED'>('ALL');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<NcrRecord | null>(null);
  const [viewingRecord, setViewingRecord] = useState<NcrRecord | null>(null);
  const [votingRecord, setVotingRecord] = useState<NcrRecord | null>(null);
  const [dispositionRecord, setDispositionRecord] = useState<NcrRecord | null>(null);
  const [capaRecord, setCapaRecord] = useState<NcrRecord | null>(null);
  const [closeCapaRecord, setCloseCapaRecord] = useState<{ ncr: NcrRecord; capa: CapaActionRecord } | null>(null);
  const [printingRecord, setPrintingRecord] = useState<NcrRecord | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<NcrRecord | null>(null);

  // Form State for Create/Edit NCR
  const [formState, setFormState] = useState<{
    ncrDate: string;
    ncrType: NcrType;
    sourceDocType: string;
    sourceDocNo: string;
    itemId: number | '';
    batchNo: string;
    heatNo: string;
    defectSeverity: DefectSeverity;
    defectCategory: DefectCategory;
    defectDescription: string;
    inspectedQty: number;
    rejectedQty: number;
    uomId: number | '';
    containmentAction: string;
    quarantineLocation: string;
    redTagNo: string;
    isCapaRequired: boolean;
  }>({
    ncrDate: new Date().toISOString().split('T')[0],
    ncrType: 'IN_PROCESS_DEFECT',
    sourceDocType: 'IN_PROCESS_QC',
    sourceDocNo: '',
    itemId: '',
    batchNo: '',
    heatNo: '',
    defectSeverity: 'MAJOR',
    defectCategory: 'DIMENSIONAL',
    defectDescription: '',
    inspectedQty: 1,
    rejectedQty: 1,
    uomId: '',
    containmentAction: 'Quarantine immediately with Red Defect Tag in Designated QC Area',
    quarantineLocation: 'Quarantine Bay A1 (Red Tagged)',
    redTagNo: '',
    isCapaRequired: true,
  });

  // MRB Vote Form
  const [voteForm, setVoteForm] = useState<{
    recommendedDisposition: MrbDisposition;
    voteComments: string;
  }>({
    recommendedDisposition: 'RETURN_TO_VENDOR',
    voteComments: '',
  });

  // Final Disposition Form
  const [dispositionForm, setDispositionForm] = useState<{
    mrbDisposition: MrbDisposition;
    mrbNotes: string;
    isCapaRequired: boolean;
  }>({
    mrbDisposition: 'RETURN_TO_VENDOR',
    mrbNotes: '',
    isCapaRequired: true,
  });

  // 8D CAPA Action Form
  const [capaForm, setCapaForm] = useState<{
    targetCompletionDate: string;
    rootCauseMethod: '5_WHY' | 'FISHBONE_ISHIKAWA' | 'FMEA' | 'FAULT_TREE';
    rootCauseAnalysis: string;
    containmentActionPlan: string;
    correctiveActionPlan: string;
    preventiveActionPlan: string;
    assignedToId: number | '';
  }>({
    targetCompletionDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    rootCauseMethod: '5_WHY',
    rootCauseAnalysis: '',
    containmentActionPlan: '',
    correctiveActionPlan: '',
    preventiveActionPlan: '',
    assignedToId: '',
  });

  // Close CAPA Form
  const [closeCapaForm, setCloseCapaForm] = useState<{
    verificationRemarks: string;
    effectivenessStatus: 'IMPLEMENTED' | 'VERIFIED_EFFECTIVE' | 'REOPENED';
    closeParentNcr: boolean;
  }>({
    verificationRemarks: 'Actions verified on shop floor; zero recurrence observed in subsequent 3 batches.',
    effectivenessStatus: 'VERIFIED_EFFECTIVE',
    closeParentNcr: true,
  });

  // --------------------------------------------------------------------------
  // API Queries & Mutations
  // --------------------------------------------------------------------------
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery<NcrSummary>({
    queryKey: ['ncr-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<NcrSummary>>('/quality/ncr/summary');
      return (res.data.data ?? res.data) as NcrSummary;
    },
  });

  const { data: lookupsData } = useQuery<LookupsData>({
    queryKey: ['ncr-lookups'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<LookupsData>>('/quality/ncr/lookups');
      return (res.data.data ?? res.data) as LookupsData;
    },
  });

  const { data: recordsData, isLoading: isRecordsLoading } = useQuery<NcrRecord[]>({
    queryKey: ['ncr-records', categoryFilter, severityFilter, statusFilter, searchTerm],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (categoryFilter !== 'ALL') params.defectCategory = categoryFilter;
      if (severityFilter !== 'ALL') params.defectSeverity = severityFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const res = await apiClient.get<ApiResponse<{ items: NcrRecord[]; total: number }>>('/quality/ncr', {
        params,
      });
      const data = res.data.data ?? res.data;
      return (data as any)?.items || (Array.isArray(data) ? data : []);
    },
  });

  // Mutation: Create NCR
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post<ApiResponse<NcrRecord>>('/quality/ncr', payload);
      return res.data.data ?? res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ncr-records'] });
      queryClient.invalidateQueries({ queryKey: ['ncr-summary'] });
      setIsCreateModalOpen(false);
    },
  });

  // Mutation: Update NCR
  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.put<ApiResponse<NcrRecord>>(`/quality/ncr/${id}`, payload);
      return res.data.data ?? res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ncr-records'] });
      queryClient.invalidateQueries({ queryKey: ['ncr-summary'] });
      setEditingRecord(null);
    },
  });

  // Mutation: Cast MRB Vote
  const voteMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.post<ApiResponse<NcrRecord>>(`/quality/ncr/${id}/mrb-vote`, payload);
      return res.data.data ?? res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ncr-records'] });
      queryClient.invalidateQueries({ queryKey: ['ncr-summary'] });
      setVotingRecord(null);
    },
  });

  // Mutation: Authorize Final Disposition
  const dispositionMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.post<ApiResponse<NcrRecord>>(`/quality/ncr/${id}/disposition`, payload);
      return res.data.data ?? res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ncr-records'] });
      queryClient.invalidateQueries({ queryKey: ['ncr-summary'] });
      setDispositionRecord(null);
    },
  });

  // Mutation: Create / Update 8D CAPA Action
  const capaMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.post<ApiResponse<NcrRecord>>(`/quality/ncr/${id}/capa`, payload);
      return res.data.data ?? res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ncr-records'] });
      queryClient.invalidateQueries({ queryKey: ['ncr-summary'] });
      setCapaRecord(null);
    },
  });

  // Mutation: Close CAPA Action
  const closeCapaMutation = useMutation({
    mutationFn: async ({ capaId, payload }: { capaId: number; payload: any }) => {
      const res = await apiClient.put<ApiResponse<NcrRecord>>(`/quality/ncr/capa/${capaId}/close`, payload);
      return res.data.data ?? res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ncr-records'] });
      queryClient.invalidateQueries({ queryKey: ['ncr-summary'] });
      setCloseCapaRecord(null);
    },
  });

  // Mutation: Delete NCR
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete<ApiResponse<any>>(`/quality/ncr/${id}`);
      return res.data.data ?? res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ncr-records'] });
      queryClient.invalidateQueries({ queryKey: ['ncr-summary'] });
      setDeletingRecord(null);
    },
  });

  // Filter records by tab
  const filteredRecords = useMemo(() => {
    if (!recordsData) return [];
    if (activeTab === 'MRB_REVIEW') {
      return recordsData.filter((r: NcrRecord) => r.status === 'UNDER_MRB_REVIEW' || r.mrbDisposition === 'PENDING');
    }
    if (activeTab === 'ACTIVE_CAPA') {
      return recordsData.filter(
        (r: NcrRecord) => r.status === 'CAPA_ASSIGNED' || r.capaStatus === 'INITIATED' || r.capaStatus === 'UNDER_INVESTIGATION',
      );
    }
    if (activeTab === 'CLOSED') {
      return recordsData.filter((r: NcrRecord) => r.status === 'CLOSED');
    }
    return recordsData;
  }, [recordsData, activeTab]);

  // Open Edit Modal
  const handleOpenEdit = (rec: NcrRecord) => {
    setEditingRecord(rec);
    setFormState({
      ncrDate: rec.ncrDate?.slice(0, 10) || new Date().toISOString().split('T')[0],
      ncrType: rec.ncrType,
      sourceDocType: rec.sourceDocType,
      sourceDocNo: rec.sourceDocNo || '',
      itemId: rec.itemId,
      batchNo: rec.batchNo || '',
      heatNo: rec.heatNo || '',
      defectSeverity: rec.defectSeverity,
      defectCategory: rec.defectCategory,
      defectDescription: rec.defectDescription,
      inspectedQty: rec.inspectedQty,
      rejectedQty: rec.rejectedQty,
      uomId: rec.uomId,
      containmentAction: rec.containmentAction || '',
      quarantineLocation: rec.quarantineLocation || '',
      redTagNo: rec.redTagNo || '',
      isCapaRequired: rec.isCapaRequired,
    });
  };

  // Open MRB Voting Modal
  const handleOpenVote = async (rec: NcrRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<NcrRecord>>(`/quality/ncr/${rec.ncrId}`);
      const full = (res.data.data ?? res.data) as NcrRecord;
      setVotingRecord(full);
      setVoteForm({
        recommendedDisposition: full.mrbDisposition !== 'PENDING' ? full.mrbDisposition : 'RETURN_TO_VENDOR',
        voteComments: '',
      });
    } catch {
      setVotingRecord(rec);
    }
  };

  // Open Disposition Modal
  const handleOpenDisposition = (rec: NcrRecord) => {
    setDispositionRecord(rec);
    setDispositionForm({
      mrbDisposition: rec.mrbDisposition !== 'PENDING' ? rec.mrbDisposition : 'RETURN_TO_VENDOR',
      mrbNotes: rec.mrbNotes || '',
      isCapaRequired: rec.isCapaRequired,
    });
  };

  // Open 8D CAPA Modal
  const handleOpenCapa = async (rec: NcrRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<NcrRecord>>(`/quality/ncr/${rec.ncrId}`);
      const full = (res.data.data ?? res.data) as NcrRecord;
      setCapaRecord(full);
      const existingCapa = full.capaActions && full.capaActions.length > 0 ? full.capaActions[0] : null;
      if (existingCapa) {
        setCapaForm({
          targetCompletionDate: existingCapa.targetCompletionDate?.slice(0, 10) || '',
          rootCauseMethod: (existingCapa.rootCauseMethod as any) || '5_WHY',
          rootCauseAnalysis: existingCapa.rootCauseAnalysis,
          containmentActionPlan: existingCapa.containmentActionPlan || '',
          correctiveActionPlan: existingCapa.correctiveActionPlan,
          preventiveActionPlan: existingCapa.preventiveActionPlan,
          assignedToId: existingCapa.assignedToId,
        });
      } else {
        setCapaForm({
          targetCompletionDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
          rootCauseMethod: '5_WHY',
          rootCauseAnalysis: '',
          containmentActionPlan: rec.containmentAction || '',
          correctiveActionPlan: '',
          preventiveActionPlan: '',
          assignedToId: lookupsData?.users[0]?.userId || '',
        });
      }
    } catch {
      setCapaRecord(rec);
    }
  };

  // Open View Details Modal
  const handleOpenView = async (rec: NcrRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<NcrRecord>>(`/quality/ncr/${rec.ncrId}`);
      setViewingRecord((res.data.data ?? res.data) as NcrRecord);
    } catch {
      setViewingRecord(rec);
    }
  };

  // Open Print Modal
  const handleOpenPrint = async (rec: NcrRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<NcrRecord>>(`/quality/ncr/${rec.ncrId}`);
      setPrintingRecord((res.data.data ?? res.data) as NcrRecord);
    } catch {
      setPrintingRecord(rec);
    }
  };

  // Submit Create / Edit
  const handleSubmitNcr = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.itemId) return;

    if (editingRecord) {
      updateMutation.mutate({
        id: editingRecord.ncrId,
        payload: {
          ...formState,
          itemId: Number(formState.itemId),
          uomId: Number(formState.uomId) || undefined,
        },
      });
    } else {
      createMutation.mutate({
        ...formState,
        itemId: Number(formState.itemId),
        uomId: Number(formState.uomId) || undefined,
      });
    }
  };

  // Columns for MasterDataTable
  const columns: MasterTableColumn<NcrRecord>[] = [
    {
      key: 'ncrNo',
      header: 'NCR No & Red Tag',
      sortValue: (r: NcrRecord) => r.ncrNo,
      render: (r: NcrRecord) => (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100">
            <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
            <span>{r.ncrNo}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{r.ncrDate ? new Date(r.ncrDate).toLocaleDateString() : 'N/A'}</span>
            {r.redTagNo && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                <Tag className="h-3 w-3 mr-0.5" />
                {r.redTagNo}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'stageOrigin',
      header: 'Stage & Origin',
      sortValue: (r: NcrRecord) => r.ncrType,
      render: (r: NcrRecord) => {
        const typeLabels: Record<string, { label: string; badge: string }> = {
          INWARD_REJECTION: { label: 'Inward IQC', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' },
          IN_PROCESS_DEFECT: { label: 'In-Process IPQC', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300' },
          PDI_FAILURE: { label: 'PDI Gating', badge: 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300' },
          CUSTOMER_RMA_RETURN: { label: 'Customer RMA', badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300' },
          INTERNAL_AUDIT: { label: 'Internal Audit', badge: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300' },
        };
        const conf = typeLabels[r.ncrType] || { label: r.ncrType, badge: 'bg-slate-100 text-slate-700' };
        return (
          <div className="flex flex-col gap-0.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium w-fit ${conf.badge}`}>
              {conf.label}
            </span>
            {r.sourceDocNo && (
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {r.sourceDocNo}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'item',
      header: 'Defective Material',
      sortValue: (r: NcrRecord) => r.itemCode,
      render: (r: NcrRecord) => (
        <div className="flex flex-col max-w-[220px]">
          <span className="font-medium text-slate-900 dark:text-slate-100 truncate">{r.itemName}</span>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono">
            <span>{r.itemCode}</span>
            {r.batchNo && <span className="text-[11px]">Batch: {r.batchNo}</span>}
          </div>
        </div>
      ),
    },
    {
      key: 'defectCategory',
      header: 'Defect Category & Severity',
      sortValue: (r: NcrRecord) => r.defectSeverity,
      render: (r: NcrRecord) => {
        const severityBadges: Record<string, string> = {
          CRITICAL: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
          MAJOR: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
          MINOR: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
        };
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
              <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-full border ${severityBadges[r.defectSeverity]}`}>
                {r.defectSeverity}
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                {r.defectCategory}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
              {r.defectDescription}
            </p>
          </div>
        );
      },
    },
    {
      key: 'quantities',
      header: 'Rej / Total Qty',
      sortValue: (r: NcrRecord) => r.rejectedQty,
      render: (r: NcrRecord) => (
        <div className="flex flex-col">
          <span className="font-semibold text-rose-600 dark:text-rose-400">
            {r.rejectedQty} {r.uomCode || 'Units'}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            of {r.inspectedQty} inspected
          </span>
        </div>
      ),
    },
    {
      key: 'mrbDisposition',
      header: 'MRB Disposition',
      sortValue: (r: NcrRecord) => r.mrbDisposition,
      render: (r: NcrRecord) => {
        const dispStyles: Record<string, { label: string; badge: string }> = {
          PENDING: { label: 'Pending Review', badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300' },
          RETURN_TO_VENDOR: { label: 'Return to Vendor (RTV)', badge: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300' },
          REWORK_SAME_OP: { label: 'Rework (Standard)', badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300' },
          REWORK_NEW_OP: { label: 'Rework (Salvage)', badge: 'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/40 dark:text-cyan-300' },
          USE_AS_IS_CONCESSION: { label: 'Concession / Use-As-Is', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300' },
          SCRAP: { label: 'Condemn / Scrap', badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300' },
        };
        const conf = dispStyles[r.mrbDisposition] || { label: r.mrbDisposition, badge: 'bg-slate-50 text-slate-700' };
        return (
          <div className="flex flex-col gap-0.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${conf.badge}`}>
              {conf.label}
            </span>
            {r.voteCount !== undefined && r.voteCount > 0 && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <Users className="h-3 w-3" /> {r.voteCount} vote{r.voteCount > 1 ? 's' : ''} logged
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'capaStatus',
      header: '8D CAPA Action',
      sortValue: (r: NcrRecord) => r.capaStatus,
      render: (r: NcrRecord) => {
        if (!r.isCapaRequired) {
          return <span className="text-xs text-slate-400 italic">Not Required</span>;
        }
        const capaStyles: Record<string, { label: string; badge: string }> = {
          NOT_INITIATED: { label: 'Not Initiated', badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
          INITIATED: { label: 'Initiated', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
          UNDER_INVESTIGATION: { label: 'In Progress (5-Why)', badge: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300' },
          IMPLEMENTED: { label: 'Implemented', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' },
          VERIFIED_CLOSED: { label: 'Verified & Closed', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
        };
        const conf = capaStyles[r.capaStatus] || { label: r.capaStatus, badge: 'bg-slate-100 text-slate-700' };
        return (
          <div className="flex flex-col gap-0.5">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold w-fit ${conf.badge}`}>
              {conf.label}
            </span>
            {r.linkedCapaNo && (
              <span className="text-[11px] font-mono text-indigo-600 dark:text-indigo-400">
                {r.linkedCapaNo}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (r: NcrRecord) => r.status,
      render: (r: NcrRecord) => {
        const statusMap: Record<string, { label: string; badge: string }> = {
          DRAFT: { label: 'Draft', badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
          UNDER_MRB_REVIEW: { label: 'Under Review', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300' },
          DISPOSITIONED: { label: 'Dispositioned', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300' },
          CAPA_ASSIGNED: { label: 'CAPA Active', badge: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300' },
          CLOSED: { label: 'Closed', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' },
          CANCELLED: { label: 'Cancelled', badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' },
        };
        const conf = statusMap[r.status] || { label: r.status, badge: 'bg-slate-100 text-slate-700' };
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${conf.badge}`}>
            {conf.label}
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r: NcrRecord) => (
        <div className="flex items-center gap-1">
          {/* View Details */}
          <button
            onClick={() => handleOpenView(r)}
            title="View NCR & 8D Details"
            className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800"
          >
            <Eye className="h-4 w-4" />
          </button>

          {/* Cast MRB Vote */}
          <PermissionGate screen="NCR_QC" action="EDIT">
            <button
              onClick={() => handleOpenVote(r)}
              title="Cast MRB Member Recommendation Vote"
              className="p-1 rounded text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50"
            >
              <ThumbsUp className="h-4 w-4" />
            </button>
          </PermissionGate>

          {/* Authorize Disposition */}
          <PermissionGate screen="NCR_QC" action="DISPOSITION">
            <button
              onClick={() => handleOpenDisposition(r)}
              title="Authorize Final MRB Disposition"
              className="p-1 rounded text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50"
            >
              <ShieldAlert className="h-4 w-4" />
            </button>
          </PermissionGate>

          {/* 8D CAPA Action Plan */}
          <PermissionGate screen="NCR_QC" action="EDIT">
            <button
              onClick={() => handleOpenCapa(r)}
              title="Manage 8D Corrective Action Plan"
              className="p-1 rounded text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50"
            >
              <Wrench className="h-4 w-4" />
            </button>
          </PermissionGate>

          {/* Print NCR & 8D Certificate */}
          <PermissionGate screen="NCR_QC" action="PRINT">
            <button
              onClick={() => handleOpenPrint(r)}
              title="Print Statutory Non-Conformance & 8D Sheet"
              className="p-1 rounded text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Printer className="h-4 w-4" />
            </button>
          </PermissionGate>

          {/* Edit */}
          {r.status !== 'CLOSED' && (
            <PermissionGate screen="NCR_QC" action="EDIT">
              <button
                onClick={() => handleOpenEdit(r)}
                title="Edit NCR"
                className="p-1 rounded text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            </PermissionGate>
          )}

          {/* Delete */}
          {r.status !== 'CLOSED' && (
            <PermissionGate screen="NCR_QC" action="DELETE">
              <button
                onClick={() => setDeletingRecord(r)}
                title="Delete NCR"
                className="p-1 rounded text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </PermissionGate>
          )}
        </div>
      ),
    },
  ];

  const groupByOptions: GroupByOption<NcrRecord>[] = [
    { label: 'Defect Category', key: 'defectCategory', groupValue: (r: NcrRecord) => r.defectCategory },
    { label: 'Defect Severity', key: 'defectSeverity', groupValue: (r: NcrRecord) => r.defectSeverity },
    { label: 'MRB Disposition', key: 'mrbDisposition', groupValue: (r: NcrRecord) => r.mrbDisposition },
    { label: 'NCR Status', key: 'status', groupValue: (r: NcrRecord) => r.status },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* 1. Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Quality Assurance & QC</span>
            <ChevronRight className="h-3 w-3" />
            <span className="text-slate-800 dark:text-slate-200 font-medium">Non-Conformance Reports (NCR)</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">
            Non-Conformance Reports (NCR) & 8D CAPA Engine
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Quarantine gating, Material Review Board (MRB) dispositions, 5-Why root cause analysis, and closed-loop corrective action tracking.
          </p>
        </div>

        <PermissionGate screen="NCR_QC" action="ADD">
          <button
            onClick={() => {
              setEditingRecord(null);
              setFormState({
                ncrDate: new Date().toISOString().split('T')[0],
                ncrType: 'IN_PROCESS_DEFECT',
                sourceDocType: 'IN_PROCESS_QC',
                sourceDocNo: '',
                itemId: lookupsData?.items[0]?.itemId || '',
                batchNo: '',
                heatNo: '',
                defectSeverity: 'MAJOR',
                defectCategory: 'DIMENSIONAL',
                defectDescription: '',
                inspectedQty: 1,
                rejectedQty: 1,
                uomId: lookupsData?.uoms[0]?.uomId || '',
                containmentAction: 'Quarantine immediately with Red Defect Tag in Designated QC Area',
                quarantineLocation: 'Quarantine Bay A1 (Red Tagged)',
                redTagNo: '',
                isCapaRequired: true,
              });
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            Raise Non-Conformance Report (NCR)
          </button>
        </PermissionGate>
      </div>

      {/* 2. KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total NCRs</div>
            <div className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {isSummaryLoading ? '...' : summaryData?.totalNcrs || 0}
            </div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">MRB Voting Review</div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
              {isSummaryLoading ? '...' : summaryData?.underMrbReview || 0}
            </div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Active 8D CAPAs</div>
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
              {isSummaryLoading ? '...' : summaryData?.capaActive || 0}
            </div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
            <AlertOctagon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">RTV & Scrapped</div>
            <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
              {isSummaryLoading ? '...' : (summaryData?.returnToVendorCount || 0) + (summaryData?.scrapCount || 0)}
            </div>
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 col-span-2 md:col-span-4 lg:col-span-1">
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Closed & Verified</div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
              {isSummaryLoading ? '...' : summaryData?.closedCount || 0}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Filter Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 space-x-4">
        {[
          { id: 'ALL', label: 'All Non-Conformance Reports' },
          { id: 'MRB_REVIEW', label: 'Under MRB Review / Pending Disposition' },
          { id: 'ACTIVE_CAPA', label: 'Active 8D Corrective Action Plans' },
          { id: 'CLOSED', label: 'Closed & Verified Effective' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-2.5 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === tab.id
                ? 'border-rose-600 text-rose-600 dark:text-rose-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:hover:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4. Master Data Table */}
      <MasterDataTable<NcrRecord>
        title="Non-Conformance Reports (NCR) Register"
        subtitle="Full quarantine history, Material Review Board disposition voting, and ISO 9001:2015 8D corrective action matrix"
        screenCode="NCR_QC"
        tableNameBadge="tbl_qc_ncr_header"
        data={filteredRecords}
        columns={columns}
        rowKey={(r: NcrRecord) => r.ncrId}
        searchPlaceholder="Search by NCR No, Item Code, Tag, Defect description..."
        searchPredicate={(r: NcrRecord, q: string) => {
          const query = q.toLowerCase();
          return (
            r.ncrNo.toLowerCase().includes(query) ||
            r.itemCode.toLowerCase().includes(query) ||
            r.itemName.toLowerCase().includes(query) ||
            (Boolean(r.redTagNo) && r.redTagNo!.toLowerCase().includes(query)) ||
            r.defectDescription.toLowerCase().includes(query)
          );
        }}
        groupByOptions={groupByOptions}
        addButtonLabel="Raise Non-Conformance Report"
        onAddClick={() => {
          setEditingRecord(null);
          setIsCreateModalOpen(true);
        }}
      />

      {/* 5. Create / Edit NCR Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
                <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                  {editingRecord ? `Edit NCR #${editingRecord.ncrNo}` : 'Raise Non-Conformance Report (NCR)'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setEditingRecord(null);
                }}
                className="text-slate-400 hover:text-slate-500"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitNcr} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    NCR Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formState.ncrDate}
                    onChange={(e) => setFormState({ ...formState, ncrDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Inspection Stage / Origin
                  </label>
                  <select
                    value={formState.ncrType}
                    onChange={(e) => setFormState({ ...formState, ncrType: e.target.value as NcrType })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    {lookupsData?.ncrTypes.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Defective Item / Part
                  </label>
                  <select
                    required
                    value={formState.itemId}
                    onChange={(e) => setFormState({ ...formState, itemId: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="">-- Select Material / Item --</option>
                    {lookupsData?.items.map((i) => (
                      <option key={i.itemId} value={i.itemId}>
                        {i.itemCode} - {i.itemName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Source Document No (IQC/IPQC/PO/WO)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. IQC-AHM-2627-0001 or WO-0041"
                    value={formState.sourceDocNo}
                    onChange={(e) => setFormState({ ...formState, sourceDocNo: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Heat / Cast / Melt No
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HEAT-8842"
                    value={formState.heatNo}
                    onChange={(e) => setFormState({ ...formState, heatNo: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Batch / Lot Number
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. LOT-SS-9921"
                    value={formState.batchNo}
                    onChange={(e) => setFormState({ ...formState, batchNo: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Defect Severity
                  </label>
                  <select
                    value={formState.defectSeverity}
                    onChange={(e) => setFormState({ ...formState, defectSeverity: e.target.value as DefectSeverity })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    {lookupsData?.defectSeverities.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Defect Category
                  </label>
                  <select
                    value={formState.defectCategory}
                    onChange={(e) => setFormState({ ...formState, defectCategory: e.target.value as DefectCategory })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    {lookupsData?.defectCategories.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Inspected Qty
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formState.inspectedQty}
                    onChange={(e) => setFormState({ ...formState, inspectedQty: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Rejected Qty
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={formState.rejectedQty}
                    onChange={(e) => setFormState({ ...formState, rejectedQty: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-rose-600 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Unit of Measure (UOM)
                  </label>
                  <select
                    value={formState.uomId}
                    onChange={(e) => setFormState({ ...formState, uomId: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  >
                    <option value="">-- Match Item UOM --</option>
                    {lookupsData?.uoms.map((u) => (
                      <option key={u.uomId} value={u.uomId}>
                        {u.uomCode} ({u.uomName})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Non-Conformance Defect Description
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Detailed description of defect, measured dimensions vs tolerance, metallurgical flaw, etc."
                  value={formState.defectDescription}
                  onChange={(e) => setFormState({ ...formState, defectDescription: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Physical Quarantine Location
                  </label>
                  <input
                    type="text"
                    value={formState.quarantineLocation}
                    onChange={(e) => setFormState({ ...formState, quarantineLocation: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Physical Red Tag Barcode / Tag ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TAG-RED-0081"
                    value={formState.redTagNo}
                    onChange={(e) => setFormState({ ...formState, redTagNo: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Immediate Containment Action
                </label>
                <input
                  type="text"
                  value={formState.containmentAction}
                  onChange={(e) => setFormState({ ...formState, containmentAction: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="chkIsCapa"
                  checked={formState.isCapaRequired}
                  onChange={(e) => setFormState({ ...formState, isCapaRequired: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <label htmlFor="chkIsCapa" className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Mandatory 8D Corrective & Preventive Action (CAPA) required for this defect
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setEditingRecord(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-sm"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingRecord
                    ? 'Update NCR'
                    : 'File NCR & Tag Quarantine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. MRB Member Voting Modal */}
      {votingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ThumbsUp className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                  Material Review Board (MRB) Vote
                </h3>
              </div>
              <button onClick={() => setVotingRecord(null)} className="text-slate-400 hover:text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg text-xs space-y-1">
              <div className="font-semibold text-slate-800 dark:text-slate-200">{votingRecord.ncrNo} - {votingRecord.itemName}</div>
              <div className="text-slate-600 dark:text-slate-400">Rejected Qty: <strong className="text-rose-600">{votingRecord.rejectedQty} {votingRecord.uomCode}</strong></div>
              <div className="text-slate-600 dark:text-slate-400 truncate">Defect: {votingRecord.defectDescription}</div>
            </div>

            {/* Existing Votes */}
            {votingRecord.mrbVotes && votingRecord.mrbVotes.length > 0 && (
              <div className="mt-3">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> Previous Member Recommendations:
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {votingRecord.mrbVotes.map((v) => (
                    <div key={v.voteId} className="p-2 rounded bg-slate-100 dark:bg-slate-800 text-xs">
                      <div className="flex justify-between items-center font-medium">
                        <span>{v.voterName} ({v.voterRole})</span>
                        <span className="text-blue-600 dark:text-blue-400 font-semibold">{v.recommendedDisposition}</span>
                      </div>
                      {v.voteComments && <p className="text-slate-500 dark:text-slate-400 mt-0.5">{v.voteComments}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                voteMutation.mutate({
                  id: votingRecord.ncrId,
                  payload: voteForm,
                });
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Your Recommended Disposition
                </label>
                <select
                  value={voteForm.recommendedDisposition}
                  onChange={(e) => setVoteForm({ ...voteForm, recommendedDisposition: e.target.value as MrbDisposition })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  {lookupsData?.mrbDispositions.filter((d) => d.value !== 'PENDING').map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Technical Justification & Engineering Comments
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="State engineering reasons for your recommendation (e.g. salvage procedure, tolerance limits, safety factors)..."
                  value={voteForm.voteComments}
                  onChange={(e) => setVoteForm({ ...voteForm, voteComments: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setVotingRecord(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={voteMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  {voteMutation.isPending ? 'Logging Vote...' : 'Submit MRB Vote'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Authorize Final MRB Disposition Modal */}
      {dispositionRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
                <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                  Authorize MRB Final Disposition
                </h3>
              </div>
              <button onClick={() => setDispositionRecord(null)} className="text-slate-400 hover:text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 p-3 rounded-lg text-xs space-y-1">
              <div className="font-semibold text-amber-900 dark:text-amber-200">
                Statutory Quality Sign-Off for #{dispositionRecord.ncrNo}
              </div>
              <div className="text-amber-800 dark:text-amber-300">
                Item: {dispositionRecord.itemName} ({dispositionRecord.itemCode}) | Rej: {dispositionRecord.rejectedQty} {dispositionRecord.uomCode}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                dispositionMutation.mutate({
                  id: dispositionRecord.ncrId,
                  payload: dispositionForm,
                });
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Final Disposition Decision
                </label>
                <select
                  value={dispositionForm.mrbDisposition}
                  onChange={(e) => setDispositionForm({ ...dispositionForm, mrbDisposition: e.target.value as MrbDisposition })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                >
                  {lookupsData?.mrbDispositions.filter((d) => d.value !== 'PENDING').map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Official Disposition Notes & Engineering Waiver Details
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Approved rework routing, vendor replacement debit note reference, or engineering concession justification..."
                  value={dispositionForm.mrbNotes}
                  onChange={(e) => setDispositionForm({ ...dispositionForm, mrbNotes: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chkDispCapa"
                  checked={dispositionForm.isCapaRequired}
                  onChange={(e) => setDispositionForm({ ...dispositionForm, isCapaRequired: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <label htmlFor="chkDispCapa" className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  Assign 8D Root Cause CAPA Action to Quality Engineering
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setDispositionRecord(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dispositionMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg"
                >
                  {dispositionMutation.isPending ? 'Authorizing...' : 'Authorize Disposition'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. 8D CAPA Action Plan Engine Modal */}
      {capaRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-purple-600" />
                <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                  8D Corrective & Preventive Action (CAPA) Plan
                </h3>
              </div>
              <button onClick={() => setCapaRecord(null)} className="text-slate-400 hover:text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-3 bg-purple-50 dark:bg-purple-950/40 p-3 rounded-lg text-xs space-y-1">
              <div className="font-semibold text-purple-900 dark:text-purple-200">
                Root Cause & Preventive Action for #{capaRecord.ncrNo}
              </div>
              <div className="text-purple-800 dark:text-purple-300">
                Item: {capaRecord.itemName} | Severity: {capaRecord.defectSeverity} | Category: {capaRecord.defectCategory}
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!capaForm.assignedToId) return;
                capaMutation.mutate({
                  id: capaRecord.ncrId,
                  payload: {
                    ...capaForm,
                    assignedToId: Number(capaForm.assignedToId),
                  },
                });
              }}
              className="mt-4 space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Root Cause Analysis Methodology
                  </label>
                  <select
                    value={capaForm.rootCauseMethod}
                    onChange={(e) => setCapaForm({ ...capaForm, rootCauseMethod: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                  >
                    <option value="5_WHY">5-Why Analysis Drilldown</option>
                    <option value="FISHBONE_ISHIKAWA">Fishbone (Ishikawa 6M)</option>
                    <option value="FMEA">Failure Mode & Effects Analysis (FMEA)</option>
                    <option value="FAULT_TREE">Fault Tree Analysis (FTA)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Target Completion Date
                  </label>
                  <input
                    type="date"
                    required
                    value={capaForm.targetCompletionDate}
                    onChange={(e) => setCapaForm({ ...capaForm, targetCompletionDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Assigned Quality / Production Lead
                </label>
                <select
                  required
                  value={capaForm.assignedToId}
                  onChange={(e) => setCapaForm({ ...capaForm, assignedToId: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="">-- Select Assigned Lead --</option>
                  {lookupsData?.users.map((u) => (
                    <option key={u.userId} value={u.userId}>
                      {u.fullName} ({u.userName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Root Cause Investigation (5-Why Drilldown)
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Why 1: Flange face had surface void? Why 2: Shrinkage during alloy cooling... Root cause identified..."
                  value={capaForm.rootCauseAnalysis}
                  onChange={(e) => setCapaForm({ ...capaForm, rootCauseAnalysis: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Interim Containment Action Plan (D3)
                </label>
                <input
                  type="text"
                  placeholder="Quarantine current batch, 100% pre-scan before machining, etc."
                  value={capaForm.containmentActionPlan}
                  onChange={(e) => setCapaForm({ ...capaForm, containmentActionPlan: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Permanent Corrective Action (D5 / D6)
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Tooling modification, CNC program feed rate revision, vendor die repair..."
                  value={capaForm.correctiveActionPlan}
                  onChange={(e) => setCapaForm({ ...capaForm, correctiveActionPlan: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Systemic Preventive Action (D7)
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Revision of Standard Operating Procedure (SOP), Quality Plan update, error-proofing (Poka-Yoke)..."
                  value={capaForm.preventiveActionPlan}
                  onChange={(e) => setCapaForm({ ...capaForm, preventiveActionPlan: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCapaRecord(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={capaMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg"
                >
                  {capaMutation.isPending ? 'Saving CAPA...' : 'Save 8D CAPA Action Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. Close / Verify CAPA Modal */}
      {closeCapaRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                  Verify & Close CAPA #{closeCapaRecord.capa.capaNo}
                </h3>
              </div>
              <button onClick={() => setCloseCapaRecord(null)} className="text-slate-400 hover:text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                closeCapaMutation.mutate({
                  capaId: closeCapaRecord.capa.capaId,
                  payload: closeCapaForm,
                });
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Effectiveness Verification Status
                </label>
                <select
                  value={closeCapaForm.effectivenessStatus}
                  onChange={(e) => setCloseCapaForm({ ...closeCapaForm, effectivenessStatus: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-semibold"
                >
                  <option value="VERIFIED_EFFECTIVE">Verified Effective (Zero Recurrence - Approved for Closure)</option>
                  <option value="IMPLEMENTED">Implemented (Under Observation Period)</option>
                  <option value="REOPENED">Reopened (Recurrence Observed - Action Ineffective)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Verification Audit Remarks
                </label>
                <textarea
                  rows={3}
                  required
                  value={closeCapaForm.verificationRemarks}
                  onChange={(e) => setCloseCapaForm({ ...closeCapaForm, verificationRemarks: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="chkCloseParent"
                  checked={closeCapaForm.closeParentNcr}
                  onChange={(e) => setCloseCapaForm({ ...closeCapaForm, closeParentNcr: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <label htmlFor="chkCloseParent" className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  Mark Parent NCR #{closeCapaRecord.ncr.ncrNo} as CLOSED & Verified
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setCloseCapaRecord(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={closeCapaMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                >
                  {closeCapaMutation.isPending ? 'Closing...' : 'Confirm Closure & Sign-Off'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. Printable NCR & 8D Quality Sheet Modal */}
      {printingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-xl max-w-3xl w-full p-8 shadow-2xl my-8">
            <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight uppercase">Kashvira Infotech Manufacturing Pvt Ltd</h2>
                <p className="text-xs text-slate-600">Precision Engineering & Valve Metrology Division | ISO 9001:2015 Certified</p>
                <h1 className="text-lg font-black text-rose-700 mt-2">STATUTORY NON-CONFORMANCE REPORT & 8D CAPA SHEET</h1>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-base">{printingRecord.ncrNo}</div>
                <div className="text-xs text-slate-500">Date: {printingRecord.ncrDate ? new Date(printingRecord.ncrDate).toLocaleDateString() : 'N/A'}</div>
                {printingRecord.redTagNo && (
                  <div className="mt-1 inline-block px-2 py-0.5 bg-rose-100 text-rose-800 border border-rose-300 font-mono text-xs font-bold rounded">
                    QUARANTINE TAG: {printingRecord.redTagNo}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 my-4 text-xs">
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <div className="font-semibold text-slate-700 mb-1">PART & MATERIAL IDENTIFICATION:</div>
                <div>Item Code: <strong>{printingRecord.itemCode}</strong></div>
                <div>Description: <strong>{printingRecord.itemName}</strong></div>
                <div>Batch / Heat No: <strong>{printingRecord.batchNo || 'N/A'} / {printingRecord.heatNo || 'N/A'}</strong></div>
                <div>Origin Stage: <strong>{printingRecord.ncrType}</strong></div>
              </div>

              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <div className="font-semibold text-slate-700 mb-1">QUANTITY & DEFECT CLASSIFICATION:</div>
                <div>Inspected Qty: <strong>{printingRecord.inspectedQty} {printingRecord.uomCode}</strong></div>
                <div>Rejected Qty: <strong className="text-rose-600">{printingRecord.rejectedQty} {printingRecord.uomCode}</strong></div>
                <div>Severity: <strong className="text-rose-600">{printingRecord.defectSeverity}</strong></div>
                <div>Category: <strong>{printingRecord.defectCategory}</strong></div>
              </div>
            </div>

            <div className="my-3 text-xs">
              <div className="font-semibold text-slate-700 mb-1">NON-CONFORMANCE DESCRIPTION:</div>
              <div className="p-2.5 bg-rose-50/50 border border-rose-200 rounded text-slate-800">
                {printingRecord.defectDescription}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 my-3 text-xs">
              <div>
                <div className="font-semibold text-slate-700 mb-1">CONTAINMENT ACTION:</div>
                <div className="p-2 bg-slate-50 border rounded text-slate-800">
                  {printingRecord.containmentAction || 'Quarantined in QA holding bay'}
                </div>
              </div>
              <div>
                <div className="font-semibold text-slate-700 mb-1">MRB FINAL DISPOSITION:</div>
                <div className="p-2 bg-slate-50 border rounded text-slate-800 font-semibold text-blue-700">
                  {printingRecord.mrbDisposition} ({printingRecord.mrbApproverName || 'Plant QA Manager'})
                </div>
              </div>
            </div>

            {/* 8D CAPA Section */}
            {printingRecord.capaActions && printingRecord.capaActions.length > 0 && (
              <div className="my-4 pt-3 border-t border-slate-300 text-xs">
                <div className="font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                  <Wrench className="h-4 w-4 text-purple-600" />
                  <span>8D CORRECTIVE & PREVENTIVE ACTION RECORD ({printingRecord.capaActions[0].capaNo})</span>
                </div>
                <div className="space-y-2">
                  <div className="p-2 bg-slate-50 border rounded">
                    <strong>Root Cause (5-Why Drilldown):</strong> {printingRecord.capaActions[0].rootCauseAnalysis}
                  </div>
                  <div className="p-2 bg-slate-50 border rounded">
                    <strong>Permanent Corrective Action:</strong> {printingRecord.capaActions[0].correctiveActionPlan}
                  </div>
                  <div className="p-2 bg-slate-50 border rounded">
                    <strong>Systemic Preventive Action:</strong> {printingRecord.capaActions[0].preventiveActionPlan}
                  </div>
                  <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
                    <span>Assigned Lead: {printingRecord.capaActions[0].assignedToName}</span>
                    <span>Effectiveness: <strong className="text-emerald-700">{printingRecord.capaActions[0].effectivenessStatus}</strong></span>
                    <span>Verifier: {printingRecord.capaActions[0].verifierName || 'QA Lead'}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-6 mt-8 pt-4 border-t border-slate-300 text-center text-xs">
              <div>
                <div className="h-10 border-b border-slate-300 flex items-end justify-center pb-1 text-slate-400 italic">Verified</div>
                <div className="mt-1 font-semibold">Quality Inspector</div>
              </div>
              <div>
                <div className="h-10 border-b border-slate-300 flex items-end justify-center pb-1 text-slate-400 italic">Authorized</div>
                <div className="mt-1 font-semibold">MRB Chairman / Plant Head</div>
              </div>
              <div>
                <div className="h-10 border-b border-slate-300 flex items-end justify-center pb-1 text-slate-400 italic">Closed & Certified</div>
                <div className="mt-1 font-semibold">Head of Quality Assurance</div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 print:hidden">
              <button
                onClick={() => setPrintingRecord(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-black rounded-lg flex items-center gap-1.5 shadow"
              >
                <Printer className="h-4 w-4" /> Print Document
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 11. View Details Modal */}
      {viewingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 dark:border-slate-800 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-600" />
                <h3 className="font-semibold text-lg text-slate-900 dark:text-slate-100">
                  NCR #{viewingRecord.ncrNo} Dossier
                </h3>
              </div>
              <button onClick={() => setViewingRecord(null)} className="text-slate-400 hover:text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg">
                <div>Material: <strong>{viewingRecord.itemName} ({viewingRecord.itemCode})</strong></div>
                <div>Date: <strong>{viewingRecord.ncrDate ? new Date(viewingRecord.ncrDate).toLocaleDateString() : 'N/A'}</strong></div>
                <div>Severity: <strong className="text-rose-600">{viewingRecord.defectSeverity}</strong></div>
                <div>Category: <strong>{viewingRecord.defectCategory}</strong></div>
                <div>Inspected: <strong>{viewingRecord.inspectedQty} {viewingRecord.uomCode}</strong></div>
                <div>Rejected: <strong className="text-rose-600">{viewingRecord.rejectedQty} {viewingRecord.uomCode}</strong></div>
                <div>Quarantine Bay: <strong>{viewingRecord.quarantineLocation}</strong></div>
                <div>Tag ID: <strong>{viewingRecord.redTagNo || 'N/A'}</strong></div>
              </div>

              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1">Defect Description:</div>
                <div className="p-2.5 rounded bg-slate-100 dark:bg-slate-800 text-xs">
                  {viewingRecord.defectDescription}
                </div>
              </div>

              {/* MRB Votes */}
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-1.5 flex items-center justify-between">
                  <span>MRB Voting Record ({viewingRecord.mrbVotes?.length || 0} votes)</span>
                  <span className="text-blue-600 font-bold">{viewingRecord.mrbDisposition}</span>
                </div>
                {viewingRecord.mrbVotes && viewingRecord.mrbVotes.length > 0 ? (
                  <div className="space-y-1.5">
                    {viewingRecord.mrbVotes.map((v) => (
                      <div key={v.voteId} className="p-2 rounded bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs">
                        <div className="flex justify-between font-medium">
                          <span>{v.voterName} ({v.voterRole})</span>
                          <span className="font-semibold text-blue-600">{v.recommendedDisposition}</span>
                        </div>
                        {v.voteComments && <p className="text-slate-500 mt-0.5">{v.voteComments}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No MRB votes recorded yet.</p>
                )}
              </div>

              {/* 8D CAPA Action */}
              {viewingRecord.capaActions && viewingRecord.capaActions.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-1.5 flex items-center justify-between">
                    <span>8D CAPA Action ({viewingRecord.capaActions[0].capaNo})</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">
                      {viewingRecord.capaActions[0].status}
                    </span>
                  </div>
                  <div className="p-3 bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg text-xs space-y-1.5">
                    <div><strong>5-Why Root Cause:</strong> {viewingRecord.capaActions[0].rootCauseAnalysis}</div>
                    <div><strong>Corrective Action:</strong> {viewingRecord.capaActions[0].correctiveActionPlan}</div>
                    <div><strong>Preventive Action:</strong> {viewingRecord.capaActions[0].preventiveActionPlan}</div>
                    <div className="flex justify-between text-slate-500 pt-1 text-[11px]">
                      <span>Assigned: {viewingRecord.capaActions[0].assignedToName}</span>
                      <span>Target: {new Date(viewingRecord.capaActions[0].targetCompletionDate).toLocaleDateString()}</span>
                    </div>

                    {viewingRecord.capaActions[0].status !== 'CLOSED' && (
                      <div className="pt-2 flex justify-end">
                        <button
                          onClick={() => {
                            setViewingRecord(null);
                            setCloseCapaRecord({
                              ncr: viewingRecord,
                              capa: viewingRecord.capaActions![0],
                            });
                          }}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium"
                        >
                          Verify & Close CAPA
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setViewingRecord(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 12. Confirm Delete Modal */}
      {deletingRecord && (
        <ConfirmDeleteModal
          isOpen={Boolean(deletingRecord)}
          entityType="Non-Conformance Report"
          entityName={deletingRecord.ncrNo}
          entityCode={deletingRecord.ncrNo}
          onConfirm={() => deleteMutation.mutate(deletingRecord.ncrId)}
          onClose={() => setDeletingRecord(null)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
};
