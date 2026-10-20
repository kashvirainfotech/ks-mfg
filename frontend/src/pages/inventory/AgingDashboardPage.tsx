import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  Hourglass,
  Layers,
  Package,
  PackageCheck,
  PackageMinus,
  PackageSearch,
  PieChart,
  Plus,
  Printer,
  RefreshCw,
  Scale,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Tag,
  TrendingDown,
  TrendingUp,
  Warehouse,
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
const formatInr = (val: number | string | null | undefined): string => {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(num || 0);
};

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

// Convert number to Indian currency words
function numberToWordsINR(amount: number): string {
  const num = Math.round(amount * 100) / 100;
  const parts = num.toFixed(2).split('.');
  const integerPart = parseInt(parts[0], 10);
  const decimalPart = parseInt(parts[1], 10);

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(n: number): string {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  }

  function convertThreeDigits(n: number): string {
    let str = '';
    if (Math.floor(n / 100) > 0) {
      str += ones[Math.floor(n / 100)] + ' Hundred ';
    }
    const rem = n % 100;
    if (rem > 0) {
      str += convertTwoDigits(rem);
    }
    return str.trim();
  }

  if (integerPart === 0) return 'Zero Rupees';

  let remaining = integerPart;
  let words = '';

  const crore = Math.floor(remaining / 10000000);
  remaining %= 10000000;
  if (crore > 0) words += convertThreeDigits(crore) + ' Crore ';

  const lakh = Math.floor(remaining / 100000);
  remaining %= 100000;
  if (lakh > 0) words += convertThreeDigits(lakh) + ' Lakh ';

  const thousand = Math.floor(remaining / 1000);
  remaining %= 1000;
  if (thousand > 0) words += convertThreeDigits(thousand) + ' Thousand ';

  const hundred = remaining;
  if (hundred > 0) words += convertThreeDigits(hundred) + ' ';

  let result = 'Rupees ' + words.trim();
  if (decimalPart > 0) {
    result += ' and ' + convertTwoDigits(decimalPart) + ' Paise';
  }
  return result + ' Only';
}

// ----------------------------------------------------------------------------
// Interfaces & Types
// ----------------------------------------------------------------------------
interface AgingSummary {
  totalInventoryValuation: number;
  totalTrackedLines: number;
  totalTrackedSkus: number;
  agingBrackets: {
    freshStockValue: number;
    normalStockValue: number;
    slowMovingValue: number;
    stagnantStockValue: number;
    dormantStockValue: number;
    deadStockValue: number;
  };
  fsnAnalysis: {
    fastMovingCount: number;
    fastMovingValue: number;
    slowMovingCount: number;
    slowMovingValue: number;
    nonMovingCount: number;
    nonMovingValue: number;
  };
  reorderAlerts: {
    stockoutCount: number;
    belowSafetyCount: number;
    belowRopCount: number;
    totalCriticalSkus: number;
  };
  provisioning: {
    recommendedProvision: number;
    deadStockValuation: number;
    stagnantValuation: number;
  };
}

interface AgingAnalysisItem {
  binStockId: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  categoryId: number;
  categoryName: string;
  warehouseId: number;
  warehouseName: string;
  binId: number;
  binCode: string;
  batchNo: string;
  heatNo: string;
  onHandQty: number;
  availableQty: number;
  uomId: number;
  uomCode: string;
  unitCost: number;
  grossValuation: number;
  firstInwardDate: string | null;
  lastMovementDate: string | null;
  ageInDays: number;
  agingBracket: string;
  fsnClassification: string;
  provisionRatePercent: number;
  provisionAmount: number;
  netRealizableValue: number;
}

interface ReorderAlertItem {
  itemId: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  categoryId: number;
  categoryName: string;
  uomId: number;
  uomCode: string;
  standardCost: number;
  onHandQty: number;
  availableQty: number;
  minStockLevel: number;
  reorderPoint: number;
  safetyStock: number;
  maxStockLevel: number;
  deficitQty: number;
  estimatedReorderValue: number;
  leadTimeDays: number;
  stockStatus: string;
  urgencyLevel: string;
  defaultWarehouseId: number;
  lastStockDate: string | null;
}

interface ProvisionProposalHeader {
  provisionId: number;
  provisionNo: string;
  provisionDate: string;
  valuationDate: string;
  warehouseId?: number | null;
  warehouseName?: string | null;
  totalItemsEvaluated: number;
  totalGrossValuation: number;
  freshStockValue: number;
  normalStockValue: number;
  slowMovingValue: number;
  stagnantStockValue: number;
  dormantStockValue: number;
  deadStockValue: number;
  recommendedProvisionAmount: number;
  approvedProvisionAmount: number;
  status: string;
  auditStandardCitation: string;
  reviewerName?: string | null;
  reviewedAt?: string | null;
  remarks?: string | null;
  createdDate?: string | null;
  items?: Array<{
    provisionItemId: number;
    itemId: number;
    itemCode: string;
    itemName: string;
    warehouseId: number;
    binId?: number | null;
    batchNo?: string | null;
    heatNo?: string | null;
    uomId: number;
    uomCode: string;
    onHandQty: number;
    unitCost: number;
    grossValuation: number;
    firstInwardDate?: string | null;
    lastMovementDate?: string | null;
    ageInDays: number;
    agingBracket: string;
    fsnClassification: string;
    provisionRatePercent: number;
    provisionAmount: number;
    netRealizableValue: number;
    justification?: string | null;
    remarks?: string | null;
  }>;
}

interface AgingLookups {
  warehouses: Array<{ warehouseId: number; warehouseCode: string; warehouseName: string }>;
  categories: Array<{ categoryId: number; categoryCode: string; categoryName: string }>;
  items: Array<{
    itemId: number;
    itemCode: string;
    itemName: string;
    baseUomId: number;
    standardCost: string;
    reorderPoint: string;
    minStockLevel: string;
    safetyStock: string;
    leadTimeDays: number;
  }>;
  uoms: Array<{ uomId: number; uomCode: string; uomName: string }>;
  suppliers: Array<{ partyId: number; partyCode: string; partyName: string }>;
  departments: Array<{ deptId: number; deptCode: string; deptName: string }>;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------
export const AgingDashboardPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { activeContext } = useAuthStore();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'AGING' | 'REORDER' | 'PROVISIONS' | 'DISTRIBUTION'>('AGING');

  // Filters state
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [agingBracketFilter, setAgingBracketFilter] = useState<string>('ALL');
  const [fsnFilter, setFsnFilter] = useState<string>('ALL');
  const [reorderStatusFilter, setReorderStatusFilter] = useState<string>('ALL');
  const [searchFilter, setSearchFilter] = useState<string>('');

  // Modals state
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [isRequisitionModalOpen, setIsRequisitionModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isViewProvisionModalOpen, setIsViewProvisionModalOpen] = useState(false);

  // Selected item for 1-Click PR Trigger
  const [selectedAlertItem, setSelectedAlertItem] = useState<ReorderAlertItem | null>(null);

  // Selected provision review for detail view & print
  const [selectedProvision, setSelectedProvision] = useState<ProvisionProposalHeader | null>(null);

  // PR Form State
  const [prForm, setPrForm] = useState({
    itemId: 0,
    itemCode: '',
    itemName: '',
    warehouseId: 1001,
    requiredQty: 50,
    requiredByDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
    suggestedVendorId: 1001,
    priority: 'HIGH' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL_URGENT',
    purpose: 'Automated replenishment against Reorder Point (ROP) breach.',
  });

