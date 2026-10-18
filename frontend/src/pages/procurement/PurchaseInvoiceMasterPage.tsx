import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Filter,
  HelpCircle,
  IndianRupee,
  Layers,
  Package,
  Plus,
  Printer,
  Receipt,
  ReceiptText,
  RefreshCw,
  Scale,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Trash2,
  Truck,
  User,
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

export type InvoiceStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'APPROVED'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'CANCELLED';

export type MatchingStatus =
  | 'MATCHED'
  | 'PRICE_VARIANCE'
  | 'QTY_VARIANCE'
  | 'TAX_VARIANCE'
  | 'PENDING_REVIEW';

export type PaymentStatus = 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';

export interface InvoiceItemRecord {
  invoiceItemId?: number;
  invoiceId?: number;
  poItemId?: number | null;
  grnItemId?: number | null;
  qcItemId?: number | null;
  itemId: number;
  itemCode?: string;
  itemName?: string;
  itemDescription?: string;
  hsnCode?: string;
  uomId: number;
  uomCode?: string;
  uomName?: string;
  poQty: number;
  receivedQty: number;
  acceptedQty: number;
  billedQty: number;
  poRate: number;
  invoicedRate: number;
  rateVariance: number;
  itemAmount: number;
  discountPercent: number;
  discountAmount: number;
  taxableAmount: number;
  gstRate: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalItemAmount: number;
  batchNo?: string | null;
  remarks?: string | null;
}

export interface InvoiceHeaderRecord {
  invoiceId: number;
  compId: number;
  branchId: number;
  fyearId?: number;
  invoiceNo: string;
  invoiceDate: string;
  vendorId: number;
  vendorName: string;
  vendorCode: string;
  vendorInvoiceNo: string;
  vendorInvoiceDate: string;
  vendorGstin?: string;
  paymentTermsDays: number;
  dueDate: string;
  poId?: number | null;
  poNumber?: string | null;
  grnId?: number | null;
  grnNo?: string | null;
  qcId?: number | null;
  qcNo?: string | null;
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
  tdsRate: number;
  tdsAmount: number;
  tcsRate: number;
  tcsAmount: number;
  roundOff: number;
  netPayableAmount: number;
  paidAmount: number;
  balanceAmount: number;
  matchingStatus: MatchingStatus;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  approvedBy?: number | null;
  approvedByName?: string | null;
  approvedDate?: string | null;
  approvalRemarks?: string | null;
  cancelReason?: string | null;
  remarks?: string | null;
  createdAt?: string;
  createdByName?: string | null;
  itemCount?: number;
  items?: InvoiceItemRecord[];
}

export interface InvoiceSummaryKpi {
  totalInvoices: number;
  totalPayable: number;
  matchedCount: number;
  varianceCount: number;
  pendingApprovalCount: number;
  approvedCount: number;
  paidAmount: number;
  unpaidAmount: number;
}

export interface PendingGrnLookup {
  grnId: number;
  grnNo: string;
  grnDate: string;
  vendorId: number;
  vendorName: string;
  vendorCode: string;
  poId?: number;
  poNumber?: string;
  poDate?: string;
  challanNo: string;
  challanDate: string;
  challanInvoiceNo?: string;
  grnStatus: string;
  qcId?: number;
  qcNo?: string;
  qcResult?: string;
}

export interface VendorLookup {
  partyId: number;
  partyCode: string;
  partyName: string;
  tradeName?: string;
  gstin?: string;
  creditDays?: number;
  paymentTerms?: string;
}

