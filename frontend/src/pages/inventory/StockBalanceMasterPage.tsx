import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Building2,
  Calculator,
  Calendar,
  Check,
  CheckCircle2,
  Coins,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  History,
  Layers,
  Package,
  PackageCheck,
  PackageSearch,
  Printer,
  Scale,
  Search,
  Tag,
  Warehouse,
  X,
} from 'lucide-react';
import { apiClient, type ApiResponse } from '../../lib/apiClient';
import { useAuthStore } from '../../store/useAuthStore';
import {
  MasterDataTable,
  type MasterTableColumn,
  type GroupByOption,
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
  const integerPart = parseInt(parts[0], 10);
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

  let result = 'Rupees ' + words.trim();
  if (decimalPart > 0) {
    result += ' and ' + convertTwoDigits(decimalPart) + ' Paise';
  }
  return result + ' Only';
}

// ----------------------------------------------------------------------------
// Types & Interfaces
// ----------------------------------------------------------------------------
interface StockBalanceRow {
  binStockId: number;
  compId: number;
  branchId: number;
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  warehouseType: string;
  binId: number;
  binCode: string;
  binName: string;
  binType: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  hsnCode?: string;
  safetyStock: number;
  itemStandardCost: number;
  uomId: number;
  uomCode: string;
  uomName: string;
  batchNo?: string;
  heatNo?: string;
  onHandQty: number;
  reservedQty: number;
  availableQty: number;
  unitCost: number;
  totalValuation: number;
  lastStockDate?: string;
  isLowStock: boolean;
  isOutOfStock: boolean;
}

interface StockSummary {
  totalValuation: number;
  totalLines: number;
  totalOnHandUnits: number;
  totalAvailableUnits: number;
  totalReservedUnits: number;
  lowStockCount: number;
  outOfStockCount: number;
  valuationByWarehouse: {
    warehouseId: number;
    warehouseCode: string;
    warehouseName: string;
    warehouseType: string;
    lineCount: number;
    totalValuation: number;
  }[];
  valuationByCategory: {
    itemType: string;
    lineCount: number;
    totalValuation: number;
  }[];
}

interface StockLookups {
  warehouses: {
    warehouseId: number;
    warehouseCode: string;
    warehouseName: string;
    warehouseType: string;
  }[];
  bins: {
    binId: number;
    warehouseId: number;
    binCode: string;
    binName: string;
    binType: string;
  }[];
  itemTypes: string[];
  uoms: {
    uomId: number;
    uomCode: string;
    uomName: string;
  }[];
}

interface LedgerMovement {
  ledgerId: number;
  transactionDate: string;
  transactionType: string;
  referenceDocType: string;
  referenceDocId: number;
  referenceDocNo: string;
  warehouseName: string;
  fromBinCode?: string;
  toBinCode?: string;
  batchNo?: string;
  heatNo?: string;
  qtyIn: number;
  qtyOut: number;
  unitCost: number;
  totalCost: number;
  closingBalance: number;
  remarks?: string;
  createdByUser?: string;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------
export const StockBalanceMasterPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { activeContext } = useAuthStore();

  // Filters state
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState<
    'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'RESERVED'
  >('ALL');

  // Modals & Drawers state
  const [selectedStock, setSelectedStock] = useState<StockBalanceRow | null>(null);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [isRevalueModalOpen, setIsRevalueModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Revaluation Form State
  const [newUnitCost, setNewUnitCost] = useState<number>(0);
  const [revaluationReason, setRevaluationReason] = useState<string>('');
  const [updateItemStandardCost, setUpdateItemStandardCost] = useState(false);

  // ----------------------------------------------------------------------------
  // Queries
  // ----------------------------------------------------------------------------
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery<ApiResponse<StockSummary>>({
    queryKey: ['stock-balance-summary', activeContext?.compId, activeContext?.branchId],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<StockSummary>>('/inventory/balance/summary');
      return res.data;
    },
  });

