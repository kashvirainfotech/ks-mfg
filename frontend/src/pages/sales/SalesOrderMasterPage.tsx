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
  Coins,
  CreditCard,
  Download,
  Eye,
  Factory,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  Hammer,
  HelpCircle,
  Layers,
  MapPin,
  Package,
  PackageCheck,
  Pause,
  Pencil,
  Percent,
  Play,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  Truck,
  User,
  Users,
  Warehouse,
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

// ----------------------------------------------------------------------------
// Interfaces & Types
// ----------------------------------------------------------------------------
interface OrderSummary {
  totalOrders: number;
  activeOrdersCount: number;
  activeOrdersValue: number;
  pendingAtpCount: number;
  onHoldCount: number;
  readyDispatchCount: number;
  totalOrderValue: number;
}

interface OrderItem {
  so_item_id?: number;
  so_id?: number;
  item_sequence: number;
  item_id: number;
  item_code: string;
  item_name: string;
  description?: string | null;
  hsn_sac_code?: string | null;
  uom_id: number;
  uom_code?: string;
  uom_name?: string;
  ordered_qty: number;
  reserved_qty: number;
  delivered_qty: number;
  invoiced_qty: number;
  cancelled_qty: number;
  deficit_qty?: number;
  unit_rate: number;
  gross_amount: number;
  discount_percent: number;
  discount_amount: number;
  taxable_amount: number;
  gst_rate: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  total_tax_amount: number;
  total_amount: number;
  target_delivery_date?: string | null;
  reservation_status: 'PENDING' | 'PARTIAL' | 'FULL' | 'RELEASED';
  work_order_id?: number | null;
  work_order_no?: string | null;
  work_order_status?: string | null;
  live_available_stock?: number;
  remarks?: string | null;
}

interface SalesOrder {
  so_id: number;
  so_no: string;
  so_date: string;
  quotation_id?: number | null;
  quotation_no?: string | null;
  customer_id: number;
  customer_name: string;
  customer_po_no?: string | null;
  customer_po_date?: string | null;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  billing_address_id?: number | null;
  billing_address?: string | null;
  shipping_address_id?: number | null;
  shipping_address?: string | null;
  shipping_state_code: string;
  shipping_state_name: string;
  customer_gstin?: string | null;
  price_list_id?: number | null;
  currency_code: string;
  exchange_rate: number;
  target_delivery_date: string;
  payment_terms: string;
  delivery_terms: string;
  customer_credit_limit: number;
  current_credit_exposure: number;
  is_credit_limit_exceeded: boolean;
  credit_override_by?: number | null;
  credit_override_by_name?: string | null;
  credit_override_at?: string | null;
  credit_override_reason?: string | null;
  subtotal_amount: number;
  discount_percent: number;
  discount_amount: number;
  taxable_amount: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  total_tax_amount: number;
  freight_charges: number;
  packaging_charges: number;
  round_off: number;
  grand_total: number;
  status:
    | 'DRAFT'
    | 'CONFIRMED'
    | 'IN_PRODUCTION'
    | 'READY_FOR_DISPATCH'
    | 'PARTIALLY_DELIVERED'
    | 'COMPLETED'
    | 'CANCELLED'
    | 'ON_HOLD';
  atp_reservation_status: 'PENDING' | 'PARTIAL' | 'FULL' | 'RELEASED';
  confirmed_by?: number | null;
  confirmed_by_name?: string | null;
  confirmed_at?: string | null;
  hold_reason?: string | null;
  remarks?: string | null;
  terms_and_conditions?: string | null;
  created_date?: string;
  total_items?: number;
  total_ordered_qty?: number;
  total_reserved_qty?: number;
  total_deficit_qty?: number;
  linked_work_orders_count?: number;
  items?: OrderItem[];
}

interface OrderLookups {
  customers: Array<{
    party_id: number;
    party_code: string;
    party_name: string;
    trade_name?: string;
    credit_limit: number;
    credit_days: number;
    payment_terms: string;
    pan_no?: string;
    primary_contact_name?: string;
    primary_email?: string;
    primary_phone?: string;
    current_exposure: number;
  }>;
  addresses: Array<{
    address_id: number;
    party_id: number;
    address_type: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state_code: string;
    state_name: string;
    pincode: string;
    gstin?: string;
  }>;
  items: Array<{
    item_id: number;
    item_code: string;
    item_name: string;
    description?: string;
    item_type: string;
    hsn_code?: string;
    uom_id: number;
    uom_code: string;
    uom_name: string;
    standard_selling_rate: number;
    gst_rate: number;
    total_available_stock: number;
  }>;
  uoms: Array<{
    uom_id: number;
    uom_code: string;
    uom_name: string;
  }>;
  quotations: Array<{
    quotation_id: number;
    quotation_no: string;
    quotation_date: string;
    customer_id: number;
    customer_name: string;
    inquiry_ref_no?: string;
    inquiry_date?: string;
    grand_total: number;
    valid_until: string;
    status: string;
    payment_terms: string;
    delivery_terms: string;
    shipping_state_code: string;
    shipping_state_name: string;
    customer_gstin?: string;
  }>;
  warehouses: Array<{
    warehouse_id: number;
    warehouse_code: string;
    warehouse_name: string;
  }>;
  bins: Array<{
    bin_id: number;
    warehouse_id: number;
    bin_code: string;
    bin_name: string;
  }>;
  atpStock: Array<{
    bin_stock_id: number;
    warehouse_id: number;
    warehouse_code: string;
    bin_id: number;
    bin_code: string;
    item_id: number;
    item_code: string;
    batch_no?: string;
    on_hand_qty: number;
    reserved_qty: number;
    available_qty: number;
  }>;
}

