import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpDown,
  Boxes,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Factory,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  Package,
  Pencil,
  Play,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  Warehouse,
  X,
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
// TYPES & ENUMS
// ============================================================================

export type MaterialIssueStatus = 'DRAFT' | 'POSTED' | 'CANCELLED';

export type MaterialIssueType =
  | 'STANDARD_ISSUE'
  | 'RETURN_TO_STORE'
  | 'SCRAP_ADJUSTMENT'
  | 'LINESIDE_TRANSFER';

export interface MaterialIssueSummary {
  totalIssues: number;
  postedIssues: number;
  draftIssues: number;
  totalMaterialValue: number;
  activeWipOrders: number;
  pendingPickingOrders: number;
}

export interface MaterialIssueRow {
  issue_id: number;
  issue_no: string;
  issue_date: string;
  wo_id: number;
  wo_no: string;
  wo_item_id: number;
  wo_item_code: string;
  wo_item_name: string;
  wo_planned_qty: number;
  wo_uom_code: string;
  issue_type: MaterialIssueType;
  from_warehouse_id: number;
  from_warehouse_name: string;
  from_warehouse_code: string;
  to_warehouse_id: number | null;
  to_warehouse_name: string | null;
  to_warehouse_code: string | null;
  status: MaterialIssueStatus;
  total_items: number;
  total_quantity: number;
  total_cost: number;
  issued_by: number | null;
  issued_by_name: string | null;
  received_by: number | null;
  received_by_name: string | null;
  remarks: string | null;
  created_date: string;
  line_item_count: number;
}

export interface MaterialIssueItemRow {
  issue_item_id?: number;
  issue_id?: number;
  wo_bom_item_id?: number | null;
  item_id: number;
  item_code: string;
  item_name: string;
  item_type: string;
  uom_id: number;
  uom_code: string;
  uom_name?: string;
  required_qty: number;
  previously_issued_qty: number;
  issue_qty: number;
  unit_cost: number;
  total_cost: number;
  batch_no?: string | null;
  heat_no?: string | null;
  bin_location?: string | null;
  remarks?: string | null;
  current_stock_qty?: number;
}

export interface MaterialIssueDetail extends MaterialIssueRow {
  items: MaterialIssueItemRow[];
  created_by?: number | null;
  created_by_name?: string | null;
  updated_date?: string | null;
  updated_by_name?: string | null;
  wo_status?: string;
  wo_batch_no?: string | null;
}

export interface WoBomItem {
  wo_bom_item_id: number;
  wo_id: number;
  item_id: number;
  item_code: string;
  item_name: string;
  item_type: string;
  uom_id: number;
  uom_code: string;
  uom_name: string;
  standard_qty_per_unit: number;
  scrap_factor_percent: number;
  required_qty: number;
  issued_qty: number;
  consumed_qty: number;
  pending_issue_qty: number;
  unit_cost: number;
  estimated_cost: number;
  source_type: string;
  operation_seq: number;
  is_critical: boolean;
  current_stock_qty: number;
}

export interface MaterialIssueLookups {
  activeWorkOrders: Array<{
    wo_id: number;
    wo_no: string;
    wo_date: string;
    item_id: number;
    item_code: string;
    item_name: string;
    planned_qty: number;
    completed_qty: number;
    uom_id: number;
    uom_code: string;
    target_warehouse_id: number;
    target_warehouse_name: string;
    wip_warehouse_id: number | null;
    wip_warehouse_name: string | null;
    priority: string;
    status: string;
    batch_no: string | null;
  }>;
  warehouses: Array<{
    warehouse_id: number;
    warehouse_code: string;
    warehouse_name: string;
    warehouse_type: string;
  }>;
  items: Array<{
    item_id: number;
    item_code: string;
    item_name: string;
    item_type: string;
    base_uom_id: number;
    uom_code: string;
    standard_cost: number;
    default_warehouse_id: number | null;
  }>;
  users: Array<{
    user_id: number;
    username: string;
    full_name: string;
    email: string;
  }>;
}

export interface CreateMaterialIssueFormState {
  woId: number | '';
  issueType: MaterialIssueType;
  issueDate: string;
  fromWarehouseId: number | '';
  toWarehouseId: number | '';
  issuedBy: number | '';
  receivedBy: number | '';
  remarks: string;
  items: MaterialIssueItemRow[];
}

export interface ReturnToStoreFormState {
  woId: number | '';
  fromWarehouseId: number | '';
  toWarehouseId: number | '';
  remarks: string;
  items: Array<{
    woBomItemId?: number;
    itemId: number;
    itemCode: string;
    itemName: string;
    uomId: number;
    uomCode: string;
    previouslyIssuedQty: number;
    returnQty: number;
    unitCost: number;
    batchNo: string;
    binLocation: string;
    remarks: string;
  }>;
}

const DEFAULT_FORM: CreateMaterialIssueFormState = {
  woId: '',
  issueType: 'STANDARD_ISSUE',
  issueDate: new Date().toISOString().split('T')[0],
  fromWarehouseId: '',
  toWarehouseId: '',
  issuedBy: '',
  receivedBy: '',
  remarks: '',
  items: [],
};

