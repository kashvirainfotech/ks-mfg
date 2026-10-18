import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  Edit3,
  Filter,
  FolderTree,
  Hash,
  Percent,
  Plus,
  Scale,
  Tag,
  Trash2,
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

export type UomType =
  | 'COUNT'
  | 'WEIGHT'
  | 'LENGTH'
  | 'VOLUME'
  | 'AREA'
  | 'TIME';

export type ConversionType = 'STANDARD' | 'PACKAGING' | 'ITEM_SPECIFIC';

export type CategoryType =
  | 'RAW_MATERIAL'
  | 'WIP_SUB_ASSEMBLY'
  | 'FINISHED_GOODS'
  | 'PACKING_MATERIAL'
  | 'CONSUMABLES_MRO'
  | 'TOOLS_DIES'
  | 'SCRAP_REJECT';

export type ValuationMethod = 'FIFO' | 'WEIGHTED_AVG' | 'STANDARD_COST';

export interface UomRecord {
  uomId: number;
  uomCode: string;
  uomName: string;
  uomType: UomType;
  decimalPrecision: number;
  gstUqcCode: string;
  isBaseUom: boolean;
  isActive: boolean;
  conversionsCount: number;
  createdDate: string;
  updatedDate: string | null;
}

export interface UomConversionRecord {
  conversionId: number;
  fromUomId: number;
  fromUomCode: string;
  fromUomName: string;
  fromUomType: UomType;
  toUomId: number;
  toUomCode: string;
  toUomName: string;
  toUomType: UomType;
  conversionFactor: number;
  inverseFactor: number;
  conversionType: ConversionType;
  remarks: string | null;
  isActive: boolean;
  equationText: string;
  inverseEquationText: string;
  createdDate: string;
  updatedDate: string | null;
}

export interface ItemCategoryRecord {
  categoryId: number;
  categoryCode: string;
  categoryName: string;
  parentCategoryId: number | null;
  parentCategoryCode: string | null;
  parentCategoryName: string | null;
  categoryType: CategoryType;
  hsnSacCode: string | null;
  defaultTaxRate: number;
  defaultValuationMethod: ValuationMethod;
  levelDepth: number;
  hierarchyPath: string;
  isLeaf: boolean;
  isActive: boolean;
  childCategoriesCount: number;
  createdDate: string;
  updatedDate: string | null;
}

const UOM_TYPE_META: Record<UomType, { label: string; badgeClass: string }> = {
  WEIGHT: {
    label: 'Mass / Weight (kg, ton)',
    badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  },
  COUNT: {
    label: 'Discrete Count (pcs, box)',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  },
  LENGTH: {
    label: 'Linear Length (m, mm)',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
  },
  VOLUME: {
    label: 'Liquid Volume (ltr, cbm)',
    badgeClass: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  },
  AREA: {
    label: 'Surface Area (sqm, sqft)',
    badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  },
  TIME: {
    label: 'Machine Time (hrs, min)',
    badgeClass: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30',
  },
};

const CATEGORY_TYPE_META: Record<
  CategoryType,
  { label: string; badgeClass: string }
