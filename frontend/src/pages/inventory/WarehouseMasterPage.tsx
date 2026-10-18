import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Boxes,
  Building2,
  CheckCircle2,
  CopyPlus,
  Edit3,
  Filter,
  Grid,
  Layers,
  Lock,
  Plus,
  Scale,
  ShieldAlert,
  Sparkles,
  Thermometer,
  Trash2,
  UserCheck,
  Warehouse,
  X,
} from 'lucide-react';
import { apiClient, type ApiResponse } from '../../lib/apiClient';
import {
  MasterDataTable,
  type MasterTableColumn,
} from '../../components/common/MasterDataTable';
import { ConfirmDeleteModal } from '../../components/common/ConfirmDeleteModal';
import { PermissionGate } from '../../components/common/PermissionGate';

// ============================================================================
// TYPES & CATALOGUES
// ============================================================================

export type WarehouseType =
  | 'RAW_MATERIAL'
  | 'WIP_SHOPFLOOR'
  | 'FINISHED_GOODS'
  | 'QUARANTINE_QC'
  | 'REJECTION_SCRAP'
  | 'SPARES_MRO'
  | 'TOOL_CRIB'
  | 'SUBCONTRACT_VENDOR';

export type StorageBinType =
  | 'PALLET_RACK'
  | 'CANTILEVER'
  | 'MEZZANINE_SHELF'
  | 'FLOOR_BULK'
  | 'COLD_CHAMBER'
  | 'SILO_TANK'
  | 'QC_QUARANTINE_CAGE';

export interface WarehouseRecord {
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  warehouseType: WarehouseType;
  targetCompId: number;
  targetCompCode: string;
  targetCompName: string;
  targetBranchId: number;
  targetBranchCode: string;
  targetBranchName: string;
  inchargeEmployeeId: number | null;
  inchargeEmpCode: string | null;
  inchargeFullName: string | null;
  allowNegativeStock: boolean;
  isQcHoldStore: boolean;
  isShopfloorWip: boolean;
  storageTempMinC: number | null;
  storageTempMaxC: number | null;
  addressLocation: string | null;
  isDefault: boolean;
  isActive: boolean;
  totalBinsCount: number;
  activeBinsCount: number;
  distinctZonesCount: number;
  totalMaxWeightKg: number;
  createdDate: string;
  updatedDate: string | null;
}

export interface StorageBinRecord {
  binId: number;
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  warehouseType: WarehouseType;
  targetCompId: number;
  targetCompCode: string;
  targetBranchId: number;
  targetBranchCode: string;
  targetBranchName: string;
  binCode: string;
  binName: string;
  zoneCode: string;
  rackCode: string;
  shelfLevel: string;
  binPosition: string;
  binType: StorageBinType;
  maxWeightKg: number;
  maxVolumeCbm: number | null;
  allowMixedItems: boolean;
  allowMixedBatches: boolean;
  isPickFace: boolean;
  isReceivingStaging: boolean;
  isBlockedForPutaway: boolean;
  isActive: boolean;
  hierarchyPath: string;
  createdDate: string;
  updatedDate: string | null;
}

interface CompanyLookup {
  compId: number;
  compCode: string;
  compName: string;
}

interface BranchLookup {
  branchId: number;
  compId: number;
  branchCode: string;
  branchName: string;
}

interface EmployeeLookup {
  employeeId: number;
  empCode: string;
  fullName: string;
}

const WAREHOUSE_TYPE_META: Record<
  WarehouseType,
  { label: string; badgeClass: string; shortDesc: string }
> = {
  RAW_MATERIAL: {
    label: 'Raw Material Store',
    badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    shortDesc: 'Primary RM coils, sheets, bars, resins & chemicals',
  },
  WIP_SHOPFLOOR: {
    label: 'Shopfloor WIP Store',
    badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    shortDesc: 'Work-in-progress line-side buffers & sub-assemblies',
  },
  FINISHED_GOODS: {
    label: 'Finished Goods Dispatch',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    shortDesc: 'Saleable FG pallet bays & dispatch staging',
  },
  QUARANTINE_QC: {
    label: 'IQC Quarantine Hold',
    badgeClass: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
    shortDesc: 'Blocked incoming & in-process lots awaiting QA clearance',
  },
  REJECTION_SCRAP: {
    label: 'Rejection & Scrap Yard',
    badgeClass: 'bg-rose-500/10 text-rose-600 border-rose-500/30',
    shortDesc: 'Non-conforming material, runners, turnings & vendor returns',
  },
  SPARES_MRO: {
    label: 'Engineering Spares (MRO)',
    badgeClass: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30',
    shortDesc: 'Bearings, hydraulics, lubricants & maintenance consumables',
  },
  TOOL_CRIB: {
    label: 'Tool Crib & Die Room',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
    shortDesc: 'Injection molds, press dies, CNC fixtures & gauges',
  },
  SUBCONTRACT_VENDOR: {
    label: 'Job-Work / Subcontractor',
    badgeClass: 'bg-teal-500/10 text-teal-600 border-teal-500/30',
    shortDesc: 'Virtual stock ledger at external job-work vendor premises',
  },
};

const BIN_TYPE_META: Record<
  StorageBinType,
  { label: string; badgeClass: string }
