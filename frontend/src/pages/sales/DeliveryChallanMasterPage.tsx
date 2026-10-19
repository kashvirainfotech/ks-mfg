import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Building2,
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
  HelpCircle,
  Layers,
  ListChecks,
  MapPin,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Tag,
  Trash2,
  TrendingUp,
  Truck,
  User,
  Users,
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
import { ConfirmDeleteModal } from '../../components/common/ConfirmDeleteModal';
import { PermissionGate } from '../../components/common/PermissionGate';

// ----------------------------------------------------------------------------
// Top-Level Helper Functions
// ----------------------------------------------------------------------------
const formatInr = (val: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val || 0);

const formatInrDecimals = (val: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(val || 0);

const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return isNaN(d.getTime())
      ? dateStr
      : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
};

// ----------------------------------------------------------------------------
// Interfaces & Types
// ----------------------------------------------------------------------------
interface ChallanSummary {
  totalChallans: number;
  dispatchedCount: number;
  dispatchedValue: number;
  pendingDispatchCount: number;
  packedCount: number;
  pickedCount: number;
  deliveredCount: number;
  totalChallanValue: number;
}

interface ChallanItem {
  challan_item_id?: number;
  challan_id?: number;
  so_item_id?: number | null;
  item_sequence: number;
  item_id: number;
  item_code: string;
  item_name: string;
  description?: string | null;
  hsn_sac_code?: string | null;
  uom_id: number;
  uom_code?: string;
  ordered_qty: number;
  dispatched_qty: number;
  warehouse_id: number;
  warehouse_name?: string;
  bin_id?: number | null;
  bin_code?: string | null;
  batch_no?: string | null;
  heat_no?: string | null;
  unit_rate: number;
  total_amount: number;
  remarks?: string | null;
  original_so_ordered_qty?: number;
  original_so_delivered_qty?: number;
}

interface DeliveryChallan {
  challan_id: number;
  challan_no: string;
  challan_date: string;
  so_id?: number | null;
  so_no?: string | null;
  customer_id: number;
  customer_name: string;
  contact_person?: string | null;
  contact_phone?: string | null;
  billing_address_id?: number | null;
  billing_address?: string | null;
  shipping_address_id?: number | null;
  shipping_address?: string | null;
  shipping_state_code: string;
  shipping_state_name: string;
  customer_gstin?: string | null;
  dispatch_purpose: string;
  transporter_id?: number | null;
  transporter_name?: string | null;
  vehicle_no?: string | null;
  lr_rr_no?: string | null;
  lr_rr_date?: string | null;
  e_way_bill_no?: string | null;
  e_way_bill_date?: string | null;
  delivery_terms: string;
  total_packages: number;
  package_type: string;
  gross_weight_kg: number;
  net_weight_kg: number;
  warehouse_id: number;
  warehouse_name?: string;
  total_quantity: number;
  total_value: number;
  status: 'DRAFT' | 'PICKED' | 'PACKED' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  picked_by?: number | null;
  picked_by_name?: string | null;
  picked_at?: string | null;
  packed_by?: number | null;
  packed_by_name?: string | null;
  packed_at?: string | null;
  dispatched_by?: number | null;
  dispatched_by_name?: string | null;
  dispatched_at?: string | null;
  delivered_at?: string | null;
  remarks?: string | null;
  terms_and_conditions?: string | null;
  item_count?: number;
  items?: ChallanItem[];
  customer_po_no?: string | null;
  customer_po_date?: string | null;
}

interface CustomerParty {
  party_id: number;
  party_code: string;
  party_name: string;
  credit_limit: number;
  credit_days: number;
  payment_terms: string;
  primary_contact_name?: string;
  primary_phone?: string;
}

interface CustomerAddress {
  address_id: number;
  party_id: number;
  address_type: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state_code: string;
  state_name: string;
  pin_code: string;
  gstin?: string;
  is_default: boolean;
}

interface TransporterParty {
  party_id: number;
  party_code: string;
  party_name: string;
  primary_contact_name?: string;
  primary_phone?: string;
}

interface WarehouseOption {
  warehouse_id: number;
  warehouse_code: string;
  warehouse_name: string;
}

interface StorageBinOption {
  bin_id: number;
  bin_code: string;
  bin_name: string;
  warehouse_id: number;
  item_id: number;
  on_hand_qty: number;
  reserved_qty: number;
  available_qty: number;
  batch_no?: string;
  heat_no?: string;
}

interface SellableItem {
  item_id: number;
  item_code: string;
  item_name: string;
  hsn_sac_code?: string;
  uom_id: number;
  uom_code: string;
  standard_rate: number;
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
}

interface ActiveSalesOrder {
  so_id: number;
  so_no: string;
  so_date: string;
  customer_id: number;
  customer_name: string;
  customer_po_no?: string;
  customer_po_date?: string;
  shipping_address_id?: number;
  shipping_address?: string;
  shipping_state_code: string;
  shipping_state_name: string;
  delivery_terms: string;
  status: string;
  atp_reservation_status: string;
}

interface ActiveSalesOrderItem {
  so_item_id: number;
  so_id: number;
  item_sequence: number;
  item_id: number;
  item_code: string;
  item_name: string;
  description?: string;
  hsn_sac_code?: string;
  uom_id: number;
  uom_code: string;
  ordered_qty: number;
  reserved_qty: number;
  delivered_qty: number;
  pending_qty: number;
  unit_rate: number;
  reservation_status: string;
}

interface ChallanLookups {
  customers: CustomerParty[];
  addresses: CustomerAddress[];
  transporters: TransporterParty[];
  warehouses: WarehouseOption[];
  storageBins: StorageBinOption[];
  items: SellableItem[];
  salesOrders: ActiveSalesOrder[];
  salesOrderItems: ActiveSalesOrderItem[];
  branch: {
    branch_id: number;
    branch_code: string;
    branch_name: string;
    state_code: string;
    state_name: string;
    gstin: string;
  } | null;
}

// ----------------------------------------------------------------------------
// Badge Colors & Status Renderers
// ----------------------------------------------------------------------------
const getStatusBadge = (status: string) => {
  switch (status) {
    case 'DRAFT':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          Draft Slip
        </span>
      );
    case 'PICKED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
          <ListChecks className="w-3.5 h-3.5 text-blue-600" />
          Stock Picked
        </span>
      );
    case 'PACKED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
          <PackageCheck className="w-3.5 h-3.5 text-purple-600" />
          Packed & Staged
        </span>
      );
    case 'DISPATCHED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          <Truck className="w-3.5 h-3.5 text-emerald-600" />
          Dispatched (Outward)
        </span>
      );
    case 'DELIVERED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
          <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
          Delivered
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
          <XCircle className="w-3.5 h-3.5 text-rose-500" />
          Cancelled
        </span>
      );
    default:
      return <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">{status}</span>;
  }
};

const getPurposeBadge = (purpose: string) => {
  switch (purpose) {
    case 'SUPPLY_ON_SALE':
      return <span className="px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-800 font-medium">Supply on Sale</span>;
    case 'SAMPLE_DEMO':
      return <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-800 font-medium">Sample / Demo</span>;
    case 'JOB_WORK_RETURN':
      return <span className="px-2 py-0.5 rounded text-xs bg-indigo-100 text-indigo-800 font-medium">Job-Work Return</span>;
    case 'EXHIBITION':
      return <span className="px-2 py-0.5 rounded text-xs bg-purple-100 text-purple-800 font-medium">Exhibition</span>;
    case 'APPROVAL_BASIS':
      return <span className="px-2 py-0.5 rounded text-xs bg-cyan-100 text-cyan-800 font-medium">Approval Basis</span>;
    default:
      return <span className="px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-800">{purpose}</span>;
  }
};

