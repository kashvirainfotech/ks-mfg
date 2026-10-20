import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Coins,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Package,
  PackageCheck,
  Plus,
  Printer,
  RefreshCw,
  Scale,
  Search,
  Send,
  Trash2,
  TrendingDown,
  TrendingUp,
  Warehouse,
  X,
  XCircle,
} from 'lucide-react';
import { apiClient, type ApiResponse } from '../../lib/apiClient';
import { useAuthStore } from '../../store/useAuthStore';
import {
  MasterDataTable,
  type MasterTableColumn,
} from '../../components/common/MasterDataTable';
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

const formatQty = (val: number, precision = 3): string =>
  new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: precision,
  }).format(val || 0);

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

// Convert number to Indian currency words
function numberToWordsINR(amount: number): string {
  const num = Math.round(amount * 100) / 100;
  const parts = num.toFixed(2).split('.');
  const integerPart = Math.abs(parseInt(parts[0], 10));
  const decimalPart = parseInt(parts[1], 10);

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
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

  let result = (amount < 0 ? 'Minus ' : '') + 'Rupees ' + words.trim();
  if (decimalPart > 0) {
    result += ' and ' + convertTwoDigits(decimalPart) + ' Paise';
  }
  return result + ' Only';
}

// ----------------------------------------------------------------------------
// Types & Interfaces
// ----------------------------------------------------------------------------
interface AdjustmentItemRow {
  adjustmentItemId?: number;
  itemSequence?: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  binId: number;
  binCode?: string;
  binName?: string;
  uomId: number;
  uomCode?: string;
  batchNo?: string;
  heatNo?: string;
  bookQty: number;
  physicalQty: number;
  varianceQty: number;
  unitCost: number;
  bookValue: number;
  physicalValue: number;
  varianceValue: number;
  varianceDirection: string;
  discrepancyReason?: string;
  remarks?: string;
}

interface AdjustmentHeaderRow {
  adjustmentId: number;
  adjustmentNo: string;
  adjustmentDate: string;
  adjustmentType: string;
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  auditedBy?: number;
  auditorName?: string;
  auditedAt?: string;
  approvedBy?: number;
  approverName?: string;
  approvalDate?: string;
  totalItems: number;
  totalBookValue: number;
  totalPhysicalValue: number;
  netVarianceValue: number;
  status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'CANCELLED';
  cancellationReason?: string;
  remarks?: string;
  createdDate: string;
  items?: AdjustmentItemRow[];
}

interface AdjustmentSummary {
  totalVouchers: number;
  draftCount: number;
  submittedCount: number;
  postedCount: number;
  totalBookValue: number;
  totalPhysicalValue: number;
  netVarianceValue: number;
}

interface LookupsData {
  warehouses: Array<{
    warehouseId: number;
    warehouseCode: string;
    warehouseName: string;
    warehouseType: string;
  }>;
  bins: Array<{
    binId: number;
    warehouseId: number;
    binCode: string;
    binName: string;
    binType: string;
  }>;
  items: Array<{
    itemId: number;
    itemCode: string;
    itemName: string;
    uomId: number;
    standardCost: string;
  }>;
  uoms: Array<{
    uomId: number;
    uomCode: string;
    uomName: string;
  }>;
  users: Array<{
    userId: number;
    fullName: string;
    username: string;
  }>;
}

const ADJUSTMENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  CYCLE_COUNT: { label: 'Cycle Count', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  PERIODIC_AUDIT: { label: 'Periodic Stock Audit', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  DAMAGE_WRITEOFF: { label: 'Damage Write-Off', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  EXPIRY_WRITEOFF: { label: 'Expiry Write-Off', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  SPILLAGE_LOSS: { label: 'Spillage / Evaporation Loss', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  FOUND_SURPLUS: { label: 'Found Surplus Reconciliation', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REVALUATION_VARIANCE: { label: 'Revaluation Variance', color: 'bg-purple-50 text-purple-700 border-purple-200' },
};

// ----------------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------------
export const StockAdjustmentMasterPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { allowedCompanies, allowedBranches, activeContext, user } = useAuthStore();
  const currentCompany = allowedCompanies.find(c => c.compId === activeContext.compId);
  const currentBranch = allowedBranches.find(b => b.branchId === activeContext.branchId);

  // Filters state
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');

  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<AdjustmentHeaderRow | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');

  // Create Form State
  const [formWarehouseId, setFormWarehouseId] = useState<number | ''>('');
  const [formType, setFormType] = useState<string>('CYCLE_COUNT');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formRemarks, setFormRemarks] = useState<string>('');
  const [formItems, setFormItems] = useState<AdjustmentItemRow[]>([]);
  const [isLoadingBookStock, setIsLoadingBookStock] = useState(false);

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------
  const { data: summaryData } = useQuery<ApiResponse<AdjustmentSummary>>({
    queryKey: ['stock-adjustments-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<AdjustmentSummary>>(
        '/inventory/adjustments/summary',
      );
      return res.data;
    },
  });

  const { data: lookupsData } = useQuery<ApiResponse<LookupsData>>({
    queryKey: ['stock-adjustments-lookups'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<LookupsData>>(
        '/inventory/adjustments/lookups',
      );
      return res.data;
    },
  });

  const {
    data: listData,
    isLoading: isListLoading,
  } = useQuery<ApiResponse<AdjustmentHeaderRow[]>>({
    queryKey: [
      'stock-adjustments-list',
      selectedWarehouseId,
      selectedStatus,
      selectedType,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedWarehouseId) params.append('warehouseId', selectedWarehouseId);
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedType) params.append('adjustmentType', selectedType);

      const res = await apiClient.get<ApiResponse<AdjustmentHeaderRow[]>>(
        `/inventory/adjustments?${params.toString()}`,
      );
      return res.data;
    },
  });

  // Query single voucher for drawer/print
  const { data: voucherDetailData, refetch: refetchDetail } = useQuery<
    ApiResponse<AdjustmentHeaderRow>
  >({
    queryKey: ['stock-adjustment-detail', selectedVoucher?.adjustmentId],
    queryFn: async () => {
      if (!selectedVoucher?.adjustmentId) return null as any;
      const res = await apiClient.get<ApiResponse<AdjustmentHeaderRow>>(
        `/inventory/adjustments/${selectedVoucher.adjustmentId}`,
      );
      return res.data;
    },
    enabled: !!selectedVoucher?.adjustmentId,
  });

  const activeVoucher = voucherDetailData?.data || selectedVoucher;

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post<ApiResponse<AdjustmentHeaderRow>>(
        '/inventory/adjustments',
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-adjustments-list'] });
      queryClient.invalidateQueries({ queryKey: ['stock-adjustments-summary'] });
      queryClient.invalidateQueries({ queryKey: ['stock-balance-list'] });
      setIsCreateModalOpen(false);
      resetForm();
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.post<ApiResponse<AdjustmentHeaderRow>>(
        `/inventory/adjustments/${id}/submit`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-adjustments-list'] });
      queryClient.invalidateQueries({ queryKey: ['stock-adjustments-summary'] });
      refetchDetail();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.post<ApiResponse<AdjustmentHeaderRow>>(
        `/inventory/adjustments/${id}/approve`,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-adjustments-list'] });
      queryClient.invalidateQueries({ queryKey: ['stock-adjustments-summary'] });
      queryClient.invalidateQueries({ queryKey: ['stock-balance-list'] });
      queryClient.invalidateQueries({ queryKey: ['stock-balance-summary'] });
      refetchDetail();
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await apiClient.post<ApiResponse<AdjustmentHeaderRow>>(
        `/inventory/adjustments/${id}/cancel`,
        { cancellationReason: reason },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-adjustments-list'] });
      queryClient.invalidateQueries({ queryKey: ['stock-adjustments-summary'] });
      queryClient.invalidateQueries({ queryKey: ['stock-balance-list'] });
      setIsCancelModalOpen(false);
      setCancellationReason('');
      refetchDetail();
    },
  });

  // --------------------------------------------------------------------------
  // Form Actions: 1-Click Load Book Stock
  // --------------------------------------------------------------------------
  const resetForm = () => {
    setFormWarehouseId('');
    setFormType('CYCLE_COUNT');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormRemarks('');
    setFormItems([]);
  };

  const handleLoadBookStock = async () => {
    if (!formWarehouseId) {
      alert('Please select a warehouse first to load book stock.');
      return;
    }
    try {
      setIsLoadingBookStock(true);
      const res = await apiClient.get<ApiResponse<AdjustmentItemRow[]>>(
        `/inventory/adjustments/book-stock?warehouseId=${formWarehouseId}`,
      );
      if (res.data?.data && res.data.data.length > 0) {
        setFormItems(res.data.data);
      } else {
        alert('No active bin stock found in this warehouse.');
        setFormItems([]);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to load book stock.');
    } finally {
      setIsLoadingBookStock(false);
    }
  };

  const handlePhysicalQtyChange = (index: number, newPhysicalQty: number) => {
    const updated = [...formItems];
    const item = { ...updated[index] };
    item.physicalQty = newPhysicalQty;
    item.varianceQty = Math.round((newPhysicalQty - item.bookQty) * 1000) / 1000;
    item.physicalValue = Math.round(newPhysicalQty * item.unitCost * 100) / 100;
    item.varianceValue = Math.round(item.varianceQty * item.unitCost * 100) / 100;

    if (item.varianceQty > 0) {
      item.varianceDirection = 'SURPLUS_GAIN';
    } else if (item.varianceQty < 0) {
      item.varianceDirection = 'DEFICIT_LOSS';
    } else {
      item.varianceDirection = 'NONE';
    }

    updated[index] = item;
    setFormItems(updated);
  };

  const handleDiscrepancyReasonChange = (index: number, reason: string) => {
    const updated = [...formItems];
    updated[index] = { ...updated[index], discrepancyReason: reason };
    setFormItems(updated);
  };

  const handleRemoveFormItem = (index: number) => {
    setFormItems(formItems.filter((_, i) => i !== index));
  };

  const handleAddCustomItem = () => {
    if (!lookupsData?.data?.items?.length || !lookupsData?.data?.bins?.length) {
      alert('Lookup data not available.');
      return;
    }
    const defaultItem = lookupsData.data.items[0];
    const warehouseBins = lookupsData.data.bins.filter(
      (b) => b.warehouseId === formWarehouseId,
    );
    const defaultBin = warehouseBins[0] || lookupsData.data.bins[0];

    const newItem: AdjustmentItemRow = {
      itemId: defaultItem.itemId,
      itemCode: defaultItem.itemCode,
      itemName: defaultItem.itemName,
      binId: defaultBin.binId,
      binCode: defaultBin.binCode,
      binName: defaultBin.binName,
      uomId: defaultItem.uomId,
      uomCode: 'NOS',
      batchNo: '',
      heatNo: '',
      bookQty: 0,
      physicalQty: 1,
      varianceQty: 1,
      unitCost: parseFloat(defaultItem.standardCost || '0'),
      bookValue: 0,
      physicalValue: parseFloat(defaultItem.standardCost || '0'),
      varianceValue: parseFloat(defaultItem.standardCost || '0'),
      varianceDirection: 'SURPLUS_GAIN',
      discrepancyReason: 'Unrecorded found stock',
      remarks: '',
    };
    setFormItems([...formItems, newItem]);
  };

  // Form Totals
  const formTotals = useMemo(() => {
    let book = 0;
    let phys = 0;
    let varVal = 0;
    formItems.forEach((it) => {
      book += it.bookValue || 0;
      phys += it.physicalValue || 0;
      varVal += it.varianceValue || 0;
    });
    return {
      bookTotal: Math.round(book * 100) / 100,
      physicalTotal: Math.round(phys * 100) / 100,
      netVariance: Math.round(varVal * 100) / 100,
    };
  }, [formItems]);

  const handleSubmitForm = (submitForApproval: boolean) => {
    if (!formWarehouseId) {
      alert('Please select a warehouse.');
      return;
    }
    if (formItems.length === 0) {
      alert('Please add at least one line item to verify.');
      return;
    }

    const payload = {
      warehouseId: Number(formWarehouseId),
      adjustmentType: formType,
      adjustmentDate: formDate,
      remarks: formRemarks,
      items: formItems.map((it) => ({
        itemId: it.itemId,
        itemCode: it.itemCode,
        itemName: it.itemName,
        binId: it.binId,
        uomId: it.uomId,
        batchNo: it.batchNo,
        heatNo: it.heatNo,
        bookQty: it.bookQty,
        physicalQty: it.physicalQty,
        unitCost: it.unitCost,
        discrepancyReason: it.discrepancyReason,
        remarks: it.remarks,
      })),
    };

    createMutation.mutate(payload, {
      onSuccess: (data) => {
        if (submitForApproval && data?.data?.adjustmentId) {
          submitMutation.mutate(data.data.adjustmentId);
        }
      },
    });
  };

  // --------------------------------------------------------------------------
  // Table Columns
  // --------------------------------------------------------------------------
  const columns: MasterTableColumn<AdjustmentHeaderRow>[] = [
    {
      key: 'adjustmentNo',
      header: 'VOUCHER NO',
      sortable: true,
      sortValue: (row: AdjustmentHeaderRow) => row.adjustmentNo,
      render: (row: AdjustmentHeaderRow) => (
        <div>
          <button
            onClick={() => {
              setSelectedVoucher(row);
              setIsDetailDrawerOpen(true);
            }}
            className="text-left font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1.5"
          >
            <ClipboardCheck className="w-4 h-4 text-blue-500" />
            <span>{row.adjustmentNo}</span>
          </button>
          <div className="text-xs text-slate-400 mt-0.5">
            {formatDate(row.adjustmentDate)}
          </div>
        </div>
      ),
    },
    {
      key: 'adjustmentType',
      header: 'TYPE & PURPOSE',
      sortable: true,
      sortValue: (row: AdjustmentHeaderRow) => row.adjustmentType,
      render: (row: AdjustmentHeaderRow) => {
        const meta = ADJUSTMENT_TYPE_LABELS[row.adjustmentType] || {
          label: row.adjustmentType,
          color: 'bg-slate-100 text-slate-700 border-slate-200',
        };
        return (
          <span
            className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full border ${meta.color}`}
          >
            {meta.label}
          </span>
        );
      },
    },
    {
      key: 'warehouse',
      header: 'WAREHOUSE',
      sortable: true,
      sortValue: (row: AdjustmentHeaderRow) => row.warehouseName,
      render: (row: AdjustmentHeaderRow) => (
        <div>
          <div className="font-medium text-slate-800">{row.warehouseName}</div>
          <div className="text-xs text-slate-400 flex items-center gap-1">
            <Building2 className="w-3 h-3 text-slate-400" />
            <span>{row.warehouseCode}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'totalItems',
      header: 'LINES',
      align: 'right',
      sortable: true,
      sortValue: (row: AdjustmentHeaderRow) => row.totalItems,
      render: (row: AdjustmentHeaderRow) => (
        <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">
          {row.totalItems} {row.totalItems === 1 ? 'line' : 'lines'}
        </span>
      ),
    },
    {
      key: 'totalBookValue',
      header: 'BOOK VALUE',
      align: 'right',
      sortable: true,
      sortValue: (row: AdjustmentHeaderRow) => row.totalBookValue,
      render: (row: AdjustmentHeaderRow) => (
        <span className="text-slate-600 font-medium">
          {formatInr(row.totalBookValue)}
        </span>
      ),
    },
    {
      key: 'totalPhysicalValue',
      header: 'PHYSICAL VALUE',
      align: 'right',
      sortable: true,
      sortValue: (row: AdjustmentHeaderRow) => row.totalPhysicalValue,
      render: (row: AdjustmentHeaderRow) => (
        <span className="text-slate-900 font-semibold">
          {formatInr(row.totalPhysicalValue)}
        </span>
      ),
    },
    {
      key: 'netVarianceValue',
      header: 'NET VARIANCE',
      align: 'right',
      sortable: true,
      sortValue: (row: AdjustmentHeaderRow) => row.netVarianceValue,
      render: (row: AdjustmentHeaderRow) => {
        const isSurplus = row.netVarianceValue > 0;
        const isDeficit = row.netVarianceValue < 0;
        return (
          <div className="text-right">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
                isSurplus
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : isDeficit
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {isSurplus && <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />}
              {isDeficit && <ArrowDownRight className="w-3.5 h-3.5 text-rose-600" />}
              <span>{formatInr(row.netVarianceValue)}</span>
            </span>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {isSurplus ? 'Surplus Gain' : isDeficit ? 'Deficit Write-Off' : 'No Variance'}
            </div>
          </div>
        );
      },
    },
    {
      key: 'status',
      header: 'STATUS',
      sortable: true,
      sortValue: (row: AdjustmentHeaderRow) => row.status,
      render: (row: AdjustmentHeaderRow) => {
        const map: Record<string, { label: string; badge: string }> = {
          DRAFT: { label: 'Draft', badge: 'bg-amber-50 text-amber-700 border-amber-200' },
          SUBMITTED: { label: 'Submitted', badge: 'bg-blue-50 text-blue-700 border-blue-200' },
          APPROVED: { label: 'Approved', badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
          POSTED: { label: 'Approved & Posted', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
          CANCELLED: { label: 'Cancelled', badge: 'bg-rose-50 text-rose-700 border-rose-200' },
        };
        const st = map[row.status] || { label: row.status, badge: 'bg-slate-100 text-slate-700 border-slate-200' };
        return (
          <span className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-full border ${st.badge}`}>
            {st.label}
          </span>
        );
      },
    },
    {
      key: 'auditor',
      header: 'AUDITOR / VERIFIER',
      sortable: true,
      sortValue: (row: AdjustmentHeaderRow) => row.auditorName || '',
      render: (row: AdjustmentHeaderRow) => (
        <div className="text-xs">
          <div className="font-medium text-slate-700">{row.auditorName || 'Unassigned'}</div>
          {row.auditedAt && (
            <div className="text-slate-400">{formatDate(row.auditedAt)}</div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'ACTIONS',
      align: 'right',
      render: (row: AdjustmentHeaderRow) => (
        <div className="flex items-center gap-1.5 justify-end">
          <button
            title="View Details"
            onClick={() => {
              setSelectedVoucher(row);
              setIsDetailDrawerOpen(true);
            }}
            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
          >
            <Eye className="w-4 h-4" />
          </button>

          <PermissionGate screen="STOCK_ADJUSTMENT" action="PRINT">
            <button
              title="Print Statutory Audit Certificate (CARO 2020 / Ind AS 2)"
              onClick={() => {
                setSelectedVoucher(row);
                setIsPrintModalOpen(true);
              }}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-blue-50 hover:border-blue-200 text-blue-600 transition"
            >
              <Printer className="w-4 h-4" />
            </button>
          </PermissionGate>

          {row.status === 'DRAFT' && (
            <PermissionGate screen="STOCK_ADJUSTMENT" action="SUBMIT">
              <button
                title="Submit for Manager Approval"
                onClick={() => {
                  if (confirm(`Submit Voucher ${row.adjustmentNo} for Managerial Approval?`)) {
                    submitMutation.mutate(row.adjustmentId);
                  }
                }}
                className="p-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 transition"
              >
                <Send className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {(row.status === 'SUBMITTED' || row.status === 'DRAFT') && (
            <PermissionGate screen="STOCK_ADJUSTMENT" action="APPROVE">
              <button
                title="Approve & Post to Bin Stock & Stock Ledger"
                onClick={() => {
                  if (
                    confirm(
                      `Approve and Post Voucher ${row.adjustmentNo}?\nThis will synchronize on-hand bin stock and append double-entry stock ledger adjustments immediately!`,
                    )
                  ) {
                    approveMutation.mutate(row.adjustmentId);
                  }
                }}
                className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {row.status !== 'CANCELLED' && (
            <PermissionGate screen="STOCK_ADJUSTMENT" action="CANCEL">
              <button
                title="Cancel Voucher & Revert Adjustments"
                onClick={() => {
                  setSelectedVoucher(row);
                  setIsCancelModalOpen(true);
                }}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-rose-600 transition"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}
        </div>
      ),
    },
  ];

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------
  const summary = summaryData?.data || {
    totalVouchers: 0,
    draftCount: 0,
    submittedCount: 0,
    postedCount: 0,
    totalBookValue: 0,
    totalPhysicalValue: 0,
    netVarianceValue: 0,
  };

  return (
    <div className="min-h-screen bg-slate-50/70 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* 1. Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Physical Stock Reconciliation & Adjustments
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Periodic Cycle Counts, Physical Audits, Scrap Write-Offs & CARO 2020 Statutory Reconciliation
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <PermissionGate screen="STOCK_ADJUSTMENT" action="ADD">
            <button
              onClick={() => {
                resetForm();
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/25 transition"
            >
              <Plus className="w-4 h-4" />
              <span>New Stock Verification</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* 2. Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Vouchers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Audit Vouchers
            </p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {summary.totalVouchers}
            </h3>
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="text-amber-600 font-medium bg-amber-50 px-1.5 py-0.5 rounded">
                {summary.draftCount} Draft
              </span>
              <span className="text-blue-600 font-medium bg-blue-50 px-1.5 py-0.5 rounded">
                {summary.submittedCount} Submitted
              </span>
              <span className="text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
                {summary.postedCount} Posted
              </span>
            </div>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
            <ClipboardCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Total Book Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Audited Book Valuation
            </p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {formatInr(summary.totalBookValue)}
            </h3>
            <p className="text-xs text-slate-400 mt-1">Ledger on-hand balance</p>
          </div>
          <div className="p-3 bg-slate-50 text-slate-600 rounded-2xl">
            <Scale className="w-6 h-6" />
          </div>
        </div>

        {/* Total Physical Value */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Physical Count Valuation
            </p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">
              {formatInr(summary.totalPhysicalValue)}
            </h3>
            <p className="text-xs text-slate-400 mt-1">Verified on shopfloor</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <PackageCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Net Variance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Net Audit Variance
            </p>
            <h3
              className={`text-2xl font-bold mt-1 ${
                summary.netVarianceValue >= 0 ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {formatInr(summary.netVarianceValue)}
            </h3>
            <div className="flex items-center gap-1 mt-1 text-xs">
              {summary.netVarianceValue >= 0 ? (
                <>
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-medium">Surplus Gain</span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
                  <span className="text-rose-700 font-medium">Deficit / Scrap Loss</span>
                </>
              )}
            </div>
          </div>
          <div
            className={`p-3 rounded-2xl ${
              summary.netVarianceValue >= 0
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-rose-50 text-rose-600'
            }`}
          >
            <Coins className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. Master Data Table */}
      <MasterDataTable<AdjustmentHeaderRow>
        title="Physical Stock Verification & Audit Register"
        subtitle="Cycle counts, periodic stock audits, scrap write-offs and CARO 2020 reconciliation vouchers"
        screenCode="STOCK_ADJUSTMENT"
        data={listData?.data || []}
        columns={columns}
        rowKey={(row) => row.adjustmentId}
        isLoading={isListLoading}
        searchPlaceholder="Search by voucher #, warehouse, auditor, or remarks..."
        searchPredicate={(row, query) => {
          const q = query.toLowerCase();
          return (
            row.adjustmentNo.toLowerCase().includes(q) ||
            row.warehouseName.toLowerCase().includes(q) ||
            (row.auditorName?.toLowerCase() || '').includes(q) ||
            (row.remarks?.toLowerCase() || '').includes(q)
          );
        }}
        addButtonLabel="New Stock Verification"
        onAddClick={() => {
          resetForm();
          setIsCreateModalOpen(true);
        }}
        onPrintClick={() => {
          if (listData?.data && listData.data.length > 0) {
            setSelectedVoucher(listData.data[0]);
            setIsPrintModalOpen(true);
          }
        }}
        filterToolbarSlot={
          <div className="flex flex-wrap items-center gap-2">
            {/* Warehouse Filter */}
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium"
            >
              <option value="">All Warehouses</option>
              {lookupsData?.data?.warehouses.map((w) => (
                <option key={w.warehouseId} value={w.warehouseId}>
                  {w.warehouseCode} - {w.warehouseName}
                </option>
              ))}
            </select>

            {/* Type Filter */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium"
            >
              <option value="">All Audit Types</option>
              {Object.entries(ADJUSTMENT_TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="POSTED">Approved & Posted</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>
        }
      />

      {/* ---------------------------------------------------------------------- */}
      {/* 4. Create / Edit Physical Verification Modal */}
      {/* ---------------------------------------------------------------------- */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600 text-white rounded-xl">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    New Physical Stock Verification & Audit Sheet
                  </h3>
                  <p className="text-xs text-slate-500">
                    Compare book on-hand against shopfloor physical count & compute CARO variance
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Header Fields Row */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                {/* Warehouse */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Warehouse <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formWarehouseId}
                    onChange={(e) => setFormWarehouseId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="">Select Warehouse</option>
                    {lookupsData?.data?.warehouses?.map((wh) => (
                      <option key={wh.warehouseId} value={wh.warehouseId}>
                        {wh.warehouseCode} - {wh.warehouseName}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Audit Type */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Audit Purpose / Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {Object.entries(ADJUSTMENT_TYPE_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Verification Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Audit Scope / Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Monthly A-Class Cycle Count"
                    value={formRemarks}
                    onChange={(e) => setFormRemarks(e.target.value)}
                    className="w-full text-xs font-medium border border-slate-300 rounded-lg p-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* 1-Click Load Book Stock Action Strip */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-xl">
                <div className="flex items-center gap-2">
                  <Warehouse className="w-5 h-5 text-blue-600" />
                  <span className="text-xs font-medium text-blue-900">
                    Load current system stock balances to pre-fill verification lines
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLoadBookStock}
                    disabled={!formWarehouseId || isLoadingBookStock}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg shadow-sm transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBookStock ? 'animate-spin' : ''}`} />
                    <span>{isLoadingBookStock ? 'Loading Book Stock...' : '1-Click Load Book Stock'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleAddCustomItem}
                    disabled={!formWarehouseId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg shadow-sm transition"
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Add Surplus Line</span>
                  </button>
                </div>
              </div>

              {/* Items Verification Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto max-h-[380px]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="bg-slate-100 text-slate-700 font-semibold sticky top-0 z-10 border-b border-slate-200">
                      <tr>
                        <th className="p-2.5">#</th>
                        <th className="p-2.5">ITEM & CODE</th>
                        <th className="p-2.5">BIN & BATCH</th>
                        <th className="p-2.5 text-right">BOOK QTY</th>
                        <th className="p-2.5 text-right w-28">PHYSICAL QTY</th>
                        <th className="p-2.5 text-right">VARIANCE</th>
                        <th className="p-2.5 text-right">UNIT COST</th>
                        <th className="p-2.5 text-right">VARIANCE VALUE</th>
                        <th className="p-2.5">DISCREPANCY REASON</th>
                        <th className="p-2.5 text-center w-12">DEL</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {formItems.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="p-8 text-center text-slate-400">
                            No verification lines added. Select warehouse and click "1-Click Load Book Stock" to populate.
                          </td>
                        </tr>
                      ) : (
                        formItems.map((item, idx) => {
                          const isSurplus = item.varianceQty > 0;
                          const isDeficit = item.varianceQty < 0;
                          return (
                            <tr key={idx} className="hover:bg-slate-50/80 transition">
                              <td className="p-2.5 font-mono text-slate-400">{idx + 1}</td>
                              <td className="p-2.5">
                                <div className="font-semibold text-slate-900">{item.itemCode}</div>
                                <div className="text-[11px] text-slate-500 truncate max-w-[180px]">
                                  {item.itemName}
                                </div>
                              </td>
                              <td className="p-2.5">
                                <div className="font-medium text-slate-800">{item.binCode || 'Bin'}</div>
                                <div className="text-[10px] text-slate-400">{item.batchNo || 'No Batch'}</div>
                              </td>
                              <td className="p-2.5 text-right font-medium text-slate-600">
                                {formatQty(item.bookQty)} {item.uomCode || ''}
                              </td>
                              <td className="p-2.5 text-right">
                                <input
                                  type="number"
                                  step="any"
                                  value={item.physicalQty}
                                  onChange={(e) =>
                                    handlePhysicalQtyChange(idx, parseFloat(e.target.value) || 0)
                                  }
                                  className="w-full text-right font-semibold text-slate-900 border border-slate-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                />
                              </td>
                              <td className="p-2.5 text-right">
                                <span
                                  className={`inline-block px-1.5 py-0.5 rounded font-bold text-[11px] ${
                                    isSurplus
                                      ? 'text-emerald-700 bg-emerald-50'
                                      : isDeficit
                                      ? 'text-rose-700 bg-rose-50'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {item.varianceQty > 0 ? `+${item.varianceQty}` : item.varianceQty}
                                </span>
                              </td>
                              <td className="p-2.5 text-right text-slate-600 font-mono">
                                {formatInr(item.unitCost)}
                              </td>
                              <td className="p-2.5 text-right font-semibold">
                                <span className={isSurplus ? 'text-emerald-600' : isDeficit ? 'text-rose-600' : 'text-slate-500'}>
                                  {formatInr(item.varianceValue)}
                                </span>
                              </td>
                              <td className="p-2.5">
                                <input
                                  type="text"
                                  placeholder="e.g. Handling spillage"
                                  value={item.discrepancyReason || ''}
                                  onChange={(e) => handleDiscrepancyReasonChange(idx, e.target.value)}
                                  className="w-full border border-slate-200 rounded px-2 py-1 text-[11px] text-slate-700 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                              </td>
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFormItem(idx)}
                                  className="text-slate-400 hover:text-rose-600 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Real-time Summary Footer */}
                {formItems.length > 0 && (
                  <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs font-medium">
                    <div className="text-slate-600">
                      Total Lines: <strong className="text-slate-900">{formItems.length}</strong>
                    </div>
                    <div className="flex items-center gap-6">
                      <div>
                        Book Total: <strong className="text-slate-800">{formatInr(formTotals.bookTotal)}</strong>
                      </div>
                      <div>
                        Physical Total: <strong className="text-slate-900">{formatInr(formTotals.physicalTotal)}</strong>
                      </div>
                      <div className="p-1 px-2.5 rounded-lg bg-white border border-slate-200 shadow-sm">
                        Net Variance:{' '}
                        <strong
                          className={
                            formTotals.netVariance >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'
                          }
                        >
                          {formatInr(formTotals.netVariance)}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  disabled={createMutation.isPending}
                  onClick={() => handleSubmitForm(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition shadow-sm"
                >
                  Save as Draft
                </button>

                <button
                  type="button"
                  disabled={createMutation.isPending}
                  onClick={() => handleSubmitForm(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/20 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Save & Submit for Sign-off</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 5. Voucher Detail Drawer */}
      {/* ---------------------------------------------------------------------- */}
      {isDetailDrawerOpen && activeVoucher && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {activeVoucher.adjustmentNo}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Stock Audit & Reconciliation Sheet Details
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Status & Action Bar */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-bold tracking-wider">
                    VOUCHER STATUS
                  </span>
                  <span className="text-sm font-bold text-slate-800 mt-0.5 inline-block">
                    {activeVoucher.status}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <PermissionGate screen="STOCK_ADJUSTMENT" action="PRINT">
                    <button
                      onClick={() => setIsPrintModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition"
                    >
                      <Printer className="w-3.5 h-3.5 text-blue-600" />
                      <span>Print Certificate</span>
                    </button>
                  </PermissionGate>

                  {activeVoucher.status === 'DRAFT' && (
                    <PermissionGate screen="STOCK_ADJUSTMENT" action="SUBMIT">
                      <button
                        onClick={() => submitMutation.mutate(activeVoucher.adjustmentId)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Submit</span>
                      </button>
                    </PermissionGate>
                  )}

                  {(activeVoucher.status === 'SUBMITTED' || activeVoucher.status === 'DRAFT') && (
                    <PermissionGate screen="STOCK_ADJUSTMENT" action="APPROVE">
                      <button
                        onClick={() => approveMutation.mutate(activeVoucher.adjustmentId)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Approve & Post</span>
                      </button>
                    </PermissionGate>
                  )}
                </div>
              </div>

              {/* Meta details */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 bg-white rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px]">WAREHOUSE</span>
                  <span className="font-semibold text-slate-800">
                    {activeVoucher.warehouseName} ({activeVoucher.warehouseCode})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">AUDIT TYPE</span>
                  <span className="font-medium text-slate-700">
                    {ADJUSTMENT_TYPE_LABELS[activeVoucher.adjustmentType]?.label || activeVoucher.adjustmentType}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">AUDIT DATE</span>
                  <span className="font-medium text-slate-700">
                    {formatDate(activeVoucher.adjustmentDate)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">AUDITOR / VERIFIER</span>
                  <span className="font-medium text-slate-700">
                    {activeVoucher.auditorName || 'Admin Verifier'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">APPROVER</span>
                  <span className="font-medium text-slate-700">
                    {activeVoucher.approverName || 'Pending Approval'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">APPROVAL DATE</span>
                  <span className="font-medium text-slate-700">
                    {formatDate(activeVoucher.approvalDate)}
                  </span>
                </div>
              </div>

              {/* Financial Valuation Summary Card */}
              <div className="grid grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 block text-[10px]">BOOK VALUATION</span>
                  <span className="text-sm font-bold text-slate-800">
                    {formatInr(activeVoucher.totalBookValue)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">PHYSICAL VALUATION</span>
                  <span className="text-sm font-bold text-slate-900">
                    {formatInr(activeVoucher.totalPhysicalValue)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px]">NET VARIANCE</span>
                  <span
                    className={`text-sm font-bold ${
                      activeVoucher.netVarianceValue >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {formatInr(activeVoucher.netVarianceValue)}
                  </span>
                </div>
              </div>

              {/* Line items list */}
              <div>
                <h4 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-blue-600" />
                  <span>Reconciled Line Items ({activeVoucher.items?.length || 0})</span>
                </h4>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2">ITEM</th>
                        <th className="p-2">BIN / BATCH</th>
                        <th className="p-2 text-right">BOOK</th>
                        <th className="p-2 text-right">PHYSICAL</th>
                        <th className="p-2 text-right">VARIANCE</th>
                        <th className="p-2 text-right">VAR VALUE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {activeVoucher.items?.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70">
                          <td className="p-2">
                            <div className="font-semibold text-slate-900">{it.itemCode}</div>
                            <div className="text-slate-500 text-[10px] truncate max-w-[150px]">
                              {it.itemName}
                            </div>
                          </td>
                          <td className="p-2">
                            <div>{it.binCode || 'Bin'}</div>
                            <div className="text-[10px] text-slate-400">{it.batchNo || '-'}</div>
                          </td>
                          <td className="p-2 text-right font-medium">{formatQty(it.bookQty)}</td>
                          <td className="p-2 text-right font-semibold text-slate-900">
                            {formatQty(it.physicalQty)}
                          </td>
                          <td className="p-2 text-right">
                            <span
                              className={`font-bold px-1.5 py-0.5 rounded ${
                                it.varianceQty > 0
                                  ? 'text-emerald-700 bg-emerald-50'
                                  : it.varianceQty < 0
                                  ? 'text-rose-700 bg-rose-50'
                                  : 'text-slate-500'
                              }`}
                            >
                              {it.varianceQty > 0 ? `+${it.varianceQty}` : it.varianceQty}
                            </span>
                          </td>
                          <td className="p-2 text-right font-semibold">
                            <span className={it.varianceValue >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                              {formatInr(it.varianceValue)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Remarks */}
              {activeVoucher.remarks && (
                <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-100 text-xs text-blue-900">
                  <strong className="block mb-0.5 text-blue-950 font-semibold">Auditor Notes:</strong>
                  {activeVoucher.remarks}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 6. Printable CARO 2020 Statutory Physical Stock Verification Certificate */}
      {/* ---------------------------------------------------------------------- */}
      {isPrintModalOpen && activeVoucher && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
            {/* Modal Actions Header */}
            <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-blue-600" />
                <span className="font-bold text-sm text-slate-800">
                  Statutory Physical Stock Audit & Verification Certificate
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Document</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Sheet */}
            <div className="p-8 overflow-y-auto flex-1 font-serif text-slate-900 space-y-6 print:p-0 print:overflow-visible">
              {/* Header Letterhead */}
              <div className="border-b-2 border-slate-900 pb-4 text-center">
                <h2 className="text-xl font-bold uppercase tracking-wide">
                  {currentCompany?.compName || 'KASHVIRA PRECISION MANUFACTURING LTD.'}
                </h2>
                <p className="text-xs text-slate-600 mt-1">
                  Plant & Branch: {currentBranch?.branchName || 'Ahmedabad Heavy Engineering Works'} | CIN: L29100GJ2024PLC091122
                </p>
                <p className="text-xs text-slate-500">
                  Registered Factory: Plot 42-44, GIDC Vatva Phase IV, Ahmedabad - 382445, Gujarat, India
                </p>
                <div className="mt-3 inline-block border border-slate-900 px-4 py-1 text-xs font-bold uppercase tracking-wider bg-slate-50">
                  Physical Inventory Verification & Variance Reconciliation Certificate
                </div>
                <div className="text-[10px] text-slate-500 mt-1 italic">
                  Pursuant to Companies (Auditor's Report) Order, 2020 (CARO) Clause 3(ii) & Ind AS 2 / AS-2 (Inventories)
                </div>
              </div>

              {/* Certificate Metadata */}
              <div className="grid grid-cols-2 gap-4 text-xs font-sans border border-slate-300 p-4 rounded bg-slate-50/50">
                <div>
                  <div>
                    <span className="font-semibold text-slate-600">Verification Voucher No:</span>{' '}
                    <strong className="text-slate-900">{activeVoucher.adjustmentNo}</strong>
                  </div>
                  <div className="mt-1">
                    <span className="font-semibold text-slate-600">Verification Date:</span>{' '}
                    {formatDate(activeVoucher.adjustmentDate)}
                  </div>
                  <div className="mt-1">
                    <span className="font-semibold text-slate-600">Audit Type / Scope:</span>{' '}
                    {ADJUSTMENT_TYPE_LABELS[activeVoucher.adjustmentType]?.label || activeVoucher.adjustmentType}
                  </div>
                </div>

                <div>
                  <div>
                    <span className="font-semibold text-slate-600">Warehouse Location:</span>{' '}
                    {activeVoucher.warehouseName} ({activeVoucher.warehouseCode})
                  </div>
                  <div className="mt-1">
                    <span className="font-semibold text-slate-600">Verifying Officer:</span>{' '}
                    {activeVoucher.auditorName || 'Designated Stock Auditor'}
                  </div>
                  <div className="mt-1">
                    <span className="font-semibold text-slate-600">Executive Approver:</span>{' '}
                    {activeVoucher.approverName || 'Plant Head / Manager'}
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-left border-collapse text-xs font-sans">
                  <thead className="bg-slate-100 text-slate-800 font-semibold border-b border-slate-300">
                    <tr>
                      <th className="p-2 border-r border-slate-300">#</th>
                      <th className="p-2 border-r border-slate-300">ITEM DETAILS</th>
                      <th className="p-2 border-r border-slate-300">BIN / BATCH</th>
                      <th className="p-2 border-r border-slate-300 text-right">BOOK QTY</th>
                      <th className="p-2 border-r border-slate-300 text-right">PHYSICAL QTY</th>
                      <th className="p-2 border-r border-slate-300 text-right">VARIANCE</th>
                      <th className="p-2 border-r border-slate-300 text-right">UNIT RATE (₹)</th>
                      <th className="p-2 text-right">VARIANCE (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {activeVoucher.items?.map((it, idx) => (
                      <tr key={idx} className="border-b border-slate-200">
                        <td className="p-2 border-r border-slate-200 text-slate-500 font-mono text-center">
                          {idx + 1}
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <div className="font-bold text-slate-900">{it.itemCode}</div>
                          <div className="text-[11px] text-slate-600">{it.itemName}</div>
                          {it.discrepancyReason && (
                            <div className="text-[10px] text-slate-500 italic mt-0.5">
                              Reason: {it.discrepancyReason}
                            </div>
                          )}
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <div>{it.binCode || 'Bin'}</div>
                          <div className="text-[10px] text-slate-500">{it.batchNo || '-'}</div>
                        </td>
                        <td className="p-2 border-r border-slate-200 text-right font-mono">
                          {formatQty(it.bookQty)}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-right font-mono font-bold">
                          {formatQty(it.physicalQty)}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-right font-mono font-semibold">
                          {it.varianceQty > 0 ? `+${it.varianceQty}` : it.varianceQty}
                        </td>
                        <td className="p-2 border-r border-slate-200 text-right font-mono">
                          {it.unitCost.toFixed(2)}
                        </td>
                        <td className="p-2 text-right font-mono font-bold">
                          {formatInr(it.varianceValue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-400">
                    <tr>
                      <td colSpan={3} className="p-2 text-right border-r border-slate-300">
                        AUDIT FINANCIAL TOTALS:
                      </td>
                      <td className="p-2 text-right border-r border-slate-300 font-mono">
                        {formatInr(activeVoucher.totalBookValue)}
                      </td>
                      <td className="p-2 text-right border-r border-slate-300 font-mono">
                        {formatInr(activeVoucher.totalPhysicalValue)}
                      </td>
                      <td colSpan={2} className="p-2 text-right border-r border-slate-300">
                        NET VARIANCE:
                      </td>
                      <td className="p-2 text-right font-mono text-slate-900">
                        {formatInr(activeVoucher.netVarianceValue)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Amount in Words */}
              <div className="text-xs border border-slate-200 p-3 rounded bg-slate-50 font-sans">
                <span className="font-semibold text-slate-700">Net Variance Financial Value in Words:</span>{' '}
                <strong className="text-slate-900">
                  {numberToWordsINR(activeVoucher.netVarianceValue)}
                </strong>
              </div>

              {/* Statutory Signatures */}
              <div className="pt-8 border-t border-slate-300 grid grid-cols-3 gap-6 text-center text-xs font-sans">
                <div>
                  <div className="h-14 flex items-end justify-center">
                    <span className="font-serif italic text-slate-600">
                      {activeVoucher.auditorName || 'Verified by Physical Count Officer'}
                    </span>
                  </div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
                    Store Officer / Stock Verifier
                  </div>
                  <div className="text-[10px] text-slate-500">Date: {formatDate(activeVoucher.adjustmentDate)}</div>
                </div>

                <div>
                  <div className="h-14 flex items-end justify-center">
                    <span className="font-serif italic text-slate-600">
                      {activeVoucher.approverName || 'Approved by Plant Manager'}
                    </span>
                  </div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
                    Plant Manager / HOD Operations
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Date: {formatDate(activeVoucher.approvalDate || activeVoucher.adjustmentDate)}
                  </div>
                </div>

                <div>
                  <div className="h-14 flex items-end justify-center">
                    <span className="font-serif italic text-slate-400">
                      [Official Audit Seal]
                    </span>
                  </div>
                  <div className="border-t border-slate-400 pt-1 font-semibold text-slate-800">
                    Statutory / Internal Auditor
                  </div>
                  <div className="text-[10px] text-slate-500">CARO 2020 Compliance Sign-off</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* 7. Reversible Cancellation Confirmation Modal */}
      {/* ---------------------------------------------------------------------- */}
      {isCancelModalOpen && selectedVoucher && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in duration-200">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Cancel Stock Adjustment Voucher?
                  </h3>
                  <p className="text-xs text-slate-500">
                    Voucher: <strong className="text-slate-800">{selectedVoucher.adjustmentNo}</strong>
                  </p>
                </div>
              </div>

              {selectedVoucher.status === 'POSTED' && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                  <strong className="block mb-1 text-amber-950 font-semibold">Important Reversal Notice:</strong>
                  This voucher is currently <strong>POSTED</strong>. Cancelling it will immediately post counter-balancing double-entry stock ledger transactions and restore previous book inventory quantities!
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reason for Cancellation <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Provide detailed justification for cancellation..."
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  className="w-full text-xs font-medium border border-slate-300 rounded-xl p-2.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCancelModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition"
                >
                  Keep Voucher
                </button>

                <button
                  type="button"
                  disabled={!cancellationReason.trim() || cancelMutation.isPending}
                  onClick={() =>
                    cancelMutation.mutate({
                      id: selectedVoucher.adjustmentId,
                      reason: cancellationReason,
                    })
                  }
                  className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-md shadow-rose-500/20 transition"
                >
                  Confirm Cancellation
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