// ----------------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------------
export const SalesOrderMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filter States
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [atpFilter, setAtpFilter] = useState<string>('ALL');
  const [holdOnlyFilter, setHoldOnlyFilter] = useState<boolean>(false);

  // Modal & Drawer States
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<SalesOrder | null>(null);
  const [inspectingOrder, setInspectingOrder] = useState<SalesOrder | null>(null);
  const [confirmingOrder, setConfirmingOrder] = useState<SalesOrder | null>(null);
  const [overridingOrder, setOverridingOrder] = useState<SalesOrder | null>(null);
  const [workOrderTarget, setWorkOrderTarget] = useState<SalesOrder | null>(null);
  const [holdingOrder, setHoldingOrder] = useState<SalesOrder | null>(null);
  const [printingOrder, setPrintingOrder] = useState<SalesOrder | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<SalesOrder | null>(null);

  // --------------------------------------------------------------------------
  // API Queries
  // --------------------------------------------------------------------------
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery<ApiResponse<OrderSummary>>({
    queryKey: ['sales-orders-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<OrderSummary>>('/sales/orders/summary');
      return res.data;
    },
  });

  const { data: lookupsData } = useQuery<ApiResponse<OrderLookups>>({
    queryKey: ['sales-orders-lookups'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<OrderLookups>>('/sales/orders/lookups');
      return res.data;
    },
  });

  const {
    data: ordersData,
    isLoading: isOrdersLoading,
    refetch: refetchOrders,
  } = useQuery<ApiResponse<SalesOrder[]>>({
    queryKey: ['sales-orders-list', statusFilter, atpFilter, customerFilter, holdOnlyFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (atpFilter !== 'ALL') params.append('atpReservationStatus', atpFilter);
      if (customerFilter !== 'ALL') params.append('customerId', customerFilter);
      if (holdOnlyFilter) params.append('isHold', 'true');
      const res = await apiClient.get<ApiResponse<SalesOrder[]>>(`/sales/orders?${params.toString()}`);
      return res.data;
    },
  });

  const summary = summaryData?.data;
  const lookups = lookupsData?.data;
  const orders: SalesOrder[] = Array.isArray(ordersData?.data)
    ? ordersData.data
    : Array.isArray((ordersData?.data as any)?.data)
    ? (ordersData?.data as any).data
    : [];

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: (payload: any) => apiClient.post('/sales/orders', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders-list'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders-summary'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders-lookups'] });
      setIsCreateModalOpen(false);
      setEditingOrder(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      apiClient.put(`/sales/orders/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders-list'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders-summary'] });
      setIsCreateModalOpen(false);
      setEditingOrder(null);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: ({ id, remarks }: { id: number; remarks?: string }) =>
      apiClient.post(`/sales/orders/${id}/confirm`, { remarks }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders-list'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders-summary'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders-lookups'] });
      setConfirmingOrder(null);
    },
  });

  const overrideMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiClient.post(`/sales/orders/${id}/credit-override`, { creditOverrideReason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders-list'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders-summary'] });
      setOverridingOrder(null);
    },
  });

  const createWoMutation = useMutation({
    mutationFn: ({ id, targetWarehouseId, remarks }: { id: number; targetWarehouseId?: number; remarks?: string }) =>
      apiClient.post(`/sales/orders/${id}/create-wo`, { targetWarehouseId, remarks }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders-list'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders-summary'] });
      setWorkOrderTarget(null);
    },
  });

  const holdMutation = useMutation({
    mutationFn: ({ id, isHold, holdReason }: { id: number; isHold: boolean; holdReason?: string }) =>
      apiClient.post(`/sales/orders/${id}/hold`, { isHold, holdReason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders-list'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders-summary'] });
      setHoldingOrder(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/sales/orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-orders-list'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders-summary'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders-lookups'] });
      setDeletingOrder(null);
    },
  });

  // Fetch full details for inspection
  const openInspector = async (order: SalesOrder) => {
    try {
      const res: any = await apiClient.get(`/sales/orders/${order.so_id}`);
      setInspectingOrder(res?.data || order);
    } catch {
      setInspectingOrder(order);
    }
  };

  const openPrinter = async (order: SalesOrder) => {
    try {
      const res: any = await apiClient.get(`/sales/orders/${order.so_id}`);
      setPrintingOrder(res?.data || order);
    } catch {
      setPrintingOrder(order);
    }
  };

  // --------------------------------------------------------------------------
  // Table Badges
  // --------------------------------------------------------------------------
  const getStatusBadge = (status: SalesOrder['status']) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
            <Clock className="w-3 h-3" /> Draft
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
            <CheckCircle2 className="w-3 h-3" /> Confirmed
          </span>
        );
      case 'IN_PRODUCTION':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-700">
            <Factory className="w-3 h-3" /> In Production
          </span>
        );
      case 'READY_FOR_DISPATCH':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
            <PackageCheck className="w-3 h-3" /> Ready for Dispatch
          </span>
        );
      case 'ON_HOLD':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
            <Pause className="w-3 h-3" /> On Hold
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 border border-teal-200 dark:border-teal-700">
            <FileCheck2 className="w-3 h-3" /> Completed
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 border border-rose-200 dark:border-rose-700">
            <X className="w-3 h-3" /> Cancelled
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const getAtpBadge = (status: SalesOrder['atp_reservation_status'], reserved = 0, ordered = 0) => {
    switch (status) {
      case 'FULL':
        return (
          <div className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
              <PackageCheck className="w-3 h-3" /> FULL ATP (100%)
            </span>
            <span className="text-[10px] text-gray-500">{reserved} / {ordered} units reserved</span>
          </div>
        );
      case 'PARTIAL':
        const pct = ordered > 0 ? Math.round((reserved / ordered) * 100) : 0;
        return (
          <div className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-700">
              <Boxes className="w-3 h-3" /> PARTIAL ({pct}%)
            </span>
            <div className="w-24 bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
              <div className="bg-amber-500 h-full rounded-full" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] text-gray-500">{reserved} / {ordered} units reserved</span>
          </div>
        );
      case 'PENDING':
        return (
          <div className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
              <Clock className="w-3 h-3" /> PENDING ALLOC
            </span>
            <span className="text-[10px] text-gray-500">0 / {ordered} units</span>
          </div>
        );
      case 'RELEASED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            RELEASED
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  const columns: MasterTableColumn<SalesOrder>[] = useMemo(
    () => [
      {
        key: 'so_no',
        header: 'Order Details',
        sortable: true,
        render: (row: SalesOrder) => (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-gray-100">{row.so_no}</span>
              {row.quotation_no && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                  from {row.quotation_no}
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
              <span>Date: {row.so_date}</span>
              {row.customer_po_no && (
                <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded text-gray-700 dark:text-gray-300">
                  PO: {row.customer_po_no}
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'customer_name',
        header: 'Customer & Destination',
        sortable: true,
        render: (row: SalesOrder) => (
          <div className="flex flex-col">
            <span className="font-medium text-gray-900 dark:text-gray-100">{row.customer_name}</span>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
              <MapPin className="w-3 h-3 text-gray-400" />
              <span>{row.shipping_state_name} ({row.shipping_state_code})</span>
              {row.contact_person && <span>• {row.contact_person}</span>}
            </div>
          </div>
        ),
      },
      {
        key: 'credit_status',
        header: 'Credit Check',
        sortable: true,
        render: (row: SalesOrder) => {
          if (row.credit_override_by) {
            return (
              <div className="flex flex-col">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" /> Override Approved
                </span>
                <span className="text-[10px] text-gray-500">by {row.credit_override_by_name}</span>
              </div>
            );
          }
          if (row.is_credit_limit_exceeded) {
            return (
              <div className="flex flex-col">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                  <ShieldAlert className="w-3.5 h-3.5" /> Limit Exceeded
                </span>
                <span className="text-[10px] text-gray-500">
                  Limit: {formatInr(row.customer_credit_limit)}
                </span>
              </div>
            );
          }
          return (
            <div className="flex flex-col">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="w-3.5 h-3.5" /> Within Limit
              </span>
              <span className="text-[10px] text-gray-500">
                Cap: {formatInr(row.customer_credit_limit)}
              </span>
            </div>
          );
        },
      },
      {
        key: 'atp_status',
        header: 'ATP Stock Reservation',
        sortable: true,
        render: (row: SalesOrder) =>
          getAtpBadge(row.atp_reservation_status, row.total_reserved_qty, row.total_ordered_qty),
      },
      {
        key: 'status',
        header: 'Order Status',
        sortable: true,
        render: (row: SalesOrder) => getStatusBadge(row.status),
      },
      {
        key: 'target_delivery_date',
        header: 'Target Delivery',
        sortable: true,
        render: (row: SalesOrder) => (
          <div className="flex flex-col text-xs">
            <span className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-gray-400" /> {row.target_delivery_date}
            </span>
            <span className="text-[10px] text-gray-500">{row.payment_terms} • {row.delivery_terms}</span>
          </div>
        ),
      },
      {
        key: 'grand_total',
        header: 'Contract Value',
        sortable: true,
        align: 'right',
        render: (row: SalesOrder) => (
          <div className="flex flex-col text-right">
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {formatInr(row.grand_total)}
            </span>
            <span className="text-[10px] text-gray-500">
              {row.total_items} items • GST {formatInr(row.total_tax_amount)}
            </span>
          </div>
        ),
      },
    ],
    [],
  );

  const groupByOptions: GroupByOption<SalesOrder>[] = useMemo(
    () => [
      { key: 'status', label: 'Order Status', groupValue: (row: SalesOrder) => row.status },
      { key: 'customer_name', label: 'Customer', groupValue: (row: SalesOrder) => row.customer_name },
      { key: 'atp_status', label: 'ATP Reservation', groupValue: (row: SalesOrder) => row.atp_reservation_status },
      {
        key: 'delivery_month',
        label: 'Target Delivery Month',
        groupValue: (row: SalesOrder) => (row.target_delivery_date ? row.target_delivery_date.substring(0, 7) : 'Unscheduled'),
      },
    ],
    [],
  );

  // Search Predicate with explicit boolean return
  const searchPredicate = (row: SalesOrder, query: string): boolean => {
    const q = query.toLowerCase().trim();
    return Boolean(
      (row.so_no && row.so_no.toLowerCase().includes(q)) ||
      (row.customer_name && row.customer_name.toLowerCase().includes(q)) ||
      (row.customer_po_no && row.customer_po_no.toLowerCase().includes(q)) ||
      (row.quotation_no && row.quotation_no.toLowerCase().includes(q)) ||
      (row.shipping_state_name && row.shipping_state_name.toLowerCase().includes(q)),
    );
  };

  return (
    <div className="space-y-6 p-6 max-w-[1600px] mx-auto">
      {/* -------------------------------------------------------------------- */}
      {/* 1. Header & Executive Summary Cards                                  */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-600/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 rounded-xl">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              Sales Orders & ATP Stock
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 font-medium">
                Screen 1034
              </span>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Customer Sales Contracts, Real-Time Commercial Credit Exposure & Available-to-Promise (ATP) Stock Reservation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => refetchOrders()}
            className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
            title="Refresh Orders"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Sales Orders</span>
            <div className="p-1.5 bg-blue-50 dark:bg-blue-950 text-blue-600 rounded-lg">
              <ShoppingCart className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {summary?.totalOrders ?? 0}
            </span>
            <p className="text-xs text-gray-500 mt-1">
              Active Value: <span className="font-semibold text-gray-900 dark:text-gray-100">{formatInr(summary?.totalOrderValue ?? 0)}</span>
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Active Execution</span>
            <div className="p-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 rounded-lg">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {summary?.activeOrdersCount ?? 0}
            </span>
            <p className="text-xs text-gray-500 mt-1">
              Booked: <span className="font-semibold text-indigo-600">{formatInr(summary?.activeOrdersValue ?? 0)}</span>
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Pending Stock Alloc</span>
            <div className="p-1.5 bg-purple-50 dark:bg-purple-950 text-purple-600 rounded-lg">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {summary?.pendingAtpCount ?? 0}
            </span>
            <p className="text-xs text-gray-500 mt-1">
              Deficit awaiting production WO
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Ready for Dispatch</span>
            <div className="p-1.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 rounded-lg">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {summary?.readyDispatchCount ?? 0}
            </span>
            <p className="text-xs text-gray-500 mt-1">
              100% Reserved & Packed
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-gray-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Credit / Admin Hold</span>
            <div className="p-1.5 bg-amber-50 dark:bg-amber-950 text-amber-600 rounded-lg">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <span className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {summary?.onHoldCount ?? 0}
            </span>
            <p className="text-xs text-gray-500 mt-1">
              Requires manager clearance
            </p>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2. Main Master Listing Table                                         */}
      {/* -------------------------------------------------------------------- */}
      <MasterDataTable<SalesOrder>
        title="Commercial Sales Orders Register"
        subtitle="Manage customer sales contracts, real-time commercial credit limits & available-to-promise inventory reservation"
        screenCode="SALES_ORDER"
        tableNameBadge="tbl_sales_order_header"
        data={orders}
        isLoading={isOrdersLoading}
        rowKey={(row) => row.so_id}
        columns={columns}
        searchPlaceholder="Search order #, customer, PO ref, state..."
        searchPredicate={searchPredicate}
        groupByOptions={groupByOptions}
        addButtonLabel="New Sales Order"
        onAddClick={() => {
          setEditingOrder(null);
          setIsCreateModalOpen(true);
        }}
        filterToolbarSlot={
          <div className="flex flex-wrap items-center gap-2">
            {/* Order Status Filter */}
            <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg px-2.5 py-1 border border-gray-200 dark:border-gray-700">
              <Filter className="w-3.5 h-3.5 text-gray-500" />
              <span className="text-xs text-gray-500 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs text-gray-900 dark:text-gray-100 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="CONFIRMED">Confirmed</option>
                <option value="IN_PRODUCTION">In Production</option>
                <option value="READY_FOR_DISPATCH">Ready for Dispatch</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>

            {/* Customer Filter */}
            {lookups?.customers && lookups.customers.length > 0 && (
              <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg px-2.5 py-1 border border-gray-200 dark:border-gray-700">
                <Users className="w-3.5 h-3.5 text-gray-500" />
                <span className="text-xs text-gray-500 font-medium">Customer:</span>
                <select
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="bg-transparent text-xs text-gray-900 dark:text-gray-100 focus:outline-none cursor-pointer max-w-[180px] truncate"
                >
                  <option value="ALL">All Customers</option>
                  {lookups.customers.map((c) => (
                    <option key={c.party_id} value={c.party_id}>
                      {c.party_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Credit / Hold Checkbox */}
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700">
              <input
                type="checkbox"
                checked={holdOnlyFilter}
                onChange={(e) => setHoldOnlyFilter(e.target.checked)}
                className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
              />
              <span>Credit / Hold Only</span>
            </label>
          </div>
        }
        renderRowActions={(row: SalesOrder) => (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {/* View / Inspect Drawer */}
            <button
              type="button"
              onClick={() => openInspector(row)}
              className="p-1.5 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
              title="Inspect Order & ATP Details"
            >
              <Eye className="w-4 h-4" />
            </button>

            {/* Print Official Acknowledgement */}
            <PermissionGate screen="SALES_ORDER" action="PRINT">
              <button
                type="button"
                onClick={() => openPrinter(row)}
                className="p-1.5 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                title="Print Order Acknowledgement Contract"
              >
                <Printer className="w-4 h-4" />
              </button>
            </PermissionGate>

            {/* Confirm & Reserve ATP Stock */}
            {row.status === 'DRAFT' && (
              <PermissionGate screen="SALES_ORDER" action="CONFIRM">
                <button
                  type="button"
                  onClick={() => setConfirmingOrder(row)}
                  className="p-1.5 text-blue-600 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-md transition-colors"
                  title="Confirm Order & Allocate Stock"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {/* Managerial Credit Override */}
            {row.is_credit_limit_exceeded && !row.credit_override_by && (
              <PermissionGate screen="SALES_ORDER" action="AUTHORIZE">
                <button
                  type="button"
                  onClick={() => setOverridingOrder(row)}
                  className="p-1.5 text-amber-600 hover:text-amber-800 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-md transition-colors"
                  title="Authorize Credit Override"
                >
                  <ShieldCheck className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {/* 1-Click Work Order Generator */}
            {['CONFIRMED', 'READY_FOR_DISPATCH'].includes(row.status) && (row.total_deficit_qty || 0) > 0 && (
              <PermissionGate screen="SALES_ORDER" action="CREATE_WO">
                <button
                  type="button"
                  onClick={() => setWorkOrderTarget(row)}
                  className="p-1.5 text-purple-600 hover:text-purple-800 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-md transition-colors"
                  title="Generate Production Work Order for Deficit Qty"
                >
                  <Hammer className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {/* Hold / Release */}
            <PermissionGate screen="SALES_ORDER" action="HOLD">
              <button
                type="button"
                onClick={() => setHoldingOrder(row)}
                className={`p-1.5 rounded-md transition-colors ${
                  row.status === 'ON_HOLD'
                    ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50'
                    : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50'
                }`}
                title={row.status === 'ON_HOLD' ? 'Release Hold' : 'Place on Hold'}
              >
                {row.status === 'ON_HOLD' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
              </button>
            </PermissionGate>

            {/* Edit (Draft or On Hold) */}
            {['DRAFT', 'ON_HOLD'].includes(row.status) && (
              <PermissionGate screen="SALES_ORDER" action="EDIT">
                <button
                  type="button"
                  onClick={() => {
                    setEditingOrder(row);
                    setIsCreateModalOpen(true);
                  }}
                  className="p-1.5 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
                  title="Edit Sales Order"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {/* Delete / Cancel */}
            {!['IN_PRODUCTION', 'COMPLETED', 'CANCELLED'].includes(row.status) && (
              <PermissionGate screen="SALES_ORDER" action="DELETE">
                <button
                  type="button"
                  onClick={() => setDeletingOrder(row)}
                  className="p-1.5 text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-colors"
                  title="Cancel & Release Reserved Stock"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}
          </div>
        )}
      />

      {/* -------------------------------------------------------------------- */}
      {/* 3. Create / Edit Sales Order Modal                                   */}
      {/* -------------------------------------------------------------------- */}
      {isCreateModalOpen && (
        <CreateEditOrderModal
          isOpen={isCreateModalOpen}
          initialData={editingOrder}
          lookups={lookups}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingOrder(null);
          }}
          onSubmit={(payload) => {
            if (editingOrder) {
              updateMutation.mutate({ id: editingOrder.so_id, payload });
            } else {
              createMutation.mutate(payload);
            }
          }}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 4. Order Details & ATP Inspection Drawer                             */}
      {/* -------------------------------------------------------------------- */}
      {inspectingOrder && (
        <OrderDetailsDrawer
          order={inspectingOrder}
          lookups={lookups}
          onClose={() => setInspectingOrder(null)}
          onConfirm={(so) => {
            setConfirmingOrder(so);
            setInspectingOrder(null);
          }}
          onCreditOverride={(so) => {
            setOverridingOrder(so);
            setInspectingOrder(null);
          }}
          onCreateWo={(so) => {
            setWorkOrderTarget(so);
            setInspectingOrder(null);
          }}
          onPrint={(so) => {
            openPrinter(so);
            setInspectingOrder(null);
          }}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 5. Confirm & ATP Reservation Modal                                   */}
      {/* -------------------------------------------------------------------- */}
      {confirmingOrder && (
        <ConfirmOrderModal
          order={confirmingOrder}
          lookups={lookups}
          isSubmitting={confirmMutation.isPending}
          onClose={() => setConfirmingOrder(null)}
          onConfirm={(remarks) => confirmMutation.mutate({ id: confirmingOrder.so_id, remarks })}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 6. Managerial Credit Override Modal                                  */}
      {/* -------------------------------------------------------------------- */}
      {overridingOrder && (
        <CreditOverrideModal
          order={overridingOrder}
          isSubmitting={overrideMutation.isPending}
          onClose={() => setOverridingOrder(null)}
          onConfirm={(reason) => overrideMutation.mutate({ id: overridingOrder.so_id, reason })}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 7. Generate Work Order Modal                                         */}
      {/* -------------------------------------------------------------------- */}
      {workOrderTarget && (
        <CreateWorkOrderModal
          order={workOrderTarget}
          lookups={lookups}
          isSubmitting={createWoMutation.isPending}
          onClose={() => setWorkOrderTarget(null)}
          onConfirm={(targetWarehouseId, remarks) =>
            createWoMutation.mutate({ id: workOrderTarget.so_id, targetWarehouseId, remarks })
          }
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 8. Hold / Release Modal                                              */}
      {/* -------------------------------------------------------------------- */}
      {holdingOrder && (
        <HoldOrderModal
          order={holdingOrder}
          isSubmitting={holdMutation.isPending}
          onClose={() => setHoldingOrder(null)}
          onConfirm={(isHold, reason) =>
            holdMutation.mutate({ id: holdingOrder.so_id, isHold, holdReason: reason })
          }
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 9. Printable Order Acknowledgement Modal                             */}
      {/* -------------------------------------------------------------------- */}
      {printingOrder && (
        <PrintOrderModal
          order={printingOrder}
          onClose={() => setPrintingOrder(null)}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 10. Delete Confirmation Modal                                        */}
      {/* -------------------------------------------------------------------- */}
      {deletingOrder && (
        <ConfirmDeleteModal
          isOpen={Boolean(deletingOrder)}
          entityType="Sales Order"
          entityName={`Order #${deletingOrder.so_no} (${deletingOrder.customer_name})`}
          entityCode={deletingOrder.so_no}
          isDeleting={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deletingOrder.so_id)}
          onClose={() => setDeletingOrder(null)}
        />
      )}
    </div>
  );
};

