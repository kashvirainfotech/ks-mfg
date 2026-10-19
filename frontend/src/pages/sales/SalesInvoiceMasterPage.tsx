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
  CreditCard,
  DollarSign,
  Download,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  HelpCircle,
  Layers,
  MapPin,
  Package,
  Pencil,
  Plus,
  Printer,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Trash2,
  TrendingUp,
  Truck,
  User,
  Users,
  Wallet,
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
    maximumFractionDigits: 2,
  }).format(val || 0);

const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

const formatDateTime = (dateStr?: string | null): string => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
};

// ----------------------------------------------------------------------------
// Interfaces & Types
// ----------------------------------------------------------------------------
export interface SalesInvoiceItem {
  invoiceItemId?: number;
  invoiceId?: number;
  soItemId?: number;
  challanItemId?: number;
  itemSequence?: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  description?: string;
  hsnSacCode?: string;
  uomId: number;
  uomCode?: string;
  quantity: number;
  unitRate: number;
  grossAmount?: number;
  discountPercent?: number;
  discountAmount?: number;
  taxableAmount?: number;
  gstRate?: number;
  cgstRate?: number;
  cgstAmount?: number;
  sgstRate?: number;
  sgstAmount?: number;
  igstRate?: number;
  igstAmount?: number;
  totalTaxAmount?: number;
  totalItemAmount?: number;
  batchNo?: string;
  heatNo?: string;
  remarks?: string;
}

export interface ArPaymentReceipt {
  paymentId: number;
  receiptNo: string;
  receiptDate: string;
  invoiceId: number;
  customerId: number;
  paymentMode: string;
  referenceNo?: string;
  paymentAmount: number;
  tdsAmount?: number;
  totalAllocatedAmount: number;
  bankName?: string;
  chequeDate?: string;
  remarks?: string;
  createdDate?: string;
}

export interface SalesInvoiceHeader {
  invoiceId: number;
  invoiceNo: string;
  invoiceDate: string;
  invoiceType: 'TAX_INVOICE' | 'EXPORT_INVOICE' | 'PROFORMA_INVOICE' | 'DEBIT_NOTE' | 'BILL_OF_SUPPLY';
  challanId?: number | null;
  soId?: number | null;
  customerId: number;
  customerName: string;
  contactPerson?: string | null;
  contactPhone?: string | null;
  billingAddressId?: number | null;
  billingAddress?: string | null;
  shippingAddressId?: number | null;
  shippingAddress?: string | null;
  placeOfSupply: string;
  customerGstin?: string | null;
  customerPan?: string | null;
  supplyType: 'INTRA_STATE' | 'INTER_STATE' | 'EXPORT_WITH_PAY' | 'EXPORT_WITHOUT_PAY';
  reverseChargeApplicable: boolean;
  transporterName?: string | null;
  vehicleNo?: string | null;
  lrRrNo?: string | null;
  lrRrDate?: string | null;
  irnStatus: 'NOT_GENERATED' | 'GENERATED' | 'CANCELLED' | 'FAILED';
  irnNo?: string | null;
  ackNo?: string | null;
  ackDate?: string | null;
  signedQrCode?: string | null;
  eWayBillNo?: string | null;
  eWayBillDate?: string | null;
  paymentTermsDays: number;
  dueDate: string;
  currencyCode: string;
  subtotalAmount: number;
  discountAmount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  totalTaxAmount: number;
  freightCharges: number;
  insuranceCharges: number;
  packagingCharges: number;
  tcsRate: number;
  tcsAmount: number;
  roundOff: number;
  totalInvoiceAmount: number;
  paidAmount: number;
  balanceAmount: number;
  status: 'DRAFT' | 'POSTED' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED';
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  postedBy?: number | null;
  postedAt?: string | null;
  cancelledBy?: number | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  remarks?: string | null;
  termsAndConditions?: string | null;
  isActive: boolean;
  items?: SalesInvoiceItem[];
  payments?: ArPaymentReceipt[];
}

export interface InvoiceSummary {
  total_invoices: number;
  total_invoiced_value: number;
  total_received_value: number;
  total_outstanding_ar: number;
  draft_count: number;
  posted_count: number;
  fully_paid_count: number;
  e_invoices_active: number;
  overdue_count: number;
}