  const { data: lookupsData } = useQuery<ApiResponse<StockLookups>>({
    queryKey: ['stock-balance-lookups', activeContext?.compId, activeContext?.branchId],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<StockLookups>>('/inventory/balance/lookups');
      return res.data;
    },
  });

  const { data: balancesData, isLoading: isBalancesLoading } = useQuery<
    ApiResponse<{ data: StockBalanceRow[]; meta: { total: number } }>
  >({
    queryKey: [
      'stock-balances-list',
      activeContext?.compId,
      activeContext?.branchId,
      warehouseFilter,
      categoryFilter,
      stockStatusFilter,
    ],
    queryFn: async () => {
      const params: Record<string, any> = { limit: 100 };
      if (warehouseFilter !== 'ALL') params.warehouseId = Number(warehouseFilter);
      if (categoryFilter !== 'ALL') params.itemType = categoryFilter;
      if (stockStatusFilter !== 'ALL') params.stockStatus = stockStatusFilter;
      const res = await apiClient.get<
        ApiResponse<{ data: StockBalanceRow[]; meta: { total: number } }>
      >('/inventory/balance', { params });
      return res.data;
    },
  });

  // Query Ledger Movements for Drill-down
  const { data: ledgerDrilldownData, isLoading: isLedgerLoading } = useQuery<
    ApiResponse<{ stockInfo: any; ledgerEntries: LedgerMovement[] }>
  >({
    queryKey: ['stock-ledger-drilldown', selectedStock?.binStockId],
    queryFn: async () => {
      if (!selectedStock) return { success: true, data: { stockInfo: null, ledgerEntries: [] } };
      const res = await apiClient.get<
        ApiResponse<{ stockInfo: any; ledgerEntries: LedgerMovement[] }>
      >(`/inventory/balance/${selectedStock.binStockId}/ledger`);
      return res.data;
    },
    enabled: !!selectedStock && isLedgerModalOpen,
  });

  // ----------------------------------------------------------------------------
  // Mutation: Revaluation
  // ----------------------------------------------------------------------------
  const revalueMutation = useMutation({
    mutationFn: (payload: {
      binStockId: number;
      newUnitCost: number;
      revaluationReason: string;
      updateItemStandardCost: boolean;
    }) =>
      apiClient.post(`/inventory/balance/${payload.binStockId}/revalue`, {
        newUnitCost: payload.newUnitCost,
        revaluationReason: payload.revaluationReason,
        updateItemStandardCost: payload.updateItemStandardCost,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-balances-list'] });
      queryClient.invalidateQueries({ queryKey: ['stock-balance-summary'] });
      setIsRevalueModalOpen(false);
      setSelectedStock(null);
    },
  });

  const handleOpenDetails = (row: StockBalanceRow) => {
    setSelectedStock(row);
    setIsDetailsDrawerOpen(true);
  };

  const handleOpenLedger = (row: StockBalanceRow) => {
    setSelectedStock(row);
    setIsLedgerModalOpen(true);
  };

  const handleOpenRevalue = (row: StockBalanceRow) => {
    setSelectedStock(row);
    setNewUnitCost(row.unitCost);
    setRevaluationReason('Periodic FIFO revaluation / standard cost alignment per Ind AS 2');
    setUpdateItemStandardCost(false);
    setIsRevalueModalOpen(true);
  };

  const handleConfirmRevalue = () => {
    if (!selectedStock) return;
    revalueMutation.mutate({
      binStockId: selectedStock.binStockId,
      newUnitCost,
      revaluationReason,
      updateItemStandardCost,
    });
  };

  const summary = summaryData?.data || {
    totalValuation: 0,
    totalLines: 0,
    totalOnHandUnits: 0,
    totalAvailableUnits: 0,
    totalReservedUnits: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    valuationByWarehouse: [],
    valuationByCategory: [],
  };

  const stockRows = balancesData?.data?.data || [];

  // ----------------------------------------------------------------------------
  // Table Columns Definition
  // ----------------------------------------------------------------------------
  const columns: MasterTableColumn<StockBalanceRow>[] = useMemo(
    () => [
      {
        key: 'itemCode',
        header: 'Item & Category',
        sortable: true,
        render: (row) => {
          const categoryColors: Record<string, string> = {
            RAW_MATERIAL: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
            WIP_SEMI_FINISHED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
            FINISHED_GOODS: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
            CONSUMABLE_MRO: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
            TOOLING_DIE: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
          };
          return (
            <div>
              <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                {row.itemCode}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-300 line-clamp-1" title={row.itemName}>
                {row.itemName}
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <span
                  className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-semibold ${
                    categoryColors[row.itemType] || 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {row.itemType.replace('_', ' ')}
                </span>
                {row.hsnCode && (
                  <span className="text-[10px] text-gray-400 font-mono">HSN: {row.hsnCode}</span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        key: 'warehouseName',
        header: 'Location & Bin',
        sortable: true,
        render: (row) => (
          <div>
            <div className="text-xs font-medium text-gray-800 dark:text-gray-200 flex items-center gap-1">
              <Warehouse className="w-3 h-3 text-gray-400" />
              {row.warehouseName}
            </div>
            <div className="text-xs text-indigo-600 dark:text-indigo-400 font-mono font-semibold flex items-center gap-1">
              <Layers className="w-2.5 h-2.5" />
              {row.binCode}
            </div>
            <div className="text-[10px] text-gray-400">{row.binType.replace('_', ' ')}</div>
          </div>
        ),
      },
      {
        key: 'batchNo',
        header: 'Batch / Heat No',
        sortable: true,
        render: (row) => (
          <div className="text-xs">
            {row.batchNo ? (
              <div className="font-mono font-medium text-gray-800 dark:text-gray-200">
                {row.batchNo}
              </div>
            ) : (
              <span className="text-gray-400 italic">No Batch</span>
            )}
            {row.heatNo && (
              <div className="text-[10px] text-gray-500 font-mono">Heat: {row.heatNo}</div>
            )}
          </div>
        ),
      },
      {
        key: 'onHandQty',
        header: 'Stock Quantities',
        sortable: true,
        render: (row) => (
          <div className="text-right">
            <div className="font-semibold text-gray-900 dark:text-gray-100 text-xs">
              {formatQty(row.onHandQty)} {row.uomCode}
            </div>
            <div className="text-[11px] text-gray-500">
              Avail:{' '}
              <span
                className={`font-semibold ${
                  row.isOutOfStock
                    ? 'text-rose-600'
                    : row.isLowStock
                    ? 'text-amber-600'
                    : 'text-emerald-600'
                }`}
              >
                {formatQty(row.availableQty)}
              </span>{' '}
              {row.reservedQty > 0 && (
                <span className="text-indigo-600 font-medium">
                  | Res: {formatQty(row.reservedQty)}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'unitCost',
        header: 'Unit Cost',
        sortable: true,
        render: (row) => (
          <div className="text-right text-xs">
            <div className="font-medium text-gray-800 dark:text-gray-200">
              {formatInr(row.unitCost)}
            </div>
            <div className="text-[10px] text-gray-400">per {row.uomCode}</div>
          </div>
        ),
      },
      {
        key: 'totalValuation',
        header: 'Total Valuation',
        sortable: true,
        render: (row) => (
          <div className="text-right">
            <div className="font-bold text-gray-900 dark:text-gray-100 text-xs">
              {formatInr(row.totalValuation)}
            </div>
            <div className="text-[10px] text-gray-400">FIFO Basis</div>
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Stock Health',
        render: (row) => {
          if (row.isOutOfStock) {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300">
                <AlertCircle className="w-3 h-3" /> OUT OF STOCK
              </span>
            );
          }
          if (row.isLowStock) {
            return (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                <AlertTriangle className="w-3 h-3" /> LOW STOCK (≤{row.safetyStock})
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              <Check className="w-3 h-3" /> HEALTHY
            </span>
          );
        },
      },
    ],
    [],
  );

  const groupByOptions: GroupByOption<StockBalanceRow>[] = [
    {
      key: 'warehouseName',
      label: 'Group by Warehouse',
      groupValue: (row) => row.warehouseName,
    },
    {
      key: 'itemType',
      label: 'Group by Item Category',
      groupValue: (row) => row.itemType.replace('_', ' '),
    },
    {
      key: 'binCode',
      label: 'Group by Storage Bin',
      groupValue: (row) => `${row.warehouseCode} - Bin ${row.binCode}`,
    },
  ];

  const searchPredicate = (row: StockBalanceRow, query: string) => {
    const q = query.toLowerCase();
    return (
      row.itemCode.toLowerCase().includes(q) ||
      row.itemName.toLowerCase().includes(q) ||
      row.warehouseName.toLowerCase().includes(q) ||
      row.binCode.toLowerCase().includes(q) ||
      (row.batchNo && row.batchNo.toLowerCase().includes(q)) ||
      (row.heatNo && row.heatNo.toLowerCase().includes(q)) ||
      false
    );
  };

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------------------- */}
      {/* Executive KPI Summary Cards */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Valuation */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500 tracking-wider">
              Total Valuation
            </span>
            <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg text-emerald-600 dark:text-emerald-400">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">
            {isSummaryLoading ? '...' : formatInr(summary.totalValuation)}
          </div>
          <div className="mt-1 text-xs text-gray-500 flex items-center gap-1">
            <span className="text-emerald-600 font-semibold">Ind AS 2</span> FIFO Cost Basis
          </div>
        </div>

        {/* Active Stock Records */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500 tracking-wider">
              Stock Lines
            </span>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
              <PackageSearch className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">
            {isSummaryLoading ? '...' : summary.totalLines}
          </div>
          <div className="mt-1 text-xs text-gray-500">
            Across {summary.valuationByWarehouse.length} Warehouses
          </div>
        </div>

        {/* Available Units */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500 tracking-wider">
              Available Units
            </span>
            <div className="p-2 bg-teal-50 dark:bg-teal-950/50 rounded-lg text-teal-600 dark:text-teal-400">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">
            {isSummaryLoading ? '...' : formatQty(summary.totalAvailableUnits)}
          </div>
          <div className="mt-1 text-xs text-teal-600 font-medium">Free for Shopfloor & Sales</div>
        </div>

        {/* Reserved Allocation */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500 tracking-wider">
              Reserved Units
            </span>
            <div className="p-2 bg-blue-50 dark:bg-blue-950/50 rounded-lg text-blue-600 dark:text-blue-400">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-gray-900 dark:text-gray-100">
            {isSummaryLoading ? '...' : formatQty(summary.totalReservedUnits)}
          </div>
          <div className="mt-1 text-xs text-blue-600 font-medium">Locked for SO / WO</div>
        </div>

        {/* Low Stock / Reorder Alerts */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase text-gray-500 tracking-wider">
              Low Stock Warnings
            </span>
            <div className="p-2 bg-amber-50 dark:bg-amber-950/50 rounded-lg text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 text-xl font-bold text-amber-600">
            {isSummaryLoading ? '...' : summary.lowStockCount}
          </div>
          <div className="mt-1 text-xs text-amber-600 font-medium">Below Minimum Safety Buffer</div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* Category & Warehouse Valuation Strips */}
      {/* ---------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Warehouse Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 flex items-center gap-1.5 mb-3">
            <Warehouse className="w-4 h-4 text-indigo-600" />
            Valuation by Warehouse
          </h3>
          <div className="space-y-2">
            {summary.valuationByWarehouse.map((w) => (
              <div key={w.warehouseId} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate max-w-[280px]">
                  <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                    {w.warehouseName}
                  </span>
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-1 rounded">
                    {w.lineCount} lines
                  </span>
                </div>
                <div className="font-mono font-bold text-gray-900 dark:text-gray-100">
                  {formatInr(w.totalValuation)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-gray-300 flex items-center gap-1.5 mb-3">
            <Tag className="w-4 h-4 text-purple-600" />
            Valuation by Item Category
          </h3>
          <div className="space-y-2">
            {summary.valuationByCategory.map((c) => (
              <div key={c.itemType} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {c.itemType.replace('_', ' ')}
                  </span>
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-1 rounded">
                    {c.lineCount} lines
                  </span>
                </div>
                <div className="font-mono font-bold text-gray-900 dark:text-gray-100">
                  {formatInr(c.totalValuation)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------------------------- */}
      {/* Master Data Table */}
      {/* ---------------------------------------------------------------------- */}
      <MasterDataTable
        title="Stock Balance & Valuation Register"
        subtitle="Real-time multi-bin perpetual inventory balances, Available-to-Promise calculations, and FIFO valuation"
        screenCode="STOCK_BALANCE"
        data={stockRows}
        columns={columns}
        rowKey={(row) => row.binStockId}
        searchPlaceholder="Search by item code, name, batch, heat no, bin, or warehouse..."
        searchPredicate={searchPredicate}
        groupByOptions={groupByOptions}
        onPrintClick={() => setIsPrintModalOpen(true)}
        filterToolbarSlot={
          <div className="flex flex-wrap items-center gap-2">
            {/* Warehouse Filter */}
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-gray-200 font-medium"
            >
              <option value="ALL">All Warehouses</option>
              {lookupsData?.data?.warehouses.map((w) => (
                <option key={w.warehouseId} value={w.warehouseId}>
                  {w.warehouseName}
                </option>
              ))}
            </select>

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 text-gray-700 dark:text-gray-200 font-medium"
            >
              <option value="ALL">All Categories</option>
              {lookupsData?.data?.itemTypes.map((t) => (
                <option key={t} value={t}>
                  {t.replace('_', ' ')}
                </option>
              ))}
            </select>

            {/* Stock Status Pills */}
            <div className="inline-flex rounded-lg border border-gray-300 dark:border-gray-600 p-0.5 bg-gray-50 dark:bg-gray-800 text-xs">
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: 'IN_STOCK', label: 'In Stock' },
                  { id: 'LOW_STOCK', label: 'Low Stock' },
                  { id: 'OUT_OF_STOCK', label: 'Out of Stock' },
                  { id: 'RESERVED', label: 'Reserved' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStockStatusFilter(tab.id)}
                  className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                    stockStatusFilter === tab.id
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        }
        renderRowActions={(row) => (
          <div className="flex items-center gap-1">
            {/* View Details */}
            <button
              onClick={() => handleOpenDetails(row)}
              className="p-1 text-gray-500 hover:text-indigo-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              title="View Stock Details"
            >
              <Eye className="w-4 h-4" />
            </button>

            {/* Movement Ledger Drilldown */}
            <PermissionGate screen="STOCK_BALANCE" action="LEDGER_DRILLDOWN">
              <button
                onClick={() => handleOpenLedger(row)}
                className="p-1 text-gray-500 hover:text-purple-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                title="View Movement History & Stock Ledger"
              >
                <History className="w-4 h-4" />
              </button>
            </PermissionGate>

            {/* Revalue Standard Cost */}
            <PermissionGate screen="STOCK_BALANCE" action="REVALUE">
              <button
                onClick={() => handleOpenRevalue(row)}
                className="p-1 text-gray-500 hover:text-emerald-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                title="Recalculate Unit Cost / Valuation"
              >
                <Calculator className="w-4 h-4" />
              </button>
            </PermissionGate>
          </div>
        )}
      />

      {/* ---------------------------------------------------------------------- */}
      {/* Stock Details Drawer */}
      {/* ---------------------------------------------------------------------- */}
      {isDetailsDrawerOpen && selectedStock && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-lg bg-white dark:bg-gray-800 h-full shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b pb-4 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-indigo-600" />
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Stock Item Specification
                </h2>
              </div>
              <button
                onClick={() => setIsDetailsDrawerOpen(false)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Item Info Box */}
              <div className="bg-gray-50 dark:bg-gray-900/50 p-4 rounded-xl space-y-2 border border-gray-100 dark:border-gray-700">
                <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {selectedStock.itemCode}
                </div>
                <div className="text-gray-600 dark:text-gray-300 font-medium">
                  {selectedStock.itemName}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300">
                    {selectedStock.itemType.replace('_', ' ')}
                  </span>
                  {selectedStock.hsnCode && (
                    <span className="text-gray-500 font-mono">HSN: {selectedStock.hsnCode}</span>
                  )}
                  <span className="text-gray-500 font-mono">Base UOM: {selectedStock.uomCode}</span>
                </div>
              </div>

              {/* Physical Warehouse Location */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2">
                <div className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <Warehouse className="w-4 h-4 text-indigo-600" /> Storage Location
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400">Warehouse:</span>
                    <div className="font-medium text-gray-800 dark:text-gray-200">
                      {selectedStock.warehouseName} ({selectedStock.warehouseCode})
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Storage Bin:</span>
                    <div className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                      {selectedStock.binCode}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Bin Type:</span>
                    <div className="font-medium text-gray-700 dark:text-gray-300">
                      {selectedStock.binType.replace('_', ' ')}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Warehouse Type:</span>
                    <div className="font-medium text-gray-700 dark:text-gray-300">
                      {selectedStock.warehouseType.replace('_', ' ')}
                    </div>
                  </div>
                </div>
              </div>

              {/* Lot & Heat Traceability */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-2">
                <div className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <Tag className="w-4 h-4 text-purple-600" /> Lot & Heat Traceability
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div>
                    <span className="text-gray-400 font-sans">Batch / Lot No:</span>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                      {selectedStock.batchNo || 'N/A'}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400 font-sans">Melt Heat No:</span>
                    <div className="font-semibold text-gray-900 dark:text-gray-100">
                      {selectedStock.heatNo || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quantities & Safety Buffer */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
                <div className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-teal-600" /> Balances & Stock Buffers
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded-lg">
                    <div className="text-[10px] text-gray-500 uppercase">On Hand</div>
                    <div className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {formatQty(selectedStock.onHandQty)}
                    </div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/40 p-2 rounded-lg">
                    <div className="text-[10px] text-blue-600 uppercase">Reserved</div>
                    <div className="text-sm font-bold text-blue-700 dark:text-blue-300">
                      {formatQty(selectedStock.reservedQty)}
                    </div>
                  </div>
                  <div className="bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-lg">
                    <div className="text-[10px] text-emerald-600 uppercase">Available</div>
                    <div className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                      {formatQty(selectedStock.availableQty)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700 text-xs">
                  <span className="text-gray-500">Minimum Safety Stock Buffer:</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {formatQty(selectedStock.safetyStock)} {selectedStock.uomCode}
                  </span>
                </div>
              </div>

              {/* Valuation Details */}
              <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-4 space-y-2">
                <div className="font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-emerald-600" /> Ind AS 2 Inventory Valuation
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-600 dark:text-gray-400">Unit Standard Cost:</span>
                  <span className="font-mono font-semibold text-gray-900 dark:text-gray-100">
                    {formatInr(selectedStock.unitCost)} / {selectedStock.uomCode}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-emerald-200 dark:border-emerald-800">
                  <span className="text-emerald-900 dark:text-emerald-200">Total Line Valuation:</span>
                  <span className="text-emerald-700 dark:text-emerald-300 text-sm">
                    {formatInr(selectedStock.totalValuation)}
                  </span>
                </div>
                <div className="text-[10px] text-gray-400 text-right">
                  Last Activity: {formatDateTime(selectedStock.lastStockDate)}
                </div>
              </div>
            </div>

            {/* Drawer Actions */}
            <div className="pt-4 border-t dark:border-gray-700 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsDetailsDrawerOpen(false);
                  handleOpenLedger(selectedStock);
                }}
                className="flex-1 inline-flex justify-center items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold"
              >
                <History className="w-4 h-4" /> Movement Ledger
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsDetailsDrawerOpen(false);
                  handleOpenRevalue(selectedStock);
                }}
                className="flex-1 inline-flex justify-center items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold"
              >
                <Calculator className="w-4 h-4" /> Revalue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Movement Ledger Drilldown Modal */}
      {/* ---------------------------------------------------------------------- */}
      {isLedgerModalOpen && selectedStock && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-purple-600" />
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                    Stock Movement Ledger Drill-down
                  </h2>
                  <p className="text-xs text-gray-500 font-mono">
                    {selectedStock.itemCode} • {selectedStock.warehouseName} • Bin {selectedStock.binCode}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsLedgerModalOpen(false)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stock Snapshot Bar */}
            <div className="grid grid-cols-4 gap-2 bg-gray-50 dark:bg-gray-900 p-3 rounded-xl text-xs">
              <div>
                <span className="text-gray-400">On Hand Stock:</span>
                <div className="font-bold text-gray-900 dark:text-gray-100">
                  {formatQty(selectedStock.onHandQty)} {selectedStock.uomCode}
                </div>
              </div>
              <div>
                <span className="text-gray-400">Unit Cost:</span>
                <div className="font-bold text-gray-900 dark:text-gray-100 font-mono">
                  {formatInr(selectedStock.unitCost)}
                </div>
              </div>
              <div>
                <span className="text-gray-400">Total Valuation:</span>
                <div className="font-bold text-emerald-600 font-mono">
                  {formatInr(selectedStock.totalValuation)}
                </div>
              </div>
              <div>
                <span className="text-gray-400">Batch / Heat:</span>
                <div className="font-mono text-gray-700 dark:text-gray-300">
                  {selectedStock.batchNo || 'N/A'}
                </div>
              </div>
            </div>

            {/* Ledger Movements Table */}
            <div className="overflow-y-auto flex-1 border border-gray-200 dark:border-gray-700 rounded-xl">
              {isLedgerLoading ? (
                <div className="p-8 text-center text-xs text-gray-500">Loading ledger records...</div>
              ) : (ledgerDrilldownData?.data?.ledgerEntries || []).length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-500">
                  No movement ledger entries found for this specific item and bin.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-600 dark:text-gray-300 uppercase text-[10px] font-bold border-b border-gray-200 dark:border-gray-700 sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Date & Time</th>
                      <th className="px-3 py-2">Transaction Type</th>
                      <th className="px-3 py-2">Reference Doc</th>
                      <th className="px-3 py-2 text-right">Inward (+)</th>
                      <th className="px-3 py-2 text-right">Outward (-)</th>
                      <th className="px-3 py-2 text-right">Running Balance</th>
                      <th className="px-3 py-2 text-right">Unit Rate</th>
                      <th className="px-3 py-2">Remarks / User</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {ledgerDrilldownData?.data?.ledgerEntries.map((l) => (
                      <tr key={l.ledgerId} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                        <td className="px-3 py-2 text-gray-500 whitespace-nowrap">
                          {formatDateTime(l.transactionDate)}
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-800 dark:text-gray-200">
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-semibold">
                            {l.transactionType.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">
                          <div className="font-semibold text-indigo-600 dark:text-indigo-400">
                            {l.referenceDocNo}
                          </div>
                          <div className="text-[10px] text-gray-400">{l.referenceDocType}</div>
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-600">
                          {l.qtyIn > 0 ? `+${formatQty(l.qtyIn)}` : '-'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold text-rose-600">
                          {l.qtyOut > 0 ? `-${formatQty(l.qtyOut)}` : '-'}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 dark:text-gray-100">
                          {formatQty(l.closingBalance)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-gray-600 dark:text-gray-400">
                          {formatInr(l.unitCost)}
                        </td>
                        <td className="px-3 py-2 text-gray-500 text-[11px] max-w-[200px] truncate" title={l.remarks}>
                          <div>{l.remarks || '-'}</div>
                          {l.createdByUser && (
                            <div className="text-[10px] text-gray-400">By: {l.createdByUser}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsLedgerModalOpen(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Recalculate Valuation / Standard Cost Modal */}
      {/* ---------------------------------------------------------------------- */}
      {isRevalueModalOpen && selectedStock && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                  Recalculate Valuation & Cost
                </h2>
              </div>
              <button
                onClick={() => setIsRevalueModalOpen(false)}
                className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-xl space-y-1">
                <div className="font-bold text-gray-900 dark:text-gray-100">
                  {selectedStock.itemCode}
                </div>
                <div className="text-gray-500">{selectedStock.itemName}</div>
                <div className="text-gray-500">
                  Location: {selectedStock.warehouseName} • Bin {selectedStock.binCode}
                </div>
                <div className="text-gray-500">
                  On-Hand Quantity: <span className="font-semibold">{formatQty(selectedStock.onHandQty)} {selectedStock.uomCode}</span>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-1">
                  Current Unit Cost:
                </label>
                <div className="font-mono text-gray-500">
                  {formatInr(selectedStock.unitCost)} / {selectedStock.uomCode}
                </div>
              </div>

              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-1">
                  New Adjusted Unit Cost (₹): <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newUnitCost}
                  onChange={(e) => setNewUnitCost(Number(e.target.value))}
                  className="w-full text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 font-mono font-bold text-emerald-600 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Real-time Delta Preview */}
              <div className="bg-emerald-50/60 dark:bg-emerald-950/30 p-3 rounded-xl space-y-1 border border-emerald-100 dark:border-emerald-800">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Current Valuation:</span>
                  <span className="font-mono">{formatInr(selectedStock.totalValuation)}</span>
                </div>
                <div className="flex justify-between font-bold text-emerald-800 dark:text-emerald-300">
                  <span>New Revalued Total:</span>
                  <span className="font-mono">
                    {formatInr(selectedStock.onHandQty * newUnitCost)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] pt-1 border-t border-emerald-200 dark:border-emerald-800">
                  <span className="text-gray-500">Net Valuation Delta:</span>
                  <span
                    className={`font-mono font-bold ${
                      selectedStock.onHandQty * newUnitCost >= selectedStock.totalValuation
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {selectedStock.onHandQty * newUnitCost >= selectedStock.totalValuation ? '+' : ''}
                    {formatInr(selectedStock.onHandQty * newUnitCost - selectedStock.totalValuation)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-gray-700 dark:text-gray-300 font-semibold mb-1">
                  Revaluation Justification / Reason: <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={2}
                  value={revaluationReason}
                  onChange={(e) => setRevaluationReason(e.target.value)}
                  placeholder="e.g., Monthly absorption standard cost update or lower of cost/NRV adjustment"
                  className="w-full text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-2.5 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chkUpdateStandardCost"
                  checked={updateItemStandardCost}
                  onChange={(e) => setUpdateItemStandardCost(e.target.checked)}
                  className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <label
                  htmlFor="chkUpdateStandardCost"
                  className="text-gray-700 dark:text-gray-300 select-none cursor-pointer"
                >
                  Also synchronize Item Master (<code className="font-mono text-[11px]">tbl_inv_item.standard_cost</code>)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t dark:border-gray-700">
              <button
                type="button"
                onClick={() => setIsRevalueModalOpen(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-semibold hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRevalue}
                disabled={revalueMutation.isPending || !revaluationReason.trim()}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5"
              >
                {revalueMutation.isPending ? 'Processing...' : 'Apply Revaluation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------------------- */}
      {/* Official Ind AS 2 / AS-2 Printable Stock Valuation Certificate */}
      {/* ---------------------------------------------------------------------- */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full p-8 space-y-6 max-h-[95vh] overflow-y-auto print:m-0 print:p-0 print:shadow-none print:max-w-none">
            {/* Modal Controls (Hidden in Print) */}
            <div className="flex justify-between items-center border-b pb-4 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-gray-800">
                  Stock Valuation Certificate (Ind AS 2 / AS-2)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs"
                >
                  <Printer className="w-4 h-4" /> Print Certificate
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Official Certificate Layout */}
            <div className="border border-gray-300 rounded-xl p-6 space-y-6 print:border-none print:p-0">
              {/* Corporate Header */}
              <div className="border-b-2 border-gray-800 pb-4 text-center space-y-1">
                <h1 className="text-xl font-black tracking-tight text-gray-900 uppercase">
                  Kashvira Infotech Private Limited
                </h1>
                <p className="text-xs text-gray-600">
                  Main Manufacturing Plant: Plot 42, GIDC Industrial Estate, Sanand, Ahmedabad, Gujarat - 382110
                </p>
                <div className="flex justify-center items-center gap-4 text-xs font-mono text-gray-600 pt-1">
                  <span>CIN: U29100GJ2026PTC123456</span>
                  <span>GSTIN: 24AABCK1234F1Z5</span>
                  <span>PAN: AABCK1234F</span>
                </div>
              </div>

              {/* Certificate Title */}
              <div className="text-center space-y-1">
                <h2 className="text-sm font-bold uppercase tracking-wider bg-gray-100 py-1.5 rounded-lg border border-gray-200">
                  Official Inventory Valuation & Physical Stock Certificate
                </h2>
                <p className="text-[11px] text-gray-500">
                  Prepared in accordance with Indian Accounting Standard (Ind AS) 2 & AS-2: Valuation of Inventories
                </p>
                <div className="text-xs font-semibold text-gray-700 pt-1">
                  Certificate As Of Date: {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              </div>

              {/* Category Breakdown Sub-Table */}
              <div>
                <h4 className="text-xs font-bold uppercase text-gray-700 mb-1.5">
                  1. Inventory Category Valuation Summary
                </h4>
                <table className="w-full text-xs border border-gray-300">
                  <thead className="bg-gray-100 font-bold text-gray-700">
                    <tr>
                      <th className="border border-gray-300 px-3 py-1.5 text-left">Classification</th>
                      <th className="border border-gray-300 px-3 py-1.5 text-center">Active Lines</th>
                      <th className="border border-gray-300 px-3 py-1.5 text-right">Valuation (₹)</th>
                      <th className="border border-gray-300 px-3 py-1.5 text-right">% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.valuationByCategory.map((c) => (
                      <tr key={c.itemType}>
                        <td className="border border-gray-300 px-3 py-1.5 font-medium">
                          {c.itemType.replace('_', ' ')}
                        </td>
                        <td className="border border-gray-300 px-3 py-1.5 text-center font-mono">
                          {c.lineCount}
                        </td>
                        <td className="border border-gray-300 px-3 py-1.5 text-right font-mono font-semibold">
                          {formatInr(c.totalValuation)}
                        </td>
                        <td className="border border-gray-300 px-3 py-1.5 text-right font-mono text-gray-600">
                          {summary.totalValuation > 0
                            ? ((c.totalValuation / summary.totalValuation) * 100).toFixed(1) + '%'
                            : '0%'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-100 font-bold">
                      <td className="border border-gray-300 px-3 py-1.5">Total Inventory</td>
                      <td className="border border-gray-300 px-3 py-1.5 text-center font-mono">
                        {summary.totalLines}
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-right font-mono text-emerald-700">
                        {formatInr(summary.totalValuation)}
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-right font-mono">100.0%</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Itemized Inventory Schedule */}
              <div>
                <h4 className="text-xs font-bold uppercase text-gray-700 mb-1.5">
                  2. Detailed Inventory Schedule & Multi-Bin Balances
                </h4>
                <table className="w-full text-[11px] border border-gray-300">
                  <thead className="bg-gray-100 font-bold text-gray-700">
                    <tr>
                      <th className="border border-gray-300 px-2 py-1 text-center">#</th>
                      <th className="border border-gray-300 px-2 py-1 text-left">Item Code & Name</th>
                      <th className="border border-gray-300 px-2 py-1 text-left">Location / Bin</th>
                      <th className="border border-gray-300 px-2 py-1 text-left">Batch No</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">On Hand</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">Unit Cost</th>
                      <th className="border border-gray-300 px-2 py-1 text-right">Total Value (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockRows.map((r, idx) => (
                      <tr key={r.binStockId}>
                        <td className="border border-gray-300 px-2 py-1 text-center font-mono">
                          {idx + 1}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 font-medium">
                          <div className="font-semibold">{r.itemCode}</div>
                          <div className="text-[10px] text-gray-500 truncate max-w-[220px]">
                            {r.itemName}
                          </div>
                        </td>
                        <td className="border border-gray-300 px-2 py-1 font-mono text-[10px]">
                          {r.warehouseCode} / {r.binCode}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 font-mono text-[10px]">
                          {r.batchNo || '-'}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right font-mono">
                          {formatQty(r.onHandQty)} {r.uomCode}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right font-mono">
                          {formatInr(r.unitCost)}
                        </td>
                        <td className="border border-gray-300 px-2 py-1 text-right font-mono font-semibold">
                          {formatInr(r.totalValuation)}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-gray-100 font-bold">
                      <td colSpan={6} className="border border-gray-300 px-3 py-1.5 text-right uppercase">
                        Grand Total Inventory Valuation:
                      </td>
                      <td className="border border-gray-300 px-3 py-1.5 text-right font-mono text-emerald-700">
                        {formatInr(summary.totalValuation)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Total Amount in Words */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-xs">
                <span className="font-bold text-gray-700">Total Valuation in Words: </span>
                <span className="font-serif italic font-semibold text-gray-900">
                  {numberToWordsINR(summary.totalValuation)}
                </span>
              </div>

              {/* Statutory Declaration */}
              <div className="text-[10px] text-gray-500 space-y-1 border-t pt-3">
                <p>
                  <strong>Statutory Basis of Valuation:</strong> Inventories are valued at the lower of cost and net realizable value in accordance with Ind AS 2. Cost of raw materials and components is computed on a First-In, First-Out (FIFO) basis. Finished goods and work-in-progress include cost of direct materials, labor, and a proportion of manufacturing overheads based on normal operating capacity.
                </p>
                <p>
                  <strong>Physical Verification Certificate:</strong> We hereby certify that the physical verification of stocks listed above has been carried out by the authorized internal stock audit team and conforms to physical records without unrecorded discrepancies.
                </p>
              </div>

              {/* 3-Tier Signatory Block */}
              <div className="grid grid-cols-3 gap-6 pt-10 text-center text-xs">
                <div className="border-t border-gray-400 pt-2">
                  <div className="font-bold text-gray-900">Store Officer / Warehouse In-charge</div>
                  <div className="text-[10px] text-gray-500">Physical Stock Verification</div>
                </div>
                <div className="border-t border-gray-400 pt-2">
                  <div className="font-bold text-gray-900">Cost Accountant / Finance Head</div>
                  <div className="text-[10px] text-gray-500">Valuation & FIFO Audit Review</div>
                </div>
                <div className="border-t border-gray-400 pt-2">
                  <div className="font-bold text-gray-900">Plant Head / Authorized Signatory</div>
                  <div className="text-[10px] text-gray-500">Corporate Seal & Final Approval</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockBalanceMasterPage;