// ----------------------------------------------------------------------------
// Main Page Component
// ----------------------------------------------------------------------------
export const DeliveryChallanMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters & State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals & Drawers state
  const [selectedChallanId, setSelectedChallanId] = useState<number | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [isPickOpen, setIsPickOpen] = useState<boolean>(false);
  const [isPackOpen, setIsPackOpen] = useState<boolean>(false);
  const [isDispatchOpen, setIsDispatchOpen] = useState<boolean>(false);
  const [isPrintOpen, setIsPrintOpen] = useState<boolean>(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState<boolean>(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<boolean>(false);

  // Queries
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery<ApiResponse<ChallanSummary>>({
    queryKey: ['delivery-challans-summary'],
    queryFn: async () => {
      const res = await apiClient.get('/sales/delivery-challans/summary');
      return res.data;
    },
  });

  const { data: lookupsData } = useQuery<ApiResponse<ChallanLookups>>({
    queryKey: ['delivery-challans-lookups'],
    queryFn: async () => {
      const res = await apiClient.get('/sales/delivery-challans/lookups');
      return res.data;
    },
  });

  const {
    data: challansData,
    isLoading: isChallansLoading,
    refetch: refetchChallans,
  } = useQuery<ApiResponse<{ data: DeliveryChallan[]; meta: any }>>({
    queryKey: ['delivery-challans-list', statusFilter, customerFilter, searchTerm],
    queryFn: async () => {
      const params: any = { limit: 100 };
      if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;
      if (customerFilter) params.customerId = customerFilter;
      if (searchTerm) params.search = searchTerm;
      const res = await apiClient.get('/sales/delivery-challans', { params });
      return res.data;
    },
  });

  const { data: activeChallanData, isLoading: isActiveChallanLoading } = useQuery<
    ApiResponse<DeliveryChallan>
  >({
    queryKey: ['delivery-challan-detail', selectedChallanId],
    queryFn: async () => {
      if (!selectedChallanId) return null as any;
      const res = await apiClient.get(`/sales/delivery-challans/${selectedChallanId}`);
      return res.data;
    },
    enabled: !!selectedChallanId,
  });

  const summary = summaryData?.data;
  const lookups = lookupsData?.data;
  const challanList = challansData?.data?.data || [];
  const activeChallan = activeChallanData?.data;

  // Actions Mutations
  const pickMutation = useMutation({
    mutationFn: async ({ id, remarks }: { id: number; remarks?: string }) => {
      const res = await apiClient.post(`/sales/delivery-challans/${id}/pick`, { remarks });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-challans-list'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-challans-summary'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-challan-detail', selectedChallanId] });
      setIsPickOpen(false);
    },
  });

  const packMutation = useMutation({
    mutationFn: async (payload: {
      id: number;
      totalPackages: number;
      packageType: string;
      grossWeightKg: number;
      netWeightKg: number;
      remarks?: string;
    }) => {
      const res = await apiClient.post(`/sales/delivery-challans/${payload.id}/pack`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-challans-list'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-challans-summary'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-challan-detail', selectedChallanId] });
      setIsPackOpen(false);
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: async (payload: {
      id: number;
      vehicleNo?: string;
      transporterId?: number;
      transporterName?: string;
      lrRrNo?: string;
      lrRrDate?: string;
      eWayBillNo?: string;
      eWayBillDate?: string;
      remarks?: string;
    }) => {
      const res = await apiClient.post(`/sales/delivery-challans/${payload.id}/dispatch`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-challans-list'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-challans-summary'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-challans-lookups'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-challan-detail', selectedChallanId] });
      setIsDispatchOpen(false);
    },
  });

  const deliverMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.post(`/sales/delivery-challans/${id}/deliver`, {});
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-challans-list'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-challans-summary'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-challan-detail', selectedChallanId] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.post(`/sales/delivery-challans/${id}/cancel`, {});
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-challans-list'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-challans-summary'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-challans-lookups'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-challan-detail', selectedChallanId] });
      setIsCancelConfirmOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete(`/sales/delivery-challans/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-challans-list'] });
      queryClient.invalidateQueries({ queryKey: ['delivery-challans-summary'] });
      setIsDeleteConfirmOpen(false);
      setSelectedChallanId(null);
    },
  });

  // MasterDataTable Columns
  const columns: MasterTableColumn<DeliveryChallan>[] = useMemo(
    () => [
      {
        key: 'challan_no',
        header: 'Challan No & Date',
        sortable: true,
        render: (row) => (
          <div>
            <div className="font-semibold text-primary hover:underline cursor-pointer flex items-center gap-1.5"
                 onClick={() => { setSelectedChallanId(row.challan_id); setIsDetailsOpen(true); }}>
              <Truck className="w-4 h-4 text-emerald-600" />
              {row.challan_no}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Calendar className="w-3 h-3" />
              {formatDate(row.challan_date)}
            </div>
          </div>
        ),
      },
      {
        key: 'so_no',
        header: 'Sales Order Ref',
        sortable: true,
        render: (row) =>
          row.so_no ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <FileText className="w-3 h-3" />
              {row.so_no}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground italic">Direct Dispatch</span>
          ),
      },
      {
        key: 'customer_name',
        header: 'Customer (Consignee)',
        sortable: true,
        render: (row) => (
          <div className="max-w-xs">
            <div className="font-medium text-foreground truncate" title={row.customer_name}>
              {row.customer_name}
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-slate-400" />
              {row.shipping_state_name} ({row.shipping_state_code})
            </div>
          </div>
        ),
      },
      {
        key: 'dispatch_purpose',
        header: 'Purpose',
        sortable: true,
        render: (row) => getPurposeBadge(row.dispatch_purpose),
      },
      {
        key: 'vehicle_no',
        header: 'Logistics & Vehicle',
        sortable: true,
        render: (row) => (
          <div className="text-xs">
            <div className="font-medium text-foreground">
              {row.vehicle_no ? row.vehicle_no : <span className="text-muted-foreground italic">Not Assigned</span>}
            </div>
            <div className="text-muted-foreground truncate max-w-[150px]" title={row.transporter_name || ''}>
              {row.transporter_name || 'Own Fleet / Local'}
            </div>
          </div>
        ),
      },
      {
        key: 'total_packages',
        header: 'Packages & Weight',
        sortable: true,
        render: (row) => (
          <div className="text-xs">
            <div className="font-semibold text-foreground">
              {row.total_packages} {row.package_type}
            </div>
            <div className="text-muted-foreground">
              {row.gross_weight_kg > 0 ? `${row.gross_weight_kg.toFixed(1)} kg Gr.` : 'Weight pending'}
            </div>
          </div>
        ),
      },
      {
        key: 'total_quantity',
        header: 'Total Qty',
        sortable: true,
        render: (row) => (
          <div className="text-right font-medium">
            {row.total_quantity.toLocaleString('en-IN', { maximumFractionDigits: 1 })} units
          </div>
        ),
      },
      {
        key: 'total_value',
        header: 'Challan Value',
        sortable: true,
        render: (row) => (
          <div className="text-right font-semibold text-foreground">
            {formatInr(row.total_value)}
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (row) => getStatusBadge(row.status),
      },
    ],
    [],
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 rounded-lg text-emerald-600">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Outward Delivery Challan & Dispatch
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                  Rule 55 CGST
                </span>
              </h1>
              <p className="text-sm text-muted-foreground">
                Warehouse pick slips, packing verification, gate outward transport dispatch & real-time stock ledger deduction
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetchChallans()}
            className="p-2 border border-border rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Refresh Register"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <PermissionGate screen="DELIVERY_CHALLAN" action="ADD">
            <button
              onClick={() => {
                setSelectedChallanId(null);
                setIsCreateOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 transition shadow-sm text-sm"
            >
              <Plus className="w-4 h-4" />
              New Delivery Challan
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Total Challans</span>
            <FileSpreadsheet className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold text-foreground mt-2">
            {summary?.totalChallans ?? 0}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Total: {formatInr(summary?.totalChallanValue || 0)}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Dispatched Outward</span>
            <Truck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 mt-2">
            {summary?.dispatchedCount ?? 0}
          </div>
          <div className="text-xs text-emerald-600/80 mt-1">
            Value: {formatInr(summary?.dispatchedValue || 0)}
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Pending Dispatch</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 mt-2">
            {summary?.pendingDispatchCount ?? 0}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            In Pick / Pack queue
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Packed & Staged</span>
            <PackageCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-purple-600 mt-2">
            {summary?.packedCount ?? 0}
          </div>
          <div className="text-xs text-purple-600/80 mt-1">
            Ready for vehicle gate-out
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground text-xs font-medium">
            <span>Customer Delivered</span>
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-bold text-teal-600 mt-2">
            {summary?.deliveredCount ?? 0}
          </div>
          <div className="text-xs text-teal-600/80 mt-1">
            Proof of delivery logged
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Tabs */}
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/40">
            {['ALL', 'DRAFT', 'PICKED', 'PACKED', 'DISPATCHED', 'DELIVERED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === st
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {st === 'ALL' ? 'All Challans' : st}
              </button>
            ))}
          </div>

          {/* Customer Dropdown */}
          <select
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="text-xs border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">All Customers</option>
            {lookups?.customers.map((c) => (
              <option key={c.party_id} value={c.party_id}>
                {c.party_name}
              </option>
            ))}
          </select>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search challan, SO, customer, vehicle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Main Register Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <MasterDataTable<DeliveryChallan>
          title="Outward Delivery Challan Register"
          subtitle="Physical shipment log, vehicle gate outward clearances and warehouse inventory issues"
          screenCode="DELIVERY_CHALLAN"
          data={challanList}
          rowKey={(row) => row.challan_id}
          columns={columns}
          isLoading={isChallansLoading}
          searchPredicate={(row, query) =>
            row.challan_no.toLowerCase().includes(query.toLowerCase()) ||
            row.customer_name.toLowerCase().includes(query.toLowerCase()) ||
            (row.so_no?.toLowerCase().includes(query.toLowerCase()) ?? false) ||
            (row.vehicle_no?.toLowerCase().includes(query.toLowerCase()) ?? false)
          }
          renderRowActions={(row) => (
            <div className="flex items-center gap-1 justify-end">
              {/* View Details Drawer */}
              <button
                onClick={() => {
                  setSelectedChallanId(row.challan_id);
                  setIsDetailsOpen(true);
                }}
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded transition-colors"
                title="View Full Details"
              >
                <Eye className="w-4 h-4" />
              </button>

              {/* Edit (Draft or Picked only) */}
              {['DRAFT', 'PICKED'].includes(row.status) && (
                <PermissionGate screen="DELIVERY_CHALLAN" action="EDIT">
                  <button
                    onClick={() => {
                      setSelectedChallanId(row.challan_id);
                      setIsCreateOpen(true);
                    }}
                    className="p-1.5 hover:bg-muted text-blue-600 rounded transition-colors"
                    title="Edit Challan"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </PermissionGate>
              )}

              {/* Pick Action (Draft only) */}
              {row.status === 'DRAFT' && (
                <PermissionGate screen="DELIVERY_CHALLAN" action="PICK">
                  <button
                    onClick={() => {
                      setSelectedChallanId(row.challan_id);
                      setIsPickOpen(true);
                    }}
                    className="p-1.5 hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-950/40 rounded transition-colors"
                    title="Confirm Warehouse Picking Slip"
                  >
                    <ListChecks className="w-4 h-4" />
                  </button>
                </PermissionGate>
              )}

              {/* Pack Action (Draft or Picked) */}
              {['DRAFT', 'PICKED'].includes(row.status) && (
                <PermissionGate screen="DELIVERY_CHALLAN" action="PACK">
                  <button
                    onClick={() => {
                      setSelectedChallanId(row.challan_id);
                      setIsPackOpen(true);
                    }}
                    className="p-1.5 hover:bg-purple-50 text-purple-600 dark:hover:bg-purple-950/40 rounded transition-colors"
                    title="Confirm Packing & Weight"
                  >
                    <PackageCheck className="w-4 h-4" />
                  </button>
                </PermissionGate>
              )}

              {/* Dispatch Action (Packed or Picked or Draft) */}
              {!['DISPATCHED', 'DELIVERED', 'CANCELLED'].includes(row.status) && (
                <PermissionGate screen="DELIVERY_CHALLAN" action="DISPATCH">
                  <button
                    onClick={() => {
                      setSelectedChallanId(row.challan_id);
                      setIsDispatchOpen(true);
                    }}
                    className="p-1.5 hover:bg-emerald-50 text-emerald-600 dark:hover:bg-emerald-950/40 rounded transition-colors"
                    title="Gate Outward Dispatch (Deducts Stock)"
                  >
                    <Truck className="w-4 h-4" />
                  </button>
                </PermissionGate>
              )}

              {/* Mark Delivered (Dispatched only) */}
              {row.status === 'DISPATCHED' && (
                <PermissionGate screen="DELIVERY_CHALLAN" action="EDIT">
                  <button
                    onClick={() => deliverMutation.mutate(row.challan_id)}
                    className="p-1.5 hover:bg-teal-50 text-teal-600 dark:hover:bg-teal-950/40 rounded transition-colors"
                    title="Mark Customer Receipt Delivered"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                </PermissionGate>
              )}

              {/* Print Official Statutory Challan */}
              <PermissionGate screen="DELIVERY_CHALLAN" action="PRINT">
                <button
                  onClick={() => {
                    setSelectedChallanId(row.challan_id);
                    setIsPrintOpen(true);
                  }}
                  className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded transition-colors"
                  title="Print Rule 55 Delivery Challan"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </PermissionGate>

              {/* Cancel Action (if not already Delivered or Cancelled) */}
              {!['DELIVERED', 'CANCELLED'].includes(row.status) && (
                <PermissionGate screen="DELIVERY_CHALLAN" action="EDIT">
                  <button
                    onClick={() => {
                      setSelectedChallanId(row.challan_id);
                      setIsCancelConfirmOpen(true);
                    }}
                    className="p-1.5 hover:bg-rose-50 text-rose-500 dark:hover:bg-rose-950/40 rounded transition-colors"
                    title="Cancel Challan (Reverses Stock if Dispatched)"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </PermissionGate>
              )}

              {/* Delete Draft */}
              {row.status === 'DRAFT' && (
                <PermissionGate screen="DELIVERY_CHALLAN" action="DELETE">
                  <button
                    onClick={() => {
                      setSelectedChallanId(row.challan_id);
                      setIsDeleteConfirmOpen(true);
                    }}
                    className="p-1.5 hover:bg-rose-50 text-rose-600 dark:hover:bg-rose-950/40 rounded transition-colors"
                    title="Delete Draft Challan"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </PermissionGate>
              )}
            </div>
          )}
        />
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Drawer: Detailed Challan View                                        */}
      {/* -------------------------------------------------------------------- */}
      {isDetailsOpen && activeChallan && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-3xl bg-background border-l border-border h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 rounded-lg text-emerald-600">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    {activeChallan.challan_no}
                    {getStatusBadge(activeChallan.status)}
                  </h2>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    <span>Dated: {formatDate(activeChallan.challan_date)}</span>
                    {activeChallan.so_no && (
                      <span className="text-blue-600 font-mono">Linked SO: {activeChallan.so_no}</span>
                    )}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Summary Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-card border border-border rounded-xl p-4">
                <div>
                  <span className="text-xs text-muted-foreground">Total Dispatched</span>
                  <div className="text-lg font-bold text-foreground">
                    {activeChallan.total_quantity.toLocaleString('en-IN')} units
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Challan Value</span>
                  <div className="text-lg font-bold text-emerald-600">
                    {formatInr(activeChallan.total_value)}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Packages</span>
                  <div className="text-sm font-semibold text-foreground">
                    {activeChallan.total_packages} {activeChallan.package_type}
                  </div>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Gross Weight</span>
                  <div className="text-sm font-semibold text-foreground">
                    {activeChallan.gross_weight_kg > 0 ? `${activeChallan.gross_weight_kg.toFixed(2)} kg` : '—'}
                  </div>
                </div>
              </div>

              {/* Customer & Shipping Addresses */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-border rounded-xl p-4 space-y-2 bg-card">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" />
                    Customer & Bill-To
                  </h3>
                  <div className="font-semibold text-sm text-foreground">{activeChallan.customer_name}</div>
                  <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {activeChallan.billing_address || 'No billing address recorded.'}
                  </div>
                  {activeChallan.customer_gstin && (
                    <div className="text-xs font-mono font-medium text-primary">
                      GSTIN: {activeChallan.customer_gstin}
                    </div>
                  )}
                  {activeChallan.contact_person && (
                    <div className="text-xs text-muted-foreground">
                      Contact: {activeChallan.contact_person} ({activeChallan.contact_phone || '—'})
                    </div>
                  )}
                </div>

                <div className="border border-border rounded-xl p-4 space-y-2 bg-card">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    Consignee & Ship-To
                  </h3>
                  <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {activeChallan.shipping_address || 'Same as billing address.'}
                  </div>
                  <div className="text-xs font-medium text-foreground">
                    Destination State: {activeChallan.shipping_state_name} ({activeChallan.shipping_state_code})
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Delivery Terms: <span className="font-medium text-foreground">{activeChallan.delivery_terms}</span>
                  </div>
                </div>
              </div>

              {/* Transport & Statutory Logistics */}
              <div className="border border-border rounded-xl p-4 bg-muted/20 space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-primary" />
                  Statutory Rule 55 Transport & E-Way Bill Details
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Transporter:</span>
                    <div className="font-medium text-foreground">{activeChallan.transporter_name || 'Own Logistics'}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vehicle Number:</span>
                    <div className="font-mono font-semibold text-foreground">
                      {activeChallan.vehicle_no || 'Pending Assignment'}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">LR / RR Consignment No:</span>
                    <div className="font-mono font-medium text-foreground">
                      {activeChallan.lr_rr_no ? `${activeChallan.lr_rr_no} (${formatDate(activeChallan.lr_rr_date)})` : '—'}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">E-Way Bill Number:</span>
                    <div className="font-mono font-semibold text-primary">
                      {activeChallan.e_way_bill_no || 'Not Generated / Excluded'}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Dispatch Purpose:</span>
                    <div className="mt-0.5">{getPurposeBadge(activeChallan.dispatch_purpose)}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Customer PO Reference:</span>
                    <div className="font-medium text-foreground">
                      {activeChallan.customer_po_no || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Line Items Schedule */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-primary" />
                  Schedule of Goods & Storage Bin Allocations
                </h3>
                <div className="border border-border rounded-xl overflow-hidden shadow-xs">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted text-muted-foreground uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">Item Description</th>
                        <th className="p-3">HSN</th>
                        <th className="p-3">Storage Bin / Lot</th>
                        <th className="p-3 text-right">Dispatched Qty</th>
                        <th className="p-3 text-right">Unit Rate</th>
                        <th className="p-3 text-right">Declared Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {activeChallan.items?.map((itm, idx) => (
                        <tr key={itm.challan_item_id || idx} className="hover:bg-muted/30">
                          <td className="p-3 font-medium text-muted-foreground">{idx + 1}</td>
                          <td className="p-3">
                            <div className="font-semibold text-foreground">{itm.item_name}</div>
                            <div className="text-[11px] font-mono text-muted-foreground">{itm.item_code}</div>
                          </td>
                          <td className="p-3 font-mono">{itm.hsn_sac_code || '—'}</td>
                          <td className="p-3">
                            <span className="inline-flex items-center gap-1 font-mono px-1.5 py-0.5 rounded bg-muted text-foreground">
                              <Warehouse className="w-3 h-3 text-slate-400" />
                              {itm.bin_code || 'Default Bay'}
                            </span>
                            {itm.batch_no && (
                              <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                Batch: {itm.batch_no} {itm.heat_no ? `| Heat: ${itm.heat_no}` : ''}
                              </div>
                            )}
                          </td>
                          <td className="p-3 text-right font-bold text-foreground">
                            {itm.dispatched_qty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {itm.uom_code || 'Units'}
                          </td>
                          <td className="p-3 text-right font-mono">{formatInrDecimals(itm.unit_rate)}</td>
                          <td className="p-3 text-right font-semibold font-mono text-foreground">
                            {formatInr(itm.total_amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Execution & Audit Stamps */}
              <div className="border border-border rounded-xl p-4 bg-muted/10 space-y-2 text-xs">
                <h4 className="font-semibold text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  3-Tier Milestone Audit Trail
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-2.5 rounded-lg bg-card border border-border">
                    <span className="text-muted-foreground block text-[11px]">1. Warehouse Picking</span>
                    <div className="font-medium text-foreground mt-0.5">
                      {activeChallan.picked_by_name || 'Pending'}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{formatDate(activeChallan.picked_at)}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card border border-border">
                    <span className="text-muted-foreground block text-[11px]">2. Packing & Verification</span>
                    <div className="font-medium text-foreground mt-0.5">
                      {activeChallan.packed_by_name || 'Pending'}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{formatDate(activeChallan.packed_at)}</div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-card border border-border">
                    <span className="text-muted-foreground block text-[11px]">3. Gate Outward Dispatch</span>
                    <div className="font-medium text-foreground mt-0.5">
                      {activeChallan.dispatched_by_name || 'Pending'}
                    </div>
                    <div className="text-[10px] text-muted-foreground">{formatDate(activeChallan.dispatched_at)}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-border bg-card flex items-center justify-between">
              <button
                onClick={() => setIsDetailsOpen(false)}
                className="px-4 py-2 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Close Drawer
              </button>
              <div className="flex items-center gap-2">
                <PermissionGate screen="DELIVERY_CHALLAN" action="PRINT">
                  <button
                    onClick={() => setIsPrintOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-muted"
                  >
                    <Printer className="w-4 h-4" />
                    Print Challan
                  </button>
                </PermissionGate>

                {['DRAFT', 'PICKED', 'PACKED'].includes(activeChallan.status) && (
                  <PermissionGate screen="DELIVERY_CHALLAN" action="DISPATCH">
                    <button
                      onClick={() => setIsDispatchOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700"
                    >
                      <Truck className="w-4 h-4" />
                      Gate Dispatch
                    </button>
                  </PermissionGate>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Modal: Create / Edit Delivery Challan                                */}
      {/* -------------------------------------------------------------------- */}
      {isCreateOpen && (
        <CreateEditChallanModal
          challanId={selectedChallanId}
          lookups={lookups}
          onClose={() => {
            setIsCreateOpen(false);
            setSelectedChallanId(null);
          }}
          onSuccess={() => {
            setIsCreateOpen(false);
            setSelectedChallanId(null);
            queryClient.invalidateQueries({ queryKey: ['delivery-challans-list'] });
            queryClient.invalidateQueries({ queryKey: ['delivery-challans-summary'] });
          }}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Modal: Pick Slip Confirmation                                        */}
      {/* -------------------------------------------------------------------- */}
      {isPickOpen && selectedChallanId && (
        <PickSlipModal
          challanId={selectedChallanId}
          onClose={() => setIsPickOpen(false)}
          onSubmit={(remarks) => pickMutation.mutate({ id: selectedChallanId, remarks })}
          isLoading={pickMutation.isPending}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Modal: Packing List Confirmation                                     */}
      {/* -------------------------------------------------------------------- */}
      {isPackOpen && selectedChallanId && (
        <PackSlipModal
          challanId={selectedChallanId}
          onClose={() => setIsPackOpen(false)}
          onSubmit={(payload) => packMutation.mutate({ id: selectedChallanId, ...payload })}
          isLoading={packMutation.isPending}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Modal: Physical Gate Outward Dispatch Clearance                      */}
      {/* -------------------------------------------------------------------- */}
      {isDispatchOpen && selectedChallanId && (
        <DispatchClearanceModal
          challanId={selectedChallanId}
          lookups={lookups}
          onClose={() => setIsDispatchOpen(false)}
          onSubmit={(payload) => dispatchMutation.mutate({ id: selectedChallanId, ...payload })}
          isLoading={dispatchMutation.isPending}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Modal: Printable Statutory GST Rule 55 Delivery Challan               */}
      {/* -------------------------------------------------------------------- */}
      {isPrintOpen && selectedChallanId && activeChallan && (
        <PrintableDeliveryChallanModal
          challan={activeChallan}
          branch={lookups?.branch}
          onClose={() => setIsPrintOpen(false)}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Modal: Cancellation Confirmation                                     */}
      {/* -------------------------------------------------------------------- */}
      <ConfirmDeleteModal
        isOpen={isCancelConfirmOpen}
        entityType="Delivery Challan"
        entityName={`Challan #${activeChallan?.challan_no || selectedChallanId} (${activeChallan?.customer_name || ''})`}
        entityCode={activeChallan?.challan_no}
        errorMessage={
          activeChallan?.status === 'DISPATCHED'
            ? 'Warning: This shipment is already DISPATCHED. Cancelling will reverse all deducted inventory back into warehouse bins and reset linked Sales Order delivered balances.'
            : undefined
        }
        isDeleting={cancelMutation.isPending}
        onClose={() => setIsCancelConfirmOpen(false)}
        onConfirm={() => selectedChallanId && cancelMutation.mutate(selectedChallanId)}
      />

      {/* -------------------------------------------------------------------- */}
      {/* Modal: Soft Delete Confirmation                                      */}
      {/* -------------------------------------------------------------------- */}
      <ConfirmDeleteModal
        isOpen={isDeleteConfirmOpen}
        entityType="Draft Delivery Challan"
        entityName={`Challan #${activeChallan?.challan_no || selectedChallanId}`}
        entityCode={activeChallan?.challan_no}
        isDeleting={deleteMutation.isPending}
        onClose={() => setIsDeleteConfirmOpen(false)}
        onConfirm={() => selectedChallanId && deleteMutation.mutate(selectedChallanId)}
      />
    </div>
  );
};