export const SalesInvoiceMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // --------------------------------------------------------------------------
  // State: Filters, Search, Modals
  // --------------------------------------------------------------------------
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [paymentFilter, setPaymentFilter] = useState('ALL');
  const [irnFilter, setIrnFilter] = useState('ALL');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isIrnModalOpen, setIsIrnModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    invoiceType: 'TAX_INVOICE' | 'EXPORT_INVOICE' | 'PROFORMA_INVOICE' | 'DEBIT_NOTE' | 'BILL_OF_SUPPLY';
    invoiceDate: string;
    challanId?: number;
    soId?: number;
    customerId: number;
    customerName: string;
    contactPerson?: string;
    contactPhone?: string;
    billingAddressId?: number;
    billingAddress?: string;
    shippingAddressId?: number;
    shippingAddress?: string;
    placeOfSupply: string;
    customerGstin?: string;
    customerPan?: string;
    supplyType: 'INTRA_STATE' | 'INTER_STATE';
    reverseChargeApplicable: boolean;
    transporterName?: string;
    vehicleNo?: string;
    lrRrNo?: string;
    lrRrDate?: string;
    paymentTermsDays: number;
    dueDate?: string;
    freightCharges: number;
    insuranceCharges: number;
    packagingCharges: number;
    tcsRate: number;
    remarks?: string;
    termsAndConditions?: string;
    items: SalesInvoiceItem[];
  }>({
    invoiceType: 'TAX_INVOICE',
    invoiceDate: new Date().toISOString().split('T')[0],
    customerId: 0,
    customerName: '',
    placeOfSupply: '24 - Gujarat',
    supplyType: 'INTRA_STATE',
    reverseChargeApplicable: false,
    paymentTermsDays: 30,
    freightCharges: 0,
    insuranceCharges: 0,
    packagingCharges: 0,
    tcsRate: 0,
    items: [],
  });

  // Action form sub-states
  const [postRemarks, setPostRemarks] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [paymentForm, setPaymentForm] = useState<{
    paymentMode: 'NEFT_RTGS' | 'CHEQUE' | 'UPI' | 'CASH' | 'BANK_TRANSFER' | 'CREDIT_ADJUSTMENT';
    referenceNo: string;
    paymentAmount: number;
    tdsAmount: number;
    bankName: string;
    chequeDate: string;
    remarks: string;
  }>({
    paymentMode: 'NEFT_RTGS',
    referenceNo: '',
    paymentAmount: 0,
    tdsAmount: 0,
    bankName: 'HDFC Bank Ltd',
    chequeDate: '',
    remarks: '',
  });

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery<InvoiceSummary>({
    queryKey: ['sales-invoices-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<InvoiceSummary>>('/sales/invoices/summary');
      return res.data.data;
    },
  });

  const { data: invoicesData, isLoading: isInvoicesLoading, refetch: refetchInvoices } = useQuery<{
    data: SalesInvoiceHeader[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }>({
    queryKey: ['sales-invoices-list', statusFilter, paymentFilter, irnFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (paymentFilter !== 'ALL') params.append('paymentStatus', paymentFilter);
      if (irnFilter !== 'ALL') params.append('irnStatus', irnFilter);
      if (search) params.append('search', search);
      const res = await apiClient.get<ApiResponse<any>>(`/sales/invoices?${params.toString()}`);
      return res.data.data;
    },
  });

  const { data: activeInvoiceData, isLoading: isActiveInvoiceLoading } = useQuery<{
    header: SalesInvoiceHeader;
    items: SalesInvoiceItem[];
    payments: ArPaymentReceipt[];
  }>({
    queryKey: ['sales-invoice-details', selectedInvoiceId],
    queryFn: async () => {
      if (!selectedInvoiceId) return null as any;
      const res = await apiClient.get<ApiResponse<any>>(`/sales/invoices/${selectedInvoiceId}`);
      return res.data.data;
    },
    enabled: !!selectedInvoiceId,
  });

  const { data: pendingDispatches } = useQuery<{
    dispatchedChallans: any[];
    openOrders: any[];
  }>({
    queryKey: ['sales-invoices-pending-dispatches'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>('/sales/invoices/pending-dispatches');
      return res.data.data;
    },
    enabled: isCreateModalOpen,
  });

  const { data: partiesList } = useQuery<any[]>({
    queryKey: ['crm-customer-parties'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/crm/parties?is_customer=true');
      return res.data.data;
    },
    enabled: isCreateModalOpen || isEditModalOpen,
  });

  const { data: itemsList } = useQuery<any[]>({
    queryKey: ['inv-items-master'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any[]>>('/inventory/items');
      return res.data.data;
    },
    enabled: isCreateModalOpen || isEditModalOpen,
  });

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post<ApiResponse<any>>('/sales/invoices', payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices-list'] });
      queryClient.invalidateQueries({ queryKey: ['sales-invoices-summary'] });
      setIsCreateModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.put<ApiResponse<any>>(`/sales/invoices/${id}`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices-list'] });
      queryClient.invalidateQueries({ queryKey: ['sales-invoices-summary'] });
      queryClient.invalidateQueries({ queryKey: ['sales-invoice-details', selectedInvoiceId] });
      setIsEditModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiClient.delete<ApiResponse<any>>(`/sales/invoices/${id}`);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices-list'] });
      queryClient.invalidateQueries({ queryKey: ['sales-invoices-summary'] });
      setIsDeleteModalOpen(false);
      setSelectedInvoiceId(null);
    },
  });

  const postMutation = useMutation({
    mutationFn: async ({ id, remarks }: { id: number; remarks?: string }) => {
      const res = await apiClient.post<ApiResponse<any>>(`/sales/invoices/${id}/post`, { remarks });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices-list'] });
      queryClient.invalidateQueries({ queryKey: ['sales-invoices-summary'] });
      queryClient.invalidateQueries({ queryKey: ['sales-invoice-details', selectedInvoiceId] });
      setIsPostModalOpen(false);
    },
  });

  const generateIrnMutation = useMutation({
    mutationFn: async ({ id, override }: { id: number; override?: boolean }) => {
      const res = await apiClient.post<ApiResponse<any>>(`/sales/invoices/${id}/generate-irn`, { override });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices-list'] });
      queryClient.invalidateQueries({ queryKey: ['sales-invoices-summary'] });
      queryClient.invalidateQueries({ queryKey: ['sales-invoice-details', selectedInvoiceId] });
      setIsIrnModalOpen(false);
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async ({ id, payload }: { id: number; payload: any }) => {
      const res = await apiClient.post<ApiResponse<any>>(`/sales/invoices/${id}/record-payment`, payload);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices-list'] });
      queryClient.invalidateQueries({ queryKey: ['sales-invoices-summary'] });
      queryClient.invalidateQueries({ queryKey: ['sales-invoice-details', selectedInvoiceId] });
      setIsPaymentModalOpen(false);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, cancellationReason }: { id: number; cancellationReason: string }) => {
      const res = await apiClient.post<ApiResponse<any>>(`/sales/invoices/${id}/cancel`, { cancellationReason });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-invoices-list'] });
      queryClient.invalidateQueries({ queryKey: ['sales-invoices-summary'] });
      queryClient.invalidateQueries({ queryKey: ['sales-invoice-details', selectedInvoiceId] });
      setIsCancelModalOpen(false);
    },
  });

  // --------------------------------------------------------------------------
  // 1-Click Loaders
  // --------------------------------------------------------------------------
  const handleLoadFromChallan = async (challanId: number) => {
    try {
      const res = await apiClient.get<ApiResponse<any>>(`/sales/invoices/challan-details/${challanId}`);
      const data = res.data.data;
      const header = data.header;
      const items = data.items;
      const customer = data.customer;

      const isIntra = (customer?.stateCode || '24') === '24';
      const supplyType = isIntra ? 'INTRA_STATE' : 'INTER_STATE';

      const mappedItems: SalesInvoiceItem[] = items.map((it: any) => ({
        challanItemId: it.challanItemId,
        soItemId: it.soItemId,
        itemId: it.itemId,
        itemCode: it.itemCode,
        itemName: it.itemName,
        description: it.description,
        hsnSacCode: it.hsnSacCode || '8481',
        uomId: it.uomId,
        quantity: Number(it.dispatchedQty),
        unitRate: Number(it.unitRate),
        discountPercent: 0,
        gstRate: 18,
        batchNo: it.batchNo,
        heatNo: it.heatNo,
        remarks: it.remarks,
      }));

      setFormData({
        invoiceType: 'TAX_INVOICE',
        invoiceDate: new Date().toISOString().split('T')[0],
        challanId: header.challanId,
        soId: header.soId,
        customerId: header.customerId,
        customerName: header.customerName,
        contactPerson: header.contactPerson,
        contactPhone: header.contactPhone,
        billingAddressId: header.billingAddressId,
        billingAddress: header.billingAddress,
        shippingAddressId: header.shippingAddressId,
        shippingAddress: header.shippingAddress,
        placeOfSupply: `${header.shippingStateCode || '24'} - ${header.shippingStateName || 'Gujarat'}`,
        customerGstin: header.customerGstin,
        customerPan: customer?.panNo,
        supplyType,
        reverseChargeApplicable: false,
        transporterName: header.transporterName,
        vehicleNo: header.vehicleNo,
        lrRrNo: header.lrRrNo,
        lrRrDate: header.lrRrDate,
        paymentTermsDays: customer?.creditDays || 30,
        freightCharges: 0,
        insuranceCharges: 0,
        packagingCharges: 0,
        tcsRate: 0,
        remarks: `Invoice generated against Delivery Challan #${header.challanNo}`,
        termsAndConditions: '1. Payment due strictly within agreed credit terms. 2. Interest @ 18% p.a. chargeable on delayed payment.',
        items: mappedItems,
      });
    } catch (err: any) {
      alert(`Failed to load Delivery Challan: ${err.message}`);
    }
  };

  const handleLoadFromSo = async (soId: number) => {
    try {
      const res = await apiClient.get<ApiResponse<any>>(`/sales/invoices/so-details/${soId}`);
      const data = res.data.data;
      const header = data.header;
      const items = data.items;
      const customer = data.customer;

      const isIntra = (customer?.stateCode || '24') === '24';
      const supplyType = isIntra ? 'INTRA_STATE' : 'INTER_STATE';

      const mappedItems: SalesInvoiceItem[] = items
        .filter((it: any) => Number(it.orderedQty) > Number(it.invoicedQty || 0))
        .map((it: any) => {
          const pendingQty = Number(it.orderedQty) - Number(it.invoicedQty || 0);
          return {
            soItemId: it.soItemId,
            itemId: it.itemId,
            itemCode: it.itemCode,
            itemName: it.itemName,
            description: it.description,
            hsnSacCode: it.hsnSacCode || '8481',
            uomId: it.uomId,
            quantity: pendingQty,
            unitRate: Number(it.unitRate),
            discountPercent: Number(it.discountPercent || 0),
            gstRate: Number(it.gstRate || 18),
            remarks: it.remarks,
          };
        });

      setFormData({
        invoiceType: 'TAX_INVOICE',
        invoiceDate: new Date().toISOString().split('T')[0],
        soId: header.soId,
        customerId: header.customerId,
        customerName: header.customerName,
        contactPerson: header.contactPerson,
        contactPhone: header.contactPhone,
        billingAddressId: header.billingAddressId,
        billingAddress: header.billingAddress,
        shippingAddressId: header.shippingAddressId,
        shippingAddress: header.shippingAddress,
        placeOfSupply: `${header.shippingStateCode || '24'} - ${header.shippingStateName || 'Gujarat'}`,
        customerGstin: header.customerGstin,
        customerPan: customer?.panNo,
        supplyType,
        reverseChargeApplicable: false,
        paymentTermsDays: customer?.creditDays || 30,
        freightCharges: 0,
        insuranceCharges: 0,
        packagingCharges: 0,
        tcsRate: 0,
        remarks: `Direct Tax Invoice against Sales Order #${header.soNo}`,
        termsAndConditions: header.termsAndConditions || '1. Payment due strictly within agreed credit terms.',
        items: mappedItems,
      });
    } catch (err: any) {
      alert(`Failed to load Sales Order: ${err.message}`);
    }
  };

  // --------------------------------------------------------------------------
  // Form Line Item Calculation Helpers
  // --------------------------------------------------------------------------
  const calculatedTotals = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let taxable = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;

    const isIntra = formData.supplyType === 'INTRA_STATE';

    formData.items.forEach((it) => {
      const qty = Number(it.quantity || 0);
      const rate = Number(it.unitRate || 0);
      const gross = Math.round(qty * rate * 100) / 100;
      const discPct = Number(it.discountPercent || 0);
      const discAmt = Math.round(gross * (discPct / 100) * 100) / 100;
      const itemTaxable = Math.round((gross - discAmt) * 100) / 100;

      const gstRate = Number(it.gstRate || 18);
      let lineCgst = 0;
      let lineSgst = 0;
      let lineIgst = 0;

      if (isIntra) {
        lineCgst = Math.round(itemTaxable * (gstRate / 2 / 100) * 100) / 100;
        lineSgst = Math.round(itemTaxable * (gstRate / 2 / 100) * 100) / 100;
      } else {
        lineIgst = Math.round(itemTaxable * (gstRate / 100) * 100) / 100;
      }

      subtotal += gross;
      totalDiscount += discAmt;
      taxable += itemTaxable;
      cgst += lineCgst;
      sgst += lineSgst;
      igst += lineIgst;
    });

    const totalTax = cgst + sgst + igst;
    const freight = Number(formData.freightCharges || 0);
    const insurance = Number(formData.insuranceCharges || 0);
    const packaging = Number(formData.packagingCharges || 0);
    const tcsRate = Number(formData.tcsRate || 0);

    const preliminary = taxable + totalTax + freight + insurance + packaging;
    const tcs = Math.round(preliminary * (tcsRate / 100) * 100) / 100;
    const unrounded = preliminary + tcs;
    const rounded = Math.round(unrounded);
    const roundOff = Math.round((rounded - unrounded) * 100) / 100;

    return {
      subtotal,
      totalDiscount,
      taxable,
      cgst,
      sgst,
      igst,
      totalTax,
      freight,
      insurance,
      packaging,
      tcs,
      roundOff,
      totalInvoice: rounded,
    };
  }, [formData]);

  // --------------------------------------------------------------------------
  // Table Columns Definition
  // --------------------------------------------------------------------------
  const columns: MasterTableColumn<SalesInvoiceHeader>[] = useMemo(
    () => [
      {
        key: 'invoiceNo',
        header: 'Invoice No & Type',
        sortable: true,
        render: (row: SalesInvoiceHeader) => (
          <div className="flex flex-col">
            <span className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Receipt className="w-4 h-4 text-teal-600" />
              {row.invoiceNo}
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                {row.invoiceType.replace('_', ' ')}
              </span>
              {row.challanId && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                  via DC
                </span>
              )}
              {row.soId && (
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                  via SO
                </span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'invoiceDate',
        header: 'Dates',
        sortable: true,
        render: (row: SalesInvoiceHeader) => (
          <div className="flex flex-col text-xs text-slate-600">
            <span className="font-medium text-slate-800">Inv: {formatDate(row.invoiceDate)}</span>
            <span className="text-[11px] text-slate-500">Due: {formatDate(row.dueDate)}</span>
          </div>
        ),
      },
      {
        key: 'customer',
        header: 'Customer & GSTIN',
        sortable: true,
        render: (row: SalesInvoiceHeader) => (
          <div className="flex flex-col max-w-[220px]">
            <span className="font-semibold text-slate-800 text-xs truncate" title={row.customerName}>
              {row.customerName}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">
              {row.customerGstin || 'Unregistered'}
            </span>
            <span className="text-[10px] text-slate-400">
              {row.placeOfSupply} ({row.supplyType === 'INTRA_STATE' ? 'Intra-State' : 'Inter-State'})
            </span>
          </div>
        ),
      },
      {
        key: 'taxable',
        header: 'Taxable Val',
        sortable: true,
        render: (row: SalesInvoiceHeader) => (
          <div className="text-right font-medium text-xs text-slate-700">
            {formatInr(Number(row.taxableAmount))}
          </div>
        ),
      },
      {
        key: 'tax',
        header: 'GST Tax',
        sortable: true,
        render: (row: SalesInvoiceHeader) => (
          <div className="text-right text-xs">
            <div className="font-medium text-slate-800">{formatInr(Number(row.totalTaxAmount))}</div>
            <div className="text-[10px] text-slate-400">
              {row.supplyType === 'INTRA_STATE' ? 'CGST+SGST' : 'IGST 18%'}
            </div>
          </div>
        ),
      },
      {
        key: 'totalInvoice',
        header: 'Invoice Amount',
        sortable: true,
        render: (row: SalesInvoiceHeader) => (
          <div className="text-right">
            <span className="font-bold text-sm text-teal-700">
              {formatInr(Number(row.totalInvoiceAmount))}
            </span>
          </div>
        ),
      },
      {
        key: 'arBalance',
        header: 'Collected / Due',
        sortable: true,
        render: (row: SalesInvoiceHeader) => {
          const bal = Number(row.balanceAmount);
          const paid = Number(row.paidAmount);
          return (
            <div className="text-right text-xs">
              <div className="text-emerald-700 font-medium">Rec: {formatInr(paid)}</div>
              <div className={`font-semibold ${bal > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                Due: {formatInr(bal)}
              </div>
            </div>
          );
        },
      },
      {
        key: 'paymentStatus',
        header: 'Payment',
        sortable: true,
        render: (row: SalesInvoiceHeader) => {
          let badge = 'bg-slate-100 text-slate-700';
          if (row.paymentStatus === 'PAID') badge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
          else if (row.paymentStatus === 'PARTIALLY_PAID') badge = 'bg-blue-100 text-blue-800 border-blue-300';
          else if (row.paymentStatus === 'UNPAID') badge = 'bg-amber-100 text-amber-800 border-amber-300';

          return (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badge}`}>
              {row.paymentStatus}
            </span>
          );
        },
      },
      {
        key: 'irnStatus',
        header: 'E-Invoice IRN',
        sortable: true,
        render: (row: SalesInvoiceHeader) => {
          if (row.irnStatus === 'GENERATED') {
            return (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <QrCode className="w-3 h-3" />
                IRN Active
              </span>
            );
          }
          if (row.irnStatus === 'CANCELLED') {
            return (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                Cancelled
              </span>
            );
          }
          return (
            <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
              Pending
            </span>
          );
        },
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (row: SalesInvoiceHeader) => {
          let badge = 'bg-slate-100 text-slate-700 border-slate-300';
          if (row.status === 'POSTED') badge = 'bg-purple-100 text-purple-800 border-purple-300';
          else if (row.status === 'PAID') badge = 'bg-emerald-100 text-emerald-800 border-emerald-300';
          else if (row.status === 'CANCELLED') badge = 'bg-rose-100 text-rose-800 border-rose-300';

          return (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${badge}`}>
              {row.status}
            </span>
          );
        },
      },
    ],
    [],
  );

  const selectedInvoice = invoicesData?.data?.find((i) => i.invoiceId === selectedInvoiceId);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* -------------------------------------------------------------------- */}
      {/* Page Header */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-50 text-teal-600 border border-teal-200 shadow-sm">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                Sales Tax Invoices & Customer Receivables
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Statutory GST Rule 46 Tax Invoicing, E-Invoicing (IRN), and Customer AR Collections Sub-Ledger
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <PermissionGate screen="SALES_INVOICE" action="ADD">
            <button
              onClick={() => {
                setFormData({
                  invoiceType: 'TAX_INVOICE',
                  invoiceDate: new Date().toISOString().split('T')[0],
                  customerId: 0,
                  customerName: '',
                  placeOfSupply: '24 - Gujarat',
                  supplyType: 'INTRA_STATE',
                  reverseChargeApplicable: false,
                  paymentTermsDays: 30,
                  freightCharges: 0,
                  insuranceCharges: 0,
                  packagingCharges: 0,
                  tcsRate: 0,
                  items: [],
                });
                setIsCreateModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              New Tax Invoice
            </button>
          </PermissionGate>

          <button
            onClick={() => refetchInvoices()}
            className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-all"
            title="Refresh Invoices"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* KPI Summary Cards */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Invoiced */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Invoiced
            </span>
            <div className="text-xl font-bold text-slate-900 mt-1">
              {formatInr(Number(summaryData?.total_invoiced_value || 0))}
            </div>
            <span className="text-[11px] text-slate-400">
              {summaryData?.total_invoices || 0} Invoices Generated
            </span>
          </div>
          <div className="p-3 bg-teal-50 rounded-xl text-teal-600">
            <Receipt className="w-5 h-5" />
          </div>
        </div>

        {/* Outstanding AR */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Outstanding AR
            </span>
            <div className="text-xl font-bold text-rose-600 mt-1">
              {formatInr(Number(summaryData?.total_outstanding_ar || 0))}
            </div>
            <span className="text-[11px] text-slate-400">
              Pending Customer Collections
            </span>
          </div>
          <div className="p-3 bg-rose-50 rounded-xl text-rose-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Realized Receipts */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Collections Received
            </span>
            <div className="text-xl font-bold text-emerald-600 mt-1">
              {formatInr(Number(summaryData?.total_received_value || 0))}
            </div>
            <span className="text-[11px] text-slate-400">
              {summaryData?.fully_paid_count || 0} Fully Settled Bills
            </span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        {/* E-Invoices Active */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              E-Invoices Active
            </span>
            <div className="text-xl font-bold text-indigo-600 mt-1">
              {summaryData?.e_invoices_active || 0}
            </div>
            <span className="text-[11px] text-slate-400">
              IRN & Signed QR Valid
            </span>
          </div>
          <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600">
            <QrCode className="w-5 h-5" />
          </div>
        </div>

        {/* Overdue Accounts */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Overdue Receivables
            </span>
            <div className="text-xl font-bold text-amber-600 mt-1">
              {summaryData?.overdue_count || 0}
            </div>
            <span className="text-[11px] text-slate-400">
              Past Agreed Due Date
            </span>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Filters Bar */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Search */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Invoice #, Customer, GSTIN, IRN..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">All Invoice Statuses</option>
            <option value="DRAFT">DRAFT</option>
            <option value="POSTED">POSTED</option>
            <option value="PAID">PAID</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>

          {/* Payment Status Filter */}
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">All Payment Statuses</option>
            <option value="UNPAID">UNPAID</option>
            <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
            <option value="PAID">FULLY PAID</option>
          </select>

          {/* IRN Status Filter */}
          <select
            value={irnFilter}
            onChange={(e) => setIrnFilter(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <option value="ALL">All IRN Statuses</option>
            <option value="GENERATED">IRN Generated</option>
            <option value="NOT_GENERATED">Pending IRN</option>
            <option value="CANCELLED">IRN Cancelled</option>
          </select>
        </div>

        <div className="text-xs text-slate-500">
          Showing <span className="font-bold text-slate-800">{invoicesData?.data?.length || 0}</span> invoices
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Master Data Table */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <MasterDataTable<SalesInvoiceHeader>
          title="Sales Tax Invoices & Customer Receivables"
          subtitle="Statutory GST Rule 46 Tax Invoices, E-Invoicing (IRN), and Customer AR Collections Sub-Ledger"
          screenCode="SALES_INVOICE"
          data={invoicesData?.data || []}
          columns={columns}
          isLoading={isInvoicesLoading}
          rowKey={(row) => row.invoiceId}
          searchPredicate={(row, query) =>
            row.invoiceNo.toLowerCase().includes(query.toLowerCase()) ||
            row.customerName.toLowerCase().includes(query.toLowerCase()) ||
            (row.customerGstin?.toLowerCase().includes(query.toLowerCase()) ?? false) ||
            (row.irnNo?.toLowerCase().includes(query.toLowerCase()) ?? false) ||
            (row.eWayBillNo?.toLowerCase().includes(query.toLowerCase()) ?? false)
          }
          renderRowActions={(row) => (
            <div className="flex items-center gap-1 justify-end">
              {/* View Details */}
              <button
                onClick={() => {
                  setSelectedInvoiceId(row.invoiceId);
                  setIsDrawerOpen(true);
                }}
                title="View Invoice Details & AR Ledger"
                className="p-1 rounded-md text-slate-500 hover:text-teal-600 hover:bg-slate-100"
              >
                <Eye className="w-4 h-4" />
              </button>

              {/* Print */}
              <PermissionGate screen="SALES_INVOICE" action="PRINT">
                <button
                  onClick={() => {
                    setSelectedInvoiceId(row.invoiceId);
                    setIsPrintModalOpen(true);
                  }}
                  title="Print Statutory GST Tax Invoice (Rule 46)"
                  className="p-1 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-slate-100"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </PermissionGate>

              {/* Post (DRAFT only) */}
              {row.status === 'DRAFT' && (
                <PermissionGate screen="SALES_INVOICE" action="POST">
                  <button
                    onClick={() => {
                      setSelectedInvoiceId(row.invoiceId);
                      setPostRemarks('');
                      setIsPostModalOpen(true);
                    }}
                    title="Post & Finalize Invoice / Post AR Ledger"
                    className="p-1 rounded-md text-slate-500 hover:text-purple-600 hover:bg-slate-100"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </PermissionGate>
              )}

              {/* Generate IRN */}
              {row.status !== 'CANCELLED' && row.irnStatus !== 'GENERATED' && (
                <PermissionGate screen="SALES_INVOICE" action="GENERATE_IRN">
                  <button
                    onClick={() => {
                      setSelectedInvoiceId(row.invoiceId);
                      setIsIrnModalOpen(true);
                    }}
                    title="Generate E-Invoice IRN & QR Code"
                    className="p-1 rounded-md text-slate-500 hover:text-emerald-600 hover:bg-slate-100"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                </PermissionGate>
              )}

              {/* Record Payment (POSTED or PARTIALLY_PAID) */}
              {['POSTED', 'PARTIALLY_PAID'].includes(row.status) && (
                <PermissionGate screen="SALES_INVOICE" action="RECORD_PAYMENT">
                  <button
                    onClick={() => {
                      setSelectedInvoiceId(row.invoiceId);
                      setPaymentForm({
                        paymentMode: 'NEFT_RTGS',
                        referenceNo: '',
                        paymentAmount: Number(row.balanceAmount),
                        tdsAmount: 0,
                        bankName: 'HDFC Bank Ltd',
                        chequeDate: '',
                        remarks: `Payment for Invoice #${row.invoiceNo}`,
                      });
                      setIsPaymentModalOpen(true);
                    }}
                    title="Record Customer Payment Receipt / AR Clearance"
                    className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-slate-100"
                  >
                    <CreditCard className="w-4 h-4" />
                  </button>
                </PermissionGate>
              )}

              {/* Edit (DRAFT only) */}
              {row.status === 'DRAFT' && (
                <PermissionGate screen="SALES_INVOICE" action="EDIT">
                  <button
                    onClick={() => {
                      setSelectedInvoiceId(row.invoiceId);
                      setFormData({
                        invoiceType: row.invoiceType,
                        invoiceDate: row.invoiceDate,
                        challanId: row.challanId || undefined,
                        soId: row.soId || undefined,
                        customerId: row.customerId,
                        customerName: row.customerName,
                        contactPerson: row.contactPerson || '',
                        contactPhone: row.contactPhone || '',
                        billingAddressId: row.billingAddressId || undefined,
                        billingAddress: row.billingAddress || '',
                        shippingAddressId: row.shippingAddressId || undefined,
                        shippingAddress: row.shippingAddress || '',
                        placeOfSupply: row.placeOfSupply,
                        customerGstin: row.customerGstin || '',
                        customerPan: row.customerPan || '',
                        supplyType: row.supplyType as any,
                        reverseChargeApplicable: row.reverseChargeApplicable,
                        transporterName: row.transporterName || '',
                        vehicleNo: row.vehicleNo || '',
                        lrRrNo: row.lrRrNo || '',
                        lrRrDate: row.lrRrDate || '',
                        paymentTermsDays: row.paymentTermsDays,
                        dueDate: row.dueDate,
                        freightCharges: Number(row.freightCharges || 0),
                        insuranceCharges: Number(row.insuranceCharges || 0),
                        packagingCharges: Number(row.packagingCharges || 0),
                        tcsRate: Number(row.tcsRate || 0),
                        remarks: row.remarks || '',
                        termsAndConditions: row.termsAndConditions || '',
                        items: row.items || [],
                      });
                      setIsEditModalOpen(true);
                    }}
                    title="Edit Invoice"
                    className="p-1 rounded-md text-slate-500 hover:text-amber-600 hover:bg-slate-100"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                </PermissionGate>
              )}

              {/* Cancel (Non-cancelled, no payments) */}
              {row.status !== 'CANCELLED' && Number(row.paidAmount) === 0 && (
                <PermissionGate screen="SALES_INVOICE" action="CANCEL">
                  <button
                    onClick={() => {
                      setSelectedInvoiceId(row.invoiceId);
                      setCancelReason('');
                      setIsCancelModalOpen(true);
                    }}
                    title="Cancel Invoice"
                    className="p-1 rounded-md text-slate-500 hover:text-rose-600 hover:bg-slate-100"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                </PermissionGate>
              )}

              {/* Delete (DRAFT only) */}
              {row.status === 'DRAFT' && (
                <PermissionGate screen="SALES_INVOICE" action="DELETE">
                  <button
                    onClick={() => {
                      setSelectedInvoiceId(row.invoiceId);
                      setIsDeleteModalOpen(true);
                    }}
                    title="Delete Draft"
                    className="p-1 rounded-md text-slate-500 hover:text-rose-600 hover:bg-slate-100"
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
      {/* Invoice Details Drawer */}
      {/* -------------------------------------------------------------------- */}
      {isDrawerOpen && activeInvoiceData && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-4xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-teal-100 text-teal-700">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-900">
                      {activeInvoiceData.header.invoiceNo}
                    </h2>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                      {activeInvoiceData.header.status}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {activeInvoiceData.header.paymentStatus}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Customer: {activeInvoiceData.header.customerName} | Inv Date:{' '}
                    {formatDate(activeInvoiceData.header.invoiceDate)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsPrintModalOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="w-3.5 h-3.5 text-indigo-600" />
                  Print Tax Invoice
                </button>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 rounded-xl hover:bg-slate-200 text-slate-500 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-700">
              {/* E-Invoice & Statutory Block */}
              {activeInvoiceData.header.irnStatus === 'GENERATED' && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-teal-900 flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-teal-700" />
                      Statutory GST E-Invoice IRN Details (Rule 48(4))
                    </span>
                    <span className="text-[11px] font-mono text-teal-700">
                      Ack No: {activeInvoiceData.header.ackNo} | {formatDateTime(activeInvoiceData.header.ackDate)}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] bg-white/80 p-2 rounded border border-teal-200 break-all text-slate-800">
                    <span className="font-bold text-teal-800">IRN: </span>
                    {activeInvoiceData.header.irnNo}
                  </div>
                  {activeInvoiceData.header.eWayBillNo && (
                    <div className="text-[11px] text-slate-600 flex gap-4">
                      <span>
                        <strong>E-Way Bill:</strong> {activeInvoiceData.header.eWayBillNo}
                      </span>
                      <span>
                        <strong>E-Way Date:</strong> {formatDate(activeInvoiceData.header.eWayBillDate)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Commercial Summary Cards */}
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Taxable Value</span>
                  <div className="text-sm font-bold text-slate-800 mt-1">
                    {formatInr(Number(activeInvoiceData.header.taxableAmount))}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total GST Tax</span>
                  <div className="text-sm font-bold text-slate-800 mt-1">
                    {formatInr(Number(activeInvoiceData.header.totalTaxAmount))}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Net Invoice Amount</span>
                  <div className="text-sm font-bold text-teal-700 mt-1">
                    {formatInr(Number(activeInvoiceData.header.totalInvoiceAmount))}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Balance Due</span>
                  <div className="text-sm font-bold text-rose-600 mt-1">
                    {formatInr(Number(activeInvoiceData.header.balanceAmount))}
                  </div>
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <h3 className="font-bold text-slate-900 text-sm mb-2 flex items-center gap-2">
                  <Package className="w-4 h-4 text-teal-600" />
                  Billed Line Items ({activeInvoiceData.items.length})
                </h3>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Item Details</th>
                        <th className="py-2 px-3">HSN</th>
                        <th className="py-2 px-3 text-right">Qty</th>
                        <th className="py-2 px-3 text-right">Rate</th>
                        <th className="py-2 px-3 text-right">Taxable</th>
                        <th className="py-2 px-3 text-right">GST</th>
                        <th className="py-2 px-3 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeInvoiceData.items.map((it, idx) => (
                        <tr key={it.invoiceItemId || idx} className="hover:bg-slate-50">
                          <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3">
                            <div className="font-semibold text-slate-800">{it.itemName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{it.itemCode}</div>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600">{it.hsnSacCode || '-'}</td>
                          <td className="py-2 px-3 text-right font-medium">
                            {Number(it.quantity)} {it.uomCode || 'NOS'}
                          </td>
                          <td className="py-2 px-3 text-right">{formatInr(Number(it.unitRate))}</td>
                          <td className="py-2 px-3 text-right font-medium">
                            {formatInr(Number(it.taxableAmount))}
                          </td>
                          <td className="py-2 px-3 text-right text-slate-600">
                            {it.gstRate}% ({formatInr(Number(it.totalTaxAmount))})
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">
                            {formatInr(Number(it.totalItemAmount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Customer AR Payment Receipts History */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-emerald-600" />
                    Customer Payment Receipts & AR Collections ({activeInvoiceData.payments.length})
                  </h3>
                  {['POSTED', 'PARTIALLY_PAID'].includes(activeInvoiceData.header.status) && (
                    <PermissionGate screen="SALES_INVOICE" action="RECORD_PAYMENT">
                      <button
                        onClick={() => {
                          setPaymentForm({
                            paymentMode: 'NEFT_RTGS',
                            referenceNo: '',
                            paymentAmount: Number(activeInvoiceData.header.balanceAmount),
                            tdsAmount: 0,
                            bankName: 'HDFC Bank Ltd',
                            chequeDate: '',
                            remarks: `Payment against ${activeInvoiceData.header.invoiceNo}`,
                          });
                          setIsPaymentModalOpen(true);
                        }}
                        className="text-xs px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold flex items-center gap-1 shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Record Receipt
                      </button>
                    </PermissionGate>
                  )}
                </div>

                {activeInvoiceData.payments.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-slate-400">
                    No payment receipts recorded yet for this invoice.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3">Receipt No</th>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Mode</th>
                          <th className="py-2 px-3">Reference / UTR</th>
                          <th className="py-2 px-3">Bank</th>
                          <th className="py-2 px-3 text-right">TDS (₹)</th>
                          <th className="py-2 px-3 text-right">Paid (₹)</th>
                          <th className="py-2 px-3 text-right">Total Allocated</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeInvoiceData.payments.map((p) => (
                          <tr key={p.paymentId} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-bold text-slate-800">{p.receiptNo}</td>
                            <td className="py-2 px-3">{formatDate(p.receiptDate)}</td>
                            <td className="py-2 px-3">
                              <span className="font-semibold text-slate-700">
                                {p.paymentMode.replace('_', ' ')}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                              {p.referenceNo || '-'}
                            </td>
                            <td className="py-2 px-3 text-slate-600">{p.bankName || '-'}</td>
                            <td className="py-2 px-3 text-right text-slate-500">
                              {formatInr(Number(p.tdsAmount))}
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-emerald-700">
                              {formatInr(Number(p.paymentAmount))}
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">
                              {formatInr(Number(p.totalAllocatedAmount))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Logistics & Audit */}
              <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-4 text-slate-600 text-[11px]">
                <div>
                  <strong>Billing Address:</strong>
                  <p className="mt-0.5 text-slate-500">{activeInvoiceData.header.billingAddress || '-'}</p>
                  <strong className="block mt-2">Shipping Address:</strong>
                  <p className="mt-0.5 text-slate-500">{activeInvoiceData.header.shippingAddress || '-'}</p>
                </div>
                <div>
                  <strong>Transporter / Vehicle:</strong>
                  <p className="mt-0.5 text-slate-500">
                    {activeInvoiceData.header.transporterName || 'None'} | Vehicle:{' '}
                    {activeInvoiceData.header.vehicleNo || 'None'}
                  </p>
                  <strong className="block mt-2">Terms & Notes:</strong>
                  <p className="mt-0.5 text-slate-500">{activeInvoiceData.header.termsAndConditions || '-'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Create / Edit Invoice Modal with 1-Click Loaders */}
      {/* -------------------------------------------------------------------- */}
      {(isCreateModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-teal-100 text-teal-700">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {isEditModalOpen ? 'Edit Sales Tax Invoice' : 'Generate Statutory GST Tax Invoice'}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Compliant with Section 31 & Rule 46 of CGST Rules, 2017
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="p-2 rounded-xl hover:bg-slate-200 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
              {/* 1-Click Import Selectors (Create mode only) */}
              {isCreateModalOpen && (
                <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-200/80 space-y-3">
                  <span className="font-bold text-teal-900 text-xs flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-teal-700" />
                    1-Click Auto-Populate from Dispatched Warehouse Challan or Open Sales Order:
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Select Dispatched Delivery Challan (WMS Outward):
                      </label>
                      <select
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (val) handleLoadFromChallan(val);
                        }}
                        className="w-full text-xs p-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">-- Choose Dispatched Delivery Challan --</option>
                        {pendingDispatches?.dispatchedChallans?.map((dc) => (
                          <option key={dc.challan_id} value={dc.challan_id}>
                            {dc.challan_no} ({formatDate(dc.challan_date)}) - {dc.customer_name} (
                            {dc.item_count} items, ₹{Number(dc.total_value).toLocaleString('en-IN')})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Select Open Confirmed Sales Order:
                      </label>
                      <select
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (val) handleLoadFromSo(val);
                        }}
                        className="w-full text-xs p-2 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500"
                      >
                        <option value="">-- Choose Sales Order with Unbilled Balance --</option>
                        {pendingDispatches?.openOrders?.map((so) => (
                          <option key={so.so_id} value={so.so_id}>
                            {so.so_no} ({formatDate(so.so_date)}) - {so.customer_name} (
                            {so.item_count} items, ₹{Number(so.total_amount).toLocaleString('en-IN')})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Form Grid: Customer & Commercials */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Invoice Date *</label>
                  <input
                    type="date"
                    value={formData.invoiceDate}
                    onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Invoice Type *</label>
                  <select
                    value={formData.invoiceType}
                    onChange={(e) => setFormData({ ...formData, invoiceType: e.target.value as any })}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="TAX_INVOICE">Tax Invoice (Domestic B2B / B2C)</option>
                    <option value="EXPORT_INVOICE">Export Invoice</option>
                    <option value="PROFORMA_INVOICE">Proforma Invoice</option>
                    <option value="DEBIT_NOTE">Debit Note</option>
                    <option value="BILL_OF_SUPPLY">Bill of Supply (Exempted)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Customer Party *</label>
                  <select
                    value={formData.customerId}
                    onChange={(e) => {
                      const custId = Number(e.target.value);
                      const cust = partiesList?.find((p) => p.partyId === custId);
                      setFormData({
                        ...formData,
                        customerId: custId,
                        customerName: cust?.partyName || '',
                        customerGstin: cust?.gstin || '',
                        customerPan: cust?.panNo || '',
                        paymentTermsDays: cust?.creditDays || 30,
                        placeOfSupply: `${cust?.stateCode || '24'} - ${cust?.stateName || 'Gujarat'}`,
                        supplyType: (cust?.stateCode || '24') === '24' ? 'INTRA_STATE' : 'INTER_STATE',
                      });
                    }}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
                  >
                    <option value={0}>-- Select Customer --</option>
                    {partiesList?.map((p) => (
                      <option key={p.partyId} value={p.partyId}>
                        {p.partyName} ({p.partyCode})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Place of Supply *</label>
                  <input
                    type="text"
                    value={formData.placeOfSupply}
                    onChange={(e) => {
                      const pos = e.target.value;
                      const isIntra = pos.startsWith('24');
                      setFormData({
                        ...formData,
                        placeOfSupply: pos,
                        supplyType: isIntra ? 'INTRA_STATE' : 'INTER_STATE',
                      });
                    }}
                    placeholder="e.g. 24 - Gujarat or 06 - Haryana"
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">GST Treatment / Supply Type *</label>
                  <select
                    value={formData.supplyType}
                    onChange={(e) => setFormData({ ...formData, supplyType: e.target.value as any })}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="INTRA_STATE">Intra-State (CGST 9% + SGST 9%)</option>
                    <option value="INTER_STATE">Inter-State (IGST 18%)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1">Payment Terms (Days) & Due Date</label>
                  <input
                    type="number"
                    value={formData.paymentTermsDays}
                    onChange={(e) => setFormData({ ...formData, paymentTermsDays: Number(e.target.value) })}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Customer GSTIN</label>
                  <input
                    type="text"
                    value={formData.customerGstin || ''}
                    onChange={(e) => setFormData({ ...formData, customerGstin: e.target.value })}
                    placeholder="24AAACL0149A1ZW"
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Transporter Name</label>
                  <input
                    type="text"
                    value={formData.transporterName || ''}
                    onChange={(e) => setFormData({ ...formData, transporterName: e.target.value })}
                    placeholder="V-Trans, SafeXpress..."
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1">Vehicle Registration Number</label>
                  <input
                    type="text"
                    value={formData.vehicleNo || ''}
                    onChange={(e) => setFormData({ ...formData, vehicleNo: e.target.value })}
                    placeholder="GJ-06-AX-8942"
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Billing & Shipping Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1">Billing Address</label>
                  <textarea
                    rows={2}
                    value={formData.billingAddress || ''}
                    onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Shipping / Delivery Address</label>
                  <textarea
                    rows={2}
                    value={formData.shippingAddress || ''}
                    onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Line Items Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <Package className="w-4 h-4 text-teal-600" />
                    Invoice Items & Rate Schedule ({formData.items.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        items: [
                          ...formData.items,
                          {
                            itemId: itemsList?.[0]?.itemId || 1008,
                            itemCode: itemsList?.[0]?.itemCode || 'ITEM',
                            itemName: itemsList?.[0]?.itemName || 'New Item',
                            hsnSacCode: '8481',
                            uomId: 1003,
                            quantity: 1,
                            unitRate: 1000,
                            discountPercent: 0,
                            gstRate: 18,
                          },
                        ],
                      });
                    }}
                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Item Line
                  </button>
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Item</th>
                        <th className="py-2 px-3">HSN</th>
                        <th className="py-2 px-3 text-right">Qty</th>
                        <th className="py-2 px-3 text-right">Rate (₹)</th>
                        <th className="py-2 px-3 text-right">Disc %</th>
                        <th className="py-2 px-3 text-right">Taxable</th>
                        <th className="py-2 px-3 text-right">GST %</th>
                        <th className="py-2 px-3 text-right">Line Total</th>
                        <th className="py-2 px-2 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {formData.items.map((it, idx) => {
                        const qty = Number(it.quantity || 0);
                        const rate = Number(it.unitRate || 0);
                        const gross = qty * rate;
                        const disc = gross * ((it.discountPercent || 0) / 100);
                        const taxable = gross - disc;
                        const tax = taxable * ((it.gstRate || 18) / 100);
                        const total = taxable + tax;

                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 max-w-[200px]">
                              <input
                                type="text"
                                value={it.itemName}
                                onChange={(e) => {
                                  const updated = [...formData.items];
                                  updated[idx].itemName = e.target.value;
                                  setFormData({ ...formData, items: updated });
                                }}
                                className="w-full p-1 border border-slate-200 rounded text-xs"
                              />
                            </td>
                            <td className="py-2 px-3 w-20">
                              <input
                                type="text"
                                value={it.hsnSacCode || ''}
                                onChange={(e) => {
                                  const updated = [...formData.items];
                                  updated[idx].hsnSacCode = e.target.value;
                                  setFormData({ ...formData, items: updated });
                                }}
                                className="w-full p-1 border border-slate-200 rounded text-xs font-mono"
                              />
                            </td>
                            <td className="py-2 px-3 w-20 text-right">
                              <input
                                type="number"
                                value={it.quantity}
                                onChange={(e) => {
                                  const updated = [...formData.items];
                                  updated[idx].quantity = Number(e.target.value);
                                  setFormData({ ...formData, items: updated });
                                }}
                                className="w-full p-1 border border-slate-200 rounded text-xs text-right font-medium"
                              />
                            </td>
                            <td className="py-2 px-3 w-24 text-right">
                              <input
                                type="number"
                                value={it.unitRate}
                                onChange={(e) => {
                                  const updated = [...formData.items];
                                  updated[idx].unitRate = Number(e.target.value);
                                  setFormData({ ...formData, items: updated });
                                }}
                                className="w-full p-1 border border-slate-200 rounded text-xs text-right"
                              />
                            </td>
                            <td className="py-2 px-3 w-16 text-right">
                              <input
                                type="number"
                                value={it.discountPercent || 0}
                                onChange={(e) => {
                                  const updated = [...formData.items];
                                  updated[idx].discountPercent = Number(e.target.value);
                                  setFormData({ ...formData, items: updated });
                                }}
                                className="w-full p-1 border border-slate-200 rounded text-xs text-right"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-medium text-slate-800">
                              {formatInr(taxable)}
                            </td>
                            <td className="py-2 px-3 w-16 text-right">
                              <input
                                type="number"
                                value={it.gstRate || 18}
                                onChange={(e) => {
                                  const updated = [...formData.items];
                                  updated[idx].gstRate = Number(e.target.value);
                                  setFormData({ ...formData, items: updated });
                                }}
                                className="w-full p-1 border border-slate-200 rounded text-xs text-right"
                              />
                            </td>
                            <td className="py-2 px-3 text-right font-bold text-slate-900">
                              {formatInr(total)}
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    items: formData.items.filter((_, i) => i !== idx),
                                  });
                                }}
                                className="text-slate-400 hover:text-rose-600"
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

              {/* Commercial Summary Box */}
              <div className="flex flex-col sm:flex-row justify-end items-end gap-6 pt-3 border-t border-slate-200">
                <div className="w-full sm:w-80 space-y-1.5 text-xs text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div className="flex justify-between">
                    <span>Gross Subtotal:</span>
                    <span className="font-semibold text-slate-800">{formatInr(calculatedTotals.subtotal)}</span>
                  </div>
                  {calculatedTotals.totalDiscount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount:</span>
                      <span>-{formatInr(calculatedTotals.totalDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold">
                    <span>Taxable Value:</span>
                    <span>{formatInr(calculatedTotals.taxable)}</span>
                  </div>
                  {formData.supplyType === 'INTRA_STATE' ? (
                    <>
                      <div className="flex justify-between">
                        <span>CGST (9%):</span>
                        <span>{formatInr(calculatedTotals.cgst)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SGST (9%):</span>
                        <span>{formatInr(calculatedTotals.sgst)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between">
                      <span>IGST (18%):</span>
                      <span>{formatInr(calculatedTotals.igst)}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-1 border-t border-slate-200">
                    <span>Round Off:</span>
                    <span>{calculatedTotals.roundOff >= 0 ? `+${calculatedTotals.roundOff}` : calculatedTotals.roundOff}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-teal-800 pt-1.5 border-t border-slate-300">
                    <span>Total Invoice Value:</span>
                    <span>{formatInr(calculatedTotals.totalInvoice)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                * Click Submit to save as DRAFT. You can post and generate IRN after review.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreateModalOpen(false);
                    setIsEditModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-white text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={createMutation.isPending || updateMutation.isPending || formData.items.length === 0}
                  onClick={() => {
                    if (isEditModalOpen && selectedInvoiceId) {
                      updateMutation.mutate({ id: selectedInvoiceId, payload: formData });
                    } else {
                      createMutation.mutate(formData);
                    }
                  }}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-500/20 disabled:opacity-50"
                >
                  {isEditModalOpen ? 'Save Changes' : 'Generate Draft Invoice'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Post Invoice Modal */}
      {/* -------------------------------------------------------------------- */}
      {isPostModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-purple-100 text-purple-700">
                <Send className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Post & Finalize Invoice</h3>
                <p className="text-xs text-slate-500">{selectedInvoice.invoiceNo}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Posting this invoice will lock all commercial line items, post the receivable amount (
              <strong>{formatInr(Number(selectedInvoice.totalInvoiceAmount))}</strong>) to customer{' '}
              <strong>{selectedInvoice.customerName}</strong>, and update invoiced quantities on the Sales Order.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Audit Remarks (Optional)</label>
              <textarea
                rows={2}
                value={postRemarks}
                onChange={(e) => setPostRemarks(e.target.value)}
                placeholder="Manager commercial sign-off remarks..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPostModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={postMutation.isPending}
                onClick={() => postMutation.mutate({ id: selectedInvoice.invoiceId, remarks: postRemarks })}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-md shadow-purple-500/20 disabled:opacity-50"
              >
                Post Commercial Invoice
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Generate IRN E-Invoice Modal */}
      {/* -------------------------------------------------------------------- */}
      {isIrnModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-700">
                <QrCode className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Generate Statutory E-Invoice IRN</h3>
                <p className="text-xs text-slate-500">
                  Government IRP / NIC E-Invoice Simulation (GST Rule 48(4))
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Document No:</span>
                <span className="font-bold text-slate-800">{selectedInvoice.invoiceNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Customer GSTIN:</span>
                <span className="font-mono text-slate-800">{selectedInvoice.customerGstin || 'URP'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice Value:</span>
                <span className="font-bold text-teal-700">
                  {formatInr(Number(selectedInvoice.totalInvoiceAmount))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Vehicle / Transporter:</span>
                <span className="text-slate-800">
                  {selectedInvoice.vehicleNo || 'Not specified (E-Way auto-assigned)'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              This will cryptographically generate the 64-character SHA-256 Invoice Reference Number (IRN),
              statutory Acknowledgement Number, and standard digitally signed QR code containing key invoice metadata.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsIrnModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={generateIrnMutation.isPending}
                onClick={() => generateIrnMutation.mutate({ id: selectedInvoice.invoiceId })}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                Generate IRN & QR Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Record Payment Receipt Modal */}
      {/* -------------------------------------------------------------------- */}
      {isPaymentModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-blue-100 text-blue-700">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Customer Payment Receipt</h3>
                <p className="text-xs text-slate-500">
                  Post AR Collection against {selectedInvoice.invoiceNo}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between text-xs">
              <div>
                <span className="text-slate-500">Total Billed:</span>
                <div className="font-bold text-slate-800">{formatInr(Number(selectedInvoice.totalInvoiceAmount))}</div>
              </div>
              <div>
                <span className="text-slate-500">Already Received:</span>
                <div className="font-bold text-emerald-600">{formatInr(Number(selectedInvoice.paidAmount))}</div>
              </div>
              <div>
                <span className="text-slate-500">Current Balance Due:</span>
                <div className="font-bold text-rose-600">{formatInr(Number(selectedInvoice.balanceAmount))}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Payment Mode *</label>
                <select
                  value={paymentForm.paymentMode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value as any })}
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                >
                  <option value="NEFT_RTGS">NEFT / RTGS</option>
                  <option value="BANK_TRANSFER">Direct Bank Transfer (IMPS)</option>
                  <option value="UPI">UPI Payment</option>
                  <option value="CHEQUE">Cheque / Demand Draft</option>
                  <option value="CREDIT_ADJUSTMENT">On-Account Credit Adjustment</option>
                  <option value="CASH">Cash</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Bank Name</label>
                <input
                  type="text"
                  value={paymentForm.bankName}
                  onChange={(e) => setPaymentForm({ ...paymentForm, bankName: e.target.value })}
                  placeholder="e.g. HDFC Bank, ICICI Bank..."
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Receipt / Payment Amount (₹) *</label>
                <input
                  type="number"
                  value={paymentForm.paymentAmount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentAmount: Number(e.target.value) })}
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs font-bold text-blue-700 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">TDS Withheld by Customer (₹)</label>
                <input
                  type="number"
                  value={paymentForm.tdsAmount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, tdsAmount: Number(e.target.value) })}
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-semibold mb-1">Transaction Ref / UTR / Cheque No *</label>
                <input
                  type="text"
                  value={paymentForm.referenceNo}
                  onChange={(e) => setPaymentForm({ ...paymentForm, referenceNo: e.target.value })}
                  placeholder="e.g. UTR / NEFT reference number"
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs font-mono focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-semibold mb-1">Remarks</label>
                <textarea
                  rows={2}
                  value={paymentForm.remarks}
                  onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value })}
                  placeholder="Remarks for accounts receivable ledger..."
                  className="w-full p-2 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={recordPaymentMutation.isPending || paymentForm.paymentAmount <= 0}
                onClick={() =>
                  recordPaymentMutation.mutate({
                    id: selectedInvoice.invoiceId,
                    payload: paymentForm,
                  })
                }
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 disabled:opacity-50"
              >
                Post Payment Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Cancel Invoice Modal */}
      {/* -------------------------------------------------------------------- */}
      {isCancelModalOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-100 text-rose-700">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Cancel Tax Invoice</h3>
                <p className="text-xs text-slate-500">{selectedInvoice.invoiceNo}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to cancel this invoice? If already posted, invoiced quantities will be
              reinstated back onto the Sales Order items.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mandatory Cancellation Reason *
              </label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Specify regulatory or commercial reason for cancellation..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                disabled={cancelMutation.isPending || !cancelReason.trim()}
                onClick={() =>
                  cancelMutation.mutate({
                    id: selectedInvoice.invoiceId,
                    cancellationReason: cancelReason.trim(),
                  })
                }
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 disabled:opacity-50"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Delete Draft Modal */}
      {/* -------------------------------------------------------------------- */}
      {isDeleteModalOpen && selectedInvoice && (
        <ConfirmDeleteModal
          isOpen={isDeleteModalOpen}
          entityType="Sales Invoice"
          entityName={selectedInvoice.customerName}
          entityCode={selectedInvoice.invoiceNo}
          isDeleting={deleteMutation.isPending}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={() => deleteMutation.mutate(selectedInvoice.invoiceId)}
        />
      )}

      {/* -------------------------------------------------------------------- */}
      {/* Printable Statutory GST Rule 46 Tax Invoice Modal */}
      {/* -------------------------------------------------------------------- */}
      {isPrintModalOpen && activeInvoiceData && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-8">
            {/* Print Dialog Bar */}
            <div className="p-4 bg-slate-800 text-white flex items-center justify-between print:hidden">
              <span className="font-bold text-sm flex items-center gap-2">
                <Printer className="w-4 h-4 text-teal-400" />
                Statutory GST Tax Invoice Print Preview (Rule 46 & Rule 48(4))
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-600 text-white text-xs font-bold shadow-sm flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print / Save as PDF
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-slate-700 text-slate-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Body */}
            <div className="p-8 text-slate-900 bg-white font-sans text-xs space-y-5">
              {/* Document Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900">
                    KASHVIRA PRECISION MANUFACTURING PVT. LTD.
                  </h1>
                  <p className="text-[11px] text-slate-600 max-w-md mt-0.5">
                    Plot 42, GIDC Industrial Estate, Sanand, Ahmedabad, Gujarat - 382110
                  </p>
                  <div className="text-[11px] font-mono text-slate-700 mt-1 space-x-3">
                    <span>
                      <strong>GSTIN:</strong> 24AABCK1234F1Z5
                    </span>
                    <span>
                      <strong>PAN:</strong> AABCK1234F
                    </span>
                    <span>
                      <strong>State:</strong> Gujarat (Code: 24)
                    </span>
                  </div>
                </div>

                <div className="text-right flex flex-col items-end">
                  <span className="text-base font-black px-3 py-1 rounded bg-slate-900 text-white uppercase tracking-wider">
                    TAX INVOICE
                  </span>
                  <span className="text-[10px] text-slate-500 mt-1 italic">
                    (Original for Recipient / Rule 46 Compliant)
                  </span>
                  {activeInvoiceData.header.irnStatus === 'GENERATED' && (
                    <div className="mt-2 p-1 border border-slate-300 rounded bg-slate-50 flex items-center gap-2">
                      <QrCode className="w-12 h-12 text-slate-900" />
                      <div className="text-[9px] text-left font-mono">
                        <div>
                          <strong>ACK:</strong> {activeInvoiceData.header.ackNo}
                        </div>
                        <div>
                          <strong>DT:</strong> {formatDate(activeInvoiceData.header.ackDate)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Statutory IRN Hash display */}
              {activeInvoiceData.header.irnNo && (
                <div className="bg-slate-50 p-2 rounded border border-slate-200 text-[10px] font-mono break-all text-slate-800">
                  <strong className="text-slate-900">IRN: </strong>
                  {activeInvoiceData.header.irnNo}
                </div>
              )}

              {/* Two Column Grid: Invoice Meta & Buyer Details */}
              <div className="grid grid-cols-2 gap-4 border border-slate-300 rounded p-3 bg-slate-50/50">
                <div className="space-y-1">
                  <div>
                    <span className="text-slate-500">Invoice No:</span>{' '}
                    <strong className="text-slate-900 font-mono text-sm">{activeInvoiceData.header.invoiceNo}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Invoice Date:</span>{' '}
                    <strong>{formatDate(activeInvoiceData.header.invoiceDate)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Due Date:</span>{' '}
                    <strong>{formatDate(activeInvoiceData.header.dueDate)}</strong> ({activeInvoiceData.header.paymentTermsDays} Days)
                  </div>
                  {activeInvoiceData.header.eWayBillNo && (
                    <div>
                      <span className="text-slate-500">E-Way Bill No:</span>{' '}
                      <strong className="font-mono">{activeInvoiceData.header.eWayBillNo}</strong> (
                      {formatDate(activeInvoiceData.header.eWayBillDate)})
                    </div>
                  )}
                  {activeInvoiceData.header.vehicleNo && (
                    <div>
                      <span className="text-slate-500">Vehicle / Transporter:</span>{' '}
                      <strong>{activeInvoiceData.header.vehicleNo}</strong> ({activeInvoiceData.header.transporterName || 'Self'})
                    </div>
                  )}
                </div>

                <div className="space-y-1 border-l border-slate-200 pl-4">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Details of Receiver (Billed To):</span>
                  <div className="font-bold text-slate-900">{activeInvoiceData.header.customerName}</div>
                  <div className="text-[11px] text-slate-600">{activeInvoiceData.header.billingAddress}</div>
                  <div className="pt-1">
                    <span className="text-slate-500">GSTIN:</span>{' '}
                    <strong className="font-mono">{activeInvoiceData.header.customerGstin || 'Unregistered'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Place of Supply:</span>{' '}
                    <strong>{activeInvoiceData.header.placeOfSupply}</strong>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-300 rounded overflow-hidden">
                <table className="w-full text-left text-[11px]">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    <tr>
                      <th className="py-2 px-2 text-center w-8">#</th>
                      <th className="py-2 px-2">Description of Goods</th>
                      <th className="py-2 px-2 text-center w-16">HSN/SAC</th>
                      <th className="py-2 px-2 text-right w-16">Qty</th>
                      <th className="py-2 px-2 text-right w-20">Rate (₹)</th>
                      <th className="py-2 px-2 text-right w-24">Taxable (₹)</th>
                      <th className="py-2 px-2 text-right w-16">GST %</th>
                      <th className="py-2 px-2 text-right w-24">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {activeInvoiceData.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-2 text-center text-slate-400">{idx + 1}</td>
                        <td className="py-2 px-2">
                          <div className="font-bold text-slate-900">{it.itemName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{it.itemCode}</div>
                          {it.batchNo && (
                            <div className="text-[9px] text-slate-400">
                              Batch: {it.batchNo} | Heat: {it.heatNo || '-'}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center font-mono">{it.hsnSacCode || '-'}</td>
                        <td className="py-2 px-2 text-right font-medium">
                          {Number(it.quantity)} {it.uomCode || 'NOS'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">{formatInr(Number(it.unitRate))}</td>
                        <td className="py-2 px-2 text-right font-mono font-medium">
                          {formatInr(Number(it.taxableAmount))}
                        </td>
                        <td className="py-2 px-2 text-right font-mono">{it.gstRate}%</td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                          {formatInr(Number(it.totalItemAmount))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tax Breakup & Grand Totals */}
              <div className="grid grid-cols-2 gap-4 items-start">
                <div className="border border-slate-200 rounded p-3 text-[11px] space-y-2">
                  <span className="font-bold text-slate-800 block">Bank Remittance Details:</span>
                  <div className="text-slate-600 space-y-0.5">
                    <div>
                      <strong>Bank Name:</strong> HDFC Bank Ltd
                    </div>
                    <div>
                      <strong>Account Name:</strong> Kashvira Precision Manufacturing Pvt Ltd
                    </div>
                    <div>
                      <strong>Account No:</strong> 50200084920193
                    </div>
                    <div>
                      <strong>IFSC Code:</strong> HDFC0001042 (Sanand Branch)
                    </div>
                  </div>
                  <div className="pt-2 text-[10px] text-slate-400 border-t border-slate-100">
                    Reverse charge applicable: <strong>{activeInvoiceData.header.reverseChargeApplicable ? 'Yes' : 'No'}</strong>
                  </div>
                </div>

                <div className="border border-slate-300 rounded p-3 bg-slate-50 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Taxable Amount:</span>
                    <strong className="font-mono">{formatInr(Number(activeInvoiceData.header.taxableAmount))}</strong>
                  </div>
                  {activeInvoiceData.header.supplyType === 'INTRA_STATE' ? (
                    <>
                      <div className="flex justify-between text-slate-600">
                        <span>CGST (9%):</span>
                        <span className="font-mono">{formatInr(Number(activeInvoiceData.header.cgstAmount))}</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>SGST (9%):</span>
                        <span className="font-mono">{formatInr(Number(activeInvoiceData.header.sgstAmount))}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between text-slate-600">
                      <span>IGST (18%):</span>
                      <span className="font-mono">{formatInr(Number(activeInvoiceData.header.igstAmount))}</span>
                    </div>
                  )}
                  {Number(activeInvoiceData.header.roundOff) !== 0 && (
                    <div className="flex justify-between text-slate-500 text-[11px]">
                      <span>Round Off:</span>
                      <span className="font-mono">{activeInvoiceData.header.roundOff}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black border-t-2 border-slate-900 pt-1 text-slate-900">
                    <span>Grand Total:</span>
                    <span className="font-mono text-teal-800">
                      {formatInr(Number(activeInvoiceData.header.totalInvoiceAmount))}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-6 pt-10 text-center border-t border-slate-200">
                <div>
                  <div className="border-b border-slate-400 mb-1 w-3/4 mx-auto"></div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Prepared By</span>
                </div>
                <div>
                  <div className="border-b border-slate-400 mb-1 w-3/4 mx-auto"></div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">Checked By</span>
                </div>
                <div>
                  <div className="border-b border-slate-400 mb-1 w-3/4 mx-auto"></div>
                  <span className="text-[10px] uppercase font-bold text-slate-900">
                    For, Kashvira Precision Mfg Pvt Ltd
                  </span>
                  <div className="text-[9px] text-slate-400 mt-0.5">(Authorized Signatory)</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesInvoiceMasterPage;
