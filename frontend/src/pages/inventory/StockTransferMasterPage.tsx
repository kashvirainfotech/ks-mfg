import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  Boxes,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Coins,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  MapPin,
  Package,
  PackageCheck,
  Plus,
  Printer,
  RefreshCw,
  Scale,
  Search,
  Send,
  Trash2,
  Truck,
  Warehouse,
  X,
  XCircle,
  Zap,
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
interface TransferItemRow {
  transferItemId?: number;
  itemSequence?: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  uomId: number;
  uomCode?: string;
  fromBinId: number;
  fromBinCode?: string;
  fromBinName?: string;
  toBinId: number;
  toBinCode?: string;
  toBinName?: string;
  batchNo?: string | null;
  heatNo?: string | null;
  availableQty: number;
  transferQty: number;
  receivedQty?: number;
  unitCost: number;
  lineTotal: number;
  remarks?: string | null;
}

interface TransferHeader {
  transferId: number;
  transferNo: string;
  transferDate: string;
  transferType: 'BIN_TO_BIN' | 'INTER_WAREHOUSE' | 'INTER_BRANCH_STO';
  fromWarehouseId: number;
  fromWarehouseName?: string;
  fromWarehouseCode?: string;
  toWarehouseId: number;
  toWarehouseName?: string;
  toWarehouseCode?: string;
  toBranchId: number;
  toBranchName?: string;
  toBranchCode?: string;
  transporterName?: string | null;
  vehicleNo?: string | null;
  lrNo?: string | null;
  lrDate?: string | null;
  ewayBillNo?: string | null;
  challanNo?: string | null;
  challanDate?: string | null;
  totalItems: number;
  totalTransferQty: number;
  totalTransferValue: number;
  status: 'DRAFT' | 'DISPATCHED' | 'RECEIVED' | 'CANCELLED';
  dispatchedBy?: number | null;
  dispatchedByName?: string | null;
  dispatchedAt?: string | null;
  receivedBy?: number | null;
  receivedByName?: string | null;
  receivedAt?: string | null;
  cancellationReason?: string | null;
  remarks?: string | null;
  createdDate?: string;
  items?: TransferItemRow[];
}

interface SummaryData {
  totalTransfers: number;
  draftCount: number;
  dispatchedCount: number;
  receivedCount: number;
  cancelledCount: number;
  totalTransferQty: number;
  totalTransferValue: number;
}

interface LookupsData {
  warehouses: Array<{
    warehouseId: number;
    warehouseCode: string;
    warehouseName: string;
    warehouseType: string;
    branchId: number;
  }>;
  storageBins: Array<{
    binId: number;
    warehouseId: number;
    binCode: string;
    binName: string;
    binType: string;
    isPickFace: boolean;
  }>;
  items: Array<{
    itemId: number;
    itemCode: string;
    itemName: string;
    baseUomId: number;
    standardCost: string;
    itemType: string;
  }>;
  uoms: Array<{
    uomId: number;
    uomCode: string;
    uomName: string;
  }>;
  branches: Array<{
    branchId: number;
    branchCode: string;
    branchName: string;
    gstin?: string;
  }>;
}

interface AvailableStockLine {
  binStockId: number;
  warehouseId: number;
  binId: number;
  binCode: string;
  binName: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  uomId: number;
  uomCode: string;
  batchNo?: string | null;
  heatNo?: string | null;
  onHandQty: number;
  reservedQty: number;
  availableQty: number;
  unitCost: number;
}

