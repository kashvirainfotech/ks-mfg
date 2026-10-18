import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowRight,
  Boxes,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  CornerDownRight,
  DollarSign,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderTree,
  GitBranch,
  GitFork,
  HelpCircle,
  Layers,
  Package,
  Percent,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  User,
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
import {
  ConfirmDeleteModal,
  type DependencyConflictItem,
} from '../../components/common/ConfirmDeleteModal';
import { PermissionGate } from '../../components/common/PermissionGate';

// ============================================================================
// TYPES & CATALOGUES
// ============================================================================

export type BomStatus = 'DRAFT' | 'ACTIVE' | 'OBSOLETE';
export type BomType = 'PRODUCTION' | 'TEMPLATE' | 'ENGINEERING' | 'PROTOTYPE';
export type ComponentSourceType = 'PURCHASED' | 'MANUFACTURED' | 'SUBCONTRACTED';
export type ByproductType = 'BY_PRODUCT' | 'CO_PRODUCT' | 'RECOVERABLE_SCRAP';

export interface BomComponentItem {
  bomItemId?: number;
  bomId?: number;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  itemType?: string;
  itemDescription?: string;
  uomId: number;
  uomCode?: string;
  uomName?: string;
  quantity: number;
  scrapFactorPercent: number;
  grossQuantity: number;
  childBomId?: number | null;
  childBomCode?: string | null;
  childBomName?: string | null;
  unitCost: number;
  lineCost: number;
  sourceType: ComponentSourceType;
  operationSeq?: number;
  operationName?: string;
  isCritical?: boolean;
  remarks?: string;
}

export interface BomByproduct {
  bomByproductId?: number;
  bomId?: number;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  itemDescription?: string;
  uomId: number;
  uomCode?: string;
  uomName?: string;
  quantity: number;
  productType: ByproductType;
  costAllocationPercent: number;
  estimatedRecoveryRate: number;
  estimatedRecoveryValue: number;
  remarks?: string;
}

export interface BomHeaderRecord {
  bomId: number;
  compId: number;
  branchId: number;
  fyearId?: number | null;
  bomCode: string;
  bomName: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  drawingNo?: string;
  revisionNo?: string;
  uomId: number;
  uomCode: string;
  uomName: string;
  outputQty: number;
  versionNo: string;
  bomType: BomType;
  status: BomStatus;
  isDefault: boolean;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  routingId?: number | null;
  totalMaterialCost: number;
  totalLabourCost: number;
  totalOverheadCost: number;
  totalByproductRecovery: number;
  netUnitCost: number;
  approvedBy?: number | null;
  approvedByName?: string | null;
  approvedDate?: string | null;
  approvalRemarks?: string | null;
  remarks?: string | null;
  createdDate: string;
  createdBy: number;
  createdByName?: string;
  componentCount?: number;
  byproductCount?: number;
  isMultiLevel?: boolean;
  items?: BomComponentItem[];
  byproducts?: BomByproduct[];
}

export interface BomSummary {
  totalBoms: number;
  activeBoms: number;
  distinctAssemblies: number;
  avgUnitCost: number;
  multiLevelBoms: number;
}

export interface BomTreeNode {
  level: number;
  bomId?: number;
  bomCode?: string;
  bomItemId?: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  uomCode: string;
  sourceType: string;
  quantityPerUnit: number;
  scrapFactorPercent: number;
  grossQuantity: number;
  cumulativeQuantity: number;
  unitCost: number;
  lineCost: number;
  operationSeq?: number;
  operationName?: string;
  isCritical?: boolean;
  children: BomTreeNode[];
}

export interface ManufacturedItemOption {
  itemId: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  baseUomId: number;
  uomCode: string;
  uomName: string;
  standardCost: number;
}

export interface ComponentItemOption {
  itemId: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  baseUomId: number;
  uomCode: string;
  uomName: string;
  standardCost: number;
}

export interface ChildBomOption {
  bomId: number;
  bomCode: string;
  bomName: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  versionNo: string;
  outputQty: number;
  netUnitCost: number;
}

export interface UomOption {
  uomId: number;
  uomCode: string;
  uomName: string;
}

// Visual badging maps
const STATUS_BADGE_MAP: Record<
  BomStatus,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  DRAFT: {
    label: 'Draft Engineering',
    bg: 'bg-muted/80',
    text: 'text-muted-foreground',
    border: 'border-border',
    dot: 'bg-slate-400',
  },
  ACTIVE: {
    label: 'Production Released',
    bg: 'bg-emerald-500/10 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-300 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  OBSOLETE: {
    label: 'Obsolete / Archived',
    bg: 'bg-rose-500/10 dark:bg-rose-950/30',
    text: 'text-rose-700 dark:text-rose-400',
    border: 'border-rose-300 dark:border-rose-800',
    dot: 'bg-rose-500',
  },
};

const BOM_TYPE_BADGE_MAP: Record<
  BomType,
  { label: string; bg: string; text: string; border: string }
> = {
  PRODUCTION: {
    label: 'Production Standard',
    bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    text: 'text-blue-700 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  TEMPLATE: {
    label: 'Standard Template',
    bg: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
    text: 'text-indigo-700 dark:text-indigo-400',
    border: 'border-indigo-200 dark:border-indigo-800',
  },
  ENGINEERING: {
    label: 'R&D / Engineering',
    bg: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
    text: 'text-purple-700 dark:text-purple-400',
    border: 'border-purple-200 dark:border-purple-800',
  },
  PROTOTYPE: {
    label: 'Pilot Prototype',
    bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
  },
};

// ============================================================================
// MAIN COMPONENT: BomMasterPage
// ============================================================================

