import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  Clock,
  Compass,
  DollarSign,
  Edit3,
  Factory,
  FileSpreadsheet,
  Filter,
  Flame,
  FolderTree,
  Hash,
  HelpCircle,
  Layers,
  Package,
  Percent,
  Plus,
  Printer,
  Scale,
  Search,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Trash2,
  Warehouse,
  Wrench,
  X,
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
// TYPES & CATALOGUES
// ============================================================================

export type ItemType =
  | 'RAW_MATERIAL'
  | 'WIP_SEMI_FINISHED'
  | 'FINISHED_GOODS'
  | 'PACKING_MATERIAL'
  | 'CONSUMABLE_MRO'
  | 'TOOLING_DIE'
  | 'SCRAP';

export type ValuationMethod = 'FIFO' | 'WEIGHTED_AVG' | 'STANDARD_COST';

export interface ItemRecord {
  itemId: number;
  itemCode: string;
  itemName: string;
  categoryId: number;
  categoryCode: string;
  categoryName: string;
  categoryHierarchyPath: string;
  itemType: ItemType;
  description: string | null;
  baseUomId: number;
  baseUomCode: string;
  baseUomName: string;
  purchaseUomId: number;
  purchaseUomCode: string;
  purchaseUomName: string;
  salesUomId: number;
  salesUomCode: string;
  salesUomName: string;
  hsnSacCode: string | null;
  taxRate: number;
  standardCost: number;
  purchaseRate: number;
  salesRate: number;
  minStockLevel: number;
  maxStockLevel: number | null;
  reorderPoint: number;
  safetyStock: number;
  leadTimeDays: number;
  valuationMethod: ValuationMethod;
  isBatchManaged: boolean;
  isSerialManaged: boolean;
  isQcInspectionRequired: boolean;
  shelfLifeDays: number | null;
  defaultWarehouseId: number | null;
  defaultWarehouseCode: string | null;
  defaultWarehouseName: string | null;
  defaultBinId: number | null;
  defaultBinCode: string | null;
  defaultBinName: string | null;
  drawingNo: string | null;
  revisionNo: string | null;
  weightPerUnitKg: number | null;
  isBomAllowed: boolean;
  yieldPercentage: number;
  inspectionLeadTimeDays: number;
  isActive: boolean;
  compId: number;
  branchId: number;
  createdDate: string;
  updatedDate: string | null;
}

export interface ItemSummary {
  totalItems: number;
  activeFinishedGoods: number;
  rawMaterialsCount: number;
  wipItemsCount: number;
  batchQcCount: number;
}

export interface UomOption {
  uomId: number;
  uomCode: string;
  uomName: string;
  uomType: string;
  gstUqcCode: string;
}

export interface CategoryOption {
  categoryId: number;
  categoryCode: string;
  categoryName: string;
  hierarchyPath: string;
  categoryType: string;
  defaultTaxRate: number;
  defaultValuationMethod: ValuationMethod;
}

export interface WarehouseOption {
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  warehouseType: string;
}

export interface StorageBinOption {
  binId: number;
  warehouseId: number;
  binCode: string;
  binName: string;
  zoneCode: string;
}

const ITEM_TYPE_META: Record<
  ItemType,
  { label: string; badgeClass: string; icon: React.ElementType }
> = {
  RAW_MATERIAL: {
    label: 'Raw Material',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    icon: Boxes,
  },
  WIP_SEMI_FINISHED: {
    label: 'WIP / Sub-Assembly',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    icon: Layers,
  },
  FINISHED_GOODS: {
    label: 'Finished Goods',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    icon: Package,
  },
  PACKING_MATERIAL: {
    label: 'Packing Material',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
    icon: Tag,
  },
  CONSUMABLE_MRO: {
    label: 'MRO Consumable',
    badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/30',
    icon: Factory,
  },
  TOOLING_DIE: {
    label: 'Tooling & Die',
    badgeClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
    icon: Wrench,
  },
  SCRAP: {
    label: 'Scrap & Rejection',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
    icon: Flame,
  },
};

