import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  Download,
  Edit3,
  ExternalLink,
  Layers,
  Percent,
  Plus,
  Printer,
  Search,
  ShieldAlert,
  Tag,
  Trash2,
  TrendingUp,
  Truck,
  Users,
  Wrench,
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
// TYPES & CATALOGUES
// ============================================================================

export type PriceListType = 'SALES' | 'PURCHASE' | 'JOB_WORK';

export interface PriceListItemRecord {
  priceListItemId?: number;
  priceListId?: number;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  itemType?: string;
  uomId: number;
  uomCode?: string;
  uomName?: string;
  minQty: number;
  maxQty: number | null;
  baseRate: number;
  discountPct: number;
  effectiveRate: number;
  leadTimeDays: number;
  remarks: string | null;
  isActive: boolean;
}

export interface AssignedPartyRecord {
  partyPriceListId?: number;
  partyId: number;
  partyCode: string;
  partyName: string;
  partyGroup?: string;
  isPrimary: boolean;
  isActive: boolean;
}

export interface PriceListHeaderRecord {
  priceListId: number;
  priceListCode: string;
  priceListName: string;
  priceListType: PriceListType;
  currencyCode: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isDefault: boolean;
  description: string | null;
  isActive: boolean;
  createdDate: string;
  updatedDate: string | null;
  itemsCount: number;
  assignedPartiesCount: number;
  items?: PriceListItemRecord[];
  assignedParties?: AssignedPartyRecord[];
}

export interface PriceListSummary {
  totalPriceLists: number;
  salesCount: number;
  purchaseCount: number;
  jobWorkCount: number;
  activeItemsCount: number;
}

export interface ItemLookupOption {
  itemId: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  baseUomId: number;
  baseUomCode?: string;
  salesRate?: number;
  purchaseRate?: number;
}

export interface UomLookupOption {
  uomId: number;
  uomCode: string;
  uomName: string;
}

export interface PartyLookupOption {
  partyId: number;
  partyCode: string;
  partyName: string;
  partyGroup: string;
  isCustomer: boolean;
  isSupplier: boolean;
  isJobWorker: boolean;
}

const PRICE_LIST_TYPE_META: Record<
  PriceListType,
  { label: string; badgeClass: string; icon: React.ComponentType<{ className?: string }> }
