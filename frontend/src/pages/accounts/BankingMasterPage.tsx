import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Landmark,
  Layers,
  Plus,
  Printer,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
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
import { PermissionGate } from '../../components/common/PermissionGate';

// ============================================================================
// Types
// ============================================================================
export interface BankAccountRecord {
  bank_account_id: number;
  account_code: string;
  account_name: string;
  bank_name: string;
  branch_name: string;
  account_number: string;
  account_type: 'CURRENT' | 'SAVINGS' | 'CASH_CREDIT' | 'OVERDRAFT' | 'PETTY_CASH';
  ifsc_code?: string;
  swift_code?: string;
  currency_code: string;
  gl_account_id: number;
  gl_account_code?: string;
  gl_account_name?: string;
  opening_balance: string | number;
  current_balance: string | number;
  od_limit: string | number;
  is_active: boolean;
}

export interface PaymentDisbursementRecord {
  disbursement_id: number;
  voucher_no: string;
  voucher_date: string;
  bank_account_id: number;
  bank_account_name?: string;
  bank_account_number?: string;
  party_id: number;
  vendor_name?: string;
  vendor_pan?: string;
  payment_mode: string;
  payment_ref_no: string;
  instrument_date?: string;
  cheque_clearance_status: string;
  clearance_date?: string;
  total_gross_settled: string | number;
  total_tds_deducted: string | number;
  total_discount_received: string | number;
  total_net_paid: string | number;
  narration: string;
  status: string;
  posted_journal_id?: number;
  journal_voucher_no?: string;
  created_date?: string;
}

export interface CustomerReceiptRecord {
  receipt_id: number;
  receipt_no: string;
  receipt_date: string;
  bank_account_id: number;
  bank_account_name?: string;
  bank_account_number?: string;
  party_id: number;
  customer_name?: string;
  customer_pan?: string;
  receipt_mode: string;
  instrument_ref_no: string;
  instrument_date?: string;
  clearance_status: string;
  clearance_date?: string;
  total_gross_settled: string | number;
  total_tds_deducted_by_cust: string | number;
  total_discount_given: string | number;
  total_net_received: string | number;
  narration: string;
  status: string;
  posted_journal_id?: number;
  journal_voucher_no?: string;
  created_date?: string;
}

export interface BankStatementLineRecord {
  statement_line_id: number;
  bank_account_id: number;
  txn_date: string;
  value_date: string;
  description: string;
  ref_cheque_no?: string;
  debit_withdrawal: string | number;
  credit_deposit: string | number;
  running_balance: string | number;
  reconciliation_status: 'UNRECONCILED' | 'MATCHED' | 'MANUALLY_ADJUSTED';
  matched_entity_type?: string;
  matched_entity_id?: number;
  reconciled_date?: string;
}

export interface BrsSummary {
  bankAccountId: number;
  bankAccountName: string;
  accountNumber: string;
  cutoffDate: string;
  glBookBalance: number;
  unpresentedTotal: number;
  unpresentedCheques: Array<{
    disbursement_id: number;
    voucher_no: string;
    voucher_date: string;
    vendor_name: string;
    payment_ref_no: string;
    total_net_paid: string | number;
  }>;
  uncreditedTotal: number;
  uncreditedDeposits: Array<{
    receipt_id: number;
    receipt_no: string;
    receipt_date: string;
    customer_name: string;
    instrument_ref_no: string;
    total_net_received: string | number;
  }>;
  computedBankBalance: number;
  actualStatementBalance: number;
  varianceAmount: number;
  isBalanced: boolean;
}

export interface PartyLookup {
  party_id: number;
  party_code: string;
  party_name: string;
  is_supplier: boolean;
  is_customer: boolean;
  pan_no?: string;
  credit_days?: number;
}

export interface PendingPurchaseInvoice {
  invoice_id: number;
  invoice_no: string;
  invoice_date: string;
  vendor_invoice_no: string;
  vendor_invoice_date: string;
  due_date: string;
  net_payable_amount: string | number;
  paid_amount: string | number;
  balance_amount: string | number;
  payment_status: string;
}

export interface PendingSalesInvoice {
  invoice_id: number;
  invoice_no: string;
  invoice_date: string;
  total_invoice_amount: string | number;
  paid_amount: string | number;
  balance_amount: string | number;
  payment_status: string;
}