export const BomMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [bomTypeFilter, setBomTypeFilter] = useState<string>('ALL');
  const [defaultFilter, setDefaultFilter] = useState<string>('ALL');
  const [globalSearch, setGlobalSearch] = useState<string>('');

  // Modals & Panels State
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingBomId, setEditingBomId] = useState<number | null>(null);
  const [editorActiveTab, setEditorActiveTab] = useState<'HEADER' | 'COMPONENTS' | 'BYPRODUCTS' | 'COSTING'>('HEADER');

  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [selectedBomId, setSelectedBomId] = useState<number | null>(null);

  const [isTreeModalOpen, setIsTreeModalOpen] = useState<boolean>(false);
  const [treeTargetBomId, setTreeTargetBomId] = useState<number | null>(null);

  const [isCloneModalOpen, setIsCloneModalOpen] = useState<boolean>(false);
  const [cloneTargetBom, setCloneTargetBom] = useState<BomHeaderRecord | null>(null);
  const [cloneNewVersion, setCloneNewVersion] = useState<string>('2.0');
  const [cloneNewName, setCloneNewName] = useState<string>('');
  const [cloneNewCode, setCloneNewCode] = useState<string>('');
  const [cloneSetDefault, setCloneSetDefault] = useState<boolean>(false);

  const [isApproveModalOpen, setIsApproveModalOpen] = useState<boolean>(false);
  const [approveTargetBom, setApproveTargetBom] = useState<BomHeaderRecord | null>(null);
  const [approveRemarks, setApproveRemarks] = useState<string>('BOM Engineering Approved & Released to Production');

  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [printTargetBomId, setPrintTargetBomId] = useState<number | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<BomHeaderRecord | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);
  const [deleteConflicts, setDeleteConflicts] = useState<DependencyConflictItem[]>([]);

  // --------------------------------------------------------------------------
  // Form State for BOM Creation & Editing
  // --------------------------------------------------------------------------
  const [formBomCode, setFormBomCode] = useState<string>('');
  const [formBomName, setFormBomName] = useState<string>('');
  const [formItemId, setFormItemId] = useState<number | ''>('');
  const [formUomId, setFormUomId] = useState<number | ''>('');
  const [formOutputQty, setFormOutputQty] = useState<number>(1.0);
  const [formVersionNo, setFormVersionNo] = useState<string>('1.0');
  const [formBomType, setFormBomType] = useState<BomType>('PRODUCTION');
  const [formStatus, setFormStatus] = useState<BomStatus>('DRAFT');
  const [formIsDefault, setFormIsDefault] = useState<boolean>(true);
  const [formEffectiveFrom, setFormEffectiveFrom] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [formEffectiveTo, setFormEffectiveTo] = useState<string>('');
  const [formRoutingId, setFormRoutingId] = useState<number | ''>('');
  const [formRemarks, setFormRemarks] = useState<string>('');
  const [formLabourCost, setFormLabourCost] = useState<number>(0);
  const [formOverheadCost, setFormOverheadCost] = useState<number>(0);

  // Line items state
  const [formItems, setFormItems] = useState<
    {
      bomItemId?: number;
      itemId: number;
      itemCode?: string;
      itemName?: string;
      itemDescription?: string;
      uomId: number;
      uomCode?: string;
      quantity: number;
      scrapFactorPercent: number;
      grossQuantity: number;
      childBomId?: number | null;
      unitCost: number;
      lineCost: number;
      sourceType: ComponentSourceType;
      operationSeq: number;
      operationName: string;
      isCritical: boolean;
      remarks: string;
    }[]
  >([]);

  // Byproducts state
  const [formByproducts, setFormByproducts] = useState<
    {
      bomByproductId?: number;
      itemId: number;
      itemCode?: string;
      itemName?: string;
      itemDescription?: string;
      uomId: number;
      uomCode?: string;
      quantity: number;
      productType: ByproductType;
      costAllocationPercent: number;
      estimatedRecoveryRate: number;
      estimatedRecoveryValue: number;
      remarks: string;
    }[]
  >([]);

  // --------------------------------------------------------------------------
  // Server Queries
  // --------------------------------------------------------------------------

  // 1. KPI Summary
  const { data: summary, isLoading: isSummaryLoading } = useQuery<BomSummary>({
    queryKey: ['manufacturing', 'boms', 'summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<BomSummary>>(
        '/manufacturing/boms/summary',
      );
      return res.data.data;
    },
  });

  // 2. BOM Listing
  const {
    data: bomList = [],
    isLoading: isListLoading,
    refetch: refetchBoms,
  } = useQuery<BomHeaderRecord[]>({
    queryKey: [
      'manufacturing',
      'boms',
      statusFilter,
      bomTypeFilter,
      defaultFilter,
      globalSearch,
    ],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (bomTypeFilter !== 'ALL') params.bomType = bomTypeFilter;
      if (defaultFilter !== 'ALL') params.isDefault = defaultFilter === 'TRUE' ? 'true' : 'false';
      if (globalSearch.trim()) params.search = globalSearch.trim();

      const res = await apiClient.get<ApiResponse<BomHeaderRecord[]>>(
        '/manufacturing/boms',
        { params },
      );
      return res.data.data;
    },
  });

  // 3. Lookups
  const { data: manufacturedItems = [] } = useQuery<ManufacturedItemOption[]>({
    queryKey: ['manufacturing', 'boms', 'manufactured-items'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ManufacturedItemOption[]>>(
        '/manufacturing/boms/manufactured-items',
      );
      return res.data.data;
    },
    staleTime: 60_000,
  });

  const { data: componentCatalog = [] } = useQuery<ComponentItemOption[]>({
    queryKey: ['manufacturing', 'boms', 'component-items'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ComponentItemOption[]>>(
        '/manufacturing/boms/component-items',
      );
      return res.data.data;
    },
    staleTime: 60_000,
  });

  const { data: childBoms = [] } = useQuery<ChildBomOption[]>({
    queryKey: ['manufacturing', 'boms', 'child-boms'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ChildBomOption[]>>(
        '/manufacturing/boms/child-boms',
      );
      return res.data.data;
    },
    staleTime: 30_000,
  });

  const { data: uomsCatalog = [] } = useQuery<UomOption[]>({
    queryKey: ['manufacturing', 'boms', 'uoms'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<UomOption[]>>(
        '/manufacturing/boms/uoms',
      );
      return res.data.data;
    },
    staleTime: 60_000,
  });

  // 4. Single BOM detail query (for detail view & print)
  const detailQueryId = selectedBomId || printTargetBomId || (isEditorOpen && editingBomId ? editingBomId : null);
  const { data: selectedBomDetail, isLoading: isDetailLoading } = useQuery<BomHeaderRecord>({
    queryKey: ['manufacturing', 'boms', 'detail', detailQueryId],
    queryFn: async () => {
      if (!detailQueryId) throw new Error('No BOM selected');
      const res = await apiClient.get<ApiResponse<BomHeaderRecord>>(
        `/manufacturing/boms/${detailQueryId}`,
      );
      return res.data.data;
    },
    enabled: Boolean(detailQueryId),
  });

  // 5. Tree Explosion Query
  const {
    data: treeData,
    isLoading: isTreeLoading,
    error: treeError,
  } = useQuery<BomTreeNode>({
    queryKey: ['manufacturing', 'boms', 'tree', treeTargetBomId],
    queryFn: async () => {
      if (!treeTargetBomId) throw new Error('No BOM selected for tree explosion');
      const res = await apiClient.get<ApiResponse<BomTreeNode>>(
        `/manufacturing/boms/${treeTargetBomId}/tree`,
      );
      return res.data.data;
    },
    enabled: Boolean(treeTargetBomId && isTreeModalOpen),
  });

  // --------------------------------------------------------------------------
  // Live Cost Rollup Computations in Editor
  // --------------------------------------------------------------------------
  const calculatedCostRollup = useMemo(() => {
    let matCost = 0;
    for (const item of formItems) {
      const netQty = Number(item.quantity) || 0;
      const scrapPct = Number(item.scrapFactorPercent) || 0;
      const grossQty = Math.round(netQty * (1 + scrapPct / 100) * 10000) / 10000;
      const unitRate = Number(item.unitCost) || 0;
      matCost += grossQty * unitRate;
    }
    matCost = Math.round(matCost * 100) / 100;

    let byprodRecovery = 0;
    for (const bp of formByproducts) {
      const qty = Number(bp.quantity) || 0;
      const rate = Number(bp.estimatedRecoveryRate) || 0;
      byprodRecovery += qty * rate;
    }
    byprodRecovery = Math.round(byprodRecovery * 100) / 100;

    const labCost = Number(formLabourCost) || 0;
    const ovhCost = Number(formOverheadCost) || 0;
    const grossCost = matCost + labCost + ovhCost;
    const netTotalCost = Math.max(0, grossCost - byprodRecovery);
    const outQty = Number(formOutputQty) > 0 ? Number(formOutputQty) : 1.0;
    const netUnit = Math.round((netTotalCost / outQty) * 10000) / 10000;

    return {
      totalMaterialCost: matCost,
      totalLabourCost: labCost,
      totalOverheadCost: ovhCost,
      grossManufacturingCost: grossCost,
      totalByproductRecovery: byprodRecovery,
      netTotalManufacturingCost: netTotalCost,
      netUnitCost: netUnit,
    };
  }, [formItems, formByproducts, formLabourCost, formOverheadCost, formOutputQty]);

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  // Save BOM (Create or Update)
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!formItemId) throw new Error('Manufactured Item is required.');
      if (!formUomId) throw new Error('UOM is required.');
      if (!formBomName.trim()) throw new Error('BOM Name is required.');
      if (formItems.length === 0) throw new Error('At least one component line item is required.');

      const payload = {
        bomCode: formBomCode.trim() || undefined,
        bomName: formBomName.trim(),
        itemId: Number(formItemId),
        uomId: Number(formUomId),
        outputQty: Number(formOutputQty) || 1.0,
        versionNo: formVersionNo.trim() || '1.0',
        bomType: formBomType,
        status: formStatus,
        isDefault: formIsDefault,
        effectiveFrom: formEffectiveFrom || undefined,
        effectiveTo: formEffectiveTo || undefined,
        routingId: formRoutingId ? Number(formRoutingId) : undefined,
        totalLabourCost: Number(formLabourCost) || 0,
        totalOverheadCost: Number(formOverheadCost) || 0,
        remarks: formRemarks.trim() || undefined,
        items: formItems.map((it) => ({
          itemId: Number(it.itemId),
          itemDescription: it.itemDescription || undefined,
          uomId: Number(it.uomId),
          quantity: Number(it.quantity) || 0,
          scrapFactorPercent: Number(it.scrapFactorPercent) || 0,
          childBomId: it.childBomId ? Number(it.childBomId) : undefined,
          unitCost: Number(it.unitCost) || 0,
          sourceType: it.sourceType,
          operationSeq: Number(it.operationSeq) || 10,
          operationName: it.operationName || undefined,
          isCritical: Boolean(it.isCritical),
          remarks: it.remarks || undefined,
        })),
        byproducts: formByproducts.map((bp) => ({
          itemId: Number(bp.itemId),
          itemDescription: bp.itemDescription || undefined,
          uomId: Number(bp.uomId),
          quantity: Number(bp.quantity) || 0,
          productType: bp.productType,
          costAllocationPercent: Number(bp.costAllocationPercent) || 0,
          estimatedRecoveryRate: Number(bp.estimatedRecoveryRate) || 0,
          remarks: bp.remarks || undefined,
        })),
      };

      if (editingBomId) {
        return apiClient.put(`/manufacturing/boms/${editingBomId}`, payload);
      } else {
        return apiClient.post('/manufacturing/boms', payload);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturing', 'boms'] });
      setIsEditorOpen(false);
      resetForm();
    },
  });

  // Approve BOM
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!approveTargetBom) return;
      return apiClient.post(`/manufacturing/boms/${approveTargetBom.bomId}/approve`, {
        approvalRemarks: approveRemarks,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturing', 'boms'] });
      setIsApproveModalOpen(false);
      setApproveTargetBom(null);
    },
  });

  // Clone BOM
  const cloneMutation = useMutation({
    mutationFn: async () => {
      if (!cloneTargetBom) return;
      return apiClient.post(`/manufacturing/boms/${cloneTargetBom.bomId}/clone`, {
        newVersionNo: cloneNewVersion.trim(),
        newBomName: cloneNewName.trim() || undefined,
        newBomCode: cloneNewCode.trim() || undefined,
        isDefault: cloneSetDefault,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturing', 'boms'] });
      setIsCloneModalOpen(false);
      setCloneTargetBom(null);
    },
  });

  // Delete BOM
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteTarget) return;
      return apiClient.delete(`/manufacturing/boms/${deleteTarget.bomId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manufacturing', 'boms'] });
      setDeleteTarget(null);
      setDeleteErrorMessage(null);
      setDeleteConflicts([]);
    },
    onError: (err: any) => {
      const resp = err.response?.data;
      setDeleteErrorMessage(resp?.message || 'Failed to delete Bill of Materials.');
      if (resp?.details?.conflicts) {
        setDeleteConflicts(resp.details.conflicts);
      }
    },
  });

  // --------------------------------------------------------------------------
  // Helper Handlers
  // --------------------------------------------------------------------------

  const resetForm = () => {
    setEditingBomId(null);
    setFormBomCode('');
    setFormBomName('');
    setFormItemId('');
    setFormUomId('');
    setFormOutputQty(1.0);
    setFormVersionNo('1.0');
    setFormBomType('PRODUCTION');
    setFormStatus('DRAFT');
    setFormIsDefault(true);
    setFormEffectiveFrom(new Date().toISOString().split('T')[0]);
    setFormEffectiveTo('');
    setFormRoutingId('');
    setFormRemarks('');
    setFormLabourCost(0);
    setFormOverheadCost(0);
    setFormItems([]);
    setFormByproducts([]);
    setEditorActiveTab('HEADER');
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setIsEditorOpen(true);
  };

  const handleOpenEditModal = (bom: BomHeaderRecord) => {
    setEditingBomId(bom.bomId);
    setFormBomCode(bom.bomCode);
    setFormBomName(bom.bomName);
    setFormItemId(bom.itemId);
    setFormUomId(bom.uomId);
    setFormOutputQty(Number(bom.outputQty) || 1.0);
    setFormVersionNo(bom.versionNo);
    setFormBomType(bom.bomType);
    setFormStatus(bom.status);
    setFormIsDefault(bom.isDefault);
    setFormEffectiveFrom(bom.effectiveFrom ? bom.effectiveFrom.split('T')[0] : '');
    setFormEffectiveTo(bom.effectiveTo ? bom.effectiveTo.split('T')[0] : '');
    setFormRoutingId(bom.routingId || '');
    setFormRemarks(bom.remarks || '');
    setFormLabourCost(Number(bom.totalLabourCost) || 0);
    setFormOverheadCost(Number(bom.totalOverheadCost) || 0);

    // Fetch full detail with items
    apiClient
      .get<ApiResponse<BomHeaderRecord>>(`/manufacturing/boms/${bom.bomId}`)
      .then((res) => {
        const d = res.data.data;
        if (d.items) {
          setFormItems(
            d.items.map((it) => ({
              bomItemId: it.bomItemId,
              itemId: it.itemId,
              itemCode: it.itemCode,
              itemName: it.itemName,
              itemDescription: it.itemDescription,
              uomId: it.uomId,
              uomCode: it.uomCode,
              quantity: Number(it.quantity) || 0,
              scrapFactorPercent: Number(it.scrapFactorPercent) || 0,
              grossQuantity: Number(it.grossQuantity) || 0,
              childBomId: it.childBomId || null,
              unitCost: Number(it.unitCost) || 0,
              lineCost: Number(it.lineCost) || 0,
              sourceType: it.sourceType,
              operationSeq: it.operationSeq || 10,
              operationName: it.operationName || '',
              isCritical: Boolean(it.isCritical),
              remarks: it.remarks || '',
            })),
          );
        }
        if (d.byproducts) {
          setFormByproducts(
            d.byproducts.map((bp) => ({
              bomByproductId: bp.bomByproductId,
              itemId: bp.itemId,
              itemCode: bp.itemCode,
              itemName: bp.itemName,
              itemDescription: bp.itemDescription,
              uomId: bp.uomId,
              uomCode: bp.uomCode,
              quantity: Number(bp.quantity) || 0,
              productType: bp.productType,
              costAllocationPercent: Number(bp.costAllocationPercent) || 0,
              estimatedRecoveryRate: Number(bp.estimatedRecoveryRate) || 0,
              estimatedRecoveryValue: Number(bp.estimatedRecoveryValue) || 0,
              remarks: bp.remarks || '',
            })),
          );
        }
      });

    setEditorActiveTab('HEADER');
    setIsEditorOpen(true);
  };

  const handleItemSelectInHeader = (itemIdNum: number) => {
    setFormItemId(itemIdNum);
    const item = manufacturedItems.find((m) => m.itemId === itemIdNum);
    if (item) {
      setFormUomId(item.baseUomId);
      if (!formBomName || formBomName.startsWith('BOM for')) {
        setFormBomName(`BOM for ${item.itemName}`);
      }
    }
  };

  // Add Component Item Row
  const handleAddComponentRow = () => {
    setFormItems((prev) => [
      ...prev,
      {
        itemId: componentCatalog[0]?.itemId || 0,
        itemCode: componentCatalog[0]?.itemCode || '',
        itemName: componentCatalog[0]?.itemName || '',
        itemDescription: '',
        uomId: componentCatalog[0]?.baseUomId || uomsCatalog[0]?.uomId || 1001,
        uomCode: componentCatalog[0]?.uomCode || 'NOS',
        quantity: 1,
        scrapFactorPercent: 0,
        grossQuantity: 1,
        childBomId: null,
        unitCost: componentCatalog[0]?.standardCost || 0,
        lineCost: componentCatalog[0]?.standardCost || 0,
        sourceType: 'PURCHASED',
        operationSeq: (prev.length + 1) * 10,
        operationName: 'Assembly Operation',
        isCritical: false,
        remarks: '',
      },
    ]);
  };

  // Update Component Item Row
  const handleUpdateComponentRow = (index: number, patch: Partial<(typeof formItems)[0]>) => {
    setFormItems((prev) => {
      const next = [...prev];
      const cur = { ...next[index], ...patch };

      // If item changed, autofill default UOM, standard cost, and item info
      if (patch.itemId !== undefined && patch.itemId !== next[index].itemId) {
        const it = componentCatalog.find((c) => c.itemId === patch.itemId);
        if (it) {
          cur.itemId = it.itemId;
          cur.itemCode = it.itemCode;
          cur.itemName = it.itemName;
          cur.uomId = it.baseUomId;
          cur.uomCode = it.uomCode;
          cur.unitCost = it.standardCost || 0;
        }
      }

      // If childBomId changed, optionally link unit cost from child BOM
      if (patch.childBomId !== undefined && patch.childBomId) {
        const cb = childBoms.find((b) => b.bomId === patch.childBomId);
        if (cb) {
          cur.unitCost = cb.netUnitCost || cur.unitCost;
          cur.sourceType = 'MANUFACTURED';
        }
      }

      // Recalculate gross quantity & line cost
      const netQty = Number(cur.quantity) || 0;
      const scrapPct = Number(cur.scrapFactorPercent) || 0;
      cur.grossQuantity = Math.round(netQty * (1 + scrapPct / 100) * 10000) / 10000;
      cur.lineCost = Math.round(cur.grossQuantity * Number(cur.unitCost || 0) * 100) / 100;

      next[index] = cur;
      return next;
    });
  };

  const handleRemoveComponentRow = (index: number) => {
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Add Byproduct Row
  const handleAddByproductRow = () => {
    setFormByproducts((prev) => [
      ...prev,
      {
        itemId: componentCatalog[0]?.itemId || 0,
        itemCode: componentCatalog[0]?.itemCode || '',
        itemName: componentCatalog[0]?.itemName || '',
        itemDescription: '',
        uomId: componentCatalog[0]?.baseUomId || uomsCatalog[0]?.uomId || 1001,
        uomCode: componentCatalog[0]?.uomCode || 'NOS',
        quantity: 1,
        productType: 'RECOVERABLE_SCRAP',
        costAllocationPercent: 0,
        estimatedRecoveryRate: 0,
        estimatedRecoveryValue: 0,
        remarks: '',
      },
    ]);
  };

  const handleUpdateByproductRow = (index: number, patch: Partial<(typeof formByproducts)[0]>) => {
    setFormByproducts((prev) => {
      const next = [...prev];
      const cur = { ...next[index], ...patch };

      if (patch.itemId !== undefined && patch.itemId !== next[index].itemId) {
        const it = componentCatalog.find((c) => c.itemId === patch.itemId);
        if (it) {
          cur.itemId = it.itemId;
          cur.itemCode = it.itemCode;
          cur.itemName = it.itemName;
          cur.uomId = it.baseUomId;
          cur.uomCode = it.uomCode;
        }
      }

      const qty = Number(cur.quantity) || 0;
      const rate = Number(cur.estimatedRecoveryRate) || 0;
      cur.estimatedRecoveryValue = Math.round(qty * rate * 100) / 100;

      next[index] = cur;
      return next;
    });
  };

  const handleRemoveByproductRow = (index: number) => {
    setFormByproducts((prev) => prev.filter((_, i) => i !== index));
  };

  // --------------------------------------------------------------------------
  // MasterDataTable Columns Configuration
  // --------------------------------------------------------------------------
  const columns: MasterTableColumn<BomHeaderRecord>[] = [
    {
      key: 'bomCode',
      header: 'BOM Code',
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 font-semibold text-primary">
            <Layers className="h-4 w-4 text-blue-500 shrink-0" />
            <span>{row.bomCode}</span>
          </div>
          <span className="text-xs text-muted-foreground truncate max-w-[200px]">
            {row.bomName}
          </span>
        </div>
      ),
      sortValue: (row) => row.bomCode,
    },
    {
      key: 'assemblyItem',
      header: 'Finished / Sub-Assembly Product',
      sortable: true,
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{row.itemName}</span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-mono">{row.itemCode}</span>
            <span className="text-[10px] uppercase px-1.5 py-0.2 rounded bg-muted">
              {row.itemType.replace('_', ' ')}
            </span>
          </div>
        </div>
      ),
      sortValue: (row) => row.itemName,
    },
    {
      key: 'versionNo',
      header: 'Revision',
      sortable: true,
      align: 'center',
      render: (row) => (
        <div className="inline-flex flex-col items-center">
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-md bg-secondary border border-border">
            v{row.versionNo}
          </span>
          {row.isDefault && (
            <span className="mt-1 text-[10px] font-bold tracking-wider text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-300 dark:border-emerald-800">
              DEFAULT
            </span>
          )}
        </div>
      ),
      sortValue: (row) => row.versionNo,
    },
    {
      key: 'bomType',
      header: 'BOM Type',
      sortable: true,
      align: 'center',
      render: (row) => {
        const meta = BOM_TYPE_BADGE_MAP[row.bomType] || BOM_TYPE_BADGE_MAP.PRODUCTION;
        return (
          <span
            className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${meta.bg}`}
          >
            {meta.label}
          </span>
        );
      },
      sortValue: (row) => row.bomType,
    },
    {
      key: 'outputQty',
      header: 'Base Batch',
      align: 'right',
      render: (row) => (
        <div className="text-right">
          <span className="font-medium text-foreground">
            {Number(row.outputQty).toLocaleString()}
          </span>{' '}
          <span className="text-xs text-muted-foreground">{row.uomCode}</span>
        </div>
      ),
    },
    {
      key: 'netUnitCost',
      header: 'Net Unit Cost',
      align: 'right',
      sortable: true,
      render: (row) => (
        <div className="text-right">
          <div className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
            ₹{Number(row.netUnitCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <span className="text-[10px] text-muted-foreground">
            Mat: ₹{Number(row.totalMaterialCost).toFixed(2)}
          </span>
        </div>
      ),
      sortValue: (row) => row.netUnitCost,
    },
    {
      key: 'structure',
      header: 'Structure',
      align: 'center',
      render: (row) => (
        <div className="inline-flex flex-col items-center gap-1">
          {row.isMultiLevel ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-500/10 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded-full">
              <GitFork className="h-3 w-3" />
              Multi-Level
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
              Single-Level
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {row.componentCount || 0} parts · {row.byproductCount || 0} scrap
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      align: 'center',
      render: (row) => {
        const meta = STATUS_BADGE_MAP[row.status] || STATUS_BADGE_MAP.DRAFT;
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${meta.bg} ${meta.text} ${meta.border}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
        );
      },
      sortValue: (row) => row.status,
    },
  ];

  // Group By Options
  const groupByOptions: GroupByOption<BomHeaderRecord>[] = [
    {
      key: 'status',
      label: 'Status (Draft / Active / Obsolete)',
      groupValue: (row) => row.status,
    },
    {
      key: 'bomType',
      label: 'BOM Type (Production / Template)',
      groupValue: (row) => row.bomType,
    },
    {
      key: 'isMultiLevel',
      label: 'Hierarchy Structure (Multi-Level vs Single-Level)',
      groupValue: (row) => (row.isMultiLevel ? 'Multi-Level Assemblies' : 'Single-Level BOMs'),
    },
  ];

  // Search Predicate for MasterDataTable
  const searchPredicate = (row: BomHeaderRecord, query: string): boolean => {
    const q = query.toLowerCase();
    return (
      row.bomCode.toLowerCase().includes(q) ||
      row.bomName.toLowerCase().includes(q) ||
      row.itemCode.toLowerCase().includes(q) ||
      row.itemName.toLowerCase().includes(q) ||
      (row.remarks || '').toLowerCase().includes(q)
    );
  };

  // CSV Export
  const handleExportCsv = () => {
    const headers = [
      'BOM Code',
      'BOM Name',
      'Item Code',
      'Item Name',
      'Version',
      'Type',
      'Status',
      'Default',
      'Output Qty',
      'UOM',
      'Material Cost',
      'Labour Cost',
      'Overhead Cost',
      'Scrap Recovery',
      'Net Unit Cost',
    ];
    const rows = bomList.map((b) => [
      `"${b.bomCode}"`,
      `"${b.bomName.replace(/"/g, '""')}"`,
      `"${b.itemCode}"`,
      `"${b.itemName.replace(/"/g, '""')}"`,
      `"v${b.versionNo}"`,
      `"${b.bomType}"`,
      `"${b.status}"`,
      b.isDefault ? 'YES' : 'NO',
      b.outputQty,
      `"${b.uomCode}"`,
      b.totalMaterialCost,
      b.totalLabourCost,
      b.totalOverheadCost,
      b.totalByproductRecovery,
      b.netUnitCost,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BOM_Register_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --------------------------------------------------------------------------
  // Tree Node Renderer Component
  // --------------------------------------------------------------------------
  const TreeItemNode: React.FC<{ node: BomTreeNode; isRoot?: boolean }> = ({
    node,
    isRoot = false,
  }) => {
    const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div className="flex flex-col w-full text-xs">
        <div
          className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
            isRoot
              ? 'bg-blue-500/10 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-100 font-bold'
              : node.children && node.children.length > 0
              ? 'bg-indigo-500/5 border-indigo-200 dark:border-indigo-800 font-semibold text-foreground'
              : 'bg-card border-border hover:bg-muted/50 text-foreground'
          }`}
        >
          {/* Level & Collapse Icon */}
          <div className="flex items-center gap-1 shrink-0 w-16">
            <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              L{node.level}
            </span>
            {hasChildren ? (
              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-0.5 hover:bg-muted rounded text-muted-foreground"
              >
                {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground/60 ml-1" />
            )}
          </div>

          {/* Item details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold">{node.itemCode}</span>
              <span className="truncate">{node.itemName}</span>
              {node.isCritical && (
                <span className="text-[9px] uppercase px-1.5 py-0.2 bg-rose-500/15 text-rose-600 font-bold rounded">
                  Critical
                </span>
              )}
            </div>
            {node.operationSeq && (
              <span className="text-[10px] text-muted-foreground">
                Op {node.operationSeq}: {node.operationName || 'Assembly'}
              </span>
            )}
          </div>

          {/* Sourcing Badge */}
          <div className="w-24 shrink-0 text-center">
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                node.sourceType === 'ASSEMBLY' || node.sourceType === 'MANUFACTURED'
                  ? 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400'
                  : node.sourceType === 'SUBCONTRACTED'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                  : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
              }`}
            >
              {node.sourceType}
            </span>
          </div>

          {/* Qty & Scrap */}
          <div className="w-32 shrink-0 text-right">
            <div>
              <span className="font-mono font-bold text-foreground">
                {node.cumulativeQuantity.toLocaleString()}
              </span>{' '}
              <span className="text-muted-foreground">{node.uomCode}</span>
            </div>
            {Number(node.scrapFactorPercent) > 0 && (
              <span className="text-[10px] text-amber-600">
                +{node.scrapFactorPercent}% Scrap
              </span>
            )}
          </div>

          {/* Unit & Extended Cost */}
          <div className="w-28 shrink-0 text-right font-mono">
            <div className="font-bold text-emerald-600 dark:text-emerald-400">
              ₹{Number(node.lineCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-muted-foreground">
              @ ₹{Number(node.unitCost).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Children sub-assemblies */}
        {hasChildren && !isCollapsed && (
          <div className="pl-6 border-l border-dashed border-primary/20 ml-4 my-1 space-y-1">
            {node.children.map((child, idx) => (
              <TreeItemNode key={`${child.itemId}-${idx}`} node={child} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* -------------------------------------------------------------------- */}
      {/* 1. Header Section */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Layers className="h-6 w-6 text-primary" />
            Bill of Materials (BOM) & Engineering Recipes
          </h1>
          <p className="text-sm text-muted-foreground">
            Multi-level hierarchical BOMs, revisions, process scrap factors, co-products/recoverable scrap & net cost rollups.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGate screen="MFG_BOM" action="ADD">
            <button
              type="button"
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm shadow hover:bg-primary/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Bill of Materials
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2. KPI Summary Cards */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total BOMs</span>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {isSummaryLoading ? '...' : summary?.totalBoms || 0}
            </span>
            <span className="text-xs text-muted-foreground">All Revisions</span>
          </div>
        </div>

        {/* KPI 2 */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Active Production BOMs</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {isSummaryLoading ? '...' : summary?.activeBoms || 0}
            </span>
            <span className="text-xs text-emerald-600/80">Released for Shopfloor</span>
          </div>
        </div>

        {/* KPI 3 */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Multi-Level Assemblies</span>
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
              <GitFork className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {isSummaryLoading ? '...' : summary?.multiLevelBoms || 0}
            </span>
            <span className="text-xs text-muted-foreground">Recursive Trees</span>
          </div>
        </div>

        {/* KPI 4 */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Avg Net Unit Cost</span>
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-foreground">
              ₹
              {isSummaryLoading
                ? '...'
                : (summary?.avgUnitCost || 0).toLocaleString('en-IN', {
                    maximumFractionDigits: 0,
                  })}
            </span>
            <span className="text-xs text-muted-foreground">
              Across {summary?.distinctAssemblies || 0} Products
            </span>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 3. Filter Toolbar Slot */}
      {/* -------------------------------------------------------------------- */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs rounded-md border border-input bg-background px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Production Released (Active)</option>
                <option value="DRAFT">Draft Engineering</option>
                <option value="OBSOLETE">Obsolete / Archived</option>
              </select>
            </div>

            {/* BOM Type Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">BOM Type:</span>
              <select
                value={bomTypeFilter}
                onChange={(e) => setBomTypeFilter(e.target.value)}
                className="text-xs rounded-md border border-input bg-background px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All BOM Types</option>
                <option value="PRODUCTION">Production Standard</option>
                <option value="TEMPLATE">Standard Template</option>
                <option value="ENGINEERING">R&D / Engineering</option>
                <option value="PROTOTYPE">Pilot Prototype</option>
              </select>
            </div>

            {/* Default Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Default:</span>
              <select
                value={defaultFilter}
                onChange={(e) => setDefaultFilter(e.target.value)}
                className="text-xs rounded-md border border-input bg-background px-2.5 py-1.5 focus:outline-hidden focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Versions</option>
                <option value="TRUE">Default Production Version Only</option>
                <option value="FALSE">Alternate / Non-Default Versions</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setStatusFilter('ALL');
                setBomTypeFilter('ALL');
                setDefaultFilter('ALL');
                setGlobalSearch('');
              }}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded hover:bg-muted transition-colors flex items-center gap-1"
            >
              <RefreshCw className="h-3 w-3" />
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 4. Master Data Table */}
      {/* -------------------------------------------------------------------- */}
      <MasterDataTable<BomHeaderRecord>
        title="Bill of Materials Register"
        subtitle="Manage product structures, components, scrap factors, and cost rollups"
        screenCode="MFG_BOM"
        tableNameBadge="tbl_mfg_bom_header"
        data={bomList}
        rowKey={(row) => row.bomId}
        columns={columns}
        searchPlaceholder="Search by BOM code, name, assembly code or description..."
        searchPredicate={searchPredicate}
        groupByOptions={groupByOptions}
        addButtonLabel="New Bill of Materials"
        onAddClick={handleOpenCreateModal}
        onExportClick={handleExportCsv}
        pageSize={15}
        isLoading={isListLoading}
        renderRowActions={(row) => (
          <div className="flex items-center justify-end gap-1">
            {/* View Details */}
            <button
              type="button"
              title="View BOM Details"
              onClick={() => {
                setSelectedBomId(row.bomId);
                setIsDetailOpen(true);
              }}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            >
              <Eye className="h-4 w-4" />
            </button>

            {/* Tree Explosion */}
            <PermissionGate screen="MFG_BOM" action="EXPLODE">
              <button
                type="button"
                title="Multi-Level Tree Explosion"
                onClick={() => {
                  setTreeTargetBomId(row.bomId);
                  setIsTreeModalOpen(true);
                }}
                className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 rounded-md transition-colors"
              >
                <GitFork className="h-4 w-4" />
              </button>
            </PermissionGate>

            {/* Clone BOM */}
            <PermissionGate screen="MFG_BOM" action="CLONE">
              <button
                type="button"
                title="Clone / Create New Version"
                onClick={() => {
                  setCloneTargetBom(row);
                  const verNum = parseFloat(row.versionNo);
                  const nextVer = isNaN(verNum) ? '2.0' : (verNum + 1.0).toFixed(1);
                  setCloneNewVersion(nextVer);
                  setCloneNewName(`${row.bomName} (Rev ${nextVer})`);
                  setCloneNewCode('');
                  setCloneSetDefault(false);
                  setIsCloneModalOpen(true);
                }}
                className="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 rounded-md transition-colors"
              >
                <Copy className="h-4 w-4" />
              </button>
            </PermissionGate>

            {/* Approve BOM (only if DRAFT) */}
            {row.status === 'DRAFT' && (
              <PermissionGate screen="MFG_BOM" action="APPROVE">
                <button
                  type="button"
                  title="Approve & Release to Production"
                  onClick={() => {
                    setApproveTargetBom(row);
                    setApproveRemarks('BOM Engineering Approved & Released to Production');
                    setIsApproveModalOpen(true);
                  }}
                  className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              </PermissionGate>
            )}

            {/* Edit BOM */}
            <PermissionGate screen="MFG_BOM" action="EDIT">
              <button
                type="button"
                title="Edit BOM"
                onClick={() => handleOpenEditModal(row)}
                className="p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 rounded-md transition-colors"
              >
                <Edit3 className="h-4 w-4" />
              </button>
            </PermissionGate>

            {/* Print Datasheet */}
            <PermissionGate screen="MFG_BOM" action="PRINT">
              <button
                type="button"
                title="Print Costed Datasheet"
                onClick={() => {
                  setPrintTargetBomId(row.bomId);
                  setIsPrintModalOpen(true);
                }}
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              >
                <Printer className="h-4 w-4" />
              </button>
            </PermissionGate>

            {/* Delete BOM */}
            <PermissionGate screen="MFG_BOM" action="DELETE">
              <button
                type="button"
                title="Delete BOM"
                onClick={() => {
                  setDeleteTarget(row);
                  setDeleteErrorMessage(null);
                  setDeleteConflicts([]);
                }}
                className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </PermissionGate>
          </div>
        )}
      />

      {/* -------------------------------------------------------------------- */}
      {/* 5. BOM Creation / Edit Multi-Tab Modal */}
      {/* -------------------------------------------------------------------- */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-5xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Layers className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    {editingBomId ? `Edit BOM: ${formBomCode}` : 'Create Bill of Materials'}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Multi-level product engineering, scrap factors & co-product cost accounting
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs Navigation */}
            <div className="flex items-center border-b border-border bg-muted/20 px-6">
              <button
                type="button"
                onClick={() => setEditorActiveTab('HEADER')}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
                  editorActiveTab === 'HEADER'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Tag className="h-4 w-4" />
                1. General & Header Info
              </button>

              <button
                type="button"
                onClick={() => setEditorActiveTab('COMPONENTS')}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
                  editorActiveTab === 'COMPONENTS'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Boxes className="h-4 w-4" />
                2. Components & Scrap % ({formItems.length})
              </button>

              <button
                type="button"
                onClick={() => setEditorActiveTab('BYPRODUCTS')}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
                  editorActiveTab === 'BYPRODUCTS'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sparkles className="h-4 w-4" />
                3. Co-Products & Scrap ({formByproducts.length})
              </button>

              <button
                type="button"
                onClick={() => setEditorActiveTab('COSTING')}
                className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
                  editorActiveTab === 'COSTING'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <DollarSign className="h-4 w-4" />
                4. Live Cost Rollup Summary
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Tab 1: Header */}
              {editorActiveTab === 'HEADER' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Manufactured Item */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Manufactured Finished Good / Sub-Assembly <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formItemId}
                      onChange={(e) => handleItemSelectInHeader(Number(e.target.value))}
                      className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select Manufactured Item...</option>
                      {manufacturedItems.map((m) => (
                        <option key={m.itemId} value={m.itemId}>
                          [{m.itemCode}] {m.itemName} ({m.itemType.replace('_', ' ')})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Version No */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Version / Revision <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formVersionNo}
                      onChange={(e) => setFormVersionNo(e.target.value)}
                      placeholder="e.g. 1.0 or 2.1"
                      className="w-full text-xs font-mono rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* BOM Code (optional auto-generation) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      BOM Code (Leave blank for auto-generation)
                    </label>
                    <input
                      type="text"
                      value={formBomCode}
                      onChange={(e) => setFormBomCode(e.target.value)}
                      placeholder="e.g. BOM-FG-001-V1.0"
                      className="w-full text-xs font-mono rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* BOM Name */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      BOM Description / Engineering Title <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formBomName}
                      onChange={(e) => setFormBomName(e.target.value)}
                      placeholder="e.g. Standard BOM for Hydraulic Power Pack"
                      className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Output Qty */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Standard Batch Output Quantity <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      step="0.0001"
                      min="0.0001"
                      value={formOutputQty}
                      onChange={(e) => setFormOutputQty(parseFloat(e.target.value) || 1)}
                      className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Output UOM */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Output UOM <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={formUomId}
                      onChange={(e) => setFormUomId(Number(e.target.value))}
                      className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select UOM...</option>
                      {uomsCatalog.map((u) => (
                        <option key={u.uomId} value={u.uomId}>
                          {u.uomCode} - {u.uomName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* BOM Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">BOM Classification</label>
                    <select
                      value={formBomType}
                      onChange={(e) => setFormBomType(e.target.value as BomType)}
                      className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    >
                      <option value="PRODUCTION">Production Standard</option>
                      <option value="TEMPLATE">Standard Template</option>
                      <option value="ENGINEERING">R&D / Engineering</option>
                      <option value="PROTOTYPE">Pilot Prototype</option>
                    </select>
                  </div>

                  {/* Default BOM checkbox */}
                  <div className="flex items-center gap-2 pt-6">
                    <input
                      type="checkbox"
                      id="isDefaultCheck"
                      checked={formIsDefault}
                      onChange={(e) => setFormIsDefault(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <label htmlFor="isDefaultCheck" className="text-xs font-semibold text-foreground cursor-pointer">
                      Primary Default BOM for this Item
                    </label>
                  </div>

                  {/* Effective From */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Effective From Date</label>
                    <input
                      type="date"
                      value={formEffectiveFrom}
                      onChange={(e) => setFormEffectiveFrom(e.target.value)}
                      className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Effective To */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Effective To Date (Optional)</label>
                    <input
                      type="date"
                      value={formEffectiveTo}
                      onChange={(e) => setFormEffectiveTo(e.target.value)}
                      className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  {/* Remarks */}
                  <div className="md:col-span-3 space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Engineering Notes & Remarks</label>
                    <textarea
                      rows={2}
                      value={formRemarks}
                      onChange={(e) => setFormRemarks(e.target.value)}
                      placeholder="Add design specifications, drawing references or change history..."
                      className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Components & Scrap % */}
              {editorActiveTab === 'COMPONENTS' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Component Line Items & Bill of Materials</h3>
                      <p className="text-xs text-muted-foreground">
                        Specify raw materials, sub-assemblies, process scrap factors and child BOM links
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddComponentRow}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Component Item
                    </button>
                  </div>

                  {formItems.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                      <Boxes className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-medium text-foreground">No components added yet</p>
                      <p className="text-xs text-muted-foreground mt-1 mb-4">
                        Add raw materials, parts or sub-assemblies required to manufacture this product.
                      </p>
                      <button
                        type="button"
                        onClick={handleAddComponentRow}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add First Component
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-border rounded-xl">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 border-b border-border">
                          <tr>
                            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">#</th>
                            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground min-w-[200px]">
                              Component Item
                            </th>
                            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">UOM</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground w-24">
                              Net Qty
                            </th>
                            <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground w-20">
                              Scrap %
                            </th>
                            <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground w-24">
                              Gross Qty
                            </th>
                            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground min-w-[150px]">
                              Child Sub-Assembly BOM
                            </th>
                            <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground w-24">
                              Unit Cost (₹)
                            </th>
                            <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground w-28">
                              Total Cost (₹)
                            </th>
                            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">Source</th>
                            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {formItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-muted/20">
                              <td className="px-3 py-2 text-muted-foreground font-mono">{idx + 1}</td>

                              {/* Item Selector */}
                              <td className="px-3 py-2">
                                <select
                                  value={item.itemId}
                                  onChange={(e) =>
                                    handleUpdateComponentRow(idx, { itemId: Number(e.target.value) })
                                  }
                                  className="w-full text-xs rounded border border-input bg-background px-2 py-1 focus:ring-1 focus:ring-primary"
                                >
                                  {componentCatalog.map((c) => (
                                    <option key={c.itemId} value={c.itemId}>
                                      [{c.itemCode}] {c.itemName}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* UOM */}
                              <td className="px-3 py-2 text-center">
                                <span className="font-mono text-xs text-muted-foreground">
                                  {item.uomCode || 'NOS'}
                                </span>
                              </td>

                              {/* Net Qty */}
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  step="0.0001"
                                  min="0"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    handleUpdateComponentRow(idx, {
                                      quantity: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-20 text-xs text-right rounded border border-input bg-background px-2 py-1 font-mono focus:ring-1 focus:ring-primary"
                                />
                              </td>

                              {/* Scrap % */}
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="100"
                                  value={item.scrapFactorPercent}
                                  onChange={(e) =>
                                    handleUpdateComponentRow(idx, {
                                      scrapFactorPercent: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-16 text-xs text-right rounded border border-input bg-background px-2 py-1 font-mono text-amber-600 focus:ring-1 focus:ring-primary"
                                />
                              </td>

                              {/* Gross Qty (Auto calculated) */}
                              <td className="px-3 py-2 text-right font-mono font-semibold text-foreground">
                                {item.grossQuantity.toFixed(4)}
                              </td>

                              {/* Child BOM for Sub-Assemblies */}
                              <td className="px-3 py-2">
                                <select
                                  value={item.childBomId || ''}
                                  onChange={(e) =>
                                    handleUpdateComponentRow(idx, {
                                      childBomId: e.target.value ? Number(e.target.value) : null,
                                    })
                                  }
                                  className="w-full text-[11px] rounded border border-input bg-background px-2 py-1 text-indigo-700 dark:text-indigo-400 focus:ring-1 focus:ring-primary"
                                >
                                  <option value="">None (Leaf Component)</option>
                                  {childBoms.map((cb) => (
                                    <option key={cb.bomId} value={cb.bomId}>
                                      {cb.bomCode} ({cb.itemName})
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Unit Cost */}
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.unitCost}
                                  onChange={(e) =>
                                    handleUpdateComponentRow(idx, {
                                      unitCost: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-20 text-xs text-right rounded border border-input bg-background px-2 py-1 font-mono focus:ring-1 focus:ring-primary"
                                />
                              </td>

                              {/* Line Cost (Auto calculated) */}
                              <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                ₹{item.lineCost.toFixed(2)}
                              </td>

                              {/* Source Type */}
                              <td className="px-3 py-2 text-center">
                                <select
                                  value={item.sourceType}
                                  onChange={(e) =>
                                    handleUpdateComponentRow(idx, {
                                      sourceType: e.target.value as ComponentSourceType,
                                    })
                                  }
                                  className="text-[10px] rounded border border-input bg-background px-1.5 py-1 focus:ring-1 focus:ring-primary"
                                >
                                  <option value="PURCHASED">PURCHASED</option>
                                  <option value="MANUFACTURED">MANUFACTURED</option>
                                  <option value="SUBCONTRACTED">SUBCONTRACTED</option>
                                </select>
                              </td>

                              {/* Delete Action */}
                              <td className="px-3 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveComponentRow(idx)}
                                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 rounded transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted/40 font-semibold border-t border-border">
                          <tr>
                            <td colSpan={8} className="px-3 py-2.5 text-right text-muted-foreground">
                              Total Raw Material Component Cost:
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400 text-sm">
                              ₹{calculatedCostRollup.totalMaterialCost.toFixed(2)}
                            </td>
                            <td colSpan={2} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: By-Products & Co-Products */}
              {editorActiveTab === 'BYPRODUCTS' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Co-Products, By-Products & Recoverable Scrap</h3>
                      <p className="text-xs text-muted-foreground">
                        Define secondary outputs and scrap recovery credits that offset the net manufacturing cost
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddByproductRow}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add By-Product / Scrap
                    </button>
                  </div>

                  {formByproducts.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                      <Sparkles className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-50" />
                      <p className="text-sm font-medium text-foreground">No co-products or scrap items defined</p>
                      <p className="text-xs text-muted-foreground mt-1 mb-4">
                        If this process produces turning chips, runner/riser scrap or saleable co-products, add them here.
                      </p>
                      <button
                        type="button"
                        onClick={handleAddByproductRow}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add By-Product Row
                      </button>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-border rounded-xl">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/50 border-b border-border">
                          <tr>
                            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">#</th>
                            <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground min-w-[200px]">
                              Secondary Output Item
                            </th>
                            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">Type</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground w-24">Qty</th>
                            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">UOM</th>
                            <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground w-28">
                              Recovery Rate (₹)
                            </th>
                            <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground w-28">
                              Total Credit (₹)
                            </th>
                            <th className="px-3 py-2.5 text-center font-semibold text-muted-foreground">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {formByproducts.map((bp, idx) => (
                            <tr key={idx} className="hover:bg-muted/20">
                              <td className="px-3 py-2 text-muted-foreground font-mono">{idx + 1}</td>

                              {/* Item Selector */}
                              <td className="px-3 py-2">
                                <select
                                  value={bp.itemId}
                                  onChange={(e) =>
                                    handleUpdateByproductRow(idx, { itemId: Number(e.target.value) })
                                  }
                                  className="w-full text-xs rounded border border-input bg-background px-2 py-1 focus:ring-1 focus:ring-primary"
                                >
                                  {componentCatalog.map((c) => (
                                    <option key={c.itemId} value={c.itemId}>
                                      [{c.itemCode}] {c.itemName}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Product Type */}
                              <td className="px-3 py-2 text-center">
                                <select
                                  value={bp.productType}
                                  onChange={(e) =>
                                    handleUpdateByproductRow(idx, {
                                      productType: e.target.value as ByproductType,
                                    })
                                  }
                                  className="text-[10px] rounded border border-input bg-background px-1.5 py-1 focus:ring-1 focus:ring-primary"
                                >
                                  <option value="RECOVERABLE_SCRAP">RECOVERABLE SCRAP</option>
                                  <option value="BY_PRODUCT">BY-PRODUCT</option>
                                  <option value="CO_PRODUCT">CO-PRODUCT</option>
                                </select>
                              </td>

                              {/* Qty */}
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  step="0.0001"
                                  min="0"
                                  value={bp.quantity}
                                  onChange={(e) =>
                                    handleUpdateByproductRow(idx, {
                                      quantity: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-20 text-xs text-right rounded border border-input bg-background px-2 py-1 font-mono focus:ring-1 focus:ring-primary"
                                />
                              </td>

                              {/* UOM */}
                              <td className="px-3 py-2 text-center text-muted-foreground font-mono">
                                {bp.uomCode || 'KG'}
                              </td>

                              {/* Recovery Rate */}
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={bp.estimatedRecoveryRate}
                                  onChange={(e) =>
                                    handleUpdateByproductRow(idx, {
                                      estimatedRecoveryRate: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-24 text-xs text-right rounded border border-input bg-background px-2 py-1 font-mono focus:ring-1 focus:ring-primary"
                                />
                              </td>

                              {/* Total Credit */}
                              <td className="px-3 py-2 text-right font-mono font-bold text-amber-600">
                                -₹{bp.estimatedRecoveryValue.toFixed(2)}
                              </td>

                              {/* Action */}
                              <td className="px-3 py-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveByproductRow(idx)}
                                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 rounded transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-muted/40 font-semibold border-t border-border">
                          <tr>
                            <td colSpan={6} className="px-3 py-2.5 text-right text-muted-foreground">
                              Total By-Product & Scrap Recovery Credit:
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-amber-600 text-sm">
                              -₹{calculatedCostRollup.totalByproductRecovery.toFixed(2)}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Live Cost Rollup Summary */}
              {editorActiveTab === 'COSTING' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Cost Inputs */}
                    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <Wrench className="h-4 w-4 text-primary" />
                        Manufacturing Overhead & Direct Labor
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        Enter estimated direct labor and absorption overhead to calculate full absorption manufacturing unit cost.
                      </p>

                      <div className="space-y-3 pt-2">
                        <div>
                          <label className="text-xs font-medium text-foreground">
                            Direct Labor Cost per Batch (₹)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formLabourCost}
                            onChange={(e) => setFormLabourCost(parseFloat(e.target.value) || 0)}
                            className="mt-1 w-full text-xs font-mono rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-foreground">
                            Factory Overhead & Machine Depreciation (₹)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={formOverheadCost}
                            onChange={(e) => setFormOverheadCost(parseFloat(e.target.value) || 0)}
                            className="mt-1 w-full text-xs font-mono rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
                          <div className="text-muted-foreground">
                            Base Batch Size: <span className="font-bold text-foreground">{formOutputQty} Units</span>
                          </div>
                          <div className="text-muted-foreground">
                            Formula:{' '}
                            <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">
                              Net Cost = (Mat + Lab + Ovh - Scrap) / Output Qty
                            </code>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Cost Summary Breakdown Table */}
                    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                        Cost Breakdown & Unit Net Cost
                      </h4>

                      <div className="space-y-2.5 text-xs">
                        <div className="flex justify-between py-1.5 border-b border-border">
                          <span className="text-muted-foreground">Total Material Cost (Gross with Scrap):</span>
                          <span className="font-mono font-medium text-foreground">
                            ₹{calculatedCostRollup.totalMaterialCost.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex justify-between py-1.5 border-b border-border">
                          <span className="text-muted-foreground">(+) Direct Labour:</span>
                          <span className="font-mono font-medium text-foreground">
                            ₹{calculatedCostRollup.totalLabourCost.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex justify-between py-1.5 border-b border-border">
                          <span className="text-muted-foreground">(+) Factory Overhead:</span>
                          <span className="font-mono font-medium text-foreground">
                            ₹{calculatedCostRollup.totalOverheadCost.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex justify-between py-1.5 border-b border-border font-semibold text-foreground">
                          <span>Gross Manufacturing Cost:</span>
                          <span className="font-mono">
                            ₹{calculatedCostRollup.grossManufacturingCost.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex justify-between py-1.5 border-b border-border text-amber-600 font-medium">
                          <span>(-) Less By-Product / Scrap Recovery:</span>
                          <span className="font-mono">
                            -₹{calculatedCostRollup.totalByproductRecovery.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex justify-between py-2 border-b-2 border-border font-bold text-sm text-foreground">
                          <span>Net Batch Cost:</span>
                          <span className="font-mono text-primary">
                            ₹{calculatedCostRollup.netTotalManufacturingCost.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex justify-between items-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-300 dark:border-emerald-800">
                          <div>
                            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block">
                              Net Rolled-Up Unit Cost
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              Per {formOutputQty} Unit(s)
                            </span>
                          </div>
                          <span className="text-xl font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ₹{calculatedCostRollup.netUnitCost.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-border px-6 py-4 bg-muted/30">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="font-medium">Live Rolled-Up Unit Cost:</span>
                <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  ₹{calculatedCostRollup.netUnitCost.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 rounded-lg border border-input text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saveMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  {editingBomId ? 'Save BOM Changes' : 'Create Bill of Materials'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 6. Multi-Level Indented Tree Explosion Modal */}
      {/* -------------------------------------------------------------------- */}
      {isTreeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center">
                  <GitFork className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    Multi-Level Indented BOM Tree Explosion
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Recursive hierarchy explosion with gross shrinkages & rolled-up extended costs
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsTreeModalOpen(false);
                  setTreeTargetBomId(null);
                }}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tree Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {isTreeLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <RefreshCw className="h-8 w-8 text-primary animate-spin" />
                  <span className="text-xs text-muted-foreground">Exploding recursive BOM hierarchy...</span>
                </div>
              ) : treeError ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-400 text-xs">
                  <div className="flex items-center gap-2 font-bold text-sm mb-1">
                    <AlertCircle className="h-4 w-4" />
                    BOM Hierarchy Error
                  </div>
                  {(treeError as any)?.response?.data?.message || (treeError as any).message}
                </div>
              ) : treeData ? (
                <div className="space-y-4">
                  {/* Summary Bar */}
                  <div className="grid grid-cols-3 gap-3 p-3 bg-muted/40 rounded-xl border border-border text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                        Top Assembly
                      </span>
                      <span className="font-bold text-foreground">
                        [{treeData.itemCode}] {treeData.itemName}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                        Base Batch Output
                      </span>
                      <span className="font-bold text-foreground">
                        {treeData.quantityPerUnit} {treeData.uomCode}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-muted-foreground block text-[10px] uppercase font-bold">
                        Rolled-Up Unit Cost
                      </span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                        ₹{Number(treeData.unitCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Hierarchical Node Tree */}
                  <div className="border border-border rounded-xl p-4 bg-muted/10 space-y-2">
                    <TreeItemNode node={treeData} isRoot={true} />
                  </div>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-border px-6 py-3 bg-muted/30">
              <span className="text-xs text-muted-foreground">
                Click chevrons to expand/collapse sub-assemblies. All scrap factors compounded.
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsTreeModalOpen(false);
                  setTreeTargetBomId(null);
                }}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 7. BOM Details Drawer / Modal */}
      {/* -------------------------------------------------------------------- */}
      {isDetailOpen && selectedBomDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Eye className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-foreground">{selectedBomDetail.bomCode}</h2>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-muted border border-border">
                      v{selectedBomDetail.versionNo}
                    </span>
                    {selectedBomDetail.isDefault && (
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
                        DEFAULT
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedBomDetail.bomName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Assembly info card */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/30 border border-border text-xs">
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Assembly Item</span>
                  <span className="font-bold text-foreground">
                    [{selectedBomDetail.itemCode}] {selectedBomDetail.itemName}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Standard Batch</span>
                  <span className="font-bold text-foreground">
                    {selectedBomDetail.outputQty} {selectedBomDetail.uomCode}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Net Unit Cost</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                    ₹{Number(selectedBomDetail.netUnitCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px] uppercase font-bold">Status</span>
                  <span className="font-bold text-foreground">{selectedBomDetail.status}</span>
                </div>
              </div>

              {/* Line items table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Component Bill of Materials ({selectedBomDetail.items?.length || 0})
                </h4>
                <div className="border border-border rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                        <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Component</th>
                        <th className="px-3 py-2 text-center font-semibold text-muted-foreground">UOM</th>
                        <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Net Qty</th>
                        <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Scrap %</th>
                        <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Gross Qty</th>
                        <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Unit Cost (₹)</th>
                        <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Line Cost (₹)</th>
                        <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Source</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {(selectedBomDetail.items || []).map((it, idx) => (
                        <tr key={idx} className="hover:bg-muted/20">
                          <td className="px-3 py-2 font-mono text-muted-foreground">{idx + 1}</td>
                          <td className="px-3 py-2">
                            <span className="font-semibold text-foreground">{it.itemName}</span>{' '}
                            <span className="text-muted-foreground font-mono text-[11px]">({it.itemCode})</span>
                            {it.childBomCode && (
                              <div className="text-[10px] text-indigo-600 font-semibold flex items-center gap-1 mt-0.5">
                                <GitFork className="h-3 w-3" />
                                Sub-Assembly: {it.childBomCode}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center text-muted-foreground font-mono">{it.uomCode}</td>
                          <td className="px-3 py-2 text-right font-mono">{Number(it.quantity).toFixed(4)}</td>
                          <td className="px-3 py-2 text-right font-mono text-amber-600">
                            {Number(it.scrapFactorPercent) > 0 ? `+${it.scrapFactorPercent}%` : '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-semibold">
                            {Number(it.grossQuantity).toFixed(4)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono">₹{Number(it.unitCost).toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            ₹{Number(it.lineCost).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-muted">
                              {it.sourceType}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/40 font-semibold border-t border-border">
                      <tr>
                        <td colSpan={7} className="px-3 py-2 text-right text-muted-foreground">
                          Total Material Cost:
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                          ₹{Number(selectedBomDetail.totalMaterialCost).toFixed(2)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Byproducts table if any */}
              {selectedBomDetail.byproducts && selectedBomDetail.byproducts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Co-Products & Recoverable Scrap ({selectedBomDetail.byproducts.length})
                  </h4>
                  <div className="border border-border rounded-xl overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/50 border-b border-border">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                          <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Output Item</th>
                          <th className="px-3 py-2 text-center font-semibold text-muted-foreground">Type</th>
                          <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Qty</th>
                          <th className="px-3 py-2 text-center font-semibold text-muted-foreground">UOM</th>
                          <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Rate (₹)</th>
                          <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Recovery (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {selectedBomDetail.byproducts.map((bp, idx) => (
                          <tr key={idx} className="hover:bg-muted/20">
                            <td className="px-3 py-2 font-mono text-muted-foreground">{idx + 1}</td>
                            <td className="px-3 py-2 font-semibold text-foreground">
                              {bp.itemName} <span className="text-muted-foreground font-mono">({bp.itemCode})</span>
                            </td>
                            <td className="px-3 py-2 text-center text-[10px] font-semibold">{bp.productType}</td>
                            <td className="px-3 py-2 text-right font-mono">{Number(bp.quantity).toFixed(4)}</td>
                            <td className="px-3 py-2 text-center text-muted-foreground font-mono">{bp.uomCode}</td>
                            <td className="px-3 py-2 text-right font-mono">
                              ₹{Number(bp.estimatedRecoveryRate).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono font-bold text-amber-600">
                              -₹{Number(bp.estimatedRecoveryValue).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-muted/40 font-semibold border-t border-border">
                        <tr>
                          <td colSpan={6} className="px-3 py-2 text-right text-muted-foreground">
                            Total Scrap Recovery Credit:
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-amber-600">
                            -₹{Number(selectedBomDetail.totalByproductRecovery).toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end border-t border-border px-6 py-3 bg-muted/30">
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 8. Clone BOM Version Modal */}
      {/* -------------------------------------------------------------------- */}
      {isCloneModalOpen && cloneTargetBom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="border-b border-border px-6 py-4 bg-purple-500/10">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-purple-500/20 text-purple-600 flex items-center justify-center">
                  <Copy className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Clone BOM Revision</h3>
                  <p className="text-xs text-muted-foreground">
                    Copy all components and scrap factors to a new version
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-3 bg-muted/40 rounded-xl text-xs space-y-1">
                <div className="text-muted-foreground">
                  Source: <span className="font-bold text-foreground">{cloneTargetBom.bomCode}</span>
                </div>
                <div className="text-muted-foreground">
                  Current Version: <span className="font-mono font-bold text-foreground">v{cloneTargetBom.versionNo}</span>
                </div>
                <div className="text-muted-foreground">
                  Assembly Item: <span className="font-semibold text-foreground">{cloneTargetBom.itemName}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  New Version Number <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={cloneNewVersion}
                  onChange={(e) => setCloneNewVersion(e.target.value)}
                  placeholder="e.g. 2.0 or 1.1"
                  className="w-full text-xs font-mono rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">New BOM Engineering Title</label>
                <input
                  type="text"
                  value={cloneNewName}
                  onChange={(e) => setCloneNewName(e.target.value)}
                  className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  New BOM Code (Leave blank for auto-generation)
                </label>
                <input
                  type="text"
                  value={cloneNewCode}
                  onChange={(e) => setCloneNewCode(e.target.value)}
                  placeholder={`BOM-${cloneTargetBom.itemCode}-V${cloneNewVersion}`}
                  className="w-full text-xs font-mono rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="cloneDefaultCheck"
                  checked={cloneSetDefault}
                  onChange={(e) => setCloneSetDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                />
                <label htmlFor="cloneDefaultCheck" className="text-xs font-semibold text-foreground cursor-pointer">
                  Set this new revision as the default BOM for production
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4 bg-muted/30">
              <button
                type="button"
                onClick={() => {
                  setIsCloneModalOpen(false);
                  setCloneTargetBom(null);
                }}
                className="px-4 py-2 rounded-lg border border-input text-xs font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={cloneMutation.isPending}
                onClick={() => cloneMutation.mutate()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50"
              >
                {cloneMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Clone Version
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 9. Approve & Release BOM Modal */}
      {/* -------------------------------------------------------------------- */}
      {isApproveModalOpen && approveTargetBom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="border-b border-border px-6 py-4 bg-emerald-500/10">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Approve & Release BOM</h3>
                  <p className="text-xs text-muted-foreground">
                    Release Bill of Materials for Shopfloor Production & MRP
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-muted/40 rounded-xl space-y-1">
                <div className="text-muted-foreground">
                  BOM: <span className="font-bold text-foreground">{approveTargetBom.bomCode}</span>
                </div>
                <div className="text-muted-foreground">
                  Assembly Item: <span className="font-semibold text-foreground">{approveTargetBom.itemName}</span>
                </div>
                <div className="text-muted-foreground">
                  Revision:{' '}
                  <span className="font-mono font-bold text-foreground">v{approveTargetBom.versionNo}</span>
                </div>
                <div className="text-muted-foreground">
                  Net Rolled-Up Unit Cost:{' '}
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{Number(approveTargetBom.netUnitCost).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Engineering Approval Remarks</label>
                <textarea
                  rows={2}
                  value={approveRemarks}
                  onChange={(e) => setApproveRemarks(e.target.value)}
                  className="w-full text-xs rounded-lg border border-input bg-background px-3 py-2 text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-400">
                <p className="font-semibold">Important:</p>
                <p className="mt-0.5">
                  Approving this BOM transitions its status from DRAFT to ACTIVE and marks it ready for
                  Manufacturing Work Orders, Material Requisitions, and MRP explosion.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4 bg-muted/30">
              <button
                type="button"
                onClick={() => {
                  setIsApproveModalOpen(false);
                  setApproveTargetBom(null);
                }}
                className="px-4 py-2 rounded-lg border border-input text-xs font-medium hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                {approveMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                Approve & Release
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 10. Printable Costed BOM Datasheet Modal */}
      {/* -------------------------------------------------------------------- */}
      {isPrintModalOpen && selectedBomDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-4xl rounded-2xl border border-border bg-card shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
            {/* Modal Controls Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-3 bg-muted/40">
              <span className="text-xs font-bold text-foreground">Print Costed Bill of Materials Datasheet</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print Document
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPrintModalOpen(false);
                    setPrintTargetBomId(null);
                  }}
                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="flex-1 overflow-y-auto p-8 bg-white text-slate-900 font-sans print:p-0">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900">
                    KS-MFG ENTERPRISE ERP
                  </h1>
                  <p className="text-xs font-semibold text-slate-600">
                    Advanced Discrete & Process Manufacturing Engineering System
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Plant 1: Manufacturing Division · Thane Industrial Estate, MH, India
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-black tracking-widest uppercase bg-slate-900 text-white px-2 py-1 rounded">
                    ENGINEERING BOM DATASHEET
                  </span>
                  <div className="font-mono text-xs font-bold mt-1 text-slate-900">
                    {selectedBomDetail.bomCode}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    Revision: v{selectedBomDetail.versionNo} · {selectedBomDetail.status}
                  </div>
                </div>
              </div>

              {/* Specifications Card */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Item Code</span>
                  <span className="font-mono font-bold text-slate-900">{selectedBomDetail.itemCode}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Finished / Sub-Assembly</span>
                  <span className="font-bold text-slate-900">{selectedBomDetail.itemName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Base Batch Size</span>
                  <span className="font-bold text-slate-900">
                    {selectedBomDetail.outputQty} {selectedBomDetail.uomCode}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Net Rolled-Up Unit Cost</span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    ₹{Number(selectedBomDetail.netUnitCost).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Component breakdown */}
              <div className="my-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 border-b border-slate-200 pb-1">
                  1. Component Materials & Hardware Breakdown
                </h3>
                <table className="w-full text-xs border border-slate-300 border-collapse">
                  <thead className="bg-slate-100 font-bold text-slate-800">
                    <tr>
                      <th className="border border-slate-300 px-2 py-1.5 text-center w-8">#</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">Item Code</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-left">Description</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-center w-12">UOM</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right w-16">Net Qty</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right w-16">Scrap %</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right w-16">Gross Qty</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right w-20">Rate (₹)</th>
                      <th className="border border-slate-300 px-2 py-1.5 text-right w-24">Extended Cost (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedBomDetail.items || []).map((it, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="border border-slate-300 px-2 py-1 text-center font-mono">{idx + 1}</td>
                        <td className="border border-slate-300 px-2 py-1 font-mono font-bold text-slate-900">
                          {it.itemCode}
                        </td>
                        <td className="border border-slate-300 px-2 py-1">
                          <span className="font-semibold text-slate-900">{it.itemName}</span>
                          {it.childBomCode && (
                            <div className="text-[10px] text-indigo-700">Sub-Assy: {it.childBomCode}</div>
                          )}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-center font-mono">{it.uomCode}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono">{Number(it.quantity).toFixed(4)}</td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono text-amber-800">
                          {Number(it.scrapFactorPercent) > 0 ? `+${it.scrapFactorPercent}%` : '-'}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold">
                          {Number(it.grossQuantity).toFixed(4)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono">
                          ₹{Number(it.unitCost).toFixed(2)}
                        </td>
                        <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold text-slate-900">
                          ₹{Number(it.lineCost).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-bold">
                      <td colSpan={8} className="border border-slate-300 px-2 py-1.5 text-right">
                        Total Material Cost:
                      </td>
                      <td className="border border-slate-300 px-2 py-1.5 text-right font-mono text-slate-900">
                        ₹{Number(selectedBomDetail.totalMaterialCost).toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* By-Products recovery */}
              {selectedBomDetail.byproducts && selectedBomDetail.byproducts.length > 0 && (
                <div className="my-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 border-b border-slate-200 pb-1">
                    2. Co-Products & Recoverable Scrap Credits
                  </h3>
                  <table className="w-full text-xs border border-slate-300 border-collapse">
                    <thead className="bg-slate-100 font-bold text-slate-800">
                      <tr>
                        <th className="border border-slate-300 px-2 py-1 text-center w-8">#</th>
                        <th className="border border-slate-300 px-2 py-1 text-left">Output Item</th>
                        <th className="border border-slate-300 px-2 py-1 text-center">Type</th>
                        <th className="border border-slate-300 px-2 py-1 text-right w-20">Quantity</th>
                        <th className="border border-slate-300 px-2 py-1 text-center w-12">UOM</th>
                        <th className="border border-slate-300 px-2 py-1 text-right w-24">Recovery Rate (₹)</th>
                        <th className="border border-slate-300 px-2 py-1 text-right w-28">Credit Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBomDetail.byproducts.map((bp, idx) => (
                        <tr key={idx}>
                          <td className="border border-slate-300 px-2 py-1 text-center font-mono">{idx + 1}</td>
                          <td className="border border-slate-300 px-2 py-1 font-semibold text-slate-900">
                            {bp.itemName} ({bp.itemCode})
                          </td>
                          <td className="border border-slate-300 px-2 py-1 text-center text-[10px] font-bold">
                            {bp.productType}
                          </td>
                          <td className="border border-slate-300 px-2 py-1 text-right font-mono">
                            {Number(bp.quantity).toFixed(4)}
                          </td>
                          <td className="border border-slate-300 px-2 py-1 text-center font-mono">{bp.uomCode}</td>
                          <td className="border border-slate-300 px-2 py-1 text-right font-mono">
                            ₹{Number(bp.estimatedRecoveryRate).toFixed(2)}
                          </td>
                          <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold text-amber-800">
                            -₹{Number(bp.estimatedRecoveryValue).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold">
                        <td colSpan={6} className="border border-slate-300 px-2 py-1.5 text-right">
                          Total Scrap Recovery Credit:
                        </td>
                        <td className="border border-slate-300 px-2 py-1.5 text-right font-mono text-amber-800">
                          -₹{Number(selectedBomDetail.totalByproductRecovery).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Cost Rollup Box & Signatures */}
              <div className="grid grid-cols-2 gap-6 my-6 text-xs">
                {/* Cost Rollup Box */}
                <div className="p-3 border border-slate-300 rounded bg-slate-50 space-y-1">
                  <span className="font-bold uppercase tracking-wider text-slate-700 block text-[10px] mb-1">
                    3. Manufacturing Absorption Cost Rollup
                  </span>
                  <div className="flex justify-between text-slate-700">
                    <span>Direct Material Cost:</span>
                    <span className="font-mono">₹{Number(selectedBomDetail.totalMaterialCost).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Direct Labor Absorption:</span>
                    <span className="font-mono">₹{Number(selectedBomDetail.totalLabourCost).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>Factory Overhead Absorption:</span>
                    <span className="font-mono">₹{Number(selectedBomDetail.totalOverheadCost).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-amber-800">
                    <span>Less By-Product / Scrap Recovery:</span>
                    <span className="font-mono">-₹{Number(selectedBomDetail.totalByproductRecovery).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-300 pt-1 font-bold text-slate-900">
                    <span>Net Batch Cost ({selectedBomDetail.outputQty} {selectedBomDetail.uomCode}):</span>
                    <span className="font-mono">
                      ₹
                      {(
                        Number(selectedBomDetail.totalMaterialCost) +
                        Number(selectedBomDetail.totalLabourCost) +
                        Number(selectedBomDetail.totalOverheadCost) -
                        Number(selectedBomDetail.totalByproductRecovery)
                      ).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between bg-emerald-100 p-1.5 rounded font-bold text-emerald-900 mt-2">
                    <span>Net Finished Unit Cost:</span>
                    <span className="font-mono text-sm">
                      ₹{Number(selectedBomDetail.netUnitCost).toFixed(2)} / {selectedBomDetail.uomCode}
                    </span>
                  </div>
                </div>

                {/* Engineering Sign-off Box */}
                <div className="p-3 border border-slate-300 rounded bg-slate-50 flex flex-col justify-between">
                  <span className="font-bold uppercase tracking-wider text-slate-700 block text-[10px]">
                    4. Engineering Approvals & Authorization
                  </span>

                  <div className="grid grid-cols-2 gap-4 pt-8 text-[11px] text-slate-600">
                    <div className="border-t border-slate-400 pt-1 text-center">
                      <span className="block font-semibold">Prepared By (Design Eng.)</span>
                      <span className="text-[10px] text-slate-500">
                        {selectedBomDetail.createdByName || 'System Engineer'}
                      </span>
                    </div>

                    <div className="border-t border-slate-400 pt-1 text-center">
                      <span className="block font-semibold">Approved By (Works Head)</span>
                      <span className="text-[10px] text-slate-500">
                        {selectedBomDetail.approvedByName || 'Authorized Signatory'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-300 pt-2 text-[10px] text-slate-500 flex justify-between">
                <span>Computer Generated Engineering Datasheet · KS-MFG ERP</span>
                <span>Page 1 of 1 · Print Date: {new Date().toLocaleDateString('en-IN')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 11. Delete Confirmation Modal */}
      {/* -------------------------------------------------------------------- */}
      <ConfirmDeleteModal
        isOpen={Boolean(deleteTarget)}
        entityType="Bill of Materials"
        entityName={deleteTarget?.bomName || ''}
        entityCode={deleteTarget?.bomCode}
        isDeleting={deleteMutation.isPending}
        errorMessage={deleteErrorMessage}
        dependencies={deleteConflicts}
        onConfirm={() => deleteMutation.mutate()}
        onClose={() => {
          setDeleteTarget(null);
          setDeleteErrorMessage(null);
          setDeleteConflicts([]);
        }}
      />
    </div>
  );
};