> = {
  SALES: {
    label: 'Sales Rate Card',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30',
    icon: TrendingUp,
  },
  PURCHASE: {
    label: 'Purchase Contract',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    icon: Truck,
  },
  JOB_WORK: {
    label: 'Job-Work Rate Card',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
    icon: Wrench,
  },
};

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export const PriceListMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters & State
  const [typeFilter, setTypeFilter] = useState<'ALL' | PriceListType>('ALL');
  const [activeOnly, setActiveOnly] = useState<boolean>(true);
  const [defaultOnly, setDefaultOnly] = useState<boolean>(false);

  // Modals
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PriceListHeaderRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteDependencies, setDeleteDependencies] = useState<DependencyConflictItem[]>([]);
  const [printTarget, setPrintTarget] = useState<PriceListHeaderRecord | null>(null);

  // Editor Multi-Tab: 1 = Header, 2 = Tiered Rates, 3 = Assigned Parties
  const [editorTab, setEditorTab] = useState<'header' | 'items' | 'parties'>('header');

  // Form State
  const [formCode, setFormCode] = useState<string>('');
  const [formName, setFormName] = useState<string>('');
  const [formType, setFormType] = useState<PriceListType>('SALES');
  const [formCurrency, setFormCurrency] = useState<string>('INR');
  const [formEffectiveFrom, setFormEffectiveFrom] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [formEffectiveTo, setFormEffectiveTo] = useState<string>('');
  const [formIsDefault, setFormIsDefault] = useState<boolean>(false);
  const [formDescription, setFormDescription] = useState<string>('');
  const [formIsActive, setFormIsActive] = useState<boolean>(true);

  // Form Dynamic Line Items
  const [formItems, setFormItems] = useState<PriceListItemRecord[]>([]);

  // Form Assigned Party IDs
  const [formAssignedPartyIds, setFormAssignedPartyIds] = useState<number[]>([]);

  // Validation Error State
  const [formError, setFormError] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // DATA FETCHING
  // --------------------------------------------------------------------------

  // 1. KPI Summary
  const { data: summary, isLoading: isSummaryLoading } = useQuery<PriceListSummary>({
    queryKey: ['price-lists', 'summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PriceListSummary>>('/price-lists/summary');
      return res.data.data;
    },
  });

  // 2. Price Lists Listing
  const { data: priceLists = [], isLoading: isPriceListsLoading } = useQuery<
    PriceListHeaderRecord[]
  >({
    queryKey: ['price-lists', 'list', typeFilter, activeOnly],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (typeFilter !== 'ALL') params.priceListType = typeFilter;
      if (activeOnly) params.isActive = 'true';

      const res = await apiClient.get<ApiResponse<PriceListHeaderRecord[]>>('/price-lists', {
        params,
      });
      return res.data.data;
    },
  });

  // 3. Dropdown Options: Items Catalog
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
        salesRate: Number(i.salesRate) || 0,
        purchaseRate: Number(i.purchaseRate) || 0,
      }));
    },
    staleTime: 60_000,
  });

  // 4. Dropdown Options: UOMs
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

  // 5. Dropdown Options: Parties
  const { data: partiesCatalog = [] } = useQuery<PartyLookupOption[]>({
    queryKey: ['parties', 'options'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/parties');
      return (res.data.data || []).map((p: any) => ({
        partyId: p.partyId,
        partyCode: p.partyCode,
        partyName: p.partyName,
        partyGroup: p.partyGroup,
        isCustomer: Boolean(p.isCustomer),
        isSupplier: Boolean(p.isSupplier),
        isJobWorker: Boolean(p.isJobWorker),
      }));
    },
    staleTime: 60_000,
  });

  // 6. Detailed query for Print / Datasheet Modal
  const { data: printDetailData, isLoading: isPrintLoading } =
    useQuery<PriceListHeaderRecord | null>({
      queryKey: ['price-lists', 'detail', printTarget?.priceListId],
      queryFn: async () => {
        if (!printTarget) return null;
        const res = await apiClient.get<ApiResponse<PriceListHeaderRecord>>(
          `/price-lists/${printTarget.priceListId}`,
        );
        return res.data.data;
      },
      enabled: Boolean(printTarget),
    });

  // --------------------------------------------------------------------------
  // MUTATIONS
  // --------------------------------------------------------------------------

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingId) {
        return apiClient.put(`/price-lists/${editingId}`, payload);
      }
      return apiClient.post('/price-lists', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-lists'] });
      closeEditor();
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || err.message || 'Failed to save price list');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiClient.delete(`/price-lists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['price-lists'] });
      setDeleteTarget(null);
      setDeleteError(null);
      setDeleteDependencies([]);
    },
    onError: (err: any) => {
      const responseData = err.response?.data;
      if (responseData?.dependencies) {
        setDeleteDependencies(responseData.dependencies);
      }
      setDeleteError(responseData?.message || err.message || 'Deletion blocked by active references');
    },
  });

  // --------------------------------------------------------------------------
  // HANDLERS: MODAL LIFECYCLE
  // --------------------------------------------------------------------------

  const openNewEditor = () => {
    setEditingId(null);
    setFormCode('');
    setFormName('');
    setFormType('SALES');
    setFormCurrency('INR');
    setFormEffectiveFrom(new Date().toISOString().split('T')[0]);
    setFormEffectiveTo('');
    setFormIsDefault(false);
    setFormDescription('');
    setFormIsActive(true);
    setFormItems([]);
    setFormAssignedPartyIds([]);
    setFormError(null);
    setEditorTab('header');
    setIsEditorOpen(true);
  };

  const openEditEditor = async (record: PriceListHeaderRecord) => {
    setEditingId(record.priceListId);
    setFormCode(record.priceListCode);
    setFormName(record.priceListName);
    setFormType(record.priceListType);
    setFormCurrency(record.currencyCode || 'INR');
    setFormEffectiveFrom(record.effectiveFrom || '');
    setFormEffectiveTo(record.effectiveTo || '');
    setFormIsDefault(Boolean(record.isDefault));
    setFormDescription(record.description || '');
    setFormIsActive(Boolean(record.isActive));
    setFormError(null);
    setEditorTab('header');

    try {
      const res = await apiClient.get<ApiResponse<PriceListHeaderRecord>>(
        `/price-lists/${record.priceListId}`,
      );
      const detail = res.data.data;
      setFormItems(detail.items || []);
      setFormAssignedPartyIds((detail.assignedParties || []).map((p) => p.partyId));
    } catch {
      setFormItems([]);
      setFormAssignedPartyIds([]);
    }

    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingId(null);
    setFormError(null);
  };

  // --------------------------------------------------------------------------
  // HANDLERS: LINE ITEMS GRID
  // --------------------------------------------------------------------------

  const handleAddItemRow = () => {
    if (!itemsCatalog || itemsCatalog.length === 0) return;
    const defaultItem = itemsCatalog[0];
    const defaultUom = defaultItem.baseUomId || (uomsCatalog && uomsCatalog[0]?.uomId) || 1001;
    const defaultRate =
      formType === 'PURCHASE'
        ? defaultItem.purchaseRate || 100
        : defaultItem.salesRate || 100;

    const newItem: PriceListItemRecord = {
      itemId: defaultItem.itemId,
      itemCode: defaultItem.itemCode,
      itemName: defaultItem.itemName,
      uomId: defaultUom,
      minQty: 1,
      maxQty: null,
      baseRate: defaultRate,
      discountPct: 0,
      effectiveRate: defaultRate,
      leadTimeDays: 0,
      remarks: '',
      isActive: true,
    };

    setFormItems([...formItems, newItem]);
  };

  const handleUpdateItemRow = (index: number, updates: Partial<PriceListItemRecord>) => {
    setFormItems((prev) => {
      const copy = [...prev];
      const cur = { ...copy[index], ...updates };

      // Auto recalculate effectiveRate if baseRate or discountPct changes
      if (updates.baseRate !== undefined || updates.discountPct !== undefined) {
        const b = Number(cur.baseRate) || 0;
        const d = Number(cur.discountPct) || 0;
        cur.effectiveRate = Number((b * (1 - d / 100)).toFixed(4));
      }

      // If item changed, auto populate default UOM & rate
      if (updates.itemId !== undefined && itemsCatalog) {
        const found = itemsCatalog.find((x) => x.itemId === updates.itemId);
        if (found) {
          cur.itemCode = found.itemCode;
          cur.itemName = found.itemName;
          cur.uomId = found.baseUomId;
          const defaultRate =
            formType === 'PURCHASE'
              ? found.purchaseRate || 100
              : found.salesRate || 100;
          cur.baseRate = defaultRate;
          cur.effectiveRate = Number((defaultRate * (1 - (cur.discountPct || 0) / 100)).toFixed(4));
        }
      }

      copy[index] = cur;
      return copy;
    });
  };

  const handleRemoveItemRow = (index: number) => {
    setFormItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // --------------------------------------------------------------------------
  // HANDLERS: PARTY ASSOCIATION CHECKLIST
  // --------------------------------------------------------------------------

  const handleToggleParty = (partyId: number) => {
    setFormAssignedPartyIds((prev) =>
      prev.includes(partyId) ? prev.filter((id) => id !== partyId) : [...prev, partyId],
    );
  };

  const eligibleParties = useMemo(() => {
    if (!partiesCatalog) return [];
    if (formType === 'SALES') {
      return partiesCatalog.filter((p) => p.isCustomer);
    }
    if (formType === 'PURCHASE') {
      return partiesCatalog.filter((p) => p.isSupplier);
    }
    if (formType === 'JOB_WORK') {
      return partiesCatalog.filter((p) => p.isJobWorker || p.isSupplier);
    }
    return partiesCatalog;
  }, [partiesCatalog, formType]);

  // --------------------------------------------------------------------------
  // SAVE SUBMISSION
  // --------------------------------------------------------------------------

  const handleSubmitSave = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanCode = formCode.trim().toUpperCase();
    const cleanName = formName.trim();

    if (!cleanCode) {
      setFormError('Price List Code is required.');
      setEditorTab('header');
      return;
    }
    if (!cleanName) {
      setFormError('Price List Name is required.');
      setEditorTab('header');
      return;
    }
    if (!formEffectiveFrom) {
      setFormError('Effective From date is required.');
      setEditorTab('header');
      return;
    }

    // Check item bracket min_qty sanity
    for (let i = 0; i < formItems.length; i++) {
      const it = formItems[i];
      if (it.minQty <= 0) {
        setFormError(`Item row #${i + 1} Minimum Quantity must be greater than 0.`);
        setEditorTab('items');
        return;
      }
      if (it.maxQty !== null && it.maxQty <= it.minQty) {
        setFormError(
          `Item row #${i + 1} Maximum Quantity (${it.maxQty}) must be strictly greater than Minimum Quantity (${it.minQty}).`,
        );
        setEditorTab('items');
        return;
      }
      if (it.baseRate < 0) {
        setFormError(`Item row #${i + 1} Base Rate cannot be negative.`);
        setEditorTab('items');
        return;
      }
    }

    const payload = {
      priceListCode: cleanCode,
      priceListName: cleanName,
      priceListType: formType,
      currencyCode: formCurrency,
      effectiveFrom: formEffectiveFrom,
      effectiveTo: formEffectiveTo || null,
      isDefault: formIsDefault,
      description: formDescription.trim() || null,
      isActive: formIsActive,
      items: formItems.map((it) => ({
        priceListItemId: it.priceListItemId,
        itemId: it.itemId,
        uomId: it.uomId,
        minQty: Number(it.minQty),
        maxQty: it.maxQty !== null ? Number(it.maxQty) : null,
        baseRate: Number(it.baseRate),
        discountPct: Number(it.discountPct || 0),
        effectiveRate: Number(it.effectiveRate),
        leadTimeDays: Number(it.leadTimeDays || 0),
        remarks: it.remarks?.trim() || null,
        isActive: it.isActive,
      })),
      assignedPartyIds: formAssignedPartyIds,
    };

    saveMutation.mutate(payload);
  };

  // --------------------------------------------------------------------------
  // CSV EXPORT & AUDIT
  // --------------------------------------------------------------------------

  const handleExportCSV = async () => {
    if (!filteredRows || filteredRows.length === 0) return;

    try {
      await apiClient.post('/price-lists/actions/log', {
        actionType: 'EXPORT',
      });
    } catch {
      // Non-blocking audit failure
    }

    const headers = [
      'Price List Code',
      'Price List Name',
      'Type',
      'Currency',
      'Effective From',
      'Effective To',
      'Is Default',
      'Items Count',
      'Assigned Counter-Parties',
      'Status',
      'Description',
    ];

    const rows = filteredRows.map((pl: PriceListHeaderRecord) => [
      `"${pl.priceListCode}"`,
      `"${pl.priceListName.replace(/"/g, '""')}"`,
      pl.priceListType,
      pl.currencyCode,
      pl.effectiveFrom,
      pl.effectiveTo || 'Open-Ended',
      pl.isDefault ? 'YES' : 'NO',
      pl.itemsCount,
      pl.assignedPartiesCount,
      pl.isActive ? 'Active' : 'Inactive',
      `"${(pl.description || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e: any[]) => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `KS_MFG_Price_Lists_${new Date().toISOString().slice(0, 10)}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --------------------------------------------------------------------------
  // PRINT ACTION & AUDIT
  // --------------------------------------------------------------------------

  const handlePrintClick = async (record: PriceListHeaderRecord) => {
    setPrintTarget(record);
    try {
      await apiClient.post('/price-lists/actions/log', {
        actionType: 'PRINT',
      });
    } catch {
      // Non-blocking
    }
  };

  // --------------------------------------------------------------------------
  // TABLE DATA & FILTERING
  // --------------------------------------------------------------------------

  const filteredRows = useMemo(() => {
    return priceLists.filter((r) => {
      if (defaultOnly && !r.isDefault) return false;
      return true;
    });
  }, [priceLists, defaultOnly]);

  const searchPredicate = (row: PriceListHeaderRecord, query: string) => {
    const q = query.toLowerCase();
    return (
      row.priceListCode.toLowerCase().includes(q) ||
      row.priceListName.toLowerCase().includes(q) ||
      (row.description && row.description.toLowerCase().includes(q)) ||
      row.priceListType.toLowerCase().includes(q)
    );
  };

  const columns: MasterTableColumn<PriceListHeaderRecord>[] = [
    {
      key: 'priceListCode',
      header: 'Code & Name',
      sortable: true,
      sortValue: (row: PriceListHeaderRecord) => row.priceListCode,
      render: (row: PriceListHeaderRecord) => (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
              {row.priceListCode}
            </span>
            {row.isDefault && (
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                Default
              </span>
            )}
          </div>
          <span className="text-sm font-medium text-foreground mt-0.5">
            {row.priceListName}
          </span>
          {row.description && (
            <span className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">
              {row.description}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'priceListType',
      header: 'Contract Type',
      sortable: true,
      sortValue: (row: PriceListHeaderRecord) => row.priceListType,
      render: (row: PriceListHeaderRecord) => {
        const meta = PRICE_LIST_TYPE_META[row.priceListType] || {
          label: row.priceListType,
          badgeClass: 'bg-muted text-muted-foreground',
          icon: Tag,
        };
        const Icon = meta.icon;
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${meta.badgeClass}`}
          >
            <Icon className="w-3.5 h-3.5" />
            {meta.label}
          </span>
        );
      },
    },
    {
      key: 'validity',
      header: 'Validity Period',
      sortable: true,
      sortValue: (row: PriceListHeaderRecord) => row.effectiveFrom,
      render: (row: PriceListHeaderRecord) => (
        <div className="flex flex-col text-xs font-mono text-foreground">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3 text-muted-foreground" />
            {row.effectiveFrom}
          </span>
          <span className="text-muted-foreground flex items-center gap-1 mt-0.5">
            <span className="text-muted-foreground">to</span>
            {row.effectiveTo ? row.effectiveTo : 'Open-Ended'}
          </span>
        </div>
      ),
    },
    {
      key: 'currencyCode',
      header: 'Currency',
      sortable: true,
      sortValue: (row: PriceListHeaderRecord) => row.currencyCode,
      render: (row: PriceListHeaderRecord) => (
        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-muted text-foreground border border-border">
          {row.currencyCode}
        </span>
      ),
    },
    {
      key: 'itemsCount',
      header: 'Tiered Items',
      sortable: true,
      sortValue: (row: PriceListHeaderRecord) => row.itemsCount,
      render: (row: PriceListHeaderRecord) => (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20">
          <Layers className="w-3 h-3" />
          {row.itemsCount} SKUs
        </span>
      ),
    },
    {
      key: 'assignedPartiesCount',
      header: 'Assigned Parties',
      sortable: true,
      sortValue: (row: PriceListHeaderRecord) => row.assignedPartiesCount,
      render: (row: PriceListHeaderRecord) => (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">
          <Users className="w-3 h-3" />
          {row.assignedPartiesCount} Parties
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      sortable: true,
      sortValue: (row: PriceListHeaderRecord) => (row.isActive ? 1 : 0),
      render: (row: PriceListHeaderRecord) => (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
            row.isActive
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              row.isActive ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          />
          {row.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  const groupByOptions: GroupByOption<PriceListHeaderRecord>[] = [
    {
      key: 'priceListType',
      label: 'Contract Type',
      groupValue: (row: PriceListHeaderRecord) =>
        PRICE_LIST_TYPE_META[row.priceListType]?.label || row.priceListType,
    },
    {
      key: 'currencyCode',
      label: 'Currency',
      groupValue: (row: PriceListHeaderRecord) => row.currencyCode,
    },
    {
      key: 'status',
      label: 'Status',
      groupValue: (row: PriceListHeaderRecord) =>
        row.isActive ? 'Active Contracts' : 'Inactive / Expired',
    },
  ];

  // --------------------------------------------------------------------------
  // RENDER
  // --------------------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* 1. TOP 4 KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Price Lists */}
        <div className="p-5 bg-card border border-border rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Master Contracts</span>
            <div className="p-2 bg-blue-500/10 text-blue-600 rounded-lg">
              <Tag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {isSummaryLoading ? '...' : summary?.totalPriceLists ?? priceLists.length}
            </span>
            <span className="text-xs text-muted-foreground">rate cards</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Across discrete & subcontracting scope</p>
        </div>

        {/* Sales Rate Cards */}
        <div className="p-5 bg-card border border-border rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Sales Rate Cards</span>
            <div className="p-2 bg-indigo-500/10 text-indigo-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {isSummaryLoading ? '...' : summary?.salesCount ?? 0}
            </span>
            <span className="text-xs text-muted-foreground">customer catalogues</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">OEMs, distributors & retail tiers</p>
        </div>

        {/* Vendor Rate Contracts */}
        <div className="p-5 bg-card border border-border rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Vendor Rate Contracts</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-600 rounded-lg">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {isSummaryLoading ? '...' : summary?.purchaseCount ?? 0}
            </span>
            <span className="text-xs text-muted-foreground">procurement contracts</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">Raw materials, tools & consumables</p>
        </div>

        {/* Job-Work Rate Cards */}
        <div className="p-5 bg-card border border-border rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Job-Work & Machining</span>
            <div className="p-2 bg-amber-500/10 text-amber-600 rounded-lg">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {isSummaryLoading ? '...' : summary?.jobWorkCount ?? 0}
            </span>
            <span className="text-xs text-muted-foreground">subcontractor cards</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {isSummaryLoading ? '...' : summary?.activeItemsCount ?? 0} active SKU rate brackets
          </p>
        </div>
      </div>

      {/* 2. FILTER TOOLBAR */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border p-3.5 rounded-xl shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setTypeFilter('ALL')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              typeFilter === 'ALL'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            All Price Lists ({priceLists.length})
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('SALES')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              typeFilter === 'SALES'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            Sales Rate Cards
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('PURCHASE')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              typeFilter === 'PURCHASE'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            Vendor Rate Contracts
          </button>
          <button
            type="button"
            onClick={() => setTypeFilter('JOB_WORK')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              typeFilter === 'JOB_WORK'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            Job-Work Subcontracting
          </button>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={defaultOnly}
              onChange={(e) => setDefaultOnly(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
            />
            <span>Default Lists Only</span>
          </label>

          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
            />
            <span>Active Contracts Only</span>
          </label>
        </div>
      </div>

      {/* 3. MASTER DATA TABLE */}
      <MasterDataTable<PriceListHeaderRecord>
        title="Tiered Price Lists & Vendor Rate Contracts"
        subtitle="Commercial rate cards, quantity break discounts & trading partner mappings"
        screenCode="PRICE_LIST"
        tableNameBadge="tbl_crm_price_list"
        data={filteredRows}
        rowKey={(row) => row.priceListId}
        columns={columns}
        searchPlaceholder="Search price list code, name, description or contract type..."
        searchPredicate={searchPredicate}
        groupByOptions={groupByOptions}
        addButtonLabel="New Price List / Contract"
        onAddClick={openNewEditor}
        onExportClick={handleExportCSV}
        pageSize={10}
        isLoading={isPriceListsLoading}
        renderRowActions={(row: PriceListHeaderRecord) => (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handlePrintClick(row)}
              title="Print Rate Card"
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
            >
              <Printer className="w-4 h-4" />
            </button>
            <PermissionGate screen="PRICE_LIST" action="EDIT">
              <button
                type="button"
                onClick={() => openEditEditor(row)}
                title="Edit Price List"
                className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-md transition-colors"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            </PermissionGate>
            <PermissionGate screen="PRICE_LIST" action="DELETE">
              <button
                type="button"
                onClick={() => {
                  setDeleteTarget(row);
                  setDeleteError(null);
                  setDeleteDependencies([]);
                }}
                title="Delete Price List"
                className="p-1.5 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-md transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </PermissionGate>
          </div>
        )}
      />

      {/* 4. CREATE / EDIT MULTI-TAB MODAL */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">
                    {editingId ? `Edit Price List: ${formCode}` : 'Create Price List & Rate Contract'}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Configure commercial parameters, volume discount brackets, and assigned
                    counter-parties.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-1 px-6 pt-3 border-b border-border bg-card">
              <button
                type="button"
                onClick={() => setEditorTab('header')}
                className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  editorTab === 'header'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                1. Header & Validity
              </button>
              <button
                type="button"
                onClick={() => setEditorTab('items')}
                className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  editorTab === 'items'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                2. Tiered Rate Brackets ({formItems.length})
              </button>
              <button
                type="button"
                onClick={() => setEditorTab('parties')}
                className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  editorTab === 'parties'
                    ? 'border-primary text-primary font-semibold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                3. Assigned Counter-Parties ({formAssignedPartyIds.length})
              </button>
            </div>

            {/* Error Notification */}
            {formError && (
              <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Modal Content */}
            <form onSubmit={handleSubmitSave} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* TAB 1: HEADER & VALIDITY */}
              {editorTab === 'header' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Price List Code <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formCode}
                        onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                        placeholder="e.g. PL-OEM-MARUTI-2026"
                        className="w-full px-3 py-2 text-xs font-mono uppercase bg-background border border-border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
                        required
                      />
                      <span className="text-[10px] text-muted-foreground">
                        Unique identifier per company.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Contract / List Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g. Maruti Suzuki OEM Tier-1 Rate Card"
                        className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Contract Type <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formType}
                        onChange={(e) => setFormType(e.target.value as PriceListType)}
                        className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
                      >
                        <option value="SALES">Sales Rate Card (Customers)</option>
                        <option value="PURCHASE">Purchase Contract (Vendors)</option>
                        <option value="JOB_WORK">Job-Work Machining Card</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Currency <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={formCurrency}
                        onChange={(e) => setFormCurrency(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
                      >
                        <option value="INR">INR (₹ - Indian Rupee)</option>
                        <option value="USD">USD ($ - US Dollar)</option>
                        <option value="EUR">EUR (€ - Euro)</option>
                        <option value="GBP">GBP (£ - British Pound)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Default Baseline List?
                      </label>
                      <div className="pt-2">
                        <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formIsDefault}
                            onChange={(e) => setFormIsDefault(e.target.checked)}
                            className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                          />
                          <span>Company Default List</span>
                        </label>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        Auto-applied when no party-specific contract exists.
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Effective From Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formEffectiveFrom}
                        onChange={(e) => setFormEffectiveFrom(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1">
                        Effective To Date (Expiry)
                      </label>
                      <input
                        type="date"
                        value={formEffectiveTo}
                        onChange={(e) => setFormEffectiveTo(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
                      />
                      <span className="text-[10px] text-muted-foreground">
                        Leave blank for open-ended perpetual agreement.
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Description & Commercial Terms Notes
                    </label>
                    <textarea
                      rows={3}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Special commercial terms, freight inclusions, packaging guidelines, or annual escalation clauses..."
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg focus:outline-hidden focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                      />
                      <span className="font-medium">Active Price List</span>
                    </label>
                  </div>
                </div>
              )}

              {/* TAB 2: TIERED RATE BRACKETS */}
              {editorTab === 'items' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-foreground">
                        Line Items, Base Rates & Volume Discount Tiers
                      </h3>
                      <p className="text-[11px] text-muted-foreground">
                        Define tiered pricing brackets based on order batch quantity. Effective
                        Rate = Base Rate - (Base Rate × Discount %).
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddItemRow}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Item / Tier
                    </button>
                  </div>

                  {formItems.length === 0 ? (
                    <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
                      <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                      <p className="text-xs font-medium text-foreground">No rate items added yet.</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Click "Add Item / Tier" to start configuring item rates and volume discount
                        brackets.
                      </p>
                      <button
                        type="button"
                        onClick={handleAddItemRow}
                        className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary/90"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add First Item
                      </button>
                    </div>
                  ) : (
                    <div className="border border-border rounded-lg overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-muted/50 border-b border-border text-muted-foreground">
                            <th className="py-2.5 px-3 font-semibold min-w-[200px]">Item SKU</th>
                            <th className="py-2.5 px-2 font-semibold min-w-[90px]">UOM</th>
                            <th className="py-2.5 px-2 font-semibold min-w-[90px]">Min Qty</th>
                            <th className="py-2.5 px-2 font-semibold min-w-[90px]">Max Qty</th>
                            <th className="py-2.5 px-2 font-semibold min-w-[100px]">Base Rate (₹)</th>
                            <th className="py-2.5 px-2 font-semibold min-w-[90px]">Disc %</th>
                            <th className="py-2.5 px-2 font-semibold min-w-[110px]">Effective (₹)</th>
                            <th className="py-2.5 px-2 font-semibold min-w-[80px]">Lead Days</th>
                            <th className="py-2.5 px-2 font-semibold min-w-[120px]">Remarks</th>
                            <th className="py-2.5 px-2 text-center w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {formItems.map((it, idx) => (
                            <tr key={idx} className="hover:bg-muted/20">
                              {/* Item SKU Dropdown */}
                              <td className="p-2">
                                <select
                                  value={it.itemId}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, { itemId: Number(e.target.value) })
                                  }
                                  className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:outline-hidden focus:ring-1 focus:ring-primary"
                                >
                                  {itemsCatalog.map((x) => (
                                    <option key={x.itemId} value={x.itemId}>
                                      {x.itemCode} - {x.itemName}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* UOM Dropdown */}
                              <td className="p-2">
                                <select
                                  value={it.uomId}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, { uomId: Number(e.target.value) })
                                  }
                                  className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:outline-hidden focus:ring-1 focus:ring-primary"
                                >
                                  {uomsCatalog.map((u) => (
                                    <option key={u.uomId} value={u.uomId}>
                                      {u.uomCode}
                                    </option>
                                  ))}
                                </select>
                              </td>

                              {/* Min Qty */}
                              <td className="p-2">
                                <input
                                  type="number"
                                  step="any"
                                  min="0.001"
                                  value={it.minQty}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, { minQty: Number(e.target.value) })
                                  }
                                  className="w-full px-2 py-1 text-xs font-mono text-right bg-background border border-border rounded focus:outline-hidden focus:ring-1 focus:ring-primary"
                                />
                              </td>

                              {/* Max Qty */}
                              <td className="p-2">
                                <input
                                  type="number"
                                  step="any"
                                  placeholder="∞"
                                  value={it.maxQty === null ? '' : it.maxQty}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, {
                                      maxQty: e.target.value === '' ? null : Number(e.target.value),
                                    })
                                  }
                                  className="w-full px-2 py-1 text-xs font-mono text-right bg-background border border-border rounded focus:outline-hidden focus:ring-1 focus:ring-primary"
                                />
                              </td>

                              {/* Base Rate */}
                              <td className="p-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={it.baseRate}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, { baseRate: Number(e.target.value) })
                                  }
                                  className="w-full px-2 py-1 text-xs font-mono text-right bg-background border border-border rounded focus:outline-hidden focus:ring-1 focus:ring-primary"
                                />
                              </td>

                              {/* Discount % */}
                              <td className="p-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={it.discountPct}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, { discountPct: Number(e.target.value) })
                                  }
                                  className="w-full px-2 py-1 text-xs font-mono text-right bg-background border border-border rounded focus:outline-hidden focus:ring-1 focus:ring-primary"
                                />
                              </td>

                              {/* Computed Effective Rate */}
                              <td className="p-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={it.effectiveRate}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, {
                                      effectiveRate: Number(e.target.value),
                                    })
                                  }
                                  className="w-full px-2 py-1 text-xs font-mono font-bold text-right bg-muted/40 border border-border rounded focus:outline-hidden focus:ring-1 focus:ring-primary"
                                />
                              </td>

                              {/* Lead Time Days */}
                              <td className="p-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={it.leadTimeDays}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, {
                                      leadTimeDays: Number(e.target.value),
                                    })
                                  }
                                  className="w-full px-2 py-1 text-xs font-mono text-right bg-background border border-border rounded focus:outline-hidden focus:ring-1 focus:ring-primary"
                                />
                              </td>

                              {/* Remarks */}
                              <td className="p-2">
                                <input
                                  type="text"
                                  value={it.remarks || ''}
                                  onChange={(e) =>
                                    handleUpdateItemRow(idx, { remarks: e.target.value })
                                  }
                                  placeholder="Batch remarks..."
                                  className="w-full px-2 py-1 text-xs bg-background border border-border rounded focus:outline-hidden focus:ring-1 focus:ring-primary"
                                />
                              </td>

                              {/* Remove Row */}
                              <td className="p-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItemRow(idx)}
                                  className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded"
                                  title="Remove item tier"
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
              )}

              {/* TAB 3: ASSIGNED COUNTER-PARTIES */}
              {editorTab === 'parties' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-xs font-bold text-foreground">
                      Associated Trading Partners ({eligibleParties.length} eligible)
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      Attach this price list directly to specific counter-parties. When processing
                      sales orders or purchase orders, the ERP prioritizes explicitly mapped rate
                      contracts.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto border border-border p-3 rounded-lg">
                    {eligibleParties.map((p) => {
                      const isSelected = formAssignedPartyIds.includes(p.partyId);
                      return (
                        <div
                          key={p.partyId}
                          onClick={() => handleToggleParty(p.partyId)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start gap-3 select-none ${
                            isSelected
                              ? 'bg-primary/10 border-primary/40 shadow-xs'
                              : 'bg-card border-border hover:bg-muted/40'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // handled by parent onClick
                            className="mt-0.5 rounded border-border text-primary focus:ring-primary h-4 w-4 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-xs font-bold text-foreground">
                                {p.partyCode}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground border border-border">
                                {p.partyGroup}
                              </span>
                            </div>
                            <p className="text-xs text-foreground font-medium truncate mt-0.5">
                              {p.partyName}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-4 border-t border-border flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {editorTab === 'header' && 'Next: Add tiered rate items or assign parties.'}
                  {editorTab === 'items' && `${formItems.length} tier brackets configured.`}
                  {editorTab === 'parties' &&
                    `${formAssignedPartyIds.length} partners associated with this list.`}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeEditor}
                    className="px-4 py-2 text-xs font-medium text-foreground bg-card hover:bg-muted border border-border rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveMutation.isPending}
                    className="px-5 py-2 text-xs font-semibold text-white bg-primary hover:bg-primary/90 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                  >
                    {saveMutation.isPending ? 'Saving Contract...' : 'Save Price List'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. PRINT / RATE CARD SPECIFICATION DATASHEET MODAL */}
      {printTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl my-8 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-primary" />
                <h3 className="text-base font-bold text-foreground">
                  Rate Card Datasheet Preview: {printTarget.priceListCode}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-primary rounded-lg hover:bg-primary/90"
                >
                  <Printer className="w-3.5 h-3.5" /> Print Rate Card
                </button>
                <button
                  type="button"
                  onClick={() => setPrintTarget(null)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-md"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 print:p-0 print:m-0">
              {/* Industrial Datasheet Header */}
              <div className="border-b-2 border-primary pb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-foreground uppercase">
                    Kashvira Manufacturing ERP
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    Discrete & Process Manufacturing Division • Plant Operations
                  </p>
                  <h2 className="text-base font-semibold text-primary mt-2">
                    {printDetailData?.priceListName || printTarget.priceListName}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Contract Code: <span className="font-mono font-bold text-foreground">{printTarget.priceListCode}</span>
                  </p>
                </div>
                <div className="text-right text-xs space-y-1">
                  <div>
                    <span className="font-semibold text-muted-foreground">Contract Type: </span>
                    <span className="font-bold text-foreground">{printTarget.priceListType}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Base Currency: </span>
                    <span className="font-bold font-mono text-foreground">{printTarget.currencyCode}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Validity: </span>
                    <span className="font-mono text-foreground">
                      {printTarget.effectiveFrom} to {printTarget.effectiveTo || 'Perpetual'}
                    </span>
                  </div>
                  <div>
                    <span className="font-semibold text-muted-foreground">Status: </span>
                    <span className="font-bold text-emerald-600">
                      {printTarget.isActive ? 'Active Contract' : 'Inactive'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Description */}
              {printTarget.description && (
                <div className="p-3 bg-muted/30 border border-border rounded-lg text-xs text-muted-foreground">
                  <span className="font-bold text-foreground">Commercial Agreement Notes: </span>
                  {printTarget.description}
                </div>
              )}

              {/* Items Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-primary" />
                  Item Rates & Volume Discount Brackets
                </h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-muted text-muted-foreground border-b border-border">
                        <th className="py-2 px-3 font-semibold">SKU Code</th>
                        <th className="py-2 px-3 font-semibold">Item Description</th>
                        <th className="py-2 px-2 font-semibold">UOM</th>
                        <th className="py-2 px-2 font-semibold text-right">Min Qty</th>
                        <th className="py-2 px-2 font-semibold text-right">Max Qty</th>
                        <th className="py-2 px-2 font-semibold text-right">Base Rate ({printTarget.currencyCode})</th>
                        <th className="py-2 px-2 font-semibold text-right">Disc %</th>
                        <th className="py-2 px-3 font-semibold text-right">Effective Rate ({printTarget.currencyCode})</th>
                        <th className="py-2 px-2 font-semibold text-right">Lead Days</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border font-mono">
                      {isPrintLoading ? (
                        <tr>
                          <td colSpan={9} className="py-6 text-center text-muted-foreground">
                            Loading items...
                          </td>
                        </tr>
                      ) : !printDetailData?.items || printDetailData.items.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="py-6 text-center text-muted-foreground">
                            No items registered in this price list.
                          </td>
                        </tr>
                      ) : (
                        printDetailData.items.map((it, idx) => (
                          <tr key={idx} className="hover:bg-muted/10">
                            <td className="py-2 px-3 font-bold text-primary">{it.itemCode}</td>
                            <td className="py-2 px-3 font-sans text-foreground">{it.itemName}</td>
                            <td className="py-2 px-2 text-muted-foreground">{it.uomCode}</td>
                            <td className="py-2 px-2 text-right">{it.minQty}</td>
                            <td className="py-2 px-2 text-right">{it.maxQty ?? '∞'}</td>
                            <td className="py-2 px-2 text-right">{Number(it.baseRate).toFixed(2)}</td>
                            <td className="py-2 px-2 text-right text-emerald-600 font-bold">
                              {Number(it.discountPct) > 0 ? `${it.discountPct}%` : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-foreground">
                              {Number(it.effectiveRate).toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-right text-muted-foreground">
                              {it.leadTimeDays ? `${it.leadTimeDays}d` : '—'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Assigned Parties Section */}
              {printDetailData?.assignedParties && printDetailData.assignedParties.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    Authorized Trading Counter-Parties
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    {printDetailData.assignedParties.map((p, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-muted/20 border border-border rounded flex flex-col"
                      >
                        <span className="font-mono font-bold text-primary">{p.partyCode}</span>
                        <span className="text-foreground truncate">{p.partyName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Sign-off */}
              <div className="pt-8 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
                <span>System Generated Rate Contract • Kashvira Infotech KS-MFG</span>
                <span>Authorized Signatory: _________________________</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. CONFIRM DELETE MODAL */}
      {deleteTarget && (
        <ConfirmDeleteModal
          isOpen={true}
          entityType="Price List / Rate Contract"
          entityName={deleteTarget.priceListName}
          entityCode={deleteTarget.priceListCode}
          isDeleting={deleteMutation.isPending}
          errorMessage={deleteError}
          dependencies={deleteDependencies}
          onConfirm={() => deleteMutation.mutate(deleteTarget.priceListId)}
          onClose={() => {
            setDeleteTarget(null);
            setDeleteError(null);
            setDeleteDependencies([]);
          }}
        />
      )}
    </div>
  );
};

export default PriceListMasterPage;
