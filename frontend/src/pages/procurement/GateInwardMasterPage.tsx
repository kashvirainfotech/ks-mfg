import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
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
  LogOut,
  Package,
  Plus,
  Printer,
  Scale,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Trash2,
  Truck,
  User,
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

export type GateInwardStatus =
  | 'INWARDED'
  | 'UNLOADED'
  | 'GRN_PENDING'
  | 'COMPLETED'
  | 'CANCELLED';

export interface GateInwardItemRecord {
  gateInwardItemId?: number;
  gateInwardId?: number;
  poItemId?: number | null;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  itemDescription?: string;
  uomId: number;
  uomCode?: string;
  uomName?: string;
  challanQty: number;
  packageCount?: number;
  remarks?: string;
  isActive?: boolean;
}

export interface GateInwardHeaderRecord {
  gateInwardId: number;
  gateInwardNo: string;
  inwardDate: string;
  inwardTime: string;
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  vendorId: number;
  vendorCode: string;
  vendorName: string;
  poId?: number | null;
  poNo?: string | null;
  challanNo: string;
  challanDate: string;
  vehicleNo: string;
  transporterName?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  ewayBillNo?: string | null;
  lrNo?: string | null;
  lrDate?: string | null;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  totalPackages: number;
  status: GateInwardStatus;
  securityRemarks?: string | null;
  unloadedDate?: string | null;
  unloadedBy?: number | null;
  unloadedByName?: string | null;
  unloadingRemarks?: string | null;
  exitDate?: string | null;
  exitRemarks?: string | null;
  cancelReason?: string | null;
  isActive: boolean;
  createdDate: string;
  itemsCount: number;
  items?: GateInwardItemRecord[];
}

export interface GateInwardSummary {
  totalInwards: number;
  inwardedCount: number;
  unloadedCount: number;
  grnPendingCount: number;
  completedCount: number;
  inPlantCount: number;
}

export interface WarehouseOption {
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
}

export interface ItemLookupOption {
  itemId: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  baseUomId: number;
  baseUomCode?: string;
}

export interface UomLookupOption {
  uomId: number;
  uomCode: string;
  uomName: string;
}

export interface SupplierOption {
  partyId: number;
  partyCode: string;
  partyName: string;
  email?: string;
  phone?: string;
}

export interface ReleasedPoOption {
  poId: number;
  poNo: string;
  poDate: string;
  vendorId: number;
  vendorName: string;
  warehouseId: number;
  warehouseName: string;
  items?: {
    poItemId: number;
    itemId: number;
    itemCode: string;
    itemName: string;
    itemDescription?: string;
    uomId: number;
    uomCode: string;
    orderedQty: number;
  }[];
}