export const StockTransferMasterPage: React.FC = () => {
  const queryClient = useQueryClient();
  const activeContext = useAuthStore((s) => s.activeContext);
  const allowedCompanies = useAuthStore((s) => s.allowedCompanies);
  const allowedBranches = useAuthStore((s) => s.allowedBranches);
  const currentCompany = allowedCompanies.find((c) => c.compId === activeContext.compId);
  const currentBranch = allowedBranches.find((b) => b.branchId === activeContext.branchId);

  // Filters & State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [fromWarehouseFilter, setFromWarehouseFilter] = useState<string>('ALL');
  const [toWarehouseFilter, setToWarehouseFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingTransferId, setEditingTransferId] = useState<number | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferHeader | null>(null);
  const [isDispatchModalOpen, setIsDispatchModalOpen] = useState(false);
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isStockPickerOpen, setIsStockPickerOpen] = useState(false);

  // Form State for Create/Edit
  const [formDate, setFormDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [formType, setFormType] = useState<'BIN_TO_BIN' | 'INTER_WAREHOUSE' | 'INTER_BRANCH_STO'>('BIN_TO_BIN');
  const [formFromWh, setFormFromWh] = useState<number>(0);
  const [formToWh, setFormToWh] = useState<number>(0);
  const [formToBranch, setFormToBranch] = useState<number>(currentBranch?.branchId || 1001);
  const [formTransporter, setFormTransporter] = useState<string>('');
  const [formVehicleNo, setFormVehicleNo] = useState<string>('');
  const [formLrNo, setFormLrNo] = useState<string>('');
  const [formLrDate, setFormLrDate] = useState<string>('');
  const [formEwayBill, setFormEwayBill] = useState<string>('');
  const [formChallanNo, setFormChallanNo] = useState<string>('');
  const [formChallanDate, setFormChallanDate] = useState<string>('');
  const [formRemarks, setFormRemarks] = useState<string>('');
  const [formItems, setFormItems] = useState<TransferItemRow[]>([]);

  // Dispatch Form
  const [dispatchTransporter, setDispatchTransporter] = useState<string>('');
  const [dispatchVehicle, setDispatchVehicle] = useState<string>('');
  const [dispatchLrNo, setDispatchLrNo] = useState<string>('');
  const [dispatchLrDate, setDispatchLrDate] = useState<string>('');
  const [dispatchEwayBill, setDispatchEwayBill] = useState<string>('');
  const [dispatchChallanNo, setDispatchChallanNo] = useState<string>('');
  const [dispatchChallanDate, setDispatchChallanDate] = useState<string>('');
  const [dispatchRemarks, setDispatchRemarks] = useState<string>('');

  // Receive Form
  const [receiveItemOverrides, setReceiveItemOverrides] = useState<
    Array<{ transferItemId: number; receivedQty: number; toBinId: number }>
  >([]);
  const [receiveRemarks, setReceiveRemarks] = useState<string>('');

  // Cancel Form
  const [cancelReason, setCancelReason] = useState<string>('');

  // ----------------------------------------------------------------------------
  // Queries
  // ----------------------------------------------------------------------------
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery<SummaryData>({
    queryKey: ['stock-transfers', 'summary', currentCompany?.compId, currentBranch?.branchId],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<SummaryData>>('/inventory/transfers/summary');
      return res.data.data;
    },
  });

  const { data: lookupsData } = useQuery<LookupsData>({
    queryKey: ['stock-transfers', 'lookups', currentCompany?.compId],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<LookupsData>>('/inventory/transfers/lookups');
      return res.data.data;
    },
  });

  const { data: listResponse, isLoading: isListLoading } = useQuery<{
    data: TransferHeader[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }>({
    queryKey: [
      'stock-transfers',
      'list',
      statusFilter,
      typeFilter,
      fromWarehouseFilter,
      toWarehouseFilter,
      searchTerm,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (typeFilter !== 'ALL') params.append('transferType', typeFilter);
      if (fromWarehouseFilter !== 'ALL') params.append('fromWarehouseId', fromWarehouseFilter);
      if (toWarehouseFilter !== 'ALL') params.append('toWarehouseId', toWarehouseFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const res = await apiClient.get<ApiResponse<any>>(`/inventory/transfers?${params.toString()}`);
      return res.data.data;
    },
  });

  const { data: availableStockData, isFetching: isStockFetching } = useQuery<AvailableStockLine[]>({
    queryKey: ['stock-transfers', 'available-stock', formFromWh],
    queryFn: async () => {
      if (!formFromWh) return [];
      const res = await apiClient.get<ApiResponse<AvailableStockLine[]>>(
        `/inventory/transfers/available-stock?warehouseId=${formFromWh}`,
      );
      return res.data.data;
    },
    enabled: formFromWh > 0,
  });

  // Filter destination bins based on destination warehouse
  const destinationBins = useMemo(() => {
    if (!lookupsData?.storageBins || !formToWh) return [];
    return lookupsData.storageBins.filter((b) => b.warehouseId === formToWh);
  }, [lookupsData?.storageBins, formToWh]);

  // ----------------------------------------------------------------------------
  // Mutations
  // ----------------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post<ApiResponse<TransferHeader>>('/inventory/transfers', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      setIsCreateModalOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.put<ApiResponse<TransferHeader>>(`/inventory/transfers/${id}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      setIsCreateModalOpen(false);
      setEditingTransferId(null);
      resetForm();
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.post<ApiResponse<TransferHeader>>(
        `/inventory/transfers/${id}/dispatch`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      setIsDispatchModalOpen(false);
      if (selectedTransfer) {
        openDetailDrawer(selectedTransfer.transferId);
      }
    },
  });

  const receiveMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.post<ApiResponse<TransferHeader>>(
        `/inventory/transfers/${id}/receive`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      setIsReceiveModalOpen(false);
      if (selectedTransfer) {
        openDetailDrawer(selectedTransfer.transferId);
      }
    },
  });

  const directTransferMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.post<ApiResponse<TransferHeader>>(
        `/inventory/transfers/${id}/direct-transfer`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      if (selectedTransfer) {
        openDetailDrawer(selectedTransfer.transferId);
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await apiClient.post<ApiResponse<TransferHeader>>(
        `/inventory/transfers/${id}/cancel`,
        { reason },
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      setIsCancelModalOpen(false);
      setCancelReason('');
      if (selectedTransfer) {
        openDetailDrawer(selectedTransfer.transferId);
      }
    },
  });

  // ----------------------------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------------------------
  const resetForm = () => {
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormType('BIN_TO_BIN');
    setFormFromWh(lookupsData?.warehouses?.[0]?.warehouseId || 0);
    setFormToWh(lookupsData?.warehouses?.[0]?.warehouseId || 0);
    setFormToBranch(currentBranch?.branchId || 1001);
    setFormTransporter('');
    setFormVehicleNo('');
    setFormLrNo('');
    setFormLrDate('');
    setFormEwayBill('');
    setFormChallanNo('');
    setFormChallanDate('');
    setFormRemarks('');
    setFormItems([]);
    setEditingTransferId(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    if (lookupsData?.warehouses?.length) {
      setFormFromWh(lookupsData.warehouses[0].warehouseId);
      setFormToWh(lookupsData.warehouses[0].warehouseId);
    }
    setIsCreateModalOpen(true);
  };

  const handleOpenEditModal = async (transfer: TransferHeader) => {
    try {
      const res = await apiClient.get<ApiResponse<TransferHeader>>(`/inventory/transfers/${transfer.transferId}`);
      const full = res.data.data;
      setEditingTransferId(full.transferId);
      setFormDate(full.transferDate);
      setFormType(full.transferType);
      setFormFromWh(full.fromWarehouseId);
      setFormToWh(full.toWarehouseId);
      setFormToBranch(full.toBranchId);
      setFormTransporter(full.transporterName || '');
      setFormVehicleNo(full.vehicleNo || '');
      setFormLrNo(full.lrNo || '');
      setFormLrDate(full.lrDate || '');
      setFormEwayBill(full.ewayBillNo || '');
      setFormChallanNo(full.challanNo || '');
      setFormChallanDate(full.challanDate || '');
      setFormRemarks(full.remarks || '');
      setFormItems(
        (full.items || []).map((it) => ({
          transferItemId: it.transferItemId,
          itemSequence: it.itemSequence,
          itemId: it.itemId,
          itemCode: it.itemCode,
          itemName: it.itemName,
          uomId: it.uomId,
          uomCode: it.uomCode,
          fromBinId: it.fromBinId,
          toBinId: it.toBinId,
          batchNo: it.batchNo,
          heatNo: it.heatNo,
          availableQty: it.availableQty,
          transferQty: it.transferQty,
          receivedQty: it.receivedQty,
          unitCost: it.unitCost,
          lineTotal: it.lineTotal,
          remarks: it.remarks,
        })),
      );
      setIsCreateModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const openDetailDrawer = async (id: number) => {
    try {
      const res = await apiClient.get<ApiResponse<TransferHeader>>(`/inventory/transfers/${id}`);
      setSelectedTransfer(res.data.data);
      setIsDetailDrawerOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const openDispatchModal = (transfer: TransferHeader) => {
    setSelectedTransfer(transfer);
    setDispatchTransporter(transfer.transporterName || '');
    setDispatchVehicle(transfer.vehicleNo || '');
    setDispatchLrNo(transfer.lrNo || '');
    setDispatchLrDate(transfer.lrDate || '');
    setDispatchEwayBill(transfer.ewayBillNo || '');
    setDispatchChallanNo(transfer.challanNo || '');
    setDispatchChallanDate(transfer.challanDate || '');
    setDispatchRemarks(transfer.remarks || '');
    setIsDispatchModalOpen(true);
  };

  const openReceiveModal = async (transfer: TransferHeader) => {
    try {
      const res = await apiClient.get<ApiResponse<TransferHeader>>(`/inventory/transfers/${transfer.transferId}`);
      const full = res.data.data;
      setSelectedTransfer(full);
      setReceiveItemOverrides(
        (full.items || []).map((it) => ({
          transferItemId: it.transferItemId!,
          receivedQty: it.transferQty,
          toBinId: it.toBinId,
        })),
      );
      setReceiveRemarks(full.remarks || '');
      setIsReceiveModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const openPrintModal = async (transfer: TransferHeader) => {
    try {
      const res = await apiClient.get<ApiResponse<TransferHeader>>(`/inventory/transfers/${transfer.transferId}`);
      setSelectedTransfer(res.data.data);
      setIsPrintModalOpen(true);
    } catch (err) {
      console.error(err);
    }
  };

  const openCancelModal = (transfer: TransferHeader) => {
    setSelectedTransfer(transfer);
    setCancelReason('');
    setIsCancelModalOpen(true);
  };

  // Add Item from Active Bin Stock Picker
  const handleSelectStockLine = (stock: AvailableStockLine) => {
    const existing = formItems.find(
      (i) => i.itemId === stock.itemId && i.fromBinId === stock.binId && i.batchNo === stock.batchNo,
    );

    if (existing) return;

    // Pick first bin in destination warehouse as default target
    const defaultToBin = destinationBins[0]?.binId || stock.binId;

    const newItem: TransferItemRow = {
      itemId: stock.itemId,
      itemCode: stock.itemCode,
      itemName: stock.itemName,
      uomId: stock.uomId,
      uomCode: stock.uomCode,
      fromBinId: stock.binId,
      fromBinCode: stock.binCode,
      fromBinName: stock.binName,
      toBinId: defaultToBin,
      batchNo: stock.batchNo || null,
      heatNo: stock.heatNo || null,
      availableQty: stock.availableQty,
      transferQty: Math.min(1, stock.availableQty),
      unitCost: stock.unitCost,
      lineTotal: Math.min(1, stock.availableQty) * stock.unitCost,
      remarks: '',
    };

    setFormItems((prev) => [...prev, newItem]);
  };

  const handleUpdateItemQty = (idx: number, qty: number) => {
    setFormItems((prev) => {
      const copy = [...prev];
      const it = { ...copy[idx] };
      const safeQty = Math.max(0.001, Math.min(qty, it.availableQty));
      it.transferQty = safeQty;
      it.lineTotal = Number((safeQty * it.unitCost).toFixed(2));
      copy[idx] = it;
      return copy;
    });
  };

  const handleUpdateItemToBin = (idx: number, binId: number) => {
    setFormItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], toBinId: binId };
      return copy;
    });
  };

  const handleRemoveItem = (idx: number) => {
    setFormItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();

    if (formItems.length === 0) {
      alert('Please add at least one item line to transfer');
      return;
    }

    if (formType === 'INTER_WAREHOUSE' && formFromWh === formToWh) {
      alert('Source and destination warehouse cannot be identical for Inter-Warehouse transfer');
      return;
    }

    const payload = {
      transferDate: formDate,
      transferType: formType,
      fromWarehouseId: formFromWh,
      toWarehouseId: formToWh,
      toBranchId: formType === 'INTER_BRANCH_STO' ? formToBranch : currentBranch?.branchId,
      transporterName: formTransporter || undefined,
      vehicleNo: formVehicleNo || undefined,
      lrNo: formLrNo || undefined,
      lrDate: formLrDate || undefined,
      ewayBillNo: formEwayBill || undefined,
      challanNo: formChallanNo || undefined,
      challanDate: formChallanDate || undefined,
      remarks: formRemarks || undefined,
      items: formItems.map((i) => ({
        itemId: i.itemId,
        itemCode: i.itemCode,
        itemName: i.itemName,
        uomId: i.uomId,
        fromBinId: i.fromBinId,
        toBinId: i.toBinId,
        batchNo: i.batchNo || undefined,
        heatNo: i.heatNo || undefined,
        availableQty: i.availableQty,
        transferQty: i.transferQty,
        unitCost: i.unitCost,
        remarks: i.remarks || undefined,
      })),
    };

    if (editingTransferId) {
      updateMutation.mutate({ id: editingTransferId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // ----------------------------------------------------------------------------
  // Table Columns Definition
  // ----------------------------------------------------------------------------
  const columns: MasterTableColumn<TransferHeader>[] = [
    {
      key: 'transferNo',
      header: 'Transfer Details',
      sortable: true,
      sortValue: (row: TransferHeader) => row.transferNo,
      render: (row: TransferHeader) => {
        let typeBadgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
        let typeLabel = 'Bin to Bin';
        if (row.transferType === 'INTER_WAREHOUSE') {
          typeBadgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
          typeLabel = 'Inter-Warehouse';
        } else if (row.transferType === 'INTER_BRANCH_STO') {
          typeBadgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
          typeLabel = 'Branch STO';
        }

        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900">{row.transferNo}</span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${typeBadgeColor}`}>
                {typeLabel}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{formatDate(row.transferDate)}</span>
              {row.challanNo && (
                <span className="text-slate-400">| Challan: {row.challanNo}</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: 'fromWarehouseName',
      header: 'From Location',
      sortable: true,
      sortValue: (row: TransferHeader) => row.fromWarehouseName || '',
      render: (row: TransferHeader) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-slate-800 font-medium text-sm">
            <Warehouse className="w-3.5 h-3.5 text-indigo-500" />
            <span className="truncate max-w-[180px]">{row.fromWarehouseName || 'Source WH'}</span>
          </div>
          <span className="text-xs text-slate-400 font-mono">[{row.fromWarehouseCode}]</span>
        </div>
      ),
    },
    {
      key: 'toWarehouseName',
      header: 'To Location',
      sortable: true,
      sortValue: (row: TransferHeader) => row.toWarehouseName || '',
      render: (row: TransferHeader) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-slate-800 font-medium text-sm">
            <MapPin className="w-3.5 h-3.5 text-emerald-500" />
            <span className="truncate max-w-[180px]">{row.toWarehouseName || 'Destination WH'}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <span className="font-mono">[{row.toWarehouseCode}]</span>
            {row.transferType === 'INTER_BRANCH_STO' && row.toBranchName && (
              <span className="text-amber-700 font-medium truncate max-w-[140px]">
                • {row.toBranchName}
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'totalTransferQty',
      header: 'Quantity & Lines',
      align: 'right',
      sortable: true,
      sortValue: (row: TransferHeader) => row.totalTransferQty,
      render: (row: TransferHeader) => (
        <div className="text-right space-y-0.5">
          <div className="font-semibold text-slate-900">
            {formatQty(row.totalTransferQty)} Units
          </div>
          <span className="text-xs text-slate-500">
            {row.totalItems} {row.totalItems === 1 ? 'item' : 'items'}
          </span>
        </div>
      ),
    },
    {
      key: 'totalTransferValue',
      header: 'Transfer Value',
      align: 'right',
      sortable: true,
      sortValue: (row: TransferHeader) => row.totalTransferValue,
      render: (row: TransferHeader) => (
        <div className="text-right font-medium text-slate-900">
          {formatInr(row.totalTransferValue)}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (row: TransferHeader) => row.status,
      render: (row: TransferHeader) => {
        let badge = 'bg-slate-100 text-slate-700 border-slate-200';
        let icon = <ClockIcon className="w-3.5 h-3.5" />;
        let text: string = row.status;

        if (row.status === 'DISPATCHED') {
          badge = 'bg-blue-50 text-blue-700 border-blue-200';
          icon = <Truck className="w-3.5 h-3.5 text-blue-600" />;
          text = 'In-Transit';
        } else if (row.status === 'RECEIVED') {
          badge = 'bg-emerald-50 text-emerald-700 border-emerald-200';
          icon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
          text = 'Received';
        } else if (row.status === 'CANCELLED') {
          badge = 'bg-rose-50 text-rose-700 border-rose-200';
          icon = <XCircle className="w-3.5 h-3.5 text-rose-600" />;
          text = 'Cancelled';
        }

        return (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badge}`}>
            {icon}
            {text}
          </span>
        );
      },
    },
    {
      key: 'transferId',
      header: 'Actions',
      align: 'center',
      render: (row: TransferHeader) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => openDetailDrawer(row.transferId)}
            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </button>

          {row.status === 'DRAFT' && (
            <PermissionGate screen="STOCK_TRANSFER" action="EDIT">
              <button
                onClick={() => handleOpenEditModal(row)}
                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                title="Edit Transfer"
              >
                <FileText className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {row.status === 'DRAFT' && (
            <PermissionGate screen="STOCK_TRANSFER" action="DISPATCH">
              {row.transferType === 'BIN_TO_BIN' ? (
                <button
                  onClick={() => directTransferMutation.mutate(row.transferId)}
                  className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                  title="Direct 1-Click Bin Transfer"
                >
                  <Zap className="w-4 h-4 text-emerald-600" />
                </button>
              ) : (
                <button
                  onClick={() => openDispatchModal(row)}
                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                  title="Dispatch Material"
                >
                  <Truck className="w-4 h-4 text-blue-600" />
                </button>
              )}
            </PermissionGate>
          )}

          {row.status === 'DISPATCHED' && (
            <PermissionGate screen="STOCK_TRANSFER" action="RECEIVE">
              <button
                onClick={() => openReceiveModal(row)}
                className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                title="Receive Material at Destination"
              >
                <PackageCheck className="w-4 h-4 text-emerald-600" />
              </button>
            </PermissionGate>
          )}

          <PermissionGate screen="STOCK_TRANSFER" action="PRINT">
            <button
              onClick={() => openPrintModal(row)}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
              title="Print Delivery Challan / Transfer Note"
            >
              <Printer className="w-4 h-4" />
            </button>
          </PermissionGate>

          {row.status !== 'CANCELLED' && (
            <PermissionGate screen="STOCK_TRANSFER" action="CANCEL">
              <button
                onClick={() => openCancelModal(row)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                title="Cancel Transfer Voucher"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}
        </div>
      ),
    },
  ];

  function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
      <svg
        {...props}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <circle cx="12" cy="12" r="10" strokeWidth="2" />
        <polyline points="12 6 12 12 16 14" strokeWidth="2" />
      </svg>
    );
  }

  // ----------------------------------------------------------------------------
  // Render Main Page
  // ----------------------------------------------------------------------------
  return (
    <div className="space-y-6 p-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Warehouse Stock Transfers & Inter-Branch STO
              </h1>
              <p className="text-sm text-slate-500">
                Bin-to-bin movements, inter-warehouse staging, and GST Rule 55 inter-branch stock transfers
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <PermissionGate screen="STOCK_TRANSFER" action="EXPORT">
            <button
              onClick={() => alert('Exporting Stock Transfers Register to Excel / CSV...')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
            >
              <Download className="w-4 h-4 text-slate-500" />
              Export
            </button>
          </PermissionGate>

          <PermissionGate screen="STOCK_TRANSFER" action="ADD">
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              New Stock Transfer
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <ArrowLeftRight className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Transfers
            </span>
            <div className="text-2xl font-bold text-slate-900 mt-0.5">
              {isSummaryLoading ? '...' : summaryData?.totalTransfers ?? 0}
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {summaryData?.draftCount ?? 0} Draft | {summaryData?.cancelledCount ?? 0} Voided
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              In-Transit (Dispatched)
            </span>
            <div className="text-2xl font-bold text-amber-700 mt-0.5">
              {isSummaryLoading ? '...' : summaryData?.dispatchedCount ?? 0}
            </div>
            <div className="text-xs text-amber-600 mt-0.5">
              Awaiting destination receipt
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Completed Receipts
            </span>
            <div className="text-2xl font-bold text-emerald-700 mt-0.5">
              {isSummaryLoading ? '...' : summaryData?.receivedCount ?? 0}
            </div>
            <div className="text-xs text-emerald-600 mt-0.5">
              Put away & ledger accreted
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Transferred Valuation
            </span>
            <div className="text-2xl font-bold text-purple-700 mt-0.5">
              {isSummaryLoading ? '...' : formatInr(summaryData?.totalTransferValue ?? 0)}
            </div>
            <div className="text-xs text-purple-600 mt-0.5">
              {formatQty(summaryData?.totalTransferQty ?? 0)} Total Units
            </div>
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-1 focus:ring-indigo-500 outline-none text-xs"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="DISPATCHED">In-Transit (Dispatched)</option>
              <option value="RECEIVED">Received</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <span>Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-1 focus:ring-indigo-500 outline-none text-xs"
            >
              <option value="ALL">All Transfer Types</option>
              <option value="BIN_TO_BIN">Bin-to-Bin (Same WH)</option>
              <option value="INTER_WAREHOUSE">Inter-Warehouse</option>
              <option value="INTER_BRANCH_STO">Inter-Branch STO</option>
            </select>
          </div>

          {/* Source WH Filter */}
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <span>From:</span>
            <select
              value={fromWarehouseFilter}
              onChange={(e) => setFromWarehouseFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-1 focus:ring-indigo-500 outline-none text-xs max-w-[150px] truncate"
            >
              <option value="ALL">All Source Warehouses</option>
              {lookupsData?.warehouses?.map((wh) => (
                <option key={wh.warehouseId} value={wh.warehouseId}>
                  {wh.warehouseName} ({wh.warehouseCode})
                </option>
              ))}
            </select>
          </div>

          {/* Destination WH Filter */}
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
            <span>To:</span>
            <select
              value={toWarehouseFilter}
              onChange={(e) => setToWarehouseFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:ring-1 focus:ring-indigo-500 outline-none text-xs max-w-[150px] truncate"
            >
              <option value="ALL">All Destination Warehouses</option>
              {lookupsData?.warehouses?.map((wh) => (
                <option key={wh.warehouseId} value={wh.warehouseId}>
                  {wh.warehouseName} ({wh.warehouseCode})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Free text search */}
        <div className="relative min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search transfer, vehicle, lr..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* Main Data Table */}
      <MasterDataTable<TransferHeader>
        title="Stock Transfers & STO Register"
        subtitle="Chronological log of internal relocations and inter-branch movements"
        screenCode="STOCK_TRANSFER"
        data={listResponse?.data || []}
        columns={columns}
        rowKey={(row) => row.transferId}
        isLoading={isListLoading}
        searchPlaceholder="Filter transfers in table..."
        searchPredicate={(row, query) => {
          const q = query.toLowerCase();
          return (
            row.transferNo.toLowerCase().includes(q) ||
            (row.fromWarehouseName?.toLowerCase() || '').includes(q) ||
            (row.toWarehouseName?.toLowerCase() || '').includes(q) ||
            (row.challanNo?.toLowerCase() || '').includes(q) ||
            (row.remarks?.toLowerCase() || '').includes(q)
          );
        }}
        addButtonLabel="New Stock Transfer"
        onAddClick={handleOpenCreateModal}
      />

      {/* ========================================================================= */}
      {/* CREATE / EDIT TRANSFER MODAL                                              */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {editingTransferId ? 'Edit Stock Transfer Voucher' : 'New Stock Transfer Order'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Select transfer mode, source warehouse, target coordinates, and items
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitForm} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Top Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50/70 border border-slate-200 rounded-xl">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Transfer Date
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    required
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Transfer Mode / Type
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => {
                      const t = e.target.value as any;
                      setFormType(t);
                      if (t === 'BIN_TO_BIN') {
                        setFormToWh(formFromWh);
                      }
                    }}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none font-medium"
                  >
                    <option value="BIN_TO_BIN">Bin-to-Bin (Internal Warehouse)</option>
                    <option value="INTER_WAREHOUSE">Inter-Warehouse Transfer</option>
                    <option value="INTER_BRANCH_STO">Inter-Branch Stock Transfer (STO)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Source Warehouse (From)
                  </label>
                  <select
                    value={formFromWh}
                    onChange={(e) => {
                      const whId = Number(e.target.value);
                      setFormFromWh(whId);
                      if (formType === 'BIN_TO_BIN') {
                        setFormToWh(whId);
                      }
                      setFormItems([]); // Reset items when source WH changes
                    }}
                    required
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    {lookupsData?.warehouses?.map((wh) => (
                      <option key={wh.warehouseId} value={wh.warehouseId}>
                        {wh.warehouseName} ({wh.warehouseCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Destination Warehouse (To)
                  </label>
                  <select
                    value={formToWh}
                    onChange={(e) => setFormToWh(Number(e.target.value))}
                    disabled={formType === 'BIN_TO_BIN'}
                    required
                    className={`w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none ${
                      formType === 'BIN_TO_BIN' ? 'opacity-60 cursor-not-allowed bg-slate-100' : ''
                    }`}
                  >
                    {lookupsData?.warehouses?.map((wh) => (
                      <option key={wh.warehouseId} value={wh.warehouseId}>
                        {wh.warehouseName} ({wh.warehouseCode})
                      </option>
                    ))}
                  </select>
                </div>

                {formType === 'INTER_BRANCH_STO' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Destination Plant / Branch
                    </label>
                    <select
                      value={formToBranch}
                      onChange={(e) => setFormToBranch(Number(e.target.value))}
                      required
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none font-medium text-amber-900 bg-amber-50/50"
                    >
                      {lookupsData?.branches?.map((b) => (
                        <option key={b.branchId} value={b.branchId}>
                          {b.branchName} ({b.branchCode})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    General Remarks
                  </label>
                  <input
                    type="text"
                    value={formRemarks}
                    onChange={(e) => setFormRemarks(e.target.value)}
                    placeholder="E.g. Staging for CNC line 1 or urgent stock rebalance"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* Logistics & Transport Details (For Inter-Warehouse & Inter-Branch STO) */}
              {(formType === 'INTER_WAREHOUSE' || formType === 'INTER_BRANCH_STO') && (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Truck className="w-4 h-4 text-indigo-500" />
                    <span>Logistics, Vehicle & GST Rule 55 Transport Metadata</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Transporter Name
                      </label>
                      <input
                        type="text"
                        value={formTransporter}
                        onChange={(e) => setFormTransporter(e.target.value)}
                        placeholder="E.g. Gujarat Roadlines"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Vehicle Number
                      </label>
                      <input
                        type="text"
                        value={formVehicleNo}
                        onChange={(e) => setFormVehicleNo(e.target.value)}
                        placeholder="E.g. GJ-01-BX-4421"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:ring-1 focus:ring-indigo-500 outline-none uppercase"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        E-Way Bill Number
                      </label>
                      <input
                        type="text"
                        value={formEwayBill}
                        onChange={(e) => setFormEwayBill(e.target.value)}
                        placeholder="E.g. 241908219481"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-mono focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        LR / Consignment Note No
                      </label>
                      <input
                        type="text"
                        value={formLrNo}
                        onChange={(e) => setFormLrNo(e.target.value)}
                        placeholder="E.g. LR-GRL-8891"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        LR Date
                      </label>
                      <input
                        type="date"
                        value={formLrDate}
                        onChange={(e) => setFormLrDate(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Delivery Challan No
                      </label>
                      <input
                        type="text"
                        value={formChallanNo}
                        onChange={(e) => setFormChallanNo(e.target.value)}
                        placeholder="E.g. DC-STO-2627-0001"
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Items Section Header */}
              <div className="flex items-center justify-between pt-2">
                <div>
                  <h4 className="text-sm font-semibold text-slate-800">
                    Material Lines to Transfer ({formItems.length})
                  </h4>
                  <p className="text-xs text-slate-500">
                    Add inventory lines from source warehouse storage bins
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsStockPickerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Select from Available Bin Stock
                </button>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Item Code & Name</th>
                      <th className="py-2.5 px-3">From Bin</th>
                      <th className="py-2.5 px-3">To Bin</th>
                      <th className="py-2.5 px-3">Batch / Heat</th>
                      <th className="py-2.5 px-3 text-right">Available</th>
                      <th className="py-2.5 px-3 text-right">Transfer Qty</th>
                      <th className="py-2.5 px-3 text-right">Unit Rate</th>
                      <th className="py-2.5 px-3 text-right">Total (₹)</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {formItems.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          No items added yet. Click &quot;Select from Available Bin Stock&quot; to pick items.
                        </td>
                      </tr>
                    ) : (
                      formItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <div className="font-medium text-slate-900">{item.itemCode}</div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[150px]">
                              {item.itemName}
                            </div>
                          </td>
                          <td className="py-2 px-3 font-mono text-indigo-700">
                            {item.fromBinCode || `Bin #${item.fromBinId}`}
                          </td>
                          <td className="py-2 px-3">
                            <select
                              value={item.toBinId}
                              onChange={(e) => handleUpdateItemToBin(idx, Number(e.target.value))}
                              className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                            >
                              {destinationBins.map((bin) => (
                                <option key={bin.binId} value={bin.binId}>
                                  {bin.binCode} ({bin.binName})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                            {item.batchNo || '-'}
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-slate-500">
                            {formatQty(item.availableQty)} {item.uomCode}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <input
                              type="number"
                              step="any"
                              min="0.001"
                              max={item.availableQty}
                              value={item.transferQty}
                              onChange={(e) => handleUpdateItemQty(idx, parseFloat(e.target.value) || 0)}
                              className="w-20 px-2 py-1 text-right text-xs bg-white border border-slate-200 rounded font-semibold text-slate-900 focus:ring-1 focus:ring-indigo-500 outline-none"
                            />
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600">
                            {formatInr(item.unitCost)}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-slate-900">
                            {formatInr(item.lineTotal)}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total Summary Footer Strip */}
              {formItems.length > 0 && (
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800">
                  <span>Total Items: {formItems.length}</span>
                  <span>
                    Total Qty:{' '}
                    {formatQty(formItems.reduce((acc, it) => acc + (it.transferQty || 0), 0))} Units
                  </span>
                  <span className="text-sm font-bold text-indigo-700">
                    Grand Total Value:{' '}
                    {formatInr(formItems.reduce((acc, it) => acc + (it.lineTotal || 0), 0))}
                  </span>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : editingTransferId
                    ? 'Update Transfer Order'
                    : 'Create Transfer Order (Draft)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STOCK PICKER MODAL (From Selected Warehouse)                              */}
      {/* ========================================================================= */}
      {isStockPickerOpen && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-indigo-600" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Select Available Bin Inventory ({availableStockData?.length || 0} active lots)
                </h3>
              </div>
              <button
                onClick={() => setIsStockPickerOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {isStockFetching ? (
                <div className="py-12 text-center text-slate-400">Loading bin stock...</div>
              ) : !availableStockData || availableStockData.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  No available inventory with balance &gt; 0 in selected warehouse.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                  {availableStockData.map((stk) => {
                    const isAdded = formItems.some(
                      (i) =>
                        i.itemId === stk.itemId &&
                        i.fromBinId === stk.binId &&
                        i.batchNo === stk.batchNo,
                    );
                    return (
                      <div
                        key={stk.binStockId}
                        className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                      >
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-900 flex items-center gap-2">
                            <span>{stk.itemCode}</span>
                            <span className="text-slate-400 font-normal">| {stk.itemName}</span>
                          </div>
                          <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                            <span>
                              Bin: <span className="font-mono text-indigo-600">{stk.binCode}</span>
                            </span>
                            {stk.batchNo && (
                              <span>
                                Batch: <span className="font-mono">{stk.batchNo}</span>
                              </span>
                            )}
                            {stk.heatNo && (
                              <span>
                                Heat: <span className="font-mono">{stk.heatNo}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="font-bold text-slate-900">
                              {formatQty(stk.availableQty)} {stk.uomCode}
                            </div>
                            <div className="text-[11px] text-slate-400">{formatInr(stk.unitCost)} / unit</div>
                          </div>

                          <button
                            type="button"
                            disabled={isAdded}
                            onClick={() => {
                              handleSelectStockLine(stk);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                              isAdded
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs'
                            }`}
                          >
                            {isAdded ? 'Added' : 'Select'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setIsStockPickerOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 rounded-lg hover:bg-slate-900"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DISPATCH CONFIRMATION MODAL                                               */}
      {/* ========================================================================= */}
      {isDispatchModalOpen && selectedTransfer && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Confirm Material Dispatch ({selectedTransfer.transferNo})
                </h3>
                <p className="text-xs text-slate-500">
                  Deducts inventory from source bin stock and records outward stock ledger movement
                </p>
              </div>
            </div>

            <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-500 block">From Warehouse:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedTransfer.fromWarehouseName}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">To Warehouse:</span>
                  <span className="font-semibold text-slate-900">
                    {selectedTransfer.toWarehouseName}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Vehicle Number
                </label>
                <input
                  type="text"
                  value={dispatchVehicle}
                  onChange={(e) => setDispatchVehicle(e.target.value)}
                  placeholder="E.g. GJ-01-BX-4421"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 uppercase font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">
                  Transporter / Carrier
                </label>
                <input
                  type="text"
                  value={dispatchTransporter}
                  onChange={(e) => setDispatchTransporter(e.target.value)}
                  placeholder="E.g. Western Express Transport"
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    LR Number
                  </label>
                  <input
                    type="text"
                    value={dispatchLrNo}
                    onChange={(e) => setDispatchLrNo(e.target.value)}
                    placeholder="LR-..."
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-700 mb-1">
                    E-Way Bill Number
                  </label>
                  <input
                    type="text"
                    value={dispatchEwayBill}
                    onChange={(e) => setDispatchEwayBill(e.target.value)}
                    placeholder="12-digit E-Way bill"
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 font-mono focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDispatchModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={dispatchMutation.isPending}
                onClick={() =>
                  dispatchMutation.mutate({
                    id: selectedTransfer.transferId,
                    payload: {
                      vehicleNo: dispatchVehicle,
                      transporterName: dispatchTransporter,
                      lrNo: dispatchLrNo,
                      lrDate: dispatchLrDate || undefined,
                      ewayBillNo: dispatchEwayBill,
                      challanNo: dispatchChallanNo || undefined,
                      challanDate: dispatchChallanDate || undefined,
                      remarks: dispatchRemarks,
                    },
                  })
                }
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm disabled:opacity-50"
              >
                {dispatchMutation.isPending ? 'Processing...' : 'Confirm Outward Dispatch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RECEIVE CONFIRMATION MODAL                                                */}
      {/* ========================================================================= */}
      {isReceiveModalOpen && selectedTransfer && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <PackageCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Receive Inward Stock ({selectedTransfer.transferNo})
                </h3>
                <p className="text-xs text-slate-500">
                  Confirms physical arrival, accretes destination bin stock, and writes inward ledger records
                </p>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Item</th>
                    <th className="py-2 px-3">Target Bin</th>
                    <th className="py-2 px-3 text-right">Dispatched</th>
                    <th className="py-2 px-3 text-right">Received Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedTransfer.items?.map((it, idx) => {
                    const override = receiveItemOverrides.find(
                      (o) => o.transferItemId === it.transferItemId,
                    );
                    return (
                      <tr key={it.transferItemId} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 font-medium text-slate-900">
                          {it.itemCode}
                          <div className="text-[11px] text-slate-400">{it.itemName}</div>
                        </td>
                        <td className="py-2 px-3 font-mono text-emerald-700">
                          {it.toBinCode || `Bin #${it.toBinId}`}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-600">
                          {formatQty(it.transferQty)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            step="any"
                            value={override?.receivedQty ?? it.transferQty}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setReceiveItemOverrides((prev) =>
                                prev.map((o) =>
                                  o.transferItemId === it.transferItemId
                                    ? { ...o, receivedQty: val }
                                    : o,
                                ),
                              );
                            }}
                            className="w-24 px-2 py-1 text-right text-xs bg-white border border-slate-200 rounded font-semibold text-slate-900 focus:ring-1 focus:ring-emerald-500 outline-none"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Receipt Verification Remarks
              </label>
              <input
                type="text"
                value={receiveRemarks}
                onChange={(e) => setReceiveRemarks(e.target.value)}
                placeholder="E.g. Consignment verified and stacked into warehouse racks"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-1 focus:ring-emerald-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsReceiveModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={receiveMutation.isPending}
                onClick={() =>
                  receiveMutation.mutate({
                    id: selectedTransfer.transferId,
                    payload: {
                      items: receiveItemOverrides,
                      remarks: receiveRemarks,
                    },
                  })
                }
                className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 shadow-sm disabled:opacity-50"
              >
                {receiveMutation.isPending ? 'Processing...' : 'Confirm Inward Put-Away'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* CANCEL MODAL                                                              */}
      {/* ========================================================================= */}
      {isCancelModalOpen && selectedTransfer && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-50 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Cancel Transfer Voucher
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedTransfer.transferNo}
                </p>
              </div>
            </div>

            <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1">
              <span className="font-semibold block">Inventory Restitution Notice:</span>
              <p>
                {selectedTransfer.status === 'DISPATCHED' &&
                  'This voucher was dispatched. Cancelling will restore the deducted quantity back into the source warehouse bins and post offset ledger credits.'}
                {selectedTransfer.status === 'RECEIVED' &&
                  'This voucher was received. Cancelling will debit destination bin stock, credit source bin stock, and balance all double-entry ledger lines.'}
                {selectedTransfer.status === 'DRAFT' &&
                  'This draft voucher will be marked as cancelled.'}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mandatory Cancellation Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Enter justification for audit trail (e.g. Vehicle breakdown, cancelled order)..."
                className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:ring-1 focus:ring-rose-500 outline-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                disabled={!cancelReason.trim() || cancelMutation.isPending}
                onClick={() =>
                  cancelMutation.mutate({
                    id: selectedTransfer.transferId,
                    reason: cancelReason,
                  })
                }
                className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 rounded-lg hover:bg-rose-700 shadow-sm disabled:opacity-50"
              >
                {cancelMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAIL DRAWER                                                             */}
      {/* ========================================================================= */}
      {isDetailDrawerOpen && selectedTransfer && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-slate-900">
                    {selectedTransfer.transferNo}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    {selectedTransfer.transferType}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Voucher Date: {formatDate(selectedTransfer.transferDate)}
                </p>
              </div>
              <button
                onClick={() => setIsDetailDrawerOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Warehouse & Branch Coordinates */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Movement Coordinates
                </span>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400 block">From Warehouse:</span>
                    <span className="font-semibold text-slate-900">
                      {selectedTransfer.fromWarehouseName} ({selectedTransfer.fromWarehouseCode})
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">To Warehouse:</span>
                    <span className="font-semibold text-slate-900">
                      {selectedTransfer.toWarehouseName} ({selectedTransfer.toWarehouseCode})
                    </span>
                    {selectedTransfer.toBranchName && (
                      <span className="text-amber-800 text-[11px] block mt-0.5">
                        Plant: {selectedTransfer.toBranchName}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Transport Metadata */}
              {(selectedTransfer.vehicleNo || selectedTransfer.transporterName || selectedTransfer.ewayBillNo) && (
                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl space-y-2 text-xs">
                  <span className="font-semibold text-blue-900 flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5" /> Transport & E-Way Bill Details
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-700">
                    {selectedTransfer.vehicleNo && (
                      <div>
                        <span className="text-slate-400 text-[11px] block">Vehicle:</span>
                        <span className="font-mono font-medium">{selectedTransfer.vehicleNo}</span>
                      </div>
                    )}
                    {selectedTransfer.transporterName && (
                      <div>
                        <span className="text-slate-400 text-[11px] block">Transporter:</span>
                        <span>{selectedTransfer.transporterName}</span>
                      </div>
                    )}
                    {selectedTransfer.ewayBillNo && (
                      <div>
                        <span className="text-slate-400 text-[11px] block">E-Way Bill:</span>
                        <span className="font-mono">{selectedTransfer.ewayBillNo}</span>
                      </div>
                    )}
                    {selectedTransfer.lrNo && (
                      <div>
                        <span className="text-slate-400 text-[11px] block">LR No / Date:</span>
                        <span>
                          {selectedTransfer.lrNo} ({formatDate(selectedTransfer.lrDate)})
                        </span>
                      </div>
                    )}
                    {selectedTransfer.challanNo && (
                      <div>
                        <span className="text-slate-400 text-[11px] block">Challan:</span>
                        <span>{selectedTransfer.challanNo}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status Timeline Strip */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Workflow Lifecycle
                </span>
                <div className="grid grid-cols-2 gap-3 text-slate-700">
                  <div>
                    <span className="text-slate-400 text-[11px] block">Dispatched By:</span>
                    <span>{selectedTransfer.dispatchedByName || '-'}</span>
                    <span className="text-[11px] text-slate-400 block">
                      {formatDateTime(selectedTransfer.dispatchedAt)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[11px] block">Received By:</span>
                    <span>{selectedTransfer.receivedByName || '-'}</span>
                    <span className="text-[11px] text-slate-400 block">
                      {formatDateTime(selectedTransfer.receivedAt)}
                    </span>
                  </div>
                </div>
                {selectedTransfer.cancellationReason && (
                  <div className="pt-2 border-t border-slate-200 text-rose-700">
                    <span className="font-semibold block">Cancellation Reason:</span>
                    <p>{selectedTransfer.cancellationReason}</p>
                  </div>
                )}
              </div>

              {/* Items Schedule */}
              <div className="space-y-3">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                  Transfer Schedule ({selectedTransfer.items?.length || 0} items)
                </span>

                <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Item</th>
                        <th className="py-2 px-3">From &rarr; To Bin</th>
                        <th className="py-2 px-3 text-right">Qty</th>
                        <th className="py-2 px-3 text-right">Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedTransfer.items?.map((it) => (
                        <tr key={it.transferItemId} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3">
                            <div className="font-medium text-slate-900">{it.itemCode}</div>
                            <div className="text-[11px] text-slate-500">{it.itemName}</div>
                            {it.batchNo && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                Lot: {it.batchNo}
                              </div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-[11px]">
                            <div className="text-indigo-600">{it.fromBinCode || it.fromBinId}</div>
                            <div className="text-slate-400">&darr;</div>
                            <div className="text-emerald-600">{it.toBinCode || it.toBinId}</div>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="font-semibold text-slate-900">
                              {formatQty(it.transferQty)} {it.uomCode}
                            </div>
                            {it.receivedQty ? (
                              <div className="text-[10px] text-emerald-600">
                                Recv: {formatQty(it.receivedQty)}
                              </div>
                            ) : null}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                            {formatInr(it.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 text-xs">
                  <span>Grand Total Valuation:</span>
                  <span>{formatInr(selectedTransfer.totalTransferValue)}</span>
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <button
                onClick={() => openPrintModal(selectedTransfer)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                Print Challan
              </button>

              <button
                onClick={() => setIsDetailDrawerOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STATUTORY DELIVERY CHALLAN & TRANSFER NOTE PRINT MODAL                    */}
      {/* ========================================================================= */}
      {isPrintModalOpen && selectedTransfer && (
        <div className="fixed inset-0 z-60 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Top Toolbar */}
            <div className="px-6 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Statutory Rule 55 Delivery Challan & Transfer Note Preview
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Document
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Content Container */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-100 flex justify-center">
              <div className="bg-white border border-slate-300 shadow-md w-full max-w-3xl p-8 space-y-6 text-slate-900 font-sans print:border-none print:shadow-none print:p-0">
                {/* Document Letterhead */}
                <div className="border-b-2 border-slate-900 pb-4 text-center space-y-1">
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-wide">
                    {currentCompany?.legalName || currentCompany?.compName || 'KASHVIRA MANUFACTURING PRIVATE LIMITED'}
                  </h2>
                  <p className="text-xs text-slate-600">
                    CIN: U29100GJ2022PTC130491 | PAN: AABCK1234F | GSTIN:{' '}
                    {currentCompany?.gstin || '24AABCK1234F1Z5'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Registered Office: Plot 44-46, Phase II GIDC, Sanand, {currentBranch?.city || 'Ahmedabad'}, Gujarat - 382110
                  </p>
                  <div className="pt-2">
                    <span className="inline-block px-4 py-1 text-xs font-black uppercase tracking-wider border-2 border-slate-900 rounded bg-slate-50">
                      DELIVERY CHALLAN & MATERIAL TRANSFER NOTE
                    </span>
                    <p className="text-[10px] text-slate-500 italic mt-0.5">
                      (Issued under Rule 55 of CGST / SGST Rules, 2017 for Transportation of Goods Not by Way of Supply)
                    </p>
                  </div>
                </div>

                {/* Voucher & Movement Coordinates Strip */}
                <div className="grid grid-cols-2 border border-slate-300 rounded text-xs divide-x divide-slate-300">
                  <div className="p-3 space-y-1.5">
                    <div>
                      <span className="text-slate-500 font-medium">Challan / Transfer No:</span>{' '}
                      <span className="font-bold text-slate-900 font-mono">
                        {selectedTransfer.challanNo || selectedTransfer.transferNo}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Date of Movement:</span>{' '}
                      <span className="font-semibold text-slate-800">
                        {formatDate(selectedTransfer.transferDate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Nature of Movement:</span>{' '}
                      <span className="font-semibold text-slate-800">
                        {selectedTransfer.transferType.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Origin Warehouse:</span>{' '}
                      <span className="font-semibold text-slate-800">
                        {selectedTransfer.fromWarehouseName} ({selectedTransfer.fromWarehouseCode})
                      </span>
                    </div>
                  </div>

                  <div className="p-3 space-y-1.5">
                    <div>
                      <span className="text-slate-500 font-medium">Destination Warehouse:</span>{' '}
                      <span className="font-semibold text-slate-800">
                        {selectedTransfer.toWarehouseName} ({selectedTransfer.toWarehouseCode})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Destination Branch/Plant:</span>{' '}
                      <span className="font-semibold text-slate-800">
                        {selectedTransfer.toBranchName || currentBranch?.branchName || 'Primary Plant'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">Vehicle No:</span>{' '}
                      <span className="font-mono font-bold text-slate-900">
                        {selectedTransfer.vehicleNo || 'Internal Handling Equipment'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium">E-Way Bill No:</span>{' '}
                      <span className="font-mono font-semibold text-slate-800">
                        {selectedTransfer.ewayBillNo || 'Exempt / Not Applicable'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Schedule of Goods Table */}
                <div className="border border-slate-300 rounded overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 font-bold border-b border-slate-300 text-slate-800">
                      <tr>
                        <th className="p-2 border-r border-slate-300 text-center w-10">S.No</th>
                        <th className="p-2 border-r border-slate-300">Description of Goods</th>
                        <th className="p-2 border-r border-slate-300">From &rarr; To Bin</th>
                        <th className="p-2 border-r border-slate-300">Batch / Heat No</th>
                        <th className="p-2 border-r border-slate-300 text-right w-24">Quantity</th>
                        <th className="p-2 border-r border-slate-300 text-right w-24">Unit Rate</th>
                        <th className="p-2 text-right w-28">Total Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {selectedTransfer.items?.map((it, idx) => (
                        <tr key={it.transferItemId}>
                          <td className="p-2 border-r border-slate-300 text-center">{idx + 1}</td>
                          <td className="p-2 border-r border-slate-300">
                            <span className="font-semibold">{it.itemCode}</span>
                            <div className="text-[11px] text-slate-600">{it.itemName}</div>
                          </td>
                          <td className="p-2 border-r border-slate-300 font-mono text-[11px]">
                            {it.fromBinCode || it.fromBinId} &rarr; {it.toBinCode || it.toBinId}
                          </td>
                          <td className="p-2 border-r border-slate-300 font-mono text-[11px]">
                            {it.batchNo || '-'}
                          </td>
                          <td className="p-2 border-r border-slate-300 text-right font-semibold">
                            {formatQty(it.transferQty)} {it.uomCode}
                          </td>
                          <td className="p-2 border-r border-slate-300 text-right">
                            {formatInr(it.unitCost)}
                          </td>
                          <td className="p-2 text-right font-bold">
                            {formatInr(it.lineTotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-900 bg-slate-50 font-bold">
                      <tr>
                        <td colSpan={4} className="p-2 text-right border-r border-slate-300">
                          Total Transfer Valuation:
                        </td>
                        <td className="p-2 text-right border-r border-slate-300">
                          {formatQty(selectedTransfer.totalTransferQty)}
                        </td>
                        <td className="p-2 border-r border-slate-300"></td>
                        <td className="p-2 text-right text-sm">
                          {formatInr(selectedTransfer.totalTransferValue)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Amount in Words */}
                <div className="p-3 bg-slate-50 border border-slate-300 rounded text-xs space-y-0.5">
                  <span className="font-semibold text-slate-500 uppercase tracking-wider block text-[10px]">
                    Total Transfer Valuation in Words:
                  </span>
                  <span className="font-bold text-slate-900 italic">
                    {numberToWordsINR(selectedTransfer.totalTransferValue)}
                  </span>
                </div>

                {/* Statutory Declaration */}
                <div className="text-[10px] text-slate-500 leading-tight space-y-1">
                  <p>
                    <strong>Declaration:</strong> Certified that the goods described above are being transported for internal transfer / branch supply and not by way of sale. No commercial consideration is received. Goods must be delivered to the specified consignee without diversion.
                  </p>
                </div>

                {/* 3-Tier Signatory Blocks */}
                <div className="grid grid-cols-3 gap-6 pt-12 text-center text-xs border-t border-slate-300">
                  <div className="space-y-1">
                    <div className="border-t border-slate-900 pt-2 font-bold text-slate-900">
                      Prepared By (Store Officer)
                    </div>
                    <p className="text-[10px] text-slate-500">Physical Stock Verification</p>
                  </div>

                  <div className="space-y-1">
                    <div className="border-t border-slate-900 pt-2 font-bold text-slate-900">
                      Dispatched By (Warehouse Head)
                    </div>
                    <p className="text-[10px] text-slate-500">Security Gate & Outward Clearance</p>
                  </div>

                  <div className="space-y-1">
                    <div className="border-t border-slate-900 pt-2 font-bold text-slate-900">
                      Received By (Consignee In-Charge)
                    </div>
                    <p className="text-[10px] text-slate-500">Inward Verification & Storage Put-Away</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