export const BankingMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'accounts' | 'ap' | 'ar' | 'brs'>('accounts');

  // Filters
  const [selectedBankId, setSelectedBankId] = useState<number | 'ALL'>('ALL');
  const [selectedPartyId, setSelectedPartyId] = useState<number | 'ALL'>('ALL');
  const [brsCutoffDate, setBrsCutoffDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [brsBankId, setBrsBankId] = useState<number>(1001);

  // Modals
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isDisbursementModalOpen, setIsDisbursementModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isImportFeedModalOpen, setIsImportFeedModalOpen] = useState(false);
  const [viewDisbursement, setViewDisbursement] = useState<any | null>(null);
  const [viewReceipt, setViewReceipt] = useState<any | null>(null);

  // Form States - New Bank Account
  const [accountForm, setAccountForm] = useState({
    accountCode: '',
    accountName: '',
    bankName: '',
    branchName: '',
    accountNumber: '',
    accountType: 'CURRENT' as const,
    ifscCode: '',
    swiftCode: '',
    glAccountId: 1101,
    openingBalance: 0,
    odLimit: 0,
  });

  // Form States - Vendor Payment
  const [disbVendorId, setDisbVendorId] = useState<number | null>(null);
  const [disbBankId, setDisbBankId] = useState<number>(1001);
  const [disbMode, setDisbMode] = useState<string>('NEFT');
  const [disbRefNo, setDisbRefNo] = useState<string>('');
  const [disbDate, setDisbDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [disbClearanceStatus, setDisbClearanceStatus] = useState<string>('CLEARED');
  const [disbNarration, setDisbNarration] = useState<string>('');
  const [disbTdsSection, setDisbTdsSection] = useState<string>('194Q');
  const [disbTdsRate, setDisbTdsRate] = useState<number>(0.1);
  const [selectedInvoices, setSelectedInvoices] = useState<
    Record<number, { selected: boolean; settledAmount: number }>
  >({});

  // Form States - Customer Receipt
  const [recCustomerId, setRecCustomerId] = useState<number | null>(null);
  const [recBankId, setRecBankId] = useState<number>(1001);
  const [recMode, setRecMode] = useState<string>('NEFT');
  const [recRefNo, setRecRefNo] = useState<string>('');
  const [recDate, setRecDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [recClearanceStatus, setRecClearanceStatus] = useState<string>('CLEARED');
  const [recNarration, setRecNarration] = useState<string>('');
  const [recCustTdsAmount, setRecCustTdsAmount] = useState<number>(0);
  const [recDiscountAmount, setRecDiscountAmount] = useState<number>(0);
  const [selectedSalesInvoices, setSelectedSalesInvoices] = useState<
    Record<number, { selected: boolean; settledAmount: number }>
  >({});

  // Form States - Import Feed Line
  const [feedForm, setFeedForm] = useState({
    txnDate: new Date().toISOString().slice(0, 10),
    description: '',
    refChequeNo: '',
    debitWithdrawal: 0,
    creditDeposit: 0,
    runningBalance: 0,
  });

  // ============================================================================
  // Queries
  // ============================================================================
  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ['banking-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>('/api/v1/accounts/banking/summary');
      return res.data?.data;
    },
  });

  const { data: lookups } = useQuery({
    queryKey: ['banking-lookups'],
    queryFn: async () => {
      const res = await apiClient.get<
        ApiResponse<{
          parties: PartyLookup[];
          bankAccounts: BankAccountRecord[];
          glAccounts: Array<{ account_id: number; account_code: string; account_name: string }>;
        }>
      >('/api/v1/accounts/banking/lookups');
      return res.data?.data;
    },
  });

  const { data: bankAccountsList = [], isLoading: isAccountsLoading } = useQuery({
    queryKey: ['banking-accounts'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<BankAccountRecord[]>>(
        '/api/v1/accounts/banking/bank-accounts',
      );
      return res.data?.data || [];
    },
  });

  const { data: disbursementsList = [], isLoading: isDisbursementsLoading } = useQuery({
    queryKey: ['banking-disbursements', selectedBankId, selectedPartyId],
    queryFn: async () => {
      const params: any = {};
      if (selectedBankId !== 'ALL') params.bankAccountId = selectedBankId;
      if (selectedPartyId !== 'ALL') params.partyId = selectedPartyId;
      const res = await apiClient.get<ApiResponse<PaymentDisbursementRecord[]>>(
        '/api/v1/accounts/banking/disbursements',
        { params },
      );
      return res.data?.data || [];
    },
  });

  const { data: receiptsList = [], isLoading: isReceiptsLoading } = useQuery({
    queryKey: ['banking-receipts', selectedBankId, selectedPartyId],
    queryFn: async () => {
      const params: any = {};
      if (selectedBankId !== 'ALL') params.bankAccountId = selectedBankId;
      if (selectedPartyId !== 'ALL') params.partyId = selectedPartyId;
      const res = await apiClient.get<ApiResponse<CustomerReceiptRecord[]>>(
        '/api/v1/accounts/banking/receipts',
        { params },
      );
      return res.data?.data || [];
    },
  });

  // Pending Purchase Invoices for selected vendor
  const { data: pendingPurchaseInvoices = [] } = useQuery({
    queryKey: ['pending-pur-invoices', disbVendorId],
    queryFn: async () => {
      if (!disbVendorId) return [];
      const res = await apiClient.get<ApiResponse<PendingPurchaseInvoice[]>>(
        `/api/v1/accounts/banking/pending-purchase-invoices?partyId=${disbVendorId}`,
      );
      return res.data?.data || [];
    },
    enabled: !!disbVendorId,
  });

  // Pending Sales Invoices for selected customer
  const { data: pendingSalesInvoices = [] } = useQuery({
    queryKey: ['pending-sales-invoices', recCustomerId],
    queryFn: async () => {
      if (!recCustomerId) return [];
      const res = await apiClient.get<ApiResponse<PendingSalesInvoice[]>>(
        `/api/v1/accounts/banking/pending-sales-invoices?partyId=${recCustomerId}`,
      );
      return res.data?.data || [];
    },
    enabled: !!recCustomerId,
  });

  // BRS Reconciliation Summary & Statement Feed
  const { data: brsSummary, isLoading: isBrsSummaryLoading, refetch: refetchBrsSummary } = useQuery({
    queryKey: ['brs-summary', brsBankId, brsCutoffDate],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<BrsSummary>>(
        `/api/v1/accounts/banking/brs/reconciliation-summary?bankAccountId=${brsBankId}&cutoffDate=${brsCutoffDate}`,
      );
      return res.data?.data;
    },
  });

  const { data: statementLines = [], refetch: refetchStatementLines } = useQuery({
    queryKey: ['brs-statements', brsBankId],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<BankStatementLineRecord[]>>(
        `/api/v1/accounts/banking/brs/statement-lines?bankAccountId=${brsBankId}`,
      );
      return res.data?.data || [];
    },
  });

  // ============================================================================
  // Calculations for Vendor Disbursement Modal
  // ============================================================================
  const disbGrossSettled = useMemo(() => {
    let sum = 0;
    Object.entries(selectedInvoices).forEach(([invId, state]) => {
      if (state.selected) sum += Number(state.settledAmount || 0);
    });
    return Math.round(sum * 100) / 100;
  }, [selectedInvoices]);

  const disbTdsAmount = useMemo(() => {
    if (!disbTdsRate || disbTdsRate <= 0) return 0;
    return Math.round(disbGrossSettled * (disbTdsRate / 100) * 100) / 100;
  }, [disbGrossSettled, disbTdsRate]);

  const disbNetPaid = useMemo(() => {
    return Math.max(0, Math.round((disbGrossSettled - disbTdsAmount) * 100) / 100);
  }, [disbGrossSettled, disbTdsAmount]);

  // ============================================================================
  // Calculations for Customer Collection Modal
  // ============================================================================
  const recGrossSettled = useMemo(() => {
    let sum = 0;
    Object.entries(selectedSalesInvoices).forEach(([invId, state]) => {
      if (state.selected) sum += Number(state.settledAmount || 0);
    });
    return Math.round(sum * 100) / 100;
  }, [selectedSalesInvoices]);

  const recNetReceived = useMemo(() => {
    const net = recGrossSettled - Number(recCustTdsAmount || 0) - Number(recDiscountAmount || 0);
    return Math.max(0, Math.round(net * 100) / 100);
  }, [recGrossSettled, recCustTdsAmount, recDiscountAmount]);

  // ============================================================================
  // Mutations
  // ============================================================================
  const createAccountMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post<ApiResponse<any>>(
        '/api/v1/accounts/banking/bank-accounts',
        data,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banking-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['banking-summary'] });
      queryClient.invalidateQueries({ queryKey: ['banking-lookups'] });
      setIsAddAccountModalOpen(false);
    },
  });

  const createDisbursementMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post<ApiResponse<any>>(
        '/api/v1/accounts/banking/disbursements',
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banking-disbursements'] });
      queryClient.invalidateQueries({ queryKey: ['banking-summary'] });
      queryClient.invalidateQueries({ queryKey: ['banking-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['pending-pur-invoices'] });
      setIsDisbursementModalOpen(false);
      setSelectedInvoices({});
      setDisbRefNo('');
      setDisbNarration('');
    },
  });

  const createReceiptMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post<ApiResponse<any>>(
        '/api/v1/accounts/banking/receipts',
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banking-receipts'] });
      queryClient.invalidateQueries({ queryKey: ['banking-summary'] });
      queryClient.invalidateQueries({ queryKey: ['banking-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['pending-sales-invoices'] });
      setIsReceiptModalOpen(false);
      setSelectedSalesInvoices({});
      setRecRefNo('');
      setRecNarration('');
      setRecCustTdsAmount(0);
      setRecDiscountAmount(0);
    },
  });

  const importFeedMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post<ApiResponse<any>>(
        '/api/v1/accounts/banking/brs/import-feed',
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      refetchStatementLines();
      refetchBrsSummary();
      setIsImportFeedModalOpen(false);
    },
  });

  const autoMatchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiResponse<any>>(
        '/api/v1/accounts/banking/brs/auto-match',
        { bankAccountId: brsBankId },
      );
      return res.data;
    },
    onSuccess: (data) => {
      refetchStatementLines();
      refetchBrsSummary();
      queryClient.invalidateQueries({ queryKey: ['banking-summary'] });
      alert(`Auto-Reconciliation complete! Matched ${data?.data?.matchedCount || 0} transaction items.`);
    },
  });

  const finalizeBrsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<ApiResponse<any>>(
        '/api/v1/accounts/banking/brs/finalize',
        { bankAccountId: brsBankId, cutoffDate: brsCutoffDate },
      );
      return res.data;
    },
    onSuccess: () => {
      refetchBrsSummary();
      alert('Statutory BRS Statement finalized and logged to compliance register!');
    },
  });

  // Handlers for selection
  const handleSelectInvoice = (inv: PendingPurchaseInvoice) => {
    setSelectedInvoices((prev) => {
      const isCur = prev[inv.invoice_id]?.selected;
      return {
        ...prev,
        [inv.invoice_id]: {
          selected: !isCur,
          settledAmount: !isCur ? Number(inv.balance_amount) : 0,
        },
      };
    });
  };

  const handleSelectSalesInvoice = (inv: PendingSalesInvoice) => {
    setSelectedSalesInvoices((prev) => {
      const isCur = prev[inv.invoice_id]?.selected;
      return {
        ...prev,
        [inv.invoice_id]: {
          selected: !isCur,
          settledAmount: !isCur ? Number(inv.balance_amount) : 0,
        },
      };
    });
  };

  const handleTdsSectionChange = (section: string) => {
    setDisbTdsSection(section);
    if (section === '194Q') setDisbTdsRate(0.1);
    else if (section === '194C_INDIV') setDisbTdsRate(1.0);
    else if (section === '194C_CO') setDisbTdsRate(2.0);
    else if (section === '194J') setDisbTdsRate(10.0);
    else setDisbTdsRate(0.0);
  };

  const handleSubmitDisbursement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disbVendorId) {
      alert('Please select a vendor.');
      return;
    }
    if (disbNetPaid <= 0) {
      alert('Please select at least one purchase invoice with settled amount > 0.');
      return;
    }
    if (!disbRefNo) {
      alert('Please enter a Payment Reference / UTR Number.');
      return;
    }

    const items = Object.entries(selectedInvoices)
      .filter(([_, state]) => state.selected && state.settledAmount > 0)
      .map(([invId, state]) => {
        const inv = pendingPurchaseInvoices.find((i) => i.invoice_id === Number(invId));
        const lineGross = Number(state.settledAmount);
        const lineTds =
          disbTdsRate > 0
            ? Math.round(lineGross * (disbTdsRate / 100) * 100) / 100
            : 0;
        const lineNet = Math.round((lineGross - lineTds) * 100) / 100;
        return {
          invoiceId: Number(invId),
          invoiceNo: inv?.invoice_no,
          invoiceDate: inv?.invoice_date,
          grossSettledAmount: lineGross,
          tdsSection: disbTdsSection,
          tdsRate: disbTdsRate,
          tdsDeductedAmount: lineTds,
          discountReceivedAmount: 0,
          netPaidAmount: lineNet,
        };
      });

    createDisbursementMutation.mutate({
      voucherDate: disbDate,
      bankAccountId: disbBankId,
      partyId: disbVendorId,
      paymentMode: disbMode,
      paymentRefNo: disbRefNo,
      chequeClearanceStatus: disbClearanceStatus,
      totalGrossSettled: disbGrossSettled,
      totalTdsDeducted: disbTdsAmount,
      totalDiscountReceived: 0,
      totalNetPaid: disbNetPaid,
      narration: disbNarration || `AP Payment to Vendor via ${disbMode} Ref: ${disbRefNo}`,
      items,
    });
  };

  const handleSubmitReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recCustomerId) {
      alert('Please select a customer.');
      return;
    }
    if (recNetReceived <= 0) {
      alert('Please select at least one sales invoice with settled amount > 0.');
      return;
    }
    if (!recRefNo) {
      alert('Please enter an Instrument / UTR / Cheque Reference Number.');
      return;
    }

    const items = Object.entries(selectedSalesInvoices)
      .filter(([_, state]) => state.selected && state.settledAmount > 0)
      .map(([invId, state]) => {
        const inv = pendingSalesInvoices.find((i) => i.invoice_id === Number(invId));
        return {
          invoiceId: Number(invId),
          invoiceNo: inv?.invoice_no,
          invoiceDate: inv?.invoice_date,
          grossSettledAmount: Number(state.settledAmount),
          tdsDeductedByCust: 0,
          discountGivenAmount: 0,
          netReceivedAmount: Number(state.settledAmount),
        };
      });

    createReceiptMutation.mutate({
      receiptDate: recDate,
      bankAccountId: recBankId,
      partyId: recCustomerId,
      receiptMode: recMode,
      instrumentRefNo: recRefNo,
      clearanceStatus: recClearanceStatus,
      totalGrossSettled: recGrossSettled,
      totalTdsDeductedByCust: Number(recCustTdsAmount || 0),
      totalDiscountGiven: Number(recDiscountAmount || 0),
      totalNetReceived: recNetReceived,
      narration: recNarration || `AR Customer Collection via ${recMode} Ref: ${recRefNo}`,
      items,
    });
  };

  // ============================================================================
  // Table Columns
  // ============================================================================
  const bankColumns: MasterTableColumn<BankAccountRecord>[] = [
    {
      key: 'account_code',
      header: 'Account Code',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-blue-700">{r.account_code}</span>,
    },
    {
      key: 'account_name',
      header: 'Account Name',
      sortable: true,
      render: (r) => (
        <div>
          <div className="font-semibold text-gray-900">{r.account_name}</div>
          <div className="text-xs text-gray-500">{r.bank_name} - {r.branch_name}</div>
        </div>
      ),
    },
    {
      key: 'account_number',
      header: 'Account Number',
      render: (r) => <span className="font-mono text-gray-800">{r.account_number}</span>,
    },
    {
      key: 'account_type',
      header: 'Type',
      render: (r) => {
        const badgeColors: Record<string, string> = {
          CURRENT: 'bg-emerald-100 text-emerald-800 border-emerald-200',
          CASH_CREDIT: 'bg-purple-100 text-purple-800 border-purple-200',
          PETTY_CASH: 'bg-amber-100 text-amber-800 border-amber-200',
          SAVINGS: 'bg-blue-100 text-blue-800 border-blue-200',
          OVERDRAFT: 'bg-rose-100 text-rose-800 border-rose-200',
        };
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${badgeColors[r.account_type] || 'bg-gray-100 text-gray-800'}`}
          >
            {r.account_type.replace('_', ' ')}
          </span>
        );
      },
    },
    {
      key: 'gl_account_name',
      header: 'GL Mapping',
      render: (r) => (
        <span className="text-xs text-gray-600">
          [{r.gl_account_code || r.gl_account_id}] {r.gl_account_name || 'GL Account'}
        </span>
      ),
    },
    {
      key: 'current_balance',
      header: 'Current Book Balance',
      align: 'right',
      sortable: true,
      render: (r) => (
        <span
          className={`font-mono font-bold text-sm ${Number(r.current_balance) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
        >
          ₹{Number(r.current_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'od_limit',
      header: 'CC/OD Limit',
      align: 'right',
      render: (r) =>
        Number(r.od_limit) > 0 ? (
          <span className="font-mono text-xs text-purple-700 font-semibold">
            ₹{Number(r.od_limit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        ) : (
          <span className="text-gray-400 text-xs">—</span>
        ),
    },
  ];

  const disbColumns: MasterTableColumn<PaymentDisbursementRecord>[] = [
    {
      key: 'voucher_no',
      header: 'Voucher No',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-blue-700">{r.voucher_no}</span>,
    },
    {
      key: 'voucher_date',
      header: 'Date',
      sortable: true,
      render: (r) => (
        <span className="text-gray-700 text-xs">
          {r.voucher_date ? new Date(r.voucher_date).toLocaleDateString('en-GB') : '—'}
        </span>
      ),
    },
    {
      key: 'vendor_name',
      header: 'Vendor / Creditor',
      sortable: true,
      render: (r) => (
        <div>
          <div className="font-semibold text-gray-900 text-sm">{r.vendor_name || 'Vendor'}</div>
          {r.vendor_pan && <div className="text-xs text-gray-500 font-mono">PAN: {r.vendor_pan}</div>}
        </div>
      ),
    },
    {
      key: 'bank_account_name',
      header: 'Bank Account',
      render: (r) => <span className="text-xs text-gray-700">{r.bank_account_name}</span>,
    },
    {
      key: 'payment_mode',
      header: 'Mode & Ref',
      render: (r) => (
        <div>
          <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-800 mr-1.5">
            {r.payment_mode}
          </span>
          <span className="font-mono text-xs text-gray-700">{r.payment_ref_no}</span>
        </div>
      ),
    },
    {
      key: 'total_gross_settled',
      header: 'Gross Bill',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-xs text-gray-700">
          ₹{Number(r.total_gross_settled).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'total_tds_deducted',
      header: 'TDS (194Q/C)',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-xs text-rose-600 font-semibold">
          ₹{Number(r.total_tds_deducted).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'total_net_paid',
      header: 'Net Payout',
      align: 'right',
      sortable: true,
      render: (r) => (
        <span className="font-mono font-bold text-sm text-emerald-700">
          ₹{Number(r.total_net_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => {
        const isPosted = r.status === 'POSTED';
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${isPosted ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800'}`}
          >
            {r.status}
          </span>
        );
      },
    },
    {
      key: 'disbursement_id',
      header: 'Actions',
      align: 'center',
      render: (r) => (
        <button
          onClick={() => setViewDisbursement(r)}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold p-1 hover:bg-blue-50 rounded"
          title="Print Payment Advice"
        >
          <Printer className="w-3.5 h-3.5" />
          Advice
        </button>
      ),
    },
  ];

  const recColumns: MasterTableColumn<CustomerReceiptRecord>[] = [
    {
      key: 'receipt_no',
      header: 'Receipt No',
      sortable: true,
      render: (r) => <span className="font-mono font-bold text-blue-700">{r.receipt_no}</span>,
    },
    {
      key: 'receipt_date',
      header: 'Date',
      sortable: true,
      render: (r) => (
        <span className="text-gray-700 text-xs">
          {r.receipt_date ? new Date(r.receipt_date).toLocaleDateString('en-GB') : '—'}
        </span>
      ),
    },
    {
      key: 'customer_name',
      header: 'Customer / Debtor',
      sortable: true,
      render: (r) => (
        <div>
          <div className="font-semibold text-gray-900 text-sm">{r.customer_name || 'Customer'}</div>
          {r.customer_pan && <div className="text-xs text-gray-500 font-mono">PAN: {r.customer_pan}</div>}
        </div>
      ),
    },
    {
      key: 'bank_account_name',
      header: 'Deposited In',
      render: (r) => <span className="text-xs text-gray-700">{r.bank_account_name}</span>,
    },
    {
      key: 'receipt_mode',
      header: 'Instrument',
      render: (r) => (
        <div>
          <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-800 mr-1.5">
            {r.receipt_mode}
          </span>
          <span className="font-mono text-xs text-gray-700">{r.instrument_ref_no}</span>
        </div>
      ),
    },
    {
      key: 'clearance_status',
      header: 'Clearance',
      render: (r) => {
        const isCleared = r.clearance_status === 'CLEARED';
        const isUncleared = r.clearance_status === 'UNCLEARED';
        return (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${isCleared ? 'bg-emerald-100 text-emerald-800' : isUncleared ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-rose-100 text-rose-800'}`}
          >
            {isCleared ? 'CLEARED' : isUncleared ? 'IN TRANSIT (BRS)' : 'BOUNCED'}
          </span>
        );
      },
    },
    {
      key: 'total_gross_settled',
      header: 'Gross Settled',
      align: 'right',
      render: (r) => (
        <span className="font-mono text-xs text-gray-700">
          ₹{Number(r.total_gross_settled).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'total_net_received',
      header: 'Net Received',
      align: 'right',
      sortable: true,
      render: (r) => (
        <span className="font-mono font-bold text-sm text-emerald-700">
          ₹{Number(r.total_net_received).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
    },
    {
      key: 'receipt_id',
      header: 'Actions',
      align: 'center',
      render: (r) => (
        <button
          onClick={() => setViewReceipt(r)}
          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-semibold p-1 hover:bg-blue-50 rounded"
          title="Print Official Receipt"
        >
          <Printer className="w-3.5 h-3.5" />
          Receipt
        </button>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Title & Executive Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Banking, AP/AR & Bank Reconciliation (BRS)
              </h1>
              <p className="text-sm text-gray-500">
                Vendor Payments with Statutory TDS, Customer Collections & Real-time BRS Engine
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <PermissionGate screen="BANKING_ACCOUNTS" action="DISBURSE">
            <button
              onClick={() => {
                setDisbVendorId(null);
                setSelectedInvoices({});
                setIsDisbursementModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-rose-700 hover:bg-rose-800 text-white text-sm font-semibold rounded-lg shadow-sm transition"
            >
              <ArrowUpRight className="w-4 h-4" />
              Pay Vendor (AP)
            </button>
          </PermissionGate>

          <PermissionGate screen="BANKING_ACCOUNTS" action="RECEIVE">
            <button
              onClick={() => {
                setRecCustomerId(null);
                setSelectedSalesInvoices({});
                setIsReceiptModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg shadow-sm transition"
            >
              <ArrowDownLeft className="w-4 h-4" />
              Receive Payment (AR)
            </button>
          </PermissionGate>

          <PermissionGate screen="BANKING_ACCOUNTS" action="ADD">
            <button
              onClick={() => setIsAddAccountModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-semibold rounded-lg border border-gray-300 transition"
            >
              <Plus className="w-4 h-4" />
              Add Bank Account
            </button>
          </PermissionGate>

          <PermissionGate screen="BANKING_ACCOUNTS" action="RECONCILE">
            <button
              onClick={() => autoMatchMutation.mutate()}
              disabled={autoMatchMutation.isPending}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg shadow-sm transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${autoMatchMutation.isPending ? 'animate-spin' : ''}`} />
              Auto-Match (BRS)
            </button>
          </PermissionGate>
        </div>
      </div>

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Total Liquid Funds */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between opacity-80 text-xs font-semibold uppercase tracking-wider">
            <span>Total Liquid Bank Balance</span>
            <Wallet className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono mt-2">
            ₹{(summary?.totalLiquidity || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs mt-2 opacity-90 flex items-center justify-between">
            <span>Across {summary?.totalAccounts || 3} Active Accounts</span>
            <span className="bg-emerald-400 bg-opacity-30 px-2 py-0.5 rounded text-[11px] font-semibold">
              Live Book Balance
            </span>
          </div>
        </div>

        {/* Card 2: Accounts Payable (AP) Due */}
        <div className="bg-gradient-to-br from-rose-500 to-red-700 text-white p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between opacity-80 text-xs font-semibold uppercase tracking-wider">
            <span>Accounts Payable (AP) Due</span>
            <TrendingDown className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono mt-2">
            ₹{(summary?.totalApDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs mt-2 opacity-90 flex items-center justify-between">
            <span>{summary?.openPurchaseInvoices || 0} Open Supplier Invoices</span>
            <span className="bg-rose-400 bg-opacity-30 px-2 py-0.5 rounded text-[11px] font-semibold">
              Creditors Control
            </span>
          </div>
        </div>

        {/* Card 3: Accounts Receivable (AR) Due */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-800 text-white p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between opacity-80 text-xs font-semibold uppercase tracking-wider">
            <span>Accounts Receivable (AR) Due</span>
            <TrendingUp className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono mt-2">
            ₹{(summary?.totalArDue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs mt-2 opacity-90 flex items-center justify-between">
            <span>{summary?.openSalesInvoices || 0} Open Customer Invoices</span>
            <span className="bg-blue-400 bg-opacity-30 px-2 py-0.5 rounded text-[11px] font-semibold">
              Debtors Control
            </span>
          </div>
        </div>

        {/* Card 4: BRS Status */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-700 text-white p-5 rounded-xl shadow-sm">
          <div className="flex items-center justify-between opacity-80 text-xs font-semibold uppercase tracking-wider">
            <span>BRS In-Transit Items</span>
            <Scale className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono mt-2">
            {summary?.unclearedChequesCount || 0} In-Transit Cheque(s)
          </div>
          <div className="text-xs mt-2 opacity-90 flex items-center justify-between">
            <span>{summary?.unreconciledFeedCount || 0} Unmatched Stmt Feed Lines</span>
            <span className="bg-amber-300 bg-opacity-30 px-2 py-0.5 rounded text-[11px] font-semibold">
              BRS Pipeline
            </span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-gray-200 bg-white px-4 pt-2 rounded-t-xl">
        <button
          onClick={() => setActiveTab('accounts')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition ${activeTab === 'accounts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Building2 className="w-4 h-4" />
          Bank & Cash Accounts ({bankAccountsList.length})
        </button>

        <button
          onClick={() => setActiveTab('ap')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition ${activeTab === 'ap' ? 'border-rose-600 text-rose-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <ArrowUpRight className="w-4 h-4" />
          Vendor Payments (AP) ({disbursementsList.length})
        </button>

        <button
          onClick={() => setActiveTab('ar')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition ${activeTab === 'ar' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <ArrowDownLeft className="w-4 h-4" />
          Customer Collections (AR) ({receiptsList.length})
        </button>

        <button
          onClick={() => setActiveTab('brs')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-sm border-b-2 transition ${activeTab === 'brs' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Scale className="w-4 h-4" />
          Bank Reconciliation (BRS)
        </button>
      </div>

      {/* TAB 1: Bank & Cash Accounts */}
      {activeTab === 'accounts' && (
        <div className="space-y-6">
          {/* Card View of Primary Accounts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {bankAccountsList.map((acc) => (
              <div
                key={acc.bank_account_id}
                className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-gray-500">
                    {acc.account_code}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800">
                    {acc.account_type.replace('_', ' ')}
                  </span>
                </div>
                <h3 className="text-base font-bold text-gray-900 mt-2">{acc.account_name}</h3>
                <p className="text-xs text-gray-500">{acc.bank_name}</p>
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-gray-400 block uppercase">Account No</span>
                    <span className="font-mono text-xs font-semibold text-gray-800">
                      {acc.account_number}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-gray-400 block uppercase">Book Balance</span>
                    <span className="font-mono text-base font-bold text-emerald-700">
                      ₹{Number(acc.current_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Master Data Table */}
          <MasterDataTable
            columns={bankColumns}
            data={bankAccountsList}
            isLoading={isAccountsLoading}
            searchPredicate={(row, q) =>
              row.account_code.toLowerCase().includes(q.toLowerCase()) ||
              row.account_name.toLowerCase().includes(q.toLowerCase()) ||
              row.bank_name.toLowerCase().includes(q.toLowerCase()) ||
              row.account_number.toLowerCase().includes(q.toLowerCase())
            }
            title="Corporate Bank & Cash Accounts Master"
            subtitle="Authoritative repository of active bank facilities, current accounts, CC lines, and cash safe floats"
            screenCode="BANKING_ACCOUNTS"
            rowKey={(r) => r.bank_account_id}
          />
        </div>
      )}

      {/* TAB 2: Vendor Payments (AP) */}
      {activeTab === 'ap' && (
        <div className="space-y-4">
          <MasterDataTable
            columns={disbColumns}
            data={disbursementsList}
            isLoading={isDisbursementsLoading}
            searchPredicate={(row, q) =>
              row.voucher_no.toLowerCase().includes(q.toLowerCase()) ||
              (row.vendor_name || '').toLowerCase().includes(q.toLowerCase()) ||
              row.payment_ref_no.toLowerCase().includes(q.toLowerCase()) ||
              (row.narration || '').toLowerCase().includes(q.toLowerCase())
            }
            title="Accounts Payable (AP) Vendor Payment Register"
            subtitle="Outward remittances to raw material suppliers and contractors with Sec 194Q/194C TDS deductions"
            screenCode="BANKING_ACCOUNTS"
            rowKey={(r) => r.disbursement_id}
          />
        </div>
      )}

      {/* TAB 3: Customer Collections (AR) */}
      {activeTab === 'ar' && (
        <div className="space-y-4">
          <MasterDataTable
            columns={recColumns}
            data={receiptsList}
            isLoading={isReceiptsLoading}
            searchPredicate={(row, q) =>
              row.receipt_no.toLowerCase().includes(q.toLowerCase()) ||
              (row.customer_name || '').toLowerCase().includes(q.toLowerCase()) ||
              row.instrument_ref_no.toLowerCase().includes(q.toLowerCase()) ||
              (row.narration || '').toLowerCase().includes(q.toLowerCase())
            }
            title="Accounts Receivable (AR) Customer Collection Register"
            subtitle="Inward collections, bank transfers, cheques deposited with automated invoice allocations"
            screenCode="BANKING_ACCOUNTS"
            rowKey={(r) => r.receipt_id}
          />
        </div>
      )}

      {/* TAB 4: Bank Reconciliation (BRS) */}
      {activeTab === 'brs' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Select Bank Account</label>
                <select
                  value={brsBankId}
                  onChange={(e) => setBrsBankId(Number(e.target.value))}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  {bankAccountsList.map((b) => (
                    <option key={b.bank_account_id} value={b.bank_account_id}>
                      {b.account_code} - {b.account_name} ({b.bank_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Reconciliation Cutoff Date</label>
                <input
                  type="date"
                  value={brsCutoffDate}
                  onChange={(e) => setBrsCutoffDate(e.target.value)}
                  className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setIsImportFeedModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg border border-gray-300 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Feed Txn
              </button>

              <button
                onClick={() => finalizeBrsMutation.mutate()}
                disabled={finalizeBrsMutation.isPending || !brsSummary?.isBalanced}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg shadow-sm transition ${brsSummary?.isBalanced ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-gray-400 cursor-not-allowed'}`}
                title={!brsSummary?.isBalanced ? 'Cannot finalize while variance exists' : 'Authorize Statutory BRS Statement'}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                Authorize & Finalize BRS
              </button>
            </div>
          </div>

          {/* Statutory Classical BRS Statement Sheet */}
          {brsSummary && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="bg-slate-900 text-white p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                  <div>
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                      Statutory Bank Reconciliation Statement (BRS)
                    </span>
                    <h2 className="text-xl font-bold mt-1">
                      {brsSummary.bankAccountName} — A/c #{brsSummary.accountNumber}
                    </h2>
                    <p className="text-xs text-slate-300">As on {new Date(brsSummary.cutoffDate).toLocaleDateString('en-GB')}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    {brsSummary.isBalanced ? (
                      <div className="flex items-center gap-2 bg-emerald-500 bg-opacity-20 text-emerald-300 px-4 py-2 rounded-lg border border-emerald-400">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        <div>
                          <div className="text-xs font-bold uppercase">Reconciled</div>
                          <div className="text-[11px] opacity-90">Exact Mathematical Match</div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 bg-rose-500 bg-opacity-20 text-rose-300 px-4 py-2 rounded-lg border border-rose-400">
                        <AlertCircle className="w-5 h-5 text-rose-400" />
                        <div>
                          <div className="text-xs font-bold uppercase">Variance Detected</div>
                          <div className="text-[11px] opacity-90">Diff: ₹{brsSummary.varianceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Classical BRS 4-Part Formula Calculation */}
              <div className="p-6 divide-y divide-gray-100">
                {/* 1. GL Book Balance */}
                <div className="py-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 font-semibold text-gray-800">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 inline-flex items-center justify-center text-xs font-bold">
                      1
                    </span>
                    <span>Balance as per ERP General Ledger Bank Book</span>
                  </div>
                  <span className="font-mono font-bold text-base text-gray-900">
                    ₹{brsSummary.glBookBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* 2. Add: Cheques Issued but Not Yet Presented */}
                <div className="py-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 font-semibold text-emerald-700">
                      <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 inline-flex items-center justify-center text-xs font-bold">
                        +
                      </span>
                      <span>Add: Cheques Issued to Vendors but Not Yet Presented at Bank</span>
                      <span className="text-xs font-normal text-gray-500">
                        ({brsSummary.unpresentedCheques.length} items)
                      </span>
                    </div>
                    <span className="font-mono font-bold text-sm text-emerald-700">
                      +₹{brsSummary.unpresentedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {brsSummary.unpresentedCheques.length > 0 && (
                    <div className="mt-2 ml-8 bg-emerald-50 rounded-lg p-3 border border-emerald-100 text-xs">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-gray-500 font-medium border-b border-emerald-200">
                            <th className="pb-1">Voucher</th>
                            <th className="pb-1">Vendor</th>
                            <th className="pb-1">Cheque / Ref</th>
                            <th className="pb-1 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-emerald-100 font-mono">
                          {brsSummary.unpresentedCheques.map((chq) => (
                            <tr key={chq.disbursement_id}>
                              <td className="py-1">{chq.voucher_no}</td>
                              <td className="py-1 font-sans">{chq.vendor_name}</td>
                              <td className="py-1">{chq.payment_ref_no}</td>
                              <td className="py-1 text-right font-bold">
                                ₹{Number(chq.total_net_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 3. Less: Cheques Deposited but Not Yet Credited */}
                <div className="py-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 font-semibold text-rose-700">
                      <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 inline-flex items-center justify-center text-xs font-bold">
                        −
                      </span>
                      <span>Less: Cheques Deposited from Customers but Not Yet Credited by Bank</span>
                      <span className="text-xs font-normal text-gray-500">
                        ({brsSummary.uncreditedDeposits.length} items)
                      </span>
                    </div>
                    <span className="font-mono font-bold text-sm text-rose-700">
                      −₹{brsSummary.uncreditedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {brsSummary.uncreditedDeposits.length > 0 && (
                    <div className="mt-2 ml-8 bg-rose-50 rounded-lg p-3 border border-rose-100 text-xs">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="text-gray-500 font-medium border-b border-rose-200">
                            <th className="pb-1">Receipt No</th>
                            <th className="pb-1">Customer</th>
                            <th className="pb-1">Instrument Ref</th>
                            <th className="pb-1 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-rose-100 font-mono">
                          {brsSummary.uncreditedDeposits.map((dep) => (
                            <tr key={dep.receipt_id}>
                              <td className="py-1">{dep.receipt_no}</td>
                              <td className="py-1 font-sans">{dep.customer_name}</td>
                              <td className="py-1">{dep.instrument_ref_no}</td>
                              <td className="py-1 text-right font-bold">
                                ₹{Number(dep.total_net_received).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 4. Computed Balance vs Actual Statement Balance */}
                <div className="py-4 bg-gray-50 -mx-6 px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 font-bold text-sm">
                  <div>
                    <span className="text-gray-600 block text-xs uppercase">Computed Bank Statement Balance:</span>
                    <span className="font-mono text-lg text-blue-900">
                      ₹{brsSummary.computedBankBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-gray-600 block text-xs uppercase">Actual Statement Balance:</span>
                    <span className="font-mono text-lg text-emerald-800">
                      ₹{brsSummary.actualStatementBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Bank Statement Feed Lines List */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Bank Statement Feed Register</h3>
                <p className="text-xs text-gray-500">Live transaction lines imported from netbanking statement</p>
              </div>
              <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-1 rounded">
                Total Feed Lines: {statementLines.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600 uppercase tracking-wider font-semibold border-b border-gray-200">
                  <tr>
                    <th className="p-3">Txn Date</th>
                    <th className="p-3">Narrative / Description</th>
                    <th className="p-3">Ref / Cheque No</th>
                    <th className="p-3 text-right text-rose-700">Withdrawal (Dr)</th>
                    <th className="p-3 text-right text-emerald-700">Deposit (Cr)</th>
                    <th className="p-3 text-right">Running Balance</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono">
                  {statementLines.map((stmt) => (
                    <tr key={stmt.statement_line_id} className="hover:bg-gray-50">
                      <td className="p-3 text-gray-700">
                        {stmt.txn_date ? new Date(stmt.txn_date).toLocaleDateString('en-GB') : '—'}
                      </td>
                      <td className="p-3 font-sans text-gray-900 font-medium max-w-xs truncate">
                        {stmt.description}
                      </td>
                      <td className="p-3 text-gray-600 font-bold">{stmt.ref_cheque_no || '—'}</td>
                      <td className="p-3 text-right text-rose-700 font-bold">
                        {Number(stmt.debit_withdrawal) > 0
                          ? `₹${Number(stmt.debit_withdrawal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                          : '—'}
                      </td>
                      <td className="p-3 text-right text-emerald-700 font-bold">
                        {Number(stmt.credit_deposit) > 0
                          ? `₹${Number(stmt.credit_deposit).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                          : '—'}
                      </td>
                      <td className="p-3 text-right font-bold text-gray-900">
                        ₹{Number(stmt.running_balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-center font-sans">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${stmt.reconciliation_status === 'MATCHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}
                        >
                          {stmt.reconciliation_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {statementLines.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-gray-400 font-sans">
                        No statement feed lines imported yet. Click "Add Feed Txn" to import statement records.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 1: Record Vendor Payment Disbursement (AP)
      ======================================================================== */}
      {isDisbursementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[92vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-rose-50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-200 text-rose-800 rounded-lg">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Record Vendor Payment (AP)</h2>
                  <p className="text-xs text-gray-600">Disburse payment against pending purchase invoices with TDS deduction</p>
                </div>
              </div>
              <button
                onClick={() => setIsDisbursementModalOpen(false)}
                className="p-1 hover:bg-rose-200 rounded-full text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitDisbursement} className="p-6 space-y-5">
              {/* Row 1: Vendor Selection & Bank */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Select Vendor <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={disbVendorId || ''}
                    onChange={(e) => {
                      const vId = Number(e.target.value);
                      setDisbVendorId(vId);
                      setSelectedInvoices({});
                    }}
                    required
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-rose-500 font-medium"
                  >
                    <option value="">— Select Vendor —</option>
                    {lookups?.parties
                      .filter((p) => p.is_supplier)
                      .map((p) => (
                        <option key={p.party_id} value={p.party_id}>
                          {p.party_name} ({p.party_code})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Paid From Bank / Cash <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={disbBankId}
                    onChange={(e) => setDisbBankId(Number(e.target.value))}
                    required
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-rose-500 font-medium"
                  >
                    {bankAccountsList.map((b) => (
                      <option key={b.bank_account_id} value={b.bank_account_id}>
                        {b.account_code} - {b.account_name} (Bal: ₹{Number(b.current_balance).toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Payment Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={disbDate}
                    onChange={(e) => setDisbDate(e.target.value)}
                    required
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-rose-500 font-medium"
                  />
                </div>
              </div>

              {/* Row 2: Mode, Reference, Clearance, TDS Section */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Payment Mode</label>
                  <select
                    value={disbMode}
                    onChange={(e) => setDisbMode(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-medium"
                  >
                    <option value="NEFT">NEFT</option>
                    <option value="RTGS">RTGS</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="IMPS">IMPS</option>
                    <option value="UPI">UPI</option>
                    <option value="CASH">Cash in Hand</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    UTR / Cheque Ref No <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR/SBIN26102001928"
                    value={disbRefNo}
                    onChange={(e) => setDisbRefNo(e.target.value)}
                    required
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Statutory TDS Section</label>
                  <select
                    value={disbTdsSection}
                    onChange={(e) => handleTdsSectionChange(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-medium"
                  >
                    <option value="194Q">Sec 194Q - Purchase of Goods (0.1%)</option>
                    <option value="194C_INDIV">Sec 194C - Contractor Individual (1.0%)</option>
                    <option value="194C_CO">Sec 194C - Contractor Company (2.0%)</option>
                    <option value="194J">Sec 194J - Technical / Professional (10.0%)</option>
                    <option value="NONE">None / Exempt (0%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Clearance Status</label>
                  <select
                    value={disbClearanceStatus}
                    onChange={(e) => setDisbClearanceStatus(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-medium"
                  >
                    <option value="CLEARED">Cleared Immediately</option>
                    <option value="ISSUED">Cheque Issued (Awaiting Bank Presentation)</option>
                  </select>
                </div>
              </div>

              {/* Pending Purchase Invoices Table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Unpaid Purchase Invoices for Selected Vendor
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    {pendingPurchaseInvoices.length} invoices found
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 text-gray-600 font-semibold sticky top-0">
                      <tr>
                        <th className="p-2.5 w-10 text-center">Select</th>
                        <th className="p-2.5">Our Inv #</th>
                        <th className="p-2.5">Vendor Bill #</th>
                        <th className="p-2.5">Due Date</th>
                        <th className="p-2.5 text-right">Net Payable</th>
                        <th className="p-2.5 text-right">Balance Due</th>
                        <th className="p-2.5 text-right w-36">Settled Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono">
                      {pendingPurchaseInvoices.map((inv) => {
                        const isSel = selectedInvoices[inv.invoice_id]?.selected;
                        const amt = selectedInvoices[inv.invoice_id]?.settledAmount || 0;
                        return (
                          <tr key={inv.invoice_id} className={isSel ? 'bg-rose-50' : 'hover:bg-gray-50'}>
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={!!isSel}
                                onChange={() => handleSelectInvoice(inv)}
                                className="rounded text-rose-600 focus:ring-rose-500"
                              />
                            </td>
                            <td className="p-2.5 font-bold text-blue-700">{inv.invoice_no}</td>
                            <td className="p-2.5 text-gray-700">{inv.vendor_invoice_no}</td>
                            <td className="p-2.5 text-gray-600 font-sans">
                              {inv.due_date ? new Date(inv.due_date).toLocaleDateString('en-GB') : '—'}
                            </td>
                            <td className="p-2.5 text-right font-semibold">
                              ₹{Number(inv.net_payable_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2.5 text-right text-rose-700 font-bold">
                              ₹{Number(inv.balance_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                step="0.01"
                                disabled={!isSel}
                                value={amt}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setSelectedInvoices((prev) => ({
                                    ...prev,
                                    [inv.invoice_id]: { selected: true, settledAmount: val },
                                  }));
                                }}
                                className="w-28 text-right text-xs border border-gray-300 rounded px-2 py-1 font-mono font-bold focus:ring-2 focus:ring-rose-500 disabled:bg-gray-100"
                              />
                            </td>
                          </tr>
                        );
                      })}
                      {pendingPurchaseInvoices.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-6 text-center text-gray-400 font-sans">
                            {disbVendorId ? 'No unpaid purchase invoices pending for this vendor.' : 'Please select a vendor above.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Double-Entry Balancing Summary Box */}
              <div className="bg-slate-900 text-white rounded-xl p-4 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-700 pb-2 mb-3">
                  <span className="font-sans font-bold uppercase tracking-wider text-[11px]">
                    Double-Entry Journal Voucher (JV) Posting Breakdown
                  </span>
                  <span className="font-semibold text-emerald-400">Status: Balanced</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Debit: Trade Creditors (1201)</span>
                    <span className="text-base font-bold text-white">
                      ₹{disbGrossSettled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Credit: TDS Deducted (1214)</span>
                    <span className="text-base font-bold text-rose-400">
                      ₹{disbTdsAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Credit: Bank Payout</span>
                    <span className="text-base font-bold text-emerald-400">
                      ₹{disbNetPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Narration / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Vendor bill settlement via SBI NEFT against raw material purchase"
                  value={disbNarration}
                  onChange={(e) => setDisbNarration(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-medium"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsDisbursementModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createDisbursementMutation.isPending || disbNetPaid <= 0}
                  className="px-5 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {createDisbursementMutation.isPending ? 'Posting Payment...' : `Post Vendor Payment (₹${disbNetPaid.toLocaleString('en-IN')})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 2: Record Customer Payment Collection (AR)
      ======================================================================== */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[92vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-emerald-50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-200 text-emerald-800 rounded-lg">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Record Customer Collection (AR)</h2>
                  <p className="text-xs text-gray-600">Post collection receipt against outstanding sales invoices</p>
                </div>
              </div>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="p-1 hover:bg-emerald-200 rounded-full text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitReceipt} className="p-6 space-y-5">
              {/* Row 1: Customer & Bank */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Select Customer <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={recCustomerId || ''}
                    onChange={(e) => {
                      const cId = Number(e.target.value);
                      setRecCustomerId(cId);
                      setSelectedSalesInvoices({});
                    }}
                    required
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value="">— Select Customer —</option>
                    {lookups?.parties
                      .filter((p) => p.is_customer)
                      .map((p) => (
                        <option key={p.party_id} value={p.party_id}>
                          {p.party_name} ({p.party_code})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Deposited Into Bank / Cash <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={recBankId}
                    onChange={(e) => setRecBankId(Number(e.target.value))}
                    required
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    {bankAccountsList.map((b) => (
                      <option key={b.bank_account_id} value={b.bank_account_id}>
                        {b.account_code} - {b.account_name} (Bal: ₹{Number(b.current_balance).toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Receipt Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={recDate}
                    onChange={(e) => setRecDate(e.target.value)}
                    required
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>
              </div>

              {/* Row 2: Mode, Instrument, Clearance, Deductions */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Receipt Mode</label>
                  <select
                    value={recMode}
                    onChange={(e) => setRecMode(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-medium"
                  >
                    <option value="NEFT">NEFT</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="RTGS">RTGS</option>
                    <option value="IMPS">IMPS</option>
                    <option value="UPI">UPI</option>
                    <option value="CASH">Cash in Hand</option>
                    <option value="DIRECT_DEPOSIT">Direct Deposit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Instrument Ref / Cheque No <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CHQ-778201 or UTR..."
                    value={recRefNo}
                    onChange={(e) => setRecRefNo(e.target.value)}
                    required
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Clearance Status</label>
                  <select
                    value={recClearanceStatus}
                    onChange={(e) => setRecClearanceStatus(e.target.value)}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-medium"
                  >
                    <option value="CLEARED">Cleared Immediately</option>
                    <option value="UNCLEARED">Uncleared (In Transit for BRS Reconciliation)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">TDS Withheld by Customer (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={recCustTdsAmount}
                    onChange={(e) => setRecCustTdsAmount(Number(e.target.value))}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono font-medium text-rose-600"
                  />
                </div>
              </div>

              {/* Pending Sales Invoices Table */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                    Unpaid Sales Invoices for Selected Customer
                  </span>
                  <span className="text-xs text-gray-500 font-medium">
                    {pendingSalesInvoices.length} invoices found
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-100 text-gray-600 font-semibold sticky top-0">
                      <tr>
                        <th className="p-2.5 w-10 text-center">Select</th>
                        <th className="p-2.5">Invoice #</th>
                        <th className="p-2.5">Invoice Date</th>
                        <th className="p-2.5 text-right">Total Amount</th>
                        <th className="p-2.5 text-right">Balance Due</th>
                        <th className="p-2.5 text-right w-36">Settled Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 font-mono">
                      {pendingSalesInvoices.map((inv) => {
                        const isSel = selectedSalesInvoices[inv.invoice_id]?.selected;
                        const amt = selectedSalesInvoices[inv.invoice_id]?.settledAmount || 0;
                        return (
                          <tr key={inv.invoice_id} className={isSel ? 'bg-emerald-50' : 'hover:bg-gray-50'}>
                            <td className="p-2.5 text-center">
                              <input
                                type="checkbox"
                                checked={!!isSel}
                                onChange={() => handleSelectSalesInvoice(inv)}
                                className="rounded text-emerald-600 focus:ring-emerald-500"
                              />
                            </td>
                            <td className="p-2.5 font-bold text-blue-700">{inv.invoice_no}</td>
                            <td className="p-2.5 text-gray-600 font-sans">
                              {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-GB') : '—'}
                            </td>
                            <td className="p-2.5 text-right font-semibold">
                              ₹{Number(inv.total_invoice_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2.5 text-right text-emerald-700 font-bold">
                              ₹{Number(inv.balance_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                step="0.01"
                                disabled={!isSel}
                                value={amt}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  setSelectedSalesInvoices((prev) => ({
                                    ...prev,
                                    [inv.invoice_id]: { selected: true, settledAmount: val },
                                  }));
                                }}
                                className="w-28 text-right text-xs border border-gray-300 rounded px-2 py-1 font-mono font-bold focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100"
                              />
                            </td>
                          </tr>
                        );
                      })}
                      {pendingSalesInvoices.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-gray-400 font-sans">
                            {recCustomerId ? 'No unpaid sales invoices pending for this customer.' : 'Please select a customer above.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Double-Entry Balancing Summary Box */}
              <div className="bg-slate-900 text-white rounded-xl p-4 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-400 border-b border-slate-700 pb-2 mb-3">
                  <span className="font-sans font-bold uppercase tracking-wider text-[11px]">
                    Double-Entry Receipt Posting Summary
                  </span>
                  <span className="font-semibold text-emerald-400">Status: Balanced</span>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Debit: Net Bank Received</span>
                    <span className="text-base font-bold text-emerald-400">
                      ₹{recNetReceived.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Debit: TDS Receivable (1131)</span>
                    <span className="text-base font-bold text-blue-300">
                      ₹{Number(recCustTdsAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px] font-sans">Credit: Trade Debtors (1111)</span>
                    <span className="text-base font-bold text-white">
                      ₹{recGrossSettled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Narration / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. Cheque collection against valves dispatch order"
                  value={recNarration}
                  onChange={(e) => setRecNarration(e.target.value)}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-medium"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createReceiptMutation.isPending || recNetReceived <= 0}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {createReceiptMutation.isPending ? 'Posting Receipt...' : `Post Collection (₹${recNetReceived.toLocaleString('en-IN')})`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 3: New Bank Account
      ======================================================================== */}
      {isAddAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-blue-50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-700" />
                <h2 className="text-lg font-bold text-gray-900">Add Corporate Bank Account</h2>
              </div>
              <button
                onClick={() => setIsAddAccountModalOpen(false)}
                className="p-1 hover:bg-blue-100 rounded-full text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                createAccountMutation.mutate(accountForm);
              }}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Account Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BANK-ICICI-01"
                    value={accountForm.accountCode}
                    onChange={(e) => setAccountForm({ ...accountForm, accountCode: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Account Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={accountForm.accountType}
                    onChange={(e) => setAccountForm({ ...accountForm, accountType: e.target.value as any })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-medium"
                  >
                    <option value="CURRENT">Current Account</option>
                    <option value="CASH_CREDIT">Cash Credit (CC)</option>
                    <option value="OVERDRAFT">Overdraft (OD)</option>
                    <option value="SAVINGS">Savings Account</option>
                    <option value="PETTY_CASH">Petty Cash Safe</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Account Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. ICICI Bank - Corporate Current A/c"
                  value={accountForm.accountName}
                  onChange={(e) => setAccountForm({ ...accountForm, accountName: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Bank Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ICICI Bank Ltd"
                    value={accountForm.bankName}
                    onChange={(e) => setAccountForm({ ...accountForm, bankName: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Branch Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. GIDC Vatva Branch"
                    value={accountForm.branchName}
                    onChange={(e) => setAccountForm({ ...accountForm, branchName: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Account Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 001205001234"
                    value={accountForm.accountNumber}
                    onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">IFSC Code</label>
                  <input
                    type="text"
                    placeholder="e.g. ICIC0000012"
                    value={accountForm.ifscCode}
                    onChange={(e) => setAccountForm({ ...accountForm, ifscCode: e.target.value })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    GL Account Link <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={accountForm.glAccountId}
                    onChange={(e) => setAccountForm({ ...accountForm, glAccountId: Number(e.target.value) })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-medium"
                  >
                    {lookups?.glAccounts.map((g) => (
                      <option key={g.account_id} value={g.account_id}>
                        [{g.account_code}] {g.account_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={accountForm.openingBalance}
                    onChange={(e) => setAccountForm({ ...accountForm, openingBalance: Number(e.target.value) })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono font-medium"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsAddAccountModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createAccountMutation.isPending}
                  className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {createAccountMutation.isPending ? 'Saving...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 4: Import / Add Bank Statement Feed Txn
      ======================================================================== */}
      {isImportFeedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full">
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-purple-50 rounded-t-2xl">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-purple-700" />
                <h2 className="text-lg font-bold text-gray-900">Add Bank Statement Feed Line</h2>
              </div>
              <button
                onClick={() => setIsImportFeedModalOpen(false)}
                className="p-1 hover:bg-purple-100 rounded-full text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                importFeedMutation.mutate({
                  bankAccountId: brsBankId,
                  ...feedForm,
                });
              }}
              className="p-6 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Transaction Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={feedForm.txnDate}
                  onChange={(e) => setFeedForm({ ...feedForm, txnDate: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Description / Narrative <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. NEFT CR-AXISN261019011-L AND T LIMITED"
                  value={feedForm.description}
                  onChange={(e) => setFeedForm({ ...feedForm, description: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Cheque / UTR Ref No</label>
                <input
                  type="text"
                  placeholder="e.g. UTR/SBIN26102001928"
                  value={feedForm.refChequeNo}
                  onChange={(e) => setFeedForm({ ...feedForm, refChequeNo: e.target.value })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Withdrawal Dr (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={feedForm.debitWithdrawal}
                    onChange={(e) => setFeedForm({ ...feedForm, debitWithdrawal: Number(e.target.value) })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono font-medium text-rose-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Deposit Cr (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={feedForm.creditDeposit}
                    onChange={(e) => setFeedForm({ ...feedForm, creditDeposit: Number(e.target.value) })}
                    className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono font-medium text-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Statement Balance After Txn (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={feedForm.runningBalance}
                  onChange={(e) => setFeedForm({ ...feedForm, runningBalance: Number(e.target.value) })}
                  className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 font-mono font-bold text-gray-900"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsImportFeedModalOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importFeedMutation.isPending}
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-sm font-semibold shadow-sm transition disabled:opacity-50"
                >
                  {importFeedMutation.isPending ? 'Adding Line...' : 'Add Statement Line'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 5: Printable Payment Advice
      ======================================================================== */}
      {viewDisbursement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Vendor Payment Advice Voucher</h3>
                <p className="text-xs text-gray-500 font-mono">Voucher #{viewDisbursement.voucher_no}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
                <button
                  onClick={() => setViewDisbursement(null)}
                  className="p-1 hover:bg-gray-100 rounded-full text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-gray-400 block uppercase">Vendor Beneficiary</span>
                  <span className="font-bold text-gray-900 text-sm">{viewDisbursement.vendor_name}</span>
                  {viewDisbursement.vendor_pan && <span className="block font-mono text-gray-500">PAN: {viewDisbursement.vendor_pan}</span>}
                </div>
                <div className="text-right">
                  <span className="text-gray-400 block uppercase">Disbursed Date</span>
                  <span className="font-semibold text-gray-800">
                    {new Date(viewDisbursement.voucher_date).toLocaleDateString('en-GB')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                <div>
                  <span className="text-gray-400 block uppercase">Remitted Through</span>
                  <span className="font-semibold text-gray-800">{viewDisbursement.bank_account_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 block uppercase">Remittance UTR / Ref</span>
                  <span className="font-mono font-bold text-blue-700">{viewDisbursement.payment_ref_no}</span>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
              <div className="bg-gray-100 px-3 py-2 font-bold text-gray-700 flex justify-between">
                <span>Settlement Breakdown</span>
                <span className="font-mono">Amount (INR)</span>
              </div>
              <div className="p-3 space-y-1.5 font-mono">
                <div className="flex justify-between text-gray-700">
                  <span className="font-sans">Gross Invoiced Payable:</span>
                  <span>₹{Number(viewDisbursement.total_gross_settled).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span className="font-sans">Less: TDS Deducted under Sec 194Q/194C:</span>
                  <span>−₹{Number(viewDisbursement.total_tds_deducted).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-base font-bold text-emerald-800 pt-2 border-t border-gray-200">
                  <span className="font-sans">Net Payout Transferred:</span>
                  <span>₹{Number(viewDisbursement.total_net_paid).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="pt-8 flex justify-between text-xs text-gray-500 font-medium">
              <div>
                <div className="border-t border-gray-400 w-36 pt-1 text-center">Prepared By (Accounts)</div>
              </div>
              <div>
                <div className="border-t border-gray-400 w-36 pt-1 text-center">Authorized Signatory</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================
          MODAL 6: Printable Collection Receipt
      ======================================================================== */}
      {viewReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Official Payment Collection Receipt</h3>
                <p className="text-xs text-gray-500 font-mono">Receipt #{viewReceipt.receipt_no}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
                <button
                  onClick={() => setViewReceipt(null)}
                  className="p-1 hover:bg-gray-100 rounded-full text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 text-xs space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-gray-400 block uppercase">Received From Customer</span>
                  <span className="font-bold text-gray-900 text-sm">{viewReceipt.customer_name}</span>
                  {viewReceipt.customer_pan && <span className="block font-mono text-gray-500">PAN: {viewReceipt.customer_pan}</span>}
                </div>
                <div className="text-right">
                  <span className="text-gray-400 block uppercase">Receipt Date</span>
                  <span className="font-semibold text-gray-800">
                    {new Date(viewReceipt.receipt_date).toLocaleDateString('en-GB')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                <div>
                  <span className="text-gray-400 block uppercase">Deposited Into</span>
                  <span className="font-semibold text-gray-800">{viewReceipt.bank_account_name}</span>
                </div>
                <div className="text-right">
                  <span className="text-gray-400 block uppercase">Instrument / Cheque No</span>
                  <span className="font-mono font-bold text-blue-700">{viewReceipt.instrument_ref_no}</span>
                </div>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden text-xs">
              <div className="bg-gray-100 px-3 py-2 font-bold text-gray-700 flex justify-between">
                <span>Receipt Summary</span>
                <span className="font-mono">Amount (INR)</span>
              </div>
              <div className="p-3 space-y-1.5 font-mono">
                <div className="flex justify-between text-gray-700">
                  <span className="font-sans">Gross Invoiced Value Settled:</span>
                  <span>₹{Number(viewReceipt.total_gross_settled).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                {Number(viewReceipt.total_tds_deducted_by_cust) > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span className="font-sans">Customer Withheld TDS (Form 16A):</span>
                    <span>−₹{Number(viewReceipt.total_tds_deducted_by_cust).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-emerald-800 pt-2 border-t border-gray-200">
                  <span className="font-sans">Net Liquid Received:</span>
                  <span>₹{Number(viewReceipt.total_net_received).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="pt-8 flex justify-between text-xs text-gray-500 font-medium">
              <div>
                <div className="border-t border-gray-400 w-36 pt-1 text-center">Cashier / Receiver</div>
              </div>
              <div>
                <div className="border-t border-gray-400 w-36 pt-1 text-center">Authorized Signatory</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