> = {
  PALLET_RACK: {
    label: 'Heavy Pallet Rack',
    badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  },
  CANTILEVER: {
    label: 'Cantilever Bar/Coil Arm',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
  },
  MEZZANINE_SHELF: {
    label: 'Mezzanine Tote Shelf',
    badgeClass: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30',
  },
  FLOOR_BULK: {
    label: 'Floor Bulk Stack Bay',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  },
  COLD_CHAMBER: {
    label: 'Controlled Temp Chamber',
    badgeClass: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  },
  SILO_TANK: {
    label: 'Resin Silo / Day Tank',
    badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  },
  QC_QUARANTINE_CAGE: {
    label: 'Locked Quarantine Cage',
    badgeClass: 'bg-rose-500/10 text-rose-600 border-rose-500/30',
  },
};

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export const WarehouseMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'WAREHOUSES' | 'STORAGE_BINS'>(
    'WAREHOUSES',
  );
  const [selectedBranchFilter, setSelectedBranchFilter] =
    useState<string>('ALL');
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] =
    useState<string>('ALL');
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Warehouse Create/Edit Modal State
  const [isWarehouseModalOpen, setIsWarehouseModalOpen] = useState(false);
  const [editingWarehouse, setEditingWarehouse] =
    useState<WarehouseRecord | null>(null);
  const [whFormError, setWhFormError] = useState<string | null>(null);
  const [whForm, setWhForm] = useState({
    warehouseCode: '',
    warehouseName: '',
    warehouseType: 'RAW_MATERIAL' as WarehouseType,
    targetCompId: 1,
    targetBranchId: 1,
    inchargeEmployeeId: '' as string | number,
    allowNegativeStock: false,
    isQcHoldStore: false,
    isShopfloorWip: false,
    storageTempMinC: '' as string | number,
    storageTempMaxC: '' as string | number,
    addressLocation: '',
    isDefault: false,
    isActive: true,
  });

  // Storage Bin Create/Edit Modal State
  const [isBinModalOpen, setIsBinModalOpen] = useState(false);
  const [editingBin, setEditingBin] = useState<StorageBinRecord | null>(null);
  const [binFormError, setBinFormError] = useState<string | null>(null);
  const [binForm, setBinForm] = useState({
    warehouseId: 0,
    binCode: '',
    binName: '',
    zoneCode: 'ZONE-A',
    rackCode: 'R01',
    shelfLevel: 'S01',
    binPosition: 'B01',
    binType: 'PALLET_RACK' as StorageBinType,
    maxWeightKg: 1500,
    maxVolumeCbm: '' as string | number,
    allowMixedItems: true,
    allowMixedBatches: false,
    isPickFace: true,
    isReceivingStaging: false,
    isBlockedForPutaway: false,
    isActive: true,
  });

  // Bulk Matrix Generator Modal State
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFormError, setBulkFormError] = useState<string | null>(null);
  const [bulkForm, setBulkForm] = useState({
    warehouseId: 0,
    zoneCode: 'ZONE-A',
    binPrefix: '',
    rackPrefix: 'R',
    rackStart: 1,
    rackEnd: 2,
    shelfStart: 1,
    shelfEnd: 3,
    positionStart: 1,
    positionEnd: 2,
    binType: 'PALLET_RACK' as StorageBinType,
    maxWeightKg: 1500,
    maxVolumeCbm: 2.4,
    allowMixedItems: true,
    allowMixedBatches: false,
  });

  // Delete Confirmation Modal State
  const [deleteTarget, setDeleteTarget] = useState<{
    mode: 'WAREHOUSE' | 'BIN';
    id: number;
    code: string;
    name: string;
  } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDependencies, setDeleteDependencies] = useState<
    Array<{ table: string; label: string; count: number }>
  >([]);

  // ==========================================================================
  // LIVE POSTGRESQL DATA QUERIES
  // ==========================================================================

  const { data: warehouses = [], isLoading: loadingWarehouses } = useQuery({
    queryKey: ['inventory', 'warehouses'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<WarehouseRecord[]>>(
        '/inventory/warehouses',
      );
      return res.data.data || [];
    },
  });

  const { data: storageBins = [], isLoading: loadingBins } = useQuery({
    queryKey: ['inventory', 'storage-bins'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<StorageBinRecord[]>>(
        '/inventory/warehouses/bins',
      );
      return res.data.data || [];
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['org', 'companies', 'lookup'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<CompanyLookup[]>>(
        '/organization/companies',
      );
      return res.data.data || [];
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['org', 'branches', 'lookup'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<BranchLookup[]>>(
        '/organization/branches',
      );
      return res.data.data || [];
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['hr', 'employees', 'lookup'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<EmployeeLookup[]>>(
        '/hr/employees',
      );
      return res.data.data || [];
    },
  });

  // ==========================================================================
  // FILTERED DATA & KPI AGGREGATIONS
  // ==========================================================================

  const filteredWarehouses = useMemo(() => {
    return warehouses.filter((w) => {
      if (
        selectedBranchFilter !== 'ALL' &&
        String(w.targetBranchId) !== selectedBranchFilter
      ) {
        return false;
      }
      return true;
    });
  }, [warehouses, selectedBranchFilter]);

  const filteredBins = useMemo(() => {
    return storageBins.filter((b) => {
      if (
        selectedBranchFilter !== 'ALL' &&
        String(b.targetBranchId) !== selectedBranchFilter
      ) {
        return false;
      }
      if (
        selectedWarehouseFilter !== 'ALL' &&
        String(b.warehouseId) !== selectedWarehouseFilter
      ) {
        return false;
      }
      return true;
    });
  }, [storageBins, selectedBranchFilter, selectedWarehouseFilter]);

  const kpiStats = useMemo(() => {
    const totalWh = warehouses.length;
    const activeWh = warehouses.filter((w) => w.isActive).length;
    const totalBins = storageBins.length;
    const pickFaceBins = storageBins.filter(
      (b) => b.isActive && b.isPickFace && !b.isBlockedForPutaway,
    ).length;
    const totalCapacityTons =
      storageBins.reduce((acc, b) => acc + (Number(b.maxWeightKg) || 0), 0) /
      1000;
    const qcAndWipStores = warehouses.filter(
      (w) => w.isQcHoldStore || w.isShopfloorWip,
    ).length;
    const blockedBins = storageBins.filter((b) => b.isBlockedForPutaway).length;

    return {
      totalWh,
      activeWh,
      totalBins,
      pickFaceBins,
      totalCapacityTons,
      qcAndWipStores,
      blockedBins,
    };
  }, [warehouses, storageBins]);

  // ==========================================================================
  // MUTATIONS
  // ==========================================================================

  const saveWarehouseMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        warehouseCode: whForm.warehouseCode.trim().toUpperCase(),
        warehouseName: whForm.warehouseName.trim(),
        warehouseType: whForm.warehouseType,
        targetCompId: Number(whForm.targetCompId),
        targetBranchId: Number(whForm.targetBranchId),
        inchargeEmployeeId: whForm.inchargeEmployeeId
          ? Number(whForm.inchargeEmployeeId)
          : null,
        allowNegativeStock: whForm.allowNegativeStock,
        isQcHoldStore: whForm.isQcHoldStore,
        isShopfloorWip: whForm.isShopfloorWip,
        storageTempMinC:
          whForm.storageTempMinC !== '' ? Number(whForm.storageTempMinC) : null,
        storageTempMaxC:
          whForm.storageTempMaxC !== '' ? Number(whForm.storageTempMaxC) : null,
        addressLocation: whForm.addressLocation.trim() || null,
        isDefault: whForm.isDefault,
        isActive: whForm.isActive,
      };

      if (editingWarehouse) {
        const res = await apiClient.put<ApiResponse<WarehouseRecord>>(
          `/inventory/warehouses/${editingWarehouse.warehouseId}`,
          payload,
        );
        return res.data.data;
      } else {
        const res = await apiClient.post<ApiResponse<WarehouseRecord>>(
          '/inventory/warehouses',
          payload,
        );
        return res.data.data;
      }
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'warehouses'] });
      queryClient.invalidateQueries({
        queryKey: ['inventory', 'storage-bins'],
      });
      setIsWarehouseModalOpen(false);
      setEditingWarehouse(null);
      setBannerMessage({
        type: 'success',
        text: `Warehouse "${saved.warehouseCode} — ${saved.warehouseName}" saved to PostgreSQL.`,
      });
    },
    onError: (err: any) => {
      setWhFormError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to save warehouse.',
      );
    },
  });

  const saveBinMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        warehouseId: Number(binForm.warehouseId),
        binCode: binForm.binCode.trim().toUpperCase(),
        binName: binForm.binName.trim(),
        zoneCode: binForm.zoneCode.trim().toUpperCase(),
        rackCode: binForm.rackCode.trim().toUpperCase(),
        shelfLevel: binForm.shelfLevel.trim().toUpperCase(),
        binPosition: binForm.binPosition.trim().toUpperCase(),
        binType: binForm.binType,
        maxWeightKg: Number(binForm.maxWeightKg) || 1000,
        maxVolumeCbm:
          binForm.maxVolumeCbm !== '' ? Number(binForm.maxVolumeCbm) : null,
        allowMixedItems: binForm.allowMixedItems,
        allowMixedBatches: binForm.allowMixedBatches,
        isPickFace: binForm.isPickFace,
        isReceivingStaging: binForm.isReceivingStaging,
        isBlockedForPutaway: binForm.isBlockedForPutaway,
        isActive: binForm.isActive,
      };

      if (editingBin) {
        const res = await apiClient.put<ApiResponse<StorageBinRecord>>(
          `/inventory/warehouses/bins/${editingBin.binId}`,
          payload,
        );
        return res.data.data;
      } else {
        const res = await apiClient.post<ApiResponse<StorageBinRecord>>(
          '/inventory/warehouses/bins',
          payload,
        );
        return res.data.data;
      }
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({
        queryKey: ['inventory', 'storage-bins'],
      });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'warehouses'] });
      setIsBinModalOpen(false);
      setEditingBin(null);
      setBannerMessage({
        type: 'success',
        text: `Storage Bin "${saved.binCode}" (${saved.hierarchyPath}) saved to PostgreSQL.`,
      });
    },
    onError: (err: any) => {
      setBinFormError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to save storage bin.',
      );
    },
  });

  const bulkGenerateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<
        ApiResponse<{
          warehouseId: number;
          warehouseCode: string;
          insertedCount: number;
          totalRequested: number;
        }>
      >('/inventory/warehouses/bins/bulk-generate', {
        warehouseId: Number(bulkForm.warehouseId),
        zoneCode: bulkForm.zoneCode.trim().toUpperCase(),
        binPrefix: bulkForm.binPrefix.trim().toUpperCase(),
        rackPrefix: bulkForm.rackPrefix.trim().toUpperCase(),
        rackStart: Number(bulkForm.rackStart),
        rackEnd: Number(bulkForm.rackEnd),
        shelfStart: Number(bulkForm.shelfStart),
        shelfEnd: Number(bulkForm.shelfEnd),
        positionStart: Number(bulkForm.positionStart),
        positionEnd: Number(bulkForm.positionEnd),
        binType: bulkForm.binType,
        maxWeightKg: Number(bulkForm.maxWeightKg),
        maxVolumeCbm: Number(bulkForm.maxVolumeCbm) || null,
        allowMixedItems: bulkForm.allowMixedItems,
        allowMixedBatches: bulkForm.allowMixedBatches,
      });
      return res.data.data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({
        queryKey: ['inventory', 'storage-bins'],
      });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'warehouses'] });
      setIsBulkModalOpen(false);
      setActiveTab('STORAGE_BINS');
      setSelectedWarehouseFilter(String(res.warehouseId));
      setBannerMessage({
        type: 'success',
        text: `Generated ${res.insertedCount} new storage bin coordinates inside warehouse "${res.warehouseCode}".`,
      });
    },
    onError: (err: any) => {
      setBulkFormError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to bulk generate storage bins.',
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      if (deleteTarget.mode === 'WAREHOUSE') {
        await apiClient.delete(`/inventory/warehouses/${deleteTarget.id}`);
      } else {
        await apiClient.delete(`/inventory/warehouses/bins/${deleteTarget.id}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'warehouses'] });
      queryClient.invalidateQueries({
        queryKey: ['inventory', 'storage-bins'],
      });
      setBannerMessage({
        type: 'success',
        text: `${deleteTarget?.mode === 'WAREHOUSE' ? 'Warehouse' : 'Storage Bin'} "${deleteTarget?.code}" deleted.`,
      });
      setDeleteTarget(null);
      setDeleteError(null);
      setDeleteDependencies([]);
    },
    onError: (err: any) => {
      const resp = err?.response?.data;
      setDeleteError(
        resp?.message || err?.message || 'Cannot delete this record.',
      );
      if (Array.isArray(resp?.dependencies)) {
        setDeleteDependencies(resp.dependencies);
      }
    },
  });

  // ==========================================================================
  // MODAL HANDLERS
  // ==========================================================================

  const handleOpenCreateWarehouse = () => {
    const defaultCompId = companies[0]?.compId ?? 1;
    const defaultBranchId =
      branches.find((b) => b.compId === defaultCompId)?.branchId ??
      branches[0]?.branchId ??
      1;
    setEditingWarehouse(null);
    setWhFormError(null);
    setWhForm({
      warehouseCode: '',
      warehouseName: '',
      warehouseType: 'RAW_MATERIAL',
      targetCompId: defaultCompId,
      targetBranchId: defaultBranchId,
      inchargeEmployeeId: '',
      allowNegativeStock: false,
      isQcHoldStore: false,
      isShopfloorWip: false,
      storageTempMinC: '',
      storageTempMaxC: '',
      addressLocation: '',
      isDefault: false,
      isActive: true,
    });
    setIsWarehouseModalOpen(true);
  };

  const handleOpenEditWarehouse = (wh: WarehouseRecord) => {
    setEditingWarehouse(wh);
    setWhFormError(null);
    setWhForm({
      warehouseCode: wh.warehouseCode,
      warehouseName: wh.warehouseName,
      warehouseType: wh.warehouseType,
      targetCompId: wh.targetCompId,
      targetBranchId: wh.targetBranchId,
      inchargeEmployeeId: wh.inchargeEmployeeId ?? '',
      allowNegativeStock: wh.allowNegativeStock,
      isQcHoldStore: wh.isQcHoldStore,
      isShopfloorWip: wh.isShopfloorWip,
      storageTempMinC: wh.storageTempMinC ?? '',
      storageTempMaxC: wh.storageTempMaxC ?? '',
      addressLocation: wh.addressLocation ?? '',
      isDefault: wh.isDefault,
      isActive: wh.isActive,
    });
    setIsWarehouseModalOpen(true);
  };

  const handleOpenCreateBin = (preselectWarehouseId?: number) => {
    const targetWh =
      warehouses.find((w) => w.warehouseId === preselectWarehouseId) ||
      warehouses.find(
        (w) => String(w.warehouseId) === selectedWarehouseFilter,
      ) ||
      warehouses[0];

    setEditingBin(null);
    setBinFormError(null);
    setBinForm({
      warehouseId: targetWh?.warehouseId ?? 0,
      binCode: targetWh ? `${targetWh.warehouseCode}-R01-S01-B01` : '',
      binName: '',
      zoneCode: 'ZONE-A',
      rackCode: 'R01',
      shelfLevel: 'S01',
      binPosition: 'B01',
      binType: 'PALLET_RACK',
      maxWeightKg: 1500,
      maxVolumeCbm: 2.4,
      allowMixedItems: true,
      allowMixedBatches: false,
      isPickFace: true,
      isReceivingStaging: false,
      isBlockedForPutaway: targetWh?.isQcHoldStore ?? false,
      isActive: true,
    });
    setIsBinModalOpen(true);
  };

  const handleOpenEditBin = (bin: StorageBinRecord) => {
    setEditingBin(bin);
    setBinFormError(null);
    setBinForm({
      warehouseId: bin.warehouseId,
      binCode: bin.binCode,
      binName: bin.binName,
      zoneCode: bin.zoneCode,
      rackCode: bin.rackCode,
      shelfLevel: bin.shelfLevel,
      binPosition: bin.binPosition,
      binType: bin.binType,
      maxWeightKg: bin.maxWeightKg,
      maxVolumeCbm: bin.maxVolumeCbm ?? '',
      allowMixedItems: bin.allowMixedItems,
      allowMixedBatches: bin.allowMixedBatches,
      isPickFace: bin.isPickFace,
      isReceivingStaging: bin.isReceivingStaging,
      isBlockedForPutaway: bin.isBlockedForPutaway,
      isActive: bin.isActive,
    });
    setIsBinModalOpen(true);
  };

  const handleCloneBin = (bin: StorageBinRecord) => {
    setEditingBin(null);
    setBinFormError(null);
    setBinForm({
      warehouseId: bin.warehouseId,
      binCode: `${bin.binCode}-COPY`,
      binName: `${bin.binName} (Copy)`,
      zoneCode: bin.zoneCode,
      rackCode: bin.rackCode,
      shelfLevel: bin.shelfLevel,
      binPosition: bin.binPosition,
      binType: bin.binType,
      maxWeightKg: bin.maxWeightKg,
      maxVolumeCbm: bin.maxVolumeCbm ?? '',
      allowMixedItems: bin.allowMixedItems,
      allowMixedBatches: bin.allowMixedBatches,
      isPickFace: bin.isPickFace,
      isReceivingStaging: bin.isReceivingStaging,
      isBlockedForPutaway: bin.isBlockedForPutaway,
      isActive: true,
    });
    setIsBinModalOpen(true);
  };

  const handleOpenBulkGenerator = (preselectWarehouseId?: number) => {
    const targetWh =
      warehouses.find((w) => w.warehouseId === preselectWarehouseId) ||
      warehouses.find(
        (w) => String(w.warehouseId) === selectedWarehouseFilter,
      ) ||
      warehouses[0];

    setBulkFormError(null);
    setBulkForm({
      warehouseId: targetWh?.warehouseId ?? 0,
      zoneCode: 'ZONE-A',
      binPrefix: targetWh?.warehouseCode ?? 'WH',
      rackPrefix: 'R',
      rackStart: 1,
      rackEnd: 2,
      shelfStart: 1,
      shelfEnd: 2,
      positionStart: 1,
      positionEnd: 2,
      binType: 'PALLET_RACK',
      maxWeightKg: 1500,
      maxVolumeCbm: 2.4,
      allowMixedItems: true,
      allowMixedBatches: false,
    });
    setIsBulkModalOpen(true);
  };

  const recordAuditAction = async (actionType: 'PRINT' | 'EXPORT') => {
    try {
      await apiClient.post(`/inventory/warehouses/action/${actionType}`);
    } catch {
      // Non-blocking audit call
    }
  };

  // ==========================================================================
  // TABLE COLUMNS: TAB 1 — PLANT WAREHOUSES & STORES
  // ==========================================================================

  const warehouseColumns = useMemo<MasterTableColumn<WarehouseRecord>[]>(
    () => [
      {
        key: 'warehouseCode',
        header: 'Warehouse Code & Store Title',
        sortValue: (row: WarehouseRecord) => row.warehouseCode,
        sortable: true,
        render: (row: WarehouseRecord) => (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[var(--erp-accent)]/10 text-[var(--erp-accent)] border border-[var(--erp-accent)]/30">
                {row.warehouseCode}
              </span>
              {row.isDefault && (
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                  Default Store
                </span>
              )}
            </div>
            <span className="font-semibold text-[var(--erp-text)] text-xs mt-0.5">
              {row.warehouseName}
            </span>
            {row.addressLocation && (
              <span className="text-[11px] text-[var(--erp-text-muted)] truncate max-w-[260px]">
                {row.addressLocation}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'warehouseType',
        header: 'Store Classification',
        sortValue: (row: WarehouseRecord) => row.warehouseType,
        sortable: true,
        render: (row: WarehouseRecord) => {
          const meta = WAREHOUSE_TYPE_META[row.warehouseType] || {
            label: row.warehouseType,
            badgeClass: 'bg-slate-500/10 text-slate-500 border-slate-500/30',
            shortDesc: '',
          };
          return (
            <div className="flex flex-col gap-1">
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded border w-fit ${meta.badgeClass}`}
              >
                <Warehouse className="w-3 h-3" />
                {meta.label}
              </span>
              <span className="text-[10px] text-[var(--erp-text-muted)]">
                {meta.shortDesc}
              </span>
            </div>
          );
        },
      },
      {
        key: 'plantScope',
        header: 'Plant / Branch Scope',
        sortValue: (row: WarehouseRecord) =>
          `${row.targetCompCode} ${row.targetBranchName}`,
        sortable: true,
        render: (row: WarehouseRecord) => (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--erp-text)]">
              <Building2 className="w-3.5 h-3.5 text-[var(--erp-accent)]" />
              <span>{row.targetCompCode}</span>
              <span className="text-[var(--erp-text-muted)]">▸</span>
              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)]">
                {row.targetBranchCode}
              </span>
            </div>
            <span className="text-[11px] text-[var(--erp-text-muted)]">
              {row.targetBranchName}
            </span>
          </div>
        ),
      },
      {
        key: 'incharge',
        header: 'Store In-Charge & Temp',
        sortValue: (row: WarehouseRecord) =>
          row.inchargeFullName || 'Unassigned',
        sortable: true,
        render: (row: WarehouseRecord) => (
          <div className="flex flex-col gap-1">
            {row.inchargeFullName ? (
              <div className="flex items-center gap-1.5 text-xs text-[var(--erp-text)]">
                <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="font-medium">{row.inchargeFullName}</span>
                <span className="font-mono text-[10px] text-[var(--erp-text-muted)]">
                  ({row.inchargeEmpCode})
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-[var(--erp-text-muted)] italic">
                No Custodian Assigned
              </span>
            )}
            {(row.storageTempMinC !== null || row.storageTempMaxC !== null) && (
              <div className="inline-flex items-center gap-1 text-[10px] font-mono text-sky-600 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded w-fit">
                <Thermometer className="w-3 h-3" />
                {row.storageTempMinC ?? '-'}°C to {row.storageTempMaxC ?? '-'}°C
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'governance',
        header: 'WMS Governance Rules',
        render: (row: WarehouseRecord) => (
          <div className="flex flex-wrap gap-1 max-w-[210px]">
            {row.allowNegativeStock ? (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 border border-rose-500/30">
                Neg. Stock Allowed
              </span>
            ) : (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                Strict Positive Stock
              </span>
            )}
            {row.isQcHoldStore && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 border border-purple-500/30">
                QC Quarantine Hold
              </span>
            )}
            {row.isShopfloorWip && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/30">
                Shopfloor WIP Backflush
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'binTopology',
        header: 'Storage Bin Topology',
        sortValue: (row: WarehouseRecord) => row.totalBinsCount,
        sortable: true,
        render: (row: WarehouseRecord) => (
          <div className="flex items-center justify-between gap-2 bg-[var(--erp-bg-elevated)] px-2.5 py-1.5 rounded-lg border border-[var(--erp-border)]">
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <Boxes className="w-3.5 h-3.5 text-[var(--erp-accent)]" />
                <span className="font-mono text-xs font-bold text-[var(--erp-text)]">
                  {row.activeBinsCount} / {row.totalBinsCount} Bins
                </span>
              </div>
              <span className="text-[10px] text-[var(--erp-text-muted)]">
                {row.distinctZonesCount} Zones •{' '}
                {(Number(row.totalMaxWeightKg) / 1000).toFixed(1)} MT Cap.
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedWarehouseFilter(String(row.warehouseId));
                setActiveTab('STORAGE_BINS');
              }}
              className="text-[11px] font-semibold px-2 py-1 rounded bg-[var(--erp-accent)]/10 text-[var(--erp-accent)] hover:bg-[var(--erp-accent)] hover:text-white transition-colors"
              title="Inspect Storage Bins in this Warehouse"
            >
              Inspect Bins ▸
            </button>
          </div>
        ),
      },
      {
        key: 'isActive',
        header: 'Status',
        sortValue: (row: WarehouseRecord) => (row.isActive ? 1 : 0),
        sortable: true,
        render: (row: WarehouseRecord) =>
          row.isActive ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 border border-slate-500/30">
              Inactive
            </span>
          ),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row: WarehouseRecord) => (
          <div className="flex items-center gap-1.5">
            <PermissionGate screen="WAREHOUSE_MASTER" action="ADD">
              <button
                type="button"
                onClick={() => handleOpenCreateBin(row.warehouseId)}
                className="p-1.5 rounded-lg bg-[var(--erp-bg-elevated)] hover:bg-[var(--erp-accent)]/15 text-[var(--erp-accent)] border border-[var(--erp-border)] transition-colors"
                title="Add Storage Bin to this Warehouse"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </PermissionGate>
            <PermissionGate screen="WAREHOUSE_MASTER" action="EDIT">
              <button
                type="button"
                onClick={() => handleOpenEditWarehouse(row)}
                className="p-1.5 rounded-lg bg-[var(--erp-bg-elevated)] hover:bg-blue-500/15 text-blue-500 border border-[var(--erp-border)] transition-colors"
                title="Edit Warehouse"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </PermissionGate>
            <PermissionGate screen="WAREHOUSE_MASTER" action="DELETE">
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteDependencies([]);
                  setDeleteTarget({
                    mode: 'WAREHOUSE',
                    id: row.warehouseId,
                    code: row.warehouseCode,
                    name: row.warehouseName,
                  });
                }}
                className="p-1.5 rounded-lg bg-[var(--erp-bg-elevated)] hover:bg-rose-500/15 text-rose-500 border border-[var(--erp-border)] transition-colors"
                title="Delete Warehouse"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </PermissionGate>
          </div>
        ),
      },
    ],
    [],
  );

  // ==========================================================================
  // TABLE COLUMNS: TAB 2 — MULTI-LEVEL STORAGE BIN HIERARCHY
  // ==========================================================================

  const binColumns = useMemo<MasterTableColumn<StorageBinRecord>[]>(
    () => [
      {
        key: 'binCode',
        header: 'Storage Bin Coordinate',
        sortValue: (row: StorageBinRecord) => row.binCode,
        sortable: true,
        render: (row: StorageBinRecord) => (
          <div className="flex flex-col gap-0.5">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[var(--erp-accent)]/10 text-[var(--erp-accent)] border border-[var(--erp-accent)]/30 w-fit">
              {row.binCode}
            </span>
            <span className="font-semibold text-xs text-[var(--erp-text)] mt-0.5">
              {row.binName}
            </span>
            <span className="text-[10px] text-[var(--erp-text-muted)]">
              {row.targetBranchCode} • {row.warehouseName}
            </span>
          </div>
        ),
      },
      {
        key: 'hierarchyPath',
        header:
          '5-Level WMS Location Hierarchy (WH ▸ Zone ▸ Rack ▸ Shelf ▸ Bin)',
        sortValue: (row: StorageBinRecord) => row.hierarchyPath,
        sortable: true,
        render: (row: StorageBinRecord) => (
          <div className="flex items-center flex-wrap gap-1 font-mono text-[11px]">
            <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/25 font-bold">
              {row.warehouseCode}
            </span>
            <span className="text-[var(--erp-text-muted)]">▸</span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-600 border border-indigo-500/25 font-semibold">
              {row.zoneCode}
            </span>
            <span className="text-[var(--erp-text-muted)]">▸</span>
            <span className="px-1.5 py-0.5 rounded bg-[var(--erp-bg-elevated)] text-[var(--erp-text)] border border-[var(--erp-border)]">
              Rack {row.rackCode}
            </span>
            <span className="text-[var(--erp-text-muted)]">▸</span>
            <span className="px-1.5 py-0.5 rounded bg-[var(--erp-bg-elevated)] text-[var(--erp-text)] border border-[var(--erp-border)]">
              Shelf {row.shelfLevel}
            </span>
            <span className="text-[var(--erp-text-muted)]">▸</span>
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/25 font-bold">
              Pos {row.binPosition}
            </span>
          </div>
        ),
      },
      {
        key: 'binType',
        header: 'Rack / Bin Type',
        sortValue: (row: StorageBinRecord) => row.binType,
        sortable: true,
        render: (row: StorageBinRecord) => {
          const meta = BIN_TYPE_META[row.binType] || {
            label: row.binType,
            badgeClass: 'bg-slate-500/10 text-slate-500 border-slate-500/30',
          };
          return (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded border ${meta.badgeClass}`}
            >
              <Layers className="w-3 h-3" />
              {meta.label}
            </span>
          );
        },
      },
      {
        key: 'capacity',
        header: 'Load & Volume Limit',
        sortValue: (row: StorageBinRecord) => row.maxWeightKg,
        sortable: true,
        render: (row: StorageBinRecord) => (
          <div className="flex flex-col gap-0.5 font-mono text-xs">
            <div className="flex items-center gap-1 text-[var(--erp-text)] font-bold">
              <Scale className="w-3.5 h-3.5 text-[var(--erp-accent)]" />
              <span>{Number(row.maxWeightKg).toLocaleString()} kg</span>
            </div>
            <span className="text-[10px] text-[var(--erp-text-muted)]">
              {row.maxVolumeCbm !== null
                ? `${row.maxVolumeCbm} CBM Max Vol.`
                : 'Unrestricted Volume'}
            </span>
          </div>
        ),
      },
      {
        key: 'putawayPolicies',
        header: 'WMS Putaway & Picking Controls',
        render: (row: StorageBinRecord) => (
          <div className="flex flex-wrap gap-1 max-w-[240px]">
            {row.isBlockedForPutaway ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 border border-rose-500/30">
                <Lock className="w-2.5 h-2.5" />
                Putaway Blocked
              </span>
            ) : row.isPickFace ? (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                Active Pick-Face
              </span>
            ) : null}
            {row.isReceivingStaging && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/30">
                GRN Staging Bay
              </span>
            )}
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--erp-bg-elevated)] text-[var(--erp-text-muted)] border border-[var(--erp-border)]">
              {row.allowMixedItems ? 'Mixed SKUs OK' : 'Single SKU Only'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--erp-bg-elevated)] text-[var(--erp-text-muted)] border border-[var(--erp-border)]">
              {row.allowMixedBatches ? 'Mixed Heat/Lot' : 'Single Heat/Lot'}
            </span>
          </div>
        ),
      },
      {
        key: 'isActive',
        header: 'Status',
        sortValue: (row: StorageBinRecord) => (row.isActive ? 1 : 0),
        sortable: true,
        render: (row: StorageBinRecord) =>
          row.isActive ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-500 border border-slate-500/30">
              Inactive
            </span>
          ),
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row: StorageBinRecord) => (
          <div className="flex items-center gap-1.5">
            <PermissionGate screen="WAREHOUSE_MASTER" action="ADD">
              <button
                type="button"
                onClick={() => handleCloneBin(row)}
                className="p-1.5 rounded-lg bg-[var(--erp-bg-elevated)] hover:bg-indigo-500/15 text-indigo-500 border border-[var(--erp-border)] transition-colors"
                title="Clone Storage Bin Coordinate"
              >
                <CopyPlus className="w-3.5 h-3.5" />
              </button>
            </PermissionGate>
            <PermissionGate screen="WAREHOUSE_MASTER" action="EDIT">
              <button
                type="button"
                onClick={() => handleOpenEditBin(row)}
                className="p-1.5 rounded-lg bg-[var(--erp-bg-elevated)] hover:bg-blue-500/15 text-blue-500 border border-[var(--erp-border)] transition-colors"
                title="Edit Storage Bin"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </PermissionGate>
            <PermissionGate screen="WAREHOUSE_MASTER" action="DELETE">
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteDependencies([]);
                  setDeleteTarget({
                    mode: 'BIN',
                    id: row.binId,
                    code: row.binCode,
                    name: row.binName,
                  });
                }}
                className="p-1.5 rounded-lg bg-[var(--erp-bg-elevated)] hover:bg-rose-500/15 text-rose-500 border border-[var(--erp-border)] transition-colors"
                title="Delete Storage Bin"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </PermissionGate>
          </div>
        ),
      },
    ],
    [],
  );

  // Compute live bulk matrix preview count
  const bulkMatrixPreview = useMemo(() => {
    const rCount = Math.max(
      1,
      (Number(bulkForm.rackEnd) || 1) - (Number(bulkForm.rackStart) || 1) + 1,
    );
    const sCount = Math.max(
      1,
      (Number(bulkForm.shelfEnd) || 1) - (Number(bulkForm.shelfStart) || 1) + 1,
    );
    const pCount = Math.max(
      1,
      (Number(bulkForm.positionEnd) || 1) -
        (Number(bulkForm.positionStart) || 1) +
        1,
    );
    const total = rCount * sCount * pCount;
    const prefix = (bulkForm.binPrefix || 'WH').toUpperCase();
    const rPfx = (bulkForm.rackPrefix || 'R').toUpperCase();
    const firstCode = `${prefix}-${rPfx}${String(bulkForm.rackStart || 1).padStart(2, '0')}-S${String(bulkForm.shelfStart || 1).padStart(2, '0')}-B${String(bulkForm.positionStart || 1).padStart(2, '0')}`;
    const lastCode = `${prefix}-${rPfx}${String(bulkForm.rackEnd || 1).padStart(2, '0')}-S${String(bulkForm.shelfEnd || 1).padStart(2, '0')}-B${String(bulkForm.positionEnd || 1).padStart(2, '0')}`;
    return { total, firstCode, lastCode };
  }, [bulkForm]);

  return (
    <div className="space-y-5">
      {/* Banner Feedback */}
      {bannerMessage && (
        <div
          className={`flex items-center justify-between px-4 py-3 rounded-xl border text-xs font-medium ${
            bannerMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-600'
          }`}
        >
          <div className="flex items-center gap-2">
            {bannerMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{bannerMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerMessage(null)}
            className="p-1 hover:opacity-75"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header & Primary Action Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[var(--erp-bg-surface)] p-5 rounded-2xl border border-[var(--erp-border)] shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[var(--erp-accent)]/15 text-[var(--erp-accent)] border border-[var(--erp-accent)]/30">
              Phase 3 • Step 3.1 • WMS Foundation
            </span>
            <span className="font-mono text-[11px] text-[var(--erp-text-muted)]">
              SCREEN_CODE: WAREHOUSE_MASTER
            </span>
          </div>
          <h1 className="text-xl font-bold text-[var(--erp-text)] flex items-center gap-2.5">
            <Warehouse className="w-6 h-6 text-[var(--erp-accent)]" />
            Multi-Level Warehouse, Zone, Rack, Shelf &amp; Bin Hierarchy Master
          </h1>
          <p className="text-xs text-[var(--erp-text-muted)] max-w-3xl">
            Configure plant-level Raw Material, Shopfloor WIP, Quarantine QC,
            Tool Crib, and Finished Goods stores alongside 5-level physical rack
            and bin coordinates for barcode putaway, FIFO/FEFO batch picking,
            and negative-stock enforcement.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <PermissionGate screen="WAREHOUSE_MASTER" action="ADD">
            <button
              type="button"
              onClick={() => handleOpenBulkGenerator()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 border border-indigo-500/30 transition-all"
            >
              <Grid className="w-4 h-4" />
              Bulk Rack/Bin Matrix Generator
            </button>
            <button
              type="button"
              onClick={() => handleOpenCreateBin()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--erp-bg-elevated)] hover:bg-[var(--erp-border)] text-[var(--erp-text)] border border-[var(--erp-border)] transition-all"
            >
              <Boxes className="w-4 h-4 text-[var(--erp-accent)]" />
              + Add Storage Bin
            </button>
            <button
              type="button"
              onClick={handleOpenCreateWarehouse}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[var(--erp-accent)] hover:opacity-95 text-white shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              New Plant Warehouse
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* 4 Enterprise KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--erp-bg-surface)] p-4 rounded-xl border border-[var(--erp-border)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--erp-text-muted)]">
              Plant Warehouses &amp; Stores
            </p>
            <p className="text-2xl font-bold text-[var(--erp-text)] mt-1">
              {kpiStats.totalWh}
            </p>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
              {kpiStats.activeWh} Active Plant Stores
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-600">
            <Warehouse className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[var(--erp-bg-surface)] p-4 rounded-xl border border-[var(--erp-border)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--erp-text-muted)]">
              5-Level Storage Bins
            </p>
            <p className="text-2xl font-bold text-[var(--erp-text)] mt-1">
              {kpiStats.totalBins}
            </p>
            <p className="text-[11px] text-indigo-600 font-medium mt-0.5">
              {kpiStats.pickFaceBins} Active Pick-Face Coordinates
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-600">
            <Boxes className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[var(--erp-bg-surface)] p-4 rounded-xl border border-[var(--erp-border)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--erp-text-muted)]">
              Engineered Bin Load Capacity
            </p>
            <p className="text-2xl font-bold text-[var(--erp-text)] mt-1">
              {kpiStats.totalCapacityTons.toFixed(1)}{' '}
              <span className="text-sm font-semibold text-[var(--erp-text-muted)]">
                MT
              </span>
            </p>
            <p className="text-[11px] text-[var(--erp-text-muted)] mt-0.5">
              Rated Rack &amp; Silo Safe Payload
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600">
            <Scale className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[var(--erp-bg-surface)] p-4 rounded-xl border border-[var(--erp-border)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--erp-text-muted)]">
              QC Quarantine &amp; WIP Stores
            </p>
            <p className="text-2xl font-bold text-[var(--erp-text)] mt-1">
              {kpiStats.qcAndWipStores}
            </p>
            <p className="text-[11px] text-amber-600 font-medium mt-0.5">
              {kpiStats.blockedBins} Bins Blocked for Putaway
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-600">
            <ShieldAlert className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Tab Switcher + Plant/Branch Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[var(--erp-bg-surface)] p-3 rounded-xl border border-[var(--erp-border)]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('WAREHOUSES')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'WAREHOUSES'
                ? 'bg-[var(--erp-accent)] text-white shadow-sm'
                : 'bg-[var(--erp-bg-elevated)] text-[var(--erp-text-muted)] hover:text-[var(--erp-text)]'
            }`}
          >
            <Warehouse className="w-4 h-4" />
            1. Plant Warehouses &amp; Stores ({filteredWarehouses.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('STORAGE_BINS')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'STORAGE_BINS'
                ? 'bg-[var(--erp-accent)] text-white shadow-sm'
                : 'bg-[var(--erp-bg-elevated)] text-[var(--erp-text-muted)] hover:text-[var(--erp-text)]'
            }`}
          >
            <Boxes className="w-4 h-4" />
            2. Multi-Level Storage Bin Hierarchy ({filteredBins.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[var(--erp-text-muted)]">
            <Filter className="w-3.5 h-3.5 text-[var(--erp-accent)]" />
            <span className="font-semibold">Plant / Branch:</span>
          </div>
          <select
            value={selectedBranchFilter}
            onChange={(e) => {
              setSelectedBranchFilter(e.target.value);
              setSelectedWarehouseFilter('ALL');
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
          >
            <option value="ALL">All Plants &amp; Branches</option>
            {branches.map((b) => (
              <option key={b.branchId} value={String(b.branchId)}>
                {b.branchCode} — {b.branchName}
              </option>
            ))}
          </select>

          {activeTab === 'STORAGE_BINS' && (
            <select
              value={selectedWarehouseFilter}
              onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
            >
              <option value="ALL">All Warehouses ({warehouses.length})</option>
              {filteredWarehouses.map((w) => (
                <option key={w.warehouseId} value={String(w.warehouseId)}>
                  {w.warehouseCode} — {w.warehouseName} ({w.totalBinsCount} bins)
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* TAB 1: PLANT WAREHOUSES & STORES */}
      {activeTab === 'WAREHOUSES' && (
        <MasterDataTable<WarehouseRecord>
          title="Plant Warehouses & Store Ledger Master"
          subtitle="Real-time PostgreSQL records from tbl_inv_warehouse with bin topology rollups"
          screenCode="WAREHOUSE_MASTER"
          data={filteredWarehouses}
          columns={warehouseColumns}
          rowKey={(row: WarehouseRecord) => row.warehouseId}
          searchPlaceholder="Search by warehouse code, store name, type, plant branch, or custodian..."
          searchPredicate={(row, q) =>
            row.warehouseCode.toLowerCase().includes(q) ||
            row.warehouseName.toLowerCase().includes(q) ||
            row.warehouseType.toLowerCase().includes(q) ||
            row.targetBranchCode.toLowerCase().includes(q) ||
            row.targetBranchName.toLowerCase().includes(q) ||
            (row.inchargeFullName || '').toLowerCase().includes(q)
          }
          groupByOptions={[
            {
              key: 'branch',
              label: 'Plant / Branch',
              groupValue: (row: WarehouseRecord) =>
                `${row.targetCompCode} ▸ ${row.targetBranchCode} (${row.targetBranchName})`,
            },
            {
              key: 'type',
              label: 'Store Type',
              groupValue: (row: WarehouseRecord) =>
                WAREHOUSE_TYPE_META[row.warehouseType]?.label ||
                row.warehouseType,
            },
          ]}
          isLoading={loadingWarehouses}
          onExportClick={() => recordAuditAction('EXPORT')}
          onPrintClick={() => recordAuditAction('PRINT')}
        />
      )}

      {/* TAB 2: MULTI-LEVEL STORAGE BIN HIERARCHY */}
      {activeTab === 'STORAGE_BINS' && (
        <div className="space-y-3">
          {/* Interactive Warehouse Pill Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedWarehouseFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-all ${
                selectedWarehouseFilter === 'ALL'
                  ? 'bg-[var(--erp-accent)] text-white border-[var(--erp-accent)]'
                  : 'bg-[var(--erp-bg-surface)] text-[var(--erp-text-muted)] border-[var(--erp-border)] hover:text-[var(--erp-text)]'
              }`}
            >
              All Warehouses ({storageBins.length} Bins)
            </button>
            {filteredWarehouses.map((wh) => (
              <button
                key={wh.warehouseId}
                type="button"
                onClick={() =>
                  setSelectedWarehouseFilter(String(wh.warehouseId))
                }
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-all flex items-center gap-1.5 ${
                  selectedWarehouseFilter === String(wh.warehouseId)
                    ? 'bg-[var(--erp-accent)] text-white border-[var(--erp-accent)]'
                    : 'bg-[var(--erp-bg-surface)] text-[var(--erp-text)] border-[var(--erp-border)] hover:border-[var(--erp-accent)]'
                }`}
              >
                <span className="font-mono font-bold">{wh.warehouseCode}</span>
                <span className="opacity-80">• {wh.warehouseName}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/15">
                  {wh.totalBinsCount}
                </span>
              </button>
            ))}
          </div>

          <MasterDataTable<StorageBinRecord>
            title="5-Level Storage Bin Coordinate Matrix (Warehouse ▸ Zone ▸ Rack ▸ Shelf ▸ Bin)"
            subtitle="Real-time PostgreSQL records from tbl_inv_storage_bin"
            screenCode="WAREHOUSE_MASTER"
            data={filteredBins}
            columns={binColumns}
            rowKey={(row: StorageBinRecord) => row.binId}
            isLoading={loadingBins}
            searchPlaceholder="Search by bin code, zone, rack, shelf, warehouse, or bin type..."
            searchPredicate={(row, q) =>
              row.binCode.toLowerCase().includes(q) ||
              row.binName.toLowerCase().includes(q) ||
              row.warehouseCode.toLowerCase().includes(q) ||
              row.zoneCode.toLowerCase().includes(q) ||
              row.rackCode.toLowerCase().includes(q) ||
              row.hierarchyPath.toLowerCase().includes(q)
            }
            groupByOptions={[
              {
                key: 'warehouse',
                label: 'Warehouse',
                groupValue: (row: StorageBinRecord) =>
                  `${row.warehouseCode} — ${row.warehouseName}`,
              },
              {
                key: 'zone',
                label: 'Warehouse Zone',
                groupValue: (row: StorageBinRecord) =>
                  `${row.warehouseCode} ▸ Zone ${row.zoneCode}`,
              },
              {
                key: 'binType',
                label: 'Physical Bin Type',
                groupValue: (row: StorageBinRecord) =>
                  BIN_TYPE_META[row.binType]?.label || row.binType,
              },
            ]}
            onExportClick={() => recordAuditAction('EXPORT')}
            onPrintClick={() => recordAuditAction('PRINT')}
          />
        </div>
      )}

      {/* ====================================================================
          MODAL 1: CREATE / EDIT PLANT WAREHOUSE (tbl_inv_warehouse)
         ==================================================================== */}
      {isWarehouseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[var(--erp-bg-surface)] border border-[var(--erp-border)] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--erp-border)] bg-[var(--erp-bg-elevated)]">
              <div className="flex items-center gap-2.5">
                <Warehouse className="w-5 h-5 text-[var(--erp-accent)]" />
                <div>
                  <h2 className="text-sm font-bold text-[var(--erp-text)]">
                    {editingWarehouse
                      ? `Edit Warehouse — ${editingWarehouse.warehouseCode}`
                      : 'Create New Plant Warehouse / Store'}
                  </h2>
                  <p className="text-[11px] text-[var(--erp-text-muted)]">
                    Persisted to PostgreSQL table tbl_inv_warehouse
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsWarehouseModalOpen(false)}
                className="p-1.5 rounded-lg text-[var(--erp-text-muted)] hover:text-[var(--erp-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {whFormError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{whFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Target Company *
                  </label>
                  <select
                    value={whForm.targetCompId}
                    onChange={(e) => {
                      const compId = Number(e.target.value);
                      const firstBranch = branches.find(
                        (b) => b.compId === compId,
                      );
                      setWhForm((prev) => ({
                        ...prev,
                        targetCompId: compId,
                        targetBranchId:
                          firstBranch?.branchId ?? prev.targetBranchId,
                      }));
                    }}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  >
                    {companies.map((c) => (
                      <option key={c.compId} value={c.compId}>
                        {c.compCode} — {c.compName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Plant / Branch Location *
                  </label>
                  <select
                    value={whForm.targetBranchId}
                    onChange={(e) =>
                      setWhForm((prev) => ({
                        ...prev,
                        targetBranchId: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  >
                    {branches
                      .filter((b) => b.compId === Number(whForm.targetCompId))
                      .map((b) => (
                        <option key={b.branchId} value={b.branchId}>
                          {b.branchCode} — {b.branchName}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Warehouse Code *
                  </label>
                  <input
                    type="text"
                    value={whForm.warehouseCode}
                    onChange={(e) =>
                      setWhForm((prev) => ({
                        ...prev,
                        warehouseCode: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="e.g. WH-AHD-RM01"
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Store Classification Type *
                  </label>
                  <select
                    value={whForm.warehouseType}
                    onChange={(e) => {
                      const nextType = e.target.value as WarehouseType;
                      setWhForm((prev) => ({
                        ...prev,
                        warehouseType: nextType,
                        isQcHoldStore: nextType === 'QUARANTINE_QC',
                        isShopfloorWip: nextType === 'WIP_SHOPFLOOR',
                      }));
                    }}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  >
                    {(Object.keys(WAREHOUSE_TYPE_META) as WarehouseType[]).map(
                      (k) => (
                        <option key={k} value={k}>
                          {WAREHOUSE_TYPE_META[k].label} ({k})
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Warehouse / Store Title *
                  </label>
                  <input
                    type="text"
                    value={whForm.warehouseName}
                    onChange={(e) =>
                      setWhForm((prev) => ({
                        ...prev,
                        warehouseName: e.target.value,
                      }))
                    }
                    placeholder="e.g. Changodar Central Raw Material & Coil Store"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Store In-Charge / Custodian Employee
                  </label>
                  <select
                    value={whForm.inchargeEmployeeId}
                    onChange={(e) =>
                      setWhForm((prev) => ({
                        ...prev,
                        inchargeEmployeeId: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  >
                    <option value="">-- Optional Custodian --</option>
                    {employees.map((emp) => (
                      <option key={emp.employeeId} value={emp.employeeId}>
                        {emp.empCode} — {emp.fullName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                      Min Temp (°C)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={whForm.storageTempMinC}
                      onChange={(e) =>
                        setWhForm((prev) => ({
                          ...prev,
                          storageTempMinC: e.target.value,
                        }))
                      }
                      placeholder="e.g. 18"
                      className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                      Max Temp (°C)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={whForm.storageTempMaxC}
                      onChange={(e) =>
                        setWhForm((prev) => ({
                          ...prev,
                          storageTempMaxC: e.target.value,
                        }))
                      }
                      placeholder="e.g. 28"
                      className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Physical Bay / Shed Location Notes
                  </label>
                  <input
                    type="text"
                    value={whForm.addressLocation}
                    onChange={(e) =>
                      setWhForm((prev) => ({
                        ...prev,
                        addressLocation: e.target.value,
                      }))
                    }
                    placeholder="e.g. Shed-A, Gate-2 Heavy Weighbridge Bay"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>
              </div>

              {/* Governance Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[var(--erp-border)]">
                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={whForm.isDefault}
                    onChange={(e) =>
                      setWhForm((prev) => ({
                        ...prev,
                        isDefault: e.target.checked,
                      }))
                    }
                  />
                  <div>
                    <div className="font-semibold text-[var(--erp-text)]">
                      Default Store for this Type
                    </div>
                    <div className="text-[10px] text-[var(--erp-text-muted)]">
                      Auto-selected in GRN, Issue &amp; Production transactions
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={whForm.allowNegativeStock}
                    onChange={(e) =>
                      setWhForm((prev) => ({
                        ...prev,
                        allowNegativeStock: e.target.checked,
                      }))
                    }
                  />
                  <div>
                    <div className="font-semibold text-[var(--erp-text)]">
                      Allow Negative Stock Ledger
                    </div>
                    <div className="text-[10px] text-[var(--erp-text-muted)]">
                      Permit backflush before GRN posting (not recommended)
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={whForm.isQcHoldStore}
                    onChange={(e) =>
                      setWhForm((prev) => ({
                        ...prev,
                        isQcHoldStore: e.target.checked,
                      }))
                    }
                  />
                  <div>
                    <div className="font-semibold text-[var(--erp-text)]">
                      IQC / IPQC Quarantine Hold Store
                    </div>
                    <div className="text-[10px] text-[var(--erp-text-muted)]">
                      Blocks production issue until QA release pass
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={whForm.isShopfloorWip}
                    onChange={(e) =>
                      setWhForm((prev) => ({
                        ...prev,
                        isShopfloorWip: e.target.checked,
                      }))
                    }
                  />
                  <div>
                    <div className="font-semibold text-[var(--erp-text)]">
                      Shopfloor Line-Side WIP Store
                    </div>
                    <div className="text-[10px] text-[var(--erp-text-muted)]">
                      Eligible for work-order BOM component backflushing
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2.5 p-2.5 rounded-xl bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] cursor-pointer text-xs sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={whForm.isActive}
                    onChange={(e) =>
                      setWhForm((prev) => ({
                        ...prev,
                        isActive: e.target.checked,
                      }))
                    }
                  />
                  <span className="font-semibold text-[var(--erp-text)]">
                    Active for Inventory Transactions
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[var(--erp-border)] bg-[var(--erp-bg-elevated)]">
              <button
                type="button"
                onClick={() => setIsWarehouseModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--erp-border)] text-[var(--erp-text-muted)] hover:text-[var(--erp-text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveWarehouseMutation.isPending}
                onClick={() => saveWarehouseMutation.mutate()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[var(--erp-accent)] text-white hover:opacity-95 disabled:opacity-50"
              >
                {saveWarehouseMutation.isPending
                  ? 'Saving...'
                  : editingWarehouse
                    ? 'Update Warehouse'
                    : 'Create Warehouse'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: CREATE / EDIT STORAGE BIN (tbl_inv_storage_bin)
         ==================================================================== */}
      {isBinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[var(--erp-bg-surface)] border border-[var(--erp-border)] rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--erp-border)] bg-[var(--erp-bg-elevated)]">
              <div className="flex items-center gap-2.5">
                <Boxes className="w-5 h-5 text-[var(--erp-accent)]" />
                <div>
                  <h2 className="text-sm font-bold text-[var(--erp-text)]">
                    {editingBin
                      ? `Edit Storage Bin Coordinate — ${editingBin.binCode}`
                      : 'Create 5-Level Storage Bin Coordinate'}
                  </h2>
                  <p className="text-[11px] text-[var(--erp-text-muted)]">
                    Persisted to PostgreSQL table tbl_inv_storage_bin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBinModalOpen(false)}
                className="p-1.5 rounded-lg text-[var(--erp-text-muted)] hover:text-[var(--erp-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {binFormError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{binFormError}</span>
                </div>
              )}

              {/* Live 5-Level Hierarchy Preview Banner */}
              <div className="p-3.5 rounded-xl bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--erp-text-muted)]">
                  Live 5-Level WMS Coordinate Path Preview
                </span>
                <div className="flex items-center flex-wrap gap-1.5 font-mono text-xs">
                  <span className="px-2 py-0.5 rounded bg-blue-500/15 text-blue-600 font-bold">
                    {warehouses.find(
                      (w) => w.warehouseId === Number(binForm.warehouseId),
                    )?.warehouseCode || 'WH'}
                  </span>
                  <span>▸</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-600 font-bold">
                    {binForm.zoneCode || 'ZONE'}
                  </span>
                  <span>▸</span>
                  <span className="px-2 py-0.5 rounded bg-[var(--erp-bg-surface)] border border-[var(--erp-border)]">
                    Rack {binForm.rackCode || 'R01'}
                  </span>
                  <span>▸</span>
                  <span className="px-2 py-0.5 rounded bg-[var(--erp-bg-surface)] border border-[var(--erp-border)]">
                    Shelf {binForm.shelfLevel || 'S01'}
                  </span>
                  <span>▸</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 font-bold">
                    Bin {binForm.binPosition || 'B01'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Parent Warehouse *
                  </label>
                  <select
                    value={binForm.warehouseId}
                    onChange={(e) =>
                      setBinForm((prev) => ({
                        ...prev,
                        warehouseId: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  >
                    {warehouses.map((w) => (
                      <option key={w.warehouseId} value={w.warehouseId}>
                        {w.warehouseCode} — {w.warehouseName} (
                        {w.targetBranchCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Physical Bin Type *
                  </label>
                  <select
                    value={binForm.binType}
                    onChange={(e) =>
                      setBinForm((prev) => ({
                        ...prev,
                        binType: e.target.value as StorageBinType,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  >
                    {(Object.keys(BIN_TYPE_META) as StorageBinType[]).map(
                      (k) => (
                        <option key={k} value={k}>
                          {BIN_TYPE_META[k].label} ({k})
                        </option>
                      ),
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Barcode / Bin Code *
                  </label>
                  <input
                    type="text"
                    value={binForm.binCode}
                    onChange={(e) =>
                      setBinForm((prev) => ({
                        ...prev,
                        binCode: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="e.g. AHD-RM-Z1-R01-S01-B01"
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Bin Description / Label *
                  </label>
                  <input
                    type="text"
                    value={binForm.binName}
                    onChange={(e) =>
                      setBinForm((prev) => ({
                        ...prev,
                        binName: e.target.value,
                      }))
                    }
                    placeholder="e.g. Heavy Coil Bay A • Rack 01 Ground"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>
              </div>

              {/* 4 Coordinate Fields */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Zone Code *
                  </label>
                  <input
                    type="text"
                    value={binForm.zoneCode}
                    onChange={(e) =>
                      setBinForm((prev) => ({
                        ...prev,
                        zoneCode: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Rack Code *
                  </label>
                  <input
                    type="text"
                    value={binForm.rackCode}
                    onChange={(e) =>
                      setBinForm((prev) => ({
                        ...prev,
                        rackCode: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Shelf Level *
                  </label>
                  <input
                    type="text"
                    value={binForm.shelfLevel}
                    onChange={(e) =>
                      setBinForm((prev) => ({
                        ...prev,
                        shelfLevel: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Bin Position *
                  </label>
                  <input
                    type="text"
                    value={binForm.binPosition}
                    onChange={(e) =>
                      setBinForm((prev) => ({
                        ...prev,
                        binPosition: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Max Safe Weight (kg) *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={binForm.maxWeightKg}
                    onChange={(e) =>
                      setBinForm((prev) => ({
                        ...prev,
                        maxWeightKg: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Max Volume (CBM)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={binForm.maxVolumeCbm}
                    onChange={(e) =>
                      setBinForm((prev) => ({
                        ...prev,
                        maxVolumeCbm: e.target.value,
                      }))
                    }
                    placeholder="Optional e.g. 2.4"
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>
              </div>

              {/* WMS Putaway & Picking Flags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[var(--erp-border)]">
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={binForm.allowMixedItems}
                    onChange={(e) =>
                      setBinForm((prev) => ({
                        ...prev,
                        allowMixedItems: e.target.checked,
                      }))
                    }
                  />
                  <span>Allow Mixed Item SKUs in Bin</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={binForm.allowMixedBatches}
                    onChange={(e) =>
                      setBinForm((prev) => ({
                        ...prev,
                        allowMixedBatches: e.target.checked,
                      }))
                    }
                  />
                  <span>Allow Mixed Heat / Lot Numbers</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={binForm.isPickFace}
                    onChange={(e) =>
                      setBinForm((prev) => ({
                        ...prev,
                        isPickFace: e.target.checked,
                      }))
                    }
                  />
                  <span>Primary FIFO/FEFO Pick-Face Location</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={binForm.isReceivingStaging}
                    onChange={(e) =>
                      setBinForm((prev) => ({
                        ...prev,
                        isReceivingStaging: e.target.checked,
                      }))
                    }
                  />
                  <span>GRN Dock Receiving Staging Bay</span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/25 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={binForm.isBlockedForPutaway}
                    onChange={(e) =>
                      setBinForm((prev) => ({
                        ...prev,
                        isBlockedForPutaway: e.target.checked,
                      }))
                    }
                  />
                  <span className="text-rose-600 font-semibold">
                    Block Bin for Regular Putaway
                  </span>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={binForm.isActive}
                    onChange={(e) =>
                      setBinForm((prev) => ({
                        ...prev,
                        isActive: e.target.checked,
                      }))
                    }
                  />
                  <span className="font-semibold">Bin Active</span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[var(--erp-border)] bg-[var(--erp-bg-elevated)]">
              <button
                type="button"
                onClick={() => setIsBinModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--erp-border)] text-[var(--erp-text-muted)] hover:text-[var(--erp-text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveBinMutation.isPending}
                onClick={() => saveBinMutation.mutate()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[var(--erp-accent)] text-white hover:opacity-95 disabled:opacity-50"
              >
                {saveBinMutation.isPending
                  ? 'Saving...'
                  : editingBin
                    ? 'Update Storage Bin'
                    : 'Create Storage Bin'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: BULK RACK / SHELF / BIN MATRIX GENERATOR
         ==================================================================== */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[var(--erp-bg-surface)] border border-[var(--erp-border)] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--erp-border)] bg-[var(--erp-bg-elevated)]">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <div>
                  <h2 className="text-sm font-bold text-[var(--erp-text)]">
                    Bulk Rack / Shelf / Bin Coordinate Matrix Generator
                  </h2>
                  <p className="text-[11px] text-[var(--erp-text-muted)]">
                    Atomically generate multi-rack, multi-shelf storage bins in
                    PostgreSQL
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="p-1.5 rounded-lg text-[var(--erp-text-muted)] hover:text-[var(--erp-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {bulkFormError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{bulkFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Target Warehouse *
                  </label>
                  <select
                    value={bulkForm.warehouseId}
                    onChange={(e) => {
                      const whId = Number(e.target.value);
                      const wh = warehouses.find(
                        (w) => w.warehouseId === whId,
                      );
                      setBulkForm((prev) => ({
                        ...prev,
                        warehouseId: whId,
                        binPrefix: wh?.warehouseCode || prev.binPrefix,
                      }));
                    }}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  >
                    {warehouses.map((w) => (
                      <option key={w.warehouseId} value={w.warehouseId}>
                        {w.warehouseCode} — {w.warehouseName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Zone Code *
                  </label>
                  <input
                    type="text"
                    value={bulkForm.zoneCode}
                    onChange={(e) =>
                      setBulkForm((prev) => ({
                        ...prev,
                        zoneCode: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Barcode Prefix *
                  </label>
                  <input
                    type="text"
                    value={bulkForm.binPrefix}
                    onChange={(e) =>
                      setBulkForm((prev) => ({
                        ...prev,
                        binPrefix: e.target.value.toUpperCase(),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Rack Range (Start – End)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={bulkForm.rackStart}
                      onChange={(e) =>
                        setBulkForm((prev) => ({
                          ...prev,
                          rackStart: Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                    />
                    <span className="text-xs text-[var(--erp-text-muted)]">
                      to
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={bulkForm.rackEnd}
                      onChange={(e) =>
                        setBulkForm((prev) => ({
                          ...prev,
                          rackEnd: Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Shelf Range (Start – End)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={bulkForm.shelfStart}
                      onChange={(e) =>
                        setBulkForm((prev) => ({
                          ...prev,
                          shelfStart: Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                    />
                    <span className="text-xs text-[var(--erp-text-muted)]">
                      to
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={bulkForm.shelfEnd}
                      onChange={(e) =>
                        setBulkForm((prev) => ({
                          ...prev,
                          shelfEnd: Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Bin Position Range (Start – End)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={bulkForm.positionStart}
                      onChange={(e) =>
                        setBulkForm((prev) => ({
                          ...prev,
                          positionStart: Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                    />
                    <span className="text-xs text-[var(--erp-text-muted)]">
                      to
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={bulkForm.positionEnd}
                      onChange={(e) =>
                        setBulkForm((prev) => ({
                          ...prev,
                          positionEnd: Number(e.target.value),
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Max Weight per Bin (kg)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={bulkForm.maxWeightKg}
                    onChange={(e) =>
                      setBulkForm((prev) => ({
                        ...prev,
                        maxWeightKg: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>
              </div>

              {/* Matrix Preview Box */}
              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-600">
                  <span>Coordinates to Generate:</span>
                  <span className="font-mono text-sm">
                    {bulkMatrixPreview.total} Storage Bins
                  </span>
                </div>
                <p className="text-[11px] font-mono text-[var(--erp-text-muted)]">
                  Range: {bulkMatrixPreview.firstCode} ➔{' '}
                  {bulkMatrixPreview.lastCode}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[var(--erp-border)] bg-[var(--erp-bg-elevated)]">
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--erp-border)] text-[var(--erp-text-muted)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  bulkGenerateMutation.isPending ||
                  bulkMatrixPreview.total > 100
                }
                onClick={() => bulkGenerateMutation.mutate()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:opacity-95 disabled:opacity-50"
              >
                {bulkGenerateMutation.isPending
                  ? 'Generating Matrix...'
                  : `Generate ${bulkMatrixPreview.total} Bins`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 4: CONFIRM DELETE MODAL
         ==================================================================== */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        entityType={
          deleteTarget?.mode === 'WAREHOUSE'
            ? 'Plant Warehouse'
            : 'Storage Bin Coordinate'
        }
        entityName={deleteTarget?.name || ''}
        entityCode={deleteTarget?.code || ''}
        isDeleting={deleteMutation.isPending}
        errorMessage={deleteError}
        dependencies={deleteDependencies}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteError(null);
          setDeleteDependencies([]);
        }}
        onConfirm={() => deleteMutation.mutate()}
      />
    </div>
  );
};

export default WarehouseMasterPage;