const STATUS_BADGE_MAP: Record<
  GateInwardStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  INWARDED: {
    label: 'At Gate / Queue',
    bg: 'bg-blue-500/10 dark:bg-blue-950/30',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-300 dark:border-blue-800',
    dot: 'bg-blue-500',
  },
  UNLOADED: {
    label: 'Offloaded at Bay',
    bg: 'bg-indigo-500/10 dark:bg-indigo-950/30',
    text: 'text-indigo-700 dark:text-indigo-400',
    border: 'border-indigo-300 dark:border-indigo-800',
    dot: 'bg-indigo-500',
  },
  GRN_PENDING: {
    label: 'Ready for GRN',
    bg: 'bg-amber-500/10 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-300 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  COMPLETED: {
    label: 'Cleared & Departed',
    bg: 'bg-emerald-500/10 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-300 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  CANCELLED: {
    label: 'Voided / Turned Back',
    bg: 'bg-rose-500/10 dark:bg-rose-950/30',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-300 dark:border-rose-800',
    dot: 'bg-rose-500',
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const GateInwardMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Modals & Panels State
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingGin, setEditingGin] = useState<GateInwardHeaderRecord | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [selectedGin, setSelectedGin] = useState<GateInwardHeaderRecord | null>(null);

  const [isUnloadModalOpen, setIsUnloadModalOpen] = useState<boolean>(false);
  const [unloadTarget, setUnloadTarget] = useState<GateInwardHeaderRecord | null>(null);
  const [unloadTareWeight, setUnloadTareWeight] = useState<number | ''>('');
  const [unloadRemarks, setUnloadRemarks] = useState<string>('');

  const [isExitModalOpen, setIsExitModalOpen] = useState<boolean>(false);
  const [exitTarget, setExitTarget] = useState<GateInwardHeaderRecord | null>(null);
  const [exitRemarks, setExitRemarks] = useState<string>('');

  const [isCancelModalOpen, setIsCancelModalOpen] = useState<boolean>(false);
  const [cancelTarget, setCancelTarget] = useState<GateInwardHeaderRecord | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');

  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printTarget, setPrintTarget] = useState<GateInwardHeaderRecord | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<GateInwardHeaderRecord | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [deleteConflicts, setDeleteConflicts] = useState<DependencyConflictItem[]>([]);

  // Sourcing Acceleration Drawer
  const [isImportPoOpen, setIsImportPoOpen] = useState<boolean>(false);

  // Form State
  const [formGinNo, setFormGinNo] = useState<string>('');
  const [formInwardDate, setFormInwardDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [formInwardTime, setFormInwardTime] = useState<string>(
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
  );
  const [formWarehouseId, setFormWarehouseId] = useState<number | ''>('');
  const [formVendorId, setFormVendorId] = useState<number | ''>('');
  const [formPoId, setFormPoId] = useState<number | ''>('');
  const [formChallanNo, setFormChallanNo] = useState<string>('');
  const [formChallanDate, setFormChallanDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [formVehicleNo, setFormVehicleNo] = useState<string>('');
  const [formTransporterName, setFormTransporterName] = useState<string>('');
  const [formDriverName, setFormDriverName] = useState<string>('');
  const [formDriverPhone, setFormDriverPhone] = useState<string>('');
  const [formEwayBillNo, setFormEwayBillNo] = useState<string>('');
  const [formLrNo, setFormLrNo] = useState<string>('');
  const [formLrDate, setFormLrDate] = useState<string>('');
  const [formGrossWeight, setFormGrossWeight] = useState<number | ''>(0);
  const [formTareWeight, setFormTareWeight] = useState<number | ''>(0);
  const [formTotalPackages, setFormTotalPackages] = useState<number>(1);
  const [formSecurityRemarks, setFormSecurityRemarks] = useState<string>('');
  const [formItems, setFormItems] = useState<GateInwardItemRecord[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // DATA FETCHING
  // --------------------------------------------------------------------------

  // 1. KPI Summary
  const { data: summary, isLoading: isSummaryLoading } = useQuery<GateInwardSummary>({
    queryKey: ['procurement', 'gate-inward', 'summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<GateInwardSummary>>(
        '/procurement/gate-inward/summary',
      );
      return res.data.data;
    },
  });

  // 2. Gate Inward Register
  const { data: gateInwards = [], isLoading: isGinListLoading } = useQuery<
    GateInwardHeaderRecord[]
  >({
    queryKey: [
      'procurement',
      'gate-inward',
      'list',
      statusFilter,
      warehouseFilter,
      vendorFilter,
      globalSearch,
    ],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (warehouseFilter !== 'ALL') params.warehouseId = warehouseFilter;
      if (vendorFilter !== 'ALL') params.vendorId = vendorFilter;
      if (globalSearch.trim()) params.search = globalSearch.trim();

      const res = await apiClient.get<ApiResponse<GateInwardHeaderRecord[]>>(
        '/procurement/gate-inward',
        { params },
      );
      return res.data.data;
    },
  });

  // 3. Dropdowns
  const { data: warehouses = [] } = useQuery<WarehouseOption[]>({
    queryKey: ['inventory', 'warehouses', 'options'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/inventory/warehouses');
      return (res.data.data || []).map((w: any) => ({
        warehouseId: w.warehouseId,
        warehouseCode: w.warehouseCode,
        warehouseName: w.warehouseName,
      }));
    },
    staleTime: 60_000,
  });

  const { data: suppliers = [] } = useQuery<SupplierOption[]>({
    queryKey: ['parties', 'suppliers', 'options'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/parties', {
        params: { isSupplier: 'true' },
      });
      return (res.data.data || []).map((p: any) => ({
        partyId: p.partyId,
        partyCode: p.partyCode,
        partyName: p.partyName,
        email: p.email,
        phone: p.phone,
      }));
    },
    staleTime: 60_000,
  });

  const { data: itemsCatalog = [] } = useQuery<ItemLookupOption[]>({
    queryKey: ['inventory', 'items', 'options'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/inventory/items');
      return (res.data.data || []).map((i: any) => ({
        itemId: i.itemId,
        itemCode: i.itemCode,
        itemName: i.itemName,
        itemType: i.itemType,
        baseUomId: i.baseUomId,
        baseUomCode: i.baseUomCode,
      }));
    },
    staleTime: 60_000,
  });

  const { data: uomsCatalog = [] } = useQuery<UomLookupOption[]>({
    queryKey: ['inventory', 'uoms', 'options'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/inventory/uoms');
      return (res.data.data || []).map((u: any) => ({
        uomId: u.uomId,
        uomCode: u.uomCode,
        uomName: u.uomName,
      }));
    },
    staleTime: 60_000,
  });

  // Active / Released Purchase Orders for 1-click import
  const { data: releasedPos = [] } = useQuery<ReleasedPoOption[]>({
    queryKey: ['procurement', 'purchase-orders', 'released-for-gate-inward'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>(
        '/procurement/purchase-orders',
        { params: { status: 'RELEASED' } },
      );
      return res.data.data || [];
    },
    staleTime: 30_000,
  });

  // --------------------------------------------------------------------------
  // MUTATIONS
  // --------------------------------------------------------------------------

  // Create / Update Gate Inward
  const saveGinMutation = useMutation({
    mutationFn: async () => {
      if (!formWarehouseId) throw new Error('Please select a Destination Warehouse');
      if (!formVendorId) throw new Error('Please select a Supplier/Vendor');
      if (!formChallanNo.trim()) throw new Error('Supplier Delivery Challan/Invoice No is required');
      if (!formVehicleNo.trim()) throw new Error('Vehicle Registration No is required');
      if (formItems.length === 0)
        throw new Error('Please add at least one line item declared on challan');

      const payload = {
        gateInwardNo: formGinNo.trim() || undefined,
        inwardDate: formInwardDate,
        inwardTime: formInwardTime.trim() || undefined,
        warehouseId: Number(formWarehouseId),
        vendorId: Number(formVendorId),
        poId: formPoId ? Number(formPoId) : undefined,
        challanNo: formChallanNo.trim(),
        challanDate: formChallanDate,
        vehicleNo: formVehicleNo.trim().toUpperCase(),
        transporterName: formTransporterName.trim() || undefined,
        driverName: formDriverName.trim() || undefined,
        driverPhone: formDriverPhone.trim() || undefined,
        ewayBillNo: formEwayBillNo.trim() || undefined,
        lrNo: formLrNo.trim() || undefined,
        lrDate: formLrDate || undefined,
        grossWeight: Number(formGrossWeight) || 0,
        tareWeight: Number(formTareWeight) || 0,
        totalPackages: Number(formTotalPackages) || 1,
        securityRemarks: formSecurityRemarks.trim() || undefined,
        items: formItems.map((it) => ({
          poItemId: it.poItemId || undefined,
          itemId: it.itemId,
          itemDescription: it.itemDescription?.trim() || undefined,
          uomId: it.uomId,
          challanQty: Number(it.challanQty),
          packageCount: Number(it.packageCount) || 1,
          remarks: it.remarks?.trim() || undefined,
        })),
      };

      if (editingGin) {
        const res = await apiClient.put<ApiResponse<GateInwardHeaderRecord>>(
          `/procurement/gate-inward/${editingGin.gateInwardId}`,
          payload,
        );
        return res.data.data;
      } else {
        const res = await apiClient.post<ApiResponse<GateInwardHeaderRecord>>(
          '/procurement/gate-inward',
          payload,
        );
        return res.data.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'gate-inward'] });
      setIsEditorOpen(false);
      setEditingGin(null);
      setFormError(null);
    },
    onError: (err: any) => {
      setFormError(
        err.response?.data?.message || err.message || 'Failed to save gate inward entry',
      );
    },
  });

  // Mark Unloaded Mutation
  const markUnloadedMutation = useMutation({
    mutationFn: async ({
      id,
      tareWeight,
      unloadingRemarks,
    }: {
      id: number;
      tareWeight?: number;
      unloadingRemarks?: string;
    }) => {
      const res = await apiClient.post<ApiResponse<GateInwardHeaderRecord>>(
        `/procurement/gate-inward/${id}/unload`,
        { tareWeight, unloadingRemarks },
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'gate-inward'] });
      setIsUnloadModalOpen(false);
      setUnloadTarget(null);
      if (selectedGin) handleViewDetails(selectedGin.gateInwardId);
    },
  });

  // Record Vehicle Exit Mutation
  const recordExitMutation = useMutation({
    mutationFn: async ({ id, exitRemarks }: { id: number; exitRemarks?: string }) => {
      const res = await apiClient.post<ApiResponse<GateInwardHeaderRecord>>(
        `/procurement/gate-inward/${id}/exit`,
        { exitRemarks },
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'gate-inward'] });
      setIsExitModalOpen(false);
      setExitTarget(null);
      if (selectedGin) handleViewDetails(selectedGin.gateInwardId);
    },
  });

  // Cancel Gate Inward Mutation
  const cancelGinMutation = useMutation({
    mutationFn: async ({ id, cancelReason }: { id: number; cancelReason: string }) => {
      const res = await apiClient.post<ApiResponse<GateInwardHeaderRecord>>(
        `/procurement/gate-inward/${id}/cancel`,
        { cancelReason },
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'gate-inward'] });
      setIsCancelModalOpen(false);
      setCancelTarget(null);
      if (selectedGin) handleViewDetails(selectedGin.gateInwardId);
    },
  });

  // Delete Mutation
  const deleteGinMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/procurement/gate-inward/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'gate-inward'] });
      setDeleteTarget(null);
      setDeleteErrorMessage(null);
      setDeleteConflicts([]);
      if (selectedGin && selectedGin.gateInwardId === deleteTarget?.gateInwardId) {
        setIsDetailOpen(false);
        setSelectedGin(null);
      }
    },
    onError: (err: any) => {
      const data = err.response?.data;
      if (data?.details?.conflicts) {
        setDeleteConflicts(data.details.conflicts);
        setDeleteErrorMessage(data.message || 'Cannot delete gate entry.');
      } else {
        setDeleteErrorMessage(
          data?.message || err.message || 'Failed to delete gate entry',
        );
      }
    },
  });

  // Audit Screen Action Logger
  const logActionMutation = useMutation({
    mutationFn: async (actionType: 'PRINT' | 'EXPORT') => {
      await apiClient.post('/procurement/gate-inward/actions/log', {
        actionType,
      });
    },
  });

  // --------------------------------------------------------------------------
  // HANDLERS & HELPERS
  // --------------------------------------------------------------------------

  const handleOpenCreateModal = () => {
    setEditingGin(null);
    setFormGinNo('');
    setFormInwardDate(new Date().toISOString().split('T')[0]);
    setFormInwardTime(
      new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    );
    setFormWarehouseId(warehouses[0]?.warehouseId || '');
    setFormVendorId(suppliers[0]?.partyId || '');
    setFormPoId('');
    setFormChallanNo('');
    setFormChallanDate(new Date().toISOString().split('T')[0]);
    setFormVehicleNo('');
    setFormTransporterName('');
    setFormDriverName('');
    setFormDriverPhone('');
    setFormEwayBillNo('');
    setFormLrNo('');
    setFormLrDate('');
    setFormGrossWeight(0);
    setFormTareWeight(0);
    setFormTotalPackages(1);
    setFormSecurityRemarks('Vehicle inspected at security gate. Driver documents verified.');
    setFormItems([]);
    setFormError(null);
    setIsEditorOpen(true);
  };

  const handleOpenEditModal = async (gin: GateInwardHeaderRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<GateInwardHeaderRecord>>(
        `/procurement/gate-inward/${gin.gateInwardId}`,
      );
      const full = res.data.data;
      setEditingGin(full);
      setFormGinNo(full.gateInwardNo);
      setFormInwardDate(full.inwardDate);
      setFormInwardTime(full.inwardTime);
      setFormWarehouseId(full.warehouseId);
      setFormVendorId(full.vendorId);
      setFormPoId(full.poId || '');
      setFormChallanNo(full.challanNo);
      setFormChallanDate(full.challanDate);
      setFormVehicleNo(full.vehicleNo);
      setFormTransporterName(full.transporterName || '');
      setFormDriverName(full.driverName || '');
      setFormDriverPhone(full.driverPhone || '');
      setFormEwayBillNo(full.ewayBillNo || '');
      setFormLrNo(full.lrNo || '');
      setFormLrDate(full.lrDate || '');
      setFormGrossWeight(full.grossWeight);
      setFormTareWeight(full.tareWeight);
      setFormTotalPackages(full.totalPackages || 1);
      setFormSecurityRemarks(full.securityRemarks || '');
      setFormItems(
        (full.items || []).map((it) => ({
          gateInwardItemId: it.gateInwardItemId,
          poItemId: it.poItemId,
          itemId: it.itemId,
          itemCode: it.itemCode,
          itemName: it.itemName,
          itemDescription: it.itemDescription,
          uomId: it.uomId,
          uomCode: it.uomCode,
          challanQty: it.challanQty,
          packageCount: it.packageCount,
          remarks: it.remarks,
        })),
      );
      setFormError(null);
      setIsEditorOpen(true);
    } catch (err: any) {
      alert('Failed to load gate inward details: ' + err.message);
    }
  };

  const handleViewDetails = async (id: number) => {
    try {
      const res = await apiClient.get<ApiResponse<GateInwardHeaderRecord>>(
        `/procurement/gate-inward/${id}`,
      );
      setSelectedGin(res.data.data);
      setIsDetailOpen(true);
    } catch (err: any) {
      alert('Failed to fetch details: ' + err.message);
    }
  };

  const handleOpenPrintPass = async (gin: GateInwardHeaderRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<GateInwardHeaderRecord>>(
        `/procurement/gate-inward/${gin.gateInwardId}`,
      );
      setPrintTarget(res.data.data);
      setIsPrintModalOpen(true);
      logActionMutation.mutate('PRINT');
    } catch (err: any) {
      alert('Failed to load pass details: ' + err.message);
    }
  };

  const handleOpenUnloadModal = (gin: GateInwardHeaderRecord) => {
    setUnloadTarget(gin);
    setUnloadTareWeight(gin.tareWeight || '');
    setUnloadRemarks('Consignment physically unloaded at plant receiving bay.');
    setIsUnloadModalOpen(true);
  };

  const handleOpenExitModal = (gin: GateInwardHeaderRecord) => {
    setExitTarget(gin);
    setExitRemarks('Vehicle departure cleared by security.');
    setIsExitModalOpen(true);
  };

  const handleOpenCancelModal = (gin: GateInwardHeaderRecord) => {
    setCancelTarget(gin);
    setCancelReason('');
    setIsCancelModalOpen(true);
  };

  // Add Item Line
  const handleAddItemRow = () => {
    const defaultItem = itemsCatalog[0];
    if (!defaultItem) return;

    const defaultUom =
      uomsCatalog.find((u) => u.uomId === defaultItem.baseUomId) || uomsCatalog[0];

    const newItem: GateInwardItemRecord = {
      itemId: defaultItem.itemId,
      itemCode: defaultItem.itemCode,
      itemName: defaultItem.itemName,
      itemDescription: defaultItem.itemName,
      uomId: defaultUom?.uomId || defaultItem.baseUomId,
      uomCode: defaultUom?.uomCode,
      challanQty: 10,
      packageCount: 1,
      remarks: '',
    };
    setFormItems([...formItems, newItem]);
  };

  // Update Item Line
  const handleUpdateItemRow = (
    index: number,
    field: keyof GateInwardItemRecord,
    val: any,
  ) => {
    const updated = [...formItems];
    const item = { ...updated[index] };

    if (field === 'itemId') {
      const selected = itemsCatalog.find((i) => i.itemId === Number(val));
      if (selected) {
        item.itemId = selected.itemId;
        item.itemCode = selected.itemCode;
        item.itemName = selected.itemName;
        item.itemDescription = selected.itemName;
        item.uomId = selected.baseUomId;
        const uomObj = uomsCatalog.find((u) => u.uomId === selected.baseUomId);
        item.uomCode = uomObj?.uomCode;
      }
    } else if (field === 'uomId') {
      item.uomId = Number(val);
      const uomObj = uomsCatalog.find((u) => u.uomId === Number(val));
      item.uomCode = uomObj?.uomCode;
    } else if (field === 'challanQty') {
      item.challanQty = Math.max(0, Number(val));
    } else if (field === 'packageCount') {
      item.packageCount = Math.max(1, Number(val));
    } else if (field === 'itemDescription') {
      item.itemDescription = String(val);
    } else if (field === 'remarks') {
      item.remarks = String(val);
    }

    updated[index] = item;
    setFormItems(updated);
  };

  // Remove Item Line
  const handleRemoveItemRow = (index: number) => {
    setFormItems(formItems.filter((_, idx) => idx !== index));
  };

  // Sourcing Acceleration: Import from Released PO
  const handleImportPo = async (po: ReleasedPoOption) => {
    setFormPoId(po.poId);
    if (po.vendorId) setFormVendorId(po.vendorId);
    if (po.warehouseId) setFormWarehouseId(po.warehouseId);

    try {
      const res = await apiClient.get<ApiResponse<any>>(
        `/procurement/purchase-orders/${po.poId}`,
      );
      const fullPo = res.data.data;

      const importedItems: GateInwardItemRecord[] = (fullPo.items || []).map((it: any) => ({
        poItemId: it.poItemId,
        itemId: it.itemId,
        itemCode: it.itemCode,
        itemName: it.itemName,
        itemDescription: it.itemDescription || it.itemName,
        uomId: it.uomId,
        uomCode: it.uomCode,
        challanQty: Number(it.orderedQty) || 1,
        packageCount: 1,
        remarks: `Inward against PO ${fullPo.poNo}`,
      }));

      setFormItems(importedItems);
      setIsImportPoOpen(false);
    } catch (err: any) {
      alert('Failed to load PO items: ' + err.message);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (gateInwards.length === 0) return;
    const headers = [
      'GIN Number',
      'Inward Date',
      'Inward Time',
      'Vehicle No',
      'Transporter',
      'Driver Name',
      'Driver Phone',
      'Supplier Code',
      'Supplier Name',
      'Warehouse',
      'PO Number',
      'Challan No',
      'Challan Date',
      'E-Way Bill No',
      'LR No',
      'Gross Wt (kg)',
      'Tare Wt (kg)',
      'Net Wt (kg)',
      'Packages',
      'Status',
    ];

    const rows = gateInwards.map((g) => [
      `"${g.gateInwardNo}"`,
      `"${g.inwardDate}"`,
      `"${g.inwardTime}"`,
      `"${g.vehicleNo}"`,
      `"${(g.transporterName || '').replace(/"/g, '""')}"`,
      `"${(g.driverName || '').replace(/"/g, '""')}"`,
      `"${(g.driverPhone || '').replace(/"/g, '""')}"`,
      `"${g.vendorCode}"`,
      `"${g.vendorName.replace(/"/g, '""')}"`,
      `"${g.warehouseName.replace(/"/g, '""')}"`,
      `"${g.poNo || ''}"`,
      `"${g.challanNo.replace(/"/g, '""')}"`,
      `"${g.challanDate}"`,
      `"${g.ewayBillNo || ''}"`,
      `"${g.lrNo || ''}"`,
      g.grossWeight.toFixed(3),
      g.tareWeight.toFixed(3),
      g.netWeight.toFixed(3),
      g.totalPackages,
      `"${g.status}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `Gate_Inward_Register_${new Date().toISOString().split('T')[0]}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    logActionMutation.mutate('EXPORT');
  };

  // --------------------------------------------------------------------------
  // TABLE COLUMNS CONFIGURATION
  // --------------------------------------------------------------------------

  const columns: MasterTableColumn<GateInwardHeaderRecord>[] = [
    {
      key: 'gateInwardNo',
      header: 'Gate Inward #',
      sortable: true,
      sortValue: (r) => r.gateInwardNo,
      render: (row) => (
        <div className="flex flex-col">
          <button
            onClick={() => handleViewDetails(row.gateInwardId)}
            className="font-mono font-bold text-primary hover:underline text-left flex items-center gap-1.5"
          >
            <Truck className="w-3.5 h-3.5 text-primary" />
            {row.gateInwardNo}
          </button>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="font-mono text-xs font-semibold text-foreground px-1.5 py-0.5 rounded bg-muted border border-border">
              {row.vehicleNo}
            </span>
            <span className="text-[11px] text-muted-foreground font-mono">
              {row.itemsCount} {row.itemsCount === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'inwardTime',
      header: 'Entry Date & Time',
      sortable: true,
      sortValue: (r) => `${r.inwardDate} ${r.inwardTime}`,
      render: (row) => (
        <div className="flex flex-col text-xs font-mono">
          <span className="font-medium text-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            {row.inwardDate}
          </span>
          <span className="text-muted-foreground flex items-center gap-1 mt-0.5">
            <Clock className="w-3 h-3 text-amber-500" />
            {row.inwardTime}
          </span>
        </div>
      ),
    },
    {
      key: 'vendor',
      header: 'Supplier & Challan',
      sortable: true,
      sortValue: (r) => r.vendorName,
      render: (row) => (
        <div className="flex flex-col text-xs max-w-[200px]">
          <span className="font-semibold text-foreground truncate" title={row.vendorName}>
            {row.vendorName}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
            <FileText className="w-3 h-3 text-muted-foreground" />
            Challan: {row.challanNo}
          </span>
        </div>
      ),
    },
    {
      key: 'warehouse',
      header: 'Receiving Plant',
      sortable: true,
      sortValue: (r) => r.warehouseName,
      render: (row) => (
        <div className="flex flex-col text-xs">
          <span className="font-medium text-foreground flex items-center gap-1">
            <Warehouse className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            {row.warehouseName}
          </span>
          {row.poNo && (
            <span className="font-mono text-[11px] text-primary flex items-center gap-1 mt-0.5">
              PO: {row.poNo}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'weights',
      header: 'Weighment & Packages',
      sortable: true,
      sortValue: (r) => r.netWeight,
      render: (row) => (
        <div className="flex flex-col text-xs font-mono">
          <span className="font-bold text-foreground">
            Net: {row.netWeight.toLocaleString('en-IN', { minimumFractionDigits: 3 })} kg
          </span>
          <span className="text-[11px] text-muted-foreground">
            Gross: {row.grossWeight.toFixed(0)} | {row.totalPackages} pkgs
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Inward Status',
      sortable: true,
      sortValue: (r) => r.status,
      render: (row) => {
        const badge = STATUS_BADGE_MAP[row.status] || STATUS_BADGE_MAP.INWARDED;
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
            {badge.label}
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
            onClick={() => handleViewDetails(row.gateInwardId)}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="View Gate Inward Details"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Print Security Pass */}
          <PermissionGate screen="GATE_INWARD" action="PRINT">
            <button
              onClick={() => handleOpenPrintPass(row)}
              className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Print Gate Inward Pass"
            >
              <Printer className="w-4 h-4 text-primary" />
            </button>
          </PermissionGate>

          {/* Mark Unloaded (if INWARDED) */}
          {row.status === 'INWARDED' && (
            <PermissionGate screen="GATE_INWARD" action="UNLOAD">
              <button
                onClick={() => handleOpenUnloadModal(row)}
                className="p-1 rounded hover:bg-indigo-500/10 text-indigo-600 hover:text-indigo-700 transition-colors"
                title="Mark Consignment Unloaded"
              >
                <Package className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {/* Authorize Exit (if UNLOADED or GRN_PENDING) */}
          {['UNLOADED', 'GRN_PENDING'].includes(row.status) && (
            <PermissionGate screen="GATE_INWARD" action="EXIT">
              <button
                onClick={() => handleOpenExitModal(row)}
                className="p-1 rounded hover:bg-emerald-500/10 text-emerald-600 hover:text-emerald-700 transition-colors"
                title="Authorize Vehicle Gate Exit"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {/* Edit (if INWARDED or UNLOADED) */}
          {['INWARDED', 'UNLOADED'].includes(row.status) && (
            <PermissionGate screen="GATE_INWARD" action="EDIT">
              <button
                onClick={() => handleOpenEditModal(row)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Edit Gate Inward Record"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {/* Cancel (if not COMPLETED and not CANCELLED) */}
          {!['COMPLETED', 'CANCELLED'].includes(row.status) && (
            <PermissionGate screen="GATE_INWARD" action="CANCEL">
              <button
                onClick={() => handleOpenCancelModal(row)}
                className="p-1 rounded hover:bg-rose-500/10 text-rose-500 hover:text-rose-600 transition-colors"
                title="Void / Turn Back Vehicle"
              >
                <XCircle className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}

          {/* Delete (if INWARDED or CANCELLED) */}
          {['INWARDED', 'CANCELLED'].includes(row.status) && (
            <PermissionGate screen="GATE_INWARD" action="DELETE">
              <button
                onClick={() => {
                  setDeleteTarget(row);
                  setDeleteErrorMessage(null);
                  setDeleteConflicts([]);
                }}
                className="p-1 rounded hover:bg-rose-500/10 text-rose-500 hover:text-rose-700 transition-colors"
                title="Delete Gate Record"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </PermissionGate>
          )}
        </div>
      ),
    },
  ];

  const groupByOptions: GroupByOption<GateInwardHeaderRecord>[] = [
    {
      key: 'status',
      label: 'Inward Status',
      groupValue: (r) => r.status,
    },
    {
      key: 'vendor',
      label: 'Supplier / Vendor',
      groupValue: (r) => r.vendorName,
    },
    {
      key: 'warehouse',
      label: 'Receiving Plant',
      groupValue: (r) => r.warehouseName,
    },
    {
      key: 'transporter',
      label: 'Transporter Agency',
      groupValue: (r) => r.transporterName || 'Direct / Unknown',
    },
  ];

  // --------------------------------------------------------------------------
  // RENDER UI
  // --------------------------------------------------------------------------

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Gate Entry & Security Inward Register
            </h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              Procurement Live
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Factory security perimeter logistics, vehicle weighbridge logging, supplier delivery challan inspection, and stores offload clearance.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <PermissionGate screen="GATE_INWARD" action="EXPORT">
            <button
              onClick={handleExportCsv}
              disabled={gateInwards.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-medium transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
              Export Register
            </button>
          </PermissionGate>

          <PermissionGate screen="GATE_INWARD" action="ADD">
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              New Gate Entry
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* KPI Cards (4 summary cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Inwards */}
        <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">
              Total Inward Entries
            </span>
            <div className="text-2xl font-bold font-mono text-foreground">
              {isSummaryLoading ? '...' : summary?.totalInwards || 0}
            </div>
            <p className="text-xs text-muted-foreground">Cumulative gate transactions</p>
          </div>
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Vehicles Inside Plant */}
        <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-500/5 backdrop-blur-sm shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
              Vehicles Inside Plant
            </span>
            <div className="text-2xl font-bold font-mono text-blue-800 dark:text-blue-300">
              {isSummaryLoading ? '...' : summary?.inPlantCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">At gate & offloading bays</p>
          </div>
          <div className="p-3 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400">
            <Truck className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Ready for Stores GRN */}
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-500/5 backdrop-blur-sm shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Ready for Stores GRN
            </span>
            <div className="text-2xl font-bold font-mono text-amber-800 dark:text-amber-300">
              {isSummaryLoading ? '...' : summary?.grnPendingCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">Offloaded, pending receipt voucher</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Completed & Cleared */}
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-500/5 backdrop-blur-sm shadow-xs flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Departed / Completed
            </span>
            <div className="text-2xl font-bold font-mono text-emerald-800 dark:text-emerald-300">
              {isSummaryLoading ? '...' : summary?.completedCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">Vehicle departed factory perimeter</p>
          </div>
          <div className="p-3 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-xl border border-border bg-card/60 backdrop-blur-sm space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> Status:
            </span>
            {(
              [
                ['ALL', 'All Inwards'],
                ['INWARDED', 'At Gate'],
                ['UNLOADED', 'Unloaded'],
                ['GRN_PENDING', 'GRN Pending'],
                ['COMPLETED', 'Completed'],
                ['CANCELLED', 'Voided'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setStatusFilter(val)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === val
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="h-4 w-[1px] bg-border mx-1 hidden sm:block" />

          {/* Warehouse Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Plant:</span>
            <select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              className="text-xs px-2.5 py-1 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Plants</option>
              {warehouses.map((w) => (
                <option key={w.warehouseId} value={w.warehouseId}>
                  {w.warehouseName}
                </option>
              ))}
            </select>
          </div>

          {/* Vendor Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Supplier:</span>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="text-xs px-2.5 py-1 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[180px]"
            >
              <option value="ALL">All Suppliers</option>
              {suppliers.map((v) => (
                <option key={v.partyId} value={v.partyId}>
                  {v.partyName}
                </option>
              ))}
            </select>
          </div>

          {/* Search Box */}
          <div className="ml-auto w-full sm:w-auto relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search GIN #, vehicle, challan, vendor..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="text-xs pl-8 pr-3 py-1.5 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-full sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Main Table */}
      <MasterDataTable<GateInwardHeaderRecord>
        title="Gate Inward Register"
        subtitle="Live physical logistics register tracking incoming supplier trucks, weighments, challans, and offloading clearance"
        screenCode="GATE_INWARD"
        tableNameBadge="Live"
        data={gateInwards}
        rowKey={(row) => row.gateInwardId}
        isLoading={isGinListLoading}
        columns={columns}
        groupByOptions={groupByOptions}
        searchPlaceholder="Search GIN #, vehicle #, challan #, vendor..."
        searchPredicate={(row, query) => {
          const q = query.toLowerCase();
          return (
            row.gateInwardNo.toLowerCase().includes(q) ||
            row.vehicleNo.toLowerCase().includes(q) ||
            row.challanNo.toLowerCase().includes(q) ||
            row.vendorName.toLowerCase().includes(q) ||
            (row.transporterName ? row.transporterName.toLowerCase().includes(q) : false) ||
            (row.driverName ? row.driverName.toLowerCase().includes(q) : false)
          );
        }}
        addButtonLabel="New Gate Entry"
        onAddClick={handleOpenCreateModal}
        onExportClick={handleExportCsv}
      />

      {/* ==================================================================== */}
      {/* MODAL 1: CREATE / EDIT GATE INWARD ENTRY                             */}
      {/* ==================================================================== */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-5xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-bold text-foreground">
                  {editingGin ? `Edit Gate Inward Entry (${editingGin.gateInwardNo})` : 'New Security Gate Inward Entry'}
                </h2>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Form */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Sourcing Acceleration: Import from Released PO */}
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-primary font-medium">
                  <FileText className="w-4 h-4" />
                  <span>PO Inward Synchronization:</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsImportPoOpen(true)}
                  className="px-3 py-1.5 rounded bg-background border border-primary/30 hover:bg-primary/10 text-primary font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Import Released PO Items ({releasedPos.length} active)
                </button>
              </div>

              {/* Grid 1: Basic Logistics Header */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Vehicle Number */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Vehicle Reg No <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. GJ-01-BX-4421"
                    value={formVehicleNo}
                    onChange={(e) => setFormVehicleNo(e.target.value.toUpperCase())}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground font-mono font-bold uppercase"
                  />
                </div>

                {/* Inward Date */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Inward Date
                  </label>
                  <input
                    type="date"
                    value={formInwardDate}
                    onChange={(e) => setFormInwardDate(e.target.value)}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground font-mono"
                  />
                </div>

                {/* Inward Time */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Inward Time
                  </label>
                  <input
                    type="text"
                    value={formInwardTime}
                    onChange={(e) => setFormInwardTime(e.target.value)}
                    placeholder="e.g. 10:30 AM"
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground font-mono"
                  />
                </div>

                {/* Destination Warehouse */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Receiving Warehouse <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formWarehouseId}
                    onChange={(e) => setFormWarehouseId(Number(e.target.value) || '')}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground"
                  >
                    <option value="">-- Select Plant Store --</option>
                    {warehouses.map((w) => (
                      <option key={w.warehouseId} value={w.warehouseId}>
                        {w.warehouseName} ({w.warehouseCode})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Grid 2: Supplier & Inward Documents */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Supplier */}
                <div className="md:col-span-2">
                  <label className="block font-semibold text-foreground mb-1">
                    Supplier / Vendor <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formVendorId}
                    onChange={(e) => setFormVendorId(Number(e.target.value) || '')}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground"
                  >
                    <option value="">-- Select Vendor --</option>
                    {suppliers.map((s) => (
                      <option key={s.partyId} value={s.partyId}>
                        {s.partyName} ({s.partyCode})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Challan No */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Supplier Challan / Inv # <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CH-JSW-2026-0891"
                    value={formChallanNo}
                    onChange={(e) => setFormChallanNo(e.target.value)}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground font-mono font-medium"
                  />
                </div>

                {/* Challan Date */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Challan Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formChallanDate}
                    onChange={(e) => setFormChallanDate(e.target.value)}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground font-mono"
                  />
                </div>
              </div>

              {/* Grid 3: Driver, Transporter & Statutory References */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Transporter */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Transporter Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Gujarat Roadlines"
                    value={formTransporterName}
                    onChange={(e) => setFormTransporterName(e.target.value)}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground"
                  />
                </div>

                {/* Driver Name */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Driver Name
                  </label>
                  <input
                    type="text"
                    placeholder="Driver full name"
                    value={formDriverName}
                    onChange={(e) => setFormDriverName(e.target.value)}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground"
                  />
                </div>

                {/* Driver Phone */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Driver Phone
                  </label>
                  <input
                    type="text"
                    placeholder="+91 98250 11223"
                    value={formDriverPhone}
                    onChange={(e) => setFormDriverPhone(e.target.value)}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground font-mono"
                  />
                </div>

                {/* E-Way Bill Number */}
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    12-digit E-Way Bill #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 241829304912"
                    value={formEwayBillNo}
                    onChange={(e) => setFormEwayBillNo(e.target.value)}
                    className="w-full p-2 rounded-md border border-border bg-background text-foreground font-mono"
                  />
                </div>
              </div>

              {/* Grid 4: Weighbridge & Packages */}
              <div className="p-4 rounded-lg bg-muted/40 border border-border space-y-3">
                <div className="flex items-center gap-2 font-bold text-foreground">
                  <Scale className="w-4 h-4 text-primary" />
                  <span>Weighbridge & Package Inspection</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono">
                  <div>
                    <label className="block font-semibold text-foreground mb-1 font-sans">
                      Gross Weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={formGrossWeight}
                      onChange={(e) => setFormGrossWeight(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full p-2 rounded-md border border-border bg-background text-foreground font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-foreground mb-1 font-sans">
                      Tare Weight (kg)
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      value={formTareWeight}
                      onChange={(e) => setFormTareWeight(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full p-2 rounded-md border border-border bg-background text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-foreground mb-1 font-sans">
                      Net Material Weight (kg)
                    </label>
                    <div className="p-2 rounded-md bg-muted border border-border text-foreground font-bold text-sm">
                      {Math.max(
                        0,
                        (Number(formGrossWeight) || 0) - (Number(formTareWeight) || 0),
                      ).toFixed(3)}{' '}
                      kg
                    </div>
                  </div>
                  <div>
                    <label className="block font-semibold text-foreground mb-1 font-sans">
                      Total Packages / Units
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formTotalPackages}
                      onChange={(e) => setFormTotalPackages(Math.max(1, Number(e.target.value)))}
                      className="w-full p-2 rounded-md border border-border bg-background text-foreground font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Grid 5: Security Gate Remarks */}
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Security Guard & Perimeter Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Seal intact on truck container, test certificates verified with driver."
                  value={formSecurityRemarks}
                  onChange={(e) => setFormSecurityRemarks(e.target.value)}
                  className="w-full p-2 rounded-md border border-border bg-background text-foreground"
                />
              </div>

              {/* Line Items Table */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">Consignment Items (Declared on Challan)</h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground font-mono">
                      {formItems.length} lines
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="px-3 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Item Line
                  </button>
                </div>

                {formItems.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-border rounded-lg bg-muted/20">
                    <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-muted-foreground font-medium">No items added to gate entry yet.</p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Click "+ Add Item Line" or import lines from released Purchase Orders.
                    </p>
                  </div>
                ) : (
                  <div className="border border-border rounded-lg overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                          <th className="p-2 w-8 text-center">#</th>
                          <th className="p-2 min-w-[220px]">Item & Description</th>
                          <th className="p-2 w-28">Challan Qty</th>
                          <th className="p-2 w-24">UOM</th>
                          <th className="p-2 w-24">Packages</th>
                          <th className="p-2 min-w-[180px]">Remarks / Identification</th>
                          <th className="p-2 w-10 text-center"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {formItems.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="p-2 text-center text-muted-foreground font-mono">
                              {idx + 1}
                            </td>
                            <td className="p-2 space-y-1">
                              <select
                                value={item.itemId}
                                onChange={(e) =>
                                  handleUpdateItemRow(idx, 'itemId', e.target.value)
                                }
                                className="w-full p-1.5 rounded border border-border bg-background text-foreground font-medium"
                              >
                                {itemsCatalog.map((i) => (
                                  <option key={i.itemId} value={i.itemId}>
                                    {i.itemCode} - {i.itemName}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                placeholder="Specification or batch code"
                                value={item.itemDescription || ''}
                                onChange={(e) =>
                                  handleUpdateItemRow(idx, 'itemDescription', e.target.value)
                                }
                                className="w-full p-1 rounded border border-border/60 bg-background/50 text-[11px] text-muted-foreground"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="0.001"
                                step="any"
                                value={item.challanQty}
                                onChange={(e) =>
                                  handleUpdateItemRow(idx, 'challanQty', e.target.value)
                                }
                                className="w-full p-1.5 rounded border border-border bg-background text-foreground font-mono font-medium"
                              />
                            </td>
                            <td className="p-2">
                              <select
                                value={item.uomId}
                                onChange={(e) =>
                                  handleUpdateItemRow(idx, 'uomId', e.target.value)
                                }
                                className="w-full p-1.5 rounded border border-border bg-background text-foreground"
                              >
                                {uomsCatalog.map((u) => (
                                  <option key={u.uomId} value={u.uomId}>
                                    {u.uomCode}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2">
                              <input
                                type="number"
                                min="1"
                                value={item.packageCount || 1}
                                onChange={(e) =>
                                  handleUpdateItemRow(idx, 'packageCount', e.target.value)
                                }
                                className="w-full p-1.5 rounded border border-border bg-background text-foreground font-mono"
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="text"
                                placeholder="Bundle tags / inspection note"
                                value={item.remarks || ''}
                                onChange={(e) =>
                                  handleUpdateItemRow(idx, 'remarks', e.target.value)
                                }
                                className="w-full p-1.5 rounded border border-border bg-background text-foreground text-[11px]"
                              />
                            </td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItemRow(idx)}
                                className="p-1 rounded text-rose-500 hover:bg-rose-500/10"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-border bg-muted/40">
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="px-4 py-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveGinMutation.mutate()}
                disabled={saveGinMutation.isPending}
                className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow hover:bg-primary/90 disabled:opacity-50"
              >
                {saveGinMutation.isPending ? 'Saving...' : editingGin ? 'Update Gate Inward' : 'Register Gate Inward'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SOURCING DRAWER: IMPORT FROM RELEASED PURCHASE ORDER                 */}
      {/* ==================================================================== */}
      {isImportPoOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-foreground">Import from Released Purchase Order</h3>
              </div>
              <button
                onClick={() => setIsImportPoOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
              <p className="text-muted-foreground">
                Select an active, commercially released Purchase Order to link this gate entry and import ordered line items.
              </p>
              {releasedPos.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  No released purchase orders available to import.
                </div>
              ) : (
                releasedPos.map((po) => (
                  <div
                    key={po.poId}
                    className="p-3 rounded-lg border border-border hover:border-primary/50 bg-card hover:bg-primary/5 transition-colors flex items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">{po.poNo}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-600 font-semibold border border-emerald-300">
                          Released
                        </span>
                      </div>
                      <p className="text-muted-foreground mt-0.5">
                        Supplier: <span className="font-semibold text-foreground">{po.vendorName}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                        Plant: {po.warehouseName} | PO Date: {po.poDate}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleImportPo(po)}
                      className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-semibold hover:bg-primary/90 text-xs shrink-0"
                    >
                      Import PO
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: GATE INWARD DETAIL DRAWER                                   */}
      {/* ==================================================================== */}
      {isDetailOpen && selectedGin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-3">
                <Truck className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    {selectedGin.gateInwardNo}
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                        STATUS_BADGE_MAP[selectedGin.status].bg
                      } ${STATUS_BADGE_MAP[selectedGin.status].text} ${
                        STATUS_BADGE_MAP[selectedGin.status].border
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${STATUS_BADGE_MAP[selectedGin.status].dot}`}
                      />
                      {STATUS_BADGE_MAP[selectedGin.status].label}
                    </span>
                  </h2>
                  <p className="text-xs text-muted-foreground font-mono">
                    Vehicle: {selectedGin.vehicleNo} | Arrived: {selectedGin.inwardDate} at {selectedGin.inwardTime}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* Top Overview Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/30 border border-border">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Supplier / Vendor</span>
                  <span className="font-semibold text-foreground">{selectedGin.vendorName}</span>
                  <span className="font-mono text-[10px] text-muted-foreground block">
                    Code: {selectedGin.vendorCode}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Receiving Plant</span>
                  <span className="font-semibold text-foreground">{selectedGin.warehouseName}</span>
                  {selectedGin.poNo && (
                    <span className="font-mono text-[11px] text-primary block mt-0.5">
                      PO: {selectedGin.poNo}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Delivery Challan</span>
                  <span className="font-mono font-bold text-foreground block">
                    {selectedGin.challanNo}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground block">
                    Dt: {selectedGin.challanDate}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Transporter & Driver</span>
                  <span className="text-foreground block">{selectedGin.transporterName || 'Direct'}</span>
                  <span className="text-muted-foreground block text-[10px]">
                    {selectedGin.driverName} ({selectedGin.driverPhone || 'N/A'})
                  </span>
                </div>
              </div>

              {/* Weighbridge Summary Banner */}
              <div className="p-4 rounded-lg bg-card border border-border flex items-center justify-between font-mono">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-muted-foreground text-[11px] block">Gross Weight</span>
                    <span className="font-bold text-foreground text-sm">
                      {selectedGin.grossWeight.toFixed(3)} kg
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px] block">Tare Weight</span>
                    <span className="font-bold text-muted-foreground text-sm">
                      {selectedGin.tareWeight.toFixed(3)} kg
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-[11px] block">Net Material Weight</span>
                    <span className="font-bold text-emerald-600 text-sm">
                      {selectedGin.netWeight.toFixed(3)} kg
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-muted-foreground text-[11px] block">Total Consignment Units</span>
                  <span className="font-bold text-foreground text-sm">
                    {selectedGin.totalPackages} packages
                  </span>
                </div>
              </div>

              {/* Unloading Audit Banner */}
              {selectedGin.unloadedDate && (
                <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-200 dark:border-indigo-900/50 flex items-start gap-3">
                  <Package className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-indigo-800 dark:text-indigo-300">
                      Consignment Physically Offloaded
                    </span>
                    <p className="text-[11px] text-indigo-700 dark:text-indigo-400">
                      Unloaded by {selectedGin.unloadedByName || 'Store Officer'} on {selectedGin.unloadedDate}
                    </p>
                    {selectedGin.unloadingRemarks && (
                      <p className="text-[11px] text-muted-foreground italic">
                        "{selectedGin.unloadingRemarks}"
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Vehicle Exit Banner */}
              {selectedGin.exitDate && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-200 dark:border-emerald-900/50 flex items-start gap-3">
                  <LogOut className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-emerald-800 dark:text-emerald-300">
                      Vehicle Departed Premises
                    </span>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      Cleared security gate at {selectedGin.exitDate}
                    </p>
                    {selectedGin.exitRemarks && (
                      <p className="text-[11px] text-muted-foreground italic">
                        "{selectedGin.exitRemarks}"
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Cancellation Banner */}
              {selectedGin.status === 'CANCELLED' && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-200 dark:border-rose-900/50 flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-rose-600 mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <span className="font-bold text-rose-800 dark:text-rose-300">
                      Gate Entry Voided / Vehicle Turned Back
                    </span>
                    <p className="text-[11px] text-rose-700 dark:text-rose-400">
                      Reason: {selectedGin.cancelReason || 'Administrative cancellation'}
                    </p>
                  </div>
                </div>
              )}

              {/* Consignment Items List */}
              <div className="space-y-2">
                <h3 className="font-bold text-foreground text-sm">Challan Line Items</h3>
                <div className="border border-border rounded-lg overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-muted/60 border-b border-border text-muted-foreground font-semibold">
                        <th className="p-2 w-8 text-center">#</th>
                        <th className="p-2">Item Code & Name</th>
                        <th className="p-2 text-right">Challan Qty</th>
                        <th className="p-2">UOM</th>
                        <th className="p-2 text-right">Packages</th>
                        <th className="p-2">Remarks / Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedGin.items?.map((it, idx) => (
                        <tr key={it.gateInwardItemId || idx} className="hover:bg-muted/20">
                          <td className="p-2 text-center text-muted-foreground font-mono">
                            {idx + 1}
                          </td>
                          <td className="p-2">
                            <span className="font-semibold text-foreground">{it.itemCode}</span>
                            <span className="text-muted-foreground block text-[11px]">
                              {it.itemName}
                            </span>
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-foreground">
                            {it.challanQty.toLocaleString('en-IN', { minimumFractionDigits: 3 })}
                          </td>
                          <td className="p-2 font-mono text-muted-foreground">{it.uomCode}</td>
                          <td className="p-2 text-right font-mono">{it.packageCount || 1}</td>
                          <td className="p-2 text-muted-foreground text-[11px]">
                            {it.remarks || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between p-4 border-t border-border bg-muted/40">
              <div className="flex items-center gap-2">
                <PermissionGate screen="GATE_INWARD" action="PRINT">
                  <button
                    onClick={() => handleOpenPrintPass(selectedGin)}
                    className="px-3 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5 text-primary" />
                    Print Inward Pass
                  </button>
                </PermissionGate>
              </div>

              <div className="flex items-center gap-2">
                {selectedGin.status === 'INWARDED' && (
                  <PermissionGate screen="GATE_INWARD" action="UNLOAD">
                    <button
                      onClick={() => handleOpenUnloadModal(selectedGin)}
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-indigo-700"
                    >
                      <Package className="w-3.5 h-3.5" />
                      Mark Unloaded
                    </button>
                  </PermissionGate>
                )}

                {['UNLOADED', 'GRN_PENDING'].includes(selectedGin.status) && (
                  <PermissionGate screen="GATE_INWARD" action="EXIT">
                    <button
                      onClick={() => handleOpenExitModal(selectedGin)}
                      className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-700"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Authorize Exit
                    </button>
                  </PermissionGate>
                )}

                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-foreground text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: MARK CONSIGNMENT UNLOADED                                   */}
      {/* ==================================================================== */}
      {isUnloadModalOpen && unloadTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2 text-indigo-600">
                <Package className="w-5 h-5" />
                <h3 className="font-bold text-foreground">Mark Consignment Unloaded</h3>
              </div>
              <button
                onClick={() => setIsUnloadModalOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-200 dark:border-indigo-900/50 text-indigo-800 dark:text-indigo-300">
                <p className="font-semibold">Confirming Physical Unloading</p>
                <p className="text-[11px] mt-0.5">
                  Vehicle <span className="font-mono font-bold">{unloadTarget.vehicleNo}</span> ({unloadTarget.gateInwardNo}) from{' '}
                  <span className="font-bold">{unloadTarget.vendorName}</span> will be marked as unloaded and ready for store GRN creation.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Post-Unloading Empty Vehicle Tare Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={unloadTareWeight}
                  onChange={(e) => setUnloadTareWeight(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="Record second weighment tare weight"
                  className="w-full p-2.5 rounded-md border border-border bg-background text-foreground font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Unloading & Stacking Remarks
                </label>
                <textarea
                  rows={2}
                  value={unloadRemarks}
                  onChange={(e) => setUnloadRemarks(e.target.value)}
                  placeholder="e.g. Unloaded at Receiving Bay 2, stacked on wooden pallets."
                  className="w-full p-2.5 rounded-md border border-border bg-background text-foreground"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/40">
              <button
                onClick={() => setIsUnloadModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  markUnloadedMutation.mutate({
                    id: unloadTarget.gateInwardId,
                    tareWeight: unloadTareWeight === '' ? undefined : Number(unloadTareWeight),
                    unloadingRemarks: unloadRemarks.trim() || undefined,
                  })
                }
                disabled={markUnloadedMutation.isPending}
                className="px-5 py-2 rounded-lg bg-indigo-600 text-white text-xs font-bold shadow hover:bg-indigo-700 disabled:opacity-50"
              >
                {markUnloadedMutation.isPending ? 'Processing...' : 'Confirm Consignment Unloaded'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: AUTHORIZE VEHICLE GATE EXIT                                 */}
      {/* ==================================================================== */}
      {isExitModalOpen && exitTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2 text-emerald-600">
                <LogOut className="w-5 h-5" />
                <h3 className="font-bold text-foreground">Authorize Vehicle Gate Exit</h3>
              </div>
              <button
                onClick={() => setIsExitModalOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-300">
                <p className="font-semibold">Confirming Vehicle Outward Departure</p>
                <p className="text-[11px] mt-0.5">
                  Authorize departure for truck <span className="font-mono font-bold">{exitTarget.vehicleNo}</span>. Security outpass will be closed.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Security Guard Outward Remarks
                </label>
                <input
                  type="text"
                  value={exitRemarks}
                  onChange={(e) => setExitRemarks(e.target.value)}
                  placeholder="e.g. Empty truck inspected, gate exit pass handed to driver."
                  className="w-full p-2.5 rounded-md border border-border bg-background text-foreground"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/40">
              <button
                onClick={() => setIsExitModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  recordExitMutation.mutate({
                    id: exitTarget.gateInwardId,
                    exitRemarks: exitRemarks.trim() || undefined,
                  })
                }
                disabled={recordExitMutation.isPending}
                className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold shadow hover:bg-emerald-700 disabled:opacity-50"
              >
                {recordExitMutation.isPending ? 'Recording Departure...' : 'Authorize Exit & Depart'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 5: CANCEL GATE INWARD                                          */}
      {/* ==================================================================== */}
      {isCancelModalOpen && cancelTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2 text-rose-600">
                <XCircle className="w-5 h-5" />
                <h3 className="font-bold text-foreground">Void / Turn Back Vehicle</h3>
              </div>
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="p-1 rounded hover:bg-muted text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-300">
                <p className="font-semibold">Turn back vehicle or void gate entry?</p>
                <p className="text-[11px] mt-0.5">
                  Entry <span className="font-mono font-bold">{cancelTarget.gateInwardNo}</span> for vehicle{' '}
                  <span className="font-bold">{cancelTarget.vehicleNo}</span> will be marked as CANCELLED.
                </p>
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Reason for Cancellation <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Invalid delivery challan, mismatched plant delivery address, damaged packaging."
                  className="w-full p-2.5 rounded-md border border-border bg-background text-foreground"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t border-border bg-muted/40">
              <button
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-border bg-background text-foreground hover:bg-muted text-xs font-semibold"
              >
                Dismiss
              </button>
              <button
                onClick={() =>
                  cancelGinMutation.mutate({
                    id: cancelTarget.gateInwardId,
                    cancelReason: cancelReason.trim(),
                  })
                }
                disabled={cancelGinMutation.isPending || !cancelReason.trim()}
                className="px-5 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold shadow hover:bg-rose-700 disabled:opacity-50"
              >
                {cancelGinMutation.isPending ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 6: PRINTABLE SECURITY GATE INWARD PASS VOUCHER                 */}
      {/* ==================================================================== */}
      {isPrintModalOpen && printTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl my-8 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-foreground">Security Inward Gate Pass Preview</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs flex items-center gap-1.5 hover:bg-primary/90"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Pass
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Paper */}
            <div className="p-8 overflow-y-auto bg-white text-slate-900 font-sans text-xs space-y-6">
              {/* Document Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    KASHVIRA INFOTECH PRIVATE LIMITED
                  </h1>
                  <p className="text-[11px] text-slate-600">
                    Industrial Manufacturing Division | Security Main Gate & Weighbridge
                  </p>
                  <p className="text-[11px] text-slate-600 font-mono">
                    Plant: {printTarget.warehouseName} | GSTIN: 24AABCK1234F1Z8
                  </p>
                </div>
                <div className="text-right">
                  <div className="inline-block px-3 py-1 bg-slate-900 text-white font-bold text-sm tracking-wider uppercase rounded">
                    SECURITY INWARD PASS
                  </div>
                  <p className="font-mono font-bold text-sm text-slate-900 mt-2">
                    {printTarget.gateInwardNo}
                  </p>
                  <p className="text-[11px] text-slate-600 font-mono">
                    Time: {printTarget.inwardDate} ({printTarget.inwardTime})
                  </p>
                </div>
              </div>

              {/* Vehicle & Supplier Grid */}
              <div className="grid grid-cols-2 gap-6 border border-slate-300 rounded p-4 text-xs">
                <div>
                  <h4 className="font-bold text-slate-800 uppercase text-[11px] mb-1">
                    VEHICLE & TRANSPORTER DETAILS:
                  </h4>
                  <p className="font-mono font-bold text-slate-900 text-base">
                    {printTarget.vehicleNo}
                  </p>
                  <p className="text-slate-700 mt-1">
                    Transporter: <span className="font-semibold">{printTarget.transporterName || 'Direct'}</span>
                  </p>
                  <p className="text-slate-700">
                    Driver: <span className="font-semibold">{printTarget.driverName || 'N/A'}</span> ({printTarget.driverPhone || 'N/A'})
                  </p>
                  <p className="text-slate-700 font-mono text-[11px] mt-0.5">
                    E-Way Bill: {printTarget.ewayBillNo || 'N/A'} | LR No: {printTarget.lrNo || 'N/A'}
                  </p>
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 uppercase text-[11px] mb-1">
                    SUPPLIER & CHALLAN DETAILS:
                  </h4>
                  <p className="font-bold text-slate-900 text-sm">{printTarget.vendorName}</p>
                  <p className="font-mono text-slate-700 mt-1">
                    Challan / Invoice No: <span className="font-bold">{printTarget.challanNo}</span>
                  </p>
                  <p className="text-slate-700 font-mono text-[11px]">
                    Challan Date: {printTarget.challanDate}
                  </p>
                  {printTarget.poNo && (
                    <p className="text-slate-800 font-mono font-semibold mt-1">
                      Purchase Order: {printTarget.poNo}
                    </p>
                  )}
                </div>
              </div>

              {/* Weighbridge Certificate Box */}
              <div className="border border-slate-400 bg-slate-50 rounded p-3 text-xs">
                <h4 className="font-bold text-slate-800 uppercase text-[11px] mb-2 flex items-center gap-1.5">
                  <Scale className="w-3.5 h-3.5" />
                  Weighbridge Calibration & Weight Certificate:
                </h4>
                <div className="grid grid-cols-4 gap-4 font-mono text-center">
                  <div className="border-r border-slate-300 pr-2">
                    <span className="text-[10px] text-slate-500 uppercase block">Gross Weight</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {printTarget.grossWeight.toFixed(3)} kg
                    </span>
                  </div>
                  <div className="border-r border-slate-300 pr-2">
                    <span className="text-[10px] text-slate-500 uppercase block">Tare Weight</span>
                    <span className="font-bold text-slate-600 text-sm">
                      {printTarget.tareWeight.toFixed(3)} kg
                    </span>
                  </div>
                  <div className="border-r border-slate-300 pr-2">
                    <span className="text-[10px] text-slate-500 uppercase block">Net Weight</span>
                    <span className="font-bold text-emerald-700 text-sm">
                      {printTarget.netWeight.toFixed(3)} kg
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Total Packages</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {printTarget.totalPackages} pkgs
                    </span>
                  </div>
                </div>
              </div>

              {/* Consignment Items Table */}
              <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-800 font-bold border-b border-slate-300">
                    <th className="p-2 border-r border-slate-300 w-8 text-center">#</th>
                    <th className="p-2 border-r border-slate-300">Item Description</th>
                    <th className="p-2 border-r border-slate-300 text-right w-28">Challan Qty</th>
                    <th className="p-2 border-r border-slate-300 text-center w-20">UOM</th>
                    <th className="p-2 border-r border-slate-300 text-right w-24">Packages</th>
                    <th className="p-2">Remarks / Bundle Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y border-b border-slate-300">
                  {printTarget.items?.map((it, idx) => (
                    <tr key={it.gateInwardItemId || idx}>
                      <td className="p-2 border-r border-slate-300 text-center font-mono">
                        {idx + 1}
                      </td>
                      <td className="p-2 border-r border-slate-300">
                        <span className="font-bold text-slate-900">{it.itemCode}</span> - {it.itemName}
                        {it.itemDescription && (
                          <span className="block text-[11px] text-slate-600 italic">
                            {it.itemDescription}
                          </span>
                        )}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-right font-mono font-bold text-slate-900">
                        {it.challanQty.toLocaleString('en-IN', { minimumFractionDigits: 3 })}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-center font-mono text-slate-600">
                        {it.uomCode}
                      </td>
                      <td className="p-2 border-r border-slate-300 text-right font-mono">
                        {it.packageCount || 1}
                      </td>
                      <td className="p-2 text-slate-600 text-[11px]">
                        {it.remarks || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Instructions */}
              <div className="text-[11px] text-slate-600 space-y-1">
                <p>
                  * Materials are admitted inside plant perimeter for inward receipt and store inspection.
                </p>
                <p>
                  * Vehicle must proceed directly to assigned warehouse unloading bay. Unloading and store GRN verification required before vehicle gate departure.
                </p>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-6 pt-12 border-t border-slate-300 text-center text-xs">
                <div>
                  <div className="border-b border-slate-400 pb-1 font-semibold text-slate-800">
                    Security Gate Officer
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Perimeter Check & Verification</p>
                </div>
                <div>
                  <div className="border-b border-slate-400 pb-1 font-semibold text-slate-800">
                    Weighbridge Operator
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Gross/Tare Weight Calibration</p>
                </div>
                <div>
                  <div className="border-b border-slate-400 pb-1 font-semibold text-slate-800">
                    Stores Receiving Officer
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Physical Offload Acceptance</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 7: CONFIRM DELETE MODAL                                        */}
      {/* ==================================================================== */}
      {deleteTarget && (
        <ConfirmDeleteModal
          isOpen={!!deleteTarget}
          entityType="Gate Inward Entry"
          entityName={deleteTarget.gateInwardNo}
          entityCode={deleteTarget.vehicleNo}
          isDeleting={deleteGinMutation.isPending}
          errorMessage={deleteErrorMessage}
          dependencies={deleteConflicts}
          onConfirm={() => deleteGinMutation.mutate(deleteTarget.gateInwardId)}
          onClose={() => {
            setDeleteTarget(null);
            setDeleteErrorMessage(null);
            setDeleteConflicts([]);
          }}
        />
      )}
    </div>
  );
};