// ----------------------------------------------------------------------------
// Subcomponent: Create / Edit Challan Modal
// ----------------------------------------------------------------------------
interface CreateEditChallanModalProps {
  challanId: number | null;
  lookups?: ChallanLookups;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateEditChallanModal: React.FC<CreateEditChallanModalProps> = ({
  challanId,
  lookups,
  onClose,
  onSuccess,
}) => {
  const isEdit = !!challanId;

  // Header State
  const [selectedSoId, setSelectedSoId] = useState<number | ''>('');
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [contactPerson, setContactPerson] = useState<string>('');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [billingAddressId, setBillingAddressId] = useState<number | ''>('');
  const [billingAddress, setBillingAddress] = useState<string>('');
  const [shippingAddressId, setShippingAddressId] = useState<number | ''>('');
  const [shippingAddress, setShippingAddress] = useState<string>('');
  const [shippingStateCode, setShippingStateCode] = useState<string>('24');
  const [shippingStateName, setShippingStateName] = useState<string>('Gujarat');
  const [customerGstin, setCustomerGstin] = useState<string>('');
  const [dispatchPurpose, setDispatchPurpose] = useState<string>('SUPPLY_ON_SALE');
  const [transporterId, setTransporterId] = useState<number | ''>('');
  const [transporterName, setTransporterName] = useState<string>('');
  const [vehicleNo, setVehicleNo] = useState<string>('');
  const [lrRrNo, setLrRrNo] = useState<string>('');
  const [lrRrDate, setLrRrDate] = useState<string>('');
  const [eWayBillNo, setEWayBillNo] = useState<string>('');
  const [eWayBillDate, setEWayBillDate] = useState<string>('');
  const [deliveryTerms, setDeliveryTerms] = useState<string>('EX_WORKS');
  const [totalPackages, setTotalPackages] = useState<number>(1);
  const [packageType, setPackageType] = useState<string>('Corrugated Boxes');
  const [grossWeightKg, setGrossWeightKg] = useState<number>(0);
  const [netWeightKg, setNetWeightKg] = useState<number>(0);
  const [warehouseId, setWarehouseId] = useState<number>(lookups?.warehouses[0]?.warehouse_id || 1001);
  const [remarks, setRemarks] = useState<string>('');
  const [termsAndConditions, setTermsAndConditions] = useState<string>(
    'Goods dispatched in sound condition per Rule 55 of CGST Rules 2017.',
  );

  // Items State
  const [items, setItems] = useState<ChallanItem[]>([]);

  // Load existing data if editing
  useQuery({
    queryKey: ['delivery-challan-edit', challanId],
    queryFn: async () => {
      if (!challanId) return null;
      const res = await apiClient.get(`/sales/delivery-challans/${challanId}`);
      const ch = res.data.data;
      if (ch) {
        setSelectedSoId(ch.so_id || '');
        setCustomerId(ch.customer_id);
        setCustomerName(ch.customer_name);
        setContactPerson(ch.contact_person || '');
        setContactPhone(ch.contact_phone || '');
        setBillingAddressId(ch.billing_address_id || '');
        setBillingAddress(ch.billing_address || '');
        setShippingAddressId(ch.shipping_address_id || '');
        setShippingAddress(ch.shipping_address || '');
        setShippingStateCode(ch.shipping_state_code);
        setShippingStateName(ch.shipping_state_name);
        setCustomerGstin(ch.customer_gstin || '');
        setDispatchPurpose(ch.dispatch_purpose);
        setTransporterId(ch.transporter_id || '');
        setTransporterName(ch.transporter_name || '');
        setVehicleNo(ch.vehicle_no || '');
        setLrRrNo(ch.lr_rr_no || '');
        setLrRrDate(ch.lr_rr_date ? ch.lr_rr_date.split('T')[0] : '');
        setEWayBillNo(ch.e_way_bill_no || '');
        setEWayBillDate(ch.e_way_bill_date ? ch.e_way_bill_date.split('T')[0] : '');
        setDeliveryTerms(ch.delivery_terms);
        setTotalPackages(ch.total_packages || 1);
        setPackageType(ch.package_type || 'Corrugated Boxes');
        setGrossWeightKg(ch.gross_weight_kg || 0);
        setNetWeightKg(ch.net_weight_kg || 0);
        setWarehouseId(ch.warehouse_id);
        setRemarks(ch.remarks || '');
        setTermsAndConditions(ch.terms_and_conditions || '');
        setItems(ch.items || []);
      }
      return ch;
    },
    enabled: isEdit,
  });

  // Handle 1-Click Load from Sales Order
  const handleSelectSalesOrder = (soIdNum: number) => {
    setSelectedSoId(soIdNum);
    const so = lookups?.salesOrders.find((s) => s.so_id === soIdNum);
    if (!so) return;

    setCustomerId(so.customer_id);
    setCustomerName(so.customer_name);
    setShippingAddressId(so.shipping_address_id || '');
    setShippingAddress(so.shipping_address || '');
    setShippingStateCode(so.shipping_state_code || '24');
    setShippingStateName(so.shipping_state_name || 'Gujarat');
    setDeliveryTerms(so.delivery_terms || 'EX_WORKS');

    // Auto-fill billing address from addresses
    const addr = lookups?.addresses.find((a) => a.party_id === so.customer_id && a.is_default);
    if (addr) {
      setBillingAddressId(addr.address_id);
      setBillingAddress(`${addr.address_line1}, ${addr.city}, ${addr.state_name} - ${addr.pin_code}`);
      setCustomerGstin(addr.gstin || '');
    }

    // Auto-populate line items from SO pending quantities
    const soItems = lookups?.salesOrderItems.filter((itm) => itm.so_id === soIdNum) || [];
    const newItems: ChallanItem[] = soItems.map((itm, idx) => {
      // Find default bin for this item with stock
      const matchingBin = lookups?.storageBins.find(
        (b) => b.item_id === itm.item_id && b.on_hand_qty > 0,
      );

      return {
        so_item_id: itm.so_item_id,
        item_sequence: idx + 1,
        item_id: itm.item_id,
        item_code: itm.item_code,
        item_name: itm.item_name,
        description: itm.description,
        hsn_sac_code: itm.hsn_sac_code,
        uom_id: itm.uom_id,
        uom_code: itm.uom_code,
        ordered_qty: itm.ordered_qty,
        dispatched_qty: itm.pending_qty,
        warehouse_id: matchingBin?.warehouse_id || warehouseId,
        bin_id: matchingBin?.bin_id || null,
        bin_code: matchingBin?.bin_code || null,
        batch_no: matchingBin?.batch_no || null,
        heat_no: matchingBin?.heat_no || null,
        unit_rate: itm.unit_rate,
        total_amount: Number((itm.pending_qty * itm.unit_rate).toFixed(2)),
        remarks: `Dispatched against ${so.so_no}`,
      };
    });

    setItems(newItems);
  };

  // Handle Customer Selection directly
  const handleSelectCustomer = (partyIdNum: number) => {
    setCustomerId(partyIdNum);
    const cust = lookups?.customers.find((c) => c.party_id === partyIdNum);
    if (cust) {
      setCustomerName(cust.party_name);
      setContactPerson(cust.primary_contact_name || '');
      setContactPhone(cust.primary_phone || '');
    }

    const addr = lookups?.addresses.find((a) => a.party_id === partyIdNum && a.is_default);
    if (addr) {
      setBillingAddressId(addr.address_id);
      setBillingAddress(`${addr.address_line1}, ${addr.city}, ${addr.state_name} - ${addr.pin_code}`);
      setShippingAddressId(addr.address_id);
      setShippingAddress(`${addr.address_line1}, ${addr.city}, ${addr.state_name} - ${addr.pin_code}`);
      setShippingStateCode(addr.state_code || '24');
      setShippingStateName(addr.state_name || 'Gujarat');
      setCustomerGstin(addr.gstin || '');
    }
  };

  // Item modifications
  const handleAddItem = () => {
    const firstItem = lookups?.items[0];
    if (!firstItem) return;

    setItems([
      ...items,
      {
        item_sequence: items.length + 1,
        item_id: firstItem.item_id,
        item_code: firstItem.item_code,
        item_name: firstItem.item_name,
        description: '',
        hsn_sac_code: firstItem.hsn_sac_code,
        uom_id: firstItem.uom_id,
        uom_code: firstItem.uom_code,
        ordered_qty: 1,
        dispatched_qty: 1,
        warehouse_id: warehouseId,
        unit_rate: firstItem.standard_rate || 0,
        total_amount: firstItem.standard_rate || 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleUpdateItem = (index: number, field: keyof ChallanItem, value: any) => {
    const updated = [...items];
    const itm = { ...updated[index], [field]: value };

    if (field === 'item_id') {
      const match = lookups?.items.find((i) => i.item_id === Number(value));
      if (match) {
        itm.item_code = match.item_code;
        itm.item_name = match.item_name;
        itm.hsn_sac_code = match.hsn_sac_code;
        itm.uom_id = match.uom_id;
        itm.uom_code = match.uom_code;
        itm.unit_rate = match.standard_rate;
      }
    }

    if (field === 'bin_id') {
      const matchBin = lookups?.storageBins.find((b) => b.bin_id === Number(value));
      if (matchBin) {
        itm.bin_code = matchBin.bin_code;
        if (matchBin.batch_no) itm.batch_no = matchBin.batch_no;
        if (matchBin.heat_no) itm.heat_no = matchBin.heat_no;
      }
    }

    if (field === 'dispatched_qty' || field === 'unit_rate') {
      const q = field === 'dispatched_qty' ? Number(value) : itm.dispatched_qty;
      const r = field === 'unit_rate' ? Number(value) : itm.unit_rate;
      itm.total_amount = Number((q * r).toFixed(2));
    }

    updated[index] = itm;
    setItems(updated);
  };

  // Submit Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!customerId) throw new Error('Please select a customer.');
      if (items.length === 0) throw new Error('At least one line item is required.');

      const payload = {
        soId: selectedSoId ? Number(selectedSoId) : undefined,
        customerId: Number(customerId),
        customerName,
        contactPerson,
        contactPhone,
        billingAddressId: billingAddressId ? Number(billingAddressId) : undefined,
        billingAddress,
        shippingAddressId: shippingAddressId ? Number(shippingAddressId) : undefined,
        shippingAddress,
        shippingStateCode,
        shippingStateName,
        customerGstin,
        dispatchPurpose,
        transporterId: transporterId ? Number(transporterId) : undefined,
        transporterName,
        vehicleNo,
        lrRrNo,
        lrRrDate: lrRrDate || undefined,
        eWayBillNo,
        eWayBillDate: eWayBillDate || undefined,
        deliveryTerms,
        totalPackages: Number(totalPackages || 1),
        packageType,
        grossWeightKg: Number(grossWeightKg || 0),
        netWeightKg: Number(netWeightKg || 0),
        warehouseId: Number(warehouseId),
        remarks,
        termsAndConditions,
        items: items.map((itm) => ({
          soItemId: itm.so_item_id || undefined,
          itemId: itm.item_id,
          itemCode: itm.item_code,
          itemName: itm.item_name,
          description: itm.description || undefined,
          hsnSacCode: itm.hsn_sac_code || undefined,
          uomId: itm.uom_id,
          orderedQty: Number(itm.ordered_qty || itm.dispatched_qty),
          dispatchedQty: Number(itm.dispatched_qty),
          warehouseId: Number(itm.warehouse_id || warehouseId),
          binId: itm.bin_id ? Number(itm.bin_id) : undefined,
          batchNo: itm.batch_no || undefined,
          heatNo: itm.heat_no || undefined,
          unitRate: Number(itm.unit_rate || 0),
          totalAmount: Number(itm.total_amount || 0),
          remarks: itm.remarks || undefined,
        })),
      };

      if (isEdit) {
        return apiClient.put(`/sales/delivery-challans/${challanId}`, payload);
      } else {
        return apiClient.post('/sales/delivery-challans', payload);
      }
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      alert(`Error saving delivery challan: ${err.response?.data?.message || err.message}`);
    },
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-background border border-border w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/60 rounded-lg text-emerald-600">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {isEdit ? 'Edit Delivery Challan' : 'Create Outward Delivery Challan'}
              </h2>
              <p className="text-xs text-muted-foreground">
                Issue Rule 55 statutory outward dispatch document for customer sales orders or direct transfers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* 1. Fast Load from Sales Order */}
          {!isEdit && (
            <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                <div>
                  <div className="font-semibold text-blue-900 dark:text-blue-300">
                    1-Click Load from Confirmed Sales Order
                  </div>
                  <div className="text-[11px] text-blue-700 dark:text-blue-400">
                    Auto-fills customer, addresses, GSTIN, and remaining undelivered line item quantities
                  </div>
                </div>
              </div>

              <select
                value={selectedSoId}
                onChange={(e) => handleSelectSalesOrder(Number(e.target.value))}
                className="w-full sm:w-72 bg-white dark:bg-slate-900 border border-blue-300 dark:border-blue-700 rounded-lg px-3 py-1.5 font-medium text-foreground text-xs focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Select Confirmed Sales Order —</option>
                {lookups?.salesOrders.map((so) => (
                  <option key={so.so_id} value={so.so_id}>
                    {so.so_no} — {so.customer_name} ({so.status})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 2. Customer, Addresses & Purpose */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="font-medium text-foreground block mb-1">Customer / Party *</label>
              <select
                value={customerId}
                onChange={(e) => handleSelectCustomer(Number(e.target.value))}
                disabled={isEdit}
                className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground disabled:opacity-60"
              >
                <option value="">— Select Customer —</option>
                {lookups?.customers.map((c) => (
                  <option key={c.party_id} value={c.party_id}>
                    {c.party_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Dispatch Purpose *</label>
              <select
                value={dispatchPurpose}
                onChange={(e) => setDispatchPurpose(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground"
              >
                <option value="SUPPLY_ON_SALE">Supply on Sale (Commercial Invoice to Follow)</option>
                <option value="SAMPLE_DEMO">Sample / Demo / Testing</option>
                <option value="JOB_WORK_RETURN">Job-Work Return to Customer</option>
                <option value="EXHIBITION">Exhibition / Trade Fair</option>
                <option value="APPROVAL_BASIS">On Approval Basis</option>
                <option value="OTHERS">Others (Specify in remarks)</option>
              </select>
            </div>

            <div>
              <label className="font-medium text-foreground block mb-1">Origin Warehouse *</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(Number(e.target.value))}
                className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground"
              >
                {lookups?.warehouses.map((w) => (
                  <option key={w.warehouse_id} value={w.warehouse_id}>
                    {w.warehouse_name} ({w.warehouse_code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Addresses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-medium text-foreground block mb-1">Bill-To Address</label>
              <textarea
                rows={2}
                value={billingAddress}
                onChange={(e) => setBillingAddress(e.target.value)}
                placeholder="Full billing address..."
                className="w-full border border-border rounded-lg p-2 bg-background text-foreground"
              />
            </div>
            <div>
              <label className="font-medium text-foreground block mb-1">Ship-To Address (Consignee)</label>
              <textarea
                rows={2}
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                placeholder="Full delivery destination..."
                className="w-full border border-border rounded-lg p-2 bg-background text-foreground"
              />
            </div>
          </div>

          {/* 3. Transporter & Logistics Details */}
          <div className="border border-border rounded-xl p-4 bg-muted/10 space-y-3">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Truck className="w-4 h-4 text-emerald-600" />
              Logistics, Transporter & Vehicle Metadata
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-medium text-muted-foreground block mb-1">Transporter</label>
                <input
                  type="text"
                  placeholder="e.g. V-Trans / TCI Freight"
                  value={transporterName}
                  onChange={(e) => setTransporterName(e.target.value)}
                  className="w-full border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground"
                />
              </div>

              <div>
                <label className="font-medium text-muted-foreground block mb-1">Vehicle Number</label>
                <input
                  type="text"
                  placeholder="e.g. GJ-01-BX-8821"
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  className="w-full border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground font-mono"
                />
              </div>

              <div>
                <label className="font-medium text-muted-foreground block mb-1">Delivery Terms</label>
                <input
                  type="text"
                  placeholder="e.g. Ex-Works / FOR Destination"
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                  className="w-full border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground"
                />
              </div>

              <div>
                <label className="font-medium text-muted-foreground block mb-1">LR / Consignment Note No</label>
                <input
                  type="text"
                  placeholder="e.g. LR-789012"
                  value={lrRrNo}
                  onChange={(e) => setLrRrNo(e.target.value)}
                  className="w-full border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground font-mono"
                />
              </div>

              <div>
                <label className="font-medium text-muted-foreground block mb-1">LR Date</label>
                <input
                  type="date"
                  value={lrRrDate}
                  onChange={(e) => setLrRrDate(e.target.value)}
                  className="w-full border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground"
                />
              </div>

              <div>
                <label className="font-medium text-muted-foreground block mb-1">E-Way Bill Number</label>
                <input
                  type="text"
                  placeholder="e.g. EWB-2627-891023"
                  value={eWayBillNo}
                  onChange={(e) => setEWayBillNo(e.target.value)}
                  className="w-full border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground font-mono"
                />
              </div>

              <div>
                <label className="font-medium text-muted-foreground block mb-1">Total Packages</label>
                <input
                  type="number"
                  min="1"
                  value={totalPackages}
                  onChange={(e) => setTotalPackages(Number(e.target.value))}
                  className="w-full border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground font-semibold"
                />
              </div>

              <div>
                <label className="font-medium text-muted-foreground block mb-1">Packaging Type</label>
                <input
                  type="text"
                  placeholder="e.g. Wooden Crates / Corrugated Boxes"
                  value={packageType}
                  onChange={(e) => setPackageType(e.target.value)}
                  className="w-full border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground"
                />
              </div>

              <div>
                <label className="font-medium text-muted-foreground block mb-1">Gross Weight (kg)</label>
                <input
                  type="number"
                  step="0.001"
                  value={grossWeightKg}
                  onChange={(e) => setGrossWeightKg(Number(e.target.value))}
                  className="w-full border border-border rounded-lg px-2.5 py-1.5 bg-background text-foreground"
                />
              </div>
            </div>
          </div>

          {/* 4. Line Items Grid */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                <Boxes className="w-4 h-4 text-primary" />
                Line Items Schedule ({items.length})
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-muted hover:bg-muted/80 text-foreground rounded-lg font-medium text-xs transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
            </div>

            <div className="border border-border rounded-xl overflow-hidden shadow-xs">
              <table className="w-full text-left">
                <thead className="bg-muted text-muted-foreground uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-2.5">Item Catalog</th>
                    <th className="p-2.5">Storage Bin & Lot</th>
                    <th className="p-2.5 text-right w-28">Dispatch Qty</th>
                    <th className="p-2.5 text-right w-28">Unit Rate</th>
                    <th className="p-2.5 text-right w-28">Amount</th>
                    <th className="p-2.5 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((itm, idx) => (
                    <tr key={idx} className="hover:bg-muted/20">
                      <td className="p-2">
                        <select
                          value={itm.item_id}
                          onChange={(e) => handleUpdateItem(idx, 'item_id', Number(e.target.value))}
                          className="w-full border border-border rounded px-2 py-1 bg-background text-foreground"
                        >
                          {lookups?.items.map((it) => (
                            <option key={it.item_id} value={it.item_id}>
                              {it.item_code} — {it.item_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          value={itm.bin_id || ''}
                          onChange={(e) => handleUpdateItem(idx, 'bin_id', Number(e.target.value))}
                          className="w-full border border-border rounded px-2 py-1 bg-background text-foreground font-mono"
                        >
                          <option value="">— Select Bin —</option>
                          {lookups?.storageBins
                            .filter((b) => b.item_id === itm.item_id)
                            .map((b) => (
                              <option key={b.bin_id} value={b.bin_id}>
                                {b.bin_code} (Avail: {b.available_qty})
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          step="0.001"
                          min="0.001"
                          value={itm.dispatched_qty}
                          onChange={(e) => handleUpdateItem(idx, 'dispatched_qty', Number(e.target.value))}
                          className="w-full border border-border rounded px-2 py-1 text-right font-bold bg-background text-foreground"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={itm.unit_rate}
                          onChange={(e) => handleUpdateItem(idx, 'unit_rate', Number(e.target.value))}
                          className="w-full border border-border rounded px-2 py-1 text-right bg-background text-foreground font-mono"
                        />
                      </td>
                      <td className="p-2 text-right font-semibold font-mono text-foreground">
                        {formatInr(itm.total_amount)}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="p-1 hover:bg-rose-100 text-rose-500 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-4 text-center text-muted-foreground italic">
                        No line items added yet. Click &apos;Add Item&apos; or load from a confirmed Sales Order.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="font-medium text-foreground block mb-1">Remarks & Special Handling Notes</label>
            <input
              type="text"
              placeholder="e.g. Handle with care, fragile machined surfaces, test certificates enclosed..."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full border border-border rounded-lg px-3 py-2 bg-background text-foreground"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-card flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Total Declared Value: <span className="font-bold text-foreground text-sm">{formatInr(items.reduce((acc, i) => acc + (i.total_amount || 0), 0))}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="px-5 py-2 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 text-xs shadow-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {saveMutation.isPending ? 'Saving...' : isEdit ? 'Update Challan' : 'Save Delivery Challan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// Subcomponent: Pick Slip Modal
// ----------------------------------------------------------------------------
interface PickSlipModalProps {
  challanId: number;
  onClose: () => void;
  onSubmit: (remarks?: string) => void;
  isLoading: boolean;
}

const PickSlipModal: React.FC<PickSlipModalProps> = ({
  challanId,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const [remarks, setRemarks] = useState<string>('Stock picked from specified storage racks without variance.');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-background border border-border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-950/60 rounded-xl text-blue-600">
            <ListChecks className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Confirm Warehouse Picking</h3>
            <p className="text-xs text-muted-foreground">Confirm that finished goods items have been picked from warehouse storage bins</p>
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-foreground block mb-1">Picking Verification Notes</label>
          <textarea
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full text-xs border border-border rounded-lg p-2.5 bg-background text-foreground"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(remarks)}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {isLoading ? 'Confirming...' : 'Confirm Picking'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// Subcomponent: Pack Slip Modal
// ----------------------------------------------------------------------------
interface PackSlipModalProps {
  challanId: number;
  onClose: () => void;
  onSubmit: (payload: {
    totalPackages: number;
    packageType: string;
    grossWeightKg: number;
    netWeightKg: number;
    remarks?: string;
  }) => void;
  isLoading: boolean;
}

const PackSlipModal: React.FC<PackSlipModalProps> = ({
  challanId,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const [totalPackages, setTotalPackages] = useState<number>(2);
  const [packageType, setPackageType] = useState<string>('Wooden Crates');
  const [grossWeightKg, setGrossWeightKg] = useState<number>(150);
  const [netWeightKg, setNetWeightKg] = useState<number>(140);
  const [remarks, setRemarks] = useState<string>('Packed in seaworthy crates with rust preventive coating and VCI film.');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-background border border-border w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 dark:bg-purple-950/60 rounded-xl text-purple-600">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Confirm Packing & Verification</h3>
            <p className="text-xs text-muted-foreground">Log package counts, container types, and tare/gross weights prior to gate dispatch</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="font-medium text-foreground block mb-1">Total Packages</label>
            <input
              type="number"
              min="1"
              value={totalPackages}
              onChange={(e) => setTotalPackages(Number(e.target.value))}
              className="w-full border border-border rounded-lg p-2 bg-background text-foreground font-semibold"
            />
          </div>

          <div>
            <label className="font-medium text-foreground block mb-1">Packaging Type</label>
            <select
              value={packageType}
              onChange={(e) => setPackageType(e.target.value)}
              className="w-full border border-border rounded-lg p-2 bg-background text-foreground"
            >
              <option value="Wooden Crates">Wooden Crates / Cases</option>
              <option value="Corrugated Boxes">Corrugated Cartons / Boxes</option>
              <option value="Pallets / Skid">Pallets / Skid Stretch Wrapped</option>
              <option value="Drums / Barrels">Steel / HDPE Drums</option>
              <option value="Gunny Bags">Gunny / HDPE Bags</option>
              <option value="Loose / Bundles">Loose Bundles with Strapping</option>
            </select>
          </div>

          <div>
            <label className="font-medium text-foreground block mb-1">Net Weight (kg)</label>
            <input
              type="number"
              step="0.001"
              value={netWeightKg}
              onChange={(e) => setNetWeightKg(Number(e.target.value))}
              className="w-full border border-border rounded-lg p-2 bg-background text-foreground"
            />
          </div>

          <div>
            <label className="font-medium text-foreground block mb-1">Gross Weight (kg)</label>
            <input
              type="number"
              step="0.001"
              value={grossWeightKg}
              onChange={(e) => setGrossWeightKg(Number(e.target.value))}
              className="w-full border border-border rounded-lg p-2 bg-background text-foreground font-bold"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-foreground block mb-1">Packing Inspection Remarks</label>
          <textarea
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full text-xs border border-border rounded-lg p-2 bg-background text-foreground"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onSubmit({
                totalPackages,
                packageType,
                grossWeightKg,
                netWeightKg,
                remarks,
              })
            }
            disabled={isLoading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            {isLoading ? 'Saving...' : 'Confirm Packing'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// Subcomponent: Dispatch Clearance Modal
// ----------------------------------------------------------------------------
interface DispatchClearanceModalProps {
  challanId: number;
  lookups?: ChallanLookups;
  onClose: () => void;
  onSubmit: (payload: {
    vehicleNo?: string;
    transporterName?: string;
    lrRrNo?: string;
    lrRrDate?: string;
    eWayBillNo?: string;
    remarks?: string;
  }) => void;
  isLoading: boolean;
}

const DispatchClearanceModal: React.FC<DispatchClearanceModalProps> = ({
  challanId,
  lookups,
  onClose,
  onSubmit,
  isLoading,
}) => {
  const [vehicleNo, setVehicleNo] = useState<string>('GJ-01-BX-8821');
  const [transporterName, setTransporterName] = useState<string>('V-Trans (India) Limited');
  const [lrRrNo, setLrRrNo] = useState<string>('LR-789012');
  const [lrRrDate, setLrRrDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [eWayBillNo, setEWayBillNo] = useState<string>('EWB-2627-891023');
  const [remarks, setRemarks] = useState<string>('Vehicle inspected, driver documents verified, outward gate pass issued.');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-background border border-border w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-950/60 rounded-xl text-emerald-600">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Gate Outward Dispatch Clearance</h3>
            <p className="text-xs text-muted-foreground">
              Final transport departure checkpoint: triggers stock ledger deduction and updates Sales Order
            </p>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-xs text-emerald-900 dark:text-emerald-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Automated Inventory Ledger Posting:</span> Confirming dispatch will immediately deduct finished goods on-hand quantities from warehouse storage bins, log an immutable <code className="font-mono font-bold">SALES_DISPATCH</code> entry in the stock ledger, and update deliverable quantities on the linked Sales Order.
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="font-medium text-foreground block mb-1">Vehicle Registration No *</label>
            <input
              type="text"
              value={vehicleNo}
              onChange={(e) => setVehicleNo(e.target.value)}
              className="w-full border border-border rounded-lg p-2 bg-background text-foreground font-mono font-semibold"
            />
          </div>

          <div>
            <label className="font-medium text-foreground block mb-1">Transporter Name</label>
            <input
              type="text"
              value={transporterName}
              onChange={(e) => setTransporterName(e.target.value)}
              className="w-full border border-border rounded-lg p-2 bg-background text-foreground"
            />
          </div>

          <div>
            <label className="font-medium text-foreground block mb-1">LR / Consignment Note No</label>
            <input
              type="text"
              value={lrRrNo}
              onChange={(e) => setLrRrNo(e.target.value)}
              className="w-full border border-border rounded-lg p-2 bg-background text-foreground font-mono"
            />
          </div>

          <div>
            <label className="font-medium text-foreground block mb-1">LR Date</label>
            <input
              type="date"
              value={lrRrDate}
              onChange={(e) => setLrRrDate(e.target.value)}
              className="w-full border border-border rounded-lg p-2 bg-background text-foreground"
            />
          </div>

          <div className="col-span-2">
            <label className="font-medium text-foreground block mb-1">GST E-Way Bill Number</label>
            <input
              type="text"
              value={eWayBillNo}
              onChange={(e) => setEWayBillNo(e.target.value)}
              className="w-full border border-border rounded-lg p-2 bg-background text-foreground font-mono"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-foreground block mb-1">Gate Pass / Security Remarks</label>
          <textarea
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className="w-full text-xs border border-border rounded-lg p-2 bg-background text-foreground"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onSubmit({
                vehicleNo,
                transporterName,
                lrRrNo,
                lrRrDate,
                eWayBillNo,
                remarks,
              })
            }
            disabled={isLoading}
            className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
          >
            <Truck className="w-4 h-4" />
            {isLoading ? 'Posting Dispatch...' : 'Clear for Outward Dispatch'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------
// Subcomponent: Printable Rule 55 Delivery Challan Modal
// ----------------------------------------------------------------------------
interface PrintableDeliveryChallanModalProps {
  challan: DeliveryChallan;
  branch: any;
  onClose: () => void;
}

const PrintableDeliveryChallanModal: React.FC<PrintableDeliveryChallanModalProps> = ({
  challan,
  branch,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white text-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Modal Top Bar */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-600" />
            <span className="font-bold text-sm">Print Statutory Delivery Challan (Rule 55 CGST)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 flex items-center gap-1"
            >
              <Printer className="w-3.5 h-3.5" />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 rounded text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet */}
        <div className="flex-1 overflow-y-auto p-8 space-y-6 text-[12px] leading-relaxed font-sans" id="printable-challan">
          {/* Header & Logo */}
          <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900">
                KASHVIRA MANUFACTURING TECHNOLOGIES PVT. LTD.
              </h1>
              <div className="text-xs text-slate-600 mt-1">
                Plot No. 42-45, Phase II, GIDC Industrial Estate, Vatva, Ahmedabad, Gujarat 382445
              </div>
              <div className="text-xs text-slate-600 mt-0.5 font-mono">
                CIN: U29200GJ2020PTC118921 | GSTIN: {branch?.gstin || '24AAACK8821Q1ZM'} | PAN: AAACK8821Q
              </div>
            </div>
            <div className="text-right">
              <div className="inline-block px-3 py-1 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded">
                DELIVERY CHALLAN
              </div>
              <div className="text-[10px] text-slate-500 mt-1 italic font-medium">
                (Issued under Rule 55 of CGST Rules, 2017)
              </div>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-4 border border-slate-300 p-3 rounded">
            <div className="space-y-1">
              <div><span className="font-semibold text-slate-700">Challan No:</span> <span className="font-mono font-bold text-slate-900">{challan.challan_no}</span></div>
              <div><span className="font-semibold text-slate-700">Challan Date:</span> <span className="font-medium text-slate-900">{formatDate(challan.challan_date)}</span></div>
              <div><span className="font-semibold text-slate-700">Sales Order Ref:</span> <span className="font-mono text-slate-900">{challan.so_no || 'Direct Transfer'}</span></div>
              <div><span className="font-semibold text-slate-700">Customer PO No:</span> <span className="font-mono text-slate-900">{challan.customer_po_no || '—'}</span></div>
              <div><span className="font-semibold text-slate-700">Dispatch Purpose:</span> <span className="font-bold text-slate-900 uppercase">{challan.dispatch_purpose.replace(/_/g, ' ')}</span></div>
            </div>
            <div className="space-y-1">
              <div><span className="font-semibold text-slate-700">Vehicle No:</span> <span className="font-mono font-bold text-slate-900">{challan.vehicle_no || '—'}</span></div>
              <div><span className="font-semibold text-slate-700">Transporter:</span> <span className="text-slate-900">{challan.transporter_name || 'Own Fleet'}</span></div>
              <div><span className="font-semibold text-slate-700">LR / RR No & Date:</span> <span className="font-mono text-slate-900">{challan.lr_rr_no ? `${challan.lr_rr_no} (${formatDate(challan.lr_rr_date)})` : '—'}</span></div>
              <div><span className="font-semibold text-slate-700">E-Way Bill No:</span> <span className="font-mono font-bold text-slate-900">{challan.e_way_bill_no || 'Not Required / Excluded'}</span></div>
              <div><span className="font-semibold text-slate-700">Delivery Terms:</span> <span className="text-slate-900">{challan.delivery_terms}</span></div>
            </div>
          </div>

          {/* Addresses: Bill-To & Ship-To */}
          <div className="grid grid-cols-2 gap-4 border border-slate-300 p-3 rounded">
            <div>
              <div className="font-bold text-slate-900 uppercase text-[11px] border-b border-slate-200 pb-1 mb-1">
                Billed To (Customer):
              </div>
              <div className="font-bold text-slate-900">{challan.customer_name}</div>
              <div className="text-slate-600 whitespace-pre-wrap">{challan.billing_address}</div>
              {challan.customer_gstin && (
                <div className="mt-1 font-mono font-semibold text-slate-800">GSTIN: {challan.customer_gstin}</div>
              )}
            </div>

            <div>
              <div className="font-bold text-slate-900 uppercase text-[11px] border-b border-slate-200 pb-1 mb-1">
                Shipped To (Consignee):
              </div>
              <div className="text-slate-600 whitespace-pre-wrap">{challan.shipping_address || challan.billing_address}</div>
              <div className="mt-1 font-medium text-slate-800">
                Place of Supply: {challan.shipping_state_name} (State Code: {challan.shipping_state_code})
              </div>
            </div>
          </div>

          {/* Table of Goods */}
          <div>
            <table className="w-full text-left border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-bold text-slate-800 uppercase tracking-wider border-b border-slate-300">
                  <th className="p-2 border-r border-slate-300 w-8">#</th>
                  <th className="p-2 border-r border-slate-300">Item Description</th>
                  <th className="p-2 border-r border-slate-300 w-16">HSN</th>
                  <th className="p-2 border-r border-slate-300 w-24">Batch / Heat</th>
                  <th className="p-2 border-r border-slate-300 text-right w-20">Quantity</th>
                  <th className="p-2 border-r border-slate-300 text-right w-24">Declared Rate</th>
                  <th className="p-2 text-right w-28">Total Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {challan.items?.map((itm, idx) => (
                  <tr key={idx}>
                    <td className="p-2 border-r border-slate-300 text-slate-500 font-medium">{idx + 1}</td>
                    <td className="p-2 border-r border-slate-300">
                      <div className="font-bold text-slate-900">{itm.item_name}</div>
                      <div className="text-[10px] font-mono text-slate-500">{itm.item_code}</div>
                    </td>
                    <td className="p-2 border-r border-slate-300 font-mono">{itm.hsn_sac_code || '—'}</td>
                    <td className="p-2 border-r border-slate-300 font-mono text-[10px]">
                      {itm.batch_no || 'Standard'}
                    </td>
                    <td className="p-2 border-r border-slate-300 text-right font-bold text-slate-900">
                      {itm.dispatched_qty.toLocaleString('en-IN', { maximumFractionDigits: 2 })} {itm.uom_code || 'Units'}
                    </td>
                    <td className="p-2 border-r border-slate-300 text-right font-mono">{formatInrDecimals(itm.unit_rate)}</td>
                    <td className="p-2 text-right font-bold font-mono text-slate-900">{formatInr(itm.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold border-t-2 border-slate-300">
                  <td colSpan={4} className="p-2 text-right border-r border-slate-300 uppercase">
                    Total Dispatched Goods
                  </td>
                  <td className="p-2 text-right border-r border-slate-300">
                    {challan.total_quantity.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-2 border-r border-slate-300"></td>
                  <td className="p-2 text-right font-mono text-slate-900">
                    {formatInr(challan.total_value)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Package Details & Declaration */}
          <div className="border border-slate-300 p-3 rounded space-y-2">
            <div className="flex justify-between font-medium">
              <div>Total Packages: <span className="font-bold text-slate-900">{challan.total_packages} {challan.package_type}</span></div>
              <div>Gross Weight: <span className="font-bold text-slate-900">{challan.gross_weight_kg.toFixed(2)} kg</span></div>
              <div>Net Weight: <span className="font-bold text-slate-900">{challan.net_weight_kg.toFixed(2)} kg</span></div>
            </div>
            <div className="text-[11px] text-slate-600 border-t border-slate-200 pt-2">
              <span className="font-bold text-slate-800">Statutory Declaration:</span> {challan.terms_and_conditions || 'This delivery challan is issued under Rule 55 of CGST Rules, 2017 for goods dispatched on sale or approval basis. Material is accompanied by physical and chemical inspection certificates.'}
            </div>
          </div>

          {/* Signature Blocks */}
          <div className="grid grid-cols-3 gap-6 pt-12 text-center text-xs">
            <div className="border-t border-slate-400 pt-2">
              <div className="font-bold text-slate-800">Prepared By</div>
              <div className="text-slate-500 text-[10px]">Stores / Dispatch Executive</div>
            </div>
            <div className="border-t border-slate-400 pt-2">
              <div className="font-bold text-slate-800">Verified & Packed By</div>
              <div className="text-slate-500 text-[10px]">Quality Inspector / Packaging Head</div>
            </div>
            <div className="border-t border-slate-400 pt-2">
              <div className="font-bold text-slate-800">For Kashvira Mfg Technologies Pvt Ltd</div>
              <div className="text-slate-500 text-[10px]">Authorized Signatory</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