  // Provisioning Review Matrix Form State
  const [provisionPolicyForm, setProvisionPolicyForm] = useState({
    valuationDate: new Date().toISOString().split('T')[0],
    warehouseId: 0,
    bracket_0_30: 0,
    bracket_31_60: 0,
    bracket_61_90: 0,
    bracket_91_180: 10,
    bracket_181_365: 30,
    bracket_gt_365: 100,
    remarks: 'Periodic statutory inventory valuation and slow/dead stock review under Ind AS 2 & CARO 2020 Clause 3(ii).',
  });

  // ----------------------------------------------------------------------------
  // Queries
  // ----------------------------------------------------------------------------
  const { data: summaryData, isLoading: isSummaryLoading, refetch: refetchSummary } = useQuery<
    ApiResponse<AgingSummary>
  >({
    queryKey: ['stock-aging-summary', activeContext?.compId, activeContext?.branchId],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<AgingSummary>>('/inventory/aging/summary');
      return res.data;
    },
  });

  const { data: lookupsData } = useQuery<ApiResponse<AgingLookups>>({
    queryKey: ['stock-aging-lookups', activeContext?.compId, activeContext?.branchId],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<AgingLookups>>('/inventory/aging/lookups');
      return res.data;
    },
  });

  const { data: agingData, isLoading: isAgingLoading, refetch: refetchAging } = useQuery<
    ApiResponse<AgingAnalysisItem[]>
  >({
    queryKey: [
      'stock-aging-analysis',
      activeContext?.compId,
      activeContext?.branchId,
      warehouseFilter,
      categoryFilter,
      agingBracketFilter,
      fsnFilter,
      searchFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (warehouseFilter !== 'ALL') params.set('warehouseId', warehouseFilter);
      if (categoryFilter !== 'ALL') params.set('categoryId', categoryFilter);
      if (agingBracketFilter !== 'ALL') params.set('agingBracket', agingBracketFilter);
      if (fsnFilter !== 'ALL') params.set('fsnClassification', fsnFilter);
      if (searchFilter) params.set('search', searchFilter);

      const res = await apiClient.get<ApiResponse<AgingAnalysisItem[]>>(
        `/inventory/aging/analysis?${params.toString()}`,
      );
      return res.data;
    },
  });

  const { data: alertsData, isLoading: isAlertsLoading, refetch: refetchAlerts } = useQuery<
    ApiResponse<ReorderAlertItem[]>
  >({
    queryKey: [
      'stock-reorder-alerts',
      activeContext?.compId,
      activeContext?.branchId,
      reorderStatusFilter,
      searchFilter,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (reorderStatusFilter !== 'ALL') params.set('stockStatus', reorderStatusFilter);
      if (searchFilter) params.set('search', searchFilter);

      const res = await apiClient.get<ApiResponse<ReorderAlertItem[]>>(
        `/inventory/aging/reorder-alerts?${params.toString()}`,
      );
      return res.data;
    },
  });

  const { data: provisionsData, isLoading: isProvisionsLoading, refetch: refetchProvisions } = useQuery<
    ApiResponse<ProvisionProposalHeader[]>
  >({
    queryKey: ['stock-provisions-list', activeContext?.compId, activeContext?.branchId],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ProvisionProposalHeader[]>>('/inventory/aging/provisions');
      return res.data;
    },
  });

  // ----------------------------------------------------------------------------
  // Mutations
  // ----------------------------------------------------------------------------
  const triggerPrMutation = useMutation({
    mutationFn: async (payload: typeof prForm) => {
      const res = await apiClient.post<ApiResponse<any>>('/inventory/aging/trigger-pr', payload);
      return res.data;
    },
    onSuccess: (res) => {
      alert(`Success: ${res.message || 'Purchase Requisition generated successfully'}`);
      setIsRequisitionModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['stock-reorder-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['stock-aging-summary'] });
    },
    onError: (err: any) => {
      alert(`Failed to trigger PR: ${err.response?.data?.message || err.message}`);
    },
  });

  const createProvisionMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post<ApiResponse<any>>('/inventory/aging/provisions', payload);
      return res.data;
    },
    onSuccess: (res) => {
      alert(`Success: ${res.message || 'Valuation review created successfully'}`);
      setIsProvisionModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['stock-provisions-list'] });
      queryClient.invalidateQueries({ queryKey: ['stock-aging-summary'] });
    },
    onError: (err: any) => {
      alert(`Failed to create review: ${err.response?.data?.message || err.message}`);
    },
  });

  const approveProvisionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.post<ApiResponse<any>>(`/inventory/aging/provisions/${id}/approve`, {});
      return res.data;
    },
    onSuccess: (res) => {
      alert(`Success: ${res.message || 'Provision review approved'}`);
      queryClient.invalidateQueries({ queryKey: ['stock-provisions-list'] });
      queryClient.invalidateQueries({ queryKey: ['stock-aging-summary'] });
    },
    onError: (err: any) => {
      alert(`Approval failed: ${err.response?.data?.message || err.message}`);
    },
  });

  // Open PR Modal for an alert item
  const handleOpenPrModal = (item: ReorderAlertItem) => {
    setSelectedAlertItem(item);
    setPrForm({
      itemId: item.itemId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      warehouseId: item.defaultWarehouseId || 1001,
      requiredQty: item.deficitQty > 0 ? item.deficitQty : item.reorderPoint,
      requiredByDate: new Date(Date.now() + (item.leadTimeDays || 7) * 24 * 3600 * 1000)
        .toISOString()
        .split('T')[0],
      suggestedVendorId: lookupsData?.data?.suppliers[0]?.partyId || 1001,
      priority: item.stockStatus === 'STOCKOUT' ? 'CRITICAL_URGENT' : 'HIGH',
      purpose: `Replenishment requisition triggered from Stock Aging & ROP alert (${item.stockStatus}).`,
    });
    setIsRequisitionModalOpen(true);
  };

  // Open Provision review detail & print
  const handleViewProvision = async (prov: ProvisionProposalHeader) => {
    try {
      const res = await apiClient.get<ApiResponse<ProvisionProposalHeader>>(`/inventory/aging/provisions/${prov.provisionId}`);
      if (res.data.data) {
        setSelectedProvision(res.data.data);
        setIsViewProvisionModalOpen(true);
      }
    } catch (err: any) {
      alert(`Failed to load review: ${err.message}`);
    }
  };

  const handlePrintCertificate = async (prov?: ProvisionProposalHeader) => {
    const target = prov || provisionsData?.data?.[0];
    if (!target) {
      alert('No valuation reviews available to print. Please create a review first.');
      return;
    }
    try {
      const res = await apiClient.get<ApiResponse<ProvisionProposalHeader>>(`/inventory/aging/provisions/${target.provisionId}`);
      if (res.data.data) {
        setSelectedProvision(res.data.data);
        setIsPrintModalOpen(true);
      }
    } catch {
      setSelectedProvision(target);
      setIsPrintModalOpen(true);
    }
  };

  // Build New Provision Review payload
  const handleRunProvisionReview = () => {
    if (!agingData?.data || agingData.data.length === 0) {
      alert('No inventory data available to review.');
      return;
    }

    const items = agingData.data.map((r) => {
      let provRate = 0;
      if (r.agingBracket === '0_30') provRate = provisionPolicyForm.bracket_0_30;
      else if (r.agingBracket === '31_60') provRate = provisionPolicyForm.bracket_31_60;
      else if (r.agingBracket === '61_90') provRate = provisionPolicyForm.bracket_61_90;
      else if (r.agingBracket === '91_180') provRate = provisionPolicyForm.bracket_91_180;
      else if (r.agingBracket === '181_365') provRate = provisionPolicyForm.bracket_181_365;
      else provRate = provisionPolicyForm.bracket_gt_365;

      const provAmt = Math.round(r.grossValuation * (provRate / 100) * 100) / 100;
      const nrv = Math.max(0, r.grossValuation - provAmt);

      return {
        itemId: r.itemId,
        warehouseId: r.warehouseId,
        binId: r.binId,
        batchNo: r.batchNo,
        heatNo: r.heatNo,
        itemCode: r.itemCode,
        itemName: r.itemName,
        uomId: r.uomId,
        onHandQty: r.onHandQty,
        unitCost: r.unitCost,
        grossValuation: r.grossValuation,
        firstInwardDate: r.firstInwardDate,
        lastMovementDate: r.lastMovementDate,
        ageInDays: r.ageInDays,
        agingBracket: r.agingBracket,
        fsnClassification: r.fsnClassification,
        provisionRatePercent: provRate,
        provisionAmount: provAmt,
        netRealizableValue: nrv,
        justification: `Ind AS 2 policy: ${provRate}% write-down on ${r.agingBracket} bracket.`,
      };
    });

    createProvisionMutation.mutate({
      valuationDate: provisionPolicyForm.valuationDate,
      warehouseId: provisionPolicyForm.warehouseId || undefined,
      policyMatrix: {
        bracket_0_30: provisionPolicyForm.bracket_0_30,
        bracket_31_60: provisionPolicyForm.bracket_31_60,
        bracket_61_90: provisionPolicyForm.bracket_61_90,
        bracket_91_180: provisionPolicyForm.bracket_91_180,
        bracket_181_365: provisionPolicyForm.bracket_181_365,
        bracket_gt_365: provisionPolicyForm.bracket_gt_365,
      },
      remarks: provisionPolicyForm.remarks,
      items,
    });
  };

  // Summary counts
  const summary = summaryData?.data || {
    totalInventoryValuation: 445450,
    totalTrackedLines: 6,
    totalTrackedSkus: 6,
    agingBrackets: {
      freshStockValue: 178500,
      normalStockValue: 70000,
      slowMovingValue: 100000,
      stagnantStockValue: 15750,
      dormantStockValue: 61200,
      deadStockValue: 20000,
    },
    fsnAnalysis: {
      fastMovingCount: 2,
      fastMovingValue: 248500,
      slowMovingCount: 2,
      slowMovingValue: 115750,
      nonMovingCount: 2,
      nonMovingValue: 81200,
    },
    reorderAlerts: {
      stockoutCount: 1,
      belowSafetyCount: 1,
      belowRopCount: 2,
      totalCriticalSkus: 4,
    },
    provisioning: {
      recommendedProvision: 39935,
      deadStockValuation: 20000,
      stagnantValuation: 76950,
    },
  };

  const totalVal = summary.totalInventoryValuation || 1;
  const pctFresh = Math.round((summary.agingBrackets.freshStockValue / totalVal) * 100);
  const pctNormal = Math.round((summary.agingBrackets.normalStockValue / totalVal) * 100);
  const pctSlow = Math.round((summary.agingBrackets.slowMovingValue / totalVal) * 100);
  const pctStagnant = Math.round((summary.agingBrackets.stagnantStockValue / totalVal) * 100);
  const pctDormant = Math.round((summary.agingBrackets.dormantStockValue / totalVal) * 100);
  const pctDead = Math.max(0, 100 - (pctFresh + pctNormal + pctSlow + pctStagnant + pctDormant));

  // ----------------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------------
  return (
    <div className="space-y-6 pb-12">
      {/* Header & Title Area */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-2xl text-white shadow-xl border border-slate-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase bg-amber-500/20 text-amber-300 border border-amber-400/30 flex items-center gap-1">
              <Hourglass className="w-3 h-3 text-amber-400" />
              Inventory Valuation & Aging • Ind AS 2 & CARO 2020 Clause 3(ii)
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Live FSN & ROP Bridge
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <Clock className="w-6 h-6 text-amber-400" />
            Inventory Aging, FSN & Reorder Alert Dashboard
          </h1>
          <p className="text-xs text-slate-300 max-w-3xl">
            Real-time FIFO inventory aging brackets, Fast/Slow/Non-Moving (FSN) velocity analysis, CARO 2020 slow & dead
            stock write-down provisioning, and automated 1-Click Purchase Requisition (PR) reorder bridge.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <PermissionGate screen="STOCK_AGING" action="PRINT">
            <button
              onClick={() => handlePrintCertificate()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-900 bg-white hover:bg-slate-100 rounded-xl shadow transition"
              title="Print Statutory CARO 2020 & Ind AS 2 Inventory Valuation Certificate"
            >
              <Printer className="w-3.5 h-3.5 text-blue-600" />
              <span>Valuation Certificate</span>
            </button>
          </PermissionGate>

          <PermissionGate screen="STOCK_AGING" action="PROVISION">
            <button
              onClick={() => setIsProvisionModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Valuation Review</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Inventory Valuation */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 block">
              Gross Inventory Valuation
            </span>
            <div className="text-2xl font-black text-slate-900 mt-1">
              {isSummaryLoading ? '...' : formatInr(summary.totalInventoryValuation)}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-blue-600 font-medium mt-1">
              <Boxes className="w-3.5 h-3.5" />
              <span>
                {summary.totalTrackedSkus} Active SKUs • {summary.totalTrackedLines} Batches
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <Coins className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Fresh & Normal Stock */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 block">
              Active Fresh Stock (≤ 60 Days)
            </span>
            <div className="text-2xl font-black text-emerald-600 mt-1">
              {isSummaryLoading
                ? '...'
                : formatInr(
                    summary.agingBrackets.freshStockValue + summary.agingBrackets.normalStockValue,
                  )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium mt-1">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>{pctFresh + pctNormal}% of Total • High Velocity</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <PackageCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Slow & Dead Stock (>60 Days) */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 block">
              Slow & Dead Stock (&gt; 60 Days)
            </span>
            <div className="text-2xl font-black text-rose-600 mt-1">
              {isSummaryLoading
                ? '...'
                : formatInr(
                    summary.agingBrackets.slowMovingValue +
                      summary.agingBrackets.stagnantStockValue +
                      summary.agingBrackets.dormantStockValue +
                      summary.agingBrackets.deadStockValue,
                  )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-rose-600 font-medium mt-1">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{formatInr(summary.provisioning.recommendedProvision)} Write-Down Prov</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
            <Hourglass className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Critical Replenishment Alerts */}
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 block">
              Critical ROP & Safety Alerts
            </span>
            <div className="text-2xl font-black text-amber-600 mt-1">
              {isSummaryLoading ? '...' : summary.reorderAlerts.totalCriticalSkus}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-amber-600 font-medium mt-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>
                {summary.reorderAlerts.stockoutCount} Stockouts • {summary.reorderAlerts.belowRopCount} Below ROP
              </span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <ShoppingCart className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* VISUAL AGING BRACKET DISTRIBUTION BAR */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PieChart className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              FIFO Inventory Aging Bracket Distribution
            </h3>
          </div>
          <span className="text-[11px] font-mono font-semibold text-slate-600">
            Total Valuation: {formatInr(summary.totalInventoryValuation)}
          </span>
        </div>

        {/* Multi-Segment Colored Bar */}
        <div className="w-full h-4 rounded-full overflow-hidden flex bg-slate-100 shadow-inner">
          <div
            style={{ width: `${Math.max(1, pctFresh)}%` }}
            className="bg-emerald-500 hover:opacity-90 transition"
            title={`0-30 Days: ${formatInr(summary.agingBrackets.freshStockValue)} (${pctFresh}%)`}
          />
          <div
            style={{ width: `${Math.max(1, pctNormal)}%` }}
            className="bg-blue-500 hover:opacity-90 transition"
            title={`31-60 Days: ${formatInr(summary.agingBrackets.normalStockValue)} (${pctNormal}%)`}
          />
          <div
            style={{ width: `${Math.max(1, pctSlow)}%` }}
            className="bg-amber-500 hover:opacity-90 transition"
            title={`61-90 Days: ${formatInr(summary.agingBrackets.slowMovingValue)} (${pctSlow}%)`}
          />
          <div
            style={{ width: `${Math.max(1, pctStagnant)}%` }}
            className="bg-orange-500 hover:opacity-90 transition"
            title={`91-180 Days: ${formatInr(summary.agingBrackets.stagnantStockValue)} (${pctStagnant}%)`}
          />
          <div
            style={{ width: `${Math.max(1, pctDormant)}%` }}
            className="bg-rose-500 hover:opacity-90 transition"
            title={`181-365 Days: ${formatInr(summary.agingBrackets.dormantStockValue)} (${pctDormant}%)`}
          />
          <div
            style={{ width: `${Math.max(1, pctDead)}%` }}
            className="bg-purple-600 hover:opacity-90 transition"
            title={`>365 Days Dead Stock: ${formatInr(summary.agingBrackets.deadStockValue)} (${pctDead}%)`}
          />
        </div>

        {/* Legend Pills with 1-Click Filter */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-1 text-xs">
          {[
            {
              label: '0-30 Days (Fresh)',
              key: '0_30',
              val: summary.agingBrackets.freshStockValue,
              pct: pctFresh,
              color: 'bg-emerald-500',
              text: 'text-emerald-700',
            },
            {
              label: '31-60 Days (Normal)',
              key: '31_60',
              val: summary.agingBrackets.normalStockValue,
              pct: pctNormal,
              color: 'bg-blue-500',
              text: 'text-blue-700',
            },
            {
              label: '61-90 Days (Slow)',
              key: '61_90',
              val: summary.agingBrackets.slowMovingValue,
              pct: pctSlow,
              color: 'bg-amber-500',
              text: 'text-amber-700',
            },
            {
              label: '91-180 Days (Stagnant)',
              key: '91_180',
              val: summary.agingBrackets.stagnantStockValue,
              pct: pctStagnant,
              color: 'bg-orange-500',
              text: 'text-orange-700',
            },
            {
              label: '181-365 Days (Dormant)',
              key: '181_365',
              val: summary.agingBrackets.dormantStockValue,
              pct: pctDormant,
              color: 'bg-rose-500',
              text: 'text-rose-700',
            },
            {
              label: '> 365 Days (Dead)',
              key: 'GT_365',
              val: summary.agingBrackets.deadStockValue,
              pct: pctDead,
              color: 'bg-purple-600',
              text: 'text-purple-700',
            },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setAgingBracketFilter(agingBracketFilter === item.key ? 'ALL' : item.key);
                setActiveTab('AGING');
              }}
              className={`p-2 rounded-xl border text-left transition ${
                agingBracketFilter === item.key
                  ? 'border-blue-500 bg-blue-50/70 shadow-xs'
                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${item.color}`} />
                <span className="text-[10px] font-semibold text-slate-700 truncate">{item.label}</span>
              </div>
              <div className="text-xs font-bold text-slate-900 mt-1 font-mono">{formatInr(item.val)}</div>
              <div className="text-[10px] text-slate-500 font-medium">{item.pct}% of stock</div>
            </button>
          ))}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('AGING')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'AGING'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Inventory Aging & FSN Matrix</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-mono">
              {agingData?.data?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('REORDER')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'REORDER'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <span>Reorder Point & Safety Stock Alerts</span>
            {summary.reorderAlerts.totalCriticalSkus > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-bold font-mono">
                {summary.reorderAlerts.totalCriticalSkus} Critical
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('PROVISIONS')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'PROVISIONS'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-500" />
            <span>Dead Stock & Provisioning Register (Ind AS 2)</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-mono">
              {provisionsData?.data?.length || 0}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('DISTRIBUTION')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'DISTRIBUTION'
                ? 'border-blue-600 text-blue-600 bg-blue-50/50 rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Warehouse className="w-4 h-4" />
            <span>Warehouse & Category Breakdown</span>
          </button>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* TAB 1: INVENTORY AGING & FSN MATRIX */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'AGING' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Warehouses</option>
                {lookupsData?.data?.warehouses.map((w) => (
                  <option key={w.warehouseId} value={w.warehouseId}>
                    {w.warehouseName}
                  </option>
                ))}
              </select>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Item Categories</option>
                {lookupsData?.data?.categories.map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.categoryName}
                  </option>
                ))}
              </select>

              <select
                value={agingBracketFilter}
                onChange={(e) => setAgingBracketFilter(e.target.value)}
                className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Aging Brackets</option>
                <option value="0_30">0-30 Days (Fresh)</option>
                <option value="31_60">31-60 Days (Normal)</option>
                <option value="61_90">61-90 Days (Slow)</option>
                <option value="91_180">91-180 Days (Stagnant)</option>
                <option value="181_365">181-365 Days (Dormant)</option>
                <option value="GT_365">&gt; 365 Days (Dead Stock)</option>
              </select>

              <select
                value={fsnFilter}
                onChange={(e) => setFsnFilter(e.target.value)}
                className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All FSN Velocities</option>
                <option value="FAST">FAST Moving (≤ 60 Days)</option>
                <option value="SLOW">SLOW Moving (61-180 Days)</option>
                <option value="NON_MOVING">NON-MOVING (&gt; 180 Days)</option>
              </select>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search SKU, batch, heat, bin..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 w-64"
              />
            </div>
          </div>

          {/* Aging & FSN Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3">SKU & Description</th>
                  <th className="p-3">Location & Lot</th>
                  <th className="p-3 text-right">On-Hand Qty</th>
                  <th className="p-3 text-right">Unit Rate (₹)</th>
                  <th className="p-3 text-right">Gross Valuation</th>
                  <th className="p-3">First Inward / Last Move</th>
                  <th className="p-3 text-center">Age (Days)</th>
                  <th className="p-3">Aging Bracket</th>
                  <th className="p-3">FSN Velocity</th>
                  <th className="p-3 text-right">NRV Net Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isAgingLoading ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      Loading inventory aging calculations...
                    </td>
                  </tr>
                ) : !agingData?.data?.length ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      No stock lines matching selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  agingData.data.map((r) => (
                    <tr key={r.binStockId} className="hover:bg-slate-50">
                      <td className="p-3">
                        <div className="font-bold text-slate-900 font-mono">{r.itemCode}</div>
                        <div className="text-[10px] text-slate-500">{r.itemName}</div>
                        <span className="text-[9px] text-slate-400">{r.categoryName}</span>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-slate-800">{r.warehouseName}</div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Bin: {r.binCode} • {r.batchNo !== '-' ? `Lot: ${r.batchNo}` : 'No Lot'}
                        </div>
                        {r.heatNo !== '-' && (
                          <div className="text-[9px] text-amber-700 font-mono font-semibold">
                            Heat #{r.heatNo}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatQty(r.onHandQty)} {r.uomCode}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600">
                        {r.unitCost.toFixed(2)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatInr(r.grossValuation)}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-600">
                        <div>Inward: {formatDate(r.firstInwardDate)}</div>
                        <div className="text-[10px] text-slate-400">Move: {formatDate(r.lastMovementDate)}</div>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                            r.ageInDays <= 60
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : r.ageInDays <= 180
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {r.ageInDays}d
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            r.agingBracket === '0_30'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : r.agingBracket === '31_60'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : r.agingBracket === '61_90'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : r.agingBracket === '91_180'
                              ? 'bg-orange-50 text-orange-700 border border-orange-200'
                              : r.agingBracket === '181_365'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-purple-100 text-purple-800 border border-purple-300 font-black'
                          }`}
                        >
                          {r.agingBracket.replace('_', '-')}
                        </span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            r.fsnClassification === 'FAST'
                              ? 'bg-emerald-100 text-emerald-800'
                              : r.fsnClassification === 'SLOW'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {r.fsnClassification.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono">
                        <div className="font-bold text-slate-900">{formatInr(r.netRealizableValue)}</div>
                        {r.provisionAmount > 0 && (
                          <div className="text-[10px] text-rose-600">
                            -{formatInr(r.provisionAmount)} ({r.provisionRatePercent}%)
                          </div>
                        )}
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
      {/* TAB 2: REORDER LEVEL & SAFETY STOCK ALERTS CONSOLE */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'REORDER' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Material Replenishment & Reorder Point (ROP) Alerts Console
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically identifies inventory buffers below Safety Stock or Reorder Points, with 1-Click Purchase
                Requisition creation
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={reorderStatusFilter}
                onChange={(e) => setReorderStatusFilter(e.target.value)}
                className="text-xs px-3 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="ALL">All Stock Alerts</option>
                <option value="STOCKOUT">STOCKOUT (0 Stock)</option>
                <option value="BELOW_SAFETY">Below Safety Stock</option>
                <option value="BELOW_ROP">Below Reorder Point (ROP)</option>
                <option value="IN_STOCK">Adequate Stock</option>
              </select>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter alerts..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Alerts Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3">SKU & Item Details</th>
                  <th className="p-3">Category / Type</th>
                  <th className="p-3">Replenishment Status</th>
                  <th className="p-3 text-right">On-Hand Qty</th>
                  <th className="p-3 text-right">Reorder Point (ROP)</th>
                  <th className="p-3 text-right">Safety Buffer</th>
                  <th className="p-3 text-right">Deficit to Order</th>
                  <th className="p-3 text-right">Est. Cost (₹)</th>
                  <th className="p-3 text-center">Lead Time</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isAlertsLoading ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      Loading reorder alert status...
                    </td>
                  </tr>
                ) : !alertsData?.data?.length ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      No items matching alert criteria. All buffers adequate!
                    </td>
                  </tr>
                ) : (
                  alertsData.data.map((a) => (
                    <tr
                      key={a.itemId}
                      className={`hover:bg-slate-50 ${
                        a.stockStatus === 'STOCKOUT'
                          ? 'bg-rose-50/30'
                          : a.stockStatus === 'CRITICAL_BELOW_MIN'
                          ? 'bg-amber-50/20'
                          : ''
                      }`}
                    >
                      <td className="p-3">
                        <div className="font-bold text-slate-900 font-mono">{a.itemCode}</div>
                        <div className="text-[10px] text-slate-600">{a.itemName}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-slate-700">{a.categoryName}</div>
                        <span className="text-[9px] text-slate-400 uppercase">{a.itemType}</span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase inline-flex items-center gap-1 ${
                            a.stockStatus === 'STOCKOUT'
                              ? 'bg-rose-100 text-rose-800 border border-rose-300'
                              : a.stockStatus === 'CRITICAL_BELOW_MIN'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : a.stockStatus === 'REORDER_BREACH'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {a.stockStatus === 'STOCKOUT' && <AlertOctagon className="w-3 h-3 text-rose-600" />}
                          {a.stockStatus === 'REORDER_BREACH' && <AlertTriangle className="w-3 h-3 text-amber-600" />}
                          {a.stockStatus === 'ADEQUATE' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          <span>{a.stockStatus.replace(/_/g, ' ')}</span>
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatQty(a.onHandQty)} {a.uomCode}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-600">
                        {formatQty(a.reorderPoint)} {a.uomCode}
                      </td>
                      <td className="p-3 text-right font-mono text-slate-500">
                        {formatQty(a.safetyStock)} {a.uomCode}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-rose-600">
                        {a.deficitQty > 0 ? `+${formatQty(a.deficitQty)} ${a.uomCode}` : '-'}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-slate-800">
                        {a.estimatedReorderValue > 0 ? formatInr(a.estimatedReorderValue) : '-'}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-600">
                        {a.leadTimeDays} days
                      </td>
                      <td className="p-3 text-center">
                        {a.deficitQty > 0 ? (
                          <PermissionGate screen="STOCK_AGING" action="REORDER">
                            <button
                              onClick={() => handleOpenPrModal(a)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition"
                              title="1-Click Generate Purchase Requisition (PR)"
                            >
                              <ShoppingCart className="w-3 h-3" />
                              <span>Trigger PR</span>
                            </button>
                          </PermissionGate>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Buffer OK</span>
                        )}
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
      {/* TAB 3: DEAD STOCK & PROVISIONING REGISTER (Ind AS 2 / CARO 2020) */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'PROVISIONS' && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500" />
                Statutory Inventory Valuation & Dead Stock Provisioning Register
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Periodic inventory valuation write-downs conforming to Ind AS 2 (Lower of Cost or Net Realisable Value)
                and CARO 2020 Clause 3(ii)
              </p>
            </div>

            <PermissionGate screen="STOCK_AGING" action="PROVISION">
              <button
                onClick={() => setIsProvisionModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Run New Valuation Review</span>
              </button>
            </PermissionGate>
          </div>

          {/* Provisions Table */}
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3">Review Voucher No</th>
                  <th className="p-3">Valuation Date</th>
                  <th className="p-3">Warehouse Scope</th>
                  <th className="p-3 text-center">Items Evaluated</th>
                  <th className="p-3 text-right">Gross Valuation</th>
                  <th className="p-3 text-right">Dead Stock Value</th>
                  <th className="p-3 text-right">Recommended Provision</th>
                  <th className="p-3 text-right">Approved Provision</th>
                  <th className="p-3">Review Status</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isProvisionsLoading ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      Loading valuation reviews...
                    </td>
                  </tr>
                ) : !provisionsData?.data?.length ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-slate-400">
                      No formal stock valuation reviews logged yet. Click "Run New Valuation Review" to create one.
                    </td>
                  </tr>
                ) : (
                  provisionsData.data.map((p) => (
                    <tr key={p.provisionId} className="hover:bg-slate-50">
                      <td className="p-3">
                        <div className="font-bold text-slate-900 font-mono">{p.provisionNo}</div>
                        <div className="text-[10px] text-slate-500 font-sans">{p.auditStandardCitation}</div>
                      </td>
                      <td className="p-3 font-mono text-slate-700">{formatDate(p.valuationDate)}</td>
                      <td className="p-3 text-slate-800">{p.warehouseName || 'All Plant Warehouses'}</td>
                      <td className="p-3 text-center font-mono font-bold text-slate-900">
                        {p.totalItemsEvaluated} SKUs
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-slate-900">
                        {formatInr(p.totalGrossValuation)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-purple-700">
                        {formatInr(p.deadStockValue)}
                      </td>
                      <td className="p-3 text-right font-mono font-semibold text-rose-600">
                        {formatInr(p.recommendedProvisionAmount)}
                      </td>
                      <td className="p-3 text-right font-mono font-bold text-rose-700">
                        {formatInr(p.approvedProvisionAmount)}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                            p.status === 'APPROVED' || p.status === 'POSTED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : p.status === 'SUBMITTED'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleViewProvision(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition"
                            title="View Item Schedule"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Schedule</span>
                          </button>

                          <button
                            onClick={() => handlePrintCertificate(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
                            title="Print Certificate"
                          >
                            <Printer className="w-3 h-3 text-slate-600" />
                            <span>Certificate</span>
                          </button>

                          {p.status === 'SUBMITTED' && (
                            <PermissionGate screen="STOCK_AGING" action="PROVISION">
                              <button
                                onClick={() => approveProvisionMutation.mutate(p.provisionId)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
                                title="Approve & Post Write-down"
                              >
                                <Check className="w-3 h-3" />
                                <span>Approve</span>
                              </button>
                            </PermissionGate>
                          )}
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
      {/* TAB 4: WAREHOUSE & CATEGORY DISTRIBUTION */}
      {/* ---------------------------------------------------------------------- */}
      {activeTab === 'DISTRIBUTION' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: Warehouse-Wise Valuation Card */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Warehouse className="w-4 h-4 text-blue-600" />
              Plant Warehouse Valuation & Buffer Analysis
            </h3>
            <div className="divide-y divide-slate-200 text-xs">
              {lookupsData?.data?.warehouses.map((wh) => (
                <div key={wh.warehouseId} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">{wh.warehouseName}</div>
                    <div className="text-[10px] text-slate-500 font-mono">Code: {wh.warehouseCode}</div>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-bold text-slate-900 block">
                      {formatInr(
                        agingData?.data
                          ?.filter((r) => r.warehouseId === wh.warehouseId)
                          .reduce((acc, cur) => acc + cur.grossValuation, 0) || 0,
                      )}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {agingData?.data?.filter((r) => r.warehouseId === wh.warehouseId).length || 0} Batches Tracked
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Card 2: FSN Velocity Distribution */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              FSN Material Consumption Velocity Breakdown
            </h3>
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-emerald-900 block">FAST-MOVING (≤ 60 Days Movement)</span>
                  <span className="text-[10px] text-emerald-700">
                    High turn cycle, active consumption in daily work orders.
                  </span>
                </div>
                <div className="text-right font-mono">
                  <div className="font-black text-emerald-900">{formatInr(summary.fsnAnalysis.fastMovingValue)}</div>
                  <div className="text-[10px] text-emerald-700 font-semibold">
                    {summary.fsnAnalysis.fastMovingCount} Batches
                  </div>
                </div>
              </div>

              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-amber-900 block">SLOW-MOVING (61 - 180 Days Movement)</span>
                  <span className="text-[10px] text-amber-700">Moderate turn, subject to bi-monthly replenishment check.</span>
                </div>
                <div className="text-right font-mono">
                  <div className="font-black text-amber-900">{formatInr(summary.fsnAnalysis.slowMovingValue)}</div>
                  <div className="text-[10px] text-amber-700 font-semibold">
                    {summary.fsnAnalysis.slowMovingCount} Batches
                  </div>
                </div>
              </div>

              <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-rose-900 block">NON-MOVING (&gt; 180 Days Movement)</span>
                  <span className="text-[10px] text-rose-700">
                    Dormant & Dead stock. Requires Ind AS 2 Net Realisable Value provision.
                  </span>
                </div>
                <div className="text-right font-mono">
                  <div className="font-black text-rose-900">{formatInr(summary.fsnAnalysis.nonMovingValue)}</div>
                  <div className="text-[10px] text-rose-700 font-semibold">
                    {summary.fsnAnalysis.nonMovingCount} Batches
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 1: RUN NEW VALUATION REVIEW & PROVISION PROPOSAL MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {isProvisionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                  <ShieldAlert className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Run Statutory Inventory Valuation & Provisioning Review
                  </h3>
                  <p className="text-xs text-slate-500">Conforming to Ind AS 2 & CARO 2020 Clause 3(ii)</p>
                </div>
              </div>
              <button
                onClick={() => setIsProvisionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleRunProvisionReview();
              }}
              className="space-y-4 pt-4 text-xs"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Valuation As-Of Date *</label>
                  <input
                    type="date"
                    required
                    value={provisionPolicyForm.valuationDate}
                    onChange={(e) =>
                      setProvisionPolicyForm({ ...provisionPolicyForm, valuationDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Warehouse Scope</label>
                  <select
                    value={provisionPolicyForm.warehouseId}
                    onChange={(e) =>
                      setProvisionPolicyForm({
                        ...provisionPolicyForm,
                        warehouseId: parseInt(e.target.value, 10),
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500"
                  >
                    <option value={0}>All Plant Warehouses</option>
                    {lookupsData?.data?.warehouses.map((w) => (
                      <option key={w.warehouseId} value={w.warehouseId}>
                        {w.warehouseName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Policy Percentage Matrix */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <span className="font-bold text-slate-700 block uppercase text-[10px] tracking-wide">
                  Provisioning Write-Down Matrix (% per Bracket)
                </span>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">0-30 Days (%)</label>
                    <input
                      type="number"
                      value={provisionPolicyForm.bracket_0_30}
                      onChange={(e) =>
                        setProvisionPolicyForm({
                          ...provisionPolicyForm,
                          bracket_0_30: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded font-mono text-center text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">31-60 Days (%)</label>
                    <input
                      type="number"
                      value={provisionPolicyForm.bracket_31_60}
                      onChange={(e) =>
                        setProvisionPolicyForm({
                          ...provisionPolicyForm,
                          bracket_31_60: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded font-mono text-center text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">61-90 Days (%)</label>
                    <input
                      type="number"
                      value={provisionPolicyForm.bracket_61_90}
                      onChange={(e) =>
                        setProvisionPolicyForm({
                          ...provisionPolicyForm,
                          bracket_61_90: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded font-mono text-center text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">91-180 Days (%)</label>
                    <input
                      type="number"
                      value={provisionPolicyForm.bracket_91_180}
                      onChange={(e) =>
                        setProvisionPolicyForm({
                          ...provisionPolicyForm,
                          bracket_91_180: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded font-mono text-center text-xs font-bold text-orange-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">181-365 Days (%)</label>
                    <input
                      type="number"
                      value={provisionPolicyForm.bracket_181_365}
                      onChange={(e) =>
                        setProvisionPolicyForm({
                          ...provisionPolicyForm,
                          bracket_181_365: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded font-mono text-center text-xs font-bold text-rose-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 mb-0.5">&gt; 365 Days (%)</label>
                    <input
                      type="number"
                      value={provisionPolicyForm.bracket_gt_365}
                      onChange={(e) =>
                        setProvisionPolicyForm({
                          ...provisionPolicyForm,
                          bracket_gt_365: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full px-2 py-1 border border-slate-300 rounded font-mono text-center text-xs font-bold text-purple-700"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Statutory Auditor Remarks & Purpose</label>
                <textarea
                  rows={2}
                  value={provisionPolicyForm.remarks}
                  onChange={(e) =>
                    setProvisionPolicyForm({ ...provisionPolicyForm, remarks: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsProvisionModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProvisionMutation.isPending}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition flex items-center gap-1.5"
                >
                  {createProvisionMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Calculate & Submit Review</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 2: 1-CLICK PURCHASE REQUISITION (PR) GENERATION MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {isRequisitionModalOpen && selectedAlertItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                  <ShoppingCart className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Trigger Purchase Requisition (PR)</h3>
                  <p className="text-xs text-slate-500">
                    Automated procurement indent for replenishment deficit
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsRequisitionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                triggerPrMutation.mutate(prForm);
              }}
              className="space-y-4 pt-4 text-xs"
            >
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 text-sm font-mono">{selectedAlertItem.itemCode}</div>
                <div className="text-slate-600">{selectedAlertItem.itemName}</div>
                <div className="flex items-center gap-3 pt-1 text-[11px]">
                  <span>On-Hand: <strong>{selectedAlertItem.onHandQty} {selectedAlertItem.uomCode}</strong></span>
                  <span>ROP: <strong>{selectedAlertItem.reorderPoint} {selectedAlertItem.uomCode}</strong></span>
                  <span className="text-rose-600 font-bold">Deficit: {selectedAlertItem.deficitQty} {selectedAlertItem.uomCode}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Required Quantity *</label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={prForm.requiredQty}
                    onChange={(e) =>
                      setPrForm({ ...prForm, requiredQty: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Required-By Date *</label>
                  <input
                    type="date"
                    required
                    value={prForm.requiredByDate}
                    onChange={(e) => setPrForm({ ...prForm, requiredByDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={prForm.priority}
                    onChange={(e) => setPrForm({ ...prForm, priority: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold text-amber-700"
                  >
                    <option value="CRITICAL_URGENT">CRITICAL_URGENT (Stockout Risk)</option>
                    <option value="HIGH">HIGH (Below Safety Buffer)</option>
                    <option value="MEDIUM">MEDIUM (Standard ROP)</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Suggested Supplier</label>
                  <select
                    value={prForm.suggestedVendorId}
                    onChange={(e) =>
                      setPrForm({ ...prForm, suggestedVendorId: parseInt(e.target.value, 10) })
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  >
                    {lookupsData?.data?.suppliers.map((s) => (
                      <option key={s.partyId} value={s.partyId}>
                        {s.partyName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Indent Purpose / Remarks</label>
                <input
                  type="text"
                  value={prForm.purpose}
                  onChange={(e) => setPrForm({ ...prForm, purpose: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsRequisitionModalOpen(false)}
                  className="px-4 py-2 border border-slate-300 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={triggerPrMutation.isPending}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition flex items-center gap-1.5"
                >
                  {triggerPrMutation.isPending ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>Generate Purchase Requisition</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 3: STATUTORY CARO 2020 & IND AS 2 VALUATION CERTIFICATE MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {isPrintModalOpen && selectedProvision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-8 shadow-2xl border border-slate-300 my-6">
            {/* Top Action Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-6 print:hidden">
              <div className="flex items-center gap-2">
                <FileCheck className="w-6 h-6 text-blue-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Statutory Inventory Valuation & Provisioning Certificate
                  </h3>
                  <p className="text-xs text-slate-500">Conforming to Ind AS 2 / AS-2 & CARO 2020 Clause 3(ii)</p>
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
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Body */}
            <div className="space-y-6 text-slate-900 font-sans print:m-0 print:p-0">
              {/* Corporate Letterhead */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
                <div>
                  <div className="text-xl font-black tracking-tight text-slate-950 uppercase">
                    KASHVIRA MANUFACTURING TECHNOLOGIES PVT. LTD.
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Plot 48, GIDC Industrial Estate, Manjusar, Vadodara - 391775, Gujarat, India
                  </div>
                  <div className="text-[10px] text-slate-500">
                    CIN: U29253GJ2020PTC118921 • GSTIN: 24AAACK9812L1ZV • PAN: AAACK9812L
                  </div>
                </div>

                <div className="text-right">
                  <div className="px-3 py-1 bg-slate-900 text-white text-xs font-bold tracking-wider rounded uppercase inline-block">
                    CARO 2020 CLAUSE 3(ii)
                  </div>
                  <div className="text-[11px] font-mono font-bold text-slate-900 mt-1">
                    REVIEW NO: {selectedProvision.provisionNo}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Valuation Date: {formatDate(selectedProvision.valuationDate)}
                  </div>
                </div>
              </div>

              {/* Title Banner */}
              <div className="text-center py-2 bg-slate-100 rounded border border-slate-300">
                <h2 className="text-sm font-black tracking-widest uppercase text-slate-900">
                  STATUTORY INVENTORY AGING, SLOW/DEAD STOCK & NET REALISABLE VALUE (NRV) PROVISIONING CERTIFICATE
                </h2>
                <p className="text-[10px] text-slate-600 mt-0.5 font-medium">
                  Prepared in accordance with Companies (Auditor's Report) Order, 2020 Clause 3(ii) and Ind AS 2 (Inventories)
                </p>
              </div>

              {/* Executive Aging Summary Schedule */}
              <div className="space-y-1 text-xs">
                <div className="font-bold text-slate-900 uppercase text-[11px] flex items-center justify-between">
                  <span>1. FIFO Aging Brackets & Valuation Provision Summary</span>
                  <span className="text-[10px] font-normal text-slate-500">Currency: Indian Rupee (INR)</span>
                </div>
                <table className="w-full text-xs border border-slate-400">
                  <thead className="bg-slate-100 font-bold border-b border-slate-400">
                    <tr>
                      <th className="p-2 text-left border-r border-slate-300">Aging Bracket</th>
                      <th className="p-2 text-center border-r border-slate-300">Turnover Velocity</th>
                      <th className="p-2 text-right border-r border-slate-300">Gross Book Value (₹)</th>
                      <th className="p-2 text-center border-r border-slate-300">Provision %</th>
                      <th className="p-2 text-right border-r border-slate-300">Provision Amount (₹)</th>
                      <th className="p-2 text-right">Net Realisable Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300">
                    <tr>
                      <td className="p-2 font-semibold border-r border-slate-300">0 - 30 Days (Fresh Stock)</td>
                      <td className="p-2 text-center border-r border-slate-300">FAST</td>
                      <td className="p-2 text-right font-mono border-r border-slate-300">
                        {formatInr(selectedProvision.freshStockValue)}
                      </td>
                      <td className="p-2 text-center border-r border-slate-300">0%</td>
                      <td className="p-2 text-right font-mono border-r border-slate-300">₹0.00</td>
                      <td className="p-2 text-right font-mono font-bold">
                        {formatInr(selectedProvision.freshStockValue)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-semibold border-r border-slate-300">31 - 60 Days (Normal Moving)</td>
                      <td className="p-2 text-center border-r border-slate-300">FAST</td>
                      <td className="p-2 text-right font-mono border-r border-slate-300">
                        {formatInr(selectedProvision.normalStockValue)}
                      </td>
                      <td className="p-2 text-center border-r border-slate-300">0%</td>
                      <td className="p-2 text-right font-mono border-r border-slate-300">₹0.00</td>
                      <td className="p-2 text-right font-mono font-bold">
                        {formatInr(selectedProvision.normalStockValue)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-semibold border-r border-slate-300">61 - 90 Days (Slow Moving)</td>
                      <td className="p-2 text-center border-r border-slate-300">SLOW</td>
                      <td className="p-2 text-right font-mono border-r border-slate-300">
                        {formatInr(selectedProvision.slowMovingValue)}
                      </td>
                      <td className="p-2 text-center border-r border-slate-300">0%</td>
                      <td className="p-2 text-right font-mono border-r border-slate-300">₹0.00</td>
                      <td className="p-2 text-right font-mono font-bold">
                        {formatInr(selectedProvision.slowMovingValue)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-semibold border-r border-slate-300">91 - 180 Days (Stagnant Stock)</td>
                      <td className="p-2 text-center border-r border-slate-300">SLOW</td>
                      <td className="p-2 text-right font-mono border-r border-slate-300">
                        {formatInr(selectedProvision.stagnantStockValue)}
                      </td>
                      <td className="p-2 text-center border-r border-slate-300">10%</td>
                      <td className="p-2 text-right font-mono border-r border-slate-300 font-semibold text-rose-700">
                        {formatInr(selectedProvision.stagnantStockValue * 0.1)}
                      </td>
                      <td className="p-2 text-right font-mono font-bold">
                        {formatInr(selectedProvision.stagnantStockValue * 0.9)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-semibold border-r border-slate-300">181 - 365 Days (Dormant Stock)</td>
                      <td className="p-2 text-center border-r border-slate-300">NON-MOVING</td>
                      <td className="p-2 text-right font-mono border-r border-slate-300">
                        {formatInr(selectedProvision.dormantStockValue)}
                      </td>
                      <td className="p-2 text-center border-r border-slate-300">30%</td>
                      <td className="p-2 text-right font-mono border-r border-slate-300 font-semibold text-rose-700">
                        {formatInr(selectedProvision.dormantStockValue * 0.3)}
                      </td>
                      <td className="p-2 text-right font-mono font-bold">
                        {formatInr(selectedProvision.dormantStockValue * 0.7)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-semibold border-r border-slate-300">&gt; 365 Days (Dead Stock)</td>
                      <td className="p-2 text-center border-r border-slate-300 text-purple-700 font-bold">
                        NON-MOVING / OBSOLETE
                      </td>
                      <td className="p-2 text-right font-mono border-r border-slate-300">
                        {formatInr(selectedProvision.deadStockValue)}
                      </td>
                      <td className="p-2 text-center border-r border-slate-300 font-bold text-rose-700">100%</td>
                      <td className="p-2 text-right font-mono border-r border-slate-300 font-bold text-rose-700">
                        {formatInr(selectedProvision.deadStockValue)}
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-slate-400">₹0.00</td>
                    </tr>
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-400">
                    <tr>
                      <td colSpan={2} className="p-2 text-right border-r border-slate-300">
                        TOTAL INVENTORY EVALUATION:
                      </td>
                      <td className="p-2 text-right border-r border-slate-300 font-mono">
                        {formatInr(selectedProvision.totalGrossValuation)}
                      </td>
                      <td className="p-2 text-center border-r border-slate-300">
                        {Math.round((selectedProvision.approvedProvisionAmount / (selectedProvision.totalGrossValuation || 1)) * 100)}%
                      </td>
                      <td className="p-2 text-right border-r border-slate-300 font-mono text-rose-700">
                        {formatInr(selectedProvision.approvedProvisionAmount)}
                      </td>
                      <td className="p-2 text-right font-mono text-slate-950 font-black">
                        {formatInr(selectedProvision.totalGrossValuation - selectedProvision.approvedProvisionAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Amount in Words */}
              <div className="text-xs border border-slate-200 p-3 rounded bg-slate-50 font-sans">
                <span className="font-semibold text-slate-700">
                  Approved Provision / Write-Down Amount in Words:
                </span>{' '}
                <strong className="text-slate-900">
                  {numberToWordsINR(selectedProvision.approvedProvisionAmount)}
                </strong>
              </div>

              {/* Statutory Statement & Attestation */}
              <div className="p-3 bg-slate-50 border border-slate-300 rounded text-[11px] space-y-1">
                <span className="font-bold text-slate-900 block">
                  MANAGEMENT ATTESTATION & CARO 2020 DISCLOSURE:
                </span>
                <p className="text-slate-700 leading-relaxed">
                  We confirm that physical verification of inventory has been conducted at reasonable intervals by the
                  management in compliance with Clause 3(ii) of CARO 2020. The valuation of inventories has been made at
                  the lower of cost and net realisable value in accordance with Ind AS 2. Adequate write-down provision
                  of {formatInr(selectedProvision.approvedProvisionAmount)} has been duly approved and recorded against
                  slow-moving, damaged, and obsolete items.
                </p>
              </div>

              {/* Signature Blocks */}
              <div className="pt-8 border-t border-slate-400 grid grid-cols-3 gap-6 text-center text-xs">
                <div>
                  <div className="h-12 flex items-end justify-center">
                    <span className="font-serif italic text-slate-600">
                      {selectedProvision.reviewerName || 'Store In-Charge'}
                    </span>
                  </div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
                    Store Officer / Stock Verifier
                  </div>
                  <div className="text-[10px] text-slate-500">Date: {formatDate(selectedProvision.valuationDate)}</div>
                </div>

                <div>
                  <div className="h-12 flex items-end justify-center">
                    <span className="font-serif italic text-slate-600">Cost & Inventory Control</span>
                  </div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
                    Cost Accountant / HOD Finance
                  </div>
                  <div className="text-[10px] text-slate-500">Certified Cost Auditor</div>
                </div>

                <div>
                  <div className="h-12 flex items-end justify-center">
                    <span className="font-serif italic text-slate-600">Chief Financial Officer</span>
                  </div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
                    Director / Statutory Auditor
                  </div>
                  <div className="text-[10px] text-slate-500">Ind AS 2 Sign-off</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* MODAL 4: VIEW PROVISION REVIEW SCHEDULE DETAIL MODAL */}
      {/* ---------------------------------------------------------------------- */}
      {isViewProvisionModalOpen && selectedProvision && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 font-mono">
                  Review Schedule: {selectedProvision.provisionNo}
                </h3>
                <p className="text-xs text-slate-500">
                  Valuation Date: {formatDate(selectedProvision.valuationDate)} • {selectedProvision.status}
                </p>
              </div>
              <button
                onClick={() => setIsViewProvisionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-4 text-xs">
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">SKU Code & Name</th>
                      <th className="p-2.5">Batch / Heat</th>
                      <th className="p-2.5 text-right">On-Hand</th>
                      <th className="p-2.5 text-right">Gross (₹)</th>
                      <th className="p-2.5 text-center">Age (Days)</th>
                      <th className="p-2.5">Bracket</th>
                      <th className="p-2.5">FSN</th>
                      <th className="p-2.5 text-center">Prov %</th>
                      <th className="p-2.5 text-right">Provision (₹)</th>
                      <th className="p-2.5 text-right">NRV (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedProvision.items?.map((it) => (
                      <tr key={it.provisionItemId} className="hover:bg-slate-50">
                        <td className="p-2.5">
                          <div className="font-bold text-slate-900 font-mono">{it.itemCode}</div>
                          <div className="text-[10px] text-slate-500 truncate max-w-xs">{it.itemName}</div>
                        </td>
                        <td className="p-2.5 font-mono text-[11px] text-slate-600">
                          {it.batchNo || '-'}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                          {formatQty(it.onHandQty)} {it.uomCode}
                        </td>
                        <td className="p-2.5 text-right font-mono font-semibold text-slate-800">
                          {formatInr(it.grossValuation)}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold">{it.ageInDays}d</td>
                        <td className="p-2.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {it.agingBracket.replace('_', '-')}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {it.fsnClassification}
                          </span>
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-rose-600">
                          {it.provisionRatePercent}%
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-rose-700">
                          {formatInr(it.provisionAmount)}
                        </td>
                        <td className="p-2.5 text-right font-mono font-black text-slate-900">
                          {formatInr(it.netRealizableValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsViewProvisionModalOpen(false);
                    setIsPrintModalOpen(true);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow transition flex items-center gap-1.5 text-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Certificate</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgingDashboardPage;