// ============================================================================
// Subcomponent: Create / Edit Sales Order Modal
// ============================================================================
interface CreateEditOrderModalProps {
  isOpen: boolean;
  initialData: SalesOrder | null;
  lookups?: OrderLookups;
  onClose: () => void;
  onSubmit: (payload: any) => void;
  isSubmitting: boolean;
}

const CreateEditOrderModal: React.FC<CreateEditOrderModalProps> = ({
  isOpen,
  initialData,
  lookups,
  onClose,
  onSubmit,
  isSubmitting,
}) => {
  const [selectedQuotationId, setSelectedQuotationId] = useState<string>(
    initialData?.quotation_id ? String(initialData.quotation_id) : '',
  );
  const [customerId, setCustomerId] = useState<number>(initialData?.customer_id || 1001);
  const [customerPoNo, setCustomerPoNo] = useState<string>(initialData?.customer_po_no || '');
  const [customerPoDate, setCustomerPoDate] = useState<string>(
    initialData?.customer_po_date || new Date().toISOString().split('T')[0],
  );
  const [contactPerson, setContactPerson] = useState<string>(initialData?.contact_person || '');
  const [contactEmail, setContactEmail] = useState<string>(initialData?.contact_email || '');
  const [contactPhone, setContactPhone] = useState<string>(initialData?.contact_phone || '');
  const [shippingStateCode, setShippingStateCode] = useState<string>(initialData?.shipping_state_code || '24');
  const [shippingStateName, setShippingStateName] = useState<string>(initialData?.shipping_state_name || 'Gujarat');
  const [shippingAddress, setShippingAddress] = useState<string>(initialData?.shipping_address || '');
  const [billingAddress, setBillingAddress] = useState<string>(initialData?.billing_address || '');
  const [paymentTerms, setPaymentTerms] = useState<string>(initialData?.payment_terms || 'NET_30');
  const [deliveryTerms, setDeliveryTerms] = useState<string>(initialData?.delivery_terms || 'EX_WORKS');
  const [targetDeliveryDate, setTargetDeliveryDate] = useState<string>(
    initialData?.target_delivery_date || new Date(Date.now() + 21 * 86400000).toISOString().split('T')[0],
  );
  const [freightCharges, setFreightCharges] = useState<number>(initialData?.freight_charges || 0);
  const [packagingCharges, setPackagingCharges] = useState<number>(initialData?.packaging_charges || 0);
  const [remarks, setRemarks] = useState<string>(initialData?.remarks || '');
  const [terms, setTerms] = useState<string>(
    initialData?.terms_and_conditions ||
      '1. Prices are valid as per standard commercial contract. 2. Standard manufacturer warranty applies. 3. Disputes subject to Ahmedabad jurisdiction.',
  );

  // Line items state
  const [items, setItems] = useState<OrderItem[]>(
    initialData?.items && initialData.items.length > 0
      ? initialData.items
      : [
          {
            item_sequence: 1,
            item_id: lookups?.items[0]?.item_id || 1009,
            item_code: lookups?.items[0]?.item_code || 'FG-AUTO-MNT-DRV',
            item_name: lookups?.items[0]?.item_name || 'Automotive Hydromount Assembly',
            uom_id: lookups?.items[0]?.uom_id || 1003,
            uom_code: lookups?.items[0]?.uom_code || 'NOS',
            ordered_qty: 100,
            reserved_qty: 0,
            delivered_qty: 0,
            invoiced_qty: 0,
            cancelled_qty: 0,
            unit_rate: lookups?.items[0]?.standard_selling_rate || 1850,
            gross_amount: 185000,
            discount_percent: 0,
            discount_amount: 0,
            taxable_amount: 185000,
            gst_rate: lookups?.items[0]?.gst_rate || 28,
            cgst_rate: 0,
            cgst_amount: 0,
            sgst_rate: 0,
            sgst_amount: 0,
            igst_rate: 28,
            igst_amount: 51800,
            total_tax_amount: 51800,
            total_amount: 236800,
            reservation_status: 'PENDING',
          },
        ],
  );

  // When quotation is selected, pull entire quotation details!
  const handleQuotationChange = async (quotIdStr: string) => {
    setSelectedQuotationId(quotIdStr);
    if (!quotIdStr) return;

    try {
      const res: any = await apiClient.get(`/sales/quotations/${quotIdStr}`);
      const q = res?.data;
      if (q) {
        setCustomerId(q.customer_id);
        setContactPerson(q.contact_person || '');
        setContactEmail(q.contact_email || '');
        setContactPhone(q.contact_phone || '');
        setShippingStateCode(q.shipping_state_code || '24');
        setShippingStateName(q.shipping_state_name || 'Gujarat');
        setShippingAddress(q.shipping_address || '');
        setBillingAddress(q.billing_address || '');
        setPaymentTerms(q.payment_terms || 'NET_30');
        setDeliveryTerms(q.delivery_terms || 'EX_WORKS');
        setFreightCharges(q.freight_charges || 0);
        setPackagingCharges(q.packaging_charges || 0);
        setRemarks(`Generated from Quotation #${q.quotation_no}. ${q.remarks || ''}`);
        if (q.inquiry_ref_no) setCustomerPoNo(q.inquiry_ref_no);
        if (q.inquiry_date) setCustomerPoDate(q.inquiry_date);

        if (q.items && q.items.length > 0) {
          const mappedItems: OrderItem[] = q.items.map((qi: any, idx: number) => ({
            item_sequence: idx + 1,
            item_id: qi.item_id,
            item_code: qi.item_code,
            item_name: qi.item_name,
            description: qi.description,
            hsn_sac_code: qi.hsn_sac_code,
            uom_id: qi.uom_id,
            uom_code: qi.uom_code,
            ordered_qty: qi.quantity,
            reserved_qty: 0,
            delivered_qty: 0,
            invoiced_qty: 0,
            cancelled_qty: 0,
            unit_rate: qi.unit_rate,
            gross_amount: qi.gross_amount,
            discount_percent: qi.discount_percent || 0,
            discount_amount: qi.discount_amount || 0,
            taxable_amount: qi.taxable_amount,
            gst_rate: qi.gst_rate || 18,
            cgst_rate: qi.cgst_rate || 0,
            cgst_amount: qi.cgst_amount || 0,
            sgst_rate: qi.sgst_rate || 0,
            sgst_amount: qi.sgst_amount || 0,
            igst_rate: qi.igst_rate || 0,
            igst_amount: qi.igst_amount || 0,
            total_tax_amount: qi.total_tax_amount || 0,
            total_amount: qi.total_amount,
            reservation_status: 'PENDING',
          }));
          setItems(mappedItems);
        }
      }
    } catch (e) {
      console.error('Failed to pull quotation details:', e);
    }
  };

  // Live Customer Credit Exposure Calculation
  const selectedCustomer = lookups?.customers.find((c) => c.party_id === customerId);
  const customerCreditLimit = selectedCustomer?.credit_limit || 0;
  const currentExposure = selectedCustomer?.current_exposure || 0;

  // Taxes & Totals
  const isInterState = shippingStateCode !== '24';

  const recalculatedItems = useMemo(() => {
    return items.map((item, idx) => {
      const qty = Number(item.ordered_qty || 0);
      const rate = Number(item.unit_rate || 0);
      const gross = qty * rate;
      const discPct = Number(item.discount_percent || 0);
      const discAmt = (gross * discPct) / 100;
      const taxable = gross - discAmt;
      const gst = Number(item.gst_rate ?? 18);

      let cgstR = 0, cgstA = 0, sgstR = 0, sgstA = 0, igstR = 0, igstA = 0;
      if (isInterState) {
        igstR = gst;
        igstA = (taxable * igstR) / 100;
      } else {
        cgstR = gst / 2;
        cgstA = (taxable * cgstR) / 100;
        sgstR = gst / 2;
        sgstA = (taxable * sgstR) / 100;
      }

      const totalTax = cgstA + sgstA + igstA;
      const total = taxable + totalTax;

      return {
        ...item,
        item_sequence: idx + 1,
        gross_amount: gross,
        discount_amount: discAmt,
        taxable_amount: taxable,
        cgst_rate: cgstR,
        cgst_amount: cgstA,
        sgst_rate: sgstR,
        sgst_amount: sgstA,
        igst_rate: igstR,
        igst_amount: igstA,
        total_tax_amount: totalTax,
        total_amount: total,
      };
    });
  }, [items, isInterState]);

  const subtotal = recalculatedItems.reduce((acc, i) => acc + (i.taxable_amount || 0), 0);
  const taxTotal = recalculatedItems.reduce((acc, i) => acc + (i.total_tax_amount || 0), 0);
  const grandTotal = subtotal + taxTotal + Number(freightCharges || 0) + Number(packagingCharges || 0);

  // Projected credit check
  const projectedExposure = currentExposure + grandTotal;
  const isExceeded = customerCreditLimit > 0 && projectedExposure > customerCreditLimit;

  const handleItemChange = (index: number, field: string, val: any) => {
    const updated = [...items];
    const current = { ...updated[index], [field]: val };

    if (field === 'item_id') {
      const itm = lookups?.items.find((i) => i.item_id === Number(val));
      if (itm) {
        current.item_code = itm.item_code;
        current.item_name = itm.item_name;
        current.uom_id = itm.uom_id;
        current.uom_code = itm.uom_code;
        current.unit_rate = itm.standard_selling_rate || 0;
        current.gst_rate = itm.gst_rate || 18;
      }
    }

    updated[index] = current;
    setItems(updated);
  };

  const addItemRow = () => {
    const def = lookups?.items[0];
    setItems([
      ...items,
      {
        item_sequence: items.length + 1,
        item_id: def?.item_id || 1009,
        item_code: def?.item_code || 'FG-ITEM',
        item_name: def?.item_name || 'Standard FG Item',
        uom_id: def?.uom_id || 1003,
        uom_code: def?.uom_code || 'NOS',
        ordered_qty: 10,
        reserved_qty: 0,
        delivered_qty: 0,
        invoiced_qty: 0,
        cancelled_qty: 0,
        unit_rate: def?.standard_selling_rate || 1000,
        gross_amount: 10000,
        discount_percent: 0,
        discount_amount: 0,
        taxable_amount: 10000,
        gst_rate: def?.gst_rate || 18,
        cgst_rate: 0,
        cgst_amount: 0,
        sgst_rate: 0,
        sgst_amount: 0,
        igst_rate: 18,
        igst_amount: 1800,
        total_tax_amount: 1800,
        total_amount: 11800,
        reservation_status: 'PENDING',
      },
    ]);
  };

  const removeItemRow = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      quotationId: selectedQuotationId ? Number(selectedQuotationId) : null,
      customerId,
      customerName: selectedCustomer?.party_name,
      customerPoNo,
      customerPoDate,
      contactPerson,
      contactEmail,
      contactPhone,
      shippingStateCode,
      shippingStateName,
      shippingAddress,
      billingAddress,
      paymentTerms,
      deliveryTerms,
      targetDeliveryDate,
      freightCharges: Number(freightCharges),
      packagingCharges: Number(packagingCharges),
      remarks,
      termsAndConditions: terms,
      items: recalculatedItems.map((it) => ({
        itemId: it.item_id,
        itemCode: it.item_code,
        itemName: it.item_name,
        uomId: it.uom_id,
        orderedQty: Number(it.ordered_qty),
        unitRate: Number(it.unit_rate),
        discountPercent: Number(it.discount_percent || 0),
        gstRate: Number(it.gst_rate || 18),
        remarks: it.remarks,
      })),
    };
    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-5xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600/10 text-indigo-600 rounded-lg">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {initialData ? `Edit Sales Order #${initialData.so_no}` : 'Create Commercial Sales Order'}
              </h2>
              <p className="text-xs text-gray-500">Legal contract & available-to-promise inventory reservation</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quick Import from Accepted Quotation */}
          {!initialData && (
            <div className="bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <div>
                  <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                    Import from Accepted Quotation
                  </span>
                  <p className="text-[11px] text-indigo-800 dark:text-indigo-300">
                    Auto-populate customer, terms, pricing & line items directly from Step 7.1 quotations
                  </p>
                </div>
              </div>
              <div className="w-full sm:w-72">
                <select
                  value={selectedQuotationId}
                  onChange={(e) => handleQuotationChange(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Direct Sales Order (No Quote) --</option>
                  {lookups?.quotations.map((q) => (
                    <option key={q.quotation_id} value={q.quotation_id}>
                      {q.quotation_no} - {q.customer_name} ({formatInr(q.grand_total)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Customer & Commercial Credit Live Card */}
          <div className="bg-gray-50 dark:bg-gray-850 p-4 rounded-xl border border-gray-200 dark:border-gray-750 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-gray-200 dark:border-gray-700">
              <div className="w-full sm:w-1/2">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Customer Party *
                </label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(Number(e.target.value))}
                  disabled={Boolean(selectedQuotationId)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-indigo-500"
                >
                  {lookups?.customers.map((c) => (
                    <option key={c.party_id} value={c.party_id}>
                      {c.party_name} ({c.party_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Live Credit Exposure Headroom Badge */}
              <div className="flex items-center gap-3 bg-white dark:bg-gray-800 px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                <div className={`p-2 rounded-lg ${isExceeded ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {isExceeded ? <ShieldAlert className="w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-medium text-gray-500">Commercial Credit Cap</div>
                  <div className="text-xs font-bold text-gray-900 dark:text-gray-100">
                    {formatInr(customerCreditLimit)}
                  </div>
                  <div className="text-[10px] text-gray-500">
                    Exposure: {formatInr(currentExposure)} → Projected: <span className={isExceeded ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>{formatInr(projectedExposure)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Over-Credit Alert Banner */}
            {isExceeded && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-300">
                <AlertCircle className="w-4 h-4 text-rose-600 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="font-bold">Commercial Credit Limit Exceeded! </span>
                  This order will be automatically flagged and placed <span className="font-bold underline">ON HOLD</span> upon creation. An authorized manager credit override will be required before order confirmation and ATP stock allocation.
                </div>
              </div>
            )}

            {/* PO Reference & Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Customer PO Ref #</label>
                <input
                  type="text"
                  placeholder="e.g. PO/MSIL/2026/091"
                  value={customerPoNo}
                  onChange={(e) => setCustomerPoNo(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Customer PO Date</label>
                <input
                  type="date"
                  value={customerPoDate}
                  onChange={(e) => setCustomerPoDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Target Delivery Date *</label>
                <input
                  type="date"
                  value={targetDeliveryDate}
                  onChange={(e) => setTargetDeliveryDate(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Destination State Code</label>
                <input
                  type="text"
                  value={shippingStateCode}
                  onChange={(e) => setShippingStateCode(e.target.value)}
                  placeholder="e.g. 24 (Gujarat) or 06"
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Commercial terms */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Terms</label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="e.g. NET_30, NET_45, ADVANCE"
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div>
                <label className="block font-medium text-gray-700 dark:text-gray-300 mb-1">Delivery / Incoterms</label>
                <input
                  type="text"
                  value={deliveryTerms}
                  onChange={(e) => setDeliveryTerms(e.target.value)}
                  placeholder="e.g. EX_WORKS, FOR_DESTINATION"
                  className="w-full px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          </div>

          {/* Line Items Table with Live Stock Pill */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" /> Order Items & Required Quantities
              </h3>
              <button
                type="button"
                onClick={addItemRow}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-semibold transition-colors border border-indigo-200 dark:border-indigo-800"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>

            <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 dark:bg-gray-850 text-gray-500 font-semibold border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="py-2 px-3 w-10">#</th>
                    <th className="py-2 px-3 min-w-[200px]">Item & Live Stock</th>
                    <th className="py-2 px-3 w-24">Ordered Qty</th>
                    <th className="py-2 px-3 w-28">Unit Rate (₹)</th>
                    <th className="py-2 px-3 w-20">Disc %</th>
                    <th className="py-2 px-3 w-20">GST %</th>
                    <th className="py-2 px-3 w-32 text-right">Taxable (₹)</th>
                    <th className="py-2 px-3 w-32 text-right">Total (₹)</th>
                    <th className="py-2 px-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {recalculatedItems.map((item, idx) => {
                    const matchedItem = lookups?.items.find((i) => i.item_id === item.item_id);
                    const liveAvailStock = matchedItem?.total_available_stock || 0;

                    return (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-850/50">
                        <td className="py-2 px-3 font-mono text-gray-400">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <select
                            value={item.item_id}
                            onChange={(e) => handleItemChange(idx, 'item_id', Number(e.target.value))}
                            className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          >
                            {lookups?.items.map((it) => (
                              <option key={it.item_id} value={it.item_id}>
                                {it.item_code} - {it.item_name}
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-gray-500">
                            <span className="font-mono bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 px-1 rounded">
                              On-Hand ATP: {liveAvailStock} {item.uom_code || 'NOS'}
                            </span>
                            {item.ordered_qty > liveAvailStock && (
                              <span className="text-amber-600 font-medium">
                                (Deficit: {item.ordered_qty - liveAvailStock})
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={item.ordered_qty}
                            onChange={(e) => handleItemChange(idx, 'ordered_qty', Number(e.target.value))}
                            className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-right font-medium"
                          />
                        </td>

                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unit_rate}
                            onChange={(e) => handleItemChange(idx, 'unit_rate', Number(e.target.value))}
                            className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-right"
                          />
                        </td>

                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="any"
                            value={item.discount_percent}
                            onChange={(e) => handleItemChange(idx, 'discount_percent', Number(e.target.value))}
                            className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-right"
                          />
                        </td>

                        <td className="py-2 px-3">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={item.gst_rate}
                            onChange={(e) => handleItemChange(idx, 'gst_rate', Number(e.target.value))}
                            className="w-full px-2 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-right"
                          />
                        </td>

                        <td className="py-2 px-3 text-right font-medium text-gray-900 dark:text-gray-100">
                          {formatInr(item.taxable_amount)}
                        </td>

                        <td className="py-2 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                          {formatInr(item.total_amount)}
                        </td>

                        <td className="py-2 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => removeItemRow(idx)}
                            disabled={items.length <= 1}
                            className="p-1 text-gray-400 hover:text-rose-600 disabled:opacity-30 rounded"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Charges & Summary Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 dark:bg-gray-850 p-4 rounded-xl border border-gray-200 dark:border-gray-750">
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase text-gray-500">Shipping & Commercial Charges</h4>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-1">Freight (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={freightCharges}
                    onChange={(e) => setFreightCharges(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
                <div>
                  <label className="block text-gray-700 dark:text-gray-300 mb-1">Packaging (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={packagingCharges}
                    onChange={(e) => setPackagingCharges(Number(e.target.value))}
                    className="w-full px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-700 dark:text-gray-300 mb-1">Order Remarks / Dispatch Notes</label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Special customer packaging instructions or delivery milestones..."
                  className="w-full px-3 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            {/* Financial Summary */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold uppercase text-gray-500 mb-2">Statutory GST & Total Summary</h4>
              <div className="flex justify-between text-gray-600 dark:text-gray-400 py-1 border-b border-gray-200 dark:border-gray-700">
                <span>Taxable Subtotal:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{formatInr(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400 py-1 border-b border-gray-200 dark:border-gray-700">
                <span>Total GST ({isInterState ? 'IGST' : 'CGST + SGST'}):</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{formatInr(taxTotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400 py-1 border-b border-gray-200 dark:border-gray-700">
                <span>Freight & Packaging:</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {formatInr(Number(freightCharges || 0) + Number(packagingCharges || 0))}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-900 dark:text-gray-100 pt-2">
                <span>Grand Total:</span>
                <span className="text-indigo-600 dark:text-indigo-400">{formatInr(grandTotal)}</span>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="text-xs text-gray-500">
            {recalculatedItems.length} items configured • {isExceeded ? '⚠️ Will be created ON_HOLD' : '✓ Normal DRAFT'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving Order...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> {initialData ? 'Update Sales Order' : 'Create Sales Order'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Subcomponent: Order Details & ATP Inspection Drawer
// ============================================================================
interface OrderDetailsDrawerProps {
  order: SalesOrder;
  lookups?: OrderLookups;
  onClose: () => void;
  onConfirm: (order: SalesOrder) => void;
  onCreditOverride: (order: SalesOrder) => void;
  onCreateWo: (order: SalesOrder) => void;
  onPrint: (order: SalesOrder) => void;
}

const OrderDetailsDrawer: React.FC<OrderDetailsDrawerProps> = ({
  order,
  lookups,
  onClose,
  onConfirm,
  onCreditOverride,
  onCreateWo,
  onPrint,
}) => {
  const [activeTab, setActiveTab] = useState<'ITEMS_ATP' | 'CREDIT' | 'PRODUCTION' | 'TERMS'>('ITEMS_ATP');

  const deficitItems = (order.items || []).filter((i) => (i.ordered_qty || 0) > (i.reserved_qty || 0));

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-3xl bg-white dark:bg-gray-850 h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-700 animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600/10 text-indigo-600 rounded-lg">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{order.so_no}</h2>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-semibold">
                  {order.status}
                </span>
              </div>
              <p className="text-xs text-gray-500">{order.customer_name} • Date: {order.so_date}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPrint(order)}
              className="p-1.5 text-gray-500 hover:text-blue-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Print Order Acknowledgement"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 px-6 bg-gray-50 dark:bg-gray-850 gap-6 text-xs font-semibold text-gray-500">
          <button
            type="button"
            onClick={() => setActiveTab('ITEMS_ATP')}
            className={`py-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'ITEMS_ATP'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent hover:text-gray-700'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" /> Items & ATP Stock
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('CREDIT')}
            className={`py-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'CREDIT'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent hover:text-gray-700'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Commercial Credit
            {order.is_credit_limit_exceeded && (
              <span className="w-2 h-2 rounded-full bg-rose-500" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PRODUCTION')}
            className={`py-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'PRODUCTION'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent hover:text-gray-700'
            }`}
          >
            <Factory className="w-3.5 h-3.5" /> Work Orders ({deficitItems.length} Deficit)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('TERMS')}
            className={`py-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'TERMS'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent hover:text-gray-700'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Terms & GST
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* TAB 1: ITEMS & ATP RESERVATION */}
          {activeTab === 'ITEMS_ATP' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-bold text-gray-900 dark:text-gray-100">
                  Line Items ({order.items?.length || 0})
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  ATP Status: {order.atp_reservation_status}
                </span>
              </div>

              <div className="space-y-3">
                {order.items?.map((it, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{it.item_name}</span>
                        <div className="font-mono text-gray-500 text-[11px]">{it.item_code} • HSN: {it.hsn_sac_code || '8481'}</div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatInr(it.total_amount)}</span>
                        <div className="text-[10px] text-gray-400">@ {formatInr(it.unit_rate)}/{it.uom_code}</div>
                      </div>
                    </div>

                    {/* Stock Allocation Progress */}
                    <div className="bg-white dark:bg-gray-850 p-2.5 rounded-lg border border-gray-200 dark:border-gray-750 flex items-center justify-between text-[11px]">
                      <div>
                        <span className="text-gray-500">Ordered: </span>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{it.ordered_qty} {it.uom_code}</span>
                        <span className="mx-2 text-gray-300">|</span>
                        <span className="text-gray-500">Reserved: </span>
                        <span className="font-bold text-emerald-600">{it.reserved_qty} {it.uom_code}</span>
                        <span className="mx-2 text-gray-300">|</span>
                        <span className="text-gray-500">Deficit: </span>
                        <span className="font-bold text-amber-600">
                          {it.ordered_qty - it.reserved_qty} {it.uom_code}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        it.reservation_status === 'FULL'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : it.reservation_status === 'PARTIAL'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}>
                        {it.reservation_status}
                      </span>
                    </div>

                    {/* Linked Work Order Badge if any */}
                    {it.work_order_id && (
                      <div className="flex items-center gap-2 text-[11px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 p-2 rounded-lg border border-purple-200 dark:border-purple-800">
                        <Factory className="w-3.5 h-3.5" />
                        <span>Linked Production Work Order: <strong className="font-mono">{it.work_order_no || `WO-#${it.work_order_id}`}</strong> ({it.work_order_status || 'DRAFT'})</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 2: COMMERCIAL CREDIT ANALYSIS */}
          {activeTab === 'CREDIT' && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm space-y-3">
                <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-indigo-600" /> Commercial Credit Exposure Card
                </h3>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 bg-gray-50 dark:bg-gray-850 rounded-lg">
                    <span className="text-gray-500">Customer Approved Credit Limit</span>
                    <div className="text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                      {formatInr(order.customer_credit_limit)}
                    </div>
                  </div>
                  <div className="p-3 bg-gray-50 dark:bg-gray-850 rounded-lg">
                    <span className="text-gray-500">Total Unbilled Exposure</span>
                    <div className="text-base font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                      {formatInr(order.current_credit_exposure)}
                    </div>
                  </div>
                </div>

                <div className={`p-3 rounded-lg border flex items-center justify-between ${
                  order.is_credit_limit_exceeded
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-800 dark:text-rose-300'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-300'
                }`}>
                  <div className="flex items-center gap-2">
                    {order.is_credit_limit_exceeded ? <ShieldAlert className="w-5 h-5 text-rose-600" /> : <ShieldCheck className="w-5 h-5 text-emerald-600" />}
                    <div>
                      <span className="font-bold">
                        {order.is_credit_limit_exceeded ? 'CREDIT LIMIT EXCEEDED' : 'CREDIT EXPOSURE NORMAL'}
                      </span>
                      <p className="text-[11px] opacity-80">
                        {order.is_credit_limit_exceeded
                          ? 'This contract value exceeds the customer approved commercial credit capacity.'
                          : 'Customer current exposure is within approved contractual limits.'}
                      </p>
                    </div>
                  </div>
                  {order.is_credit_limit_exceeded && !order.credit_override_by && (
                    <button
                      type="button"
                      onClick={() => onCreditOverride(order)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold text-xs transition-colors shadow"
                    >
                      Authorize Override
                    </button>
                  )}
                </div>

                {/* Override Log */}
                {order.credit_override_by && (
                  <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg space-y-1">
                    <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Managerial Override Executed
                    </span>
                    <p className="text-[11px] text-gray-600 dark:text-gray-400">
                      Authorized by: <strong>{order.credit_override_by_name || 'Plant Manager'}</strong> at {order.credit_override_at}
                    </p>
                    <p className="text-[11px] text-gray-700 dark:text-gray-300 italic">
                      Reason: "{order.credit_override_reason || 'Commercial discretion cleared'}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: MANUFACTURING WORK ORDERS */}
          {activeTab === 'PRODUCTION' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-gray-900 dark:text-gray-100">Production Demand Rollup</span>
                  <p className="text-[11px] text-gray-500">Unreserved deficit quantities ready to trigger shopfloor Work Orders</p>
                </div>
                {deficitItems.length > 0 && ['CONFIRMED', 'READY_FOR_DISPATCH'].includes(order.status) && (
                  <button
                    type="button"
                    onClick={() => onCreateWo(order)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-xs shadow transition-all"
                  >
                    <Hammer className="w-3.5 h-3.5" /> 1-Click Generate Work Orders
                  </button>
                )}
              </div>

              {deficitItems.length === 0 ? (
                <div className="p-6 text-center bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <span className="font-bold text-emerald-900 dark:text-emerald-200 text-sm">
                    No Production Deficit! All Units Reserved
                  </span>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    100% of the ordered quantities are allocated from warehouse finished goods bin stock.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {deficitItems.map((it, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between"
                    >
                      <div>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{it.item_name}</span>
                        <div className="text-[11px] text-gray-500 font-mono">
                          Deficit to Manufacture: <strong className="text-amber-600">{it.ordered_qty - it.reserved_qty} {it.uom_code}</strong>
                        </div>
                      </div>
                      {it.work_order_id ? (
                        <span className="px-2 py-1 rounded bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-mono text-[10px] font-bold">
                          {it.work_order_no || `WO-#${it.work_order_id}`}
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-medium">
                          Awaiting WO
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: TERMS & CONDITIONS */}
          {activeTab === 'TERMS' && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                <span className="font-bold text-gray-900 dark:text-gray-100">Contract Terms & Conditions</span>
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {order.terms_and_conditions || 'Standard contract terms apply.'}
                </p>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-850 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2">
                <span className="font-bold text-gray-900 dark:text-gray-100">Statutory Tax Breakdown</span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-gray-500">CGST Amount:</span>
                    <span className="font-medium">{formatInr(order.cgst_amount)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-gray-500">SGST Amount:</span>
                    <span className="font-medium">{formatInr(order.sgst_amount)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-gray-500">IGST Amount:</span>
                    <span className="font-medium">{formatInr(order.igst_amount)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b">
                    <span className="text-gray-500">Total Tax:</span>
                    <span className="font-bold">{formatInr(order.total_tax_amount)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Action Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
          <div className="text-xs text-gray-500">
            Total Value: <strong className="text-gray-900 dark:text-gray-100">{formatInr(order.grand_total)}</strong>
          </div>
          <div className="flex items-center gap-2">
            {order.status === 'DRAFT' && (
              <button
                type="button"
                onClick={() => onConfirm(order)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs shadow transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Confirm & Reserve Stock
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-xs font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Subcomponent: Confirm & ATP Stock Allocation Modal
// ============================================================================
interface ConfirmOrderModalProps {
  order: SalesOrder;
  lookups?: OrderLookups;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (remarks?: string) => void;
}

const ConfirmOrderModal: React.FC<ConfirmOrderModalProps> = ({
  order,
  isSubmitting,
  onClose,
  onConfirm,
}) => {
  const [remarks, setRemarks] = useState('');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-950 text-blue-600 rounded-xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Confirm Order & Allocate Stock
            </h3>
            <p className="text-xs text-gray-500">Sales Order #{order.so_no}</p>
          </div>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          Confirming this legal order will activate the <strong>Available-to-Promise (ATP) Reservation Engine</strong>. On-hand finished goods in warehouse storage bins will be allocated to fulfill line items on a FIFO basis.
        </p>

        {order.is_credit_limit_exceeded && !order.credit_override_by && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 inline mr-1 text-rose-600" />
            <strong>Credit Limit Block: </strong> Customer credit limit is exceeded. Confirmation cannot proceed without managerial authorization.
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Confirmation Remarks (Optional)
          </label>
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Confirmed with customer procurement team"
            className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting || (order.is_credit_limit_exceeded && !order.credit_override_by)}
            onClick={() => onConfirm(remarks)}
            className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSubmitting ? 'Allocating Stock...' : 'Confirm & Reserve Stock'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Subcomponent: Managerial Credit Override Modal
// ============================================================================
interface CreditOverrideModalProps {
  order: SalesOrder;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

const CreditOverrideModal: React.FC<CreditOverrideModalProps> = ({
  order,
  isSubmitting,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-100 dark:bg-amber-950 text-amber-600 rounded-xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Commercial Credit Clearance Override
            </h3>
            <p className="text-xs text-gray-500">Order #{order.so_no} • {order.customer_name}</p>
          </div>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-lg border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <div className="flex justify-between">
            <span>Customer Approved Limit:</span>
            <strong>{formatInr(order.customer_credit_limit)}</strong>
          </div>
          <div className="flex justify-between">
            <span>Current Exposure:</span>
            <strong className="text-rose-600">{formatInr(order.current_credit_exposure)}</strong>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Managerial Override Justification *
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="State commercial rationale (e.g., PDC cheque received, executive board clearance, payment expected on Monday)..."
            className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            required
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting || reason.trim().length < 5}
            onClick={() => onConfirm(reason)}
            className="px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSubmitting ? 'Clearing...' : 'Authorize Clearance'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Subcomponent: 1-Click Manufacturing Work Order Generator Modal
// ============================================================================
interface CreateWorkOrderModalProps {
  order: SalesOrder;
  lookups?: OrderLookups;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (targetWarehouseId?: number, remarks?: string) => void;
}

const CreateWorkOrderModal: React.FC<CreateWorkOrderModalProps> = ({
  order,
  lookups,
  isSubmitting,
  onClose,
  onConfirm,
}) => {
  const [targetWarehouseId, setTargetWarehouseId] = useState<number>(1004);
  const [remarks, setRemarks] = useState('');

  const deficitItems = (order.items || []).filter((i) => (i.ordered_qty || 0) > (i.reserved_qty || 0));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 dark:bg-purple-950 text-purple-600 rounded-xl">
            <Hammer className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              Generate Production Work Orders
            </h3>
            <p className="text-xs text-gray-500">Sales Order #{order.so_no}</p>
          </div>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-300">
          This 1-click generator creates linked production Work Orders in Phase 6 (Manufacturing) for all unfulfilled deficit quantities.
        </p>

        {/* Deficit Items List */}
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {deficitItems.map((it, idx) => (
            <div key={idx} className="p-2.5 bg-gray-50 dark:bg-gray-850 rounded-lg border text-xs flex justify-between items-center">
              <div>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{it.item_name}</span>
                <div className="text-[10px] text-gray-500 font-mono">{it.item_code}</div>
              </div>
              <span className="font-bold text-purple-600 text-xs">
                {it.ordered_qty - it.reserved_qty} {it.uom_code}
              </span>
            </div>
          ))}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Target Finished Goods Warehouse
          </label>
          <select
            value={targetWarehouseId}
            onChange={(e) => setTargetWarehouseId(Number(e.target.value))}
            className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {lookups?.warehouses.map((w) => (
              <option key={w.warehouse_id} value={w.warehouse_id}>
                {w.warehouse_code} - {w.warehouse_name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Production Scheduling Remarks
          </label>
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="e.g. Priority execution for OEM shipment"
            className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onConfirm(targetWarehouseId, remarks)}
            className="px-4 py-2 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow disabled:opacity-50 flex items-center gap-1.5"
          >
            {isSubmitting ? 'Generating WO...' : `Generate ${deficitItems.length} Work Order(s)`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Subcomponent: Hold / Release Order Modal
// ============================================================================
interface HoldOrderModalProps {
  order: SalesOrder;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (isHold: boolean, reason?: string) => void;
}

const HoldOrderModal: React.FC<HoldOrderModalProps> = ({
  order,
  isSubmitting,
  onClose,
  onConfirm,
}) => {
  const isCurrentlyHold = order.status === 'ON_HOLD';
  const [reason, setReason] = useState(order.hold_reason || '');

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 dark:border-gray-700 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-100 dark:bg-amber-950 text-amber-600 rounded-xl">
            {isCurrentlyHold ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900 dark:text-gray-100">
              {isCurrentlyHold ? 'Release Order from Hold' : 'Place Order On Hold'}
            </h3>
            <p className="text-xs text-gray-500">Order #{order.so_no}</p>
          </div>
        </div>

        <p className="text-xs text-gray-600 dark:text-gray-300">
          {isCurrentlyHold
            ? 'Releasing this order will restore its normal execution status.'
            : 'Placing this order on hold prevents shopfloor dispatch and pauses execution.'}
        </p>

        {!isCurrentlyHold && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Reason for Administrative Hold
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer requested schedule postponement"
              className="w-full px-3 py-2 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => onConfirm(!isCurrentlyHold, reason)}
            className={`px-4 py-2 text-xs font-semibold text-white rounded-lg shadow disabled:opacity-50 ${
              isCurrentlyHold ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {isCurrentlyHold ? 'Release Hold' : 'Place On Hold'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// Subcomponent: Printable Official Sales Order Acknowledgement / Contract Modal
// ============================================================================
interface PrintOrderModalProps {
  order: SalesOrder;
  onClose: () => void;
}

const PrintOrderModal: React.FC<PrintOrderModalProps> = ({ order, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-4xl w-full flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[92vh]">
        {/* Modal Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 no-print">
          <span className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Printer className="w-4 h-4 text-indigo-600" /> Sales Order Acknowledgement Preview
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 shadow"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Paper Container for Print */}
        <div className="flex-1 overflow-y-auto p-8 bg-white text-gray-900 printable-order-acknowledgement space-y-6">
          {/* Company Letterhead */}
          <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-indigo-900">KASHVIRA INFOTECH PRIVATE LIMITED</h1>
              <p className="text-xs text-gray-600">Advanced Discrete & Process Manufacturing Division</p>
              <p className="text-xs text-gray-600">Plot 104-106, GIDC Industrial Estate, Sanand II, Ahmedabad, Gujarat 382170</p>
              <p className="text-xs text-gray-600 font-mono">GSTIN: 24AAACK9812A1Z1 • CIN: U72900GJ2026PTC109921</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-indigo-50 border border-indigo-200 text-indigo-900 font-black text-xs uppercase tracking-wider rounded">
                Order Acknowledgement
              </span>
              <div className="text-sm font-bold text-gray-900 mt-1">{order.so_no}</div>
              <div className="text-xs text-gray-500">Date: {order.so_date}</div>
            </div>
          </div>

          {/* Reference & Customer Details */}
          <div className="grid grid-cols-2 gap-6 text-xs bg-gray-50 p-4 rounded-lg border border-gray-200">
            <div>
              <span className="font-bold text-gray-500 uppercase text-[10px] tracking-wider block mb-1">
                Customer (Buyer) Details
              </span>
              <p className="font-bold text-gray-900 text-sm">{order.customer_name}</p>
              <p className="text-gray-600 mt-0.5 whitespace-pre-wrap">{order.shipping_address || order.billing_address}</p>
              <p className="text-gray-600 font-mono mt-1">GSTIN: {order.customer_gstin || 'UNREGISTERED'}</p>
              <p className="text-gray-600">Contact: {order.contact_person} ({order.contact_phone})</p>
            </div>

            <div>
              <span className="font-bold text-gray-500 uppercase text-[10px] tracking-wider block mb-1">
                Contractual References
              </span>
              <p><strong>Customer PO No:</strong> <span className="font-mono">{order.customer_po_no || 'Direct Contract'}</span></p>
              <p><strong>Customer PO Date:</strong> {order.customer_po_date || 'N/A'}</p>
              <p><strong>Target Dispatch Date:</strong> <span className="font-semibold text-indigo-900">{order.target_delivery_date}</span></p>
              <p><strong>Payment Terms:</strong> {order.payment_terms}</p>
              <p><strong>Delivery Terms:</strong> {order.delivery_terms}</p>
              {order.quotation_no && (
                <p><strong>Quotation Ref:</strong> <span className="font-mono">{order.quotation_no}</span></p>
              )}
            </div>
          </div>

          {/* Line Items Table */}
          <table className="w-full text-xs text-left border-collapse border border-gray-300">
            <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-300">
              <tr>
                <th className="p-2 border border-gray-300 w-8">#</th>
                <th className="p-2 border border-gray-300">Item Description</th>
                <th className="p-2 border border-gray-300 w-20 text-center">HSN/SAC</th>
                <th className="p-2 border border-gray-300 w-16 text-center">UOM</th>
                <th className="p-2 border border-gray-300 w-16 text-right">Qty</th>
                <th className="p-2 border border-gray-300 w-24 text-right">Rate (₹)</th>
                <th className="p-2 border border-gray-300 w-24 text-right">Taxable (₹)</th>
                <th className="p-2 border border-gray-300 w-16 text-center">GST %</th>
                <th className="p-2 border border-gray-300 w-28 text-right">Total (₹)</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((it, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="p-2 border border-gray-300 text-center">{idx + 1}</td>
                  <td className="p-2 border border-gray-300">
                    <span className="font-bold">{it.item_name}</span>
                    <div className="font-mono text-[10px] text-gray-500">{it.item_code}</div>
                  </td>
                  <td className="p-2 border border-gray-300 text-center font-mono">{it.hsn_sac_code || '8481'}</td>
                  <td className="p-2 border border-gray-300 text-center">{it.uom_code || 'NOS'}</td>
                  <td className="p-2 border border-gray-300 text-right font-semibold">{it.ordered_qty}</td>
                  <td className="p-2 border border-gray-300 text-right">{formatInrDecimals(it.unit_rate)}</td>
                  <td className="p-2 border border-gray-300 text-right font-medium">{formatInrDecimals(it.taxable_amount)}</td>
                  <td className="p-2 border border-gray-300 text-center">{it.gst_rate}%</td>
                  <td className="p-2 border border-gray-300 text-right font-bold">{formatInrDecimals(it.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Tax Breakdown & Totals */}
          <div className="flex justify-end">
            <div className="w-72 text-xs space-y-1.5 border border-gray-300 p-3 bg-gray-50 rounded">
              <div className="flex justify-between">
                <span>Subtotal (Taxable):</span>
                <span className="font-semibold">{formatInrDecimals(order.subtotal_amount)}</span>
              </div>
              {order.cgst_amount > 0 && (
                <div className="flex justify-between">
                  <span>CGST:</span>
                  <span>{formatInrDecimals(order.cgst_amount)}</span>
                </div>
              )}
              {order.sgst_amount > 0 && (
                <div className="flex justify-between">
                  <span>SGST:</span>
                  <span>{formatInrDecimals(order.sgst_amount)}</span>
                </div>
              )}
              {order.igst_amount > 0 && (
                <div className="flex justify-between">
                  <span>IGST:</span>
                  <span>{formatInrDecimals(order.igst_amount)}</span>
                </div>
              )}
              {order.freight_charges > 0 && (
                <div className="flex justify-between">
                  <span>Freight Charges:</span>
                  <span>{formatInrDecimals(order.freight_charges)}</span>
                </div>
              )}
              {order.packaging_charges > 0 && (
                <div className="flex justify-between">
                  <span>Packaging & Handling:</span>
                  <span>{formatInrDecimals(order.packaging_charges)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-gray-300 text-sm font-black text-indigo-950">
                <span>Total Contract Value:</span>
                <span>{formatInrDecimals(order.grand_total)}</span>
              </div>
            </div>
          </div>

          {/* Terms & Signatures */}
          <div className="grid grid-cols-2 gap-8 text-[11px] pt-6 border-t border-gray-200">
            <div>
              <span className="font-bold uppercase text-gray-500 block mb-1">Terms & Conditions</span>
              <p className="text-gray-600 whitespace-pre-wrap leading-relaxed">
                {order.terms_and_conditions || 'Standard industrial contract guidelines apply.'}
              </p>
            </div>
            <div className="text-right flex flex-col justify-between h-28">
              <span className="font-bold text-gray-700">For KASHVIRA INFOTECH PRIVATE LIMITED</span>
              <div className="border-t border-gray-400 w-48 ml-auto pt-1 text-gray-500 text-[10px]">
                Authorized Signatory & Seal
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
