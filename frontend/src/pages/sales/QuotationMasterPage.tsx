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
  Pencil,
  Percent,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  Truck,
  User,
  Users,
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
// Interfaces & Types
// ----------------------------------------------------------------------------
interface QuotationSummary {
  totalQuotations: number;
  openPipelineCount: number;
  openPipelineValue: number;
  wonCount: number;
  wonValue: number;
  draftCount: number;
  draftValue: number;
  convertedCount: number;
}

interface QuotationItem {
  quotation_item_id?: number;
  quotation_id?: number;
  item_sequence: number;
  item_id: number;
  item_code: string;
  item_name: string;
  description?: string | null;
  hsn_sac_code?: string | null;
  uom_id: number;
  uom_code?: string;
  uom_name?: string;
  quantity: number;
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
  delivery_lead_time_days?: number;
  remarks?: string | null;
}

interface Quotation {
  quotation_id: number;
  quotation_no: string;
  quotation_date: string;
  inquiry_ref_no?: string | null;
  inquiry_date?: string | null;
  customer_id: number;
  customer_name: string;
  customer_code?: string;
  customer_pan?: string;
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
  price_list_name?: string | null;
  currency_code: string;
  exchange_rate: number;
  valid_until: string;
  delivery_lead_time_days: number;
  payment_terms: string;
  delivery_terms: string;
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
  revision_no: number;
  revision_date?: string | null;
  revision_reason?: string | null;
  status: 'DRAFT' | 'SUBMITTED' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED' | 'CONVERTED_TO_SO';
  submitted_by?: number | null;
  submitted_by_name?: string | null;
  submitted_at?: string | null;
  sent_at?: string | null;
  accepted_at?: string | null;
  converted_to_so_id?: number | null;
  converted_at?: string | null;
  remarks?: string | null;
  terms_and_conditions?: string | null;
  item_count?: number;
  created_by_name?: string | null;
  created_date?: string;
  items?: QuotationItem[];
}

interface QuotationLookups {
  currentBranch: {
    branch_id: number;
    branch_code: string;
    branch_name: string;
    state_code: string;
    state_name: string;
    gstin?: string;
  };
  customers: Array<{
    party_id: number;
    party_code: string;
    party_name: string;
    trade_name?: string;
    primary_contact_name: string;
    primary_email?: string;
    primary_phone: string;
    payment_terms: string;
    currency_code: string;
    credit_days: number;
    gst_treatment_type: string;
  }>;
  addresses: Array<{
    address_id: number;
    party_id: number;
    address_label: string;
    address_type: string;
    gstin?: string;
    state_code: string;
    state_name: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    pincode: string;
    contact_person?: string;
    phone?: string;
    email?: string;
    is_default_billing: boolean;
    is_default_shipping: boolean;
  }>;
  items: Array<{
    item_id: number;
    item_code: string;
    item_name: string;
    item_type: string;
    hsn_sac_code?: string;
    tax_rate: number;
    sales_rate: number;
    sales_uom_id: number;
    uom_code?: string;
    uom_name?: string;
    lead_time_days?: number;
  }>;
  uoms: Array<{
    uom_id: number;
    uom_code: string;
    uom_name: string;
  }>;
  priceLists: Array<{
    price_list_id: number;
    price_list_code: string;
    price_list_name: string;
    currency_code: string;
  }>;
}

