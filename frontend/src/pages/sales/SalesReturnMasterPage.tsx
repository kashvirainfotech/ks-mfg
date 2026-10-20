import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  Boxes,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
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
  RotateCcw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Trash2,
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
// Helper Formatters
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
// Types & Interfaces
// ----------------------------------------------------------------------------
interface SalesReturnItem {
  return_item_id: number;
  return_id: number;
  invoice_item_id?: number | null;
  item_sequence: number;
  item_id: number;
  item_code: string;
  item_name: string;
  description?: string | null;
  hsn_sac_code: string;
  uom_id: number;
  uom_code?: string;
  uom_name?: string;
  invoiced_qty: string | number;
  returned_qty: string | number;
  accepted_qty: string | number;
  rejected_scrap_qty: string | number;
  unit_price: string | number;
  discount_percent: string | number;
  discount_amount: string | number;
  taxable_amount: string | number;
  gst_rate: string | number;
  cgst_rate: string | number;
  cgst_amount: string | number;
  sgst_rate: string | number;
  sgst_amount: string | number;
  igst_rate: string | number;
  igst_amount: string | number;
  line_total: string | number;
  target_warehouse_id?: number | null;
  target_warehouse_name?: string | null;
  target_bin_id?: number | null;
  target_bin_code?: string | null;
  target_bin_name?: string | null;
  batch_no?: string | null;
  heat_no?: string | null;
  defect_type?: string | null;
  qc_verdict: 'PENDING' | 'ACCEPT_FOR_RESTOCK' | 'ACCEPT_FOR_REWORK' | 'REJECT_SCRAP';
  action_taken?: string | null;
  remarks?: string | null;
}

interface SalesReturnHeader {
  returnId: number;
  returnNo: string;
  returnDate: string;
  returnType: 'COMMERCIAL_RETURN' | 'QUALITY_REJECTION' | 'TRANSIT_DAMAGE' | 'WRONG_SHIPMENT' | 'WARRANTY_REPLACEMENT';
  creditNoteNo?: string | null;
  creditNoteDate?: string | null;
  invoiceId: number;
  invoiceNo: string;
  invoiceDate: string;
  customerId: number;
  customerName: string;
  customerGstin?: string | null;
  customerPan?: string | null;
  billingAddress: string;
  billingCity?: string | null;
  billingState?: string | null;
  billingPincode?: string | null;
  billingStateCode: string;
  placeOfSupply: string;
  posStateCode: string;
  rmaReferenceNo?: string | null;
  rmaReferenceDate?: string | null;
  gateEntryNo?: string | null;
  gateEntryDate?: string | null;
  vehicleNo?: string | null;
  transporterName?: string | null;
  lrNo?: string | null;
  lrDate?: string | null;
  currencyCode: string;
  exchangeRate: string | number;
  subtotalAmount: string | number;
  discountAmount: string | number;
  taxableAmount: string | number;
  cgstAmount: string | number;
  sgstAmount: string | number;
  igstAmount: string | number;
  roundOffAmount: string | number;
  totalCreditAmount: string | number;
  arAdjustedAmount: string | number;
  irnStatus: 'NOT_APPLICABLE' | 'PENDING' | 'GENERATED' | 'CANCELLED' | 'FAILED';
  irnNo?: string | null;
  ackNo?: string | null;
  ackDate?: string | null;
  signedQrCode?: string | null;
  returnReason: string;
  qcStatus: 'PENDING' | 'INSPECTED' | 'ACCEPTED' | 'REJECTED' | 'PARTIALLY_ACCEPTED';
  qcInspectedBy?: number | null;
  qcInspectedAt?: string | null;
  qcRemarks?: string | null;
  restockStatus: 'PENDING' | 'RESTOCKED' | 'SCRAPPED' | 'PARTIALLY_RESTOCKED';
  restockedBy?: number | null;
  restockedAt?: string | null;
  creditNoteStatus: 'DRAFT' | 'POSTED' | 'CANCELLED';
  creditPostedBy?: number | null;
  creditPostedAt?: string | null;
  status: 'DRAFT' | 'INSPECTED' | 'CREDITED' | 'RESTOCKED' | 'COMPLETED' | 'CANCELLED';
  remarks?: string | null;
  createdDate: string;
  items?: SalesReturnItem[];
}

interface ReturnSummaryKPI {
  total_returns: number;
  total_credit_value: number;
  pending_qc_count: number;
  pending_restock_count: number;
  credit_notes_posted: number;
  total_ar_adjusted: number;
  draft_count: number;
  completed_count: number;
}

