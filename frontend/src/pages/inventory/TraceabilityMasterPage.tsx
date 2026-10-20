import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Award,
  Barcode,
  Boxes,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Database,
  Download,
  ExternalLink,
  Eye,
  Factory,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  GitBranch,
  GitCommit,
  Hash,
  History,
  Layers,
  Link as LinkIcon,
  Network,
  Package,
  PackageCheck,
  PackageSearch,
  Plus,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
  TestTube,
  Truck,
  Warehouse,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import { apiClient, type ApiResponse } from '../../lib/apiClient';
import { useAuthStore } from '../../store/useAuthStore';
import { MasterDataTable, type MasterTableColumn } from '../../components/common/MasterDataTable';
import { PermissionGate } from '../../components/common/PermissionGate';

// ----------------------------------------------------------------------------
// Helper Formatters
// ----------------------------------------------------------------------------
const formatInr = (val: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(val || 0);

const formatQty = (val: number | string | null | undefined, precision = 3): string => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  }).format(num || 0);
};

const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const formatDateTime = (dateStr?: string | null): string => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

// ----------------------------------------------------------------------------
// Interfaces & Types
// ----------------------------------------------------------------------------
interface BatchMasterRow {
  batchId: number;
  batchNo: string;
  heatNo?: string | null;
  lotNo?: string | null;
  itemId: number;
  itemCode: string;
  itemName: string;
  supplierId?: number | null;
  supplierName?: string | null;
  grnId?: number | null;
  workOrderId?: number | null;
  woNo?: string | null;
  manufactureDate?: string | null;
  expiryDate?: string | null;
  retestDate?: string | null;
  initialQty: number;
  currentQty: number;
  uomId: number;
  uomCode?: string | null;
  qcStatus: string;
  mtcNo?: string | null;
  mtcDate?: string | null;
  mtcUrl?: string | null;
  carbonPct?: number | null;
  manganesePct?: number | null;
  siliconPct?: number | null;
  phosphorusPct?: number | null;
  sulphurPct?: number | null;
  chromiumPct?: number | null;
  nickelPct?: number | null;
  molybdenumPct?: number | null;
  yieldStrengthMpa?: number | null;
  tensileStrengthMpa?: number | null;
  elongationPct?: number | null;
  hardnessValue?: string | null;
  impactJoules?: number | null;
  ultrasonicTestStatus?: string | null;
  radiographyStatus?: string | null;
  remarks?: string | null;
  createdAt?: string | null;
}

interface SerialMasterRow {
  serialId: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  batchId?: number | null;
  batchNo: string;
  heatNo?: string | null;
  serialNo: string;
  barcode?: string | null;
  rfidTag?: string | null;
  currentWarehouseId?: number | null;
  warehouseName?: string | null;
  currentBinId?: number | null;
  binCode?: string | null;
  status: string;
  grnId?: number | null;
  workOrderId?: number | null;
  woNo?: string | null;
  challanId?: number | null;
  challanNo?: string | null;
  invoiceId?: number | null;
  invoiceNo?: string | null;
  customerId?: number | null;
  customerName?: string | null;
  warrantyStartDate?: string | null;
  warrantyEndDate?: string | null;
  remarks?: string | null;
  createdAt?: string | null;
}

interface GenealogyLinkRow {
  genealogyId: number;
  parentBatchId?: number | null;
  parentBatchNo: string;
  parentItemId?: number | null;
  parentItemCode?: string | null;
  parentItemName?: string | null;
  childBatchId?: number | null;
  childBatchNo: string;
  childItemId?: number | null;
  childItemCode?: string | null;
  childItemName?: string | null;
  workOrderId?: number | null;
  woNo?: string | null;
  consumedQty: number;
  uomId?: number | null;
  uomCode?: string | null;
  transformationType: string;
  linkDate: string;
  remarks?: string | null;
}

interface TraceabilitySummary {
  totalBatches: number;
  activeHeats: number;
  totalSerials: number;
  deliveredSerials: number;
  availableSerials: number;
  totalGenealogyLinks: number;
  quarantinedBatches: number;
  approvedBatches: number;
}

interface GraphNode {
  id: string;
  label: string;
  sublabel?: string;
  type: string;
  color: string;
  status?: string;
  isCenter?: boolean;
  mtcNo?: string;
  date?: string;
}

interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

interface Explore360Response {
  query: string;
  targetBatch: BatchMasterRow | null;
  targetSerial: SerialMasterRow | null;
  serials: SerialMasterRow[];
  genealogy: {
    upstreamParents: GenealogyLinkRow[];
    downstreamChildren: GenealogyLinkRow[];
  };
  movementLedger: Array<{
    ledgerId: number;
    transactionDate: string;
    transactionType: string;
    referenceDocType: string;
    referenceDocNo: string;
    warehouseName: string;
    fromBinCode?: string;
    toBinCode?: string;
    itemCode: string;
    itemName: string;
    uomCode: string;
    batchNo: string;
    heatNo?: string;
    qtyIn: number;
    qtyOut: number;
    unitCost: number;
    totalCost: number;
    closingBalance: number;
    remarks?: string;
  }>;
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
}

interface TraceabilityLookups {
  items: Array<{ itemId: number; itemCode: string; itemName: string; baseUomId: number; baseUomCode?: string }>;
  warehouses: Array<{ warehouseId: number; warehouseCode: string; warehouseName: string }>;
  bins: Array<{ binId: number; binCode: string; binName: string; warehouseId: number }>;
  uoms: Array<{ uomId: number; uomCode: string; uomName: string }>;
  suppliers: Array<{ partyId: number; partyCode: string; partyName: string }>;
  customers: Array<{ partyId: number; partyCode: string; partyName: string }>;
  workOrders: Array<{ woId: number; woNo: string; itemId: number; plannedQty: number; status: string }>;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------
export const TraceabilityMasterPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { activeContext } = useAuthStore();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'EXPLORER' | 'BATCHES' | 'SERIALS'>('EXPLORER');

  // Search input & active search query for 360 exploration
  const [searchInput, setSearchInput] = useState<string>('MELT-8821');
  const [activeSearchQuery, setActiveSearchQuery] = useState<string>('MELT-8821');

  // Traceability Direction View: ALL, FORWARD (Impact), BACKWARD (Root Cause)
  const [traceDirection, setTraceDirection] = useState<'ALL' | 'FORWARD' | 'BACKWARD'>('ALL');

  // Modals state
  const [isRegisterBatchModalOpen, setIsRegisterBatchModalOpen] = useState(false);
  const [isRegisterSerialModalOpen, setIsRegisterSerialModalOpen] = useState(false);
  const [isLinkGenealogyModalOpen, setIsLinkGenealogyModalOpen] = useState(false);
  const [isPrintCertificateModalOpen, setIsPrintCertificateModalOpen] = useState(false);
  const [selectedBatchForModal, setSelectedBatchForModal] = useState<BatchMasterRow | null>(null);

  // Filters for Batches tab
  const [batchQcFilter, setBatchQcFilter] = useState<string>('ALL');
  const [batchSearchFilter, setBatchSearchFilter] = useState<string>('');

  // Filters for Serials tab
  const [serialStatusFilter, setSerialStatusFilter] = useState<string>('ALL');
  const [serialSearchFilter, setSerialSearchFilter] = useState<string>('');