export const QuotationMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters & State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals & Drawers state
  const [drawerQuotation, setDrawerQuotation] = useState<Quotation | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);
  const [reviseModalQuotation, setReviseModalQuotation] = useState<Quotation | null>(null);
  const [convertToSoQuotation, setConvertToSoQuotation] = useState<Quotation | null>(null);
  const [printQuotation, setPrintQuotation] = useState<Quotation | null>(null);
  const [deleteQuotation, setDeleteQuotation] = useState<Quotation | null>(null);

  // --------------------------------------------------------------------------
  // Data Queries
  // --------------------------------------------------------------------------
  const { data: summaryData } = useQuery({
    queryKey: ['sales-quotations-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<QuotationSummary>>(
        '/sales/quotations/summary',
      );
      return res.data.data;
    },
  });

  const { data: lookupsData } = useQuery({
    queryKey: ['sales-quotations-lookups'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<QuotationLookups>>(
        '/sales/quotations/lookups',
      );
      return res.data.data;
    },
  });

  const { data: quotationsData, isLoading } = useQuery({
    queryKey: ['sales-quotations', statusFilter, customerFilter, searchTerm],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (customerFilter !== 'ALL') params.customerId = customerFilter;
      if (searchTerm) params.search = searchTerm;
      const res = await apiClient.get<ApiResponse<Quotation[]>>(
        '/sales/quotations',
        { params },
      );
      return res.data.data;
    },
  });

  // Query for single drawer quotation details
  const { data: activeQuotationDetail, refetch: refetchActiveDetail } = useQuery({
    queryKey: ['sales-quotation-detail', drawerQuotation?.quotation_id],
    queryFn: async () => {
      if (!drawerQuotation?.quotation_id) return null;
      const res = await apiClient.get<ApiResponse<Quotation>>(
        `/sales/quotations/${drawerQuotation.quotation_id}`,
      );
      return res.data.data;
    },
    enabled: !!drawerQuotation?.quotation_id,
  });

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------
  const statusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      remarks,
    }: {
      id: number;
      status: string;
      remarks?: string;
    }) => {
      const res = await apiClient.patch<ApiResponse<Quotation>>(
        `/sales/quotations/${id}/status`,
        { status, remarks },
      );
      return res.data.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['sales-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['sales-quotations-summary'] });
      if (drawerQuotation?.quotation_id === updated.quotation_id) {
        setDrawerQuotation(updated);
        refetchActiveDetail();
      }
    },
  });

  const sendMutation = useMutation({
    mutationFn: async ({ id, remarks }: { id: number; remarks?: string }) => {
      const res = await apiClient.post<ApiResponse<Quotation>>(
        `/sales/quotations/${id}/send`,
        { remarks },
      );
      return res.data.data;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['sales-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['sales-quotations-summary'] });
      if (drawerQuotation?.quotation_id === updated.quotation_id) {
        setDrawerQuotation(updated);
        refetchActiveDetail();
      }
    },
  });

  const convertToSoMutation = useMutation({
    mutationFn: async ({
      id,
      customerPoNo,
      customerPoDate,
      remarks,
    }: {
      id: number;
      customerPoNo?: string;
      customerPoDate?: string;
      remarks?: string;
    }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/sales/quotations/${id}/convert-to-so`,
        { customerPoNo, customerPoDate, remarks },
      );
      return res.data.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['sales-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['sales-quotations-summary'] });
      setConvertToSoQuotation(null);
      if (drawerQuotation?.quotation_id === result.quotationId) {
        refetchActiveDetail();
      }
      alert(
        `🎉 Success: Quotation converted to Sales Order ${result.salesOrderNo}!\n${result.itemsReadyForProduction?.length || 0} line items ready for production scheduling in Step 7.2.`,
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiClient.delete(`/sales/quotations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-quotations'] });
      queryClient.invalidateQueries({ queryKey: ['sales-quotations-summary'] });
      setDeleteQuotation(null);
      setDrawerQuotation(null);
    },
  });

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------
  const formatCurrency = (amount: number | string | undefined) => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(num);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3" /> Draft
          </span>
        );
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <FileText className="w-3 h-3" /> Submitted
          </span>
        );
      case 'SENT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
            <Send className="w-3 h-3" /> Sent to Customer
          </span>
        );
      case 'ACCEPTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3 h-3" /> Accepted / Won
          </span>
        );
      case 'CONVERTED_TO_SO':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
            <PackageCheck className="w-3 h-3" /> Converted to SO
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <X className="w-3 h-3" /> Rejected
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700">
            <Clock className="w-3 h-3" /> Expired
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-zinc-100 text-zinc-800">
            {status}
          </span>
        );
    }
  };

  // --------------------------------------------------------------------------
  // Table Columns & Configuration
  // --------------------------------------------------------------------------
  const columns: MasterTableColumn<Quotation>[] = useMemo(
    () => [
      {
        key: 'quotation_no',
        header: 'Quotation No & Rev',
        sortable: true,
        render: (row) => (
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-primary hover:underline cursor-pointer">
                {row.quotation_no}
              </span>
              <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                Rev {row.revision_no}
              </span>
            </div>
            {row.inquiry_ref_no && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Tag className="w-3 h-3" /> RFQ: {row.inquiry_ref_no}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'quotation_date',
        header: 'Date & Validity',
        sortable: true,
        render: (row) => (
          <div className="text-xs">
            <div className="font-medium text-foreground">{row.quotation_date}</div>
            <div className="text-muted-foreground text-[11px]">
              Valid to: {row.valid_until}
            </div>
          </div>
        ),
      },
      {
        key: 'customer_name',
        header: 'Customer & Contact',
        sortable: true,
        render: (row) => (
          <div className="flex flex-col max-w-[220px]">
            <span className="font-medium text-foreground truncate" title={row.customer_name}>
              {row.customer_name}
            </span>
            {row.contact_person && (
              <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                <User className="w-3 h-3 inline shrink-0" /> {row.contact_person}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'shipping_state_name',
        header: 'Destination & GST',
        sortable: true,
        render: (row) => {
          const isIntra = (row.shipping_state_code || '24') === (lookupsData?.currentBranch?.state_code || '24');
          return (
            <div className="flex flex-col gap-1 items-start text-xs">
              <span className="flex items-center gap-1 text-foreground font-medium">
                <MapPin className="w-3 h-3 text-muted-foreground" /> {row.shipping_state_name} ({row.shipping_state_code})
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium border ${
                  isIntra
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                    : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800'
                }`}
              >
                {isIntra ? 'Intra (CGST+SGST)' : 'Inter (IGST)'}
              </span>
            </div>
          );
        },
      },
      {
        key: 'taxable_amount',
        header: 'Taxable Value',
        sortable: true,
        align: 'right',
        render: (row) => (
          <span className="text-xs font-mono font-medium text-foreground">
            {formatCurrency(row.taxable_amount)}
          </span>
        ),
      },
      {
        key: 'total_tax_amount',
        header: 'GST Tax',
        sortable: true,
        align: 'right',
        render: (row) => (
          <span className="text-xs font-mono text-muted-foreground">
            {formatCurrency(row.total_tax_amount)}
          </span>
        ),
      },
      {
        key: 'grand_total',
        header: 'Grand Total',
        sortable: true,
        align: 'right',
        render: (row) => (
          <span className="text-xs font-mono font-bold text-foreground">
            {formatCurrency(row.grand_total)}
          </span>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        align: 'center',
        render: (row) => getStatusBadge(row.status),
      },
    ],
    [lookupsData],
  );

  const groupByOptions: GroupByOption<Quotation>[] = useMemo(
    () => [
      {
        key: 'status',
        label: 'Status',
        groupValue: (row) => row.status,
      },
      {
        key: 'customer',
        label: 'Customer',
        groupValue: (row) => row.customer_name,
      },
      {
        key: 'state',
        label: 'Destination State',
        groupValue: (row) => row.shipping_state_name,
      },
    ],
    [],
  );

  const searchPredicate = (row: Quotation, query: string): boolean => {
    const q = query.toLowerCase();
    return Boolean(
      row.quotation_no.toLowerCase().includes(q) ||
      (row.customer_name && row.customer_name.toLowerCase().includes(q)) ||
      (row.inquiry_ref_no && row.inquiry_ref_no.toLowerCase().includes(q)) ||
      (row.contact_person && row.contact_person.toLowerCase().includes(q)) ||
      (row.shipping_state_name && row.shipping_state_name.toLowerCase().includes(q)),
    );
  };

  return (
    <div className="flex flex-col gap-6 p-6 max-w-[1600px] mx-auto min-h-screen">
      {/* -------------------------------------------------------------------- */}
      {/* 1. Header & KPI Cards                                                */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                Customer Quotations & Proforma Invoices
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-semibold">
                  Phase 7.1 Live
                </span>
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Presales commercial inquiry management, multi-tier pricing, automated Indian GST derivation, and 1-Click Sales Order conversion.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGate screen="SALES_QUOTATION" action="ADD">
            <button
              onClick={() => {
                setEditingQuotation(null);
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium text-xs shadow hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" /> Create Quotation
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Quotes */}
        <div className="p-4 rounded-xl border border-border/60 bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Quotations</span>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-foreground">
              {summaryData?.totalQuotations ?? 0}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <span>{summaryData?.draftCount ?? 0} draft / revisions</span>
            </div>
          </div>
        </div>

        {/* Open Pipeline Value */}
        <div className="p-4 rounded-xl border border-border/60 bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Open Pipeline (Sent / Submitted)</span>
            <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(summaryData?.openPipelineValue)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {summaryData?.openPipelineCount ?? 0} quotes under negotiation
            </div>
          </div>
        </div>

        {/* Won Contract Value */}
        <div className="p-4 rounded-xl border border-border/60 bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Won / Accepted Value</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(summaryData?.wonValue)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {summaryData?.wonCount ?? 0} orders won & confirmed
            </div>
          </div>
        </div>

        {/* Converted to SO */}
        <div className="p-4 rounded-xl border border-border/60 bg-card shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Converted to Sales Order</span>
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
              <PackageCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {summaryData?.convertedCount ?? 0}
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              Ready for Phase 7.2 SO scheduling
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2. Main Master Listing Table                                         */}
      {/* -------------------------------------------------------------------- */}
      <MasterDataTable<Quotation>
        title="Commercial Quotations Register"
        subtitle="Track presales proposals, statutory GST schedules, and customer acceptance statuses"
        screenCode="SALES_QUOTATION"
        tableNameBadge="tbl_sales_quotation_header"
        data={quotationsData || []}
        isLoading={isLoading}
        rowKey={(row) => row.quotation_id}
        columns={columns}
        searchPlaceholder="Search quotation #, customer, inquiry ref, state..."
        searchPredicate={searchPredicate}
        groupByOptions={groupByOptions}
        filterToolbarSlot={
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2.5 py-1 border border-border">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="SUBMITTED">Submitted</option>
                <option value="SENT">Sent</option>
                <option value="ACCEPTED">Accepted / Won</option>
                <option value="CONVERTED_TO_SO">Converted to SO</option>
                <option value="REJECTED">Rejected</option>
                <option value="EXPIRED">Expired</option>
              </select>
            </div>

            {/* Customer Filter */}
            {lookupsData?.customers && lookupsData.customers.length > 0 && (
              <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2.5 py-1 border border-border">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Customer:</span>
                <select
                  value={customerFilter}
                  onChange={(e) => setCustomerFilter(e.target.value)}
                  className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer max-w-[180px] truncate"
                >
                  <option value="ALL">All Customers</option>
                  {lookupsData.customers.map((c) => (
                    <option key={c.party_id} value={c.party_id}>
                      {c.party_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        }
        renderRowActions={(row) => (
          <div className="flex items-center justify-end gap-1">
            {/* View Details */}
            <button
              onClick={() => setDrawerQuotation(row)}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="View Quotation Details & Lines"
            >
              <Eye className="w-4 h-4" />
            </button>

            {/* Print Proforma Invoice */}
            <PermissionGate screen="SALES_QUOTATION" action="PRINT">
              <button
                onClick={() => setPrintQuotation(row)}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                title="Print Commercial Quotation / Proforma Invoice"
              >
                <Printer className="w-4 h-4" />
              </button>
            </PermissionGate>

            {/* Edit (if DRAFT or SUBMITTED) */}
            {['DRAFT', 'SUBMITTED'].includes(row.status) && (
              <PermissionGate screen="SALES_QUOTATION" action="EDIT">
                <button
                  onClick={() => {
                    setEditingQuotation(row);
                    setIsCreateModalOpen(true);
                  }}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-amber-600 transition-colors"
                  title="Edit Quotation"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {/* Revise Quotation */}
            {!['CONVERTED_TO_SO', 'REJECTED'].includes(row.status) && (
              <PermissionGate screen="SALES_QUOTATION" action="EDIT">
                <button
                  onClick={() => setReviseModalQuotation(row)}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-blue-600 transition-colors"
                  title="Revise Quotation (New Revision)"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {/* 1-Click Convert to SO (if ACCEPTED) */}
            {row.status === 'ACCEPTED' && (
              <PermissionGate screen="SALES_QUOTATION" action="CONVERT_TO_SO">
                <button
                  onClick={() => setConvertToSoQuotation(row)}
                  className="p-1.5 rounded-md hover:bg-purple-100 dark:hover:bg-purple-950/60 text-purple-600 dark:text-purple-400 transition-colors"
                  title="Convert to Sales Order"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {/* Delete (if DRAFT) */}
            {row.status === 'DRAFT' && (
              <PermissionGate screen="SALES_QUOTATION" action="DELETE">
                <button
                  onClick={() => setDeleteQuotation(row)}
                  className="p-1.5 rounded-md hover:bg-rose-100 dark:hover:bg-rose-950/60 text-muted-foreground hover:text-rose-600 transition-colors"
                  title="Delete Draft Quotation"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}
          </div>
        )}
      />

      {/* -------------------------------------------------------------------- */}
      {/* 3. Details & Line Items Drawer                                       */}
      {/* -------------------------------------------------------------------- */}
      {drawerQuotation && (
        <QuotationDetailsDrawer
          quotationId={drawerQuotation.quotation_id}
          onClose={() => setDrawerQuotation(null)}
          onPrint={() => setPrintQuotation(activeQuotationDetail || drawerQuotation)}
          onRevise={() => setReviseModalQuotation(activeQuotationDetail || drawerQuotation)}
          onConvertToSo={() => setConvertToSoQuotation(activeQuotationDetail || drawerQuotation)}
          onStatusChange={(status, remarks) =>
            statusMutation.mutate({ id: drawerQuotation.quotation_id, status, remarks })
          }
          onSend={(remarks) =>
            sendMutation.mutate({ id: drawerQuotation.quotation_id, remarks })
          }
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 4. Create / Edit Quotation Modal                                     */}
      {/* -------------------------------------------------------------------- */}
      {isCreateModalOpen && lookupsData && (
        <QuotationFormModal
          isOpen={isCreateModalOpen}
          initialQuotation={editingQuotation}
          lookups={lookupsData}
          onClose={() => {
            setIsCreateModalOpen(false);
            setEditingQuotation(null);
          }}
          onSuccess={() => {
            setIsCreateModalOpen(false);
            setEditingQuotation(null);
            queryClient.invalidateQueries({ queryKey: ['sales-quotations'] });
            queryClient.invalidateQueries({ queryKey: ['sales-quotations-summary'] });
          }}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 5. Revise Quotation Modal                                            */}
      {/* -------------------------------------------------------------------- */}
      {reviseModalQuotation && (
        <ReviseQuotationModal
          quotation={reviseModalQuotation}
          onClose={() => setReviseModalQuotation(null)}
          onSuccess={() => {
            setReviseModalQuotation(null);
            queryClient.invalidateQueries({ queryKey: ['sales-quotations'] });
            queryClient.invalidateQueries({ queryKey: ['sales-quotations-summary'] });
          }}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 6. Convert to Sales Order Modal                                      */}
      {/* -------------------------------------------------------------------- */}
      {convertToSoQuotation && (
        <ConvertToSoModal
          quotation={convertToSoQuotation}
          onClose={() => setConvertToSoQuotation(null)}
          onConfirm={(customerPoNo, customerPoDate, remarks) => {
            convertToSoMutation.mutate({
              id: convertToSoQuotation.quotation_id,
              customerPoNo,
              customerPoDate,
              remarks,
            });
          }}
          isPending={convertToSoMutation.isPending}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 7. Printable Commercial Quotation / Proforma Invoice Modal           */}
      {/* -------------------------------------------------------------------- */}
      {printQuotation && (
        <PrintQuotationModal
          quotationId={printQuotation.quotation_id}
          onClose={() => setPrintQuotation(null)}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 8. Confirm Delete Modal                                              */}
      {/* -------------------------------------------------------------------- */}
      {deleteQuotation && (
        <ConfirmDeleteModal
          isOpen={!!deleteQuotation}
          entityType="Customer Quotation"
          entityName={deleteQuotation.customer_name}
          entityCode={deleteQuotation.quotation_no}
          onConfirm={() => deleteMutation.mutate(deleteQuotation.quotation_id)}
          onClose={() => setDeleteQuotation(null)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: Quotation Details Drawer
// ============================================================================
interface QuotationDetailsDrawerProps {
  quotationId: number;
  onClose: () => void;
  onPrint: () => void;
  onRevise: () => void;
  onConvertToSo: () => void;
  onStatusChange: (status: string, remarks?: string) => void;
  onSend: (remarks?: string) => void;
}

const QuotationDetailsDrawer: React.FC<QuotationDetailsDrawerProps> = ({
  quotationId,
  onClose,
  onPrint,
  onRevise,
  onConvertToSo,
  onStatusChange,
  onSend,
}) => {
  const { data: quotation, isLoading } = useQuery({
    queryKey: ['sales-quotation-drawer-detail', quotationId],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<Quotation>>(
        `/sales/quotations/${quotationId}`,
      );
      return res.data.data;
    },
  });

  const formatCurrency = (val: number | undefined) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(Number(val) || 0);

  if (isLoading || !quotation) {
    return (
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[650px] bg-card border-l border-border p-6 shadow-2xl flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <RefreshCw className="w-4 h-4 animate-spin" /> Loading quotation specifications...
        </div>
      </div>
    );
  }

  const isIntraState = quotation.cgst_amount > 0 || quotation.sgst_amount > 0;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[720px] bg-card border-l border-border shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="p-6 border-b border-border/80 flex items-start justify-between bg-muted/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold text-foreground">
              {quotation.quotation_no}
            </span>
            <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700">
              Rev {quotation.revision_no}
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {quotation.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Issued on {quotation.quotation_date} • Valid until {quotation.valid_until}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Body Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
        {/* Customer & Commercial Terms Grid */}
        <div className="grid grid-cols-2 gap-4 bg-muted/30 p-4 rounded-xl border border-border/60">
          <div>
            <span className="text-muted-foreground font-medium">Customer:</span>
            <div className="font-semibold text-foreground text-sm mt-0.5">
              {quotation.customer_name}
            </div>
            {quotation.customer_gstin && (
              <div className="text-[11px] text-muted-foreground mt-0.5">
                GSTIN: <span className="font-mono text-foreground">{quotation.customer_gstin}</span>
              </div>
            )}
            {quotation.contact_person && (
              <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                <User className="w-3 h-3 text-primary" /> {quotation.contact_person}
              </div>
            )}
            {quotation.contact_phone && (
              <div className="text-[11px] text-muted-foreground">
                Phone: {quotation.contact_phone}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div>
              <span className="text-muted-foreground">Payment Terms:</span>{' '}
              <span className="font-semibold text-foreground">{quotation.payment_terms}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Delivery Terms:</span>{' '}
              <span className="font-semibold text-foreground">{quotation.delivery_terms}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Lead Time:</span>{' '}
              <span className="font-semibold text-foreground">{quotation.delivery_lead_time_days} days</span>
            </div>
            <div>
              <span className="text-muted-foreground">Destination State:</span>{' '}
              <span className="font-semibold text-foreground">
                {quotation.shipping_state_name} ({quotation.shipping_state_code})
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Tax Scheme:</span>{' '}
              <span className="font-semibold text-primary">
                {isIntraState ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'}
              </span>
            </div>
          </div>
        </div>

        {/* Addresses Box */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg border border-border bg-card">
            <span className="font-semibold text-foreground block mb-1">Billing Address</span>
            <p className="text-muted-foreground leading-relaxed text-[11px]">
              {quotation.billing_address || 'Same as Corporate Master'}
            </p>
          </div>
          <div className="p-3 rounded-lg border border-border bg-card">
            <span className="font-semibold text-foreground block mb-1">Shipping / Consignee Address</span>
            <p className="text-muted-foreground leading-relaxed text-[11px]">
              {quotation.shipping_address || 'Same as Plant Destination'}
            </p>
          </div>
        </div>

        {/* Line Items Table */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-foreground text-sm flex items-center gap-1.5">
              <Boxes className="w-4 h-4 text-primary" /> Quoted Line Items & GST Schedule
            </h3>
            <span className="text-muted-foreground text-xs">
              {quotation.items?.length || 0} product(s)
            </span>
          </div>

          <div className="border border-border rounded-lg overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead className="bg-muted/60 text-muted-foreground text-[11px] font-semibold">
                <tr>
                  <th className="p-2 border-b border-border">#</th>
                  <th className="p-2 border-b border-border">Product / Description</th>
                  <th className="p-2 border-b border-border text-center">HSN</th>
                  <th className="p-2 border-b border-border text-right">Qty</th>
                  <th className="p-2 border-b border-border text-right">Rate</th>
                  <th className="p-2 border-b border-border text-right">Taxable</th>
                  <th className="p-2 border-b border-border text-right">GST %</th>
                  <th className="p-2 border-b border-border text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                {quotation.items?.map((item, idx) => (
                  <tr key={item.quotation_item_id || idx} className="hover:bg-muted/20">
                    <td className="p-2 text-muted-foreground">{item.item_sequence}</td>
                    <td className="p-2 font-sans font-medium text-foreground">
                      <div>{item.item_name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{item.item_code}</div>
                    </td>
                    <td className="p-2 text-center text-muted-foreground">{item.hsn_sac_code || '—'}</td>
                    <td className="p-2 text-right">
                      {item.quantity} {item.uom_code || 'NOS'}
                    </td>
                    <td className="p-2 text-right">{formatCurrency(item.unit_rate)}</td>
                    <td className="p-2 text-right font-medium">{formatCurrency(item.taxable_amount)}</td>
                    <td className="p-2 text-right text-muted-foreground">
                      {item.gst_rate}%
                      <div className="text-[9px]">
                        {isIntraState
                          ? `(C:${item.cgst_rate}% + S:${item.sgst_rate}%)`
                          : `(I:${item.igst_rate}%)`}
                      </div>
                    </td>
                    <td className="p-2 text-right font-bold text-foreground">
                      {formatCurrency(item.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Commercial Summary Box */}
        <div className="bg-muted/20 p-4 rounded-xl border border-border/80 flex flex-col gap-1.5 ml-auto max-w-[340px] font-mono text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal Taxable:</span>
            <span>{formatCurrency(quotation.subtotal_amount)}</span>
          </div>

          {quotation.discount_amount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Commercial Discount ({quotation.discount_percent}%):</span>
              <span>- {formatCurrency(quotation.discount_amount)}</span>
            </div>
          )}

          {isIntraState ? (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>Central GST (CGST):</span>
                <span>{formatCurrency(quotation.cgst_amount)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>State GST (SGST):</span>
                <span>{formatCurrency(quotation.sgst_amount)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-muted-foreground">
              <span>Integrated GST (IGST):</span>
              <span>{formatCurrency(quotation.igst_amount)}</span>
            </div>
          )}

          {quotation.freight_charges > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Freight / Shipping:</span>
              <span>{formatCurrency(quotation.freight_charges)}</span>
            </div>
          )}

          {quotation.packaging_charges > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Packaging / Handling:</span>
              <span>{formatCurrency(quotation.packaging_charges)}</span>
            </div>
          )}

          {quotation.round_off !== 0 && (
            <div className="flex justify-between text-muted-foreground text-[11px]">
              <span>Round Off:</span>
              <span>{formatCurrency(quotation.round_off)}</span>
            </div>
          )}

          <div className="border-t border-border/80 pt-2 flex justify-between font-bold text-sm text-foreground">
            <span>Grand Total:</span>
            <span className="text-primary">{formatCurrency(quotation.grand_total)}</span>
          </div>
        </div>

        {/* Remarks and Terms */}
        {quotation.remarks && (
          <div className="p-3 bg-muted/30 rounded-lg border border-border text-[11px]">
            <span className="font-semibold text-foreground block mb-0.5">Commercial Remarks:</span>
            <p className="text-muted-foreground">{quotation.remarks}</p>
          </div>
        )}

        {quotation.terms_and_conditions && (
          <div className="p-3 bg-muted/30 rounded-lg border border-border text-[11px]">
            <span className="font-semibold text-foreground block mb-0.5">Statutory Terms & Conditions:</span>
            <p className="text-muted-foreground whitespace-pre-line">{quotation.terms_and_conditions}</p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-4 border-t border-border/80 bg-muted/20 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PermissionGate screen="SALES_QUOTATION" action="PRINT">
            <button
              onClick={onPrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted font-medium text-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print Proforma Invoice
            </button>
          </PermissionGate>

          <PermissionGate screen="SALES_QUOTATION" action="EDIT">
            <button
              onClick={onRevise}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-foreground hover:bg-muted font-medium text-xs transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-500" /> Revise
            </button>
          </PermissionGate>
        </div>

        <div className="flex items-center gap-2">
          {quotation.status === 'DRAFT' && (
            <button
              onClick={() => onStatusChange('SUBMITTED', 'Submitted for sales head review')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium text-xs hover:bg-blue-700 transition-colors shadow-sm"
            >
              <FileCheck2 className="w-3.5 h-3.5" /> Submit for Review
            </button>
          )}

          {['DRAFT', 'SUBMITTED'].includes(quotation.status) && (
            <PermissionGate screen="SALES_QUOTATION" action="SEND">
              <button
                onClick={() => onSend('Sent officially to customer contact')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium text-xs hover:bg-indigo-700 transition-colors shadow-sm"
              >
                <Send className="w-3.5 h-3.5" /> Mark as Sent
              </button>
            </PermissionGate>
          )}

          {['SUBMITTED', 'SENT'].includes(quotation.status) && (
            <button
              onClick={() => onStatusChange('ACCEPTED', 'Customer confirmed order')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium text-xs hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Check className="w-3.5 h-3.5" /> Mark Accepted
            </button>
          )}

          {quotation.status === 'ACCEPTED' && (
            <PermissionGate screen="SALES_QUOTATION" action="CONVERT_TO_SO">
              <button
                onClick={onConvertToSo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 text-white font-medium text-xs hover:bg-purple-700 transition-colors shadow-sm animate-pulse"
              >
                <ArrowRight className="w-3.5 h-3.5" /> Convert to Sales Order
              </button>
            </PermissionGate>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: Quotation Form Modal (Create / Edit)
// ============================================================================
interface QuotationFormModalProps {
  isOpen: boolean;
  initialQuotation?: Quotation | null;
  lookups: QuotationLookups;
  onClose: () => void;
  onSuccess: () => void;
}

const QuotationFormModal: React.FC<QuotationFormModalProps> = ({
  initialQuotation,
  lookups,
  onClose,
  onSuccess,
}) => {
  const isEdit = !!initialQuotation;

  // Selected customer
  const [customerId, setCustomerId] = useState<number>(
    initialQuotation?.customer_id || lookups.customers[0]?.party_id || 1001,
  );

  // Address selections
  const customerAddresses = useMemo(
    () => lookups.addresses.filter((a) => a.party_id === customerId),
    [lookups.addresses, customerId],
  );

  const defaultBilling = customerAddresses.find((a) => a.is_default_billing) || customerAddresses[0];
  const defaultShipping = customerAddresses.find((a) => a.is_default_shipping) || customerAddresses[0];

  const [billingAddressId, setBillingAddressId] = useState<number | undefined>(
    initialQuotation?.billing_address_id || defaultBilling?.address_id,
  );
  const [shippingAddressId, setShippingAddressId] = useState<number | undefined>(
    initialQuotation?.shipping_address_id || defaultShipping?.address_id,
  );

  const [shippingStateCode, setShippingStateCode] = useState<string>(
    initialQuotation?.shipping_state_code || defaultShipping?.state_code || '24',
  );
  const [shippingStateName, setShippingStateName] = useState<string>(
    initialQuotation?.shipping_state_name || defaultShipping?.state_name || 'Gujarat',
  );

  // Commercial terms
  const [quotationNo, setQuotationNo] = useState<string>(initialQuotation?.quotation_no || '');
  const [quotationDate, setQuotationDate] = useState<string>(
    initialQuotation?.quotation_date || new Date().toISOString().split('T')[0],
  );
  const [inquiryRefNo, setInquiryRefNo] = useState<string>(initialQuotation?.inquiry_ref_no || '');
  const [inquiryDate, setInquiryDate] = useState<string>(initialQuotation?.inquiry_date || '');
  const [validUntil, setValidUntil] = useState<string>(() => {
    if (initialQuotation?.valid_until) return initialQuotation.valid_until;
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  });
  const [paymentTerms, setPaymentTerms] = useState<string>(
    initialQuotation?.payment_terms || 'NET_30',
  );
  const [deliveryTerms, setDeliveryTerms] = useState<string>(
    initialQuotation?.delivery_terms || 'EX_WORKS',
  );
  const [leadTimeDays, setLeadTimeDays] = useState<number>(
    initialQuotation?.delivery_lead_time_days || 14,
  );
  const [priceListId, setPriceListId] = useState<number | undefined>(
    initialQuotation?.price_list_id || lookups.priceLists[0]?.price_list_id,
  );
  const [headerDiscountPercent, setHeaderDiscountPercent] = useState<number>(
    initialQuotation?.discount_percent || 0,
  );
  const [freightCharges, setFreightCharges] = useState<number>(
    initialQuotation?.freight_charges || 0,
  );
  const [packagingCharges, setPackagingCharges] = useState<number>(
    initialQuotation?.packaging_charges || 0,
  );
  const [remarks, setRemarks] = useState<string>(initialQuotation?.remarks || '');
  const [termsAndConditions, setTermsAndConditions] = useState<string>(
    initialQuotation?.terms_and_conditions ||
      '1. Price validity: 30 days.\n2. Payment: Net 30 days.\n3. Taxes: Statutory GST extra as applicable.',
  );

  // Line items state
  const [lineItems, setLineItems] = useState<Array<QuotationItem>>(() => {
    if (initialQuotation?.items && initialQuotation.items.length > 0) {
      return initialQuotation.items;
    }
    const defaultItem = lookups.items[0];
    return [
      {
        item_sequence: 1,
        item_id: defaultItem?.item_id || 1008,
        item_code: defaultItem?.item_code || 'FG-GATE-VALVE-50',
        item_name: defaultItem?.item_name || 'SS-316 Gate Valve 2"',
        hsn_sac_code: defaultItem?.hsn_sac_code || '8481',
        uom_id: defaultItem?.sales_uom_id || 1003,
        uom_code: defaultItem?.uom_code || 'NOS',
        quantity: 10,
        unit_rate: Number(defaultItem?.sales_rate) || 5000,
        gross_amount: 50000,
        discount_percent: 0,
        discount_amount: 0,
        taxable_amount: 50000,
        gst_rate: Number(defaultItem?.tax_rate) || 18,
        cgst_rate: 9,
        cgst_amount: 4500,
        sgst_rate: 9,
        sgst_amount: 4500,
        igst_rate: 0,
        igst_amount: 0,
        total_tax_amount: 9000,
        total_amount: 59000,
        delivery_lead_time_days: 14,
      },
    ];
  });

  // Handle Customer Change
  const handleCustomerChange = (partyId: number) => {
    setCustomerId(partyId);
    const party = lookups.customers.find((c) => c.party_id === partyId);
    if (party) {
      if (party.payment_terms) setPaymentTerms(party.payment_terms);
    }
    const addrs = lookups.addresses.filter((a) => a.party_id === partyId);
    const ship = addrs.find((a) => a.is_default_shipping) || addrs[0];
    const bill = addrs.find((a) => a.is_default_billing) || addrs[0];
    if (ship) {
      setShippingAddressId(ship.address_id);
      setShippingStateCode(ship.state_code);
      setShippingStateName(ship.state_name);
    }
    if (bill) {
      setBillingAddressId(bill.address_id);
    }
  };

  // Handle Shipping Address change
  const handleShippingAddressChange = (addrId: number) => {
    setShippingAddressId(addrId);
    const addr = lookups.addresses.find((a) => a.address_id === addrId);
    if (addr) {
      setShippingStateCode(addr.state_code);
      setShippingStateName(addr.state_name);
    }
  };

  // Live GST Mode
  const isIntraState = (shippingStateCode || '24') === (lookups.currentBranch?.state_code || '24');

  // Recalculate line item taxes when item changes or shipping state changes
  const updateLineItem = (index: number, updates: Partial<QuotationItem>) => {
    setLineItems((prev) => {
      const next = [...prev];
      const curr = { ...next[index], ...updates };

      const qty = Number(curr.quantity) || 0;
      const rate = Number(curr.unit_rate) || 0;
      const gross = Math.round(qty * rate * 100) / 100;
      const discPct = Number(curr.discount_percent) || 0;
      const discAmt = Math.round(((gross * discPct) / 100) * 100) / 100;
      const taxable = Math.round((gross - discAmt) * 100) / 100;

      const gstRate = Number(curr.gst_rate ?? 18);
      let cgstRate = 0;
      let sgstRate = 0;
      let igstRate = 0;
      let cgstAmt = 0;
      let sgstAmt = 0;
      let igstAmt = 0;

      if (isIntraState) {
        cgstRate = gstRate / 2;
        sgstRate = gstRate / 2;
        cgstAmt = Math.round(((taxable * cgstRate) / 100) * 100) / 100;
        sgstAmt = Math.round(((taxable * sgstRate) / 100) * 100) / 100;
      } else {
        igstRate = gstRate;
        igstAmt = Math.round(((taxable * igstRate) / 100) * 100) / 100;
      }

      const totalTax = Math.round((cgstAmt + sgstAmt + igstAmt) * 100) / 100;
      const totalAmt = Math.round((taxable + totalTax) * 100) / 100;

      next[index] = {
        ...curr,
        gross_amount: gross,
        discount_amount: discAmt,
        taxable_amount: taxable,
        cgst_rate: cgstRate,
        cgst_amount: cgstAmt,
        sgst_rate: sgstRate,
        sgst_amount: sgstAmt,
        igst_rate: igstRate,
        igst_amount: igstAmt,
        total_tax_amount: totalTax,
        total_amount: totalAmt,
      };
      return next;
    });
  };

  const handleSelectItem = (index: number, itemId: number) => {
    const item = lookups.items.find((i) => i.item_id === itemId);
    if (!item) return;
    updateLineItem(index, {
      item_id: item.item_id,
      item_code: item.item_code,
      item_name: item.item_name,
      hsn_sac_code: item.hsn_sac_code || '8481',
      uom_id: item.sales_uom_id || 1003,
      uom_code: item.uom_code || 'NOS',
      unit_rate: Number(item.sales_rate) || 1000,
      gst_rate: Number(item.tax_rate) || 18,
    });
  };

  const addLineItem = () => {
    const defaultItem = lookups.items[0];
    setLineItems((prev) => [
      ...prev,
      {
        item_sequence: prev.length + 1,
        item_id: defaultItem?.item_id || 1008,
        item_code: defaultItem?.item_code || 'ITEM',
        item_name: defaultItem?.item_name || 'Quoted Product',
        hsn_sac_code: defaultItem?.hsn_sac_code || '8481',
        uom_id: defaultItem?.sales_uom_id || 1003,
        uom_code: defaultItem?.uom_code || 'NOS',
        quantity: 1,
        unit_rate: Number(defaultItem?.sales_rate) || 1000,
        gross_amount: Number(defaultItem?.sales_rate) || 1000,
        discount_percent: 0,
        discount_amount: 0,
        taxable_amount: Number(defaultItem?.sales_rate) || 1000,
        gst_rate: Number(defaultItem?.tax_rate) || 18,
        cgst_rate: isIntraState ? (Number(defaultItem?.tax_rate) || 18) / 2 : 0,
        cgst_amount: 0,
        sgst_rate: isIntraState ? (Number(defaultItem?.tax_rate) || 18) / 2 : 0,
        sgst_amount: 0,
        igst_rate: !isIntraState ? Number(defaultItem?.tax_rate) || 18 : 0,
        igst_amount: 0,
        total_tax_amount: 0,
        total_amount: Number(defaultItem?.sales_rate) || 1000,
        delivery_lead_time_days: 14,
      },
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Totals calculations
  const subtotal = useMemo(
    () => lineItems.reduce((acc, it) => acc + (Number(it.taxable_amount) || 0), 0),
    [lineItems],
  );
  const headerDiscAmt = Math.round(((subtotal * headerDiscountPercent) / 100) * 100) / 100;
  const netTaxable = Math.round((subtotal - headerDiscAmt) * 100) / 100;
  const totalTax = useMemo(
    () => lineItems.reduce((acc, it) => acc + (Number(it.total_tax_amount) || 0), 0),
    [lineItems],
  );
  const rawGrandTotal = netTaxable + totalTax + Number(freightCharges) + Number(packagingCharges);
  const grandTotal = Math.round(rawGrandTotal);
  const roundOff = Math.round((grandTotal - rawGrandTotal) * 100) / 100;

  // Submit Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const selectedCustomer = lookups.customers.find((c) => c.party_id === customerId);
      const selectedBilling = lookups.addresses.find((a) => a.address_id === billingAddressId);
      const selectedShipping = lookups.addresses.find((a) => a.address_id === shippingAddressId);

      const payload = {
        quotationNo: quotationNo || undefined,
        quotationDate,
        inquiryRefNo: inquiryRefNo || undefined,
        inquiryDate: inquiryDate || undefined,
        customerId,
        customerName: selectedCustomer?.party_name,
        contactPerson: selectedCustomer?.primary_contact_name,
        contactEmail: selectedCustomer?.primary_email,
        contactPhone: selectedCustomer?.primary_phone,
        billingAddressId,
        billingAddress: selectedBilling
          ? `${selectedBilling.address_line1}, ${selectedBilling.city} - ${selectedBilling.pincode}`
          : undefined,
        shippingAddressId,
        shippingAddress: selectedShipping
          ? `${selectedShipping.address_line1}, ${selectedShipping.city} - ${selectedShipping.pincode}`
          : undefined,
        shippingStateCode,
        shippingStateName,
        customerGstin: selectedShipping?.gstin || selectedBilling?.gstin,
        priceListId,
        validUntil,
        deliveryLeadTimeDays: Number(leadTimeDays) || 14,
        paymentTerms,
        deliveryTerms,
        discountPercent: Number(headerDiscountPercent) || 0,
        freightCharges: Number(freightCharges) || 0,
        packagingCharges: Number(packagingCharges) || 0,
        remarks: remarks || undefined,
        termsAndConditions: termsAndConditions || undefined,
        items: lineItems.map((it, idx) => ({
          itemSequence: idx + 1,
          itemId: it.item_id,
          itemCode: it.item_code,
          itemName: it.item_name,
          description: it.description || undefined,
          hsnSacCode: it.hsn_sac_code || undefined,
          uomId: it.uom_id,
          quantity: Number(it.quantity) || 1,
          unitRate: Number(it.unit_rate) || 0,
          discountPercent: Number(it.discount_percent) || 0,
          gstRate: Number(it.gst_rate) || 18,
          deliveryLeadTimeDays: Number(it.delivery_lead_time_days) || 14,
          remarks: it.remarks || undefined,
        })),
      };

      if (isEdit && initialQuotation) {
        await apiClient.put(`/sales/quotations/${initialQuotation.quotation_id}`, payload);
      } else {
        await apiClient.post('/sales/quotations', payload);
      }
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      alert(`Error saving quotation: ${err?.response?.data?.message || err.message}`);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden text-xs">
        {/* Modal Header */}
        <div className="p-4 border-b border-border/80 flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {isEdit ? `Edit Quotation #${initialQuotation.quotation_no}` : 'Create Commercial Quotation / Proforma Invoice'}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                GST Tax Engine • Plant State: {lookups.currentBranch?.state_name} ({lookups.currentBranch?.state_code}) • Active Mode:{' '}
                <span className="font-semibold text-primary">
                  {isIntraState ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Top Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-muted/20 p-3.5 rounded-xl border border-border/60">
            {/* Customer Select */}
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Customer Name <span className="text-rose-500">*</span>
              </label>
              <select
                value={customerId}
                onChange={(e) => handleCustomerChange(Number(e.target.value))}
                className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
              >
                {lookups.customers.map((c) => (
                  <option key={c.party_id} value={c.party_id}>
                    {c.party_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quotation Date */}
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Quotation Date
              </label>
              <input
                type="date"
                value={quotationDate}
                onChange={(e) => setQuotationDate(e.target.value)}
                className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Valid Until */}
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Valid Until Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* RFQ Reference */}
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Customer Inquiry / RFQ Ref #
              </label>
              <input
                type="text"
                placeholder="e.g. RFQ-MSIL-2026-441"
                value={inquiryRefNo}
                onChange={(e) => setInquiryRefNo(e.target.value)}
                className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Shipping Address & Destination State */}
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Shipping Destination (Drives GST)
              </label>
              <select
                value={shippingAddressId || ''}
                onChange={(e) => handleShippingAddressChange(Number(e.target.value))}
                className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
              >
                {customerAddresses.map((a) => (
                  <option key={a.address_id} value={a.address_id}>
                    {a.address_label} ({a.state_name} - {a.state_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Price List */}
            <div>
              <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                Rate Card / Price List
              </label>
              <select
                value={priceListId || ''}
                onChange={(e) => setPriceListId(Number(e.target.value) || undefined)}
                className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
              >
                <option value="">Default Catalog Rates</option>
                {lookups.priceLists.map((p) => (
                  <option key={p.price_list_id} value={p.price_list_id}>
                    {p.price_list_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Line Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-foreground text-xs flex items-center gap-1.5">
                <Boxes className="w-4 h-4 text-primary" /> Line Items ({lineItems.length})
              </span>
              <button
                type="button"
                onClick={addLineItem}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 font-medium text-[11px]"
              >
                <Plus className="w-3.5 h-3.5" /> Add Product Line
              </button>
            </div>

            <div className="border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead className="bg-muted/60 text-muted-foreground font-semibold">
                  <tr>
                    <th className="p-2 border-b border-border w-8">#</th>
                    <th className="p-2 border-b border-border min-w-[200px]">Item / Product</th>
                    <th className="p-2 border-b border-border text-center w-20">HSN</th>
                    <th className="p-2 border-b border-border text-right w-20">Qty</th>
                    <th className="p-2 border-b border-border text-right w-24">Rate (₹)</th>
                    <th className="p-2 border-b border-border text-right w-16">Disc %</th>
                    <th className="p-2 border-b border-border text-right w-24">Taxable</th>
                    <th className="p-2 border-b border-border text-center w-16">GST %</th>
                    <th className="p-2 border-b border-border text-right w-24">Total (₹)</th>
                    <th className="p-2 border-b border-border w-10 text-center">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {lineItems.map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/20">
                      <td className="p-2 text-muted-foreground font-mono">{idx + 1}</td>
                      <td className="p-2">
                        <select
                          value={item.item_id}
                          onChange={(e) => handleSelectItem(idx, Number(e.target.value))}
                          className="w-full bg-card border border-border rounded px-2 py-1 text-xs text-foreground focus:ring-1 focus:ring-primary"
                        >
                          {lookups.items.map((it) => (
                            <option key={it.item_id} value={it.item_id}>
                              {it.item_code} - {it.item_name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 text-center font-mono text-muted-foreground">
                        {item.hsn_sac_code || '8481'}
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(idx, { quantity: Number(e.target.value) })}
                          className="w-16 text-right bg-card border border-border rounded px-1.5 py-1 text-xs font-mono"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={item.unit_rate}
                          onChange={(e) => updateLineItem(idx, { unit_rate: Number(e.target.value) })}
                          className="w-20 text-right bg-card border border-border rounded px-1.5 py-1 text-xs font-mono"
                        />
                      </td>
                      <td className="p-2 text-right">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discount_percent}
                          onChange={(e) =>
                            updateLineItem(idx, { discount_percent: Number(e.target.value) })
                          }
                          className="w-14 text-right bg-card border border-border rounded px-1 py-1 text-xs font-mono"
                        />
                      </td>
                      <td className="p-2 text-right font-mono font-medium">
                        {item.taxable_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 text-center font-mono text-muted-foreground">
                        {item.gst_rate}%
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-foreground">
                        {item.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeLineItem(idx)}
                          disabled={lineItems.length === 1}
                          className="p-1 text-muted-foreground hover:text-rose-500 disabled:opacity-30"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Commercial Breakdown & Surcharges Bottom Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment & Terms */}
            <div className="space-y-3 bg-muted/20 p-3.5 rounded-xl border border-border/60">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Payment Terms
                  </label>
                  <select
                    value={paymentTerms}
                    onChange={(e) => setPaymentTerms(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs"
                  >
                    <option value="IMMEDIATE">Immediate / Advance</option>
                    <option value="NET_15">Net 15 Days</option>
                    <option value="NET_30">Net 30 Days</option>
                    <option value="NET_45">Net 45 Days</option>
                    <option value="NET_60">Net 60 Days</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                    Delivery Incoterms
                  </label>
                  <select
                    value={deliveryTerms}
                    onChange={(e) => setDeliveryTerms(e.target.value)}
                    className="w-full bg-card border border-border rounded-lg px-2 py-1 text-xs"
                  >
                    <option value="EX_WORKS">Ex-Works Plant</option>
                    <option value="FOR_DESTINATION">FOR Customer Destination</option>
                    <option value="FOB">FOB Port</option>
                    <option value="CIF">CIF Destination</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  Internal Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Special Tier-1 volume discount approved by MD"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1">
                  Terms & Conditions
                </label>
                <textarea
                  rows={2}
                  value={termsAndConditions}
                  onChange={(e) => setTermsAndConditions(e.target.value)}
                  className="w-full bg-card border border-border rounded-lg p-2 text-xs font-mono"
                />
              </div>
            </div>

            {/* Financial Rollup Summary Card */}
            <div className="bg-muted/30 p-4 rounded-xl border border-border/80 flex flex-col justify-between font-mono text-xs">
              <div className="space-y-1.5">
                <div className="flex justify-between text-muted-foreground">
                  <span>Line Taxable Subtotal:</span>
                  <span>₹ {subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Overall Discount (%):</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={headerDiscountPercent}
                    onChange={(e) => setHeaderDiscountPercent(Number(e.target.value))}
                    className="w-16 text-right bg-card border border-border rounded px-1.5 py-0.5 text-xs font-mono"
                  />
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Freight / Logistics (₹):</span>
                  <input
                    type="number"
                    min="0"
                    value={freightCharges}
                    onChange={(e) => setFreightCharges(Number(e.target.value))}
                    className="w-24 text-right bg-card border border-border rounded px-1.5 py-0.5 text-xs font-mono"
                  />
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span>Packaging Surcharges (₹):</span>
                  <input
                    type="number"
                    min="0"
                    value={packagingCharges}
                    onChange={(e) => setPackagingCharges(Number(e.target.value))}
                    className="w-24 text-right bg-card border border-border rounded px-1.5 py-0.5 text-xs font-mono"
                  />
                </div>

                <div className="border-t border-border pt-1.5 flex justify-between text-muted-foreground">
                  <span>
                    Total GST ({isIntraState ? 'CGST + SGST' : 'IGST'}):
                  </span>
                  <span>₹ {totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>

                <div className="flex justify-between text-muted-foreground text-[11px]">
                  <span>Round-off:</span>
                  <span>₹ {roundOff.toFixed(2)}</span>
                </div>
              </div>

              <div className="border-t-2 border-border/80 pt-2 flex justify-between items-center text-sm font-bold text-foreground mt-2">
                <span>Final Quotation Value:</span>
                <span className="text-primary text-base font-extrabold">
                  ₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border/80 bg-muted/20 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-border bg-card text-foreground hover:bg-muted font-medium text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            {isEdit ? 'Save Quotation Updates' : 'Generate & Issue Quotation'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: Revise Quotation Modal
// ============================================================================
interface ReviseQuotationModalProps {
  quotation: Quotation;
  onClose: () => void;
  onSuccess: () => void;
}

const ReviseQuotationModal: React.FC<ReviseQuotationModalProps> = ({
  quotation,
  onClose,
  onSuccess,
}) => {
  const [revisionReason, setRevisionReason] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(quotation.discount_percent || 0);
  const [freightCharges, setFreightCharges] = useState<number>(quotation.freight_charges || 0);

  const reviseMutation = useMutation({
    mutationFn: async () => {
      if (!revisionReason.trim()) {
        alert('Please specify the revision reason.');
        return;
      }
      await apiClient.post(`/sales/quotations/${quotation.quotation_id}/revise`, {
        revisionReason,
        discountPercent,
        freightCharges,
      });
    },
    onSuccess: () => {
      onSuccess();
    },
    onError: (err: any) => {
      alert(`Error revising quotation: ${err?.response?.data?.message || err.message}`);
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-5 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-foreground text-sm">
              Revise Quotation #{quotation.quotation_no}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-muted-foreground">
          This will archive the current revision (Rev {quotation.revision_no}) and increment to{' '}
          <strong className="text-foreground">Rev {quotation.revision_no + 1}</strong> with status reset to DRAFT.
        </p>

        <div>
          <label className="block font-medium text-muted-foreground mb-1">
            Reason for Revision <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            placeholder="e.g. Revised raw material cost bracket / customer volume discount"
            value={revisionReason}
            onChange={(e) => setRevisionReason(e.target.value)}
            className="w-full bg-muted/40 border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-muted-foreground mb-1">
              Adjust Discount (%)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(Number(e.target.value))}
              className="w-full bg-muted/40 border border-border rounded-lg p-2 text-xs font-mono"
            />
          </div>
          <div>
            <label className="block font-medium text-muted-foreground mb-1">
              Freight Charges (₹)
            </label>
            <input
              type="number"
              min="0"
              value={freightCharges}
              onChange={(e) => setFreightCharges(Number(e.target.value))}
              className="w-full bg-muted/40 border border-border rounded-lg p-2 text-xs font-mono"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => reviseMutation.mutate()}
            disabled={reviseMutation.isPending || !revisionReason.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50"
          >
            {reviseMutation.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            Confirm Revision
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: Convert to Sales Order Modal
// ============================================================================
interface ConvertToSoModalProps {
  quotation: Quotation;
  onClose: () => void;
  onConfirm: (customerPoNo?: string, customerPoDate?: string, remarks?: string) => void;
  isPending: boolean;
}

const ConvertToSoModal: React.FC<ConvertToSoModalProps> = ({
  quotation,
  onClose,
  onConfirm,
  isPending,
}) => {
  const [poNo, setPoNo] = useState<string>(quotation.inquiry_ref_no || '');
  const [poDate, setPoDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [notes, setNotes] = useState<string>('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-purple-600" />
            <h3 className="font-bold text-foreground text-sm">
              Convert Quotation #{quotation.quotation_no} to Sales Order
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 bg-purple-50 dark:bg-purple-950/40 rounded-lg border border-purple-200 dark:border-purple-800 text-purple-800 dark:text-purple-300">
          <p className="font-medium text-[11px]">
            ⚡ Step 7.1 ➔ Step 7.2 Integration Bridge: Converting this accepted quote will transition its line items to active Sales Order status, priming them for manufacturing work order reservation & MRP dispatch.
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block font-medium text-muted-foreground mb-1">
              Customer Official Purchase Order (PO) Number
            </label>
            <input
              type="text"
              placeholder="e.g. PO/MSIL/2026/09912"
              value={poNo}
              onChange={(e) => setPoNo(e.target.value)}
              className="w-full bg-muted/40 border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block font-medium text-muted-foreground mb-1">
              Customer PO Date
            </label>
            <input
              type="date"
              value={poDate}
              onChange={(e) => setPoDate(e.target.value)}
              className="w-full bg-muted/40 border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-purple-500"
            />
          </div>

          <div>
            <label className="block font-medium text-muted-foreground mb-1">
              Order Conversion Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Contract signed by VP Procurement. Phased delivery requested."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-muted/40 border border-border rounded-lg p-2 text-xs focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-border text-foreground hover:bg-muted font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(poNo, poDate, notes)}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-purple-600 text-white font-semibold hover:bg-purple-700 shadow-md disabled:opacity-50"
          >
            {isPending ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            Generate Sales Order
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENT: Print Commercial Quotation / Proforma Invoice Modal
// ============================================================================
interface PrintQuotationModalProps {
  quotationId: number;
  onClose: () => void;
}

const PrintQuotationModal: React.FC<PrintQuotationModalProps> = ({
  quotationId,
  onClose,
}) => {
  const { data: q, isLoading } = useQuery({
    queryKey: ['sales-quotation-print', quotationId],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<Quotation>>(
        `/sales/quotations/${quotationId}`,
      );
      return res.data.data;
    },
  });

  const formatCurrency = (val: number | undefined) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2,
    }).format(Number(val) || 0);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading || !q) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-card p-6 rounded-xl border border-border text-xs flex items-center gap-2">
          <RefreshCw className="w-4 h-4 animate-spin text-primary" /> Preparing statutory GST Proforma Invoice...
        </div>
      </div>
    );
  }

  const isIntraState = q.cgst_amount > 0 || q.sgst_amount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white text-zinc-900 border border-zinc-200 rounded-xl shadow-2xl w-full max-w-4xl p-8 my-auto print:p-0 print:border-none print:shadow-none print:w-full print:max-w-none text-xs">
        {/* Print & Close Toolbar (hidden during native print) */}
        <div className="flex items-center justify-between border-b border-zinc-200 pb-4 mb-6 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm text-zinc-800">
              Commercial Quotation / Proforma Invoice Preview
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 shadow-sm"
            >
              <Printer className="w-4 h-4" /> Print Document
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-100 text-zinc-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Statutory Invoice Canvas */}
        <div className="space-y-5" id="printable-quotation">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-zinc-900 pb-4">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight uppercase text-zinc-900">
                Kashvira Heavy Engineering Ltd.
              </h1>
              <p className="text-[11px] text-zinc-600 mt-0.5">
                Precision Discrete & Process Manufacturing Division • Plant: Plot 12, GIDC Vatva, Ahmedabad - 382445
              </p>
              <div className="text-[11px] text-zinc-700 mt-1 font-mono">
                GSTIN: <strong>24AAACK1234F1Z9</strong> • PAN: AAACK1234F • CIN: U28112GJ2026PLC09812
              </div>
            </div>

            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-zinc-900 text-white font-bold text-xs uppercase tracking-wider rounded">
                PROFORMA INVOICE
              </span>
              <div className="mt-2 text-sm font-bold font-mono text-zinc-900">
                {q.quotation_no}
              </div>
              <div className="text-[11px] text-zinc-600">
                Date: <strong>{q.quotation_date}</strong> (Rev {q.revision_no})
              </div>
              <div className="text-[11px] text-zinc-600">
                Valid Until: <strong>{q.valid_until}</strong>
              </div>
            </div>
          </div>

          {/* Customer & Address Details */}
          <div className="grid grid-cols-2 gap-4 border border-zinc-300 rounded-lg p-3 bg-zinc-50/50">
            <div>
              <span className="font-bold text-zinc-800 block text-[11px] uppercase tracking-wide border-b border-zinc-200 pb-1 mb-1.5">
                Buyer / Consignee (Bill To)
              </span>
              <div className="font-bold text-sm text-zinc-900">{q.customer_name}</div>
              <p className="text-zinc-600 text-[11px] mt-0.5 whitespace-pre-line leading-relaxed">
                {q.billing_address || 'Corporate Headquarters'}
              </p>
              <div className="mt-1.5 text-[11px] font-mono text-zinc-700">
                GSTIN: <strong>{q.customer_gstin || 'Unregistered'}</strong>
              </div>
              {q.contact_person && (
                <div className="text-[11px] text-zinc-600 mt-0.5">
                  Attn: {q.contact_person} ({q.contact_phone})
                </div>
              )}
            </div>

            <div>
              <span className="font-bold text-zinc-800 block text-[11px] uppercase tracking-wide border-b border-zinc-200 pb-1 mb-1.5">
                Dispatch / Shipping (Ship To)
              </span>
              <p className="text-zinc-600 text-[11px] whitespace-pre-line leading-relaxed">
                {q.shipping_address || q.billing_address || 'Plant Site Delivery'}
              </p>
              <div className="mt-1 text-[11px]">
                State of Supply:{' '}
                <strong>
                  {q.shipping_state_name} (Code: {q.shipping_state_code})
                </strong>
              </div>
              <div className="mt-0.5 text-[11px]">
                Incoterms: <strong>{q.delivery_terms}</strong> • Payment: <strong>{q.payment_terms}</strong>
              </div>
              {q.inquiry_ref_no && (
                <div className="mt-0.5 text-[11px]">
                  Customer RFQ Ref: <strong>{q.inquiry_ref_no}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Schedule of Goods / Items Table */}
          <table className="w-full text-left border border-zinc-300 border-collapse">
            <thead className="bg-zinc-100 text-zinc-800 font-bold border-b border-zinc-300 text-[10px] uppercase">
              <tr>
                <th className="p-2 border-r border-zinc-300 w-8 text-center">#</th>
                <th className="p-2 border-r border-zinc-300">Description of Goods</th>
                <th className="p-2 border-r border-zinc-300 text-center w-16">HSN/SAC</th>
                <th className="p-2 border-r border-zinc-300 text-right w-16">Qty</th>
                <th className="p-2 border-r border-zinc-300 text-center w-12">UOM</th>
                <th className="p-2 border-r border-zinc-300 text-right w-24">Unit Rate</th>
                <th className="p-2 border-r border-zinc-300 text-right w-24">Taxable Value</th>
                <th className="p-2 text-right w-24">Total (INR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 font-mono text-[11px]">
              {q.items?.map((item, idx) => (
                <tr key={idx}>
                  <td className="p-2 text-center text-zinc-500 border-r border-zinc-300">{idx + 1}</td>
                  <td className="p-2 font-sans border-r border-zinc-300">
                    <div className="font-bold text-zinc-900">{item.item_name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">{item.item_code}</div>
                  </td>
                  <td className="p-2 text-center text-zinc-600 border-r border-zinc-300">
                    {item.hsn_sac_code || '8481'}
                  </td>
                  <td className="p-2 text-right border-r border-zinc-300">{item.quantity}</td>
                  <td className="p-2 text-center text-zinc-600 border-r border-zinc-300">{item.uom_code || 'NOS'}</td>
                  <td className="p-2 text-right border-r border-zinc-300">{formatCurrency(item.unit_rate)}</td>
                  <td className="p-2 text-right font-semibold border-r border-zinc-300">
                    {formatCurrency(item.taxable_amount)}
                  </td>
                  <td className="p-2 text-right font-bold text-zinc-900">
                    {formatCurrency(item.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Bottom GST Summary & Totals */}
          <div className="grid grid-cols-2 gap-4">
            {/* GST Tax Breakdown Table */}
            <div className="border border-zinc-300 rounded p-2.5 bg-zinc-50/40">
              <span className="font-bold text-zinc-800 text-[10px] uppercase tracking-wide block mb-1">
                Indian GST Statutory Tax Summary
              </span>
              <table className="w-full text-[10px] font-mono border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 text-zinc-500">
                    <th className="text-left py-1">Tax Component</th>
                    <th className="text-center py-1">Rate</th>
                    <th className="text-right py-1">Amount (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {isIntraState ? (
                    <>
                      <tr>
                        <td className="py-1">Central GST (CGST)</td>
                        <td className="text-center">9.00%</td>
                        <td className="text-right font-medium">{formatCurrency(q.cgst_amount)}</td>
                      </tr>
                      <tr>
                        <td className="py-1">State GST (SGST)</td>
                        <td className="text-center">9.00%</td>
                        <td className="text-right font-medium">{formatCurrency(q.sgst_amount)}</td>
                      </tr>
                    </>
                  ) : (
                    <tr>
                      <td className="py-1">Integrated GST (IGST)</td>
                      <td className="text-center">28.00%</td>
                      <td className="text-right font-medium">{formatCurrency(q.igst_amount)}</td>
                    </tr>
                  )}
                  <tr className="font-bold border-t border-zinc-300">
                    <td className="py-1">Total Statutory Tax</td>
                    <td className="text-center">—</td>
                    <td className="text-right">{formatCurrency(q.total_tax_amount)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="mt-3 text-[10px] text-zinc-600 font-sans border-t border-zinc-200 pt-1.5">
                <strong>Bank Remittance Details:</strong>
                <div>Bank: State Bank of India • Industrial Finance Branch, Ahmedabad</div>
                <div className="font-mono">A/C: 38920199021 • IFSC: SBIN0004128</div>
              </div>
            </div>

            {/* Financial Totals Box */}
            <div className="border border-zinc-300 rounded p-3 font-mono text-xs space-y-1">
              <div className="flex justify-between text-zinc-600">
                <span>Total Taxable Amount:</span>
                <span>{formatCurrency(q.subtotal_amount)}</span>
              </div>
              {q.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Special Discount ({q.discount_percent}%):</span>
                  <span>- {formatCurrency(q.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-zinc-600">
                <span>Total GST Tax:</span>
                <span>{formatCurrency(q.total_tax_amount)}</span>
              </div>
              {q.freight_charges > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Freight & Logistics:</span>
                  <span>{formatCurrency(q.freight_charges)}</span>
                </div>
              )}
              {q.packaging_charges > 0 && (
                <div className="flex justify-between text-zinc-600">
                  <span>Packaging & Forwarding:</span>
                  <span>{formatCurrency(q.packaging_charges)}</span>
                </div>
              )}
              {q.round_off !== 0 && (
                <div className="flex justify-between text-zinc-500 text-[10px]">
                  <span>Round Off:</span>
                  <span>{formatCurrency(q.round_off)}</span>
                </div>
              )}
              <div className="border-t-2 border-zinc-900 pt-1.5 flex justify-between font-extrabold text-sm text-zinc-900">
                <span>Grand Total (INR):</span>
                <span>{formatCurrency(q.grand_total)}</span>
              </div>
            </div>
          </div>

          {/* Signatures & Declarations */}
          <div className="pt-4 flex justify-between items-end border-t border-zinc-200 text-[10px] text-zinc-600">
            <div>
              <p className="max-w-md italic">
                Declaration: We declare that this proforma invoice shows the actual price of the goods described and that all particulars are true and correct.
              </p>
            </div>
            <div className="text-center font-sans">
              <div className="h-10"></div>
              <div className="font-bold text-zinc-900">For Kashvira Heavy Engineering Ltd.</div>
              <div className="text-[10px] text-zinc-500">Authorized Commercial Signatory</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuotationMasterPage;