> = {
  RAW_MATERIAL: {
    label: 'Raw Materials & Primary Stock',
    badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  },
  WIP_SUB_ASSEMBLY: {
    label: 'Shopfloor WIP & Sub-Assemblies',
    badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  },
  FINISHED_GOODS: {
    label: 'Finished Goods (Saleable)',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  },
  PACKING_MATERIAL: {
    label: 'Packaging & Corrugated Cartons',
    badgeClass: 'bg-teal-500/10 text-teal-600 border-teal-500/30',
  },
  CONSUMABLES_MRO: {
    label: 'Plant MRO & Oils/Lubricants',
    badgeClass: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30',
  },
  TOOLS_DIES: {
    label: 'Press Dies, Tooling & Inserts',
    badgeClass: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  },
  SCRAP_REJECT: {
    label: 'Scrap & Rejected Material',
    badgeClass: 'bg-rose-500/10 text-rose-600 border-rose-500/30',
  },
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const UomMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<
    'UOMS' | 'CONVERSIONS' | 'CATEGORIES'
  >('UOMS');
  const [selectedUomTypeFilter, setSelectedUomTypeFilter] =
    useState<string>('ALL');
  const [selectedCategoryTypeFilter, setSelectedCategoryTypeFilter] =
    useState<string>('ALL');
  const [bannerMessage, setBannerMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Modal 1: UOM State
  const [isUomModalOpen, setIsUomModalOpen] = useState(false);
  const [editingUom, setEditingUom] = useState<UomRecord | null>(null);
  const [uomFormError, setUomFormError] = useState<string | null>(null);
  const [uomForm, setUomForm] = useState({
    uomCode: '',
    uomName: '',
    uomType: 'COUNT' as UomType,
    decimalPrecision: 0,
    gstUqcCode: 'NOS',
    isBaseUom: false,
    isActive: true,
  });

  // Modal 2: Conversion State
  const [isConvModalOpen, setIsConvModalOpen] = useState(false);
  const [editingConv, setEditingConv] = useState<UomConversionRecord | null>(
    null,
  );
  const [convFormError, setConvFormError] = useState<string | null>(null);
  const [convForm, setConvForm] = useState({
    fromUomId: 0,
    toUomId: 0,
    conversionFactor: 1,
    inverseFactor: 1,
    conversionType: 'STANDARD' as ConversionType,
    remarks: '',
    createBidirectionalPair: true,
    isActive: true,
  });

  // Modal 3: Category State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<ItemCategoryRecord | null>(null);
  const [categoryFormError, setCategoryFormError] = useState<string | null>(
    null,
  );
  const [categoryForm, setCategoryForm] = useState({
    categoryCode: '',
    categoryName: '',
    parentCategoryId: '' as string | number,
    categoryType: 'RAW_MATERIAL' as CategoryType,
    hsnSacCode: '7200',
    defaultTaxRate: 18.0,
    defaultValuationMethod: 'FIFO' as ValuationMethod,
    isLeaf: true,
    isActive: true,
  });

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<{
    mode: 'UOM' | 'CONVERSION' | 'CATEGORY';
    id: number;
    code: string;
    name: string;
  } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDependencies, setDeleteDependencies] = useState<
    Array<{ table: string; label: string; count: number }>
  >([]);

  // ==========================================================================
  // REAL-TIME POSTGRESQL QUERIES
  // ==========================================================================

  const { data: uoms = [], isLoading: loadingUoms } = useQuery({
    queryKey: ['inventory', 'uoms'],
    queryFn: async () => {
      const res =
        await apiClient.get<ApiResponse<UomRecord[]>>('/inventory/uoms');
      return res.data.data || [];
    },
  });

  const { data: conversions = [], isLoading: loadingConversions } = useQuery({
    queryKey: ['inventory', 'uom-conversions'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<UomConversionRecord[]>>(
        '/inventory/uoms/conversions',
      );
      return res.data.data || [];
    },
  });

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['inventory', 'item-categories'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ItemCategoryRecord[]>>(
        '/inventory/uoms/categories',
      );
      return res.data.data || [];
    },
  });

  // Filtered Lists
  const filteredUoms = useMemo(() => {
    return uoms.filter((u) => {
      if (
        selectedUomTypeFilter !== 'ALL' &&
        u.uomType !== selectedUomTypeFilter
      ) {
        return false;
      }
      return true;
    });
  }, [uoms, selectedUomTypeFilter]);

  const filteredCategories = useMemo(() => {
    return categories.filter((c) => {
      if (
        selectedCategoryTypeFilter !== 'ALL' &&
        c.categoryType !== selectedCategoryTypeFilter
      ) {
        return false;
      }
      return true;
    });
  }, [categories, selectedCategoryTypeFilter]);

  // Enterprise KPI Aggregates
  const kpiStats = useMemo(() => {
    const totalUoms = uoms.length;
    const baseUoms = uoms.filter((u) => u.isBaseUom).length;
    const totalConversions = conversions.length;
    const standardConversions = conversions.filter(
      (c) => c.conversionType === 'STANDARD',
    ).length;
    const totalCategories = categories.length;
    const leafCategories = categories.filter((c) => c.isLeaf).length;
    const rootCategories = categories.filter(
      (c) => c.parentCategoryId === null,
    ).length;

    return {
      totalUoms,
      baseUoms,
      totalConversions,
      standardConversions,
      totalCategories,
      leafCategories,
      rootCategories,
    };
  }, [uoms, conversions, categories]);

  // ==========================================================================
  // MUTATIONS
  // ==========================================================================

  const saveUomMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        uomCode: uomForm.uomCode.trim().toUpperCase(),
        uomName: uomForm.uomName.trim(),
        uomType: uomForm.uomType,
        decimalPrecision: Number(uomForm.decimalPrecision),
        gstUqcCode: uomForm.gstUqcCode.trim().toUpperCase(),
        isBaseUom: uomForm.isBaseUom,
        isActive: uomForm.isActive,
      };

      if (editingUom) {
        const res = await apiClient.put<ApiResponse<UomRecord>>(
          `/inventory/uoms/${editingUom.uomId}`,
          payload,
        );
        return res.data.data;
      } else {
        const res = await apiClient.post<ApiResponse<UomRecord>>(
          '/inventory/uoms',
          payload,
        );
        return res.data.data;
      }
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'uoms'] });
      setIsUomModalOpen(false);
      setEditingUom(null);
      setBannerMessage({
        type: 'success',
        text: `Unit of measurement "${saved.uomCode} — ${saved.uomName}" saved to PostgreSQL.`,
      });
    },
    onError: (err: any) => {
      setUomFormError(
        err?.response?.data?.message || err?.message || 'Failed to save UOM.',
      );
    },
  });

  const saveConvMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        fromUomId: Number(convForm.fromUomId),
        toUomId: Number(convForm.toUomId),
        conversionFactor: Number(convForm.conversionFactor),
        inverseFactor: Number(convForm.inverseFactor),
        conversionType: convForm.conversionType,
        remarks: convForm.remarks.trim() || undefined,
        createBidirectionalPair: convForm.createBidirectionalPair,
        isActive: convForm.isActive,
      };

      if (editingConv) {
        const res = await apiClient.put<ApiResponse<UomConversionRecord>>(
          `/inventory/uoms/conversions/${editingConv.conversionId}`,
          payload,
        );
        return res.data.data;
      } else {
        const res = await apiClient.post<ApiResponse<UomConversionRecord>>(
          '/inventory/uoms/conversions',
          payload,
        );
        return res.data.data;
      }
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({
        queryKey: ['inventory', 'uom-conversions'],
      });
      queryClient.invalidateQueries({ queryKey: ['inventory', 'uoms'] });
      setIsConvModalOpen(false);
      setEditingConv(null);
      setBannerMessage({
        type: 'success',
        text: `Conversion ratio "${saved.equationText}" saved to PostgreSQL.`,
      });
    },
    onError: (err: any) => {
      setConvFormError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to save UOM conversion ratio.',
      );
    },
  });

  const saveCategoryMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        categoryCode: categoryForm.categoryCode.trim().toUpperCase(),
        categoryName: categoryForm.categoryName.trim(),
        parentCategoryId: categoryForm.parentCategoryId
          ? Number(categoryForm.parentCategoryId)
          : null,
        categoryType: categoryForm.categoryType,
        hsnSacCode: categoryForm.hsnSacCode.trim() || undefined,
        defaultTaxRate: Number(categoryForm.defaultTaxRate),
        defaultValuationMethod: categoryForm.defaultValuationMethod,
        isLeaf: categoryForm.isLeaf,
        isActive: categoryForm.isActive,
      };

      if (editingCategory) {
        const res = await apiClient.put<ApiResponse<ItemCategoryRecord>>(
          `/inventory/uoms/categories/${editingCategory.categoryId}`,
          payload,
        );
        return res.data.data;
      } else {
        const res = await apiClient.post<ApiResponse<ItemCategoryRecord>>(
          '/inventory/uoms/categories',
          payload,
        );
        return res.data.data;
      }
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({
        queryKey: ['inventory', 'item-categories'],
      });
      setIsCategoryModalOpen(false);
      setEditingCategory(null);
      setBannerMessage({
        type: 'success',
        text: `Item Category "${saved.categoryCode} — ${saved.categoryName}" saved to PostgreSQL.`,
      });
    },
    onError: (err: any) => {
      setCategoryFormError(
        err?.response?.data?.message ||
          err?.message ||
          'Failed to save item category.',
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      if (deleteTarget.mode === 'UOM') {
        await apiClient.delete(`/inventory/uoms/${deleteTarget.id}`);
      } else if (deleteTarget.mode === 'CONVERSION') {
        await apiClient.delete(
          `/inventory/uoms/conversions/${deleteTarget.id}`,
        );
      } else {
        await apiClient.delete(`/inventory/uoms/categories/${deleteTarget.id}`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory', 'uoms'] });
      queryClient.invalidateQueries({
        queryKey: ['inventory', 'uom-conversions'],
      });
      queryClient.invalidateQueries({
        queryKey: ['inventory', 'item-categories'],
      });
      setBannerMessage({
        type: 'success',
        text: `${deleteTarget?.mode} "${deleteTarget?.code}" deleted.`,
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

  const handleOpenCreateUom = () => {
    setEditingUom(null);
    setUomFormError(null);
    setUomForm({
      uomCode: '',
      uomName: '',
      uomType: 'COUNT',
      decimalPrecision: 0,
      gstUqcCode: 'NOS',
      isBaseUom: false,
      isActive: true,
    });
    setIsUomModalOpen(true);
  };

  const handleOpenEditUom = (uom: UomRecord) => {
    setEditingUom(uom);
    setUomFormError(null);
    setUomForm({
      uomCode: uom.uomCode,
      uomName: uom.uomName,
      uomType: uom.uomType,
      decimalPrecision: uom.decimalPrecision,
      gstUqcCode: uom.gstUqcCode,
      isBaseUom: uom.isBaseUom,
      isActive: uom.isActive,
    });
    setIsUomModalOpen(true);
  };

  const handleOpenCreateConversion = (preselectFromUomId?: number) => {
    const from =
      uoms.find((u) => u.uomId === preselectFromUomId) ||
      uoms[0] || { uomId: 1 };
    const to = uoms.find((u) => u.uomId !== from.uomId) || uoms[1] || from;

    setEditingConv(null);
    setConvFormError(null);
    setConvForm({
      fromUomId: from.uomId,
      toUomId: to.uomId,
      conversionFactor: 1,
      inverseFactor: 1,
      conversionType: 'STANDARD',
      remarks: '',
      createBidirectionalPair: true,
      isActive: true,
    });
    setIsConvModalOpen(true);
  };

  const handleOpenEditConversion = (conv: UomConversionRecord) => {
    setEditingConv(conv);
    setConvFormError(null);
    setConvForm({
      fromUomId: conv.fromUomId,
      toUomId: conv.toUomId,
      conversionFactor: conv.conversionFactor,
      inverseFactor: conv.inverseFactor,
      conversionType: conv.conversionType,
      remarks: conv.remarks || '',
      createBidirectionalPair: false,
      isActive: conv.isActive,
    });
    setIsConvModalOpen(true);
  };

  const handleOpenCreateCategory = (preselectParentId?: number) => {
    setEditingCategory(null);
    setCategoryFormError(null);
    const parent = categories.find((c) => c.categoryId === preselectParentId);

    setCategoryForm({
      categoryCode: '',
      categoryName: '',
      parentCategoryId: parent ? parent.categoryId : '',
      categoryType: parent ? parent.categoryType : 'RAW_MATERIAL',
      hsnSacCode: parent?.hsnSacCode || '7200',
      defaultTaxRate: parent?.defaultTaxRate ?? 18.0,
      defaultValuationMethod: parent?.defaultValuationMethod || 'FIFO',
      isLeaf: true,
      isActive: true,
    });
    setIsCategoryModalOpen(true);
  };

  const handleOpenEditCategory = (cat: ItemCategoryRecord) => {
    setEditingCategory(cat);
    setCategoryFormError(null);
    setCategoryForm({
      categoryCode: cat.categoryCode,
      categoryName: cat.categoryName,
      parentCategoryId: cat.parentCategoryId ?? '',
      categoryType: cat.categoryType,
      hsnSacCode: cat.hsnSacCode || '',
      defaultTaxRate: cat.defaultTaxRate,
      defaultValuationMethod: cat.defaultValuationMethod,
      isLeaf: cat.isLeaf,
      isActive: cat.isActive,
    });
    setIsCategoryModalOpen(true);
  };

  const recordAuditAction = async (actionType: 'PRINT' | 'EXPORT') => {
    try {
      await apiClient.post(`/inventory/uoms/action/${actionType}`);
    } catch {
      // Non-blocking audit call
    }
  };

  // ==========================================================================
  // TABLE COLUMNS: TAB 1 — UOMS
  // ==========================================================================

  const uomColumns = useMemo<MasterTableColumn<UomRecord>[]>(
    () => [
      {
        key: 'uomCode',
        header: 'UOM Code & Title',
        sortValue: (row: UomRecord) => row.uomCode,
        sortable: true,
        render: (row: UomRecord) => (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[var(--erp-accent)]/10 text-[var(--erp-accent)] border border-[var(--erp-accent)]/30">
                {row.uomCode}
              </span>
              {row.isBaseUom && (
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 border border-emerald-500/30">
                  Base UOM
                </span>
              )}
            </div>
            <span className="font-semibold text-[var(--erp-text)] text-xs mt-0.5">
              {row.uomName}
            </span>
          </div>
        ),
      },
      {
        key: 'uomType',
        header: 'Physical Metric Type',
        sortValue: (row: UomRecord) => row.uomType,
        sortable: true,
        render: (row: UomRecord) => {
          const meta = UOM_TYPE_META[row.uomType] || {
            label: row.uomType,
            badgeClass: 'bg-slate-500/10 text-slate-500 border-slate-500/30',
          };
          return (
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded border ${meta.badgeClass}`}
            >
              <Scale className="w-3 h-3" />
              {meta.label}
            </span>
          );
        },
      },
      {
        key: 'precision',
        header: 'Decimal Precision & GST UQC',
        sortValue: (row: UomRecord) => row.decimalPrecision,
        sortable: true,
        render: (row: UomRecord) => (
          <div className="flex flex-col gap-0.5 font-mono text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--erp-text)] font-semibold">
                {row.decimalPrecision} Decimals
              </span>
              <span className="text-[10px] text-[var(--erp-text-muted)]">
                (e.g.{' '}
                {(1).toFixed(row.decimalPrecision)}{' '}
                {row.uomCode})
              </span>
            </div>
            <div className="inline-flex items-center gap-1 text-[10px] text-[var(--erp-text-muted)] mt-0.5">
              <span className="font-semibold text-[var(--erp-text)]">
                GST UQC:
              </span>
              <span className="px-1.5 py-0.2 rounded bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] font-bold text-indigo-600">
                {row.gstUqcCode}
              </span>
            </div>
          </div>
        ),
      },
      {
        key: 'conversions',
        header: 'Conversion Matrix Mappings',
        sortValue: (row: UomRecord) => row.conversionsCount,
        sortable: true,
        render: (row: UomRecord) => (
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]">
              {row.conversionsCount} Active Ratios
            </span>
            <button
              type="button"
              onClick={() => {
                setActiveTab('CONVERSIONS');
              }}
              className="text-[10px] font-bold text-[var(--erp-accent)] hover:underline"
            >
              View Ratios ▸
            </button>
          </div>
        ),
      },
      {
        key: 'isActive',
        header: 'Status',
        sortValue: (row: UomRecord) => (row.isActive ? 1 : 0),
        sortable: true,
        render: (row: UomRecord) =>
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
        render: (row: UomRecord) => (
          <div className="flex items-center gap-1.5">
            <PermissionGate screen="UOM_MASTER" action="ADD">
              <button
                type="button"
                onClick={() => handleOpenCreateConversion(row.uomId)}
                className="p-1.5 rounded-lg bg-[var(--erp-bg-elevated)] hover:bg-[var(--erp-accent)]/15 text-[var(--erp-accent)] border border-[var(--erp-border)] transition-colors"
                title="Add Conversion Ratio for this UOM"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
              </button>
            </PermissionGate>
            <PermissionGate screen="UOM_MASTER" action="EDIT">
              <button
                type="button"
                onClick={() => handleOpenEditUom(row)}
                className="p-1.5 rounded-lg bg-[var(--erp-bg-elevated)] hover:bg-blue-500/15 text-blue-500 border border-[var(--erp-border)] transition-colors"
                title="Edit Unit of Measurement"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </PermissionGate>
            <PermissionGate screen="UOM_MASTER" action="DELETE">
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteDependencies([]);
                  setDeleteTarget({
                    mode: 'UOM',
                    id: row.uomId,
                    code: row.uomCode,
                    name: row.uomName,
                  });
                }}
                className="p-1.5 rounded-lg bg-[var(--erp-bg-elevated)] hover:bg-rose-500/15 text-rose-500 border border-[var(--erp-border)] transition-colors"
                title="Delete Unit of Measurement"
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
  // TABLE COLUMNS: TAB 2 — CONVERSIONS
  // ==========================================================================

  const conversionColumns = useMemo<MasterTableColumn<UomConversionRecord>[]>(
    () => [
      {
        key: 'ratioFormula',
        header: 'Conversion Ratio Equation',
        sortValue: (row: UomConversionRecord) => row.equationText,
        sortable: true,
        render: (row: UomConversionRecord) => (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[var(--erp-accent)]/10 text-[var(--erp-accent)] border border-[var(--erp-accent)]/30">
                {row.equationText}
              </span>
              <span className="font-mono text-[11px] text-[var(--erp-text-muted)]">
                ({row.inverseEquationText})
              </span>
            </div>
            {row.remarks && (
              <span className="text-[11px] text-[var(--erp-text-muted)] italic">
                {row.remarks}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'conversionType',
        header: 'Ratio Type',
        sortValue: (row: UomConversionRecord) => row.conversionType,
        sortable: true,
        render: (row: UomConversionRecord) => (
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${
              row.conversionType === 'STANDARD'
                ? 'bg-blue-500/10 text-blue-600 border-blue-500/30'
                : row.conversionType === 'PACKAGING'
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                  : 'bg-purple-500/10 text-purple-600 border-purple-500/30'
            }`}
          >
            {row.conversionType}
          </span>
        ),
      },
      {
        key: 'fromUom',
        header: 'Source UOM',
        sortValue: (row: UomConversionRecord) => row.fromUomCode,
        sortable: true,
        render: (row: UomConversionRecord) => (
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="font-bold text-[var(--erp-text)]">
              {row.fromUomCode}
            </span>
            <span className="text-[var(--erp-text-muted)]">
              — {row.fromUomName}
            </span>
          </div>
        ),
      },
      {
        key: 'toUom',
        header: 'Target UOM',
        sortValue: (row: UomConversionRecord) => row.toUomCode,
        sortable: true,
        render: (row: UomConversionRecord) => (
          <div className="flex items-center gap-1.5 font-mono text-xs">
            <span className="font-bold text-[var(--erp-text)]">
              {row.toUomCode}
            </span>
            <span className="text-[var(--erp-text-muted)]">
              — {row.toUomName}
            </span>
          </div>
        ),
      },
      {
        key: 'isActive',
        header: 'Status',
        sortValue: (row: UomConversionRecord) => (row.isActive ? 1 : 0),
        sortable: true,
        render: (row: UomConversionRecord) =>
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
        render: (row: UomConversionRecord) => (
          <div className="flex items-center gap-1.5">
            <PermissionGate screen="UOM_MASTER" action="EDIT">
              <button
                type="button"
                onClick={() => handleOpenEditConversion(row)}
                className="p-1.5 rounded-lg bg-[var(--erp-bg-elevated)] hover:bg-blue-500/15 text-blue-500 border border-[var(--erp-border)] transition-colors"
                title="Edit Conversion Ratio"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </PermissionGate>
            <PermissionGate screen="UOM_MASTER" action="DELETE">
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteDependencies([]);
                  setDeleteTarget({
                    mode: 'CONVERSION',
                    id: row.conversionId,
                    code: row.equationText,
                    name: `Ratio between ${row.fromUomCode} and ${row.toUomCode}`,
                  });
                }}
                className="p-1.5 rounded-lg bg-[var(--erp-bg-elevated)] hover:bg-rose-500/15 text-rose-500 border border-[var(--erp-border)] transition-colors"
                title="Delete Conversion Ratio"
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
  // TABLE COLUMNS: TAB 3 — ITEM CATEGORIES
  // ==========================================================================

  const categoryColumns = useMemo<MasterTableColumn<ItemCategoryRecord>[]>(
    () => [
      {
        key: 'categoryCode',
        header: 'Category Code & Name',
        sortValue: (row: ItemCategoryRecord) => row.categoryCode,
        sortable: true,
        render: (row: ItemCategoryRecord) => (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-[var(--erp-accent)]/10 text-[var(--erp-accent)] border border-[var(--erp-accent)]/30">
                {row.categoryCode}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text-muted)]">
                L{row.levelDepth}
              </span>
              {row.isLeaf ? (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Leaf Node
                </span>
              ) : (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 border border-blue-500/20">
                  Folder ({row.childCategoriesCount})
                </span>
              )}
            </div>
            <span className="font-semibold text-xs text-[var(--erp-text)] mt-0.5">
              {row.categoryName}
            </span>
          </div>
        ),
      },
      {
        key: 'hierarchyPath',
        header: 'Materialized Tree Hierarchy Path',
        sortValue: (row: ItemCategoryRecord) => row.hierarchyPath,
        sortable: true,
        render: (row: ItemCategoryRecord) => (
          <div className="flex items-center gap-1 font-mono text-[11px] text-[var(--erp-text)] flex-wrap">
            <FolderTree className="w-3.5 h-3.5 text-[var(--erp-accent)] shrink-0" />
            <span>{row.hierarchyPath}</span>
          </div>
        ),
      },
      {
        key: 'categoryType',
        header: 'Classification Pillar',
        sortValue: (row: ItemCategoryRecord) => row.categoryType,
        sortable: true,
        render: (row: ItemCategoryRecord) => {
          const meta = CATEGORY_TYPE_META[row.categoryType] || {
            label: row.categoryType,
            badgeClass: 'bg-slate-500/10 text-slate-500 border-slate-500/30',
          };
          return (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${meta.badgeClass}`}
            >
              <Tag className="w-3 h-3" />
              {meta.label}
            </span>
          );
        },
      },
      {
        key: 'taxation',
        header: 'HSN / SAC & Default GST Rate',
        sortValue: (row: ItemCategoryRecord) => row.defaultTaxRate,
        sortable: true,
        render: (row: ItemCategoryRecord) => (
          <div className="flex flex-col gap-0.5 font-mono text-xs">
            <div className="flex items-center gap-1 text-[var(--erp-text)] font-semibold">
              <Hash className="w-3 h-3 text-[var(--erp-accent)]" />
              <span>{row.hsnSacCode || 'Not Specified'}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-[var(--erp-text-muted)]">
              <Percent className="w-3 h-3 text-emerald-500" />
              <span>{row.defaultTaxRate}% GST Standard Rate</span>
            </div>
          </div>
        ),
      },
      {
        key: 'valuation',
        header: 'Valuation Method',
        sortValue: (row: ItemCategoryRecord) => row.defaultValuationMethod,
        sortable: true,
        render: (row: ItemCategoryRecord) => (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]">
            {row.defaultValuationMethod}
          </span>
        ),
      },
      {
        key: 'isActive',
        header: 'Status',
        sortValue: (row: ItemCategoryRecord) => (row.isActive ? 1 : 0),
        sortable: true,
        render: (row: ItemCategoryRecord) =>
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
        render: (row: ItemCategoryRecord) => (
          <div className="flex items-center gap-1.5">
            <PermissionGate screen="UOM_MASTER" action="ADD">
              <button
                type="button"
                onClick={() => handleOpenCreateCategory(row.categoryId)}
                className="p-1.5 rounded-lg bg-[var(--erp-bg-elevated)] hover:bg-[var(--erp-accent)]/15 text-[var(--erp-accent)] border border-[var(--erp-border)] transition-colors"
                title="Add Child Sub-Category"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </PermissionGate>
            <PermissionGate screen="UOM_MASTER" action="EDIT">
              <button
                type="button"
                onClick={() => handleOpenEditCategory(row)}
                className="p-1.5 rounded-lg bg-[var(--erp-bg-elevated)] hover:bg-blue-500/15 text-blue-500 border border-[var(--erp-border)] transition-colors"
                title="Edit Category"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </PermissionGate>
            <PermissionGate screen="UOM_MASTER" action="DELETE">
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteDependencies([]);
                  setDeleteTarget({
                    mode: 'CATEGORY',
                    id: row.categoryId,
                    code: row.categoryCode,
                    name: row.categoryName,
                  });
                }}
                className="p-1.5 rounded-lg bg-[var(--erp-bg-elevated)] hover:bg-rose-500/15 text-rose-500 border border-[var(--erp-border)] transition-colors"
                title="Delete Category"
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
              Phase 3 • Step 3.2 • Inventory Core
            </span>
            <span className="font-mono text-[11px] text-[var(--erp-text-muted)]">
              SCREEN_CODE: UOM_MASTER
            </span>
          </div>
          <h1 className="text-xl font-bold text-[var(--erp-text)] flex items-center gap-2.5">
            <Scale className="w-6 h-6 text-[var(--erp-accent)]" />
            UOM, UOM Conversion Matrix &amp; Item Category Hierarchy Master
          </h1>
          <p className="text-xs text-[var(--erp-text-muted)] max-w-3xl">
            Configure units of measurement with GST Unique Quantity Codes
            (UQCs), inter-UOM conversion ratios for multi-UOM procurement and
            issue slips, and recursive item categorization trees for Raw
            Materials, WIP, and Finished Goods.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <PermissionGate screen="UOM_MASTER" action="ADD">
            <button
              type="button"
              onClick={() => handleOpenCreateConversion()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 border border-indigo-500/30 transition-all"
            >
              <ArrowRightLeft className="w-4 h-4" />
              + Add Conversion Ratio
            </button>
            <button
              type="button"
              onClick={() => handleOpenCreateCategory()}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--erp-bg-elevated)] hover:bg-[var(--erp-border)] text-[var(--erp-text)] border border-[var(--erp-border)] transition-all"
            >
              <FolderTree className="w-4 h-4 text-[var(--erp-accent)]" />
              + Add Item Category
            </button>
            <button
              type="button"
              onClick={handleOpenCreateUom}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[var(--erp-accent)] hover:opacity-95 text-white shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              New UOM
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* 4 Enterprise KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--erp-bg-surface)] p-4 rounded-xl border border-[var(--erp-border)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--erp-text-muted)]">
              Units of Measurement
            </p>
            <p className="text-2xl font-bold text-[var(--erp-text)] mt-1">
              {kpiStats.totalUoms}
            </p>
            <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
              {kpiStats.baseUoms} Base Reference Units
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-600">
            <Scale className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[var(--erp-bg-surface)] p-4 rounded-xl border border-[var(--erp-border)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--erp-text-muted)]">
              Inter-UOM Conversions
            </p>
            <p className="text-2xl font-bold text-[var(--erp-text)] mt-1">
              {kpiStats.totalConversions}
            </p>
            <p className="text-[11px] text-indigo-600 font-medium mt-0.5">
              {kpiStats.standardConversions} Standard Mathematical Ratios
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-600">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[var(--erp-bg-surface)] p-4 rounded-xl border border-[var(--erp-border)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--erp-text-muted)]">
              Item Categories Tree
            </p>
            <p className="text-2xl font-bold text-[var(--erp-text)] mt-1">
              {kpiStats.totalCategories}
            </p>
            <p className="text-[11px] text-[var(--erp-text-muted)] mt-0.5">
              {kpiStats.leafCategories} Leaf Category Nodes
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600">
            <FolderTree className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[var(--erp-bg-surface)] p-4 rounded-xl border border-[var(--erp-border)] flex items-center justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--erp-text-muted)]">
              Root Classification Pillars
            </p>
            <p className="text-2xl font-bold text-[var(--erp-text)] mt-1">
              {kpiStats.rootCategories}
            </p>
            <p className="text-[11px] text-purple-600 font-medium mt-0.5">
              RM, WIP, FG, MRO, Dies
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-600">
            <Tag className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 3-Tab Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[var(--erp-bg-surface)] p-3 rounded-xl border border-[var(--erp-border)]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('UOMS')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'UOMS'
                ? 'bg-[var(--erp-accent)] text-white shadow-sm'
                : 'bg-[var(--erp-bg-elevated)] text-[var(--erp-text-muted)] hover:text-[var(--erp-text)]'
            }`}
          >
            <Scale className="w-4 h-4" />
            1. Units of Measurement ({filteredUoms.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CONVERSIONS')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'CONVERSIONS'
                ? 'bg-[var(--erp-accent)] text-white shadow-sm'
                : 'bg-[var(--erp-bg-elevated)] text-[var(--erp-text-muted)] hover:text-[var(--erp-text)]'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4" />
            2. Conversion Matrix ({conversions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CATEGORIES')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'CATEGORIES'
                ? 'bg-[var(--erp-accent)] text-white shadow-sm'
                : 'bg-[var(--erp-bg-elevated)] text-[var(--erp-text-muted)] hover:text-[var(--erp-text)]'
            }`}
          >
            <FolderTree className="w-4 h-4" />
            3. Item Category Hierarchy ({filteredCategories.length})
          </button>
        </div>

        {activeTab === 'UOMS' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--erp-text-muted)] font-semibold flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[var(--erp-accent)]" />
              Metric Type:
            </span>
            <select
              value={selectedUomTypeFilter}
              onChange={(e) => setSelectedUomTypeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
            >
              <option value="ALL">All Physical Types ({uoms.length})</option>
              {(Object.keys(UOM_TYPE_META) as UomType[]).map((t) => (
                <option key={t} value={t}>
                  {UOM_TYPE_META[t].label}
                </option>
              ))}
            </select>
          </div>
        )}

        {activeTab === 'CATEGORIES' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--erp-text-muted)] font-semibold flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-[var(--erp-accent)]" />
              Pillar:
            </span>
            <select
              value={selectedCategoryTypeFilter}
              onChange={(e) => setSelectedCategoryTypeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
            >
              <option value="ALL">All Pillars ({categories.length})</option>
              {(Object.keys(CATEGORY_TYPE_META) as CategoryType[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_TYPE_META[c].label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: UNITS OF MEASUREMENT */}
      {activeTab === 'UOMS' && (
        <MasterDataTable<UomRecord>
          title="Units of Measurement Master"
          subtitle="Real-time PostgreSQL records from tbl_inv_uom with GST UQC codes"
          screenCode="UOM_MASTER"
          data={filteredUoms}
          columns={uomColumns}
          rowKey={(row: UomRecord) => row.uomId}
          isLoading={loadingUoms}
          searchPlaceholder="Search by UOM code, unit title, GST UQC code, or physical metric type..."
          searchPredicate={(row, q) =>
            row.uomCode.toLowerCase().includes(q) ||
            row.uomName.toLowerCase().includes(q) ||
            row.uomType.toLowerCase().includes(q) ||
            row.gstUqcCode.toLowerCase().includes(q)
          }
          groupByOptions={[
            {
              key: 'type',
              label: 'Physical Metric Type',
              groupValue: (row: UomRecord) =>
                UOM_TYPE_META[row.uomType]?.label || row.uomType,
            },
            {
              key: 'base',
              label: 'Base UOM Flag',
              groupValue: (row: UomRecord) =>
                row.isBaseUom ? 'Standard Base Reference' : 'Secondary Unit',
            },
          ]}
          onExportClick={() => recordAuditAction('EXPORT')}
          onPrintClick={() => recordAuditAction('PRINT')}
        />
      )}

      {/* TAB 2: UOM CONVERSION MATRIX */}
      {activeTab === 'CONVERSIONS' && (
        <MasterDataTable<UomConversionRecord>
          title="Unit Conversion Matrix & Multi-UOM Ratios"
          subtitle="Real-time PostgreSQL records from tbl_inv_uom_conversion"
          screenCode="UOM_MASTER"
          data={conversions}
          columns={conversionColumns}
          rowKey={(row: UomConversionRecord) => row.conversionId}
          isLoading={loadingConversions}
          searchPlaceholder="Search by formula equation, source UOM, target UOM, or ratio type..."
          searchPredicate={(row, q) =>
            row.equationText.toLowerCase().includes(q) ||
            row.fromUomCode.toLowerCase().includes(q) ||
            row.toUomCode.toLowerCase().includes(q) ||
            row.conversionType.toLowerCase().includes(q) ||
            (row.remarks || '').toLowerCase().includes(q)
          }
          groupByOptions={[
            {
              key: 'fromUom',
              label: 'Source Unit (From UOM)',
              groupValue: (row: UomConversionRecord) =>
                `${row.fromUomCode} (${row.fromUomName})`,
            },
            {
              key: 'conversionType',
              label: 'Conversion Type',
              groupValue: (row: UomConversionRecord) => row.conversionType,
            },
          ]}
          onExportClick={() => recordAuditAction('EXPORT')}
          onPrintClick={() => recordAuditAction('PRINT')}
        />
      )}

      {/* TAB 3: ITEM CATEGORY HIERARCHY TREE */}
      {activeTab === 'CATEGORIES' && (
        <MasterDataTable<ItemCategoryRecord>
          title="Recursive Item Category Hierarchy Tree"
          subtitle="Real-time PostgreSQL records from tbl_inv_item_category with materialized paths"
          screenCode="UOM_MASTER"
          data={filteredCategories}
          columns={categoryColumns}
          rowKey={(row: ItemCategoryRecord) => row.categoryId}
          isLoading={loadingCategories}
          searchPlaceholder="Search by category code, title, tree path, HSN code, or pillar..."
          searchPredicate={(row, q) =>
            row.categoryCode.toLowerCase().includes(q) ||
            row.categoryName.toLowerCase().includes(q) ||
            row.hierarchyPath.toLowerCase().includes(q) ||
            (row.hsnSacCode || '').toLowerCase().includes(q) ||
            row.categoryType.toLowerCase().includes(q)
          }
          groupByOptions={[
            {
              key: 'pillar',
              label: 'Classification Pillar',
              groupValue: (row: ItemCategoryRecord) =>
                CATEGORY_TYPE_META[row.categoryType]?.label ||
                row.categoryType,
            },
            {
              key: 'depth',
              label: 'Hierarchy Depth Level',
              groupValue: (row: ItemCategoryRecord) =>
                `Level ${row.levelDepth} (${row.isLeaf ? 'Leaf' : 'Parent'})`,
            },
          ]}
          onExportClick={() => recordAuditAction('EXPORT')}
          onPrintClick={() => recordAuditAction('PRINT')}
        />
      )}

      {/* ====================================================================
          MODAL 1: CREATE / EDIT UNIT OF MEASUREMENT (tbl_inv_uom)
         ==================================================================== */}
      {isUomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[var(--erp-bg-surface)] border border-[var(--erp-border)] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--erp-border)] bg-[var(--erp-bg-elevated)]">
              <div className="flex items-center gap-2.5">
                <Scale className="w-5 h-5 text-[var(--erp-accent)]" />
                <div>
                  <h2 className="text-sm font-bold text-[var(--erp-text)]">
                    {editingUom
                      ? `Edit UOM — ${editingUom.uomCode}`
                      : 'Create Unit of Measurement'}
                  </h2>
                  <p className="text-[11px] text-[var(--erp-text-muted)]">
                    Persisted to PostgreSQL table tbl_inv_uom
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUomModalOpen(false)}
                className="p-1.5 rounded-lg text-[var(--erp-text-muted)] hover:text-[var(--erp-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {uomFormError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{uomFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    UOM Code *
                  </label>
                  <input
                    type="text"
                    value={uomForm.uomCode}
                    onChange={(e) =>
                      setUomForm((prev) => ({
                        ...prev,
                        uomCode: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="e.g. KG, NOS, MTR"
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    GST UQC Code *
                  </label>
                  <input
                    type="text"
                    value={uomForm.gstUqcCode}
                    onChange={(e) =>
                      setUomForm((prev) => ({
                        ...prev,
                        gstUqcCode: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="e.g. KGS, NOS, MTR"
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    UOM Name / Full Description *
                  </label>
                  <input
                    type="text"
                    value={uomForm.uomName}
                    onChange={(e) =>
                      setUomForm((prev) => ({
                        ...prev,
                        uomName: e.target.value,
                      }))
                    }
                    placeholder="e.g. Kilograms, Numbers / Pieces, Linear Meters"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Physical Metric Type *
                  </label>
                  <select
                    value={uomForm.uomType}
                    onChange={(e) =>
                      setUomForm((prev) => ({
                        ...prev,
                        uomType: e.target.value as UomType,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  >
                    {(Object.keys(UOM_TYPE_META) as UomType[]).map((k) => (
                      <option key={k} value={k}>
                        {UOM_TYPE_META[k].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Decimal Precision (0 – 6)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    value={uomForm.decimalPrecision}
                    onChange={(e) =>
                      setUomForm((prev) => ({
                        ...prev,
                        decimalPrecision: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[var(--erp-border)]">
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uomForm.isBaseUom}
                    onChange={(e) =>
                      setUomForm((prev) => ({
                        ...prev,
                        isBaseUom: e.target.checked,
                      }))
                    }
                  />
                  <div>
                    <div className="font-semibold text-[var(--erp-text)]">
                      Base Reference UOM
                    </div>
                    <div className="text-[10px] text-[var(--erp-text-muted)]">
                      Primary standard unit for this physical type
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={uomForm.isActive}
                    onChange={(e) =>
                      setUomForm((prev) => ({
                        ...prev,
                        isActive: e.target.checked,
                      }))
                    }
                  />
                  <span className="font-semibold text-[var(--erp-text)]">
                    Active for Items &amp; Transactions
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[var(--erp-border)] bg-[var(--erp-bg-elevated)]">
              <button
                type="button"
                onClick={() => setIsUomModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--erp-border)] text-[var(--erp-text-muted)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveUomMutation.isPending}
                onClick={() => saveUomMutation.mutate()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-[var(--erp-accent)] text-white hover:opacity-95 disabled:opacity-50"
              >
                {saveUomMutation.isPending
                  ? 'Saving...'
                  : editingUom
                    ? 'Update UOM'
                    : 'Create UOM'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: CREATE / EDIT UOM CONVERSION (tbl_inv_uom_conversion)
         ==================================================================== */}
      {isConvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[var(--erp-bg-surface)] border border-[var(--erp-border)] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--erp-border)] bg-[var(--erp-bg-elevated)]">
              <div className="flex items-center gap-2.5">
                <ArrowRightLeft className="w-5 h-5 text-indigo-500" />
                <div>
                  <h2 className="text-sm font-bold text-[var(--erp-text)]">
                    {editingConv
                      ? `Edit Conversion — ${editingConv.equationText}`
                      : 'Create Unit Conversion Ratio'}
                  </h2>
                  <p className="text-[11px] text-[var(--erp-text-muted)]">
                    Persisted to PostgreSQL table tbl_inv_uom_conversion
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConvModalOpen(false)}
                className="p-1.5 rounded-lg text-[var(--erp-text-muted)] hover:text-[var(--erp-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {convFormError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{convFormError}</span>
                </div>
              )}

              {/* Live Formula Preview Box */}
              <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/25 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  Live Mathematical Ratio Equation
                </span>
                <div className="flex items-center gap-2 font-mono text-xs font-bold text-[var(--erp-text)]">
                  <span>
                    1{' '}
                    {uoms.find((u) => u.uomId === Number(convForm.fromUomId))
                      ?.uomCode || 'FROM'}{' '}
                    = {convForm.conversionFactor}{' '}
                    {uoms.find((u) => u.uomId === Number(convForm.toUomId))
                      ?.uomCode || 'TO'}
                  </span>
                  <span className="text-[var(--erp-text-muted)]">•</span>
                  <span className="text-[11px] text-[var(--erp-text-muted)]">
                    1{' '}
                    {uoms.find((u) => u.uomId === Number(convForm.toUomId))
                      ?.uomCode || 'TO'}{' '}
                    ={' '}
                    {convForm.conversionFactor > 0
                      ? (1 / Number(convForm.conversionFactor)).toFixed(6)
                      : 0}{' '}
                    {uoms.find((u) => u.uomId === Number(convForm.fromUomId))
                      ?.uomCode || 'FROM'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Source Unit (From UOM) *
                  </label>
                  <select
                    value={convForm.fromUomId}
                    onChange={(e) =>
                      setConvForm((prev) => ({
                        ...prev,
                        fromUomId: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  >
                    {uoms.map((u) => (
                      <option key={u.uomId} value={u.uomId}>
                        {u.uomCode} — {u.uomName} ({u.uomType})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Target Unit (To UOM) *
                  </label>
                  <select
                    value={convForm.toUomId}
                    onChange={(e) =>
                      setConvForm((prev) => ({
                        ...prev,
                        toUomId: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  >
                    {uoms.map((u) => (
                      <option key={u.uomId} value={u.uomId}>
                        {u.uomCode} — {u.uomName} ({u.uomType})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Conversion Multiplier Factor *
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    min="0.000001"
                    value={convForm.conversionFactor}
                    onChange={(e) => {
                      const factor = Number(e.target.value);
                      setConvForm((prev) => ({
                        ...prev,
                        conversionFactor: factor,
                        inverseFactor:
                          factor > 0
                            ? Number((1 / factor).toFixed(6))
                            : prev.inverseFactor,
                      }));
                    }}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Conversion Ratio Classification *
                  </label>
                  <select
                    value={convForm.conversionType}
                    onChange={(e) =>
                      setConvForm((prev) => ({
                        ...prev,
                        conversionType: e.target.value as ConversionType,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  >
                    <option value="STANDARD">
                      STANDARD (Mathematical metric conversion)
                    </option>
                    <option value="PACKAGING">
                      PACKAGING (Box, Carton, Pallet packing)
                    </option>
                    <option value="ITEM_SPECIFIC">
                      ITEM_SPECIFIC (Specific material density ratio)
                    </option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Notes / Reference Specification
                  </label>
                  <input
                    type="text"
                    value={convForm.remarks}
                    onChange={(e) =>
                      setConvForm((prev) => ({
                        ...prev,
                        remarks: e.target.value,
                      }))
                    }
                    placeholder="e.g. 1 Metric Tonne = 1000 Kilograms"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[var(--erp-border)]">
                {!editingConv && (
                  <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={convForm.createBidirectionalPair}
                      onChange={(e) =>
                        setConvForm((prev) => ({
                          ...prev,
                          createBidirectionalPair: e.target.checked,
                        }))
                      }
                    />
                    <div>
                      <div className="font-semibold text-[var(--erp-text)]">
                        Auto-Create Reciprocal Pair
                      </div>
                      <div className="text-[10px] text-[var(--erp-text-muted)]">
                        Automatically register the reverse ratio in DB
                      </div>
                    </div>
                  </label>
                )}

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={convForm.isActive}
                    onChange={(e) =>
                      setConvForm((prev) => ({
                        ...prev,
                        isActive: e.target.checked,
                      }))
                    }
                  />
                  <span className="font-semibold text-[var(--erp-text)]">
                    Active for Multi-UOM Transactions
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[var(--erp-border)] bg-[var(--erp-bg-elevated)]">
              <button
                type="button"
                onClick={() => setIsConvModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--erp-border)] text-[var(--erp-text-muted)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveConvMutation.isPending}
                onClick={() => saveConvMutation.mutate()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:opacity-95 disabled:opacity-50"
              >
                {saveConvMutation.isPending
                  ? 'Saving...'
                  : editingConv
                    ? 'Update Conversion'
                    : 'Create Conversion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: CREATE / EDIT ITEM CATEGORY (tbl_inv_item_category)
         ==================================================================== */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[var(--erp-bg-surface)] border border-[var(--erp-border)] rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--erp-border)] bg-[var(--erp-bg-elevated)]">
              <div className="flex items-center gap-2.5">
                <FolderTree className="w-5 h-5 text-emerald-500" />
                <div>
                  <h2 className="text-sm font-bold text-[var(--erp-text)]">
                    {editingCategory
                      ? `Edit Category — ${editingCategory.categoryCode}`
                      : 'Create Item Category Node'}
                  </h2>
                  <p className="text-[11px] text-[var(--erp-text-muted)]">
                    Persisted to PostgreSQL table tbl_inv_item_category
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="p-1.5 rounded-lg text-[var(--erp-text-muted)] hover:text-[var(--erp-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {categoryFormError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{categoryFormError}</span>
                </div>
              )}

              {/* Hierarchy Path Preview */}
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                  Target Tree Hierarchy Path Preview
                </span>
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-[var(--erp-text)]">
                  <FolderTree className="w-3.5 h-3.5 text-emerald-500" />
                  <span>
                    {categoryForm.parentCategoryId
                      ? `${
                          categories.find(
                            (c) =>
                              c.categoryId ===
                              Number(categoryForm.parentCategoryId),
                          )?.hierarchyPath
                        } / ${categoryForm.categoryCode || 'NEW_NODE'}`
                      : categoryForm.categoryCode || 'ROOT_NODE'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Parent Tree Category
                  </label>
                  <select
                    value={categoryForm.parentCategoryId}
                    onChange={(e) =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        parentCategoryId: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  >
                    <option value="">-- Root Level Pillar (Depth 1) --</option>
                    {categories
                      .filter((c) =>
                        editingCategory
                          ? c.categoryId !== editingCategory.categoryId
                          : true,
                      )
                      .map((c) => (
                        <option key={c.categoryId} value={c.categoryId}>
                          {c.hierarchyPath} ({c.categoryName})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Classification Pillar *
                  </label>
                  <select
                    value={categoryForm.categoryType}
                    onChange={(e) =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        categoryType: e.target.value as CategoryType,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  >
                    {(
                      Object.keys(CATEGORY_TYPE_META) as CategoryType[]
                    ).map((k) => (
                      <option key={k} value={k}>
                        {CATEGORY_TYPE_META[k].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Category Code *
                  </label>
                  <input
                    type="text"
                    value={categoryForm.categoryCode}
                    onChange={(e) =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        categoryCode: e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9_-]/g, '_'),
                      }))
                    }
                    placeholder="e.g. RM_HR_SHEET"
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Default HSN / SAC Code
                  </label>
                  <input
                    type="text"
                    value={categoryForm.hsnSacCode}
                    onChange={(e) =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        hsnSacCode: e.target.value.trim(),
                      }))
                    }
                    placeholder="e.g. 7208, 8708, 2710"
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Category Title / Name *
                  </label>
                  <input
                    type="text"
                    value={categoryForm.categoryName}
                    onChange={(e) =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        categoryName: e.target.value,
                      }))
                    }
                    placeholder="e.g. Hot Rolled Steel Coils & Sheets"
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Default GST Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    value={categoryForm.defaultTaxRate}
                    onChange={(e) =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        defaultTaxRate: Number(e.target.value),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--erp-text)] mb-1">
                    Valuation Method *
                  </label>
                  <select
                    value={categoryForm.defaultValuationMethod}
                    onChange={(e) =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        defaultValuationMethod: e.target
                          .value as ValuationMethod,
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl text-xs bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-[var(--erp-text)]"
                  >
                    <option value="FIFO">FIFO (First-In, First-Out)</option>
                    <option value="WEIGHTED_AVG">
                      WEIGHTED_AVG (Moving Weighted Average)
                    </option>
                    <option value="STANDARD_COST">
                      STANDARD_COST (BOM Standard Costing)
                    </option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[var(--erp-border)]">
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={categoryForm.isLeaf}
                    onChange={(e) =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        isLeaf: e.target.checked,
                      }))
                    }
                  />
                  <div>
                    <div className="font-semibold text-[var(--erp-text)]">
                      Leaf Node (Item Selectable)
                    </div>
                    <div className="text-[10px] text-[var(--erp-text-muted)]">
                      Items can be directly assigned to this category
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--erp-bg-elevated)] border border-[var(--erp-border)] text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={categoryForm.isActive}
                    onChange={(e) =>
                      setCategoryForm((prev) => ({
                        ...prev,
                        isActive: e.target.checked,
                      }))
                    }
                  />
                  <span className="font-semibold text-[var(--erp-text)]">
                    Active for Item Master Creation
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[var(--erp-border)] bg-[var(--erp-bg-elevated)]">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold border border-[var(--erp-border)] text-[var(--erp-text-muted)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saveCategoryMutation.isPending}
                onClick={() => saveCategoryMutation.mutate()}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:opacity-95 disabled:opacity-50"
              >
                {saveCategoryMutation.isPending
                  ? 'Saving...'
                  : editingCategory
                    ? 'Update Category'
                    : 'Create Category'}
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
          deleteTarget?.mode === 'UOM'
            ? 'Unit of Measurement'
            : deleteTarget?.mode === 'CONVERSION'
              ? 'UOM Conversion Ratio'
              : 'Item Category'
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

export default UomMasterPage;