const VALUATION_META: Record<ValuationMethod, string> = {
  FIFO: 'First In First Out (FIFO)',
  WEIGHTED_AVG: 'Moving Weighted Average',
  STANDARD_COST: 'Standard Costing',
};

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export const ItemMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters & Search
  const [selectedItemType, setSelectedItemType] = useState<string>('ALL');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ItemRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'planning' | 'costing' | 'governance'>('general');

  // Delete State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<ItemRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteConflicts, setDeleteConflicts] = useState<any[]>([]);

  // Print Preview Modal
  const [printItem, setPrintItem] = useState<ItemRecord | null>(null);

  // Form State
  const initialFormData = {
    itemCode: '',
    itemName: '',
    categoryId: 0,
    itemType: 'RAW_MATERIAL' as ItemType,
    description: '',
    baseUomId: 0,
    purchaseUomId: 0,
    salesUomId: 0,
    hsnSacCode: '',
    taxRate: 18.0,
    standardCost: 0,
    purchaseRate: 0,
    salesRate: 0,
    minStockLevel: 0,
    maxStockLevel: '' as string | number,
    reorderPoint: 0,
    safetyStock: 0,
    leadTimeDays: 7,
    valuationMethod: 'FIFO' as ValuationMethod,
    isBatchManaged: true,
    isSerialManaged: false,
    isQcInspectionRequired: true,
    shelfLifeDays: '' as string | number,
    defaultWarehouseId: '' as string | number,
    defaultBinId: '' as string | number,
    drawingNo: '',
    revisionNo: '',
    weightPerUnitKg: '' as string | number,
    isBomAllowed: true,
    yieldPercentage: 100.0,
    inspectionLeadTimeDays: 1,
    isActive: true,
  };

  const [formData, setFormData] = useState(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // ==========================================================================
  // DATA FETCHING
  // ==========================================================================

  const {
    data: items = [],
    isLoading: isItemsLoading,
  } = useQuery<ItemRecord[]>({
    queryKey: [
      'items',
      selectedItemType,
      selectedCategoryId,
      selectedStatus,
    ],
    queryFn: async () => {
      const params: Record<string, any> = {};
      if (selectedItemType !== 'ALL') params.itemType = selectedItemType;
      if (selectedCategoryId !== 'ALL') params.categoryId = selectedCategoryId;
      if (selectedStatus === 'ACTIVE') params.isActive = true;
      if (selectedStatus === 'INACTIVE') params.isActive = false;

      const res = await apiClient.get<ApiResponse<ItemRecord[]>>(
        '/inventory/items',
        { params },
      );
      return res.data.data;
    },
  });

  const { data: summary } = useQuery<ItemSummary>({
    queryKey: ['items-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ItemSummary>>(
        '/inventory/items/summary',
      );
      return res.data.data;
    },
  });

  const { data: uoms = [] } = useQuery<UomOption[]>({
    queryKey: ['uoms-options'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<UomOption[]>>('/inventory/uoms');
      return res.data.data;
    },
  });

  const { data: categories = [] } = useQuery<CategoryOption[]>({
    queryKey: ['categories-options'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<CategoryOption[]>>(
        '/inventory/uoms/categories',
      );
      return res.data.data;
    },
  });

  const { data: warehouses = [] } = useQuery<WarehouseOption[]>({
    queryKey: ['warehouses-options'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<WarehouseOption[]>>(
        '/inventory/warehouses',
      );
      return res.data.data;
    },
  });

  const { data: storageBins = [] } = useQuery<StorageBinOption[]>({
    queryKey: ['storage-bins-options', formData.defaultWarehouseId],
    queryFn: async () => {
      if (!formData.defaultWarehouseId) return [];
      const res = await apiClient.get<ApiResponse<StorageBinOption[]>>(
        '/inventory/warehouses/bins',
        { params: { warehouseId: formData.defaultWarehouseId } },
      );
      return res.data.data;
    },
    enabled: Boolean(formData.defaultWarehouseId),
  });

  // ==========================================================================
  // MUTATIONS
  // ==========================================================================

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post<ApiResponse<ItemRecord>>(
        '/inventory/items',
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['items-summary'] });
      setIsFormModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to create item SKU';
      setFormErrors((prev) => ({ ...prev, server: msg }));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: number;
      payload: any;
    }) => {
      const res = await apiClient.put<ApiResponse<ItemRecord>>(
        `/inventory/items/${id}`,
        payload,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['items-summary'] });
      setIsFormModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || 'Failed to update item SKU';
      setFormErrors((prev) => ({ ...prev, server: msg }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete<ApiResponse<any>>(
        `/inventory/items/${id}`,
      );
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['items-summary'] });
      setIsDeleteModalOpen(false);
      setDeletingItem(null);
      setDeleteError(null);
      setDeleteConflicts([]);
    },
    onError: (err: any) => {
      const responseData = err.response?.data;
      if (err.response?.status === 409 && responseData?.dependencies) {
        setDeleteConflicts(responseData.dependencies);
        setDeleteError(
          responseData.message ||
            'Cannot delete this item as it is linked to active operational records.',
        );
      } else {
        setDeleteError(
          responseData?.message || 'Failed to delete item due to server error.',
        );
      }
    },
  });

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingItem(null);
    setFormErrors({});
    setActiveTab('general');
  };

  const openCreateModal = () => {
    resetForm();
    if (uoms.length > 0) {
      const firstBase = uoms.find((u) => u.uomCode === 'NOS') || uoms[0];
      setFormData((prev) => ({
        ...prev,
        baseUomId: firstBase.uomId,
        purchaseUomId: firstBase.uomId,
        salesUomId: firstBase.uomId,
      }));
    }
    if (categories.length > 0) {
      setFormData((prev) => ({
        ...prev,
        categoryId: categories[0].categoryId,
        taxRate: categories[0].defaultTaxRate || 18.0,
        valuationMethod: categories[0].defaultValuationMethod || 'FIFO',
      }));
    }
    setIsFormModalOpen(true);
  };

  const openEditModal = (item: ItemRecord) => {
    setEditingItem(item);
    setFormData({
      itemCode: item.itemCode,
      itemName: item.itemName,
      categoryId: item.categoryId,
      itemType: item.itemType,
      description: item.description || '',
      baseUomId: item.baseUomId,
      purchaseUomId: item.purchaseUomId,
      salesUomId: item.salesUomId,
      hsnSacCode: item.hsnSacCode || '',
      taxRate: item.taxRate,
      standardCost: item.standardCost,
      purchaseRate: item.purchaseRate,
      salesRate: item.salesRate,
      minStockLevel: item.minStockLevel,
      maxStockLevel: item.maxStockLevel !== null ? item.maxStockLevel : '',
      reorderPoint: item.reorderPoint,
      safetyStock: item.safetyStock,
      leadTimeDays: item.leadTimeDays,
      valuationMethod: item.valuationMethod,
      isBatchManaged: item.isBatchManaged,
      isSerialManaged: item.isSerialManaged,
      isQcInspectionRequired: item.isQcInspectionRequired,
      shelfLifeDays: item.shelfLifeDays !== null ? item.shelfLifeDays : '',
      defaultWarehouseId: item.defaultWarehouseId || '',
      defaultBinId: item.defaultBinId || '',
      drawingNo: item.drawingNo || '',
      revisionNo: item.revisionNo || '',
      weightPerUnitKg: item.weightPerUnitKg !== null ? item.weightPerUnitKg : '',
      isBomAllowed: item.isBomAllowed,
      yieldPercentage: item.yieldPercentage,
      inspectionLeadTimeDays: item.inspectionLeadTimeDays,
      isActive: item.isActive,
    });
    setFormErrors({});
    setActiveTab('general');
    setIsFormModalOpen(true);
  };

  const openDeleteModal = (item: ItemRecord) => {
    setDeletingItem(item);
    setDeleteError(null);
    setDeleteConflicts([]);
    setIsDeleteModalOpen(true);
  };

  const handleCategoryChange = (catId: number) => {
    const selected = categories.find((c) => c.categoryId === catId);
    setFormData((prev) => ({
      ...prev,
      categoryId: catId,
      taxRate: selected?.defaultTaxRate ?? prev.taxRate,
      valuationMethod: selected?.defaultValuationMethod ?? prev.valuationMethod,
    }));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.itemCode.trim()) {
      errors.itemCode = 'Item Code is required';
    }
    if (!formData.itemName.trim()) {
      errors.itemName = 'Item Name is required';
    }
    if (!formData.categoryId) {
      errors.categoryId = 'Item Category is required';
    }
    if (!formData.baseUomId) {
      errors.baseUomId = 'Base Inventory UOM is required';
    }
    if (formData.taxRate < 0 || formData.taxRate > 100) {
      errors.taxRate = 'GST Rate must be between 0 and 100%';
    }
    if (formData.yieldPercentage <= 0 || formData.yieldPercentage > 100) {
      errors.yieldPercentage = 'Yield % must be between 0.01 and 100%';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const payload: any = {
      itemCode: formData.itemCode.trim().toUpperCase(),
      itemName: formData.itemName.trim(),
      categoryId: Number(formData.categoryId),
      itemType: formData.itemType,
      description: formData.description.trim() || undefined,
      baseUomId: Number(formData.baseUomId),
      purchaseUomId: formData.purchaseUomId ? Number(formData.purchaseUomId) : Number(formData.baseUomId),
      salesUomId: formData.salesUomId ? Number(formData.salesUomId) : Number(formData.baseUomId),
      hsnSacCode: formData.hsnSacCode.trim() || undefined,
      taxRate: Number(formData.taxRate),
      standardCost: Number(formData.standardCost) || 0,
      purchaseRate: Number(formData.purchaseRate) || 0,
      salesRate: Number(formData.salesRate) || 0,
      minStockLevel: Number(formData.minStockLevel) || 0,
      maxStockLevel:
        formData.maxStockLevel !== '' ? Number(formData.maxStockLevel) : undefined,
      reorderPoint: Number(formData.reorderPoint) || 0,
      safetyStock: Number(formData.safetyStock) || 0,
      leadTimeDays: Number(formData.leadTimeDays) || 7,
      valuationMethod: formData.valuationMethod,
      isBatchManaged: formData.isBatchManaged,
      isSerialManaged: formData.isSerialManaged,
      isQcInspectionRequired: formData.isQcInspectionRequired,
      shelfLifeDays:
        formData.shelfLifeDays !== '' ? Number(formData.shelfLifeDays) : undefined,
      defaultWarehouseId:
        formData.defaultWarehouseId !== '' ? Number(formData.defaultWarehouseId) : undefined,
      defaultBinId:
        formData.defaultBinId !== '' ? Number(formData.defaultBinId) : undefined,
      drawingNo: formData.drawingNo.trim() || undefined,
      revisionNo: formData.revisionNo.trim() || undefined,
      weightPerUnitKg:
        formData.weightPerUnitKg !== '' ? Number(formData.weightPerUnitKg) : undefined,
      isBomAllowed: formData.isBomAllowed,
      yieldPercentage: Number(formData.yieldPercentage) || 100,
      inspectionLeadTimeDays: Number(formData.inspectionLeadTimeDays) || 1,
      isActive: formData.isActive,
    };

    if (editingItem) {
      updateMutation.mutate({ id: editingItem.itemId, payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleExportCsv = async () => {
    try {
      await apiClient.post('/inventory/items/actions/log', {
        actionType: 'EXPORT',
      });
    } catch {
      // non-blocking audit call
    }

    if (items.length === 0) return;

    const headers = [
      'Item Code',
      'Item Name',
      'Classification',
      'Category Name',
      'Base UOM',
      'Purchase UOM',
      'Sales UOM',
      'HSN Code',
      'GST Tax Rate %',
      'Standard Cost (INR)',
      'Purchase Rate (INR)',
      'Sales Rate (INR)',
      'Min Stock',
      'Reorder Point',
      'Safety Stock',
      'Lead Time (Days)',
      'Valuation Method',
      'Batch Managed',
      'Serial Managed',
      'QC Required',
      'Default Warehouse',
      'Drawing No',
      'Revision',
      'Status',
    ];

    const rows = items.map((i) => [
      `"${i.itemCode}"`,
      `"${i.itemName.replace(/"/g, '""')}"`,
      i.itemType,
      `"${i.categoryName}"`,
      i.baseUomCode,
      i.purchaseUomCode,
      i.salesUomCode,
      i.hsnSacCode || '',
      i.taxRate,
      i.standardCost,
      i.purchaseRate,
      i.salesRate,
      i.minStockLevel,
      i.reorderPoint,
      i.safetyStock,
      i.leadTimeDays,
      i.valuationMethod,
      i.isBatchManaged ? 'YES' : 'NO',
      i.isSerialManaged ? 'YES' : 'NO',
      i.isQcInspectionRequired ? 'YES' : 'NO',
      `"${i.defaultWarehouseName || ''}"`,
      `"${i.drawingNo || ''}"`,
      `"${i.revisionNo || ''}"`,
      i.isActive ? 'ACTIVE' : 'INACTIVE',
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `ks_mfg_item_master_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintDatasheet = async (item: ItemRecord) => {
    setPrintItem(item);
    try {
      await apiClient.post('/inventory/items/actions/log', {
        actionType: 'PRINT',
      });
    } catch {
      // non-blocking audit call
    }
  };

  // ==========================================================================
  // TABLE COLUMNS & GROUP BY
  // ==========================================================================

  const columns: MasterTableColumn<ItemRecord>[] = useMemo(
    () => [
      {
        key: 'itemCode',
        header: 'Item Code & Title',
        sortable: true,
        sortValue: (row: ItemRecord) => row.itemCode,
        render: (row: ItemRecord) => {
          const typeMeta = ITEM_TYPE_META[row.itemType] || ITEM_TYPE_META.RAW_MATERIAL;
          const Icon = typeMeta.icon;
          return (
            <div className="flex items-start gap-3 py-1">
              <div
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${typeMeta.badgeClass}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono-code font-bold text-[var(--text-primary)]">
                    {row.itemCode}
                  </span>
                  {row.drawingNo && (
                    <span className="inline-flex items-center gap-1 rounded bg-slate-500/10 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:text-slate-400">
                      <Compass className="h-2.5 w-2.5" />
                      {row.drawingNo} {row.revisionNo ? `(${row.revisionNo})` : ''}
                    </span>
                  )}
                </div>
                <div className="truncate text-xs font-medium text-[var(--text-primary)]">
                  {row.itemName}
                </div>
                {row.description && (
                  <div className="truncate text-[11px] text-[var(--text-muted)] max-w-xs">
                    {row.description}
                  </div>
                )}
              </div>
            </div>
          );
        },
      },
      {
        key: 'classification',
        header: 'Classification & Tree',
        sortable: true,
        sortValue: (row: ItemRecord) => `${row.itemType}_${row.categoryName}`,
        render: (row: ItemRecord) => {
          const meta = ITEM_TYPE_META[row.itemType] || ITEM_TYPE_META.RAW_MATERIAL;
          return (
            <div className="space-y-1">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${meta.badgeClass}`}
              >
                {meta.label}
              </span>
              <div
                className="truncate text-[11px] text-[var(--text-secondary)] flex items-center gap-1"
                title={row.categoryHierarchyPath}
              >
                <FolderTree className="h-3 w-3 shrink-0 text-[var(--text-muted)]" />
                <span className="truncate">{row.categoryName}</span>
              </div>
            </div>
          );
        },
      },
      {
        key: 'multiUom',
        header: 'Multi-UOM Matrix',
        render: (row: ItemRecord) => (
          <div className="text-xs space-y-1 font-mono-code">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-[var(--text-muted)]">Base:</span>
              <span className="rounded bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/20 px-1.5 py-0.5 font-semibold text-[var(--brand-600)] dark:text-[var(--brand-300)]">
                {row.baseUomCode}
              </span>
            </div>
            {(row.purchaseUomCode !== row.baseUomCode || row.salesUomCode !== row.baseUomCode) && (
              <div className="text-[11px] text-[var(--text-secondary)]">
                PO: {row.purchaseUomCode} | SO: {row.salesUomCode}
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'pricing',
        header: 'Costing & Tax',
        sortable: true,
        sortValue: (row: ItemRecord) => row.standardCost,
        render: (row: ItemRecord) => (
          <div className="text-xs space-y-0.5">
            <div className="font-semibold text-[var(--text-primary)]">
              Std: ₹{row.standardCost.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            {row.salesRate > 0 && (
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                Sale: ₹{row.salesRate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            )}
            <div className="text-[10px] text-[var(--text-muted)]">
              GST: {row.taxRate}% {row.hsnSacCode ? `(HSN ${row.hsnSacCode})` : ''}
            </div>
          </div>
        ),
      },
      {
        key: 'inventoryPlanning',
        header: 'Inventory Levels',
        sortable: true,
        sortValue: (row: ItemRecord) => row.reorderPoint,
        render: (row: ItemRecord) => (
          <div className="text-xs space-y-0.5 font-mono-code">
            <div className="text-[var(--text-primary)]">
              ROP: <span className="font-bold">{row.reorderPoint}</span> {row.baseUomCode}
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Min: {row.minStockLevel} | Safe: {row.safetyStock}
            </div>
            <div className="text-[10px] text-[var(--text-secondary)] flex items-center gap-1">
              <Clock className="h-3 w-3 text-[var(--text-muted)]" />
              Lead: {row.leadTimeDays}d
            </div>
          </div>
        ),
      },
      {
        key: 'governance',
        header: 'Quality & Governance',
        render: (row: ItemRecord) => (
          <div className="flex flex-wrap gap-1 max-w-[170px]">
            {row.isBatchManaged ? (
              <span className="inline-flex items-center gap-0.5 rounded bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Hash className="h-2.5 w-2.5" /> Batch
              </span>
            ) : null}
            {row.isSerialManaged ? (
              <span className="inline-flex items-center gap-0.5 rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-medium text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                Serial
              </span>
            ) : null}
            {row.isQcInspectionRequired ? (
              <span className="inline-flex items-center gap-0.5 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <ShieldCheck className="h-2.5 w-2.5" /> QC Insp
              </span>
            ) : null}
            {row.isBomAllowed ? (
              <span className="inline-flex items-center gap-0.5 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                BOM Parent
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: 'isActive',
        header: 'Status',
        sortable: true,
        sortValue: (row: ItemRecord) => (row.isActive ? 1 : 0),
        render: (row: ItemRecord) => (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              row.isActive
                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-slate-500/15 text-slate-500'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                row.isActive ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            {row.isActive ? 'Active' : 'Inactive'}
          </span>
        ),
      },
    ],
    [],
  );

  const groupByOptions: GroupByOption<ItemRecord>[] = useMemo(
    () => [
      {
        key: 'itemType',
        label: 'Classification / Item Type',
        groupValue: (row: ItemRecord) =>
          ITEM_TYPE_META[row.itemType]?.label || row.itemType,
      },
      {
        key: 'categoryName',
        label: 'Category Pillar',
        groupValue: (row: ItemRecord) => row.categoryName,
      },
      {
        key: 'valuationMethod',
        label: 'Valuation Method',
        groupValue: (row: ItemRecord) =>
          VALUATION_META[row.valuationMethod] || row.valuationMethod,
      },
      {
        key: 'defaultWarehouseName',
        label: 'Default Storing Warehouse',
        groupValue: (row: ItemRecord) =>
          row.defaultWarehouseName || 'Unassigned Warehouse',
      },
    ],
    [],
  );

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedItemType !== 'ALL' && item.itemType !== selectedItemType) {
        return false;
      }
      if (
        selectedCategoryId !== 'ALL' &&
        item.categoryId !== Number(selectedCategoryId)
      ) {
        return false;
      }
      if (selectedStatus === 'ACTIVE' && !item.isActive) return false;
      if (selectedStatus === 'INACTIVE' && item.isActive) return false;
      return true;
    });
  }, [items, selectedItemType, selectedCategoryId, selectedStatus]);

  const searchPredicate = (item: ItemRecord, query: string) => {
    const q = query.toLowerCase();
    return (
      item.itemCode.toLowerCase().includes(q) ||
      item.itemName.toLowerCase().includes(q) ||
      (item.drawingNo && item.drawingNo.toLowerCase().includes(q)) ||
      (item.hsnSacCode && item.hsnSacCode.toLowerCase().includes(q)) ||
      item.categoryName.toLowerCase().includes(q)
    );
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="space-y-6">
      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Active SKUs */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs transition-all hover:border-[var(--brand-300)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              Total Master SKUs
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/15 text-[var(--brand-600)] dark:text-[var(--brand-300)]">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[var(--text-primary)]">
              {summary?.totalItems ?? items.length}
            </span>
            <span className="text-xs text-[var(--text-muted)]">catalog items</span>
          </div>
        </div>

        {/* Finished Goods */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs transition-all hover:border-emerald-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              Finished Goods (Saleable)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {summary?.activeFinishedGoods ?? 0}
            </span>
            <span className="text-xs text-[var(--text-muted)]">saleable products</span>
          </div>
        </div>

        {/* WIP & Sub-Assemblies */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs transition-all hover:border-amber-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              WIP & Sub-Assemblies
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
              {summary?.wipItemsCount ?? 0}
            </span>
            <span className="text-xs text-[var(--text-muted)]">in-process components</span>
          </div>
        </div>

        {/* Batch & QC Governed */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs transition-all hover:border-blue-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase">
              Batch & QC Governed
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
              {summary?.batchQcCount ?? 0}
            </span>
            <span className="text-xs text-[var(--text-muted)]">QA traceable SKUs</span>
          </div>
        </div>
      </div>

      {/* FILTER CONTROLS TOOLBAR */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Item Type Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setSelectedItemType('ALL')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                selectedItemType === 'ALL'
                  ? 'bg-[var(--brand-500)] text-white shadow-xs'
                  : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]'
              }`}
            >
              All Types
            </button>
            {(Object.keys(ITEM_TYPE_META) as ItemType[]).map((type) => {
              const meta = ITEM_TYPE_META[type];
              const isSelected = selectedItemType === type;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedItemType(type)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-[var(--brand-500)] text-white shadow-xs font-semibold'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--border-subtle)]'
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </div>

          {/* Right Filters: Category & Status */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <FolderTree className="h-4 w-4 text-[var(--text-muted)]" />
              <select
                value={selectedCategoryId}
                onChange={(e) => setSelectedCategoryId(e.target.value)}
                className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c.categoryId} value={c.categoryId}>
                    {c.hierarchyPath}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* MASTER DATA TABLE */}
      <MasterDataTable<ItemRecord>
        title="Item & Material Master"
        subtitle="Catalog, Engineering Specifications, Multi-UOM, BOM Parameters & Costing"
        screenCode="ITEM_MASTER"
        tableNameBadge="tbl_inv_item"
        data={filteredItems}
        rowKey={(row) => row.itemId}
        columns={columns}
        searchPlaceholder="Search by item code, title, drawing #, HSN, or category..."
        searchPredicate={searchPredicate}
        groupByOptions={groupByOptions}
        addButtonLabel="New Item SKU"
        onAddClick={openCreateModal}
        onExportClick={handleExportCsv}
        pageSize={12}
        isLoading={isItemsLoading}
        renderRowActions={(row: ItemRecord) => (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePrintDatasheet(row)}
              title="Print Specification Sheet"
              className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Printer className="h-4 w-4" />
            </button>
            <PermissionGate screen="ITEM_MASTER" action="EDIT">
              <button
                onClick={() => openEditModal(row)}
                title="Edit Item Master"
                className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-500/10 dark:text-blue-400 transition-colors"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            </PermissionGate>
            <PermissionGate screen="ITEM_MASTER" action="DELETE">
              <button
                onClick={() => openDeleteModal(row)}
                title="Delete Item Master"
                className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </PermissionGate>
          </div>
        )}
      />

      {/* CREATE / EDIT ITEM MODAL */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden my-8">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-500)] text-white shadow-xs">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    {editingItem ? `Edit SKU: ${editingItem.itemCode}` : 'Create Item & Material Master SKU'}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Multi-UOM, Costing, Engineering Drawings & Quality Traceability Parameters
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsFormModalOpen(false);
                  resetForm();
                }}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Tabs Header */}
            <div className="flex border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6 pt-2 gap-2 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveTab('general')}
                className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'general'
                    ? 'border-[var(--brand-500)] text-[var(--brand-600)] dark:text-[var(--brand-300)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Tag className="h-3.5 w-3.5" />
                1. Identity & Classification
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('planning')}
                className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'planning'
                    ? 'border-[var(--brand-500)] text-[var(--brand-600)] dark:text-[var(--brand-300)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Scale className="h-3.5 w-3.5" />
                2. Multi-UOM & Warehouse Planning
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('costing')}
                className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'costing'
                    ? 'border-[var(--brand-500)] text-[var(--brand-600)] dark:text-[var(--brand-300)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <DollarSign className="h-3.5 w-3.5" />
                3. Costing & Taxation
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('governance')}
                className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-semibold transition-all ${
                  activeTab === 'governance'
                    ? 'border-[var(--brand-500)] text-[var(--brand-600)] dark:text-[var(--brand-300)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                4. Quality & BOM Governance
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {formErrors.server && (
                <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formErrors.server}</span>
                </div>
              )}

              {/* TAB 1: IDENTITY & CLASSIFICATION */}
              {activeTab === 'general' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Item Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. RM-SS316-ROUND-50"
                        value={formData.itemCode}
                        onChange={(e) =>
                          setFormData({ ...formData, itemCode: e.target.value.toUpperCase() })
                        }
                        className={`w-full rounded-xl border bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden ${
                          formErrors.itemCode ? 'border-rose-500' : 'border-[var(--border-subtle)]'
                        }`}
                      />
                      {formErrors.itemCode && (
                        <p className="mt-1 text-[11px] text-rose-500">{formErrors.itemCode}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Classification Pillar <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.itemType}
                        onChange={(e) =>
                          setFormData({ ...formData, itemType: e.target.value as ItemType })
                        }
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      >
                        {(Object.keys(ITEM_TYPE_META) as ItemType[]).map((t) => (
                          <option key={t} value={t}>
                            {ITEM_TYPE_META[t].label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Item Name & Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Stainless Steel 316 Round Bar Dia 50mm"
                      value={formData.itemName}
                      onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                      className={`w-full rounded-xl border bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden ${
                        formErrors.itemName ? 'border-rose-500' : 'border-[var(--border-subtle)]'
                      }`}
                    />
                    {formErrors.itemName && (
                      <p className="mt-1 text-[11px] text-rose-500">{formErrors.itemName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Item Category Tree Node <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formData.categoryId}
                      onChange={(e) => handleCategoryChange(Number(e.target.value))}
                      className={`w-full rounded-xl border bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden ${
                        formErrors.categoryId ? 'border-rose-500' : 'border-[var(--border-subtle)]'
                      }`}
                    >
                      <option value={0}>-- Select Category Tree Branch --</option>
                      {categories.map((c) => (
                        <option key={c.categoryId} value={c.categoryId}>
                          {c.hierarchyPath} ({c.categoryName})
                        </option>
                      ))}
                    </select>
                    {formErrors.categoryId && (
                      <p className="mt-1 text-[11px] text-rose-500">{formErrors.categoryId}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Drawing Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. DWG-VB-2026-01"
                        value={formData.drawingNo}
                        onChange={(e) => setFormData({ ...formData, drawingNo: e.target.value })}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Revision Number
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Rev.B"
                        value={formData.revisionNo}
                        onChange={(e) => setFormData({ ...formData, revisionNo: e.target.value })}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Weight per Unit (kg)
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        placeholder="e.g. 15.4200"
                        value={formData.weightPerUnitKg}
                        onChange={(e) => setFormData({ ...formData, weightPerUnitKg: e.target.value })}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Material Specification & Engineering Notes
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Technical metallurgy specification, ASTM grade, heat treatment details..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <input
                      type="checkbox"
                      id="itemIsActive"
                      checked={formData.isActive}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                      className="h-4 w-4 rounded border-[var(--border-subtle)] text-[var(--brand-500)] focus:ring-[var(--brand-500)]"
                    />
                    <label htmlFor="itemIsActive" className="text-xs font-medium text-[var(--text-primary)] cursor-pointer">
                      Item is Active and available across PO, Work Orders, and Sales Quotations
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 2: MULTI-UOM & WAREHOUSE PLANNING */}
              {activeTab === 'planning' && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-700 dark:text-blue-300">
                    <strong>Multi-UOM Architecture:</strong> Base UOM is strictly used for inventory stock ledger valuation. Purchase and Sales UOMs are automatically converted via the conversion matrix during GRN and Sales Dispatch.
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Base Inventory UOM <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.baseUomId}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setFormData({
                            ...formData,
                            baseUomId: val,
                            purchaseUomId: formData.purchaseUomId || val,
                            salesUomId: formData.salesUomId || val,
                          });
                        }}
                        className={`w-full rounded-xl border bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden ${
                          formErrors.baseUomId ? 'border-rose-500' : 'border-[var(--border-subtle)]'
                        }`}
                      >
                        <option value={0}>-- Select Base UOM --</option>
                        {uoms.map((u) => (
                          <option key={u.uomId} value={u.uomId}>
                            {u.uomCode} — {u.uomName} ({u.uomType})
                          </option>
                        ))}
                      </select>
                      {formErrors.baseUomId && (
                        <p className="mt-1 text-[11px] text-rose-500">{formErrors.baseUomId}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Default Purchase UOM
                      </label>
                      <select
                        value={formData.purchaseUomId}
                        onChange={(e) =>
                          setFormData({ ...formData, purchaseUomId: Number(e.target.value) })
                        }
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      >
                        <option value={0}>Same as Base UOM</option>
                        {uoms.map((u) => (
                          <option key={u.uomId} value={u.uomId}>
                            {u.uomCode} — {u.uomName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Default Sales UOM
                      </label>
                      <select
                        value={formData.salesUomId}
                        onChange={(e) =>
                          setFormData({ ...formData, salesUomId: Number(e.target.value) })
                        }
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      >
                        <option value={0}>Same as Base UOM</option>
                        {uoms.map((u) => (
                          <option key={u.uomId} value={u.uomId}>
                            {u.uomCode} — {u.uomName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Default Storage Warehouse
                      </label>
                      <select
                        value={formData.defaultWarehouseId}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            defaultWarehouseId: e.target.value ? Number(e.target.value) : '',
                            defaultBinId: '',
                          })
                        }
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      >
                        <option value="">-- No Default Warehouse --</option>
                        {warehouses.map((w) => (
                          <option key={w.warehouseId} value={w.warehouseId}>
                            {w.warehouseCode} — {w.warehouseName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Default Put-away Storage Bin
                      </label>
                      <select
                        value={formData.defaultBinId}
                        disabled={!formData.defaultWarehouseId}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            defaultBinId: e.target.value ? Number(e.target.value) : '',
                          })
                        }
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden disabled:opacity-50"
                      >
                        <option value="">
                          {formData.defaultWarehouseId
                            ? '-- Select Storage Bin --'
                            : 'Select Warehouse First'}
                        </option>
                        {storageBins.map((b) => (
                          <option key={b.binId} value={b.binId}>
                            {b.binCode} — {b.binName} ({b.zoneCode})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Reorder Point (ROP)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={formData.reorderPoint}
                        onChange={(e) =>
                          setFormData({ ...formData, reorderPoint: Number(e.target.value) })
                        }
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Minimum Stock Level
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={formData.minStockLevel}
                        onChange={(e) =>
                          setFormData({ ...formData, minStockLevel: Number(e.target.value) })
                        }
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Safety Stock Buffer
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={formData.safetyStock}
                        onChange={(e) =>
                          setFormData({ ...formData, safetyStock: Number(e.target.value) })
                        }
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Procurement / Prod Lead Time (Days)
                      </label>
                      <input
                        type="number"
                        value={formData.leadTimeDays}
                        onChange={(e) =>
                          setFormData({ ...formData, leadTimeDays: Number(e.target.value) })
                        }
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: COSTING & TAXATION */}
              {activeTab === 'costing' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Standard Cost (₹ per Base UOM)
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={formData.standardCost}
                        onChange={(e) =>
                          setFormData({ ...formData, standardCost: Number(e.target.value) })
                        }
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Default Purchase Rate (₹)
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={formData.purchaseRate}
                        onChange={(e) =>
                          setFormData({ ...formData, purchaseRate: Number(e.target.value) })
                        }
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Default Selling Rate (₹)
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={formData.salesRate}
                        onChange={(e) =>
                          setFormData({ ...formData, salesRate: Number(e.target.value) })
                        }
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        HSN / SAC Code
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 7222 or 8481"
                        value={formData.hsnSacCode}
                        onChange={(e) => setFormData({ ...formData, hsnSacCode: e.target.value })}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        GST Tax Rate (%) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.taxRate}
                        onChange={(e) => setFormData({ ...formData, taxRate: Number(e.target.value) })}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      />
                      {formErrors.taxRate && (
                        <p className="mt-1 text-[11px] text-rose-500">{formErrors.taxRate}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Valuation Method <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formData.valuationMethod}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            valuationMethod: e.target.value as ValuationMethod,
                          })
                        }
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                      >
                        <option value="FIFO">First In First Out (FIFO)</option>
                        <option value="WEIGHTED_AVG">Moving Weighted Average</option>
                        <option value="STANDARD_COST">Standard Costing</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: QUALITY & BOM GOVERNANCE */}
              {activeTab === 'governance' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-3">
                      <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-blue-500" />
                        Quality & Traceability Governance
                      </h4>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-medium text-[var(--text-primary)]">
                            Batch / Heat Number Managed
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            Mandatory batch allocation on GRN inward and production
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.isBatchManaged}
                          onChange={(e) =>
                            setFormData({ ...formData, isBatchManaged: e.target.checked })
                          }
                          className="h-4 w-4 rounded border-[var(--border-subtle)] text-[var(--brand-500)] focus:ring-[var(--brand-500)]"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-medium text-[var(--text-primary)]">
                            Serial Number Individual Tracking
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            Unique serial number generated per single unit
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.isSerialManaged}
                          onChange={(e) =>
                            setFormData({ ...formData, isSerialManaged: e.target.checked })
                          }
                          className="h-4 w-4 rounded border-[var(--border-subtle)] text-[var(--brand-500)] focus:ring-[var(--brand-500)]"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-medium text-[var(--text-primary)]">
                            Mandatory QC Inspection Required
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            GRN routed to Quarantine QC bay before stock put-away
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.isQcInspectionRequired}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              isQcInspectionRequired: e.target.checked,
                            })
                          }
                          className="h-4 w-4 rounded border-[var(--border-subtle)] text-[var(--brand-500)] focus:ring-[var(--brand-500)]"
                        />
                      </div>

                      <div className="pt-2">
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                          Shelf Life (Days) (Leave blank if non-perishable)
                        </label>
                        <input
                          type="number"
                          placeholder="e.g. 730"
                          value={formData.shelfLifeDays}
                          onChange={(e) =>
                            setFormData({ ...formData, shelfLifeDays: e.target.value })
                          }
                          className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-3">
                      <h4 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Layers className="h-4 w-4 text-emerald-500" />
                        BOM & Manufacturing Parameters
                      </h4>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-medium text-[var(--text-primary)]">
                            Allow as BOM Parent SKU
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            Enables multi-level Bill of Materials creation for this item
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={formData.isBomAllowed}
                          onChange={(e) =>
                            setFormData({ ...formData, isBomAllowed: e.target.checked })
                          }
                          className="h-4 w-4 rounded border-[var(--border-subtle)] text-[var(--brand-500)] focus:ring-[var(--brand-500)]"
                        />
                      </div>

                      <div className="pt-2">
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                          Expected Standard Yield % <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.yieldPercentage}
                          onChange={(e) =>
                            setFormData({ ...formData, yieldPercentage: Number(e.target.value) })
                          }
                          className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                        />
                        {formErrors.yieldPercentage && (
                          <p className="mt-1 text-[11px] text-rose-500">{formErrors.yieldPercentage}</p>
                        )}
                      </div>

                      <div className="pt-2">
                        <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                          QC Inspection Lead Time (Days)
                        </label>
                        <input
                          type="number"
                          value={formData.inspectionLeadTimeDays}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              inspectionLeadTimeDays: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-mono-code text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
                <div className="flex gap-2">
                  {activeTab !== 'general' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeTab === 'planning') setActiveTab('general');
                        if (activeTab === 'costing') setActiveTab('planning');
                        if (activeTab === 'governance') setActiveTab('costing');
                      }}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
                    >
                      Previous Tab
                    </button>
                  )}
                  {activeTab !== 'governance' && (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeTab === 'general') setActiveTab('planning');
                        if (activeTab === 'planning') setActiveTab('costing');
                        if (activeTab === 'costing') setActiveTab('governance');
                      }}
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2 text-xs font-semibold text-[var(--brand-600)] dark:text-[var(--brand-300)] hover:bg-[var(--brand-50)] dark:hover:bg-[var(--brand-500)]/20 transition-colors"
                    >
                      Next Tab
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormModalOpen(false);
                      resetForm();
                    }}
                    className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="flex items-center gap-2 rounded-xl bg-[var(--brand-500)] px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-[var(--brand-600)] transition-all disabled:opacity-50"
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? 'Saving Master SKU...'
                      : editingItem
                      ? 'Save Changes'
                      : 'Create Item SKU'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        entityType="Item / Material Master SKU"
        entityName={deletingItem?.itemName || ''}
        entityCode={deletingItem?.itemCode}
        isDeleting={deleteMutation.isPending}
        errorMessage={deleteError}
        dependencies={deleteConflicts}
        onConfirm={() => {
          if (deletingItem) {
            deleteMutation.mutate(deletingItem.itemId);
          }
        }}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingItem(null);
          setDeleteError(null);
          setDeleteConflicts([]);
        }}
      />

      {/* PRINT PREVIEW MODAL */}
      {printItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border-subtle)] bg-white text-slate-900 shadow-2xl p-8 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <span className="text-xs font-bold tracking-widest uppercase text-slate-500">
                  KS-MFG ERP Engineering Datasheet
                </span>
                <h2 className="text-xl font-black text-slate-900">
                  {printItem.itemCode}
                </h2>
                <p className="text-sm font-semibold text-slate-700">
                  {printItem.itemName}
                </p>
              </div>
              <button
                onClick={() => setPrintItem(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="border rounded-lg p-3 space-y-1">
                <div className="text-slate-500 font-semibold uppercase text-[10px]">Classification</div>
                <div className="font-bold">{printItem.itemType}</div>
                <div>Category: {printItem.categoryName}</div>
                <div>Hierarchy: {printItem.categoryHierarchyPath}</div>
              </div>

              <div className="border rounded-lg p-3 space-y-1">
                <div className="text-slate-500 font-semibold uppercase text-[10px]">Engineering Drawing</div>
                <div>Drawing #: <span className="font-mono font-bold">{printItem.drawingNo || 'N/A'}</span></div>
                <div>Revision: <span className="font-mono">{printItem.revisionNo || 'N/A'}</span></div>
                <div>Unit Weight: {printItem.weightPerUnitKg ? `${printItem.weightPerUnitKg} kg` : 'N/A'}</div>
              </div>

              <div className="border rounded-lg p-3 space-y-1">
                <div className="text-slate-500 font-semibold uppercase text-[10px]">Multi-UOM Configuration</div>
                <div>Base Inventory UOM: <strong>{printItem.baseUomCode}</strong> ({printItem.baseUomName})</div>
                <div>Default Purchase UOM: <strong>{printItem.purchaseUomCode}</strong></div>
                <div>Default Sales UOM: <strong>{printItem.salesUomCode}</strong></div>
              </div>

              <div className="border rounded-lg p-3 space-y-1">
                <div className="text-slate-500 font-semibold uppercase text-[10px]">Costing & Valuation</div>
                <div>Standard Cost: ₹{printItem.standardCost.toFixed(2)}</div>
                <div>Selling Rate: ₹{printItem.salesRate.toFixed(2)}</div>
                <div>Valuation: {printItem.valuationMethod}</div>
                <div>HSN/SAC: {printItem.hsnSacCode || 'N/A'} ({printItem.taxRate}% GST)</div>
              </div>

              <div className="border rounded-lg p-3 space-y-1">
                <div className="text-slate-500 font-semibold uppercase text-[10px]">Inventory Planning & Buffer</div>
                <div>Reorder Point: {printItem.reorderPoint} {printItem.baseUomCode}</div>
                <div>Min Stock: {printItem.minStockLevel} {printItem.baseUomCode}</div>
                <div>Safety Stock: {printItem.safetyStock} {printItem.baseUomCode}</div>
                <div>Lead Time: {printItem.leadTimeDays} days</div>
              </div>

              <div className="border rounded-lg p-3 space-y-1">
                <div className="text-slate-500 font-semibold uppercase text-[10px]">Quality & BOM Controls</div>
                <div>Batch Managed: {printItem.isBatchManaged ? 'YES (Heat Traceable)' : 'NO'}</div>
                <div>Serial Tracking: {printItem.isSerialManaged ? 'YES' : 'NO'}</div>
                <div>QC Inspection: {printItem.isQcInspectionRequired ? 'MANDATORY' : 'DIRECT TO STOCK'}</div>
                <div>BOM Allowed: {printItem.isBomAllowed ? 'YES' : 'NO'} (Yield: {printItem.yieldPercentage}%)</div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setPrintItem(null)}
                className="rounded-lg border px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-black"
              >
                <Printer className="h-4 w-4" />
                Print Datasheet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