export const PurchaseInvoiceMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [matchFilter, setMatchFilter] = useState<string>('ALL');
  const [payFilter, setPayFilter] = useState<string>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isVoucherOpen, setIsVoucherOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Active records
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceHeaderRecord | null>(null);
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);

  // Form State
  const [formVendorId, setFormVendorId] = useState<number>(0);
  const [formVendorInvoiceNo, setFormVendorInvoiceNo] = useState<string>('');
  const [formVendorInvoiceDate, setFormVendorInvoiceDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [formInvoiceDate, setFormInvoiceDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [formPaymentTerms, setFormPaymentTerms] = useState<number>(30);
  const [formDueDate, setFormDueDate] = useState<string>('');
  const [formVendorGstin, setFormVendorGstin] = useState<string>('');
  const [formPoId, setFormPoId] = useState<number | null>(null);
  const [formGrnId, setFormGrnId] = useState<number | null>(null);
  const [formQcId, setFormQcId] = useState<number | null>(null);
  const [formFreight, setFormFreight] = useState<number>(0);
  const [formInsurance, setFormInsurance] = useState<number>(0);
  const [formPackaging, setFormPackaging] = useState<number>(0);
  const [formTdsRate, setFormTdsRate] = useState<number>(0.1); // default 0.1% TDS on goods u/s 194Q
  const [formTcsRate, setFormTcsRate] = useState<number>(0);
  const [formRemarks, setFormRemarks] = useState<string>('');
  const [formItems, setFormItems] = useState<InvoiceItemRecord[]>([]);

  // Action input states
  const [approvalRemarks, setApprovalRemarks] = useState<string>('AP 3-Way Matching Verified. Approved for Payment.');
  const [cancelReason, setCancelReason] = useState<string>('');
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'NEFT' | 'RTGS' | 'CHEQUE' | 'UPI'>('NEFT');
  const [paymentRefNo, setPaymentRefNo] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );
  const [paymentRemarks, setPaymentRemarks] = useState<string>('');

  // --------------------------------------------------------------------------
  // QUERIES
  // --------------------------------------------------------------------------

  // 1. KPI Summary
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery<InvoiceSummaryKpi>({
    queryKey: ['procurement', 'invoices', 'summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<InvoiceSummaryKpi>>(
        '/procurement/invoices/summary',
      );
      return res.data.data;
    },
  });

  // 2. Invoice Master List
  const { data: invoicesData, isLoading: isInvoicesLoading, refetch: refetchInvoices } = useQuery<
    InvoiceHeaderRecord[]
  >({
    queryKey: [
      'procurement',
      'invoices',
      statusFilter,
      matchFilter,
      payFilter,
      vendorFilter,
      searchQuery,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (matchFilter !== 'ALL') params.append('matchingStatus', matchFilter);
      if (payFilter !== 'ALL') params.append('paymentStatus', payFilter);
      if (vendorFilter !== 'ALL') params.append('vendorId', vendorFilter);
      if (searchQuery) params.append('search', searchQuery);

      const res = await apiClient.get<ApiResponse<InvoiceHeaderRecord[]>>(
        `/procurement/invoices?${params.toString()}`,
      );
      return res.data.data;
    },
  });

  // 3. Lookups: Pending GRNs for 1-Click Import
  const { data: pendingGrns } = useQuery<PendingGrnLookup[]>({
    queryKey: ['procurement', 'invoices', 'pending-grns'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<PendingGrnLookup[]>>(
        '/procurement/invoices/pending-grns',
      );
      return res.data.data;
    },
  });

  // 4. Lookups: Vendors
  const { data: vendorsList } = useQuery<VendorLookup[]>({
    queryKey: ['procurement', 'invoices', 'vendors'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<VendorLookup[]>>(
        '/procurement/invoices/vendors',
      );
      return res.data.data;
    },
  });

  // --------------------------------------------------------------------------
  // MUTATIONS
  // --------------------------------------------------------------------------

  // Create / Update Invoice
  const saveInvoiceMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingInvoiceId) {
        return apiClient.put(`/procurement/invoices/${editingInvoiceId}`, payload);
      }
      return apiClient.post('/procurement/invoices', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'invoices'] });
      setIsFormOpen(false);
      resetForm();
    },
  });

  // Submit Invoice (DRAFT -> SUBMITTED)
  const submitInvoiceMutation = useMutation({
    mutationFn: async ({ id, remarks }: { id: number; remarks?: string }) => {
      return apiClient.post(`/procurement/invoices/${id}/submit`, { remarks });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'invoices'] });
      if (isDetailOpen && selectedInvoice) {
        handleOpenDetail(selectedInvoice.invoiceId);
      }
    },
  });

  // Approve Invoice (SUBMITTED -> APPROVED)
  const approveInvoiceMutation = useMutation({
    mutationFn: async ({ id, approvalRemarks }: { id: number; approvalRemarks: string }) => {
      return apiClient.post(`/procurement/invoices/${id}/approve`, { approvalRemarks });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'invoices'] });
      setIsApproveOpen(false);
      if (isDetailOpen && selectedInvoice) {
        handleOpenDetail(selectedInvoice.invoiceId);
      }
    },
  });

  // Cancel Invoice
  const cancelInvoiceMutation = useMutation({
    mutationFn: async ({ id, cancelReason }: { id: number; cancelReason: string }) => {
      return apiClient.post(`/procurement/invoices/${id}/cancel`, { cancelReason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'invoices'] });
      setIsCancelOpen(false);
      if (isDetailOpen && selectedInvoice) {
        handleOpenDetail(selectedInvoice.invoiceId);
      }
    },
  });

  // Record Payment / AP Clearance
  const recordPaymentMutation = useMutation({
    mutationFn: async (payload: {
      id: number;
      paidAmount: number;
      paymentMode: string;
      paymentRefNo: string;
      paymentDate: string;
      remarks?: string;
    }) => {
      const { id, ...body } = payload;
      return apiClient.post(`/procurement/invoices/${id}/record-payment`, body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'invoices'] });
      setIsPaymentOpen(false);
      if (isDetailOpen && selectedInvoice) {
        handleOpenDetail(selectedInvoice.invoiceId);
      }
    },
  });

  // Delete Invoice
  const deleteInvoiceMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiClient.delete(`/procurement/invoices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['procurement', 'invoices'] });
      setIsDeleteOpen(false);
      setSelectedInvoice(null);
    },
  });

  // --------------------------------------------------------------------------
  // FORM & IMPORT LOGIC
  // --------------------------------------------------------------------------

  const resetForm = () => {
    setEditingInvoiceId(null);
    setFormVendorId(0);
    setFormVendorInvoiceNo('');
    setFormVendorInvoiceDate(new Date().toISOString().split('T')[0]);
    setFormInvoiceDate(new Date().toISOString().split('T')[0]);
    setFormPaymentTerms(30);
    setFormDueDate('');
    setFormVendorGstin('');
    setFormPoId(null);
    setFormGrnId(null);
    setFormQcId(null);
    setFormFreight(0);
    setFormInsurance(0);
    setFormPackaging(0);
    setFormTdsRate(0.1);
    setFormTcsRate(0);
    setFormRemarks('');
    setFormItems([]);
  };

  // 1-Click Import from GRN Details
  const handleImportGrn = async (grnId: number) => {
    try {
      const res = await apiClient.get<ApiResponse<any>>(
        `/procurement/invoices/grn-details/${grnId}`,
      );
      const grn = res.data.data;
      setFormGrnId(grn.grnId);
      setFormPoId(grn.poId || null);
      setFormQcId(grn.qcId || null);
      setFormVendorId(grn.vendorId);
      setFormVendorGstin(grn.vendorGstin || '');
      setFormVendorInvoiceNo(grn.challanNo || '');
      setFormVendorInvoiceDate(grn.challanDate ? grn.challanDate.split('T')[0] : new Date().toISOString().split('T')[0]);

      // Calculate initial due date
      const d = new Date(grn.challanDate || new Date());
      d.setDate(d.getDate() + formPaymentTerms);
      setFormDueDate(d.toISOString().split('T')[0]);

      // Populate items
      if (grn.items && grn.items.length > 0) {
        const importedItems: InvoiceItemRecord[] = grn.items.map((it: any) => {
          const poQty = Number(it.poQty || 0);
          const receivedQty = Number(it.receivedQty || 0);
          const acceptedQty = Number(it.acceptedQty || receivedQty);
          const billedQty = acceptedQty; // default to accepted qty
          const poRate = Number(it.poRate || 0);
          const invoicedRate = poRate; // default to PO contract rate
          const rateVariance = invoicedRate - poRate;
          const itemAmount = billedQty * invoicedRate;
          const gstRate = Number(it.gstRate || 18);
          const taxableAmount = itemAmount;
          const cgstRate = gstRate / 2;
          const sgstRate = gstRate / 2;
          const cgstAmount = (taxableAmount * cgstRate) / 100;
          const sgstAmount = (taxableAmount * sgstRate) / 100;
          const totalItemAmount = taxableAmount + cgstAmount + sgstAmount;

          return {
            itemId: it.itemId,
            itemCode: it.itemCode,
            itemName: it.itemName,
            itemDescription: it.itemName,
            hsnCode: it.hsnCode || '7214',
            uomId: it.uomId,
            uomCode: it.uomCode,
            uomName: it.uomName,
            poItemId: it.poItemId,
            grnItemId: it.grnItemId,
            qcItemId: it.qcItemId,
            poQty,
            receivedQty,
            acceptedQty,
            billedQty,
            poRate,
            invoicedRate,
            rateVariance,
            itemAmount,
            discountPercent: 0,
            discountAmount: 0,
            taxableAmount,
            gstRate,
            cgstRate,
            cgstAmount,
            sgstRate,
            sgstAmount,
            igstRate: 0,
            igstAmount: 0,
            totalItemAmount,
            batchNo: it.batchNo,
            remarks: it.remarks,
          };
        });
        setFormItems(importedItems);
      }
    } catch (err: any) {
      alert(`Failed to import GRN details: ${err?.message || err}`);
    }
  };

  // Open Full Detail Modal
  const handleOpenDetail = async (invoiceId: number) => {
    try {
      const res = await apiClient.get<ApiResponse<InvoiceHeaderRecord>>(
        `/procurement/invoices/${invoiceId}`,
      );
      setSelectedInvoice(res.data.data);
      setIsDetailOpen(true);
    } catch (err: any) {
      alert(`Failed to load invoice: ${err?.message || err}`);
    }
  };

  // Open Edit Modal
  const handleOpenEdit = async (inv: InvoiceHeaderRecord) => {
    try {
      const res = await apiClient.get<ApiResponse<InvoiceHeaderRecord>>(
        `/procurement/invoices/${inv.invoiceId}`,
      );
      const full = res.data.data;
      setEditingInvoiceId(full.invoiceId);
      setFormVendorId(full.vendorId);
      setFormVendorInvoiceNo(full.vendorInvoiceNo);
      setFormVendorInvoiceDate(
        full.vendorInvoiceDate
          ? full.vendorInvoiceDate.split('T')[0]
          : new Date().toISOString().split('T')[0],
      );
      setFormInvoiceDate(
        full.invoiceDate
          ? full.invoiceDate.split('T')[0]
          : new Date().toISOString().split('T')[0],
      );
      setFormPaymentTerms(full.paymentTermsDays || 30);
      setFormDueDate(
        full.dueDate
          ? full.dueDate.split('T')[0]
          : new Date().toISOString().split('T')[0],
      );
      setFormVendorGstin(full.vendorGstin || '');
      setFormPoId(full.poId || null);
      setFormGrnId(full.grnId || null);
      setFormQcId(full.qcId || null);
      setFormFreight(full.freightCharges || 0);
      setFormInsurance(full.insuranceCharges || 0);
      setFormPackaging(full.packagingCharges || 0);
      setFormTdsRate(full.tdsRate || 0);
      setFormTcsRate(full.tcsRate || 0);
      setFormRemarks(full.remarks || '');
      setFormItems(full.items || []);
      setIsFormOpen(true);
    } catch (err: any) {
      alert(`Failed to load invoice for editing: ${err?.message || err}`);
    }
  };

  // Real-time calculations of Form Financials & 3-Way Match Status
  const formCalculations = useMemo(() => {
    let subtotal = 0;
    let totalDiscount = 0;
    let taxable = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let hasPriceVariance = false;
    let hasQtyVariance = false;

    formItems.forEach((it) => {
      const itemAmount = Number(it.itemAmount || 0);
      const disc = Number(it.discountAmount || 0);
      const taxBase = Number(it.taxableAmount || itemAmount - disc);
      const cgst = Number(it.cgstAmount || 0);
      const sgst = Number(it.sgstAmount || 0);
      const igst = Number(it.igstAmount || 0);

      subtotal += itemAmount;
      totalDiscount += disc;
      taxable += taxBase;
      totalCgst += cgst;
      totalSgst += sgst;
      totalIgst += igst;

      if (it.poRate > 0 && Math.abs(it.invoicedRate - it.poRate) > 0.01) {
        hasPriceVariance = true;
      }
      if (it.acceptedQty > 0 && it.billedQty - it.acceptedQty > 0.001) {
        hasQtyVariance = true;
      }
    });

    const totalTax = totalCgst + totalSgst + totalIgst;
    const tdsAmount = (taxable * formTdsRate) / 100;
    const tcsAmount = ((taxable + totalTax) * formTcsRate) / 100;
    const rawNet =
      taxable +
      totalTax +
      formFreight +
      formInsurance +
      formPackaging -
      tdsAmount +
      tcsAmount;
    const roundOff = Math.round(rawNet) - rawNet;
    const netPayable = Math.round(rawNet + roundOff);

    let matchingStatus: MatchingStatus = 'MATCHED';
    if (hasPriceVariance) matchingStatus = 'PRICE_VARIANCE';
    else if (hasQtyVariance) matchingStatus = 'QTY_VARIANCE';

    return {
      subtotal,
      totalDiscount,
      taxable,
      totalCgst,
      totalSgst,
      totalIgst,
      totalTax,
      tdsAmount,
      tcsAmount,
      roundOff,
      netPayable,
      matchingStatus,
      hasPriceVariance,
      hasQtyVariance,
    };
  }, [
    formItems,
    formFreight,
    formInsurance,
    formPackaging,
    formTdsRate,
    formTcsRate,
  ]);

  // Handle Form Item field change
  const handleItemFieldChange = (
    index: number,
    field: keyof InvoiceItemRecord,
    val: any,
  ) => {
    setFormItems((prev) => {
      const updated = [...prev];
      const cur = { ...updated[index], [field]: val };

      if (field === 'billedQty' || field === 'invoicedRate' || field === 'gstRate') {
        const bQty = Number(cur.billedQty || 0);
        const invRate = Number(cur.invoicedRate || 0);
        const poRate = Number(cur.poRate || 0);
        cur.rateVariance = invRate - poRate;
        const baseAmt = bQty * invRate;
        cur.itemAmount = Math.round(baseAmt * 100) / 100;
        const discAmt = Number(cur.discountAmount || 0);
        cur.taxableAmount = Math.round((baseAmt - discAmt) * 100) / 100;
        const gst = Number(cur.gstRate || 18);
        const cgstRate = cur.igstRate > 0 ? 0 : gst / 2;
        const sgstRate = cur.igstRate > 0 ? 0 : gst / 2;
        cur.cgstRate = cgstRate;
        cur.sgstRate = sgstRate;
        cur.cgstAmount = Math.round(((cur.taxableAmount * cgstRate) / 100) * 100) / 100;
        cur.sgstAmount = Math.round(((cur.taxableAmount * sgstRate) / 100) * 100) / 100;
        cur.igstAmount = cur.igstRate > 0 ? Math.round(((cur.taxableAmount * cur.igstRate) / 100) * 100) / 100 : 0;
        cur.totalItemAmount =
          Math.round(
            (cur.taxableAmount + cur.cgstAmount + cur.sgstAmount + cur.igstAmount) * 100,
          ) / 100;
      }
      updated[index] = cur;
      return updated;
    });
  };

  // Submit Save
  const handleSaveInvoice = (status: InvoiceStatus = 'DRAFT') => {
    if (!formVendorId) {
      alert('Please select a supplier.');
      return;
    }
    if (!formVendorInvoiceNo.trim()) {
      alert('Vendor invoice number is mandatory.');
      return;
    }
    if (formItems.length === 0) {
      alert('At least one invoice line item is required.');
      return;
    }

    const payload = {
      invoiceDate: formInvoiceDate,
      vendorId: formVendorId,
      poId: formPoId || undefined,
      grnId: formGrnId || undefined,
      qcId: formQcId || undefined,
      vendorInvoiceNo: formVendorInvoiceNo.trim(),
      vendorInvoiceDate: formVendorInvoiceDate,
      vendorGstin: formVendorGstin || undefined,
      paymentTermsDays: formPaymentTerms,
      dueDate: formDueDate,
      subtotalAmount: formCalculations.subtotal,
      discountAmount: formCalculations.totalDiscount,
      taxableAmount: formCalculations.taxable,
      cgstAmount: formCalculations.totalCgst,
      sgstAmount: formCalculations.totalSgst,
      igstAmount: formCalculations.totalIgst,
      totalTaxAmount: formCalculations.totalTax,
      freightCharges: formFreight,
      insuranceCharges: formInsurance,
      packagingCharges: formPackaging,
      tdsRate: formTdsRate,
      tdsAmount: formCalculations.tdsAmount,
      tcsRate: formTcsRate,
      tcsAmount: formCalculations.tcsAmount,
      roundOff: formCalculations.roundOff,
      netPayableAmount: formCalculations.netPayable,
      matchingStatus: formCalculations.matchingStatus,
      status,
      remarks: formRemarks || undefined,
      items: formItems.map((it) => ({
        poItemId: it.poItemId,
        grnItemId: it.grnItemId,
        qcItemId: it.qcItemId,
        itemId: it.itemId,
        itemDescription: it.itemDescription,
        hsnCode: it.hsnCode,
        uomId: it.uomId,
        poQty: it.poQty,
        receivedQty: it.receivedQty,
        acceptedQty: it.acceptedQty,
        billedQty: it.billedQty,
        poRate: it.poRate,
        invoicedRate: it.invoicedRate,
        rateVariance: it.rateVariance,
        itemAmount: it.itemAmount,
        discountPercent: it.discountPercent,
        discountAmount: it.discountAmount,
        taxableAmount: it.taxableAmount,
        gstRate: it.gstRate,
        cgstRate: it.cgstRate,
        cgstAmount: it.cgstAmount,
        sgstRate: it.sgstRate,
        sgstAmount: it.sgstAmount,
        igstRate: it.igstRate,
        igstAmount: it.igstAmount,
        totalItemAmount: it.totalItemAmount,
        batchNo: it.batchNo,
        remarks: it.remarks,
      })),
    };

    saveInvoiceMutation.mutate(payload);
  };

  // --------------------------------------------------------------------------
  // MASTER TABLE CONFIGURATION
  // --------------------------------------------------------------------------

  const columns: MasterTableColumn<InvoiceHeaderRecord>[] = [
    {
      key: 'invoiceNo',
      header: 'Invoice # / Matching',
      sortable: true,
      sortValue: (r) => r.invoiceNo,
      render: (r) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono-code font-bold text-[var(--brand-600)] dark:text-[var(--brand-400)]">
              {r.invoiceNo}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {r.matchingStatus === 'MATCHED' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="h-2.5 w-2.5" />
                3-Way Matched
              </span>
            )}
            {r.matchingStatus === 'PRICE_VARIANCE' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20">
                <AlertCircle className="h-2.5 w-2.5" />
                Price Variance
              </span>
            )}
            {r.matchingStatus === 'QTY_VARIANCE' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                <AlertTriangle className="h-2.5 w-2.5" />
                Qty Variance
              </span>
            )}
            {r.matchingStatus === 'TAX_VARIANCE' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
                <HelpCircle className="h-2.5 w-2.5" />
                Tax Variance
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'vendorName',
      header: 'Supplier & Bill Details',
      sortable: true,
      sortValue: (r) => r.vendorName,
      render: (r) => (
        <div className="space-y-0.5 max-w-xs">
          <p className="font-semibold text-[var(--text-primary)] truncate">
            {r.vendorName}
          </p>
          <p className="text-xs text-[var(--text-muted)] font-mono-code">
            Bill: {r.vendorInvoiceNo} • Date: {r.vendorInvoiceDate}
          </p>
          {r.vendorGstin && (
            <p className="text-[10px] text-[var(--text-muted)]">
              GSTIN: {r.vendorGstin}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'references',
      header: 'PO / GRN Reference',
      render: (r) => (
        <div className="space-y-0.5 text-xs text-[var(--text-muted)]">
          {r.poNumber && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">PO:</span>
              <span className="font-mono-code text-[var(--text-primary)]">{r.poNumber}</span>
            </div>
          )}
          {r.grnNo && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">GRN:</span>
              <span className="font-mono-code text-[var(--text-primary)]">{r.grnNo}</span>
            </div>
          )}
          {r.qcNo && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">QC:</span>
              <span className="font-mono-code text-[var(--text-primary)]">{r.qcNo}</span>
            </div>
          )}
          {!r.poNumber && !r.grnNo && <span>Direct Expense Invoice</span>}
        </div>
      ),
    },
    {
      key: 'dates',
      header: 'Invoice Date / Due',
      sortable: true,
      sortValue: (r) => r.invoiceDate,
      render: (r) => (
        <div className="space-y-0.5 text-xs">
          <p className="font-medium text-[var(--text-primary)]">{r.invoiceDate}</p>
          <p className="text-[11px] text-[var(--text-muted)]">
            Due: <span className="font-medium text-amber-600 dark:text-amber-400">{r.dueDate}</span>
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">{r.paymentTermsDays} Days Credit</p>
        </div>
      ),
    },
    {
      key: 'netPayableAmount',
      header: 'Net AP Valuation (₹)',
      align: 'right',
      sortable: true,
      sortValue: (r) => r.netPayableAmount,
      render: (r) => (
        <div className="text-right space-y-0.5">
          <p className="font-bold text-sm text-[var(--text-primary)]">
            ₹{r.netPayableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-[var(--text-muted)]">
            Taxable: ₹{r.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] text-[var(--brand-600)] dark:text-[var(--brand-400)]">
            GST ITC: ₹{r.totalTaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
      ),
    },
    {
      key: 'paymentStatus',
      header: 'AP Clearance',
      sortable: true,
      sortValue: (r) => r.paymentStatus,
      render: (r) => (
        <div className="space-y-1">
          {r.paymentStatus === 'PAID' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              <Check className="h-3 w-3" /> Fully Paid
            </span>
          )}
          {r.paymentStatus === 'PARTIALLY_PAID' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              <Clock className="h-3 w-3" /> Part Paid
            </span>
          )}
          {r.paymentStatus === 'UNPAID' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-700 dark:text-slate-400 border border-slate-500/20">
              Unpaid
            </span>
          )}
          {r.balanceAmount > 0 && r.paymentStatus !== 'PAID' && (
            <p className="text-[10px] text-rose-600 dark:text-rose-400 font-mono-code">
              Bal: ₹{r.balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Workflow Status',
      sortable: true,
      sortValue: (r) => r.status,
      render: (r) => {
        const styles: Record<InvoiceStatus, string> = {
          DRAFT: 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20',
          SUBMITTED: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
          APPROVED: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
          PAID: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20',
          PARTIALLY_PAID: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
          CANCELLED: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
        };
        return (
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
              styles[r.status] || styles.DRAFT
            }`}
          >
            {r.status}
          </span>
        );
      },
    },
  ];

  const groupByOptions: GroupByOption<InvoiceHeaderRecord>[] = [
    {
      key: 'matchingStatus',
      label: '3-Way Match Status',
      groupValue: (r) => r.matchingStatus,
    },
    {
      key: 'status',
      label: 'Workflow Status',
      groupValue: (r) => r.status,
    },
    {
      key: 'vendorName',
      label: 'Supplier / Vendor',
      groupValue: (r) => r.vendorName,
    },
    {
      key: 'paymentStatus',
      label: 'Payment Clearance Status',
      groupValue: (r) => r.paymentStatus,
    },
  ];

  // --------------------------------------------------------------------------
  // RENDER ROW ACTIONS
  // --------------------------------------------------------------------------
  const renderRowActions = (inv: InvoiceHeaderRecord) => (
    <div className="flex items-center justify-end gap-1">
      {/* View Details */}
      <button
        onClick={() => handleOpenDetail(inv.invoiceId)}
        title="View 3-Way Match Verification"
        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--brand-600)] hover:bg-[var(--brand-50)] dark:hover:bg-[var(--brand-500)]/15 transition-colors"
      >
        <Eye className="h-4 w-4" />
      </button>

      {/* Edit (DRAFT only) */}
      {inv.status === 'DRAFT' && (
        <PermissionGate screen="PURCHASE_INVOICE" action="EDIT">
          <button
            onClick={() => handleOpenEdit(inv)}
            title="Edit Draft Invoice"
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/15 transition-colors"
          >
            <Edit3 className="h-4 w-4" />
          </button>
        </PermissionGate>
      )}

      {/* Submit (DRAFT only) */}
      {inv.status === 'DRAFT' && (
        <PermissionGate screen="PURCHASE_INVOICE" action="SUBMIT">
          <button
            onClick={() => {
              if (window.confirm(`Submit Invoice ${inv.invoiceNo} for AP Approval?`)) {
                submitInvoiceMutation.mutate({ id: inv.invoiceId });
              }
            }}
            title="Submit for AP Approval"
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/15 transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </PermissionGate>
      )}

      {/* Approve (SUBMITTED only) */}
      {inv.status === 'SUBMITTED' && (
        <PermissionGate screen="PURCHASE_INVOICE" action="APPROVE">
          <button
            onClick={() => {
              setSelectedInvoice(inv);
              setApprovalRemarks('AP 3-Way Matching Verified. Approved for Payment.');
              setIsApproveOpen(true);
            }}
            title="Approve Accounts Payable"
            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/15 transition-colors font-medium text-xs flex items-center gap-1"
          >
            <ShieldCheck className="h-4 w-4" />
          </button>
        </PermissionGate>
      )}

      {/* Record Payment (APPROVED or PARTIALLY_PAID) */}
      {(inv.status === 'APPROVED' || inv.status === 'PARTIALLY_PAID') &&
        inv.paymentStatus !== 'PAID' && (
          <PermissionGate screen="PURCHASE_INVOICE" action="APPROVE">
            <button
              onClick={() => {
                setSelectedInvoice(inv);
                setPaymentAmount(inv.balanceAmount || inv.netPayableAmount);
                setPaymentRefNo(`UTR-${Date.now().toString().slice(-6)}`);
                setPaymentRemarks('Bank clearance against AP invoice');
                setIsPaymentOpen(true);
              }}
              title="Record AP Payment Clearance"
              className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-500/15 transition-colors font-medium text-xs flex items-center gap-1"
            >
              <CreditCard className="h-4 w-4" />
            </button>
          </PermissionGate>
        )}

      {/* Print Voucher */}
      <PermissionGate screen="PURCHASE_INVOICE" action="PRINT">
        <button
          onClick={() => {
            setSelectedInvoice(inv);
            setIsVoucherOpen(true);
          }}
          title="Print AP Voucher"
          className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
        >
          <Printer className="h-4 w-4" />
        </button>
      </PermissionGate>

      {/* Cancel (DRAFT or SUBMITTED or APPROVED without payment) */}
      {inv.status !== 'CANCELLED' && inv.status !== 'PAID' && inv.paidAmount === 0 && (
        <PermissionGate screen="PURCHASE_INVOICE" action="CANCEL">
          <button
            onClick={() => {
              setSelectedInvoice(inv);
              setCancelReason('');
              setIsCancelOpen(true);
            }}
            title="Cancel Commercial Invoice"
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/15 transition-colors"
          >
            <XCircle className="h-4 w-4" />
          </button>
        </PermissionGate>
      )}

      {/* Delete (DRAFT only) */}
      {inv.status === 'DRAFT' && (
        <PermissionGate screen="PURCHASE_INVOICE" action="DELETE">
          <button
            onClick={() => {
              setSelectedInvoice(inv);
              setIsDeleteOpen(true);
            }}
            title="Delete Draft"
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/15 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </PermissionGate>
      )}
    </div>
  );

  return (
    <div className="space-y-6 p-6">
      {/* -------------------------------------------------------------------- */}
      {/* KPI DASHBOARD HEADER                                                 */}
      {/* -------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Commercial Invoices */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Total Invoices
            </span>
            <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <ReceiptText className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[var(--text-primary)]">
              {summaryData?.totalInvoices || 0}
            </span>
            <span className="text-xs text-[var(--text-muted)]">Registered</span>
          </div>
          <p className="mt-1 text-xs text-blue-600 dark:text-blue-400 font-medium">
            ₹{(summaryData?.totalPayable || 0).toLocaleString('en-IN', {
              maximumFractionDigits: 0,
            })}{' '}
            Total Value
          </p>
        </div>

        {/* KPI 2: 3-Way Clean Matched */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              3-Way Clean Matched
            </span>
            <div className="h-9 w-9 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {summaryData?.matchedCount || 0}
            </span>
            <span className="text-xs text-[var(--text-muted)]">Zero Discrepancy</span>
          </div>
          <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            PO Rate & QC Qty Verified
          </p>
        </div>

        {/* KPI 3: Variances Under Review */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Variances Flagged
            </span>
            <div className="h-9 w-9 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400">
              {summaryData?.varianceCount || 0}
            </span>
            <span className="text-xs text-[var(--text-muted)]">Rate / Qty Mismatch</span>
          </div>
          <p className="mt-1 text-xs text-rose-600 dark:text-rose-400 font-medium">
            Requires Commercial Clearance
          </p>
        </div>

        {/* KPI 4: Outstanding Accounts Payable */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Accounts Payable
            </span>
            <div className="h-9 w-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <IndianRupee className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-black text-[var(--text-primary)]">
              ₹{(summaryData?.unpaidAmount || 0).toLocaleString('en-IN', {
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
          <p className="mt-1 text-xs text-teal-600 dark:text-teal-400 font-medium">
            ₹{(summaryData?.paidAmount || 0).toLocaleString('en-IN', {
              maximumFractionDigits: 0,
            })}{' '}
            Cleared & Paid
          </p>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* FILTER TOOLBAR SLOT                                                  */}
      {/* -------------------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Workflow Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
        >
          <option value="ALL">All Statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="APPROVED">Approved</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="PAID">Fully Paid</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        {/* 3-Way Matching Status Filter */}
        <select
          value={matchFilter}
          onChange={(e) => setMatchFilter(e.target.value)}
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
        >
          <option value="ALL">All Match States</option>
          <option value="MATCHED">✓ Clean Matched</option>
          <option value="PRICE_VARIANCE">⚠️ Price Variance</option>
          <option value="QTY_VARIANCE">⚠️ Quantity Variance</option>
          <option value="TAX_VARIANCE">⚠️ Tax Variance</option>
        </select>

        {/* Payment Status Filter */}
        <select
          value={payFilter}
          onChange={(e) => setPayFilter(e.target.value)}
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
        >
          <option value="ALL">All Payment States</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="PAID">Paid</option>
        </select>

        {/* Vendor Filter */}
        <select
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-500)]"
        >
          <option value="ALL">All Suppliers / Vendors</option>
          {vendorsList?.map((v) => (
            <option key={v.partyId} value={String(v.partyId)}>
              {v.partyName}
            </option>
          ))}
        </select>

        <button
          onClick={() => {
            setStatusFilter('ALL');
            setMatchFilter('ALL');
            setPayFilter('ALL');
            setVendorFilter('ALL');
            setSearchQuery('');
          }}
          className="px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors flex items-center gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reset Filters
        </button>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* MASTER DATA TABLE                                                    */}
      {/* -------------------------------------------------------------------- */}
      <MasterDataTable<InvoiceHeaderRecord>
        title="Purchase Invoices & Commercial 3-Way Matching"
        subtitle="Match vendor commercial invoices against PO rates, GRN quantities, QC acceptance, GST input tax credits, and clear Accounts Payable."
        screenCode="PURCHASE_INVOICE"
        tableNameBadge="tbl_pur_invoice_header"
        data={invoicesData || []}
        rowKey={(row) => row.invoiceId}
        columns={columns}
        searchPlaceholder="Search by Invoice #, Vendor Bill #, Supplier name, PO #..."
        searchPredicate={(row, q) =>
          row.invoiceNo.toLowerCase().includes(q.toLowerCase()) ||
          row.vendorInvoiceNo.toLowerCase().includes(q.toLowerCase()) ||
          row.vendorName.toLowerCase().includes(q.toLowerCase()) ||
          (row.poNumber?.toLowerCase().includes(q.toLowerCase()) ?? false) ||
          (row.grnNo?.toLowerCase().includes(q.toLowerCase()) ?? false)
        }
        groupByOptions={groupByOptions}
        addButtonLabel="New Purchase Invoice"
        onAddClick={() => {
          resetForm();
          setIsFormOpen(true);
        }}
        renderRowActions={renderRowActions}
        isLoading={isInvoicesLoading}
      />

      {/* -------------------------------------------------------------------- */}
      {/* CREATE / EDIT INVOICE MODAL                                          */}
      {/* -------------------------------------------------------------------- */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--brand-500)]/15 text-[var(--brand-600)] dark:text-[var(--brand-400)]">
                  <ReceiptText className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    {editingInvoiceId
                      ? `Edit Purchase Invoice #${editingInvoiceId}`
                      : 'Commercial Purchase Invoice & 3-Way Match Entry'}
                  </h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Import accepted goods from GRN/QC or record direct vendor billing with automatic variance detection.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsFormOpen(false);
                  resetForm();
                }}
                className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 1-Click Import from Approved GRN Banner */}
              {!editingInvoiceId && pendingGrns && pendingGrns.length > 0 && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                        1-Click Import from Inward GRN & Inspection
                      </span>
                    </div>
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                      Auto-populates items, PO contract rates & QC accepted quantities
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <select
                      onChange={(e) => {
                        const gid = Number(e.target.value);
                        if (gid) handleImportGrn(gid);
                      }}
                      defaultValue=""
                      className="flex-1 rounded-xl border border-blue-500/40 bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="" disabled>
                        Select Pending GRN to Import...
                      </option>
                      {pendingGrns.map((g) => (
                        <option key={g.grnId} value={g.grnId}>
                          {g.grnNo} — {g.vendorName} (PO: {g.poNumber || 'N/A'}, Challan: {g.challanNo})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* 3-Way Match Status Banner */}
              {formCalculations.matchingStatus === 'MATCHED' ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                        3-Way Matching Verified: Clean Match
                      </p>
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                        Invoiced unit rates match PO rates and billed quantities do not exceed QC accepted limits.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-emerald-500 text-white">
                    PASS
                  </span>
                </div>
              ) : formCalculations.matchingStatus === 'PRICE_VARIANCE' ? (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                    <div>
                      <p className="text-xs font-bold text-rose-800 dark:text-rose-300">
                        ⚠️ 3-Way Match Alert: Price Variance Detected
                      </p>
                      <p className="text-[11px] text-rose-700 dark:text-rose-400">
                        One or more line items have invoiced rates that exceed the agreed PO contract rates.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-rose-500 text-white">
                    PRICE VARIANCE
                  </span>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                        ⚠️ 3-Way Match Alert: Quantity Variance Detected
                      </p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-400">
                        Billed quantity exceeds QC accepted quantity for this consignment.
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase bg-amber-500 text-white">
                    QTY VARIANCE
                  </span>
                </div>
              )}

              {/* Header Fields Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Supplier */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Supplier / Vendor <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formVendorId}
                    onChange={(e) => {
                      const vid = Number(e.target.value);
                      setFormVendorId(vid);
                      const found = vendorsList?.find((v) => v.partyId === vid);
                      if (found) {
                        setFormVendorGstin(found.gstin || '');
                        if (found.creditDays) setFormPaymentTerms(found.creditDays);
                      }
                    }}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--brand-500)]"
                  >
                    <option value={0}>Select Supplier...</option>
                    {vendorsList?.map((v) => (
                      <option key={v.partyId} value={v.partyId}>
                        {v.partyName} ({v.partyCode})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Vendor Invoice No */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Vendor Bill / Invoice # <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formVendorInvoiceNo}
                    onChange={(e) => setFormVendorInvoiceNo(e.target.value)}
                    placeholder="e.g. INV/2026/0981"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--brand-500)] font-mono-code"
                  />
                </div>

                {/* Vendor Invoice Date */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Vendor Bill Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formVendorInvoiceDate}
                    onChange={(e) => {
                      setFormVendorInvoiceDate(e.target.value);
                      const d = new Date(e.target.value);
                      d.setDate(d.getDate() + formPaymentTerms);
                      setFormDueDate(d.toISOString().split('T')[0]);
                    }}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--brand-500)]"
                  />
                </div>

                {/* Supplier GSTIN */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Supplier GSTIN (ITC Eligible)
                  </label>
                  <input
                    type="text"
                    value={formVendorGstin}
                    onChange={(e) => setFormVendorGstin(e.target.value)}
                    placeholder="27AAAC..."
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--brand-500)] font-mono-code"
                  />
                </div>

                {/* Credit Days & Due Date */}
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Payment Terms (Days)
                  </label>
                  <input
                    type="number"
                    value={formPaymentTerms}
                    onChange={(e) => {
                      const days = Number(e.target.value);
                      setFormPaymentTerms(days);
                      const d = new Date(formVendorInvoiceDate || new Date());
                      d.setDate(d.getDate() + days);
                      setFormDueDate(d.toISOString().split('T')[0]);
                    }}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--brand-500)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Payment Due Date
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] focus:ring-2 focus:ring-[var(--brand-500)]"
                  />
                </div>
              </div>

              {/* -------------------------------------------------------------- */}
              {/* LINE ITEMS 3-WAY MATCHING GRID                                 */}
              {/* -------------------------------------------------------------- */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
                    <Layers className="h-4 w-4 text-[var(--brand-500)]" />
                    Line Items & 3-Way Variance Evaluation
                  </h4>
                  <span className="text-xs text-[var(--text-muted)]">
                    {formItems.length} Item(s)
                  </span>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] text-[var(--text-muted)] font-bold">
                      <tr>
                        <th className="py-2.5 px-3">Item / Description</th>
                        <th className="py-2.5 px-3 text-right">PO Qty</th>
                        <th className="py-2.5 px-3 text-right">QC Acc.</th>
                        <th className="py-2.5 px-3 text-right">Billed Qty</th>
                        <th className="py-2.5 px-3 text-right">PO Rate (₹)</th>
                        <th className="py-2.5 px-3 text-right">Inv. Rate (₹)</th>
                        <th className="py-2.5 px-3 text-right">Rate Diff</th>
                        <th className="py-2.5 px-3 text-right">Taxable (₹)</th>
                        <th className="py-2.5 px-3 text-right">GST %</th>
                        <th className="py-2.5 px-3 text-right">Total (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-surface)]">
                      {formItems.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="py-8 text-center text-[var(--text-muted)]">
                            No items loaded yet. Use "1-Click Import from GRN" above or add items.
                          </td>
                        </tr>
                      ) : (
                        formItems.map((item, idx) => {
                          const isPriceVariance =
                            item.poRate > 0 && Math.abs(item.invoicedRate - item.poRate) > 0.01;
                          const isQtyVariance =
                            item.acceptedQty > 0 && item.billedQty - item.acceptedQty > 0.001;

                          return (
                            <tr
                              key={idx}
                              className={
                                isPriceVariance
                                  ? 'bg-rose-500/5'
                                  : isQtyVariance
                                  ? 'bg-amber-500/5'
                                  : ''
                              }
                            >
                              <td className="py-2.5 px-3">
                                <p className="font-semibold text-[var(--text-primary)]">
                                  {item.itemName || item.itemDescription}
                                </p>
                                <p className="text-[10px] text-[var(--text-muted)] font-mono-code">
                                  {item.itemCode} • HSN: {item.hsnCode} • UOM: {item.uomCode}
                                </p>
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono-code text-[var(--text-muted)]">
                                {item.poQty}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono-code text-emerald-600 dark:text-emerald-400 font-bold">
                                {item.acceptedQty}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <input
                                  type="number"
                                  step="0.001"
                                  value={item.billedQty}
                                  onChange={(e) =>
                                    handleItemFieldChange(idx, 'billedQty', e.target.value)
                                  }
                                  className={`w-20 text-right rounded-lg border px-2 py-1 text-xs font-mono-code ${
                                    isQtyVariance
                                      ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold'
                                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                                  }`}
                                />
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono-code text-[var(--text-muted)]">
                                ₹{item.poRate.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={item.invoicedRate}
                                  onChange={(e) =>
                                    handleItemFieldChange(idx, 'invoicedRate', e.target.value)
                                  }
                                  className={`w-24 text-right rounded-lg border px-2 py-1 text-xs font-mono-code ${
                                    isPriceVariance
                                      ? 'border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400 font-bold'
                                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                                  }`}
                                />
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono-code">
                                {isPriceVariance ? (
                                  <span className="text-rose-600 dark:text-rose-400 font-bold">
                                    {item.rateVariance > 0 ? '+' : ''}
                                    ₹{item.rateVariance.toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    ₹0.00
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono-code font-medium">
                                ₹{item.taxableAmount.toFixed(2)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono-code text-[var(--text-muted)]">
                                {item.gstRate}%
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono-code font-bold text-[var(--text-primary)]">
                                ₹{item.totalItemAmount.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* -------------------------------------------------------------- */}
              {/* TAXES, DEDUCTIONS & NET PAYABLE CARD                           */}
              {/* -------------------------------------------------------------- */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-[var(--border-subtle)]">
                {/* Ancillary Charges & Taxes */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Freight, Insurance & Withholding
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                        Freight (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formFreight}
                        onChange={(e) => setFormFreight(Number(e.target.value))}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-mono-code"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                        Insurance (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formInsurance}
                        onChange={(e) => setFormInsurance(Number(e.target.value))}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-mono-code"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                        Packaging (₹)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formPackaging}
                        onChange={(e) => setFormPackaging(Number(e.target.value))}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-mono-code"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                        TDS u/s 194Q (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formTdsRate}
                        onChange={(e) => setFormTdsRate(Number(e.target.value))}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-mono-code"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                        TCS u/s 206C (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formTcsRate}
                        onChange={(e) => setFormTcsRate(Number(e.target.value))}
                        className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2.5 py-1.5 text-xs font-mono-code"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">
                      Commercial Remarks / AP Instructions
                    </label>
                    <textarea
                      rows={2}
                      value={formRemarks}
                      onChange={(e) => setFormRemarks(e.target.value)}
                      placeholder="Add commercial audit remarks or payment clearance instructions..."
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 text-xs"
                    />
                  </div>
                </div>

                {/* Final Calculation Summary */}
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 space-y-2 text-xs">
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>Taxable Base Value:</span>
                    <span className="font-mono-code font-semibold text-[var(--text-primary)]">
                      ₹{formCalculations.taxable.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-[var(--text-muted)]">
                    <span>CGST + SGST (9% + 9%):</span>
                    <span className="font-mono-code font-semibold text-[var(--brand-600)] dark:text-[var(--brand-400)]">
                      +₹{formCalculations.totalTax.toFixed(2)}
                    </span>
                  </div>
                  {(formFreight > 0 || formInsurance > 0 || formPackaging > 0) && (
                    <div className="flex justify-between text-[var(--text-muted)]">
                      <span>Ancillary Charges:</span>
                      <span className="font-mono-code font-semibold text-[var(--text-primary)]">
                        +₹{(formFreight + formInsurance + formPackaging).toFixed(2)}
                      </span>
                    </div>
                  )}
                  {formCalculations.tdsAmount > 0 && (
                    <div className="flex justify-between text-rose-600 dark:text-rose-400">
                      <span>Less TDS Withholding (0.1%):</span>
                      <span className="font-mono-code font-semibold">
                        -₹{formCalculations.tdsAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {formCalculations.roundOff !== 0 && (
                    <div className="flex justify-between text-[var(--text-muted)]">
                      <span>Round Off:</span>
                      <span className="font-mono-code">
                        {formCalculations.roundOff > 0 ? '+' : ''}
                        ₹{formCalculations.roundOff.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-[var(--border-subtle)] flex justify-between items-baseline">
                    <span className="text-sm font-bold text-[var(--text-primary)]">
                      Net Accounts Payable:
                    </span>
                    <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono-code">
                      ₹{formCalculations.netPayable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  resetForm();
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
              >
                Cancel
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveInvoice('DRAFT')}
                  disabled={saveInvoiceMutation.isPending}
                  className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors disabled:opacity-50"
                >
                  Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveInvoice('SUBMITTED')}
                  disabled={saveInvoiceMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] text-white text-xs font-bold transition-colors flex items-center gap-1.5 shadow-md shadow-brand-500/20 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" /> Save & Submit for Approval
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* 3-WAY MATCH VERIFICATION & AUDIT MODAL                               */}
      {/* -------------------------------------------------------------------- */}
      {isDetailOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden my-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-[var(--text-primary)]">
                      3-Way Match Verification Audit: {selectedInvoice.invoiceNo}
                    </h3>
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        selectedInvoice.matchingStatus === 'MATCHED'
                          ? 'bg-emerald-500/15 text-emerald-600'
                          : 'bg-rose-500/15 text-rose-600'
                      }`}
                    >
                      {selectedInvoice.matchingStatus}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Audit trail comparing PO Contract, Inward QC Inspection, and Vendor Commercial Invoice.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Top Reference Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="rounded-xl border border-[var(--border-subtle)] p-3 bg-[var(--bg-surface)] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                    Supplier / Vendor
                  </span>
                  <p className="font-semibold text-xs text-[var(--text-primary)] truncate">
                    {selectedInvoice.vendorName}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)] font-mono-code">
                    GSTIN: {selectedInvoice.vendorGstin || 'Unregistered'}
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] p-3 bg-[var(--bg-surface)] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                    Vendor Bill Ref
                  </span>
                  <p className="font-mono-code font-bold text-xs text-[var(--brand-600)] dark:text-[var(--brand-400)]">
                    {selectedInvoice.vendorInvoiceNo}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Bill Date: {selectedInvoice.vendorInvoiceDate}
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] p-3 bg-[var(--bg-surface)] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                    Commercial Terms
                  </span>
                  <p className="font-semibold text-xs text-[var(--text-primary)]">
                    Due: {selectedInvoice.dueDate}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Credit: {selectedInvoice.paymentTermsDays} Days
                  </p>
                </div>

                <div className="rounded-xl border border-[var(--border-subtle)] p-3 bg-[var(--bg-surface)] space-y-1">
                  <span className="text-[10px] uppercase font-bold text-[var(--text-muted)]">
                    AP Balance Due
                  </span>
                  <p className="font-mono-code font-black text-sm text-emerald-600 dark:text-emerald-400">
                    ₹{selectedInvoice.balanceAmount.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Paid: ₹{selectedInvoice.paidAmount.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>

              {/* Line Items Audit Comparison Table */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                  Tri-Party Line Level Audit: PO vs GRN vs Vendor Bill
                </h4>
                <div className="rounded-xl border border-[var(--border-subtle)] overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)] text-[var(--text-muted)] font-bold">
                      <tr>
                        <th className="py-2.5 px-3">Item Description</th>
                        <th className="py-2.5 px-3 text-right">PO Qty</th>
                        <th className="py-2.5 px-3 text-right">QC Acc. Qty</th>
                        <th className="py-2.5 px-3 text-right">Billed Qty</th>
                        <th className="py-2.5 px-3 text-right">PO Rate (₹)</th>
                        <th className="py-2.5 px-3 text-right">Billed Rate (₹)</th>
                        <th className="py-2.5 px-3 text-right">Variance</th>
                        <th className="py-2.5 px-3 text-right">Taxable</th>
                        <th className="py-2.5 px-3 text-right">GST ITC</th>
                        <th className="py-2.5 px-3 text-right">Total Payable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)] bg-[var(--bg-surface)]">
                      {selectedInvoice.items?.map((it, idx) => {
                        const hasVar = Math.abs(it.rateVariance) > 0.01;
                        return (
                          <tr key={idx} className={hasVar ? 'bg-rose-500/5' : ''}>
                            <td className="py-2.5 px-3">
                              <p className="font-semibold text-[var(--text-primary)]">
                                {it.itemName || it.itemDescription}
                              </p>
                              <p className="text-[10px] text-[var(--text-muted)] font-mono-code">
                                {it.itemCode} • HSN {it.hsnCode}
                              </p>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-code text-[var(--text-muted)]">
                              {it.poQty}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-code text-emerald-600 dark:text-emerald-400 font-bold">
                              {it.acceptedQty}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-code font-bold">
                              {it.billedQty}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-code text-[var(--text-muted)]">
                              ₹{it.poRate.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-code font-bold">
                              ₹{it.invoicedRate.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-code">
                              {hasVar ? (
                                <span className="text-rose-600 font-bold">
                                  +₹{it.rateVariance.toFixed(2)}
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-semibold">Match</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-code">
                              ₹{it.taxableAmount.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-code text-[var(--brand-600)] dark:text-[var(--brand-400)]">
                              ₹{(it.cgstAmount + it.sgstAmount + it.igstAmount).toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono-code font-bold text-[var(--text-primary)]">
                              ₹{it.totalItemAmount.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Approval Info & Cancellation Reason if any */}
              {selectedInvoice.approvedByName && (
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                    <ShieldCheck className="h-4 w-4" /> AP Approved by {selectedInvoice.approvedByName}
                  </div>
                  <p className="text-[var(--text-muted)]">
                    Date: {selectedInvoice.approvedDate} • Remarks: {selectedInvoice.approvalRemarks}
                  </p>
                </div>
              )}

              {selectedInvoice.cancelReason && (
                <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-rose-800 dark:text-rose-300">
                    <AlertCircle className="h-4 w-4" /> Cancelled: {selectedInvoice.cancelReason}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
              >
                Close Audit
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsVoucherOpen(true);
                  }}
                  className="px-4 py-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors flex items-center gap-1.5"
                >
                  <Printer className="h-4 w-4" /> Print AP Voucher
                </button>
                {selectedInvoice.status === 'SUBMITTED' && (
                  <PermissionGate screen="PURCHASE_INVOICE" action="APPROVE">
                    <button
                      type="button"
                      onClick={() => {
                        setIsApproveOpen(true);
                      }}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
                    >
                      <ShieldCheck className="h-4 w-4" /> Approve Accounts Payable
                    </button>
                  </PermissionGate>
                )}
                {(selectedInvoice.status === 'APPROVED' || selectedInvoice.status === 'PARTIALLY_PAID') &&
                  selectedInvoice.paymentStatus !== 'PAID' && (
                    <PermissionGate screen="PURCHASE_INVOICE" action="APPROVE">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentAmount(selectedInvoice.balanceAmount);
                          setPaymentRefNo(`UTR-${Date.now().toString().slice(-6)}`);
                          setIsPaymentOpen(true);
                        }}
                        className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5"
                      >
                        <CreditCard className="h-4 w-4" /> Record AP Payment Clearance
                      </button>
                    </PermissionGate>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* AP APPROVAL MODAL                                                    */}
      {/* -------------------------------------------------------------------- */}
      {isApproveOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 text-emerald-600" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Approve Accounts Payable
                </h3>
              </div>
              <button
                onClick={() => setIsApproveOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-[var(--text-muted)] leading-relaxed">
                You are approving commercial invoice{' '}
                <strong className="text-[var(--text-primary)] font-mono-code">
                  {selectedInvoice.invoiceNo}
                </strong>{' '}
                from{' '}
                <strong className="text-[var(--text-primary)]">
                  {selectedInvoice.vendorName}
                </strong>{' '}
                for Accounts Payable clearance.
              </p>

              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Net Payable Amount:</span>
                  <span className="font-mono-code font-bold text-sm text-[var(--text-primary)]">
                    ₹{selectedInvoice.netPayableAmount.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">3-Way Match Status:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {selectedInvoice.matchingStatus}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Approval Remarks / Authorization Note
                </label>
                <textarea
                  rows={3}
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-xs text-[var(--text-primary)]"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <button
                type="button"
                onClick={() => setIsApproveOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  approveInvoiceMutation.mutate({
                    id: selectedInvoice.invoiceId,
                    approvalRemarks,
                  });
                }}
                disabled={approveInvoiceMutation.isPending}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                Confirm AP Approval
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* AP PAYMENT CLEARANCE MODAL                                           */}
      {/* -------------------------------------------------------------------- */}
      {isPaymentOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <CreditCard className="h-5 w-5 text-teal-600" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Record Accounts Payable Payment
                </h3>
              </div>
              <button
                onClick={() => setIsPaymentOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-[var(--text-muted)]">Outstanding Balance:</span>
                  <span className="font-mono-code font-bold text-sm text-rose-600 dark:text-rose-400">
                    ₹{selectedInvoice.balanceAmount.toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] text-[var(--text-muted)]">
                  <span>Vendor:</span>
                  <span>{selectedInvoice.vendorName}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Payment Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    max={selectedInvoice.balanceAmount}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-mono-code font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Payment Mode
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e: any) => setPaymentMode(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium"
                  >
                    <option value="NEFT">NEFT Transfer</option>
                    <option value="RTGS">RTGS</option>
                    <option value="CHEQUE">Corporate Cheque</option>
                    <option value="UPI">Corporate UPI</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    UTR / Reference # <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={paymentRefNo}
                    onChange={(e) => setPaymentRefNo(e.target.value)}
                    placeholder="UTR12345678"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-mono-code"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Clearance Date
                  </label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Bank Clearance Remarks
                </label>
                <input
                  type="text"
                  value={paymentRemarks}
                  onChange={(e) => setPaymentRemarks(e.target.value)}
                  placeholder="e.g. HDFC Current A/c remittance"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <button
                type="button"
                onClick={() => setIsPaymentOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (paymentAmount <= 0) {
                    alert('Please enter a valid payment amount.');
                    return;
                  }
                  if (!paymentRefNo.trim()) {
                    alert('Payment reference/UTR is mandatory.');
                    return;
                  }
                  recordPaymentMutation.mutate({
                    id: selectedInvoice.invoiceId,
                    paidAmount: paymentAmount,
                    paymentMode,
                    paymentRefNo: paymentRefNo.trim(),
                    paymentDate,
                    remarks: paymentRemarks,
                  });
                }}
                disabled={recordPaymentMutation.isPending}
                className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-500/20 disabled:opacity-50"
              >
                Clear AP Payment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* CANCEL MODAL                                                         */}
      {/* -------------------------------------------------------------------- */}
      {isCancelOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <XCircle className="h-5 w-5 text-rose-600" />
                <h3 className="text-base font-bold text-[var(--text-primary)]">
                  Cancel Purchase Invoice
                </h3>
              </div>
              <button
                onClick={() => setIsCancelOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <p className="text-[var(--text-muted)]">
                Are you sure you want to cancel invoice{' '}
                <strong className="text-[var(--text-primary)] font-mono-code">
                  {selectedInvoice.invoiceNo}
                </strong>
                ? This will permanently mark this commercial bill as cancelled.
              </p>
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Reason for Cancellation <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Duplicate billing from supplier / rate discrepancy unresolved..."
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2.5 text-xs text-[var(--text-primary)]"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <button
                type="button"
                onClick={() => setIsCancelOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text-muted)] hover:bg-[var(--bg-surface)]"
              >
                Keep Active
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!cancelReason.trim()) {
                    alert('Cancellation reason is mandatory.');
                    return;
                  }
                  cancelInvoiceMutation.mutate({
                    id: selectedInvoice.invoiceId,
                    cancelReason: cancelReason.trim(),
                  });
                }}
                disabled={cancelInvoiceMutation.isPending}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-500/20 disabled:opacity-50"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* PRINTABLE AP VOUCHER MODAL                                           */}
      {/* -------------------------------------------------------------------- */}
      {isVoucherOpen && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-4xl max-h-[94vh] flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-white text-slate-900 shadow-2xl overflow-hidden my-auto print:border-none print:shadow-none">
            {/* Action Bar (hidden on print) */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100 px-6 py-3 print:hidden">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Official Commercial AP Clearance Voucher
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <Printer className="h-3.5 w-3.5" /> Print Voucher
                </button>
                <button
                  onClick={() => setIsVoucherOpen(false)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Voucher Document Content */}
            <div className="p-8 space-y-6 text-xs overflow-y-auto">
              {/* Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">
                    KS-MFG ERP ENTERPRISE
                  </h1>
                  <p className="text-xs text-slate-600">
                    Kashvira Infotech Private Limited — Heavy Engineering Plant
                  </p>
                  <p className="text-[10px] text-slate-500">
                    GSTIN: 24AAACK9012J1Z3 • PAN: AAACK9012J • Sanand, Gujarat
                  </p>
                </div>
                <div className="text-right">
                  <span className="inline-block px-3 py-1 bg-slate-900 text-white font-black text-xs uppercase tracking-wider rounded">
                    PURCHASE INVOICE & AP VOUCHER
                  </span>
                  <p className="mt-1 font-mono-code font-bold text-sm text-slate-800">
                    {selectedInvoice.invoiceNo}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Booking Date: {selectedInvoice.invoiceDate}
                  </p>
                </div>
              </div>

              {/* Vendor & Cross Reference Details */}
              <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500">
                    SUPPLIER DETAILS
                  </span>
                  <p className="font-bold text-sm text-slate-900">{selectedInvoice.vendorName}</p>
                  <p className="text-[11px] text-slate-600">Code: {selectedInvoice.vendorCode}</p>
                  <p className="text-[11px] text-slate-600 font-mono-code">
                    GSTIN: {selectedInvoice.vendorGstin || 'Unregistered'}
                  </p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">
                    COMMERCIAL REFERENCES
                  </span>
                  <p className="text-xs">
                    <strong>Vendor Bill No:</strong> {selectedInvoice.vendorInvoiceNo} (Dated:{' '}
                    {selectedInvoice.vendorInvoiceDate})
                  </p>
                  <p className="text-xs">
                    <strong>PO Number:</strong> {selectedInvoice.poNumber || 'Direct Booking'}
                  </p>
                  <p className="text-xs">
                    <strong>Inward GRN:</strong> {selectedInvoice.grnNo || 'N/A'} (QC:{' '}
                    {selectedInvoice.qcNo || 'N/A'})
                  </p>
                  <p className="text-xs">
                    <strong>3-Way Matching:</strong>{' '}
                    <span className="font-bold text-emerald-700">
                      {selectedInvoice.matchingStatus}
                    </span>
                  </p>
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <table className="w-full text-left text-xs border border-slate-200">
                  <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-700">
                    <tr>
                      <th className="p-2 border-r border-slate-200">#</th>
                      <th className="p-2 border-r border-slate-200">Item Description</th>
                      <th className="p-2 text-right border-r border-slate-200">QC Acc.</th>
                      <th className="p-2 text-right border-r border-slate-200">Billed Qty</th>
                      <th className="p-2 text-right border-r border-slate-200">PO Rate</th>
                      <th className="p-2 text-right border-r border-slate-200">Inv. Rate</th>
                      <th className="p-2 text-right border-r border-slate-200">Taxable (₹)</th>
                      <th className="p-2 text-right border-r border-slate-200">GST</th>
                      <th className="p-2 text-right">Total (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {selectedInvoice.items?.map((it, idx) => (
                      <tr key={idx}>
                        <td className="p-2 border-r border-slate-200 text-slate-500 font-mono-code">
                          {idx + 1}
                        </td>
                        <td className="p-2 border-r border-slate-200">
                          <p className="font-bold text-slate-900">
                            {it.itemName || it.itemDescription}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {it.itemCode} • HSN: {it.hsnCode}
                          </p>
                        </td>
                        <td className="p-2 text-right border-r border-slate-200 font-mono-code">
                          {it.acceptedQty}
                        </td>
                        <td className="p-2 text-right border-r border-slate-200 font-mono-code font-bold">
                          {it.billedQty}
                        </td>
                        <td className="p-2 text-right border-r border-slate-200 font-mono-code">
                          ₹{it.poRate.toFixed(2)}
                        </td>
                        <td className="p-2 text-right border-r border-slate-200 font-mono-code font-bold">
                          ₹{it.invoicedRate.toFixed(2)}
                        </td>
                        <td className="p-2 text-right border-r border-slate-200 font-mono-code">
                          ₹{it.taxableAmount.toFixed(2)}
                        </td>
                        <td className="p-2 text-right border-r border-slate-200 font-mono-code">
                          {it.gstRate}%
                        </td>
                        <td className="p-2 text-right font-mono-code font-bold">
                          ₹{it.totalItemAmount.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Financial Totals */}
              <div className="flex justify-end">
                <div className="w-72 space-y-1.5 text-xs border border-slate-200 p-3 rounded-lg bg-slate-50">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Taxable Value:</span>
                    <span className="font-mono-code font-semibold">
                      ₹{selectedInvoice.taxableAmount.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">CGST + SGST ITC:</span>
                    <span className="font-mono-code font-semibold">
                      ₹{selectedInvoice.totalTaxAmount.toFixed(2)}
                    </span>
                  </div>
                  {selectedInvoice.tdsAmount > 0 && (
                    <div className="flex justify-between text-rose-700">
                      <span>Less TDS Withholding:</span>
                      <span className="font-mono-code">
                        -₹{selectedInvoice.tdsAmount.toFixed(2)}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-slate-300 pt-1.5 flex justify-between font-bold text-sm">
                    <span>Net Accounts Payable:</span>
                    <span className="font-mono-code text-slate-900">
                      ₹{selectedInvoice.netPayableAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="grid grid-cols-3 gap-6 pt-12 text-center text-xs">
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-800">
                    {selectedInvoice.createdByName || 'Commercial Executive'}
                  </p>
                  <p className="text-[10px] text-slate-500">Prepared & Matched By</p>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-800">Finance & Tax Auditor</p>
                  <p className="text-[10px] text-slate-500">GST ITC & TDS Verified</p>
                </div>
                <div className="border-t border-slate-400 pt-2">
                  <p className="font-bold text-slate-800">
                    {selectedInvoice.approvedByName || 'Authorized Signatory'}
                  </p>
                  <p className="text-[10px] text-slate-500">AP Clearance Approved</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------------- */}
      {/* CONFIRM DELETE MODAL                                                 */}
      {/* -------------------------------------------------------------------- */}
      <ConfirmDeleteModal
        isOpen={isDeleteOpen}
        entityType="Purchase Invoice"
        entityName={selectedInvoice?.invoiceNo || ''}
        entityCode={selectedInvoice?.vendorInvoiceNo}
        isDeleting={deleteInvoiceMutation.isPending}
        dependencies={[]}
        onConfirm={() => {
          if (selectedInvoice) {
            deleteInvoiceMutation.mutate(selectedInvoice.invoiceId);
          }
        }}
        onClose={() => {
          setIsDeleteOpen(false);
          setSelectedInvoice(null);
        }}
      />
    </div>
  );
};