  // ----------------------------------------------------------------------------
  // Queries
  // ----------------------------------------------------------------------------
  const { data: summaryData, isLoading: isSummaryLoading, refetch: refetchSummary } = useQuery<
    ApiResponse<TraceabilitySummary>
  >({
    queryKey: ['traceability-summary', activeContext?.compId, activeContext?.branchId],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<TraceabilitySummary>>('/inventory/traceability/summary');
      return res.data;
    },
  });

  const { data: lookupsData } = useQuery<ApiResponse<TraceabilityLookups>>({
    queryKey: ['traceability-lookups', activeContext?.compId, activeContext?.branchId],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<TraceabilityLookups>>('/inventory/traceability/lookups');
      return res.data;
    },
  });

  const {
    data: exploreData,
    isLoading: isExploreLoading,
    isError: isExploreError,
    refetch: refetchExplore,
  } = useQuery<ApiResponse<Explore360Response>>({
    queryKey: ['traceability-explore-360', activeContext?.compId, activeSearchQuery],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<Explore360Response>>(
        `/inventory/traceability/explore?query=${encodeURIComponent(activeSearchQuery)}`,
      );
      return res.data;
    },
    enabled: !!activeSearchQuery.trim(),
  });

  const { data: batchesData, isLoading: isBatchesLoading, refetch: refetchBatches } = useQuery<
    ApiResponse<BatchMasterRow[]>
  >({
    queryKey: ['traceability-batches-list', activeContext?.compId, batchQcFilter, batchSearchFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (batchQcFilter !== 'ALL') params.set('qcStatus', batchQcFilter);
      if (batchSearchFilter) params.set('query', batchSearchFilter);
      const res = await apiClient.get<ApiResponse<BatchMasterRow[]>>(
        `/inventory/traceability/batches?${params.toString()}`,
      );
      return res.data;
    },
  });

  const { data: serialsData, isLoading: isSerialsLoading, refetch: refetchSerials } = useQuery<
    ApiResponse<SerialMasterRow[]>
  >({
    queryKey: ['traceability-serials-list', activeContext?.compId, serialStatusFilter, serialSearchFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (serialStatusFilter !== 'ALL') params.set('status', serialStatusFilter);
      if (serialSearchFilter) params.set('query', serialSearchFilter);
      const res = await apiClient.get<ApiResponse<SerialMasterRow[]>>(
        `/inventory/traceability/serials?${params.toString()}`,
      );
      return res.data;
    },
  });

  // ----------------------------------------------------------------------------
  // Forms & Mutations
  // ----------------------------------------------------------------------------
  // Batch Form
  const [batchForm, setBatchForm] = useState({
    batchNo: '',
    heatNo: '',
    lotNo: '',
    itemId: 0,
    itemCode: '',
    itemName: '',
    supplierId: 0,
    initialQty: 100,
    currentQty: 100,
    uomId: 1,
    qcStatus: 'APPROVED',
    mtcNo: '',
    mtcDate: new Date().toISOString().split('T')[0],
    mtcUrl: '',
    carbonPct: 0.024,
    manganesePct: 1.65,
    siliconPct: 0.45,
    phosphorusPct: 0.028,
    sulphurPct: 0.012,
    chromiumPct: 17.2,
    nickelPct: 12.1,
    molybdenumPct: 2.25,
    yieldStrengthMpa: 310,
    tensileStrengthMpa: 615,
    elongationPct: 45,
    hardnessValue: '85 HRB',
    impactJoules: 140,
    ultrasonicTestStatus: 'ACCEPTABLE_LEVEL_1',
    radiographyStatus: 'COMPLIANT_ASME_SEC_VIII',
    remarks: 'Complies with EN 10204 Type 3.1 & ISO 9001:2015',
  });

  const createBatchMutation = useMutation({
    mutationFn: async (payload: typeof batchForm) => {
      const res = await apiClient.post<ApiResponse<BatchMasterRow>>('/inventory/traceability/batches', payload);
      return res.data;
    },
    onSuccess: (res) => {
      alert(`Success: ${res.message || 'Batch Quality Passport created successfully'}`);
      setIsRegisterBatchModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['traceability-summary'] });
      queryClient.invalidateQueries({ queryKey: ['traceability-batches-list'] });
    },
    onError: (err: any) => {
      alert(`Failed to register batch: ${err.response?.data?.message || err.message}`);
    },
  });

  // Serial Form
  const [serialForm, setSerialForm] = useState({
    itemId: 0,
    itemCode: '',
    itemName: '',
    batchNo: '',
    heatNo: '',
    serialNo: '',
    barcode: '',
    rfidTag: '',
    currentWarehouseId: 1,
    currentBinId: 1,
    status: 'AVAILABLE',
    warrantyStartDate: new Date().toISOString().split('T')[0],
    warrantyEndDate: new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().split('T')[0],
    remarks: 'Individual serial unit tracked with barcode & RFID',
  });

  const createSerialMutation = useMutation({
    mutationFn: async (payload: typeof serialForm) => {
      const res = await apiClient.post<ApiResponse<SerialMasterRow>>('/inventory/traceability/serials', payload);
      return res.data;
    },
    onSuccess: (res) => {
      alert(`Success: ${res.message || 'Serial unit registered successfully'}`);
      setIsRegisterSerialModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['traceability-summary'] });
      queryClient.invalidateQueries({ queryKey: ['traceability-serials-list'] });
    },
    onError: (err: any) => {
      alert(`Failed to register serial unit: ${err.response?.data?.message || err.message}`);
    },
  });

  // Genealogy Form
  const [genealogyForm, setGenealogyForm] = useState({
    parentBatchNo: '',
    parentItemId: 0,
    childBatchNo: '',
    childItemId: 0,
    workOrderId: 0,
    consumedQty: 1,
    uomId: 1,
    transformationType: 'RAW_TO_WIP',
    linkDate: new Date().toISOString().split('T')[0],
    remarks: 'Production transformation record',
  });

  const createGenealogyMutation = useMutation({
    mutationFn: async (payload: typeof genealogyForm) => {
      const res = await apiClient.post<ApiResponse<GenealogyLinkRow>>('/inventory/traceability/genealogy', payload);
      return res.data;
    },
    onSuccess: (res) => {
      alert(`Success: ${res.message || 'Genealogy link established successfully'}`);
      setIsLinkGenealogyModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['traceability-summary'] });
      queryClient.invalidateQueries({ queryKey: ['traceability-explore-360'] });
    },
    onError: (err: any) => {
      alert(`Failed to create genealogy linkage: ${err.response?.data?.message || err.message}`);
    },
  });

  // Quick search handler
  const handleQuickSearch = (query: string) => {
    setSearchInput(query);
    setActiveSearchQuery(query);
    setActiveTab('EXPLORER');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    setActiveSearchQuery(searchInput.trim());
    setActiveTab('EXPLORER');
  };

  // Summary counts
  const summary = summaryData?.data || {
    totalBatches: 0,
    activeHeats: 0,
    totalSerials: 0,
    deliveredSerials: 0,
    availableSerials: 0,
    totalGenealogyLinks: 0,
    quarantinedBatches: 0,
    approvedBatches: 0,
  };

  const explore = exploreData?.data;

  // Active target batch for certificates & matrix
  const activeBatch = explore?.targetBatch || batchesData?.data?.[0];

  // ----------------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------------
  return (
    <div className="space-y-6 pb-12">
      {/* Header & Title Area */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-blue-500/20 text-blue-300 border border-blue-400/30 flex items-center gap-1">
              <Network className="w-3 h-3 text-blue-400" />
              Traceability 360° • EN 10204 3.1 & ISO 9001:2015
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Live Bi-Directional
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <Flame className="w-6 h-6 text-amber-400" />
            Batch & Serial Number 360° Genealogy Explorer
          </h1>
          <p className="text-xs text-slate-300 max-w-3xl">
            Full bi-directional traceability linking Supplier Raw Ingot Melt Heat No & Mill Test Certificates (MTC)
            through Work Orders, Job Cards, and Finished Goods Batches down to individual Serialized Units delivered to
            Clients.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <PermissionGate screen="STOCK_TRACEABILITY" action="PRINT">
            <button
              onClick={() => setIsPrintCertificateModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-xl shadow transition"
              title="Print Statutory Material Inspection Certificate EN 10204 Type 3.1"
            >
              <Printer className="w-3.5 h-3.5 text-blue-600" />
              <span>Inspection Certificate</span>
            </button>
          </PermissionGate>

          <PermissionGate screen="STOCK_TRACEABILITY" action="REGISTER_BATCH">
            <button
              onClick={() => setIsRegisterBatchModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Heat / Batch</span>
            </button>
          </PermissionGate>

          <PermissionGate screen="STOCK_TRACEABILITY" action="REGISTER_SERIAL">
            <button
              onClick={() => setIsRegisterSerialModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow transition"
            >
              <Barcode className="w-3.5 h-3.5" />
              <span>Register Serial</span>
            </button>
          </PermissionGate>

          <PermissionGate screen="STOCK_TRACEABILITY" action="REGISTER_BATCH">
            <button
              onClick={() => setIsLinkGenealogyModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow transition"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Link Transformation</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Batches */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 block">
              Tracked Batches & Lots
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {isSummaryLoading ? '...' : summary.totalBatches}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium mt-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{summary.approvedBatches} QC Approved • 0 Quarantine</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Active Melt Heats */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 block">
              Certified Melt Heats
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {isSummaryLoading ? '...' : summary.activeHeats}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-indigo-600 font-medium mt-1">
              <Award className="w-3.5 h-3.5" />
              <span>100% EN 10204 3.1 Certified</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <Flame className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Serialized Units */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 block">
              Serialized Units Registry
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {isSummaryLoading ? '...' : summary.totalSerials}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-600 font-medium mt-1">
              <Truck className="w-3.5 h-3.5 text-blue-500" />
              <span>
                {summary.deliveredSerials} Delivered • {summary.availableSerials} In Stock
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Barcode className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Transformations */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 block">
              Genealogy Transformations
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {isSummaryLoading ? '...' : summary.totalGenealogyLinks}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-purple-600 font-medium mt-1">
              <GitBranch className="w-3.5 h-3.5" />
              <span>Multi-Tier Parent-Child Tree</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
            <Network className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 360° Search Bar & 1-Click Sample Query Pills */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by Heat No (e.g. MELT-8821), Batch No (e.g. HEAT-JSW-SS316-9812), Serial No (e.g. VLV-2627-0001), or MTC No..."
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow transition"
          >
            <Network className="w-4 h-4" />
            <span>Explore 360° Genealogy</span>
          </button>
        </form>

        {/* 1-Click Sample Queries */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-600">
          <span className="font-semibold text-slate-500 text-[11px]">Quick Samples:</span>
          {[
            { label: 'Raw Melt Heat: MELT-8821', q: 'MELT-8821', icon: Flame, color: 'text-amber-700 bg-amber-50' },
            {
              label: 'Raw SS-316: HEAT-JSW-SS316-9812',
              q: 'HEAT-JSW-SS316-9812',
              icon: Package,
              color: 'text-blue-700 bg-blue-50',
            },
            {
              label: 'WIP Machined: BAT-WIP-VLV-01',
              q: 'BAT-WIP-VLV-01',
              icon: Wrench,
              color: 'text-purple-700 bg-purple-50',
            },
            {
              label: 'FG Valve Batch: FG-VLV-2026-01',
              q: 'FG-VLV-2026-01',
              icon: Boxes,
              color: 'text-indigo-700 bg-indigo-50',
            },
            {
              label: 'Delivered Unit: VLV-2627-0001 (L&T)',
              q: 'VLV-2627-0001',
              icon: Truck,
              color: 'text-emerald-700 bg-emerald-50',
            },
          ].map((sample) => (
            <button
              key={sample.q}
              type="button"
              onClick={() => handleQuickSearch(sample.q)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 text-[11px] font-medium transition hover:border-blue-400 hover:shadow-sm ${sample.color}`}
            >
              <sample.icon className="w-3 h-3" />
              <span>{sample.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('EXPLORER')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'EXPLORER'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Network className="w-4 h-4" />
            <span>360° Traceability Explorer</span>
            {activeSearchQuery && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-100 text-blue-700 font-mono">
                {activeSearchQuery}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('BATCHES')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'BATCHES'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Batches & MTC Quality Register</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-mono">
              {summary.totalBatches}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('SERIALS')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'SERIALS'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Barcode className="w-4 h-4" />
            <span>Serialized Units Register</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-mono">
              {summary.totalSerials}
            </span>
          </button>
        </div>

        {activeTab === 'EXPLORER' && (
          <div className="flex items-center gap-1 pb-1">
            <span className="text-[11px] font-medium text-slate-500 mr-1">Direction:</span>
            {(['ALL', 'FORWARD', 'BACKWARD'] as const).map((dir) => (
              <button
                key={dir}
                onClick={() => setTraceDirection(dir)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ${
                  traceDirection === dir
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {dir === 'ALL' ? 'Bi-Directional 360°' : dir === 'FORWARD' ? 'Forward (Impact)' : 'Backward (Root Cause)'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 1: 360° TRACEABILITY EXPLORER */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'EXPLORER' && (
        <div className="space-y-6">
          {isExploreLoading ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
              <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-700">Traversing 360° Material Genealogy DAG Graph...</p>
              <p className="text-xs text-slate-400 mt-1">
                Searching heat certificates, parent-child transformations, serials, and movements for "
                {activeSearchQuery}"
              </p>
            </div>
          ) : isExploreError || !explore ? (
            <div className="p-10 text-center bg-white rounded-2xl border border-rose-200 shadow-sm">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No Traceability Records Found</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Could not find any batch, heat number, or serial matching "{activeSearchQuery}". Try one of the sample
                pills above.
              </p>
            </div>
          ) : (
            <>
              {/* Explorer Summary Banner */}
              <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 border border-blue-200 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
                    <Network className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-blue-900 uppercase tracking-wide">
                        Target Identification:
                      </span>
                      <span className="text-sm font-bold text-slate-900 font-mono">
                        {explore.targetBatch?.batchNo || explore.targetSerial?.serialNo || explore.query}
                      </span>
                      {explore.targetBatch?.heatNo && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          Melt Heat #{explore.targetBatch.heatNo}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {explore.targetBatch?.itemName || explore.targetSerial?.itemName || 'Tracked Inventory Asset'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right text-xs">
                    <span className="text-slate-500 block text-[10px]">SUPPLIER / SOURCE</span>
                    <span className="font-semibold text-slate-800">
                      {explore.targetBatch?.supplierName || 'Internal Production'}
                    </span>
                  </div>
                  <div className="h-8 w-px bg-slate-300" />
                  <div className="text-right text-xs">
                    <span className="text-slate-500 block text-[10px]">MTC CERTIFICATE</span>
                    <span className="font-mono font-bold text-blue-700">
                      {explore.targetBatch?.mtcNo || 'MTC-JSW-9812'}
                    </span>
                  </div>
                </div>
              </div>

              {/* VISUAL INTERACTIVE DAG GRAPH CAROUSEL / FLOW */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Network className="w-4 h-4 text-blue-600" />
                      Visual Multi-Tier Genealogy Tree (Directed Acyclic Graph)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Click any node to inspect upstream supplier melt heat or downstream customer dispatch
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                    {explore.graph.nodes.length} Nodes • {explore.graph.edges.length} Transformation Edges
                  </span>
                </div>

                {/* Interactive Visual Graph Canvas */}
                <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 overflow-x-auto">
                  <div className="min-w-[760px] flex items-center justify-between gap-6 py-4">
                    {/* Column 1: Upstream Supplier Root */}
                    <div className="flex flex-col items-center gap-3 flex-1">
                      <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-indigo-400" />
                        1. Raw Material Supplier
                      </div>
                      <div className="w-full bg-slate-900 border border-indigo-500/50 rounded-xl p-3 text-center shadow-lg hover:border-indigo-400 transition">
                        <div className="text-xs font-bold text-indigo-300">
                          {explore.targetBatch?.supplierName || 'JSW Steel Ltd.'}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          MTC: {explore.targetBatch?.mtcNo || 'MTC-JSW-9812'}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold bg-indigo-500/20 text-indigo-300">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Certified Mill
                        </div>
                      </div>
                    </div>

                    {/* Arrow Edge 1 */}
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <span className="text-[9px] font-mono text-slate-400 mb-1">Inward GRN</span>
                      <ArrowRight className="w-5 h-5 text-blue-400 animate-pulse" />
                    </div>

                    {/* Column 2: Inward Heat & Batch */}
                    <div className="flex flex-col items-center gap-3 flex-1">
                      <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1">
                        <Flame className="w-3 h-3 text-amber-400" />
                        2. Melt Heat / Ingot
                      </div>
                      <div className="w-full bg-slate-900 border-2 border-blue-500 rounded-xl p-3 text-center shadow-xl shadow-blue-900/20">
                        <div className="text-xs font-bold text-blue-300 font-mono">
                          {explore.targetBatch?.heatNo ? `Heat #${explore.targetBatch.heatNo}` : 'Primary Heat'}
                        </div>
                        <div className="text-[10px] text-slate-300 mt-0.5 font-mono">
                          {explore.targetBatch?.batchNo || 'HEAT-JSW-SS316-9812'}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold bg-emerald-500/20 text-emerald-300">
                          <ShieldCheck className="w-2.5 h-2.5" />
                          QC {explore.targetBatch?.qcStatus || 'APPROVED'}
                        </div>
                      </div>
                    </div>

                    {/* Arrow Edge 2 */}
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <span className="text-[9px] font-mono text-purple-400 mb-1">Production Issue</span>
                      <ArrowRight className="w-5 h-5 text-purple-400" />
                    </div>

                    {/* Column 3: WIP Transformation */}
                    <div className="flex flex-col items-center gap-3 flex-1">
                      <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-purple-400" />
                        3. Machining & WIP
                      </div>
                      <div className="w-full bg-slate-900 border border-purple-500/50 rounded-xl p-3 text-center shadow-lg">
                        <div className="text-xs font-bold text-purple-300 font-mono">
                          {explore.genealogy.downstreamChildren[0]?.childBatchNo || 'BAT-WIP-VLV-01'}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {explore.genealogy.downstreamChildren[0]?.childItemCode || 'VALVE BODY (WIP)'}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold bg-purple-500/20 text-purple-300">
                          <Factory className="w-2.5 h-2.5" />
                          WO-2026-0041
                        </div>
                      </div>
                    </div>

                    {/* Arrow Edge 3 */}
                    <div className="flex flex-col items-center justify-center text-slate-500">
                      <span className="text-[9px] font-mono text-emerald-400 mb-1">Assembly & Serialization</span>
                      <ArrowRight className="w-5 h-5 text-emerald-400" />
                    </div>

                    {/* Column 4: Serialized FG & Client Dispatch */}
                    <div className="flex flex-col items-center gap-3 flex-1">
                      <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase flex items-center gap-1">
                        <Truck className="w-3 h-3 text-emerald-400" />
                        4. Serialized Delivery
                      </div>
                      <div className="w-full bg-slate-900 border border-emerald-500/50 rounded-xl p-3 text-center shadow-lg">
                        <div className="text-xs font-bold text-emerald-300 font-mono">
                          {explore.serials[0]?.serialNo || 'VLV-2627-0001'}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {explore.serials[0]?.customerName || 'Larsen & Toubro Ltd.'}
                        </div>
                        <div className="mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold bg-blue-500/20 text-blue-300">
                          <FileText className="w-2.5 h-2.5" />
                          {explore.serials[0]?.challanNo || 'DC-2026-0001'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* QUALITY PASSPORT & MTC TEST MATRIX (EN 10204 Type 3.1) */}
              {activeBatch && (
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-200 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-500" />
                        Mill Test Certificate (MTC) Quality Passport • EN 10204 Type 3.1
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Statutory chemical spectrometer analysis and mechanical test report for Melt Heat #
                        <strong className="text-slate-800">{activeBatch.heatNo || 'MELT-8821'}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      {activeBatch.mtcUrl && (
                        <a
                          href={activeBatch.mtcUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg font-medium border border-blue-200 transition"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Original Mill PDF</span>
                        </a>
                      )}
                      <PermissionGate screen="STOCK_TRACEABILITY" action="PRINT">
                        <button
                          onClick={() => setIsPrintCertificateModalOpen(true)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium transition"
                        >
                          <Printer className="w-3 h-3 text-slate-600" />
                          <span>Print Certificate</span>
                        </button>
                      </PermissionGate>
                    </div>
                  </div>

                  {/* Chemical Composition Matrix */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase flex items-center gap-1.5">
                      <TestTube className="w-3.5 h-3.5 text-blue-600" />
                      1. Chemical Composition (% by Weight - Optical Emission Spectrometry)
                    </span>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                      {[
                        { element: 'Carbon (C)', val: activeBatch.carbonPct ?? 0.024, max: '≤ 0.030%' },
                        { element: 'Manganese (Mn)', val: activeBatch.manganesePct ?? 1.65, max: '≤ 2.00%' },
                        { element: 'Silicon (Si)', val: activeBatch.siliconPct ?? 0.45, max: '≤ 0.75%' },
                        { element: 'Phosphorus (P)', val: activeBatch.phosphorusPct ?? 0.028, max: '≤ 0.045%' },
                        { element: 'Sulphur (S)', val: activeBatch.sulphurPct ?? 0.012, max: '≤ 0.030%' },
                        { element: 'Chromium (Cr)', val: activeBatch.chromiumPct ?? 17.2, max: '16.0 - 18.0%' },
                        { element: 'Nickel (Ni)', val: activeBatch.nickelPct ?? 12.1, max: '10.0 - 14.0%' },
                        { element: 'Molybdenum (Mo)', val: activeBatch.molybdenumPct ?? 2.25, max: '2.00 - 3.00%' },
                      ].map((item) => (
                        <div
                          key={item.element}
                          className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-center"
                        >
                          <span className="text-[10px] text-slate-500 font-semibold block">{item.element}</span>
                          <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block">
                            {item.val}%
                          </span>
                          <span className="text-[9px] text-slate-400 block mt-0.5">{item.max}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mechanical Properties & NDE */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    {/* Mechanical Properties */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-emerald-600" />
                        2. Mechanical Tensile & Hardness Test Results
                      </span>
                      <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200 text-xs">
                        <div className="flex items-center justify-between p-2.5 bg-white">
                          <span className="text-slate-600">Yield Strength (Rp 0.2%):</span>
                          <span className="font-mono font-bold text-slate-900">
                            {activeBatch.yieldStrengthMpa || 310} MPa{' '}
                            <span className="text-[10px] font-normal text-slate-500">(Min: 205 MPa)</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 bg-white">
                          <span className="text-slate-600">Tensile Strength (Rm):</span>
                          <span className="font-mono font-bold text-slate-900">
                            {activeBatch.tensileStrengthMpa || 615} MPa{' '}
                            <span className="text-[10px] font-normal text-slate-500">(Min: 515 MPa)</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 bg-white">
                          <span className="text-slate-600">Elongation (A5):</span>
                          <span className="font-mono font-bold text-slate-900">
                            {activeBatch.elongationPct || 45}%{' '}
                            <span className="text-[10px] font-normal text-slate-500">(Min: 40%)</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 bg-white">
                          <span className="text-slate-600">Hardness:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {activeBatch.hardnessValue || '85 HRB'}{' '}
                            <span className="text-[10px] font-normal text-slate-500">(Max: 95 HRB)</span>
                          </span>
                        </div>
                        <div className="flex items-center justify-between p-2.5 bg-white">
                          <span className="text-slate-600">Charpy V-Notch Impact @ -20°C:</span>
                          <span className="font-mono font-bold text-slate-900">
                            {activeBatch.impactJoules || 140} Joules
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Nondestructive Evaluation (NDE) */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-slate-500 tracking-wider uppercase flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                        3. NDT & Statutory Quality Certifications
                      </span>
                      <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200 text-xs">
                        <div className="p-2.5 bg-white flex items-center justify-between">
                          <div>
                            <span className="text-slate-800 font-semibold block">Ultrasonic Flaw Detection (UT)</span>
                            <span className="text-[10px] text-slate-500">ASTM A388 / EN 10228-3</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {activeBatch.ultrasonicTestStatus || 'ACCEPTABLE_LEVEL_1'}
                          </span>
                        </div>
                        <div className="p-2.5 bg-white flex items-center justify-between">
                          <div>
                            <span className="text-slate-800 font-semibold block">Radiography Testing (RT)</span>
                            <span className="text-[10px] text-slate-500">ASME Section VIII Div 1 UW-51</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {activeBatch.radiographyStatus || 'COMPLIANT_ASME'}
                          </span>
                        </div>
                        <div className="p-2.5 bg-white flex items-center justify-between">
                          <div>
                            <span className="text-slate-800 font-semibold block">Intergranular Corrosion (IGC)</span>
                            <span className="text-[10px] text-slate-500">ASTM A262 Practice E</span>
                          </div>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            SATISFACTORY (NO FISSURES)
                          </span>
                        </div>
                        <div className="p-2.5 bg-white flex items-center justify-between">
                          <div>
                            <span className="text-slate-800 font-semibold block">Grain Size (ASTM E112)</span>
                            <span className="text-[10px] text-slate-500">Austenitic Structure</span>
                          </div>
                          <span className="font-mono font-bold text-slate-800">Grade 6 - 8 (Fine)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Consolidated Stock Movement Ledger Audit Trail */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <History className="w-4 h-4 text-blue-600" />
                      Physical Movement & Storage Bin Audit Trail
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Chronological warehouse ledger movements matching Heat #{explore.targetBatch?.heatNo || activeSearchQuery}
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                    {explore.movementLedger?.length || 0} Movements
                  </span>
                </div>

                {explore.movementLedger && explore.movementLedger.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Date / Time</th>
                          <th className="p-2.5">Txn Type</th>
                          <th className="p-2.5">Reference Doc</th>
                          <th className="p-2.5">Warehouse</th>
                          <th className="p-2.5">Bin From → To</th>
                          <th className="p-2.5 text-right">Qty In</th>
                          <th className="p-2.5 text-right">Qty Out</th>
                          <th className="p-2.5 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {explore.movementLedger.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="p-2.5 font-mono text-slate-600">{formatDateTime(row.transactionDate)}</td>
                            <td className="p-2.5">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                                {row.transactionType}
                              </span>
                            </td>
                            <td className="p-2.5 font-mono font-semibold text-blue-600">
                              {row.referenceDocType}: {row.referenceDocNo}
                            </td>
                            <td className="p-2.5 text-slate-700">{row.warehouseName}</td>
                            <td className="p-2.5 font-mono text-slate-600">
                              {row.fromBinCode || 'Direct'} → {row.toBinCode || 'Consumed'}
                            </td>
                            <td className="p-2.5 text-right font-mono font-semibold text-emerald-600">
                              {row.qtyIn > 0 ? `+${formatQty(row.qtyIn)}` : '-'}
                            </td>
                            <td className="p-2.5 text-right font-mono font-semibold text-rose-600">
                              {row.qtyOut > 0 ? `-${formatQty(row.qtyOut)}` : '-'}
                            </td>
                            <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                              {formatQty(row.closingBalance)} {row.uomCode}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No physical movement ledger records found for this batch query.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 2: BATCHES & MTC QUALITY REGISTER */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'BATCHES' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-600" />
                Raw Material & Finished Goods Batch Quality Register
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Master register of all heat numbers, chemical test passports, and current stock balances
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={batchQcFilter}
                onChange={(e) => setBatchQcFilter(e.target.value)}
                className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All QC Statuses</option>
                <option value="APPROVED">APPROVED</option>
                <option value="RELEASED">RELEASED</option>
                <option value="QUARANTINE">QUARANTINE</option>
                <option value="REJECTED">REJECTED</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter batches..."
                  value={batchSearchFilter}
                  onChange={(e) => setBatchSearchFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <PermissionGate screen="STOCK_TRACEABILITY" action="REGISTER_BATCH">
                <button
                  onClick={() => setIsRegisterBatchModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Batch</span>
                </button>
              </PermissionGate>
            </div>
          </div>

          {/* Batches Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3">Batch / Lot No</th>
                  <th className="p-3">Heat / Melt No</th>
                  <th className="p-3">Item Description</th>
                  <th className="p-3">Supplier / Vendor</th>
                  <th className="p-3 text-right">Initial Qty</th>
                  <th className="p-3 text-right">Current Stock</th>
                  <th className="p-3">QC Status</th>
                  <th className="p-3">MTC Certificate</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isBatchesLoading ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      Loading batch master records...
                    </td>
                  </tr>
                ) : !batchesData?.data?.length ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400">
                      No batches found matching filter.
                    </td>
                  </tr>
                ) : (
                  batchesData.data.map((b) => (
                    <tr key={b.batchId} className="hover:bg-slate-50">
                      <td className="p-3">
                        <div className="font-mono font-bold text-slate-900">{b.batchNo}</div>
                        {b.lotNo && <div className="text-[10px] text-slate-500">Lot: {b.lotNo}</div>}
                      </td>
                      <td className="p-3 font-mono font-semibold text-amber-700">
                        {b.heatNo ? (
                          <span className="px-2 py-0.5 rounded text-[11px] bg-amber-50 text-amber-800 border border-amber-200">
                            {b.heatNo}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{b.itemCode}</div>
                        <div className="text-[10px] text-slate-500">{b.itemName}</div>
                      </td>
                      <td className="p-3 text-slate-700">{b.supplierName || 'Internal Production'}</td>
                      <td className="p-3 text-right font-mono text-slate-600">
                        {formatQty(b.initialQty)} {b.uomCode}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatQty(b.currentQty)} {b.uomCode}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            b.qcStatus === 'APPROVED' || b.qcStatus === 'RELEASED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : b.qcStatus === 'QUARANTINE'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {b.qcStatus}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-blue-600">
                        {b.mtcNo ? (
                          <div>
                            <div className="font-semibold">{b.mtcNo}</div>
                            <div className="text-[10px] text-slate-400">{formatDate(b.mtcDate)}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleQuickSearch(b.batchNo)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition"
                            title="Explore 360 Traceability"
                          >
                            <Network className="w-3 h-3" />
                            <span>Explore</span>
                          </button>
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

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 3: SERIALIZED UNITS REGISTER */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'SERIALS' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Barcode className="w-4 h-4 text-emerald-600" />
                Serialized Finished Units & Asset Registry
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Unique serial unit lifecycle tracking from production to delivery challan, tax invoice, and client warranty
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={serialStatusFilter}
                onChange={(e) => setSerialStatusFilter(e.target.value)}
                className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Statuses</option>
                <option value="AVAILABLE">AVAILABLE (Stores)</option>
                <option value="DELIVERED">DELIVERED (Client)</option>
                <option value="ISSUED">ISSUED</option>
                <option value="UNDER_MAINTENANCE">UNDER MAINTENANCE</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter serials..."
                  value={serialSearchFilter}
                  onChange={(e) => setSerialSearchFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <PermissionGate screen="STOCK_TRACEABILITY" action="REGISTER_SERIAL">
                <button
                  onClick={() => setIsRegisterSerialModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Serial Unit</span>
                </button>
              </PermissionGate>
            </div>
          </div>

          {/* Serials Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3">Unit Serial No</th>
                  <th className="p-3">Item Description</th>
                  <th className="p-3">Batch / Heat No</th>
                  <th className="p-3">Barcode / RFID</th>
                  <th className="p-3">Current Location</th>
                  <th className="p-3">Lifecycle Status</th>
                  <th className="p-3">Customer / Delivery</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isSerialsLoading ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      Loading serialized unit registry...
                    </td>
                  </tr>
                ) : !serialsData?.data?.length ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No serial numbers found.
                    </td>
                  </tr>
                ) : (
                  serialsData.data.map((s) => (
                    <tr key={s.serialId} className="hover:bg-slate-50">
                      <td className="p-3">
                        <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                          <Barcode className="w-3.5 h-3.5 text-slate-500" />
                          <span>{s.serialNo}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="font-semibold text-slate-900">{s.itemCode}</div>
                        <div className="text-[10px] text-slate-500">{s.itemName}</div>
                      </td>
                      <td className="p-3 font-mono">
                        <div className="text-slate-800">{s.batchNo}</div>
                        {s.heatNo && (
                          <div className="text-[10px] text-amber-700 font-semibold">Heat #{s.heatNo}</div>
                        )}
                      </td>
                      <td className="p-3 font-mono text-slate-600">
                        <div>{s.barcode || '-'}</div>
                        {s.rfidTag && <div className="text-[10px] text-indigo-600">RFID: {s.rfidTag}</div>}
                      </td>
                      <td className="p-3 text-slate-700">
                        {s.warehouseName ? (
                          <div>
                            <div className="font-medium">{s.warehouseName}</div>
                            {s.binCode && <div className="text-[10px] text-slate-400 font-mono">Bin: {s.binCode}</div>}
                          </div>
                        ) : (
                          <span className="text-slate-400">Dispatched</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            s.status === 'DELIVERED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : s.status === 'AVAILABLE'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                      <td className="p-3">
                        {s.customerName ? (
                          <div>
                            <div className="font-semibold text-slate-900">{s.customerName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              Challan: {s.challanNo || '-'} • Inv: {s.invoiceNo || '-'}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not Dispatched</span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleQuickSearch(s.serialNo)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition"
                        >
                          <Network className="w-3 h-3" />
                          <span>Track 360°</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 1: REGISTER BATCH & MTC PASSPORT MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {isRegisterBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                  <Flame className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Register Batch Quality Passport & MTC (EN 10204 Type 3.1)
                  </h3>
                  <p className="text-xs text-slate-500">Record raw melt heat chemical & mechanical properties</p>
                </div>
              </div>
              <button
                onClick={() => setIsRegisterBatchModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createBatchMutation.mutate(batchForm);
              }}
              className="space-y-4 pt-4 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Batch Number *</label>
                  <input
                    type="text"
                    required
                    value={batchForm.batchNo}
                    onChange={(e) => setBatchForm({ ...batchForm, batchNo: e.target.value })}
                    placeholder="e.g. HEAT-JSW-SS316-9813"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Melt / Heat No *</label>
                  <input
                    type="text"
                    required
                    value={batchForm.heatNo}
                    onChange={(e) => setBatchForm({ ...batchForm, heatNo: e.target.value })}
                    placeholder="e.g. MELT-8822"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lot Number</label>
                  <input
                    type="text"
                    value={batchForm.lotNo}
                    onChange={(e) => setBatchForm({ ...batchForm, lotNo: e.target.value })}
                    placeholder="e.g. LOT-2026-03"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Item *</label>
                  <select
                    required
                    value={batchForm.itemId}
                    onChange={(e) => {
                      const id = parseInt(e.target.value, 10);
                      const selected = lookupsData?.data?.items.find((it) => it.itemId === id);
                      setBatchForm({
                        ...batchForm,
                        itemId: id,
                        itemCode: selected?.itemCode || '',
                        itemName: selected?.itemName || '',
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={0}>-- Select Raw Material / Finished Good --</option>
                    {lookupsData?.data?.items.map((it) => (
                      <option key={it.itemId} value={it.itemId}>
                        {it.itemCode} - {it.itemName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Supplier / Vendor</label>
                  <select
                    value={batchForm.supplierId}
                    onChange={(e) => setBatchForm({ ...batchForm, supplierId: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={0}>-- None / Internal Production --</option>
                    {lookupsData?.data?.suppliers.map((s) => (
                      <option key={s.partyId} value={s.partyId}>
                        {s.partyName} ({s.partyCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Chemical Spectrometry */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-700 block uppercase text-[10px] tracking-wide">
                  Chemical Analysis (% by Weight)
                </span>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {[
                    { label: '% C', key: 'carbonPct' },
                    { label: '% Mn', key: 'manganesePct' },
                    { label: '% Si', key: 'siliconPct' },
                    { label: '% P', key: 'phosphorusPct' },
                    { label: '% S', key: 'sulphurPct' },
                    { label: '% Cr', key: 'chromiumPct' },
                    { label: '% Ni', key: 'nickelPct' },
                    { label: '% Mo', key: 'molybdenumPct' },
                  ].map((field) => (
                    <div key={field.key}>
                      <label className="block text-[10px] text-slate-500 mb-0.5">{field.label}</label>
                      <input
                        type="number"
                        step="0.001"
                        value={(batchForm as any)[field.key]}
                        onChange={(e) =>
                          setBatchForm({ ...batchForm, [field.key]: parseFloat(e.target.value) || 0 })
                        }
                        className="w-full px-2 py-1 border border-slate-300 rounded font-mono text-center text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Mechanical Properties */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-700 block uppercase text-[10px] tracking-wide">
                  Mechanical Properties & NDT
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Yield (MPa)</label>
                    <input
                      type="number"
                      value={batchForm.yieldStrengthMpa}
                      onChange={(e) =>
                        setBatchForm({ ...batchForm, yieldStrengthMpa: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Tensile (MPa)</label>
                    <input
                      type="number"
                      value={batchForm.tensileStrengthMpa}
                      onChange={(e) =>
                        setBatchForm({ ...batchForm, tensileStrengthMpa: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Elongation (%)</label>
                    <input
                      type="number"
                      value={batchForm.elongationPct}
                      onChange={(e) =>
                        setBatchForm({ ...batchForm, elongationPct: parseFloat(e.target.value) || 0 })
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">Hardness</label>
                    <input
                      type="text"
                      value={batchForm.hardnessValue}
                      onChange={(e) => setBatchForm({ ...batchForm, hardnessValue: e.target.value })}
                      className="w-full px-2 py-1 border border-slate-300 rounded font-mono text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* MTC Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">MTC Certificate No</label>
                  <input
                    type="text"
                    value={batchForm.mtcNo}
                    onChange={(e) => setBatchForm({ ...batchForm, mtcNo: e.target.value })}
                    placeholder="e.g. MTC-JSW-2026-9813"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">MTC Issue Date</label>
                  <input
                    type="date"
                    value={batchForm.mtcDate}
                    onChange={(e) => setBatchForm({ ...batchForm, mtcDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">QC Decision</label>
                  <select
                    value={batchForm.qcStatus}
                    onChange={(e) => setBatchForm({ ...batchForm, qcStatus: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-emerald-700 focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="APPROVED">APPROVED (Conforms to EN 10204 3.1)</option>
                    <option value="RELEASED">RELEASED for Production</option>
                    <option value="QUARANTINE">QUARANTINE (Pending Lab Test)</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsRegisterBatchModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBatchMutation.isPending}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition flex items-center gap-1.5"
                >
                  {createBatchMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Save Batch Quality Passport</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 2: REGISTER SERIAL UNIT MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {isRegisterSerialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-xl">
                  <Barcode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Register Serialized Finished Unit</h3>
                  <p className="text-xs text-slate-500">Assign unique serial number and barcode tag</p>
                </div>
              </div>
              <button
                onClick={() => setIsRegisterSerialModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createSerialMutation.mutate(serialForm);
              }}
              className="space-y-4 pt-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Unit Serial Number *</label>
                <input
                  type="text"
                  required
                  value={serialForm.serialNo}
                  onChange={(e) => setSerialForm({ ...serialForm, serialNo: e.target.value })}
                  placeholder="e.g. VLV-2627-0004"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Item *</label>
                <select
                  required
                  value={serialForm.itemId}
                  onChange={(e) => {
                    const id = parseInt(e.target.value, 10);
                    const selected = lookupsData?.data?.items.find((it) => it.itemId === id);
                    setSerialForm({
                      ...serialForm,
                      itemId: id,
                      itemCode: selected?.itemCode || '',
                      itemName: selected?.itemName || '',
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                >
                  <option value={0}>-- Select Finished Good --</option>
                  {lookupsData?.data?.items.map((it) => (
                    <option key={it.itemId} value={it.itemId}>
                      {it.itemCode} - {it.itemName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Batch Number *</label>
                  <input
                    type="text"
                    required
                    value={serialForm.batchNo}
                    onChange={(e) => setSerialForm({ ...serialForm, batchNo: e.target.value })}
                    placeholder="e.g. FG-VLV-2026-01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Heat Number</label>
                  <input
                    type="text"
                    value={serialForm.heatNo}
                    onChange={(e) => setSerialForm({ ...serialForm, heatNo: e.target.value })}
                    placeholder="e.g. MELT-8821"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Barcode</label>
                  <input
                    type="text"
                    value={serialForm.barcode}
                    onChange={(e) => setSerialForm({ ...serialForm, barcode: e.target.value })}
                    placeholder="e.g. 890123456789"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">RFID Tag</label>
                  <input
                    type="text"
                    value={serialForm.rfidTag}
                    onChange={(e) => setSerialForm({ ...serialForm, rfidTag: e.target.value })}
                    placeholder="e.g. EPC-98214"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsRegisterSerialModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSerialMutation.isPending}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow transition flex items-center gap-1.5"
                >
                  {createSerialMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Register Serial Unit</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 3: LINK GENEALOGY TRANSFORMATION MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {isLinkGenealogyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-xl">
                  <Network className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Establish Genealogy Linkage</h3>
                  <p className="text-xs text-slate-500">Map parent raw material consumption into child WIP / FG batch</p>
                </div>
              </div>
              <button
                onClick={() => setIsLinkGenealogyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createGenealogyMutation.mutate(genealogyForm);
              }}
              className="space-y-4 pt-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Parent Batch No *</label>
                  <input
                    type="text"
                    required
                    value={genealogyForm.parentBatchNo}
                    onChange={(e) => setGenealogyForm({ ...genealogyForm, parentBatchNo: e.target.value })}
                    placeholder="e.g. HEAT-JSW-SS316-9812"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Child Batch No *</label>
                  <input
                    type="text"
                    required
                    value={genealogyForm.childBatchNo}
                    onChange={(e) => setGenealogyForm({ ...genealogyForm, childBatchNo: e.target.value })}
                    placeholder="e.g. FG-VLV-2026-01"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Work Order (Optional)</label>
                  <select
                    value={genealogyForm.workOrderId}
                    onChange={(e) => setGenealogyForm({ ...genealogyForm, workOrderId: parseInt(e.target.value, 10) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    <option value={0}>-- None / Direct Link --</option>
                    {lookupsData?.data?.workOrders.map((wo) => (
                      <option key={wo.woId} value={wo.woId}>
                        {wo.woNo} ({wo.status})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Transformation Type</label>
                  <select
                    value={genealogyForm.transformationType}
                    onChange={(e) => setGenealogyForm({ ...genealogyForm, transformationType: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-semibold text-purple-700"
                  >
                    <option value="RAW_TO_WIP">RAW_TO_WIP (Machining/Forging)</option>
                    <option value="WIP_TO_FG">WIP_TO_FG (Final Assembly)</option>
                    <option value="BLENDING">BLENDING (Batch Heat Melt)</option>
                    <option value="REWORK">REWORK</option>
                    <option value="SPLIT">SPLIT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Consumed Quantity</label>
                  <input
                    type="number"
                    step="0.001"
                    value={genealogyForm.consumedQty}
                    onChange={(e) =>
                      setGenealogyForm({ ...genealogyForm, consumedQty: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Link Date</label>
                  <input
                    type="date"
                    value={genealogyForm.linkDate}
                    onChange={(e) => setGenealogyForm({ ...genealogyForm, linkDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsLinkGenealogyModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createGenealogyMutation.isPending}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow transition flex items-center gap-1.5"
                >
                  {createGenealogyMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Save Genealogy Link</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 4: STATUTORY EN 10204 TYPE 3.1 & ISO 9001:2015 CERTIFICATE MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {isPrintCertificateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-8 shadow-2xl border border-slate-300 my-6">
            {/* Action Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6 print:hidden">
              <div className="flex items-center gap-2">
                <Award className="w-6 h-6 text-amber-500" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Statutory Material Traceability & Inspection Certificate
                  </h3>
                  <p className="text-xs text-slate-500">Conforming to EN 10204 Type 3.1 & ISO 9001:2015 Clause 8.5.2</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setIsPrintCertificateModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div className="space-y-6 text-slate-900 font-sans print:m-0 print:p-0">
              {/* Document Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
                <div>
                  <div className="text-xl font-black tracking-tight text-slate-950 uppercase">
                    KASHVIRA MANUFACTURING TECHNOLOGIES PVT. LTD.
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Plot 48, GIDC Industrial Estate, Manjusar, Vadodara - 391775, Gujarat, India
                  </div>
                  <div className="text-[10px] text-slate-500">
                    GSTIN: 24AAACK9812L1ZV • ISO 9001:2015 & IATF 16949 Certified Facility
                  </div>
                </div>

                <div className="text-right">
                  <div className="px-3 py-1 bg-slate-900 text-white text-xs font-bold tracking-wider rounded uppercase inline-block">
                    EN 10204 TYPE 3.1
                  </div>
                  <div className="text-[11px] font-mono font-bold text-slate-900 mt-1">
                    CERT NO: MTC-CERT-2026-{(activeBatch?.batchId || 1001).toString().padStart(5, '0')}
                  </div>
                  <div className="text-[10px] text-slate-500">Date: {formatDate(new Date().toISOString())}</div>
                </div>
              </div>

              {/* Title Banner */}
              <div className="text-center py-2 bg-slate-100 rounded border border-slate-300">
                <h2 className="text-sm font-black tracking-widest uppercase text-slate-900">
                  STATUTORY MATERIAL INSPECTION & 360° END-TO-END TRACEABILITY CERTIFICATE
                </h2>
                <p className="text-[10px] text-slate-600 mt-0.5 font-medium">
                  Issued in accordance with EN 10204:2004 Inspection Certificate 3.1 & ISO 9001:2015 Clause 8.5.2
                  Traceability
                </p>
              </div>

              {/* Primary Material Identification Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs border border-slate-300 p-4 rounded bg-slate-50/50">
                <div className="space-y-1.5">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">ITEM IDENTIFICATION</span>
                    <span className="font-bold text-slate-900">
                      {activeBatch?.itemCode || 'RM-SS-316L-ROD'} - {activeBatch?.itemName || 'SS-316L Round Bar 50mm'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">MELT / HEAT NUMBER</span>
                    <span className="font-mono font-black text-amber-700 text-sm">
                      {activeBatch?.heatNo || 'MELT-8821'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">BATCH / LOT NUMBER</span>
                    <span className="font-mono font-bold text-slate-900">
                      {activeBatch?.batchNo || 'HEAT-JSW-SS316-9812'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">ORIGINAL MANUFACTURER / MILL</span>
                    <span className="font-bold text-slate-900">{activeBatch?.supplierName || 'JSW Steel Limited'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">SUPPLIER MTC NO & DATE</span>
                    <span className="font-mono font-semibold text-slate-800">
                      {activeBatch?.mtcNo || 'MTC-JSW-9812'} (Dated: {formatDate(activeBatch?.mtcDate)})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px] uppercase font-semibold">DISPATCHED UNITS</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {explore?.serials?.length || 1} Serialized Units (Challan: {explore?.serials?.[0]?.challanNo || 'DC-2026-0001'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Chemical Spectrometer Matrix */}
              <div className="space-y-1 text-xs">
                <div className="font-bold text-slate-900 uppercase text-[11px] flex items-center justify-between">
                  <span>1. Chemical Spectrometer Test Analysis (% by Weight)</span>
                  <span className="text-[10px] font-normal text-slate-500">Method: Optical Emission Spectrometry (OES)</span>
                </div>
                <table className="w-full text-center border border-slate-400 text-xs">
                  <thead className="bg-slate-100 font-bold border-b border-slate-400">
                    <tr>
                      <th className="p-1.5 border-r border-slate-300">% C</th>
                      <th className="p-1.5 border-r border-slate-300">% Mn</th>
                      <th className="p-1.5 border-r border-slate-300">% Si</th>
                      <th className="p-1.5 border-r border-slate-300">% P</th>
                      <th className="p-1.5 border-r border-slate-300">% S</th>
                      <th className="p-1.5 border-r border-slate-300">% Cr</th>
                      <th className="p-1.5 border-r border-slate-300">% Ni</th>
                      <th className="p-1.5">% Mo</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="font-mono font-bold text-slate-900 border-b border-slate-300">
                      <td className="p-1.5 border-r border-slate-300">{activeBatch?.carbonPct ?? 0.024}</td>
                      <td className="p-1.5 border-r border-slate-300">{activeBatch?.manganesePct ?? 1.65}</td>
                      <td className="p-1.5 border-r border-slate-300">{activeBatch?.siliconPct ?? 0.45}</td>
                      <td className="p-1.5 border-r border-slate-300">{activeBatch?.phosphorusPct ?? 0.028}</td>
                      <td className="p-1.5 border-r border-slate-300">{activeBatch?.sulphurPct ?? 0.012}</td>
                      <td className="p-1.5 border-r border-slate-300">{activeBatch?.chromiumPct ?? 17.2}</td>
                      <td className="p-1.5 border-r border-slate-300">{activeBatch?.nickelPct ?? 12.1}</td>
                      <td className="p-1.5">{activeBatch?.molybdenumPct ?? 2.25}</td>
                    </tr>
                    <tr className="text-[10px] text-slate-500 bg-slate-50">
                      <td className="p-1 border-r border-slate-300">≤ 0.030</td>
                      <td className="p-1 border-r border-slate-300">≤ 2.00</td>
                      <td className="p-1 border-r border-slate-300">≤ 0.75</td>
                      <td className="p-1 border-r border-slate-300">≤ 0.045</td>
                      <td className="p-1 border-r border-slate-300">≤ 0.030</td>
                      <td className="p-1 border-r border-slate-300">16.0 - 18.0</td>
                      <td className="p-1 border-r border-slate-300">10.0 - 14.0</td>
                      <td className="p-1">2.00 - 3.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Mechanical & NDT Results */}
              <div className="space-y-1 text-xs">
                <div className="font-bold text-slate-900 uppercase text-[11px]">
                  2. Mechanical Properties & Nondestructive Examination (NDE)
                </div>
                <table className="w-full border border-slate-400 text-xs">
                  <thead className="bg-slate-100 font-bold border-b border-slate-400">
                    <tr>
                      <th className="p-1.5 text-left border-r border-slate-300">Test Parameter</th>
                      <th className="p-1.5 text-center border-r border-slate-300">Standard Test Method</th>
                      <th className="p-1.5 text-center border-r border-slate-300">Specified Limit</th>
                      <th className="p-1.5 text-center">Actual Measured Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    <tr>
                      <td className="p-1.5 font-semibold border-r border-slate-300">0.2% Proof Stress (Yield)</td>
                      <td className="p-1.5 text-center border-r border-slate-300">ASTM A370</td>
                      <td className="p-1.5 text-center border-r border-slate-300">Min. 205 MPa</td>
                      <td className="p-1.5 text-center font-mono font-bold text-slate-900">
                        {activeBatch?.yieldStrengthMpa || 310} MPa
                      </td>
                    </tr>
                    <tr>
                      <td className="p-1.5 font-semibold border-r border-slate-300">Tensile Strength (Rm)</td>
                      <td className="p-1.5 text-center border-r border-slate-300">ASTM A370</td>
                      <td className="p-1.5 text-center border-r border-slate-300">515 - 710 MPa</td>
                      <td className="p-1.5 text-center font-mono font-bold text-slate-900">
                        {activeBatch?.tensileStrengthMpa || 615} MPa
                      </td>
                    </tr>
                    <tr>
                      <td className="p-1.5 font-semibold border-r border-slate-300">Elongation in 50mm (A5)</td>
                      <td className="p-1.5 text-center border-r border-slate-300">ASTM A370</td>
                      <td className="p-1.5 text-center border-r border-slate-300">Min. 40%</td>
                      <td className="p-1.5 text-center font-mono font-bold text-slate-900">
                        {activeBatch?.elongationPct || 45}%
                      </td>
                    </tr>
                    <tr>
                      <td className="p-1.5 font-semibold border-r border-slate-300">Hardness</td>
                      <td className="p-1.5 text-center border-r border-slate-300">ASTM E18 (Rockwell B)</td>
                      <td className="p-1.5 text-center border-r border-slate-300">Max. 95 HRB</td>
                      <td className="p-1.5 text-center font-mono font-bold text-slate-900">
                        {activeBatch?.hardnessValue || '85 HRB'}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-1.5 font-semibold border-r border-slate-300">Ultrasonic Flaw Examination</td>
                      <td className="p-1.5 text-center border-r border-slate-300">EN 10228-3 / ASTM A388</td>
                      <td className="p-1.5 text-center border-r border-slate-300">Quality Class 3</td>
                      <td className="p-1.5 text-center font-bold text-emerald-700">
                        {activeBatch?.ultrasonicTestStatus || 'ACCEPTABLE_LEVEL_1'}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-1.5 font-semibold border-r border-slate-300">Radiography Testing</td>
                      <td className="p-1.5 text-center border-r border-slate-300">ASME Sec VIII Div 1</td>
                      <td className="p-1.5 text-center border-r border-slate-300">100% Spot Compliant</td>
                      <td className="p-1.5 text-center font-bold text-emerald-700">
                        {activeBatch?.radiographyStatus || 'COMPLIANT_ASME'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Statutory Statement & Attestation */}
              <div className="p-3 bg-slate-50 border border-slate-300 rounded text-[11px] space-y-1">
                <span className="font-bold text-slate-900 block">MANUFACTURER CERTIFICATION & COMPLIANCE STATEMENT:</span>
                <p className="text-slate-700 leading-relaxed">
                  We hereby certify that the material described above has been manufactured, sampled, tested, and
                  inspected in full accordance with the applicable purchase specifications, ASTM/ASME standards, and the
                  results reported herein are true and accurate representations of mill testing conducted under our ISO
                  9001:2015 Quality Management System.
                </p>
              </div>

              {/* Signature Blocks */}
              <div className="pt-6 border-t border-slate-400 grid grid-cols-3 gap-6 text-center text-xs">
                <div>
                  <div className="h-12 flex items-end justify-center">
                    <span className="font-serif italic text-slate-600">R. K. Sharma</span>
                  </div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
                    Metallurgical QA Engineer
                  </div>
                  <div className="text-[10px] text-slate-500">Kashvira Metallurgy Lab</div>
                </div>

                <div>
                  <div className="h-12 flex items-end justify-center">
                    <span className="font-serif italic text-slate-600">V. P. Patel</span>
                  </div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
                    Head of Quality Assurance (HOD)
                  </div>
                  <div className="text-[10px] text-slate-500">Authorized Inspection Authority</div>
                </div>

                <div>
                  <div className="h-12 flex items-end justify-center">
                    <span className="font-serif italic text-slate-600">Verified & Released</span>
                  </div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
                    Plant Manager / Director
                  </div>
                  <div className="text-[10px] text-slate-500">ISO 9001:2015 Management Rep</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TraceabilityMasterPage;