export const SalesReturnMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [qcStatusFilter, setQcStatusFilter] = useState('ALL');
  const [restockStatusFilter, setRestockStatusFilter] = useState('ALL');
  const [creditStatusFilter, setCreditStatusFilter] = useState('ALL');
  const [customerFilter, setCustomerFilter] = useState('ALL');

  // Modals & Drawers
  const [selectedReturn, setSelectedReturn] = useState<SalesReturnHeader | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isInspectModalOpen, setIsInspectModalOpen] = useState(false);
  const [isPostCreditModalOpen, setIsPostCreditModalOpen] = useState(false);
  const [isIrnModalOpen, setIsIrnModalOpen] = useState(false);
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  // Form State for Create/Edit
  const [formHeader, setFormHeader] = useState({
    returnType: 'QUALITY_REJECTION' as SalesReturnHeader['returnType'],
    returnDate: new Date().toISOString().split('T')[0],
    invoiceId: 0,
    invoiceNo: '',
    invoiceDate: '',
    customerId: 0,
    customerName: '',
    customerGstin: '',
    customerPan: '',
    billingAddress: '',
    billingCity: '',
    billingState: '',
    billingPincode: '',
    billingStateCode: '24',
    placeOfSupply: 'Gujarat (24)',
    posStateCode: '24',
    rmaReferenceNo: '',
    rmaReferenceDate: '',
    gateEntryNo: '',
    gateEntryDate: '',
    vehicleNo: '',
    transporterName: '',
    lrNo: '',
    lrDate: '',
    returnReason: '',
    remarks: '',
  });

  const [formItems, setFormItems] = useState<
    {
      invoiceItemId?: number;
      itemId: number;
      itemCode: string;
      itemName: string;
      description?: string;
      hsnSacCode: string;
      uomId: number;
      uomCode?: string;
      invoicedQty: number;
      returnedQty: number;
      unitPrice: number;
      discountPercent: number;
      gstRate: number;
      targetWarehouseId?: number;
      targetBinId?: number;
      batchNo?: string;
      heatNo?: string;
      defectType?: string;
      remarks?: string;
    }[]
  >([]);

  // QC Inspection Form State
  const [inspectItems, setInspectItems] = useState<
    {
      returnItemId: number;
      itemCode: string;
      itemName: string;
      returnedQty: number;
      acceptedQty: number;
      rejectedScrapQty: number;
      qcVerdict: 'ACCEPT_FOR_RESTOCK' | 'ACCEPT_FOR_REWORK' | 'REJECT_SCRAP';
      targetWarehouseId?: number;
      targetBinId?: number;
      defectType: string;
      actionTaken: string;
      remarks: string;
    }[]
  >([]);
  const [qcOverallRemarks, setQcOverallRemarks] = useState('');

  // Post Credit Note Form State
  const [adjustArBalance, setAdjustArBalance] = useState(true);
  const [creditNoteRemarks, setCreditNoteRemarks] = useState('');

  // ----------------------------------------------------------------------------
  // Queries
  // ----------------------------------------------------------------------------
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery<ApiResponse<ReturnSummaryKPI>>({
    queryKey: ['sales-returns-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<ReturnSummaryKPI>>('/sales/returns/summary');
      return res.data;
    },
  });

  const { data: lookupsData } = useQuery<
    ApiResponse<{
      invoices: any[];
      customers: any[];
      warehouses: any[];
      bins: any[];
    }>
  >({
    queryKey: ['sales-returns-lookups'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<{
        invoices: any[];
        customers: any[];
        warehouses: any[];
        bins: any[];
      }>>('/sales/returns/lookups');
      return res.data;
    },
  });

  const { data: returnsData, isLoading: isTableLoading, refetch } = useQuery<
    ApiResponse<SalesReturnHeader[]>
  >({
    queryKey: ['sales-returns', statusFilter, qcStatusFilter, restockStatusFilter, creditStatusFilter, customerFilter],
    queryFn: async () => {
      const params: Record<string, any> = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (qcStatusFilter !== 'ALL') params.qcStatus = qcStatusFilter;
      if (restockStatusFilter !== 'ALL') params.restockStatus = restockStatusFilter;
      if (creditStatusFilter !== 'ALL') params.creditNoteStatus = creditStatusFilter;
      if (customerFilter !== 'ALL') params.customerId = customerFilter;
      const res = await apiClient.get<ApiResponse<SalesReturnHeader[]>>('/sales/returns', { params });
      return res.data;
    },
  });

  // Query single return details when drawer or modal opens
  const fetchReturnDetails = async (returnId: number): Promise<SalesReturnHeader> => {
    const res = await apiClient.get<ApiResponse<SalesReturnHeader>>(`/sales/returns/${returnId}`);
    return res.data.data;
  };

  // ----------------------------------------------------------------------------
  // Mutations
  // ----------------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: (payload: any) => apiClient.post('/sales/returns', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] });
      queryClient.invalidateQueries({ queryKey: ['sales-returns-summary'] });
      setIsCreateModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) => apiClient.put(`/sales/returns/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] });
      queryClient.invalidateQueries({ queryKey: ['sales-returns-summary'] });
      setIsEditModalOpen(false);
    },
  });

  const inspectMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      apiClient.post(`/sales/returns/${id}/inspect`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] });
      queryClient.invalidateQueries({ queryKey: ['sales-returns-summary'] });
      setIsInspectModalOpen(false);
    },
  });

  const postCreditMutation = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: any }) =>
      apiClient.post(`/sales/returns/${id}/post-credit-note`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] });
      queryClient.invalidateQueries({ queryKey: ['sales-returns-summary'] });
      setIsPostCreditModalOpen(false);
    },
  });

  const generateIrnMutation = useMutation({
    mutationFn: ({ id }: { id: number }) => apiClient.post(`/sales/returns/${id}/generate-irn`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] });
      queryClient.invalidateQueries({ queryKey: ['sales-returns-summary'] });
      setIsIrnModalOpen(false);
    },
  });

  const restockMutation = useMutation({
    mutationFn: ({ id }: { id: number }) => apiClient.post(`/sales/returns/${id}/restock`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] });
      queryClient.invalidateQueries({ queryKey: ['sales-returns-summary'] });
      setIsRestockModalOpen(false);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiClient.post(`/sales/returns/${id}/cancel`, { cancellationReason: reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] });
      queryClient.invalidateQueries({ queryKey: ['sales-returns-summary'] });
      setIsCancelModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiClient.delete(`/sales/returns/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-returns'] });
      queryClient.invalidateQueries({ queryKey: ['sales-returns-summary'] });
      setIsDeleteModalOpen(false);
    },
  });

  // ----------------------------------------------------------------------------
  // Handlers
  // ----------------------------------------------------------------------------
  const handleOpenDetail = async (row: SalesReturnHeader) => {
    const full = await fetchReturnDetails(row.returnId);
    setSelectedReturn(full);
    setIsDetailDrawerOpen(true);
  };

  const handleOpenPrint = async (row: SalesReturnHeader) => {
    const full = await fetchReturnDetails(row.returnId);
    setSelectedReturn(full);
    setIsPrintModalOpen(true);
  };

  const handleOpenInspect = async (row: SalesReturnHeader) => {
    const full = await fetchReturnDetails(row.returnId);
    setSelectedReturn(full);
    setInspectItems(
      (full.items || []).map((itm) => ({
        returnItemId: itm.return_item_id,
        itemCode: itm.item_code,
        itemName: itm.item_name,
        returnedQty: Number(itm.returned_qty),
        acceptedQty: Number(itm.accepted_qty) || Number(itm.returned_qty),
        rejectedScrapQty: Number(itm.rejected_scrap_qty) || 0,
        qcVerdict: ((itm.qc_verdict === 'PENDING' ? 'ACCEPT_FOR_RESTOCK' : itm.qc_verdict) || 'ACCEPT_FOR_RESTOCK') as
          | 'ACCEPT_FOR_RESTOCK'
          | 'ACCEPT_FOR_REWORK'
          | 'REJECT_SCRAP',
        targetWarehouseId: itm.target_warehouse_id || 1004,
        targetBinId: itm.target_bin_id || 1007,
        defectType: itm.defect_type || '',
        actionTaken: itm.action_taken || '',
        remarks: itm.remarks || '',
      })),
    );
    setQcOverallRemarks(full.qcRemarks || '');
    setIsInspectModalOpen(true);
  };

  const handleOpenPostCredit = async (row: SalesReturnHeader) => {
    const full = await fetchReturnDetails(row.returnId);
    setSelectedReturn(full);
    setAdjustArBalance(true);
    setCreditNoteRemarks(`Statutory GST Credit Note issued per Section 34 against invoice ${full.invoiceNo}`);
    setIsPostCreditModalOpen(true);
  };

  const handleOpenIrn = async (row: SalesReturnHeader) => {
    const full = await fetchReturnDetails(row.returnId);
    setSelectedReturn(full);
    setIsIrnModalOpen(true);
  };

  const handleOpenRestock = async (row: SalesReturnHeader) => {
    const full = await fetchReturnDetails(row.returnId);
    setSelectedReturn(full);
    setIsRestockModalOpen(true);
  };

  const handleOpenCancel = (row: SalesReturnHeader) => {
    setSelectedReturn(row);
    setCancellationReason('');
    setIsCancelModalOpen(true);
  };

  const handleOpenDelete = (row: SalesReturnHeader) => {
    setSelectedReturn(row);
    setIsDeleteModalOpen(true);
  };

  // 1-Click Invoice Loader for Create Modal
  const handleSelectInvoice = (invoiceId: number) => {
    const inv = lookupsData?.data?.invoices?.find((i) => i.invoice_id === invoiceId);
    if (!inv) return;

    setFormHeader((prev) => ({
      ...prev,
      invoiceId: inv.invoice_id,
      invoiceNo: inv.invoice_no,
      invoiceDate: inv.invoice_date,
      customerId: inv.customer_id,
      customerName: inv.customer_name,
      customerGstin: inv.customer_gstin || '',
      customerPan: inv.customer_pan || '',
      billingAddress: inv.billing_address || '',
      billingCity: inv.billing_city || '',
      billingState: inv.billing_state || '',
      billingPincode: inv.billing_pincode || '',
      billingStateCode: inv.billing_state_code || '24',
      placeOfSupply: inv.place_of_supply || 'Gujarat (24)',
      posStateCode: inv.pos_state_code || '24',
    }));

    if (inv.items && inv.items.length > 0) {
      setFormItems(
        inv.items.map((i: any) => ({
          invoiceItemId: i.invoice_item_id,
          itemId: i.item_id,
          itemCode: i.item_code,
          itemName: i.item_name,
          description: i.description || '',
          hsnSacCode: i.hsn_sac_code || '8481',
          uomId: i.uom_id,
          uomCode: i.uom_code,
          invoicedQty: Number(i.invoiced_qty),
          returnedQty: Number(i.invoiced_qty) >= 1 ? 1 : Number(i.invoiced_qty),
          unitPrice: Number(i.unit_price),
          discountPercent: Number(i.discount_percent || 0),
          gstRate: Number(i.gst_rate || 18),
          targetWarehouseId: i.warehouse_id || 1004,
          targetBinId: i.bin_id || 1007,
          batchNo: i.batch_no || '',
          heatNo: i.heat_no || '',
          defectType: 'QUALITY_NON_CONFORMANCE',
          remarks: `Return from Invoice ${inv.invoice_no}`,
        })),
      );
    }
  };

  const handleOpenCreate = () => {
    setFormHeader({
      returnType: 'QUALITY_REJECTION',
      returnDate: new Date().toISOString().split('T')[0],
      invoiceId: 0,
      invoiceNo: '',
      invoiceDate: '',
      customerId: 0,
      customerName: '',
      customerGstin: '',
      customerPan: '',
      billingAddress: '',
      billingCity: '',
      billingState: '',
      billingPincode: '',
      billingStateCode: '24',
      placeOfSupply: 'Gujarat (24)',
      posStateCode: '24',
      rmaReferenceNo: '',
      rmaReferenceDate: new Date().toISOString().split('T')[0],
      gateEntryNo: '',
      gateEntryDate: new Date().toISOString().split('T')[0],
      vehicleNo: '',
      transporterName: '',
      lrNo: '',
      lrDate: '',
      returnReason: '',
      remarks: '',
    });
    setFormItems([]);
    setIsCreateModalOpen(true);
  };

  // ----------------------------------------------------------------------------
  // Table Columns Definition
  // ----------------------------------------------------------------------------
  const columns: MasterTableColumn<SalesReturnHeader>[] = useMemo(
    () => [
      {
        key: 'returnNo',
        header: 'Return / RMA No',
        sortable: true,
        render: (row) => (
          <div>
            <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              {row.returnNo}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {formatDate(row.returnDate)} •{' '}
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {row.returnType.replace('_', ' ')}
              </span>
            </div>
          </div>
        ),
      },
      {
        key: 'customerName',
        header: 'Customer / Client',
        sortable: true,
        render: (row) => (
          <div>
            <div className="font-medium text-gray-900 dark:text-gray-100 line-clamp-1">
              {row.customerName}
            </div>
            <div className="text-xs text-gray-500 font-mono">
              {row.customerGstin || 'URP'} • {row.placeOfSupply}
            </div>
          </div>
        ),
      },
      {
        key: 'invoiceNo',
        header: 'Original Tax Invoice',
        sortable: true,
        render: (row) => (
          <div>
            <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
              {row.invoiceNo}
            </div>
            <div className="text-xs text-gray-500">
              Dated: {formatDate(row.invoiceDate)}
            </div>
          </div>
        ),
      },
      {
        key: 'rmaReferenceNo',
        header: 'RMA / Gate Inward',
        render: (row) => (
          <div className="text-xs">
            <div className="font-medium text-gray-800 dark:text-gray-200">
              {row.rmaReferenceNo || '-'}
            </div>
            <div className="text-gray-500">
              {row.gateEntryNo ? `Gate: ${row.gateEntryNo}` : row.vehicleNo ? `Veh: ${row.vehicleNo}` : '-'}
            </div>
          </div>
        ),
      },
      {
        key: 'totalCreditAmount',
        header: 'Credit Value',
        sortable: true,
        render: (row) => (
          <div className="text-right">
            <div className="font-semibold text-gray-900 dark:text-gray-100">
              {formatInr(Number(row.totalCreditAmount))}
            </div>
            {Number(row.arAdjustedAmount) > 0 ? (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 dark:text-emerald-400 px-1 rounded font-medium">
                <Check className="w-2.5 h-2.5" /> Adjusted {formatInr(Number(row.arAdjustedAmount))}
              </span>
            ) : (
              <span className="text-[10px] text-gray-400">Unadjusted</span>
            )}
          </div>
        ),
      },
      {
        key: 'qcStatus',
        header: 'QC Status',
        render: (row) => {
          const cfg = {
            PENDING: { label: 'PENDING', bg: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' },
            INSPECTED: { label: 'INSPECTED', bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
            ACCEPTED: { label: 'ACCEPTED', bg: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
            PARTIALLY_ACCEPTED: { label: 'PARTIAL', bg: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300' },
            REJECTED: { label: 'REJECTED', bg: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300' },
          }[row.qcStatus] || { label: row.qcStatus, bg: 'bg-gray-100 text-gray-800' };

          return (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${cfg.bg}`}>
              {cfg.label}
            </span>
          );
        },
      },
      {
        key: 'restockStatus',
        header: 'Restock WMS',
        render: (row) => {
          const isRestocked = row.restockStatus === 'RESTOCKED';
          return (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                isRestocked
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {isRestocked ? 'RESTOCKED' : 'PENDING'}
            </span>
          );
        },
      },
      {
        key: 'creditNoteStatus',
        header: 'GST Credit Note',
        render: (row) => (
          <div>
            {row.creditNoteNo ? (
              <div className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {row.creditNoteNo}
              </div>
            ) : (
              <span className="text-xs text-gray-400">Not Posted</span>
            )}
            {row.irnStatus === 'GENERATED' && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-700 dark:text-blue-400">
                <QrCode className="w-2.5 h-2.5" /> IRN Active
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        render: (row) => {
          const statusColors: Record<string, string> = {
            DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
            INSPECTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
            CREDITED: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
            RESTOCKED: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
            COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
            CANCELLED: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
          };
          return (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                statusColors[row.status] || 'bg-gray-100 text-gray-700'
              }`}
            >
              {row.status}
            </span>
          );
        },
      },
    ],
    [],
  );

  const searchPredicate = (row: SalesReturnHeader, query: string) => {
    const q = query.toLowerCase();
    return (
      row.returnNo?.toLowerCase().includes(q) ||
      row.creditNoteNo?.toLowerCase().includes(q) ||
      row.customerName?.toLowerCase().includes(q) ||
      row.invoiceNo?.toLowerCase().includes(q) ||
      row.rmaReferenceNo?.toLowerCase().includes(q) ||
      row.returnReason?.toLowerCase().includes(q)
    );
  };

  const kpis = summaryData?.data;

  // ----------------------------------------------------------------------------
  // Render Main Page
  // ----------------------------------------------------------------------------
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Sales Returns, RMA & Credit Notes
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              CGST Sec 34 / Rule 53
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Inward RMA quarantine inspection, statutory Section 34 GST credit notes, IRN E-invoicing, warehouse restocking, and customer AR reconciliation
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition"
            title="Refresh Table"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <PermissionGate screen="SALES_RETURN" action="ADD">
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              New Sales Return / RMA
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Total Returns</div>
            <div className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
              {kpis?.total_returns || 0}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Registered RMA cases</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
            <RotateCcw className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Credit Note Value</div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {formatInr(kpis?.total_credit_value || 0)}
            </div>
            <div className="text-[11px] text-gray-400 mt-0.5">Gross GST credits issued</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Pending RMA QC</div>
            <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {kpis?.pending_qc_count || 0}
            </div>
            <div className="text-[11px] text-amber-500 mt-0.5">Awaiting lab inspection</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">Pending Restock</div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">
              {kpis?.pending_restock_count || 0}
            </div>
            <div className="text-[11px] text-blue-500 mt-0.5">Approved for warehouse bins</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
            <ArrowDownToLine className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400">AR Adjusted</div>
            <div className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-0.5">
              {formatInr(kpis?.total_ar_adjusted || 0)}
            </div>
            <div className="text-[11px] text-purple-500 mt-0.5">Direct ledger reconciliation</div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Filters:</span>
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
        >
          <option value="ALL">All Return Statuses</option>
          <option value="DRAFT">DRAFT</option>
          <option value="INSPECTED">INSPECTED</option>
          <option value="CREDITED">CREDITED</option>
          <option value="RESTOCKED">RESTOCKED</option>
          <option value="COMPLETED">COMPLETED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>

        {/* QC Status Filter */}
        <select
          value={qcStatusFilter}
          onChange={(e) => setQcStatusFilter(e.target.value)}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
        >
          <option value="ALL">All QC Verdicts</option>
          <option value="PENDING">QC PENDING</option>
          <option value="ACCEPTED">ACCEPTED</option>
          <option value="PARTIALLY_ACCEPTED">PARTIALLY ACCEPTED</option>
          <option value="REJECTED">REJECTED</option>
        </select>

        {/* Restock Status Filter */}
        <select
          value={restockStatusFilter}
          onChange={(e) => setRestockStatusFilter(e.target.value)}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
        >
          <option value="ALL">All Restock States</option>
          <option value="PENDING">RESTOCK PENDING</option>
          <option value="RESTOCKED">RESTOCKED</option>
        </select>

        {/* Credit Note Filter */}
        <select
          value={creditStatusFilter}
          onChange={(e) => setCreditStatusFilter(e.target.value)}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
        >
          <option value="ALL">All Credit Notes</option>
          <option value="DRAFT">CREDIT DRAFT</option>
          <option value="POSTED">CREDIT POSTED</option>
        </select>

        {/* Customer Filter */}
        <select
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 max-w-xs"
        >
          <option value="ALL">All Customers</option>
          {lookupsData?.data?.customers?.map((c) => (
            <option key={c.party_id} value={c.party_id}>
              {c.party_name}
            </option>
          ))}
        </select>
      </div>

      {/* Master Data Table */}
      <MasterDataTable
        title="Sales Returns, RMA & Credit Notes"
        subtitle="Manage customer rejections, technical RMA quarantine inspections, statutory GST Section 34 credit notes, IRN e-invoicing, and WMS inventory restock"
        screenCode="SALES_RETURN"
        tableNameBadge="tbl_sales_return_header"
        data={
          Array.isArray(returnsData?.data)
            ? returnsData.data
            : Array.isArray((returnsData?.data as any)?.data)
            ? (returnsData?.data as any).data
            : []
        }
        columns={columns}
        rowKey={(row) => row.returnId}
        searchPredicate={searchPredicate}
        isLoading={isTableLoading}
        renderRowActions={(row) => (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleOpenDetail(row)}
              className="p-1.5 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              title="View Details"
            >
              <Eye className="w-4 h-4" />
            </button>

            {row.status === 'DRAFT' && (
              <PermissionGate screen="SALES_RETURN" action="EDIT">
                <button
                  onClick={async () => {
                    const full = await fetchReturnDetails(row.returnId);
                    setSelectedReturn(full);
                    setFormHeader({
                      returnType: full.returnType,
                      returnDate: full.returnDate,
                      invoiceId: full.invoiceId,
                      invoiceNo: full.invoiceNo,
                      invoiceDate: full.invoiceDate,
                      customerId: full.customerId,
                      customerName: full.customerName,
                      customerGstin: full.customerGstin || '',
                      customerPan: full.customerPan || '',
                      billingAddress: full.billingAddress,
                      billingCity: full.billingCity || '',
                      billingState: full.billingState || '',
                      billingPincode: full.billingPincode || '',
                      billingStateCode: full.billingStateCode,
                      placeOfSupply: full.placeOfSupply,
                      posStateCode: full.posStateCode,
                      rmaReferenceNo: full.rmaReferenceNo || '',
                      rmaReferenceDate: full.rmaReferenceDate || '',
                      gateEntryNo: full.gateEntryNo || '',
                      gateEntryDate: full.gateEntryDate || '',
                      vehicleNo: full.vehicleNo || '',
                      transporterName: full.transporterName || '',
                      lrNo: full.lrNo || '',
                      lrDate: full.lrDate || '',
                      returnReason: full.returnReason,
                      remarks: full.remarks || '',
                    });
                    setFormItems(
                      (full.items || []).map((i) => ({
                        invoiceItemId: i.invoice_item_id || undefined,
                        itemId: i.item_id,
                        itemCode: i.item_code,
                        itemName: i.item_name,
                        description: i.description || undefined,
                        hsnSacCode: i.hsn_sac_code,
                        uomId: i.uom_id,
                        uomCode: i.uom_code,
                        invoicedQty: Number(i.invoiced_qty),
                        returnedQty: Number(i.returned_qty),
                        unitPrice: Number(i.unit_price),
                        discountPercent: Number(i.discount_percent),
                        gstRate: Number(i.gst_rate),
                        targetWarehouseId: i.target_warehouse_id || undefined,
                        targetBinId: i.target_bin_id || undefined,
                        batchNo: i.batch_no || undefined,
                        heatNo: i.heat_no || undefined,
                        defectType: i.defect_type || undefined,
                        remarks: i.remarks || undefined,
                      })),
                    );
                    setIsEditModalOpen(true);
                  }}
                  className="p-1.5 text-gray-500 hover:text-amber-600 dark:hover:text-amber-400 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  title="Edit Draft"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {row.status !== 'CANCELLED' && row.qcStatus === 'PENDING' && (
              <PermissionGate screen="SALES_RETURN" action="INSPECT">
                <button
                  onClick={() => handleOpenInspect(row)}
                  className="p-1.5 text-amber-600 hover:text-amber-700 rounded hover:bg-amber-50 dark:hover:bg-amber-950/40 transition"
                  title="Inspect RMA Goods (QC)"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {row.status !== 'CANCELLED' && row.creditNoteStatus !== 'POSTED' && (
              <PermissionGate screen="SALES_RETURN" action="POST_CREDIT_NOTE">
                <button
                  onClick={() => handleOpenPostCredit(row)}
                  className="p-1.5 text-emerald-600 hover:text-emerald-700 rounded hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition"
                  title="Post Statutory Credit Note"
                >
                  <FileText className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {row.creditNoteStatus === 'POSTED' && row.irnStatus !== 'GENERATED' && (
              <PermissionGate screen="SALES_RETURN" action="POST_CREDIT_NOTE">
                <button
                  onClick={() => handleOpenIrn(row)}
                  className="p-1.5 text-blue-600 hover:text-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 transition"
                  title="Generate E-Invoice IRN"
                >
                  <QrCode className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {row.status !== 'CANCELLED' && row.qcStatus !== 'PENDING' && row.restockStatus !== 'RESTOCKED' && (
              <PermissionGate screen="SALES_RETURN" action="RESTOCK">
                <button
                  onClick={() => handleOpenRestock(row)}
                  className="p-1.5 text-teal-600 hover:text-teal-700 rounded hover:bg-teal-50 dark:hover:bg-teal-950/40 transition"
                  title="Restock Accepted Goods to Bins"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            <PermissionGate screen="SALES_RETURN" action="PRINT">
              <button
                onClick={() => handleOpenPrint(row)}
                className="p-1.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                title="Print Statutory Credit Note"
              >
                <Printer className="w-4 h-4" />
              </button>
            </PermissionGate>

            {row.status !== 'CANCELLED' && (
              <PermissionGate screen="SALES_RETURN" action="EDIT">
                <button
                  onClick={() => handleOpenCancel(row)}
                  className="p-1.5 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition"
                  title="Cancel Return"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}

            {row.status === 'DRAFT' && (
              <PermissionGate screen="SALES_RETURN" action="DELETE">
                <button
                  onClick={() => handleOpenDelete(row)}
                  className="p-1.5 text-gray-400 hover:text-rose-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                  title="Delete Draft"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </PermissionGate>
            )}
          </div>
        )}
      />

      {/* ========================================================================= */}
      {/* 1. SLIDEOUT DETAILS DRAWER                                                */}
      {/* ========================================================================= */}
      {isDetailDrawerOpen && selectedReturn && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white dark:bg-gray-900 w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-gray-200 dark:border-gray-800">
            {/* Drawer Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {selectedReturn.returnNo}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                    {selectedReturn.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Dated: {formatDate(selectedReturn.returnDate)} • Type: {selectedReturn.returnType.replace('_', ' ')}
                </div>
              </div>
              <button
                onClick={() => setIsDetailDrawerOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Customer & Billing Block */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Customer & Tax Information
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500">Customer:</span>
                    <div className="font-medium text-gray-900 dark:text-gray-100 mt-0.5">
                      {selectedReturn.customerName}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">GSTIN / Place of Supply:</span>
                    <div className="font-mono text-gray-800 dark:text-gray-200 mt-0.5">
                      {selectedReturn.customerGstin || 'URP'} ({selectedReturn.placeOfSupply})
                    </div>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Billing Address:</span>
                    <div className="text-gray-700 dark:text-gray-300 mt-0.5">
                      {selectedReturn.billingAddress}
                    </div>
                  </div>
                </div>
              </div>

              {/* Linked Invoice & Inward Transport Block */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-3">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Origin Invoice & Inward Logistics
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-gray-500">Tax Invoice:</span>
                    <div className="font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                      {selectedReturn.invoiceNo}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {formatDate(selectedReturn.invoiceDate)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">RMA Ref:</span>
                    <div className="font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                      {selectedReturn.rmaReferenceNo || '-'}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {formatDate(selectedReturn.rmaReferenceDate)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Gate Inward:</span>
                    <div className="font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                      {selectedReturn.gateEntryNo || '-'}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {formatDate(selectedReturn.gateEntryDate)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-500">Vehicle / Transporter:</span>
                    <div className="font-medium text-gray-800 dark:text-gray-200 mt-0.5">
                      {selectedReturn.vehicleNo || '-'}
                    </div>
                    <div className="text-[11px] text-gray-400">
                      {selectedReturn.transporterName || '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Quality & Restock Status Overview */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    QC Inspection Verdict
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {selectedReturn.qcStatus}
                    </span>
                    {selectedReturn.qcInspectedAt && (
                      <span className="text-[11px] text-gray-400">
                        on {formatDate(selectedReturn.qcInspectedAt)}
                      </span>
                    )}
                  </div>
                  {selectedReturn.qcRemarks && (
                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 italic">
                      "{selectedReturn.qcRemarks}"
                    </p>
                  )}
                </div>

                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Warehouse Restock Status
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                      {selectedReturn.restockStatus}
                    </span>
                    {selectedReturn.restockedAt && (
                      <span className="text-[11px] text-gray-400">
                        on {formatDate(selectedReturn.restockedAt)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {selectedReturn.restockStatus === 'RESTOCKED'
                      ? 'Accepted quantities restored to storage bin balances'
                      : 'Pending storage put-away'}
                  </div>
                </div>
              </div>

              {/* Statutory Credit Note & E-Invoicing Block */}
              {selectedReturn.creditNoteNo && (
                <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4" />
                      Statutory GST Credit Note (Rule 53)
                    </div>
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                      {selectedReturn.creditNoteNo}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <div>Issued Date: {formatDate(selectedReturn.creditNoteDate)}</div>
                    <div>Credit Total: {formatInr(Number(selectedReturn.totalCreditAmount))}</div>
                    <div className="col-span-2">
                      AR Ledger Status:{' '}
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        Adjusted {formatInr(Number(selectedReturn.arAdjustedAmount))} directly against Invoice {selectedReturn.invoiceNo}
                      </span>
                    </div>
                  </div>

                  {selectedReturn.irnStatus === 'GENERATED' && (
                    <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-800 text-xs">
                      <div className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-1">
                        <QrCode className="w-3.5 h-3.5 text-blue-600" />
                        E-Invoice IRN (Rule 48(4)):
                      </div>
                      <div className="font-mono text-[11px] text-gray-500 break-all mt-0.5">
                        {selectedReturn.irnNo}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        Ack No: {selectedReturn.ackNo} • Ack Date: {formatDateTime(selectedReturn.ackDate)}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Returned Items Table */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                  Returned Items & Disposition ({selectedReturn.items?.length || 0})
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="py-2 px-3">Item Details</th>
                        <th className="py-2 px-3 text-right">Ret Qty</th>
                        <th className="py-2 px-3 text-right">QC Accepted</th>
                        <th className="py-2 px-3 text-right">QC Scrapped</th>
                        <th className="py-2 px-3 text-right">Credit Val</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {(selectedReturn.items || []).map((itm, idx) => (
                        <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                          <td className="py-2 px-3">
                            <div className="font-semibold text-gray-900 dark:text-gray-100">
                              {itm.item_code}
                            </div>
                            <div className="text-gray-500">{itm.item_name}</div>
                            <div className="text-[11px] text-gray-400">
                              HSN: {itm.hsn_sac_code} • Verdict: {itm.qc_verdict}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right font-medium">
                            {itm.returned_qty} {itm.uom_code || 'NOS'}
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-emerald-600">
                            {itm.accepted_qty}
                          </td>
                          <td className="py-2 px-3 text-right font-medium text-rose-600">
                            {itm.rejected_scrap_qty}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                            {formatInr(Number(itm.line_total))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-2 bg-gray-50 dark:bg-gray-800/50">
              <button
                onClick={() => handleOpenPrint(selectedReturn)}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Credit Note
              </button>
              <button
                onClick={() => setIsDetailDrawerOpen(false)}
                className="px-4 py-1.5 bg-gray-800 hover:bg-gray-900 text-white text-xs font-medium rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CREATE / EDIT SALES RETURN MODAL                                       */}
      {/* ========================================================================= */}
      {(isCreateModalOpen || isEditModalOpen) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-4xl shadow-2xl border border-gray-200 dark:border-gray-800 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {isEditModalOpen ? `Edit Sales Return (${selectedReturn?.returnNo})` : 'New Sales Return & RMA'}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Record inward material return, reference original tax invoice, and stage in RMA quarantine
                </p>
              </div>
              <button
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* 1-Click Invoice Picker */}
              {!isEditModalOpen && (
                <div className="bg-indigo-50/60 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800/50 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900 dark:text-indigo-300">
                    <Receipt className="w-4 h-4 text-indigo-600" />
                    1-Click Load from Posted Tax Invoice:
                  </div>
                  <select
                    value={formHeader.invoiceId || ''}
                    onChange={(e) => handleSelectInvoice(Number(e.target.value))}
                    className="w-full text-xs border border-indigo-300 dark:border-indigo-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 font-medium"
                  >
                    <option value="">-- Choose Posted Invoice to Return Items Against --</option>
                    {lookupsData?.data?.invoices?.map((inv) => (
                      <option key={inv.invoice_id} value={inv.invoice_id}>
                        {inv.invoice_no} ({formatDate(inv.invoice_date)}) — {inv.customer_name} (Total: {formatInr(Number(inv.total_invoice_amount))})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Form Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Return Type *
                  </label>
                  <select
                    value={formHeader.returnType}
                    onChange={(e) =>
                      setFormHeader((p) => ({
                        ...p,
                        returnType: e.target.value as SalesReturnHeader['returnType'],
                      }))
                    }
                    className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  >
                    <option value="QUALITY_REJECTION">QUALITY REJECTION</option>
                    <option value="TRANSIT_DAMAGE">TRANSIT DAMAGE</option>
                    <option value="COMMERCIAL_RETURN">COMMERCIAL RETURN</option>
                    <option value="WRONG_SHIPMENT">WRONG SHIPMENT</option>
                    <option value="WARRANTY_REPLACEMENT">WARRANTY REPLACEMENT</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Return Date *
                  </label>
                  <input
                    type="date"
                    value={formHeader.returnDate}
                    onChange={(e) => setFormHeader((p) => ({ ...p, returnDate: e.target.value }))}
                    className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    disabled
                    value={formHeader.customerName}
                    placeholder="Selected from invoice"
                    className="w-full text-xs border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Customer RMA Reference No
                  </label>
                  <input
                    type="text"
                    value={formHeader.rmaReferenceNo}
                    onChange={(e) => setFormHeader((p) => ({ ...p, rmaReferenceNo: e.target.value }))}
                    placeholder="e.g. LT-RMA-2627-04"
                    className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Gate Inward Entry No
                  </label>
                  <input
                    type="text"
                    value={formHeader.gateEntryNo}
                    onChange={(e) => setFormHeader((p) => ({ ...p, gateEntryNo: e.target.value }))}
                    placeholder="e.g. GE-IN-2627-088"
                    className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Vehicle Registration No
                  </label>
                  <input
                    type="text"
                    value={formHeader.vehicleNo}
                    onChange={(e) => setFormHeader((p) => ({ ...p, vehicleNo: e.target.value }))}
                    placeholder="e.g. GJ-05-BT-4412"
                    className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Detailed Reason for Return *
                  </label>
                  <textarea
                    rows={2}
                    value={formHeader.returnReason}
                    onChange={(e) => setFormHeader((p) => ({ ...p, returnReason: e.target.value }))}
                    placeholder="Specify customer complaint, rejection report details, defect observed, or non-conformance..."
                    className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                  />
                </div>
              </div>

              {/* Line Items Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                    Return Line Items Schedule ({formItems.length})
                  </div>
                </div>

                {formItems.length === 0 ? (
                  <div className="p-8 text-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-gray-400 text-xs">
                    Please select a posted invoice above to automatically load eligible invoiced items.
                  </div>
                ) : (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                        <tr>
                          <th className="py-2 px-3">Item</th>
                          <th className="py-2 px-3 text-right">Invoiced Qty</th>
                          <th className="py-2 px-3 text-right">Return Qty *</th>
                          <th className="py-2 px-3 text-right">Unit Rate</th>
                          <th className="py-2 px-3 text-right">GST %</th>
                          <th className="py-2 px-3 text-right">Credit Value</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {formItems.map((itm, idx) => {
                          const lineVal = (itm.returnedQty * itm.unitPrice * (1 + itm.gstRate / 100)).toFixed(2);
                          return (
                            <tr key={idx}>
                              <td className="py-2 px-3">
                                <div className="font-semibold text-gray-900 dark:text-gray-100">{itm.itemCode}</div>
                                <div className="text-gray-500">{itm.itemName}</div>
                              </td>
                              <td className="py-2 px-3 text-right text-gray-500">
                                {itm.invoicedQty}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <input
                                  type="number"
                                  min="0.001"
                                  max={itm.invoicedQty}
                                  step="0.001"
                                  value={itm.returnedQty}
                                  onChange={(e) => {
                                    const val = Number(e.target.value) || 0;
                                    setFormItems((prev) =>
                                      prev.map((p, i) => (i === idx ? { ...p, returnedQty: val } : p)),
                                    );
                                  }}
                                  className="w-20 text-xs text-right border border-gray-300 dark:border-gray-600 rounded px-2 py-1 font-semibold"
                                />
                              </td>
                              <td className="py-2 px-3 text-right font-medium">
                                {formatInr(itm.unitPrice)}
                              </td>
                              <td className="py-2 px-3 text-right text-gray-500">
                                {itm.gstRate}%
                              </td>
                              <td className="py-2 px-3 text-right font-semibold text-emerald-600">
                                {formatInr(Number(lineVal))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreateModalOpen(false);
                  setIsEditModalOpen(false);
                }}
                className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={formItems.length === 0 || !formHeader.returnReason}
                onClick={() => {
                  const payload = {
                    ...formHeader,
                    items: formItems,
                  };
                  if (isEditModalOpen && selectedReturn) {
                    updateMutation.mutate({ id: selectedReturn.returnId, payload });
                  } else {
                    createMutation.mutate(payload);
                  }
                }}
                className="px-5 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm disabled:opacity-50 transition"
              >
                {isEditModalOpen ? 'Save Changes' : 'Create Sales Return'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. QC INSPECTION RMA MODAL                                                */}
      {/* ========================================================================= */}
      {isInspectModalOpen && selectedReturn && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-3xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-amber-600" />
                  RMA Quarantine QC Inspection ({selectedReturn.returnNo})
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Inspect returned physical goods, separate restockable vs scrap quantities, and assign target warehouse bins
                </p>
              </div>
              <button
                onClick={() => setIsInspectModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                    <tr>
                      <th className="py-2.5 px-3">Item Details</th>
                      <th className="py-2.5 px-3 text-right">Ret Qty</th>
                      <th className="py-2.5 px-3 text-right">Accepted Qty</th>
                      <th className="py-2.5 px-3 text-right">Scrap Qty</th>
                      <th className="py-2.5 px-3">Verdict</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {inspectItems.map((itm, idx) => (
                      <tr key={itm.returnItemId}>
                        <td className="py-3 px-3">
                          <div className="font-semibold text-gray-900 dark:text-gray-100">{itm.itemCode}</div>
                          <div className="text-gray-500 text-[11px]">{itm.itemName}</div>
                        </td>
                        <td className="py-3 px-3 text-right font-medium">
                          {itm.returnedQty}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            max={itm.returnedQty}
                            step="0.001"
                            value={itm.acceptedQty}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setInspectItems((prev) =>
                                prev.map((p, i) =>
                                  i === idx ? { ...p, acceptedQty: val, rejectedScrapQty: Math.max(0, p.returnedQty - val) } : p,
                                ),
                              );
                            }}
                            className="w-20 text-xs text-right border border-emerald-300 dark:border-emerald-700 rounded px-2 py-1 font-semibold text-emerald-700"
                          />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            max={itm.returnedQty}
                            step="0.001"
                            value={itm.rejectedScrapQty}
                            onChange={(e) => {
                              const val = Number(e.target.value) || 0;
                              setInspectItems((prev) =>
                                prev.map((p, i) =>
                                  i === idx ? { ...p, rejectedScrapQty: val, acceptedQty: Math.max(0, p.returnedQty - val) } : p,
                                ),
                              );
                            }}
                            className="w-20 text-xs text-right border border-rose-300 dark:border-rose-700 rounded px-2 py-1 font-semibold text-rose-700"
                          />
                        </td>
                        <td className="py-3 px-3">
                          <select
                            value={itm.qcVerdict}
                            onChange={(e) => {
                              const v = e.target.value as any;
                              setInspectItems((prev) =>
                                prev.map((p, i) => (i === idx ? { ...p, qcVerdict: v } : p)),
                              );
                            }}
                            className="text-[11px] border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800"
                          >
                            <option value="ACCEPT_FOR_RESTOCK">RESTOCK</option>
                            <option value="ACCEPT_FOR_REWORK">REWORK</option>
                            <option value="REJECT_SCRAP">SCRAP</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Overall QC Inspection Remarks *
                </label>
                <textarea
                  rows={3}
                  value={qcOverallRemarks}
                  onChange={(e) => setQcOverallRemarks(e.target.value)}
                  placeholder="Record laboratory metallurgical tests, visual surface checks, dimensions, and restock clearance remarks..."
                  className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsInspectModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  inspectMutation.mutate({
                    id: selectedReturn.returnId,
                    payload: { qcRemarks: qcOverallRemarks, items: inspectItems },
                  })
                }
                className="px-5 py-2 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg shadow-sm transition"
              >
                Confirm QC Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. POST STATUTORY CREDIT NOTE MODAL                                       */}
      {/* ========================================================================= */}
      {isPostCreditModalOpen && selectedReturn && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col p-6 space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-600" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Post Statutory GST Credit Note
              </h2>
            </div>
            <p className="text-xs text-gray-500">
              Issues an official sequential GST Credit Note (Rule 53) per Section 34 of the CGST Act, 2017 against Tax Invoice <strong>{selectedReturn.invoiceNo}</strong>.
            </p>

            <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-xl border border-gray-200 dark:border-gray-700 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Taxable Value:</span>
                <span className="font-semibold">{formatInr(Number(selectedReturn.taxableAmount))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">CGST + SGST (Intra) / IGST (Inter):</span>
                <span className="font-semibold">
                  {formatInr(Number(selectedReturn.cgstAmount) + Number(selectedReturn.sgstAmount) + Number(selectedReturn.igstAmount))}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700 text-sm font-bold text-emerald-700 dark:text-emerald-400">
                <span>Total Credit Note Amount:</span>
                <span>{formatInr(Number(selectedReturn.totalCreditAmount))}</span>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-emerald-50 dark:bg-emerald-950/30 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800/50">
              <input
                type="checkbox"
                id="adjustAr"
                checked={adjustArBalance}
                onChange={(e) => setAdjustArBalance(e.target.checked)}
                className="mt-0.5 rounded text-emerald-600"
              />
              <label htmlFor="adjustAr" className="text-xs text-emerald-900 dark:text-emerald-300 font-medium cursor-pointer">
                Deduct directly from customer's outstanding balance on Invoice {selectedReturn.invoiceNo} and log Accounts Receivable credit adjustment receipt.
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Commercial Posting Remarks
              </label>
              <textarea
                rows={2}
                value={creditNoteRemarks}
                onChange={(e) => setCreditNoteRemarks(e.target.value)}
                className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsPostCreditModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  postCreditMutation.mutate({
                    id: selectedReturn.returnId,
                    payload: { adjustArBalance, remarks: creditNoteRemarks },
                  })
                }
                className="px-5 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition"
              >
                Issue Credit Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. GENERATE E-INVOICE IRN MODAL                                           */}
      {/* ========================================================================= */}
      {isIrnModalOpen && selectedReturn && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Generate Credit Note IRN
              </h2>
            </div>
            <p className="text-xs text-gray-500">
              Generates mandatory 64-character SHA-256 Invoice Reference Number (IRN) and digitally signed QR code per Rule 48(4) for Credit Note <strong>{selectedReturn.creditNoteNo}</strong>.
            </p>

            <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-200 dark:border-blue-800/50 space-y-1.5 text-xs text-blue-900 dark:text-blue-300">
              <div>• Document Type: <strong>CRN (Credit Note)</strong></div>
              <div>• Credit Note No: <strong>{selectedReturn.creditNoteNo}</strong></div>
              <div>• Buyer GSTIN: <strong>{selectedReturn.customerGstin || 'URP'}</strong></div>
              <div>• Credit Value: <strong>{formatInr(Number(selectedReturn.totalCreditAmount))}</strong></div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsIrnModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => generateIrnMutation.mutate({ id: selectedReturn.returnId })}
                className="px-5 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition"
              >
                Generate IRN & Signed QR
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. RESTOCK INVENTORY MODAL                                                */}
      {/* ========================================================================= */}
      {isRestockModalOpen && selectedReturn && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <div className="flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5 text-teal-600" />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Restock Accepted Goods
              </h2>
            </div>
            <p className="text-xs text-gray-500">
              Restores QC accepted returned units back into warehouse storage bin balances and registers an immutable <strong>SALES_RETURN</strong> inward entry in the stock ledger.
            </p>

            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700 space-y-1 text-xs">
              {(selectedReturn.items || [])
                .filter((i) => Number(i.accepted_qty) > 0)
                .map((i, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{i.item_code}:</span>
                    <span className="font-semibold text-teal-700 dark:text-teal-400">
                      +{i.accepted_qty} {i.uom_code || 'NOS'} into Bin
                    </span>
                  </div>
                ))}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRestockModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => restockMutation.mutate({ id: selectedReturn.returnId })}
                className="px-5 py-2 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm transition"
              >
                Execute Warehouse Restock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. PRINTABLE STATUTORY GST CREDIT NOTE (RULE 53 / SEC 34)                 */}
      {/* ========================================================================= */}
      {isPrintModalOpen && selectedReturn && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white text-gray-900 rounded-2xl w-full max-w-4xl shadow-2xl border border-gray-300 flex flex-col max-h-[92vh]">
            {/* Print Dialog Actions Bar */}
            <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-gray-700" />
                <span className="font-bold text-gray-800 text-sm">
                  Statutory GST Credit Note Preview (Rule 53)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                >
                  <Printer className="w-4 h-4" />
                  Print Credit Note
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-200 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Document Body (Printable Paper Sheet) */}
            <div className="p-8 overflow-y-auto space-y-6 text-xs font-sans print:p-0 print:m-0">
              {/* Header: Title & Compliance Tag */}
              <div className="text-center border-b-2 border-gray-800 pb-3">
                <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">
                  FORM GST DRC-07 / STATUTORY TAX ADJUSTMENT
                </div>
                <h1 className="text-2xl font-black tracking-wider text-gray-950 uppercase mt-0.5">
                  GST CREDIT NOTE
                </h1>
                <div className="text-[11px] text-gray-600">
                  (Issued under Section 34 of the CGST Act, 2017 & Rule 53 of the CGST Rules, 2017)
                </div>
              </div>

              {/* Company & E-Invoice Compliance Header */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-300">
                <div>
                  <div className="text-base font-black text-gray-950">
                    KASHVIRA MANUFACTURING LIMITED
                  </div>
                  <div className="text-gray-600 text-[11px] mt-0.5">
                    Plot No. 42-45, Phase-II, GIDC Industrial Estate, Vatva
                  </div>
                  <div className="text-gray-600 text-[11px]">
                    Ahmedabad, Gujarat - 382445, India
                  </div>
                  <div className="mt-1 font-mono font-semibold text-gray-800">
                    GSTIN: 24AAACK1234C1Z5 • CIN: L28100GJ2015PLC084122
                  </div>
                  <div className="text-gray-600 text-[11px]">
                    State: Gujarat (Code 24) • PAN: AAACK1234C
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="text-xs">
                    <span className="text-gray-500">Credit Note No: </span>
                    <span className="font-bold font-mono text-sm text-gray-950">
                      {selectedReturn.creditNoteNo || 'DRAFT-CN'}
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-500">Credit Note Date: </span>
                    <span className="font-semibold text-gray-900">
                      {formatDate(selectedReturn.creditNoteDate || selectedReturn.returnDate)}
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-500">Original Invoice No: </span>
                    <span className="font-bold text-gray-950">
                      {selectedReturn.invoiceNo}
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-500">Original Invoice Date: </span>
                    <span className="font-semibold text-gray-900">
                      {formatDate(selectedReturn.invoiceDate)}
                    </span>
                  </div>
                  <div className="text-xs">
                    <span className="text-gray-500">RMA Ref / Date: </span>
                    <span className="font-mono text-gray-800">
                      {selectedReturn.rmaReferenceNo || 'N/A'} ({formatDate(selectedReturn.rmaReferenceDate)})
                    </span>
                  </div>
                </div>
              </div>

              {/* IRN Bar if Generated */}
              {selectedReturn.irnStatus === 'GENERATED' && (
                <div className="bg-gray-50 p-2.5 rounded border border-gray-300 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="font-mono text-[10px] font-bold text-gray-700">
                      IRN: {selectedReturn.irnNo}
                    </div>
                    <div className="text-[10px] text-gray-500">
                      Ack No: {selectedReturn.ackNo} • Ack Date: {formatDateTime(selectedReturn.ackDate)}
                    </div>
                  </div>
                  <div className="font-mono text-[10px] font-bold bg-white px-2 py-1 border border-gray-300 rounded">
                    E-INVOICE VERIFIED
                  </div>
                </div>
              )}

              {/* Buyer & Consignee Information */}
              <div className="grid grid-cols-2 gap-4 pb-4 border-b border-gray-300">
                <div className="bg-gray-50 p-3 rounded border border-gray-200">
                  <div className="font-bold text-gray-900 uppercase text-[11px] mb-1">
                    Customer / Recipient (Bill To):
                  </div>
                  <div className="font-bold text-gray-950 text-xs">{selectedReturn.customerName}</div>
                  <div className="text-gray-600 text-[11px] mt-0.5">{selectedReturn.billingAddress}</div>
                  <div className="mt-1 font-mono font-semibold text-gray-800">
                    GSTIN: {selectedReturn.customerGstin || 'URP'} • PAN: {selectedReturn.customerPan || 'N/A'}
                  </div>
                  <div className="text-gray-600 text-[11px]">
                    Place of Supply: {selectedReturn.placeOfSupply} (Code {selectedReturn.posStateCode})
                  </div>
                </div>

                <div className="bg-gray-50 p-3 rounded border border-gray-200">
                  <div className="font-bold text-gray-900 uppercase text-[11px] mb-1">
                    Return Inward Logistics Details:
                  </div>
                  <div className="text-[11px] space-y-0.5 text-gray-700">
                    <div>Vehicle No: <strong>{selectedReturn.vehicleNo || 'Direct Hand Delivery'}</strong></div>
                    <div>Transporter: <strong>{selectedReturn.transporterName || 'Self / Direct'}</strong></div>
                    <div>Gate Entry: <strong>{selectedReturn.gateEntryNo || 'Recorded'}</strong> ({formatDate(selectedReturn.gateEntryDate)})</div>
                    <div>Reason: <strong>{selectedReturn.returnReason}</strong></div>
                  </div>
                </div>
              </div>

              {/* Goods Schedule Table */}
              <div className="space-y-1">
                <div className="font-bold text-gray-900 uppercase text-[11px]">
                  Schedule of Goods Credited (Reversal per Section 34):
                </div>
                <table className="w-full text-xs text-left border border-gray-300">
                  <thead className="bg-gray-100 text-gray-800 font-semibold border-b border-gray-300">
                    <tr>
                      <th className="py-2 px-2 border-r border-gray-300 text-center w-8">#</th>
                      <th className="py-2 px-2 border-r border-gray-300">Description of Goods</th>
                      <th className="py-2 px-2 border-r border-gray-300 text-center">HSN/SAC</th>
                      <th className="py-2 px-2 border-r border-gray-300 text-right">Ret Qty</th>
                      <th className="py-2 px-2 border-r border-gray-300 text-right">Unit Rate</th>
                      <th className="py-2 px-2 border-r border-gray-300 text-right">Taxable Val</th>
                      <th className="py-2 px-2 border-r border-gray-300 text-center">GST %</th>
                      <th className="py-2 px-2 text-right">Credit Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(selectedReturn.items || []).map((itm, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-2 border-r border-gray-200 text-center">{idx + 1}</td>
                        <td className="py-2 px-2 border-r border-gray-200">
                          <div className="font-bold text-gray-900">{itm.item_code}</div>
                          <div className="text-[11px] text-gray-600">{itm.item_name}</div>
                          {itm.batch_no && (
                            <div className="text-[10px] text-gray-500 font-mono">
                              Batch: {itm.batch_no} {itm.heat_no ? `• Heat: ${itm.heat_no}` : ''}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 border-r border-gray-200 text-center font-mono">
                          {itm.hsn_sac_code}
                        </td>
                        <td className="py-2 px-2 border-r border-gray-200 text-right font-semibold">
                          {itm.returned_qty} {itm.uom_code || 'NOS'}
                        </td>
                        <td className="py-2 px-2 border-r border-gray-200 text-right font-mono">
                          {formatInr(Number(itm.unit_price))}
                        </td>
                        <td className="py-2 px-2 border-r border-gray-200 text-right font-mono font-semibold">
                          {formatInr(Number(itm.taxable_amount))}
                        </td>
                        <td className="py-2 px-2 border-r border-gray-200 text-center">
                          {itm.gst_rate}%
                        </td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-gray-950">
                          {formatInr(Number(itm.line_total))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tax Breakup & Grand Total */}
              <div className="grid grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                  <div className="bg-gray-50 p-2.5 rounded border border-gray-300 text-[11px] space-y-1">
                    <div className="font-bold text-gray-800 uppercase">Statutory Declarations:</div>
                    <div>1. We hereby certify that the tax shown on this Credit Note has been credited to the recipient and our outward tax liability will be adjusted per Section 34(2).</div>
                    <div>2. Tax is NOT payable on Reverse Charge basis.</div>
                    <div>3. E. & O.E. Subject to Ahmedabad, Gujarat jurisdiction.</div>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span className="text-gray-600">Subtotal Taxable Amount:</span>
                    <span className="font-mono font-semibold">{formatInr(Number(selectedReturn.taxableAmount))}</span>
                  </div>
                  {Number(selectedReturn.cgstAmount) > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-200">
                      <span className="text-gray-600">Central Tax (CGST 9%):</span>
                      <span className="font-mono font-semibold">{formatInr(Number(selectedReturn.cgstAmount))}</span>
                    </div>
                  )}
                  {Number(selectedReturn.sgstAmount) > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-200">
                      <span className="text-gray-600">State Tax (SGST 9%):</span>
                      <span className="font-mono font-semibold">{formatInr(Number(selectedReturn.sgstAmount))}</span>
                    </div>
                  )}
                  {Number(selectedReturn.igstAmount) > 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-200">
                      <span className="text-gray-600">Integrated Tax (IGST 18%):</span>
                      <span className="font-mono font-semibold">{formatInr(Number(selectedReturn.igstAmount))}</span>
                    </div>
                  )}
                  {Number(selectedReturn.roundOffAmount) !== 0 && (
                    <div className="flex justify-between py-1 border-b border-gray-200">
                      <span className="text-gray-600">Round Off:</span>
                      <span className="font-mono">{formatInr(Number(selectedReturn.roundOffAmount))}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1.5 border-b-2 border-gray-900 text-sm font-bold text-gray-950">
                    <span>Total Credit Value Credited:</span>
                    <span className="font-mono">{formatInr(Number(selectedReturn.totalCreditAmount))}</span>
                  </div>
                </div>
              </div>

              {/* 3-Tier Signatory Block */}
              <div className="grid grid-cols-3 gap-6 pt-12 border-t border-gray-300 text-center text-xs">
                <div>
                  <div className="border-t border-gray-400 pt-1 font-semibold text-gray-800">
                    Quality / RMA Head
                  </div>
                  <div className="text-[10px] text-gray-500">Quarantine Verification</div>
                </div>
                <div>
                  <div className="border-t border-gray-400 pt-1 font-semibold text-gray-800">
                    Accounts / Commercial
                  </div>
                  <div className="text-[10px] text-gray-500">AR Ledger Adjustment</div>
                </div>
                <div>
                  <div className="border-t border-gray-400 pt-1 font-semibold text-gray-800">
                    For Kashvira Manufacturing Ltd
                  </div>
                  <div className="text-[10px] text-gray-500">Authorized Signatory</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. CANCEL RETURN MODAL                                                    */}
      {/* ========================================================================= */}
      {isCancelModalOpen && selectedReturn && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-200 dark:border-gray-800 p-6 space-y-4">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertCircle className="w-5 h-5" />
              <h2 className="text-lg font-bold">Cancel Sales Return ({selectedReturn.returnNo})</h2>
            </div>
            <p className="text-xs text-gray-500">
              Cancelling this sales return will restore customer invoice accounts receivable balance and reverse any warehouse restocked inventory.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Reason for Cancellation *
              </label>
              <textarea
                rows={2}
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Reason for cancellation..."
                className="w-full text-xs border border-gray-300 dark:border-gray-600 rounded-lg p-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCancelModalOpen(false)}
                className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              <button
                type="button"
                disabled={!cancellationReason}
                onClick={() =>
                  cancelMutation.mutate({
                    id: selectedReturn.returnId,
                    reason: cancellationReason,
                  })
                }
                className="px-4 py-1.5 text-xs text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. CONFIRM DELETE MODAL */}
      <ConfirmDeleteModal
        isOpen={isDeleteModalOpen}
        entityType="Sales Return"
        entityName={selectedReturn?.returnNo || ''}
        entityCode={selectedReturn?.returnNo || ''}
        isDeleting={deleteMutation.isPending}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={() => selectedReturn && deleteMutation.mutate(selectedReturn.returnId)}
      />
    </div>
  );
};

export default SalesReturnMasterPage;