const DEFAULT_RETURN_FORM: ReturnToStoreFormState = {
  woId: '',
  fromWarehouseId: '',
  toWarehouseId: '',
  remarks: '',
  items: [],
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const MaterialIssueMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters & State
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterWarehouse, setFilterWarehouse] = useState<string>('ALL');
  const [filterWoId, setFilterWoId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [selectedSubmitIssue, setSelectedSubmitIssue] = useState<MaterialIssueRow | null>(null);
  const [submitRemarks, setSubmitRemarks] = useState('');

  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
  const [selectedViewId, setSelectedViewId] = useState<number | null>(null);

  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printIssueData, setPrintIssueData] = useState<MaterialIssueDetail | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [issueToDelete, setIssueToDelete] = useState<MaterialIssueRow | null>(null);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState<string | null>(null);

  // Form State
  const [formState, setFormState] = useState<CreateMaterialIssueFormState>(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isLoadingBomItems, setIsLoadingBomItems] = useState(false);

  // Return Form State
  const [returnForm, setReturnForm] = useState<ReturnToStoreFormState>(DEFAULT_RETURN_FORM);
  const [returnErrors, setReturnErrors] = useState<Record<string, string>>({});

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------

  const { data: summaryData, isLoading: isLoadingSummary } = useQuery<MaterialIssueSummary>({
    queryKey: ['material-issue-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<MaterialIssueSummary>>(
        '/manufacturing/material-issues/summary',
      );
      return (
        res.data?.data || {
          totalIssues: 0,
          postedIssues: 0,
          draftIssues: 0,
          totalMaterialValue: 0,
          activeWipOrders: 0,
          pendingPickingOrders: 0,
        }
      );
    },
    staleTime: 1000 * 30,
  });

  const { data: lookups } = useQuery<MaterialIssueLookups>({
    queryKey: ['material-issue-lookups'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<MaterialIssueLookups>>(
        '/manufacturing/material-issues/lookups',
      );
      return (
        res.data?.data || {
          activeWorkOrders: [],
          warehouses: [],
          items: [],
          users: [],
        }
      );
    },
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: issuesData,
    isLoading: isLoadingIssues,
    refetch: refetchIssues,
  } = useQuery<MaterialIssueRow[]>({
    queryKey: [
      'material-issues',
      filterStatus,
      filterType,
      filterWarehouse,
      filterWoId,
      searchQuery,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== 'ALL') params.append('status', filterStatus);
      if (filterType !== 'ALL') params.append('issueType', filterType);
      if (filterWarehouse !== 'ALL') params.append('fromWarehouseId', filterWarehouse);
      if (filterWoId !== 'ALL') params.append('woId', filterWoId);
      if (searchQuery.trim()) params.append('search', searchQuery.trim());
      params.append('limit', '200');

      const res = await apiClient.get<ApiResponse<{ data: MaterialIssueRow[] }>>(
        `/manufacturing/material-issues?${params.toString()}`,
      );
      return res.data?.data?.data || [];
    },
  });

  const { data: viewDetailData, isLoading: isLoadingDetail } = useQuery<MaterialIssueDetail | null>(
    {
      queryKey: ['material-issue-detail', selectedViewId],
      queryFn: async () => {
        if (!selectedViewId) return null;
        const res = await apiClient.get<ApiResponse<MaterialIssueDetail>>(
          `/manufacturing/material-issues/${selectedViewId}`,
        );
        return res.data?.data || null;
      },
      enabled: Boolean(selectedViewId),
    },
  );

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------

  const createIssueMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiClient.post('/manufacturing/material-issues', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-issues'] });
      queryClient.invalidateQueries({ queryKey: ['material-issue-summary'] });
      setIsCreateModalOpen(false);
      setFormState(DEFAULT_FORM);
      setFormErrors({});
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to create material issue';
      setFormErrors({ form: Array.isArray(msg) ? msg.join(', ') : msg });
    },
  });

  const submitIssueMutation = useMutation({
    mutationFn: async ({ id, remarks }: { id: number; remarks?: string }) => {
      return apiClient.post(`/manufacturing/material-issues/${id}/submit`, { remarks });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-issues'] });
      queryClient.invalidateQueries({ queryKey: ['material-issue-summary'] });
      queryClient.invalidateQueries({ queryKey: ['material-issue-lookups'] });
      if (selectedViewId) {
        queryClient.invalidateQueries({ queryKey: ['material-issue-detail', selectedViewId] });
      }
      setIsSubmitModalOpen(false);
      setSelectedSubmitIssue(null);
      setSubmitRemarks('');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to post material issue voucher.');
    },
  });

  const returnToStoreMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiClient.post('/manufacturing/material-issues/return-to-store', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-issues'] });
      queryClient.invalidateQueries({ queryKey: ['material-issue-summary'] });
      queryClient.invalidateQueries({ queryKey: ['material-issue-lookups'] });
      setIsReturnModalOpen(false);
      setReturnForm(DEFAULT_RETURN_FORM);
      setReturnErrors({});
    },
    onError: (err: any) => {
      const msg = err.response?.data?.message || err.message || 'Failed to return material to store';
      setReturnErrors({ form: Array.isArray(msg) ? msg.join(', ') : msg });
    },
  });

  const deleteIssueMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiClient.delete(`/manufacturing/material-issues/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material-issues'] });
      queryClient.invalidateQueries({ queryKey: ['material-issue-summary'] });
      setIsDeleteModalOpen(false);
      setIssueToDelete(null);
    },
    onError: (err: any) => {
      setDeleteErrorMessage(err.response?.data?.message || 'Failed to delete issue slip.');
    },
  });

  // --------------------------------------------------------------------------
  // Helpers & Handlers
  // --------------------------------------------------------------------------

  const handleSelectWorkOrder = (woIdVal: number) => {
    const selectedWo = lookups?.activeWorkOrders.find((w) => w.wo_id === woIdVal);
    if (!selectedWo) return;

    setFormState((prev) => ({
      ...prev,
      woId: woIdVal,
      // Target lineside WIP warehouse defaults to the WO WIP warehouse or target warehouse
      toWarehouseId: selectedWo.wip_warehouse_id || selectedWo.target_warehouse_id,
      fromWarehouseId:
        prev.fromWarehouseId ||
        lookups?.warehouses.find((wh) => wh.warehouse_type === 'RAW_MATERIAL')?.warehouse_id ||
        lookups?.warehouses[0]?.warehouse_id ||
        '',
    }));
  };

  const handleLoadWoBomItems = async () => {
    if (!formState.woId) {
      setFormErrors({ woId: 'Please select an active Work Order first' });
      return;
    }

    try {
      setIsLoadingBomItems(true);
      const res = await apiClient.get<ApiResponse<WoBomItem[]>>(
        `/manufacturing/material-issues/wo-bom-items/${formState.woId}`,
      );
      const bomItems = res.data?.data || [];

      if (bomItems.length === 0) {
        alert('No BOM component snapshot found for this Work Order.');
        return;
      }

      // Convert to MaterialIssueItemRow
      const mappedItems: MaterialIssueItemRow[] = bomItems.map((bi) => ({
        wo_bom_item_id: bi.wo_bom_item_id,
        item_id: bi.item_id,
        item_code: bi.item_code,
        item_name: bi.item_name,
        item_type: bi.item_type,
        uom_id: bi.uom_id,
        uom_code: bi.uom_code,
        uom_name: bi.uom_name,
        required_qty: bi.required_qty,
        previously_issued_qty: bi.issued_qty,
        issue_qty: bi.pending_issue_qty > 0 ? bi.pending_issue_qty : 0,
        unit_cost: bi.unit_cost,
        total_cost: (bi.pending_issue_qty > 0 ? bi.pending_issue_qty : 0) * bi.unit_cost,
        batch_no: '',
        heat_no: '',
        bin_location: '',
        current_stock_qty: bi.current_stock_qty,
      }));

      setFormState((prev) => ({
        ...prev,
        items: mappedItems,
      }));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to load Work Order BOM components');
    } finally {
      setIsLoadingBomItems(false);
    }
  };

  const handleItemQtyChange = (index: number, newQty: number) => {
    setFormState((prev) => {
      const nextItems = [...prev.items];
      const item = nextItems[index];
      const validQty = Math.max(0, newQty || 0);
      nextItems[index] = {
        ...item,
        issue_qty: validQty,
        total_cost: validQty * (item.unit_cost || 0),
      };
      return { ...prev, items: nextItems };
    });
  };

  const handleItemFieldChange = (index: number, field: keyof MaterialIssueItemRow, value: any) => {
    setFormState((prev) => {
      const nextItems = [...prev.items];
      nextItems[index] = { ...nextItems[index], [field]: value };
      return { ...prev, items: nextItems };
    });
  };

  const handleRemoveItem = (index: number) => {
    setFormState((prev) => ({
      ...prev,
      items: prev.items.filter((_, idx) => idx !== index),
    }));
  };

  const handleAddCustomItem = () => {
    if (!lookups?.items.length) return;
    const firstItem = lookups.items[0];
    const newItem: MaterialIssueItemRow = {
      item_id: firstItem.item_id,
      item_code: firstItem.item_code,
      item_name: firstItem.item_name,
      item_type: firstItem.item_type,
      uom_id: firstItem.base_uom_id,
      uom_code: firstItem.uom_code,
      required_qty: 0,
      previously_issued_qty: 0,
      issue_qty: 1,
      unit_cost: firstItem.standard_cost,
      total_cost: firstItem.standard_cost,
      batch_no: '',
      heat_no: '',
      bin_location: '',
    };
    setFormState((prev) => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formState.woId) errors.woId = 'Work Order is required';
    if (!formState.fromWarehouseId) errors.fromWarehouseId = 'Issuing warehouse is required';
    if (!formState.issueDate) errors.issueDate = 'Issue date is required';
    if (formState.items.length === 0) {
      errors.items = 'At least one component item must be issued';
    } else {
      const validCount = formState.items.filter((it) => it.issue_qty > 0).length;
      if (validCount === 0) {
        errors.items = 'At least one item must have an Issue Quantity greater than 0';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitForm = (submitImmediately = false) => {
    if (!validateForm()) return;

    const payload = {
      woId: Number(formState.woId),
      issueType: formState.issueType,
      issueDate: formState.issueDate,
      fromWarehouseId: Number(formState.fromWarehouseId),
      toWarehouseId: formState.toWarehouseId ? Number(formState.toWarehouseId) : undefined,
      issuedBy: formState.issuedBy ? Number(formState.issuedBy) : undefined,
      receivedBy: formState.receivedBy ? Number(formState.receivedBy) : undefined,
      remarks: formState.remarks || undefined,
      items: formState.items
        .filter((it) => it.issue_qty > 0)
        .map((it) => ({
          woBomItemId: it.wo_bom_item_id || undefined,
          itemId: it.item_id,
          uomId: it.uom_id,
          requiredQty: it.required_qty,
          previouslyIssuedQty: it.previously_issued_qty,
          issueQty: it.issue_qty,
          unitCost: it.unit_cost,
          batchNo: it.batch_no || undefined,
          heatNo: it.heat_no || undefined,
          binLocation: it.bin_location || undefined,
          remarks: it.remarks || undefined,
        })),
    };

    createIssueMutation.mutate(payload, {
      onSuccess: async (res: any) => {
        if (submitImmediately) {
          const newIssueId = res.data?.data?.issue_id;
          if (newIssueId) {
            submitIssueMutation.mutate({ id: newIssueId, remarks: 'Auto-posted upon creation' });
          }
        }
      },
    });
  };

  // Return to store handler
  const handleSelectReturnWo = async (woIdVal: number) => {
    const selectedWo = lookups?.activeWorkOrders.find((w) => w.wo_id === woIdVal);
    if (!selectedWo) return;

    try {
      const res = await apiClient.get<ApiResponse<WoBomItem[]>>(
        `/manufacturing/material-issues/wo-bom-items/${woIdVal}`,
      );
      const bomItems = res.data?.data || [];

      // Filter items that actually have issued_qty > 0
      const issuedItems = bomItems.filter((b) => b.issued_qty > 0);

      setReturnForm({
        woId: woIdVal,
        fromWarehouseId: selectedWo.wip_warehouse_id || selectedWo.target_warehouse_id,
        toWarehouseId:
          lookups?.warehouses.find((wh) => wh.warehouse_type === 'RAW_MATERIAL')?.warehouse_id ||
          lookups?.warehouses[0]?.warehouse_id ||
          '',
        remarks: `Shopfloor unconsumed return for WO #${selectedWo.wo_no}`,
        items: issuedItems.map((bi) => ({
          woBomItemId: bi.wo_bom_item_id,
          itemId: bi.item_id,
          itemCode: bi.item_code,
          itemName: bi.item_name,
          uomId: bi.uom_id,
          uomCode: bi.uom_code,
          previouslyIssuedQty: bi.issued_qty,
          returnQty: 0,
          unitCost: bi.unit_cost,
          batchNo: '',
          binLocation: '',
          remarks: '',
        })),
      });
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to fetch issued items for Return to Store');
    }
  };

  const handleReturnSubmit = () => {
    const errors: Record<string, string> = {};
    if (!returnForm.woId) errors.woId = 'Work Order is required';
    if (!returnForm.fromWarehouseId) errors.fromWarehouseId = 'Returning floor warehouse is required';
    if (!returnForm.toWarehouseId) errors.toWarehouseId = 'Destination store warehouse is required';

    const validItems = returnForm.items.filter((it) => it.returnQty > 0);
    if (validItems.length === 0) {
      errors.items = 'Please specify a return quantity greater than 0 for at least one item';
    }

    // Check return quantity does not exceed issued qty
    for (const it of validItems) {
      if (it.returnQty > it.previouslyIssuedQty) {
        errors.items = `Return qty for ${it.itemCode} cannot exceed issued qty (${it.previouslyIssuedQty})`;
        break;
      }
    }

    if (Object.keys(errors).length > 0) {
      setReturnErrors(errors);
      return;
    }

    const payload = {
      woId: Number(returnForm.woId),
      fromWarehouseId: Number(returnForm.fromWarehouseId),
      toWarehouseId: Number(returnForm.toWarehouseId),
      remarks: returnForm.remarks,
      items: validItems.map((it) => ({
        woBomItemId: it.woBomItemId,
        itemId: it.itemId,
        uomId: it.uomId,
        returnQty: it.returnQty,
        unitCost: it.unitCost,
        batchNo: it.batchNo || undefined,
        binLocation: it.binLocation || undefined,
        remarks: it.remarks || undefined,
      })),
    };

    returnToStoreMutation.mutate(payload);
  };

  const handleOpenPrintModal = async (issueId: number) => {
    try {
      const res = await apiClient.get<ApiResponse<MaterialIssueDetail>>(
        `/manufacturing/material-issues/${issueId}`,
      );
      if (res.data?.data) {
        setPrintIssueData(res.data.data);
        setIsPrintModalOpen(true);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to fetch issue details for printing');
    }
  };

  // Calculations
  const formTotals = useMemo(() => {
    const totalQty = formState.items.reduce((acc, curr) => acc + (Number(curr.issue_qty) || 0), 0);
    const totalVal = formState.items.reduce((acc, curr) => acc + (Number(curr.total_cost) || 0), 0);
    return {
      lineCount: formState.items.length,
      totalQty: Math.round(totalQty * 1000) / 1000,
      totalVal: Math.round(totalVal * 100) / 100,
    };
  }, [formState.items]);

  // --------------------------------------------------------------------------
  // Table Setup
  // --------------------------------------------------------------------------

  const columns: MasterTableColumn<MaterialIssueRow>[] = [
    {
      key: 'issue_no',
      header: 'Issue Slip #',
      sortable: true,
      sortValue: (r) => r.issue_no,
      render: (r) => (
        <div className="flex flex-col">
          <span className="font-semibold text-[var(--text-primary)] font-mono">{r.issue_no}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                r.issue_type === 'STANDARD_ISSUE'
                  ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                  : r.issue_type === 'RETURN_TO_STORE'
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                  : r.issue_type === 'LINESIDE_TRANSFER'
                  ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
              }`}
            >
              {r.issue_type.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'issue_date',
      header: 'Issue Date',
      sortable: true,
      sortValue: (r) => r.issue_date,
      render: (r) => (
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <span>{r.issue_date}</span>
        </div>
      ),
    },
    {
      key: 'wo_no',
      header: 'Work Order / Product',
      sortable: true,
      sortValue: (r) => r.wo_no,
      render: (r) => (
        <div className="flex flex-col max-w-xs">
          <span className="font-medium text-xs text-[var(--text-primary)] flex items-center gap-1">
            <Factory className="h-3 w-3 text-indigo-500" />
            <span className="font-mono">{r.wo_no}</span>
          </span>
          <span className="text-[11px] text-[var(--text-muted)] truncate" title={r.wo_item_name}>
            {r.wo_item_code} - {r.wo_item_name}
          </span>
        </div>
      ),
    },
    {
      key: 'warehouses',
      header: 'Store Routing',
      render: (r) => (
        <div className="flex items-center gap-1.5 text-xs">
          <span className="font-medium text-[var(--text-secondary)]">{r.from_warehouse_name}</span>
          <ArrowRight className="h-3 w-3 text-[var(--text-muted)] shrink-0" />
          <span className="text-[var(--text-muted)]">
            {r.to_warehouse_name || 'Lineside Floor'}
          </span>
        </div>
      ),
    },
    {
      key: 'items_summary',
      header: 'Qty & Items',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.total_quantity,
      render: (r) => (
        <div className="text-right">
          <div className="font-semibold text-xs text-[var(--text-primary)]">
            {r.total_quantity.toLocaleString()} units
          </div>
          <div className="text-[11px] text-[var(--text-muted)]">
            {r.line_item_count || r.total_items} item line(s)
          </div>
        </div>
      ),
    },
    {
      key: 'total_cost',
      header: 'Total Value',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.total_cost,
      render: (r) => (
        <span className="font-mono font-semibold text-xs text-[var(--text-primary)]">
          ₹{r.total_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
            r.status === 'POSTED'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
              : r.status === 'DRAFT'
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
          }`}
        >
          {r.status === 'POSTED' && <CheckCircle2 className="h-3 w-3" />}
          {r.status === 'DRAFT' && <Clock className="h-3 w-3" />}
          {r.status === 'CANCELLED' && <X className="h-3 w-3" />}
          <span>{r.status}</span>
        </span>
      ),
    },
  ];

  const groupByOptions: GroupByOption<MaterialIssueRow>[] = [
    {
      key: 'status',
      label: 'Status',
      groupValue: (r) => r.status,
    },
    {
      key: 'issue_type',
      label: 'Issue Type',
      groupValue: (r) => r.issue_type.replace(/_/g, ' '),
    },
    {
      key: 'from_warehouse_name',
      label: 'Issuing Warehouse',
      groupValue: (r) => r.from_warehouse_name,
    },
    {
      key: 'wo_no',
      label: 'Work Order',
      groupValue: (r) => `${r.wo_no} (${r.wo_item_code})`,
    },
  ];

  const searchPredicate = (row: MaterialIssueRow, query: string) => {
    const q = query.toLowerCase();
    return Boolean(
      row.issue_no.toLowerCase().includes(q) ||
      row.wo_no.toLowerCase().includes(q) ||
      row.wo_item_code.toLowerCase().includes(q) ||
      row.wo_item_name.toLowerCase().includes(q) ||
      row.from_warehouse_name.toLowerCase().includes(q) ||
      (row.to_warehouse_name && row.to_warehouse_name.toLowerCase().includes(q)) ||
      (row.remarks && row.remarks.toLowerCase().includes(q))
    );
  };

  // --------------------------------------------------------------------------
  // Render
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6 p-6">
      {/* Top Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Material Issue & Lineside Staging
            </h1>
          </div>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">
            Stage component picking from stores to WIP, backflush bill-of-materials, and process shopfloor returns
          </p>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex items-center gap-2.5">
          <PermissionGate screen="MFG_MATERIAL_ISSUE" action="RETURN">
            <button
              onClick={() => {
                setReturnForm(DEFAULT_RETURN_FORM);
                setReturnErrors({});
                setIsReturnModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 transition-colors shadow-xs"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Return to Store</span>
            </button>
          </PermissionGate>

          <PermissionGate screen="MFG_MATERIAL_ISSUE" action="ADD">
            <button
              onClick={() => {
                setFormState(DEFAULT_FORM);
                setFormErrors({});
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>New Material Issue</span>
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)]">Total Issue Slips</p>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mt-1 font-mono">
              {isLoadingSummary ? '...' : summaryData?.totalIssues ?? 0}
            </h3>
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {summaryData?.draftIssues ?? 0} Draft / In Staging
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Boxes className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)]">Total Material Issued</p>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mt-1 font-mono">
              ₹
              {isLoadingSummary
                ? '...'
                : (summaryData?.totalMaterialValue ?? 0).toLocaleString('en-IN', {
                    maximumFractionDigits: 0,
                  })}
            </h3>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              {summaryData?.postedIssues ?? 0} Posted Vouchers
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <TrendingUp className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)]">Active WIP Orders</p>
            <h3 className="text-2xl font-bold text-[var(--text-primary)] mt-1 font-mono">
              {isLoadingSummary ? '...' : summaryData?.activeWipOrders ?? 0}
            </h3>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Released & In-Production Jobs
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
            <Factory className="h-5 w-5" />
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-[var(--text-secondary)]">Pending Picking Allocations</p>
            <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1 font-mono">
              {isLoadingSummary ? '...' : summaryData?.pendingPickingOrders ?? 0}
            </h3>
            <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
              Work Orders awaiting store issue
            </p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Master Data Table */}
      <MasterDataTable<MaterialIssueRow>
        title="Material Issue Register"
        subtitle="Live shopfloor material issue slips, staging requisitions, and inventory transfers"
        screenCode="MFG_MATERIAL_ISSUE"
        tableNameBadge="tbl_mfg_material_issue_header"
        data={issuesData || []}
        isLoading={isLoadingIssues}
        rowKey={(r) => r.issue_id}
        columns={columns}
        searchPredicate={searchPredicate}
        groupByOptions={groupByOptions}
        filterToolbarSlot={
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-primary)]"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="POSTED">Posted</option>
              <option value="CANCELLED">Cancelled</option>
            </select>

            {/* Issue Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-primary)]"
            >
              <option value="ALL">All Types</option>
              <option value="STANDARD_ISSUE">Standard Issue</option>
              <option value="RETURN_TO_STORE">Return to Store</option>
              <option value="LINESIDE_TRANSFER">Lineside Transfer</option>
              <option value="SCRAP_ADJUSTMENT">Scrap Adjustment</option>
            </select>

            {/* Warehouse Filter */}
            <select
              value={filterWarehouse}
              onChange={(e) => setFilterWarehouse(e.target.value)}
              className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-primary)]"
            >
              <option value="ALL">All Stores</option>
              {lookups?.warehouses.map((wh) => (
                <option key={wh.warehouse_id} value={wh.warehouse_id}>
                  {wh.warehouse_name}
                </option>
              ))}
            </select>

            {/* Work Order Filter */}
            <select
              value={filterWoId}
              onChange={(e) => setFilterWoId(e.target.value)}
              className="h-8 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 text-xs text-[var(--text-primary)] max-w-xs truncate"
            >
              <option value="ALL">All Active Work Orders</option>
              {lookups?.activeWorkOrders.map((wo) => (
                <option key={wo.wo_id} value={wo.wo_id}>
                  {wo.wo_no} - {wo.item_code}
                </option>
              ))}
            </select>
          </div>
        }
        renderRowActions={(row) => (
          <div className="flex items-center justify-end gap-1">
            {/* View Details Drawer */}
            <button
              onClick={() => {
                setSelectedViewId(row.issue_id);
                setIsDetailsDrawerOpen(true);
              }}
              title="View Issue Voucher & BOM Components"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <Eye className="h-4 w-4" />
            </button>

            {/* Print Voucher */}
            <PermissionGate screen="MFG_MATERIAL_ISSUE" action="PRINT">
              <button
                onClick={() => handleOpenPrintModal(row.issue_id)}
                title="Print Material Issue Slip"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                <Printer className="h-4 w-4" />
              </button>
            </PermissionGate>

            {/* Submit & Post (Draft only) */}
            {row.status === 'DRAFT' && (
              <PermissionGate screen="MFG_MATERIAL_ISSUE" action="SUBMIT">
                <button
                  onClick={() => {
                    setSelectedSubmitIssue(row);
                    setSubmitRemarks(`Posted by shopfloor store on ${new Date().toLocaleDateString()}`);
                    setIsSubmitModalOpen(true);
                  }}
                  title="Submit & Post to Stock / Work Order"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400 transition-colors"
                >
                  <Send className="h-4 w-4" />
                </button>
              </PermissionGate>
            )}

            {/* Delete Draft only */}
            {row.status === 'DRAFT' && (
              <PermissionGate screen="MFG_MATERIAL_ISSUE" action="DELETE">
                <button
                  onClick={() => {
                    setIssueToDelete(row);
                    setDeleteErrorMessage(null);
                    setIsDeleteModalOpen(true);
                  }}
                  title="Delete Draft Issue Slip"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-500/10 dark:text-rose-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </PermissionGate>
            )}
          </div>
        )}
      />

      {/* ==================================================================== */}
      {/* CREATE / ISSUE MODAL                                                 */}
      {/* ==================================================================== */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden my-6">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Boxes className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">
                    Create Shopfloor Material Issue
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Pick and stage bill-of-material items for active production work orders
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Body */}
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {formErrors.form && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{formErrors.form}</span>
                </div>
              )}

              {/* Work Order & General Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Select Work Order */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Production Work Order <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formState.woId}
                    onChange={(e) => handleSelectWorkOrder(Number(e.target.value))}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    <option value="">-- Select Active Work Order (Released / In Progress) --</option>
                    {lookups?.activeWorkOrders.map((wo) => (
                      <option key={wo.wo_id} value={wo.wo_id}>
                        {wo.wo_no} — {wo.item_code} ({wo.item_name}) [Qty: {wo.planned_qty} {wo.uom_code}]
                      </option>
                    ))}
                  </select>
                  {formErrors.woId && (
                    <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.woId}</p>
                  )}
                </div>

                {/* Issue Type */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Issue Slip Type
                  </label>
                  <select
                    value={formState.issueType}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        issueType: e.target.value as MaterialIssueType,
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    <option value="STANDARD_ISSUE">Standard Issue (Stores to WIP)</option>
                    <option value="LINESIDE_TRANSFER">Lineside Transfer</option>
                    <option value="SCRAP_ADJUSTMENT">Scrap / Component Adjustment</option>
                  </select>
                </div>
              </div>

              {/* Selected WO Detail Card & Quick Loader */}
              {formState.woId && (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                      Work Order Snapshot
                    </span>
                    {(() => {
                      const wo = lookups?.activeWorkOrders.find((w) => w.wo_id === formState.woId);
                      if (!wo) return null;
                      return (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs">
                          <span className="font-semibold text-[var(--text-primary)]">{wo.wo_no}</span>
                          <span className="text-[var(--text-secondary)]">
                            FG: <strong className="text-[var(--text-primary)]">{wo.item_name}</strong>
                          </span>
                          <span className="text-[var(--text-secondary)]">
                            Planned: <strong>{wo.planned_qty} {wo.uom_code}</strong>
                          </span>
                          <span className="text-[var(--text-secondary)]">
                            Target Floor: <strong>{wo.wip_warehouse_name}</strong>
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  <button
                    type="button"
                    disabled={isLoadingBomItems}
                    onClick={handleLoadWoBomItems}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-xs shrink-0 disabled:opacity-50"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>{isLoadingBomItems ? 'Loading Snapshot...' : '1-Click Load BOM Items'}</span>
                  </button>
                </div>
              )}

              {/* Warehouses & Dates */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* From Warehouse (Source Store) */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Issuing Store (Source) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formState.fromWarehouseId}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        fromWarehouseId: Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    <option value="">-- Select Store --</option>
                    {lookups?.warehouses.map((wh) => (
                      <option key={wh.warehouse_id} value={wh.warehouse_id}>
                        {wh.warehouse_name} ({wh.warehouse_type})
                      </option>
                    ))}
                  </select>
                  {formErrors.fromWarehouseId && (
                    <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.fromWarehouseId}</p>
                  )}
                </div>

                {/* To Warehouse (Target WIP / Floor) */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Receiving Location (WIP Floor)
                  </label>
                  <select
                    value={formState.toWarehouseId}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        toWarehouseId: Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    <option value="">-- Default WIP Staging Floor --</option>
                    {lookups?.warehouses.map((wh) => (
                      <option key={wh.warehouse_id} value={wh.warehouse_id}>
                        {wh.warehouse_name} ({wh.warehouse_type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Issue Date */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Issue Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formState.issueDate}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, issueDate: e.target.value }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  {formErrors.issueDate && (
                    <p className="text-[11px] text-rose-500 mt-0.5">{formErrors.issueDate}</p>
                  )}
                </div>

                {/* Issued By */}
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Issued By (Storekeeper)
                  </label>
                  <select
                    value={formState.issuedBy}
                    onChange={(e) =>
                      setFormState((prev) => ({
                        ...prev,
                        issuedBy: Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  >
                    <option value="">-- Current Logged User --</option>
                    {lookups?.users.map((u) => (
                      <option key={u.user_id} value={u.user_id}>
                        {u.full_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items Table Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                    <Layers className="h-4 w-4 text-emerald-500" />
                    <span>Component Lines to Issue ({formState.items.length})</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddCustomItem}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-emerald-600 hover:bg-emerald-500/10 border border-emerald-500/20 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {formErrors.items && (
                  <p className="text-xs text-rose-500 font-medium">{formErrors.items}</p>
                )}

                <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] text-[var(--text-secondary)] font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Item Details</th>
                        <th className="py-2.5 px-2 text-right">Required</th>
                        <th className="py-2.5 px-2 text-right">Issued So Far</th>
                        <th className="py-2.5 px-2 text-right">Current Store Stock</th>
                        <th className="py-2.5 px-3 text-right w-28">Issue Qty</th>
                        <th className="py-2.5 px-2 text-right">Unit Cost</th>
                        <th className="py-2.5 px-2 text-right">Line Total</th>
                        <th className="py-2.5 px-2 w-28">Batch / Bin</th>
                        <th className="py-2.5 px-2 text-center w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {formState.items.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-8 text-center text-xs text-[var(--text-muted)]">
                            No component items loaded yet. Select a Work Order and click{' '}
                            <strong>"1-Click Load BOM Items"</strong> or add items manually.
                          </td>
                        </tr>
                      ) : (
                        formState.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-500/5 transition-colors">
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-[var(--text-primary)]">
                                {item.item_code}
                              </div>
                              <div className="text-[11px] text-[var(--text-muted)] truncate max-w-[200px]">
                                {item.item_name}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-[var(--text-secondary)]">
                              {item.required_qty} {item.uom_code}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-[var(--text-secondary)]">
                              {item.previously_issued_qty} {item.uom_code}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono">
                              <span
                                className={`font-semibold ${
                                  (item.current_stock_qty ?? 0) < item.issue_qty
                                    ? 'text-rose-500'
                                    : 'text-emerald-600 dark:text-emerald-400'
                                }`}
                              >
                                {item.current_stock_qty ?? '—'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.issue_qty}
                                onChange={(e) => handleItemQtyChange(idx, Number(e.target.value))}
                                className="w-24 text-right rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-xs font-mono font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                              />
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-xs text-[var(--text-muted)]">
                              ₹{item.unit_cost.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono font-semibold text-xs text-[var(--text-primary)]">
                              ₹{item.total_cost.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-2">
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  placeholder="Batch #"
                                  value={item.batch_no || ''}
                                  onChange={(e) => handleItemFieldChange(idx, 'batch_no', e.target.value)}
                                  className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-primary)]"
                                />
                                <input
                                  type="text"
                                  placeholder="Bin Loc"
                                  value={item.bin_location || ''}
                                  onChange={(e) => handleItemFieldChange(idx, 'bin_location', e.target.value)}
                                  className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-primary)]"
                                />
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="text-slate-400 hover:text-rose-500 transition-colors p-1"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {formState.items.length > 0 && (
                      <tfoot className="bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] font-semibold text-xs">
                        <tr>
                          <td colSpan={4} className="py-2.5 px-3 text-right text-[var(--text-secondary)]">
                            Totals:
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                            {formTotals.totalQty} units
                          </td>
                          <td className="py-2.5 px-2"></td>
                          <td className="py-2.5 px-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                            ₹{formTotals.totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Issue Slip Remarks / Handover Notes
                </label>
                <textarea
                  rows={2}
                  value={formState.remarks}
                  onChange={(e) => setFormState((prev) => ({ ...prev, remarks: e.target.value }))}
                  placeholder="e.g. Dispatched to Assembly Line Bay 2 with heat treatment test cert..."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="text-xs text-[var(--text-secondary)]">
                Lines: <strong className="text-[var(--text-primary)]">{formTotals.lineCount}</strong> |
                Total Qty: <strong className="text-[var(--text-primary)]">{formTotals.totalQty}</strong> |
                Value: <strong className="text-emerald-600">₹{formTotals.totalVal.toLocaleString()}</strong>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={createIssueMutation.isPending}
                  onClick={() => handleSubmitForm(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shadow-xs"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={createIssueMutation.isPending}
                  onClick={() => handleSubmitForm(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs"
                >
                  <Send className="h-4 w-4" />
                  <span>Save & Post Immediately</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* RETURN TO STORE MODAL                                                */}
      {/* ==================================================================== */}
      {isReturnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden my-6">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">
                    Return Unconsumed Material to Store
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Transfer unused raw materials or surplus WIP components back from shopfloor into stores
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsReturnModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {returnErrors.form && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                  {returnErrors.form}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Select Work Order Returning Material <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={returnForm.woId}
                    onChange={(e) => handleSelectReturnWo(Number(e.target.value))}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  >
                    <option value="">-- Select Active Work Order --</option>
                    {lookups?.activeWorkOrders.map((wo) => (
                      <option key={wo.wo_id} value={wo.wo_id}>
                        {wo.wo_no} — {wo.item_code} ({wo.item_name})
                      </option>
                    ))}
                  </select>
                  {returnErrors.woId && (
                    <p className="text-[11px] text-rose-500 mt-0.5">{returnErrors.woId}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Returning From (WIP Floor)
                  </label>
                  <select
                    value={returnForm.fromWarehouseId}
                    onChange={(e) =>
                      setReturnForm((prev) => ({
                        ...prev,
                        fromWarehouseId: Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  >
                    <option value="">-- Select WIP Location --</option>
                    {lookups?.warehouses.map((wh) => (
                      <option key={wh.warehouse_id} value={wh.warehouse_id}>
                        {wh.warehouse_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Destination Store (Raw Material Store)
                  </label>
                  <select
                    value={returnForm.toWarehouseId}
                    onChange={(e) =>
                      setReturnForm((prev) => ({
                        ...prev,
                        toWarehouseId: Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  >
                    <option value="">-- Select Receiving Store --</option>
                    {lookups?.warehouses.map((wh) => (
                      <option key={wh.warehouse_id} value={wh.warehouse_id}>
                        {wh.warehouse_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Return Slip Remarks
                  </label>
                  <input
                    type="text"
                    value={returnForm.remarks}
                    onChange={(e) =>
                      setReturnForm((prev) => ({ ...prev, remarks: e.target.value }))
                    }
                    placeholder="Excess drawn / batch closed..."
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
              </div>

              {/* Return Items Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Issued Components Available for Return
                </h4>
                {returnErrors.items && (
                  <p className="text-xs text-rose-500 font-medium">{returnErrors.items}</p>
                )}
                <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] text-[var(--text-secondary)] font-semibold">
                      <tr>
                        <th className="py-2.5 px-3">Item</th>
                        <th className="py-2.5 px-2 text-right">Previously Issued</th>
                        <th className="py-2.5 px-3 text-right w-28">Return Qty</th>
                        <th className="py-2.5 px-2 text-right">Unit Value</th>
                        <th className="py-2.5 px-2 w-28">Batch / Bin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {returnForm.items.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-xs text-[var(--text-muted)]">
                            {returnForm.woId
                              ? 'No previously issued items found for this Work Order.'
                              : 'Select a Work Order above to inspect issued materials.'}
                          </td>
                        </tr>
                      ) : (
                        returnForm.items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-slate-500/5 transition-colors">
                            <td className="py-2.5 px-3">
                              <span className="font-semibold text-[var(--text-primary)]">
                                {it.itemCode}
                              </span>
                              <div className="text-[11px] text-[var(--text-muted)] truncate max-w-[200px]">
                                {it.itemName}
                              </div>
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-[var(--text-secondary)]">
                              {it.previouslyIssuedQty} {it.uomCode}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <input
                                type="number"
                                min="0"
                                max={it.previouslyIssuedQty}
                                step="any"
                                value={it.returnQty}
                                onChange={(e) => {
                                  const val = Number(e.target.value) || 0;
                                  setReturnForm((prev) => {
                                    const next = [...prev.items];
                                    next[idx] = { ...next[idx], returnQty: val };
                                    return { ...prev, items: next };
                                  });
                                }}
                                className="w-24 text-right rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-xs font-mono font-semibold text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                              />
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-xs text-[var(--text-muted)]">
                              ₹{it.unitCost.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-2">
                              <input
                                type="text"
                                placeholder="Store Bin"
                                value={it.binLocation}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setReturnForm((prev) => {
                                    const next = [...prev.items];
                                    next[idx] = { ...next[idx], binLocation: v };
                                    return { ...prev, items: next };
                                  });
                                }}
                                className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-[10px] text-[var(--text-primary)]"
                              />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <button
                type="button"
                onClick={() => setIsReturnModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={returnToStoreMutation.isPending}
                onClick={handleReturnSubmit}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-xs"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Confirm & Post Return Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* DETAILS DRAWER                                                       */}
      {/* ==================================================================== */}
      {isDetailsDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-xs transition-opacity"
          onClick={() => setIsDetailsDrawerOpen(false)}
        >
          <div
            className="w-full max-w-2xl bg-[var(--bg-surface)] border-l border-[var(--border-subtle)] shadow-2xl h-full flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Boxes className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[var(--text-primary)] font-mono">
                      {viewDetailData?.issue_no || 'Loading...'}
                    </h2>
                    {viewDetailData && (
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          viewDetailData.status === 'POSTED'
                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                        }`}
                      >
                        {viewDetailData.status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {viewDetailData?.issue_type.replace(/_/g, ' ')} • Date: {viewDetailData?.issue_date}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailsDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {isLoadingDetail || !viewDetailData ? (
                <div className="flex items-center justify-center py-12 text-xs text-[var(--text-muted)]">
                  Loading issue slip details...
                </div>
              ) : (
                <>
                  {/* Linked Work Order Box */}
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      Target Production Work Order
                    </span>
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-sm text-[var(--text-primary)] font-mono flex items-center gap-2">
                        <Factory className="h-4 w-4 text-indigo-500" />
                        <span>{viewDetailData.wo_no}</span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-medium">
                        WO Status: {viewDetailData.wo_status}
                      </span>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      Finished Good: <strong className="text-[var(--text-primary)]">{viewDetailData.wo_item_code}</strong> — {viewDetailData.wo_item_name}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      Planned Qty: <strong>{viewDetailData.wo_planned_qty} {viewDetailData.wo_uom_code}</strong>
                    </div>
                  </div>

                  {/* Warehouse & Personnel Metadata */}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                        From Store
                      </span>
                      <p className="font-semibold text-[var(--text-primary)] mt-1">
                        {viewDetailData.from_warehouse_name}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Code: {viewDetailData.from_warehouse_code}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                        To WIP Staging Floor
                      </span>
                      <p className="font-semibold text-[var(--text-primary)] mt-1">
                        {viewDetailData.to_warehouse_name || 'Lineside Floor'}
                      </p>
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Code: {viewDetailData.to_warehouse_code || 'WIP-FLOOR'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                        Issued By
                      </span>
                      <p className="font-semibold text-[var(--text-primary)] mt-1">
                        {viewDetailData.issued_by_name || 'Storekeeper'}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[var(--border-subtle)] p-3">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                        Received By
                      </span>
                      <p className="font-semibold text-[var(--text-primary)] mt-1">
                        {viewDetailData.received_by_name || 'Shopfloor Operator'}
                      </p>
                    </div>
                  </div>

                  {/* Components List */}
                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                      Component Items Issued ({viewDetailData.items?.length || 0})
                    </h3>

                    <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] text-[var(--text-secondary)] font-semibold">
                          <tr>
                            <th className="py-2.5 px-3">Item</th>
                            <th className="py-2.5 px-2 text-right">Required</th>
                            <th className="py-2.5 px-2 text-right">Issued</th>
                            <th className="py-2.5 px-2 text-right">Unit Cost</th>
                            <th className="py-2.5 px-3 text-right">Total</th>
                            <th className="py-2.5 px-2">Batch / Bin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                          {viewDetailData.items?.map((it, idx) => (
                            <tr key={idx} className="hover:bg-slate-500/5 transition-colors">
                              <td className="py-2.5 px-3">
                                <span className="font-semibold text-[var(--text-primary)]">
                                  {it.item_code}
                                </span>
                                <div className="text-[11px] text-[var(--text-muted)] truncate max-w-[180px]">
                                  {it.item_name}
                                </div>
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono text-[var(--text-muted)]">
                                {it.required_qty} {it.uom_code}
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                {it.issue_qty} {it.uom_code}
                              </td>
                              <td className="py-2.5 px-2 text-right font-mono text-[var(--text-muted)]">
                                ₹{it.unit_cost?.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-semibold text-[var(--text-primary)]">
                                ₹{it.total_cost?.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-2 text-[11px] text-[var(--text-muted)]">
                                {it.batch_no ? `B: ${it.batch_no}` : ''}
                                {it.bin_location ? ` | L: ${it.bin_location}` : ''}
                                {!it.batch_no && !it.bin_location && '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-[var(--bg-elevated)] border-t border-[var(--border-subtle)] font-semibold text-xs">
                          <tr>
                            <td colSpan={2} className="py-2.5 px-3 text-right text-[var(--text-secondary)]">
                              Total Value:
                            </td>
                            <td className="py-2.5 px-2 text-right font-mono text-emerald-600 dark:text-emerald-400">
                              {viewDetailData.total_quantity} units
                            </td>
                            <td></td>
                            <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                              ₹{viewDetailData.total_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Remarks & Audit */}
                  {viewDetailData.remarks && (
                    <div className="rounded-xl border border-[var(--border-subtle)] p-3 text-xs">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                        Remarks / Handover Notes
                      </span>
                      <p className="mt-1 text-[var(--text-secondary)]">{viewDetailData.remarks}</p>
                    </div>
                  )}

                  <div className="text-[11px] text-[var(--text-muted)] border-t border-[var(--border-subtle)] pt-3 flex flex-wrap gap-4">
                    <span>Created: {new Date(viewDetailData.created_date).toLocaleString()}</span>
                    {viewDetailData.created_by_name && (
                      <span>By: {viewDetailData.created_by_name}</span>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <button
                type="button"
                onClick={() => setIsDetailsDrawerOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <PermissionGate screen="MFG_MATERIAL_ISSUE" action="PRINT">
                  <button
                    type="button"
                    onClick={() => {
                      if (viewDetailData) {
                        setPrintIssueData(viewDetailData);
                        setIsPrintModalOpen(true);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--text-primary)] transition-colors shadow-xs"
                  >
                    <Printer className="h-4 w-4" />
                    <span>Print Slip</span>
                  </button>
                </PermissionGate>

                {viewDetailData?.status === 'DRAFT' && (
                  <PermissionGate screen="MFG_MATERIAL_ISSUE" action="SUBMIT">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSubmitIssue(viewDetailData);
                        setSubmitRemarks('Confirmed from details flyout');
                        setIsSubmitModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs"
                    >
                      <Send className="h-4 w-4" />
                      <span>Submit & Post</span>
                    </button>
                  </PermissionGate>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SUBMIT & POST CONFIRMATION MODAL                                     */}
      {/* ==================================================================== */}
      {isSubmitModalOpen && selectedSubmitIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Send className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--text-primary)]">
                    Submit & Post Issue Slip
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] font-mono">
                    {selectedSubmitIssue.issue_no}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSubmitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-[var(--text-secondary)]">
                Posting this material issue will execute the following automated stock movements:
              </p>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Deduct stock balances from store <strong>{selectedSubmitIssue.from_warehouse_name}</strong>
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Increment <code>issued_qty</code> on Work Order <strong>{selectedSubmitIssue.wo_no}</strong>
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Transition Work Order status from <code>RELEASED</code> to <code>IN_PROGRESS</code>
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    Accumulate ₹{selectedSubmitIssue.total_cost.toLocaleString()} to actual material cost
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Posting Remarks / Handover Notes
                </label>
                <input
                  type="text"
                  value={submitRemarks}
                  onChange={(e) => setSubmitRemarks(e.target.value)}
                  placeholder="e.g. Issued and signed off by supervisor..."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <button
                type="button"
                onClick={() => setIsSubmitModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitIssueMutation.isPending}
                onClick={() =>
                  submitIssueMutation.mutate({
                    id: selectedSubmitIssue.issue_id,
                    remarks: submitRemarks,
                  })
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirm & Post Now</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* PRINTABLE MATERIAL ISSUE VOUCHER MODAL                               */}
      {/* ==================================================================== */}
      {isPrintModalOpen && printIssueData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl border border-[var(--border-subtle)] bg-white text-slate-900 shadow-2xl overflow-hidden my-6">
            {/* Modal Controls (Hidden in print) */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-6 py-3 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="h-4 w-4 text-slate-700" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Material Issue Voucher Preview
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Voucher</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(false)}
                  className="text-slate-500 hover:text-slate-800 p-1"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div className="p-8 space-y-6 text-slate-900 print:p-0">
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    KASHVIRA PRECISION MANUFACTURING LTD
                  </h1>
                  <p className="text-xs text-slate-600">
                    Industrial Estate, Phase II, Ahmedabad, Gujarat - 382445
                  </p>
                  <p className="text-xs font-bold text-indigo-700 mt-1 uppercase tracking-wide">
                    SHOPFLOOR MATERIAL ISSUE & REQUISITION SLIP
                  </p>
                </div>
                <div className="text-right">
                  <div className="font-mono text-base font-bold text-slate-900">
                    {printIssueData.issue_no}
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    Date: <strong>{printIssueData.issue_date}</strong>
                  </div>
                  <div className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-slate-200 text-slate-800">
                    {printIssueData.status}
                  </div>
                </div>
              </div>

              {/* Work Order & Stores Info Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs border border-slate-300 rounded-lg p-3 bg-slate-50">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    Work Order Reference
                  </span>
                  <p className="font-bold text-slate-900 font-mono">{printIssueData.wo_no}</p>
                  <p className="text-slate-700">
                    Target FG: <strong>{printIssueData.wo_item_code}</strong> — {printIssueData.wo_item_name}
                  </p>
                  <p className="text-slate-600">
                    Planned Qty: {printIssueData.wo_planned_qty} {printIssueData.wo_uom_code}
                  </p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500">
                    Store Routing & Type
                  </span>
                  <p className="text-slate-900">
                    From: <strong>{printIssueData.from_warehouse_name}</strong>
                  </p>
                  <p className="text-slate-900">
                    To: <strong>{printIssueData.to_warehouse_name || 'Lineside WIP Floor'}</strong>
                  </p>
                  <p className="text-slate-600">
                    Issue Type: {printIssueData.issue_type.replace(/_/g, ' ')}
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div>
                <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                  <thead className="bg-slate-200 border-b border-slate-300 text-slate-800 font-bold">
                    <tr>
                      <th className="py-2 px-2 border-r border-slate-300">#</th>
                      <th className="py-2 px-2 border-r border-slate-300">Item Code & Name</th>
                      <th className="py-2 px-2 border-r border-slate-300 text-right">Required</th>
                      <th className="py-2 px-2 border-r border-slate-300 text-right">Issued Qty</th>
                      <th className="py-2 px-2 border-r border-slate-300 text-right">Rate (₹)</th>
                      <th className="py-2 px-2 border-r border-slate-300 text-right">Amount (₹)</th>
                      <th className="py-2 px-2">Batch / Bin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {printIssueData.items?.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-2 border-r border-slate-200 text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-2 border-r border-slate-200 font-medium">
                          <span className="font-mono font-bold">{it.item_code}</span> — {it.item_name}
                        </td>
                        <td className="py-2 px-2 border-r border-slate-200 text-right font-mono">
                          {it.required_qty} {it.uom_code}
                        </td>
                        <td className="py-2 px-2 border-r border-slate-200 text-right font-mono font-bold">
                          {it.issue_qty} {it.uom_code}
                        </td>
                        <td className="py-2 px-2 border-r border-slate-200 text-right font-mono">
                          {it.unit_cost?.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 border-r border-slate-200 text-right font-mono font-bold">
                          {it.total_cost?.toFixed(2)}
                        </td>
                        <td className="py-2 px-2 font-mono text-[11px] text-slate-600">
                          {it.batch_no || it.bin_location
                            ? `${it.batch_no || ''} ${it.bin_location ? `(${it.bin_location})` : ''}`
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-bold">
                    <tr>
                      <td colSpan={3} className="py-2 px-2 text-right border-r border-slate-300">
                        Total Quantity & Value:
                      </td>
                      <td className="py-2 px-2 text-right font-mono border-r border-slate-300 font-bold">
                        {printIssueData.total_quantity} units
                      </td>
                      <td className="py-2 px-2 border-r border-slate-300"></td>
                      <td className="py-2 px-2 text-right font-mono border-r border-slate-300 font-bold">
                        ₹{printIssueData.total_cost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Remarks */}
              {printIssueData.remarks && (
                <div className="text-xs text-slate-700 border-t border-slate-200 pt-2">
                  <strong>Remarks:</strong> {printIssueData.remarks}
                </div>
              )}

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-6 pt-12 text-center text-xs text-slate-700">
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold">
                    {printIssueData.created_by_name || 'Store Requisitioner'}
                  </div>
                  <span className="text-[10px] text-slate-500">Prepared By</span>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold">
                    {printIssueData.issued_by_name || 'Authorized Storekeeper'}
                  </div>
                  <span className="text-[10px] text-slate-500">Issued & Staged By</span>
                </div>
                <div>
                  <div className="border-t border-slate-400 pt-1 font-semibold">
                    {printIssueData.received_by_name || 'Production Supervisor'}
                  </div>
                  <span className="text-[10px] text-slate-500">Received On Shopfloor</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* CONFIRM DELETE MODAL                                                 */}
      {/* ==================================================================== */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        entityType="Material Issue Slip"
        entityName={issueToDelete?.issue_no || ''}
        entityCode={issueToDelete?.issue_no}
        isDeleting={deleteIssueMutation.isPending}
        errorMessage={deleteErrorMessage}
        onConfirm={() => {
          if (issueToDelete) {
            deleteIssueMutation.mutate(issueToDelete.issue_id);
          }
        }}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setIssueToDelete(null);
          setDeleteErrorMessage(null);
        }}
      />
    </div>
  );
};

export default MaterialIssueMasterPage;
