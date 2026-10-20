import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Layers,
  PieChart,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Scale,
  Search,
  Sliders,
  TrendingDown,
  TrendingUp,
  Undo2,
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
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';
export type VoucherType =
  | 'GENERAL'
  | 'PURCHASE_INVOICE'
  | 'SALES_INVOICE'
  | 'PAYMENT'
  | 'RECEIPT'
  | 'STOCK_ADJUSTMENT'
  | 'ABSORPTION_COST'
  | 'OPENING_BALANCE';
export type VoucherStatus = 'DRAFT' | 'POSTED' | 'REVERSED';

export interface AccountRecord {
  accountId: number;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  parentAccountId: number | null;
  parentAccountName?: string | null;
  level: number;
  normalBalance: NormalBalance;
  isGroup: boolean;
  isReconciliation: boolean;
  currencyCode: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
  totalDebit?: number;
  totalCredit?: number;
  currentBalance?: number;
}

export interface CostCenterRecord {
  costCenterId: number;
  costCenterCode: string;
  costCenterName: string;
  deptId?: number | null;
}

export interface PartyLookup {
  partyId: number;
  partyCode: string;
  partyName: string;
  partyType: string;
}

export interface JournalVoucherHeader {
  journalId: number;
  voucherNo: string;
  voucherDate: string;
  voucherType: VoucherType;
  sourceModule: string;
  sourceRefNo?: string | null;
  sourceRefId?: number | null;
  narration: string;
  totalDebit: number;
  totalCredit: number;
  isPosted: boolean;
  postedBy?: number | null;
  postedByName?: string;
  postedDate?: string;
  isReversed: boolean;
  reversalRefId?: number | null;
  reversalDate?: string | null;
  reversalReason?: string | null;
  status: VoucherStatus;
  lineCount: number;
}

export interface JournalLineItem {
  journalItemId?: number;
  accountId: number;
  accountCode?: string;
  accountName?: string;
  accountType?: AccountType;
  normalBalance?: NormalBalance;
  debitAmount: number;
  creditAmount: number;
  partyId?: number | null;
  partyName?: string | null;
  costCenterId?: number | null;
  costCenterName?: string | null;
  lineNarration?: string | null;
  lineNo?: number;
}

export interface GlStatementTransaction {
  journalItemId: number;
  journalId: number;
  voucherNo: string;
  voucherDate: string;
  voucherType: string;
  sourceModule: string;
  sourceRefNo?: string | null;
  narration: string;
  partyName?: string | null;
  costCenterName?: string | null;
  debitAmount: number;
  creditAmount: number;
  runningBalance: number;
}

// ============================================================================
// Main Component
// ============================================================================
export const GlMasterPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Active top-level tab
  const [activeTab, setActiveTab] = useState<
    'STATEMENT' | 'COA' | 'VOUCHERS' | 'TRIAL_BALANCE' | 'FINANCIALS'
  >('VOUCHERS');

  // Statement Filters
  const [statementAccountId, setStatementAccountId] = useState<number>(1101); // Defaults to SBI Current A/c
  const [statementFromDate, setStatementFromDate] = useState<string>('2026-04-01');
  const [statementToDate, setStatementToDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [statementCostCenterId, setStatementCostCenterId] = useState<string>('');

  // COA Filter
  const [coaTypeFilter, setCoaTypeFilter] = useState<string>('ALL');
  const [coaSearch, setCoaSearch] = useState<string>('');

  // Voucher Filters
  const [voucherSearch, setVoucherSearch] = useState<string>('');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<string>('ALL');
  const [voucherStatusFilter, setVoucherStatusFilter] = useState<string>('ALL');

  // Modals state
  const [isPostVoucherModalOpen, setIsPostVoucherModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<AccountRecord | null>(null);
  const [isViewVoucherModalOpen, setIsViewVoucherModalOpen] = useState(false);
  const [viewingVoucherId, setViewingVoucherId] = useState<number | null>(null);
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [reversingVoucher, setReversingVoucher] = useState<JournalVoucherHeader | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isOpsBridgeModalOpen, setIsOpsBridgeModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printDocumentType, setPrintDocumentType] = useState<
    'VOUCHER' | 'STATEMENT' | 'TRIAL_BALANCE' | 'P_AND_L' | 'BALANCE_SHEET'
  >('VOUCHER');

  // --------------------------------------------------------------------------
  // Queries
  // --------------------------------------------------------------------------
  const { data: summaryData, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['gl-summary'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>('/api/v1/accounts/gl/summary');
      return res.data?.data;
    },
  });

  const { data: lookupsData } = useQuery({
    queryKey: ['gl-lookups'],
    queryFn: async () => {
      const res = await apiClient.get<
        ApiResponse<{
          accounts: AccountRecord[];
          costCenters: CostCenterRecord[];
          parties: PartyLookup[];
        }>
      >('/api/v1/accounts/gl/lookups');
      return res.data?.data;
    },
  });

  const { data: coaList = [], isLoading: isCoaLoading } = useQuery({
    queryKey: ['gl-coa', coaTypeFilter, coaSearch],
    queryFn: async () => {
      const params: any = {};
      if (coaTypeFilter !== 'ALL') params.accountType = coaTypeFilter;
      if (coaSearch) params.search = coaSearch;
      const res = await apiClient.get<ApiResponse<AccountRecord[]>>(
        '/api/v1/accounts/gl/coa',
        { params },
      );
      return res.data?.data || [];
    },
  });

  const { data: vouchersList = [], isLoading: isVouchersLoading } = useQuery({
    queryKey: ['gl-vouchers', voucherSearch, voucherTypeFilter, voucherStatusFilter],
    queryFn: async () => {
      const params: any = {};
      if (voucherTypeFilter !== 'ALL') params.voucherType = voucherTypeFilter;
      if (voucherStatusFilter !== 'ALL') params.status = voucherStatusFilter;
      if (voucherSearch) params.search = voucherSearch;
      const res = await apiClient.get<ApiResponse<JournalVoucherHeader[]>>(
        '/api/v1/accounts/gl/vouchers',
        { params },
      );
      return res.data?.data || [];
    },
  });

  const { data: statementData, isLoading: isStatementLoading } = useQuery({
    queryKey: [
      'gl-statement',
      statementAccountId,
      statementFromDate,
      statementToDate,
      statementCostCenterId,
    ],
    queryFn: async () => {
      if (!statementAccountId) return null;
      const params: any = {
        accountId: statementAccountId,
        fromDate: statementFromDate,
        toDate: statementToDate,
      };
      if (statementCostCenterId) params.costCenterId = statementCostCenterId;
      const res = await apiClient.get<ApiResponse<any>>(
        '/api/v1/accounts/gl/statement',
        { params },
      );
      return res.data?.data;
    },
    enabled: Boolean(statementAccountId) && activeTab === 'STATEMENT',
  });

  const { data: trialBalanceData, isLoading: isTrialBalanceLoading } = useQuery({
    queryKey: ['gl-trial-balance'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        '/api/v1/accounts/gl/trial-balance',
      );
      return res.data?.data;
    },
    enabled: activeTab === 'TRIAL_BALANCE' || (isPrintModalOpen && printDocumentType === 'TRIAL_BALANCE'),
  });

  const { data: financialsData, isLoading: isFinancialsLoading } = useQuery({
    queryKey: ['gl-financials'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        '/api/v1/accounts/gl/financial-statements',
      );
      return res.data?.data;
    },
    enabled: activeTab === 'FINANCIALS' || isPrintModalOpen,
  });

  const { data: unpostedOpsData, isLoading: isUnpostedLoading, refetch: refetchUnposted } = useQuery({
    queryKey: ['gl-unposted-operations'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<any>>(
        '/api/v1/accounts/gl/unposted-operations',
      );
      return res.data?.data;
    },
    enabled: isOpsBridgeModalOpen,
  });

  const { data: viewingVoucher, isLoading: isViewingVoucherLoading } = useQuery({
    queryKey: ['gl-voucher-detail', viewingVoucherId],
    queryFn: async () => {
      if (!viewingVoucherId) return null;
      const res = await apiClient.get<ApiResponse<any>>(
        `/api/v1/accounts/gl/vouchers/${viewingVoucherId}`,
      );
      return res.data?.data;
    },
    enabled: Boolean(viewingVoucherId),
  });

  // --------------------------------------------------------------------------
  // Mutations
  // --------------------------------------------------------------------------
  const postVoucherMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post<ApiResponse<any>>(
        '/api/v1/accounts/gl/vouchers',
        payload,
      );
      return res.data?.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gl-vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['gl-summary'] });
      queryClient.invalidateQueries({ queryKey: ['gl-coa'] });
      queryClient.invalidateQueries({ queryKey: ['gl-statement'] });
      setIsPostVoucherModalOpen(false);
      alert(data?.message || 'Journal Voucher successfully posted!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || 'Failed to post voucher.');
    },
  });

  const reverseVoucherMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        `/api/v1/accounts/gl/vouchers/${id}/reverse`,
        { reversalReason: reason },
      );
      return res.data?.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gl-vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['gl-summary'] });
      queryClient.invalidateQueries({ queryKey: ['gl-coa'] });
      queryClient.invalidateQueries({ queryKey: ['gl-statement'] });
      setIsReverseModalOpen(false);
      setReversingVoucher(null);
      setReversalReason('');
      alert(data?.message || 'Voucher reversed successfully!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || 'Failed to reverse voucher.');
    },
  });

  const saveAccountMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingAccount) {
        const res = await apiClient.put<ApiResponse<any>>(
          `/api/v1/accounts/gl/coa/${editingAccount.accountId}`,
          payload,
        );
        return res.data?.data;
      } else {
        const res = await apiClient.post<ApiResponse<any>>(
          '/api/v1/accounts/gl/coa',
          payload,
        );
        return res.data?.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gl-coa'] });
      queryClient.invalidateQueries({ queryKey: ['gl-lookups'] });
      setIsAccountModalOpen(false);
      setEditingAccount(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || 'Failed to save account.');
    },
  });

  const autoPostOpMutation = useMutation({
    mutationFn: async ({ opType, opId }: { opType: string; opId: number }) => {
      const res = await apiClient.post<ApiResponse<any>>(
        '/api/v1/accounts/gl/generate-operational-jv',
        { operationType: opType, operationId: opId },
      );
      return res.data?.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['gl-vouchers'] });
      queryClient.invalidateQueries({ queryKey: ['gl-summary'] });
      queryClient.invalidateQueries({ queryKey: ['gl-coa'] });
      refetchUnposted();
      alert(data?.message || 'Operational Journal Voucher generated and posted to GL!');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || err.message || 'Failed to generate operational JV.');
    },
  });

  // --------------------------------------------------------------------------
  // New Voucher State
  // --------------------------------------------------------------------------
  const [newVoucherHeader, setNewVoucherHeader] = useState({
    voucherDate: new Date().toISOString().slice(0, 10),
    voucherType: 'GENERAL' as VoucherType,
    narration: '',
  });

  const [newVoucherLines, setNewVoucherLines] = useState<JournalLineItem[]>([
    { accountId: 1101, debitAmount: 0, creditAmount: 0, lineNarration: '', lineNo: 1 },
    { accountId: 1401, debitAmount: 0, creditAmount: 0, lineNarration: '', lineNo: 2 },
  ]);

  const addVoucherLine = () => {
    setNewVoucherLines((prev) => [
      ...prev,
      {
        accountId: lookupsData?.accounts?.[0]?.accountId || 1101,
        debitAmount: 0,
        creditAmount: 0,
        lineNarration: '',
        lineNo: prev.length + 1,
      },
    ]);
  };

  const removeVoucherLine = (idx: number) => {
    if (newVoucherLines.length <= 2) {
      alert('A journal voucher must have at least 2 lines.');
      return;
    }
    setNewVoucherLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateVoucherLine = (idx: number, field: keyof JournalLineItem, val: any) => {
    setNewVoucherLines((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  const totalVoucherDebit = useMemo(() => {
    return newVoucherLines.reduce((acc, curr) => acc + (Number(curr.debitAmount) || 0), 0);
  }, [newVoucherLines]);

  const totalVoucherCredit = useMemo(() => {
    return newVoucherLines.reduce((acc, curr) => acc + (Number(curr.creditAmount) || 0), 0);
  }, [newVoucherLines]);

  const isVoucherBalanced = useMemo(() => {
    return (
      totalVoucherDebit > 0 &&
      Math.abs(totalVoucherDebit - totalVoucherCredit) < 0.01
    );
  }, [totalVoucherDebit, totalVoucherCredit]);

  // --------------------------------------------------------------------------
  // MasterTable Columns for Vouchers
  // --------------------------------------------------------------------------
  const voucherColumns: MasterTableColumn<JournalVoucherHeader>[] = [
    {
      key: 'voucherNo',
      header: 'Voucher No',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-primary">{row.voucherNo}</span>
          <span className="text-xs text-muted-foreground">{row.voucherDate}</span>
        </div>
      ),
      sortValue: (row) => row.voucherNo,
    },
    {
      key: 'voucherType',
      header: 'Type',
      render: (row) => {
        let color = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
        if (row.voucherType === 'SALES_INVOICE')
          color = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
        if (row.voucherType === 'PURCHASE_INVOICE')
          color = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';
        if (row.voucherType === 'ABSORPTION_COST')
          color = 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
        if (row.voucherType === 'OPENING_BALANCE')
          color = 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300';
        return (
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
            {row.voucherType.replace(/_/g, ' ')}
          </span>
        );
      },
      sortValue: (row) => row.voucherType,
    },
    {
      key: 'sourceRefNo',
      header: 'Source Ref',
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-xs text-foreground">
            {row.sourceRefNo || 'Manual Entry'}
          </span>
          <span className="text-[11px] text-muted-foreground">{row.sourceModule}</span>
        </div>
      ),
      sortValue: (row) => row.sourceRefNo || '',
    },
    {
      key: 'narration',
      header: 'Narration',
      render: (row) => (
        <div className="max-w-[280px] truncate text-xs text-muted-foreground" title={row.narration}>
          {row.narration}
        </div>
      ),
      sortValue: (row) => row.narration,
    },
    {
      key: 'totalDebit',
      header: 'Total Debit (₹)',
      render: (row) => (
        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
          ₹{row.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
      sortValue: (row) => row.totalDebit,
    },
    {
      key: 'totalCredit',
      header: 'Total Credit (₹)',
      render: (row) => (
        <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
          ₹{row.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </span>
      ),
      sortValue: (row) => row.totalCredit,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => (
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
            row.status === 'POSTED'
              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
              : 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300'
          }`}
        >
          {row.status}
        </span>
      ),
      sortValue: (row) => row.status,
    },
    {
      key: 'postedByName',
      header: 'Posted By',
      render: (row) => (
        <span className="text-xs text-muted-foreground">{row.postedByName || 'System'}</span>
      ),
      sortValue: (row) => row.postedByName || '',
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              setViewingVoucherId(row.journalId);
              setIsViewVoucherModalOpen(true);
            }}
            className="p-1 hover:bg-muted rounded text-primary transition-colors"
            title="View Voucher Breakdown"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setViewingVoucherId(row.journalId);
              setPrintDocumentType('VOUCHER');
              setIsPrintModalOpen(true);
            }}
            className="p-1 hover:bg-muted rounded text-muted-foreground transition-colors"
            title="Print Journal Voucher"
          >
            <Printer className="w-4 h-4" />
          </button>
          {row.status === 'POSTED' && !row.isReversed && (
            <button
              onClick={() => {
                setReversingVoucher(row);
                setReversalReason('');
                setIsReverseModalOpen(true);
              }}
              className="p-1 hover:bg-rose-50 text-rose-600 dark:hover:bg-rose-950/40 rounded transition-colors"
              title="Reverse Voucher"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const voucherGroupBy: GroupByOption<JournalVoucherHeader>[] = [
    { key: 'none', label: 'No Grouping', groupValue: () => '' },
    { key: 'voucherType', label: 'Group by Type', groupValue: (r) => r.voucherType },
    { key: 'status', label: 'Group by Status', groupValue: (r) => r.status },
    { key: 'sourceModule', label: 'Group by Source Module', groupValue: (r) => r.sourceModule },
  ];

  // --------------------------------------------------------------------------
  // MasterTable Columns for Chart of Accounts
  // --------------------------------------------------------------------------
  const coaColumns: MasterTableColumn<AccountRecord>[] = [
    {
      key: 'accountCode',
      header: 'Account Code',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span
            className={`font-mono font-semibold ${
              row.isGroup ? 'text-primary font-bold' : 'text-foreground'
            }`}
          >
            {row.accountCode}
          </span>
          {row.isGroup && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
              Group
            </span>
          )}
        </div>
      ),
      sortValue: (row) => row.accountCode,
    },
    {
      key: 'accountName',
      header: 'Account Name',
      render: (row) => (
        <div className="flex flex-col">
          <span
            className={`${
              row.level === 1
                ? 'font-bold text-sm text-foreground'
                : row.level === 2
                  ? 'font-semibold text-xs text-foreground pl-3'
                  : row.level === 3
                    ? 'font-medium text-xs text-muted-foreground pl-6'
                    : 'text-xs text-foreground pl-9'
            }`}
          >
            {row.accountName}
          </span>
          {row.description && (
            <span className="text-[11px] text-muted-foreground pl-9 truncate max-w-sm">
              {row.description}
            </span>
          )}
        </div>
      ),
      sortValue: (row) => row.accountName,
    },
    {
      key: 'accountType',
      header: 'Class',
      render: (row) => {
        let color = 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300';
        if (row.accountType === 'ASSET')
          color = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300';
        if (row.accountType === 'LIABILITY')
          color = 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300';
        if (row.accountType === 'EQUITY')
          color = 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
        if (row.accountType === 'REVENUE')
          color = 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
        if (row.accountType === 'EXPENSE')
          color = 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300';

        return (
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
            {row.accountType}
          </span>
        );
      },
      sortValue: (row) => row.accountType,
    },
    {
      key: 'level',
      header: 'Level',
      render: (row) => (
        <span className="px-2 py-0.5 rounded bg-muted text-xs font-mono">
          L{row.level}
        </span>
      ),
      sortValue: (row) => row.level,
    },
    {
      key: 'normalBalance',
      header: 'Normal Bal',
      render: (row) => (
        <span
          className={`text-xs font-mono font-semibold ${
            row.normalBalance === 'DEBIT' ? 'text-emerald-600' : 'text-indigo-600'
          }`}
        >
          {row.normalBalance}
        </span>
      ),
      sortValue: (row) => row.normalBalance,
    },
    {
      key: 'currentBalance',
      header: 'Current Net Balance (₹)',
      render: (row) => {
        const bal = row.currentBalance || 0;
        return (
          <span
            className={`font-mono text-xs font-semibold ${
              bal < 0 ? 'text-rose-600' : 'text-foreground'
            }`}
          >
            ₹{bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </span>
        );
      },
      sortValue: (row) => row.currentBalance || 0,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => (
        <div className="flex items-center gap-1.5">
          {!row.isGroup && (
            <button
              onClick={() => {
                setStatementAccountId(row.accountId);
                setActiveTab('STATEMENT');
              }}
              className="px-2 py-1 bg-primary/10 text-primary hover:bg-primary/20 rounded text-xs font-medium transition-colors"
              title="Drilldown into GL Statement"
            >
              Statement
            </button>
          )}
          <button
            onClick={() => {
              setEditingAccount(row);
              setIsAccountModalOpen(true);
            }}
            className="p-1 hover:bg-muted rounded text-muted-foreground transition-colors"
            title="Edit Account"
          >
            <Edit3 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const coaGroupBy: GroupByOption<AccountRecord>[] = [
    { key: 'none', label: 'No Grouping', groupValue: () => '' },
    { key: 'accountType', label: 'Group by Class', groupValue: (r) => r.accountType },
    { key: 'level', label: 'Group by Level', groupValue: (r) => `Level ${r.level}` },
  ];

  return (
    <PermissionGate screen="GL_ACCOUNTS">
      <div className="space-y-6">
        {/* ==================================================================== */}
        {/* Top Header Banner & Quick Actions */}
        {/* ==================================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Chart of Accounts & General Ledger (GL)
                </h1>
                <p className="text-xs text-muted-foreground">
                  5-Level Hierarchical COA, Multi-Cost Center Ledger Drilldown, Balanced Double-Entry Journal Engine & Statutory Financials
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsOpsBridgeModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-200 dark:border-indigo-800"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              1-Click Operational Postings
            </button>

            <button
              onClick={() => {
                setEditingAccount(null);
                setIsAccountModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors border border-border"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Ledger Account
            </button>

            <button
              onClick={() => setIsPostVoucherModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Post Journal Voucher
            </button>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* KPI Financial Overview Cards */}
        {/* ==================================================================== */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {/* Total Accounts */}
          <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Total COA Accounts</span>
              <Layers className="w-4 h-4 text-primary" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">
                {isSummaryLoading ? '...' : summaryData?.totalAccounts || 0}
              </span>
              <span className="text-xs text-muted-foreground">in 5 levels</span>
            </div>
          </div>

          {/* Posted Vouchers */}
          <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Posted Vouchers</span>
              <FileCheck className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {isSummaryLoading ? '...' : summaryData?.postedVouchers || 0}
              </span>
              <span className="text-xs text-muted-foreground">balanced JVs</span>
            </div>
          </div>

          {/* Total Assets */}
          <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Total Assets</span>
              <Wallet className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
                ₹{isSummaryLoading ? '...' : (summaryData?.totalAssets || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Total Liabilities */}
          <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Total Liabilities</span>
              <Scale className="w-4 h-4 text-rose-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-rose-600 dark:text-rose-400">
                ₹{isSummaryLoading ? '...' : (summaryData?.totalLiabilities || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Net Profit / (Loss) */}
          <div className="p-4 rounded-xl border border-border bg-card shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium uppercase tracking-wider">Net Profit / (Loss)</span>
              {(summaryData?.netProfitLoss || 0) >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-500" />
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span
                className={`text-xl font-bold font-mono ${
                  (summaryData?.netProfitLoss || 0) >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                ₹{isSummaryLoading ? '...' : (summaryData?.netProfitLoss || 0).toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-muted-foreground">Current FY</span>
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* Navigation Tabs */}
        {/* ==================================================================== */}
        <div className="flex items-center gap-1 border-b border-border bg-muted/40 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('VOUCHERS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'VOUCHERS'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            Journal Vouchers Register
          </button>

          <button
            onClick={() => setActiveTab('STATEMENT')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'STATEMENT'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            General Ledger Statement
          </button>

          <button
            onClick={() => setActiveTab('COA')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'COA'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Chart of Accounts Hierarchy
          </button>

          <button
            onClick={() => setActiveTab('TRIAL_BALANCE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'TRIAL_BALANCE'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            Trial Balance
          </button>

          <button
            onClick={() => setActiveTab('FINANCIALS')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'FINANCIALS'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            P&L and Balance Sheet
          </button>
        </div>

        {/* ==================================================================== */}
        {/* TAB 1: JOURNAL VOUCHERS REGISTER */}
        {/* ==================================================================== */}
        {activeTab === 'VOUCHERS' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search voucher, ref or narration..."
                    value={voucherSearch}
                    onChange={(e) => setVoucherSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <select
                  value={voucherTypeFilter}
                  onChange={(e) => setVoucherTypeFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-border bg-background"
                >
                  <option value="ALL">All Voucher Types</option>
                  <option value="GENERAL">General JV</option>
                  <option value="SALES_INVOICE">Sales Invoice</option>
                  <option value="PURCHASE_INVOICE">Purchase Invoice</option>
                  <option value="ABSORPTION_COST">Absorption Costing</option>
                  <option value="STOCK_ADJUSTMENT">Stock Adjustment</option>
                  <option value="OPENING_BALANCE">Opening Balance</option>
                </select>

                <select
                  value={voucherStatusFilter}
                  onChange={(e) => setVoucherStatusFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-border bg-background"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="POSTED">POSTED</option>
                  <option value="REVERSED">REVERSED</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPrintDocumentType('VOUCHER');
                    setIsPrintModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors"
                >
                  <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                  Print Register
                </button>
              </div>
            </div>

            <MasterDataTable<JournalVoucherHeader>
              title="Journal Vouchers"
              subtitle="Double-entry manual and operational journal transactions register"
              screenCode="GL_ACCOUNTS"
              rowKey={(row) => row.journalId}
              data={vouchersList}
              columns={voucherColumns}
              groupByOptions={voucherGroupBy}
              searchPredicate={(row, q) =>
                row.voucherNo.toLowerCase().includes(q.toLowerCase()) ||
                row.narration.toLowerCase().includes(q.toLowerCase()) ||
                (row.sourceRefNo || '').toLowerCase().includes(q.toLowerCase())
              }
              isLoading={isVouchersLoading}
            />
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: GENERAL LEDGER STATEMENT (DRILLDOWN) */}
        {/* ==================================================================== */}
        {activeTab === 'STATEMENT' && (
          <div className="space-y-4">
            {/* Filter & Selector Bar */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-card p-4 rounded-xl border border-border shadow-sm">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Select Ledger Account</label>
                <select
                  value={statementAccountId}
                  onChange={(e) => setStatementAccountId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background font-medium"
                >
                  {(lookupsData?.accounts || [])
                    .filter((a) => !a.isGroup)
                    .map((a) => (
                      <option key={a.accountId} value={a.accountId}>
                        {a.accountCode} — {a.accountName} ({a.accountType})
                      </option>
                    ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">From Date</label>
                <input
                  type="date"
                  value={statementFromDate}
                  onChange={(e) => setStatementFromDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">To Date</label>
                <input
                  type="date"
                  value={statementToDate}
                  onChange={(e) => setStatementToDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-foreground">Cost Center (Optional)</label>
                <select
                  value={statementCostCenterId}
                  onChange={(e) => setStatementCostCenterId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-border bg-background"
                >
                  <option value="">All Cost Centers</option>
                  {(lookupsData?.costCenters || []).map((cc) => (
                    <option key={cc.costCenterId} value={cc.costCenterId}>
                      {cc.costCenterCode} — {cc.costCenterName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Statement Header Card */}
            {statementData && (
              <div className="bg-gradient-to-r from-card to-muted/40 p-5 rounded-xl border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm px-2 py-0.5 rounded bg-primary/10 text-primary font-bold">
                      {statementData.account.accountCode}
                    </span>
                    <h2 className="text-lg font-bold text-foreground">
                      {statementData.account.accountName}
                    </h2>
                    <span className="text-xs font-semibold px-2 py-0.5 bg-muted rounded text-muted-foreground">
                      {statementData.account.accountType}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Period: {statementData.fromDate} to {statementData.toDate} | Normal Balance: {statementData.account.normalBalance}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="text-right">
                    <span className="text-[11px] uppercase font-semibold text-muted-foreground block">Opening Balance</span>
                    <span className="font-mono text-sm font-bold text-foreground">
                      ₹{statementData.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="h-8 w-px bg-border hidden sm:block" />

                  <div className="text-right">
                    <span className="text-[11px] uppercase font-semibold text-emerald-600 block">Period Debits</span>
                    <span className="font-mono text-sm font-bold text-emerald-600">
                      ₹{statementData.periodTotalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="h-8 w-px bg-border hidden sm:block" />

                  <div className="text-right">
                    <span className="text-[11px] uppercase font-semibold text-indigo-600 block">Period Credits</span>
                    <span className="font-mono text-sm font-bold text-indigo-600">
                      ₹{statementData.periodTotalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="h-8 w-px bg-border hidden sm:block" />

                  <div className="text-right bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
                    <span className="text-[11px] uppercase font-bold text-primary block">Closing Balance</span>
                    <span className="font-mono text-base font-bold text-primary">
                      ₹{statementData.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      setPrintDocumentType('STATEMENT');
                      setIsPrintModalOpen(true);
                    }}
                    className="p-2 border border-border rounded-lg bg-card hover:bg-muted text-foreground transition-colors"
                    title="Print Statement"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Statement Transactions Table */}
            <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px] font-semibold tracking-wider border-b border-border">
                    <tr>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Voucher No</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Reference / Party</th>
                      <th className="py-2.5 px-3">Narration</th>
                      <th className="py-2.5 px-3 text-right">Debit (₹)</th>
                      <th className="py-2.5 px-3 text-right">Credit (₹)</th>
                      <th className="py-2.5 px-3 text-right">Running Balance (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono">
                    {/* Opening Balance Row */}
                    {statementData && (
                      <tr className="bg-muted/20 font-semibold italic text-muted-foreground">
                        <td className="py-2 px-3">{statementData.fromDate}</td>
                        <td className="py-2 px-3">—</td>
                        <td className="py-2 px-3">OPENING</td>
                        <td className="py-2 px-3">Balance B/F</td>
                        <td className="py-2 px-3">Opening balance prior to {statementData.fromDate}</td>
                        <td className="py-2 px-3 text-right">—</td>
                        <td className="py-2 px-3 text-right">—</td>
                        <td className="py-2 px-3 text-right font-bold text-foreground">
                          ₹{statementData.openingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    )}

                    {isStatementLoading ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-muted-foreground font-sans">
                          Loading ledger statement...
                        </td>
                      </tr>
                    ) : statementData?.transactions?.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-muted-foreground font-sans">
                          No transactions recorded in this period.
                        </td>
                      </tr>
                    ) : (
                      statementData?.transactions?.map((t: GlStatementTransaction) => (
                        <tr key={t.journalItemId} className="hover:bg-muted/40 transition-colors">
                          <td className="py-2 px-3">{t.voucherDate}</td>
                          <td className="py-2 px-3 font-semibold text-primary font-sans">
                            <button
                              onClick={() => {
                                setViewingVoucherId(t.journalId);
                                setIsViewVoucherModalOpen(true);
                              }}
                              className="hover:underline flex items-center gap-1"
                            >
                              {t.voucherNo}
                            </button>
                          </td>
                          <td className="py-2 px-3 font-sans text-[11px]">
                            <span className="px-1.5 py-0.5 rounded bg-muted">
                              {t.voucherType.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-sans text-foreground">
                            {t.partyName || t.sourceRefNo || '—'}
                          </td>
                          <td className="py-2 px-3 font-sans text-muted-foreground max-w-xs truncate" title={t.narration}>
                            {t.narration}
                          </td>
                          <td className="py-2 px-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                            {t.debitAmount > 0
                              ? `₹${t.debitAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                          <td className="py-2 px-3 text-right text-indigo-600 dark:text-indigo-400 font-semibold">
                            {t.creditAmount > 0
                              ? `₹${t.creditAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-foreground">
                            ₹{t.runningBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {/* Closing Balance Footer */}
                  {statementData && (
                    <tfoot className="bg-muted/60 font-semibold border-t-2 border-border font-mono text-xs">
                      <tr>
                        <td colSpan={5} className="py-2.5 px-3 font-sans font-bold">
                          Period Total & Final Closing Balance
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-600 font-bold">
                          ₹{statementData.periodTotalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right text-indigo-600 font-bold">
                          ₹{statementData.periodTotalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right text-primary font-bold text-sm">
                          ₹{statementData.closingBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: CHART OF ACCOUNTS HIERARCHY */}
        {/* ==================================================================== */}
        {activeTab === 'COA' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search account code or name..."
                    value={coaSearch}
                    onChange={(e) => setCoaSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-background"
                  />
                </div>

                <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                  {['ALL', 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setCoaTypeFilter(cat)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                        coaTypeFilter === cat
                          ? 'bg-card text-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Showing {coaList.length} Accounts
                </span>
              </div>
            </div>

            <MasterDataTable<AccountRecord>
              title="Chart of Accounts"
              subtitle="Standard 5-level statutory accounts classification catalogue"
              screenCode="GL_ACCOUNTS"
              rowKey={(row) => row.accountId}
              data={coaList}
              columns={coaColumns}
              groupByOptions={coaGroupBy}
              searchPredicate={(row, q) =>
                row.accountCode.toLowerCase().includes(q.toLowerCase()) ||
                row.accountName.toLowerCase().includes(q.toLowerCase()) ||
                (row.description || '').toLowerCase().includes(q.toLowerCase())
              }
              isLoading={isCoaLoading}
            />
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 4: STATUTORY TRIAL BALANCE */}
        {/* ==================================================================== */}
        {activeTab === 'TRIAL_BALANCE' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-card p-4 rounded-xl border border-border shadow-sm">
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Statutory Trial Balance as of {trialBalanceData?.asOfDate || 'Today'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Double-entry reconciliation of all active ledger account debit & credit balances
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                    trialBalanceData?.isBalanced
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                      : 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300'
                  }`}
                >
                  {trialBalanceData?.isBalanced ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Trial Balance Balanced (Debit = Credit)
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      Out of Balance by ₹{trialBalanceData?.variance}
                    </>
                  )}
                </div>

                <button
                  onClick={() => {
                    setPrintDocumentType('TRIAL_BALANCE');
                    setIsPrintModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print Trial Balance
                </button>
              </div>
            </div>

            <div className="border border-border rounded-xl bg-card overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px] font-semibold tracking-wider border-b border-border">
                    <tr>
                      <th className="py-2.5 px-3">Account Code</th>
                      <th className="py-2.5 px-3">Account Title</th>
                      <th className="py-2.5 px-3">Class</th>
                      <th className="py-2.5 px-3 text-right">Gross Debit (₹)</th>
                      <th className="py-2.5 px-3 text-right">Gross Credit (₹)</th>
                      <th className="py-2.5 px-3 text-right">Net Debit (₹)</th>
                      <th className="py-2.5 px-3 text-right">Net Credit (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-mono">
                    {isTrialBalanceLoading ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-muted-foreground font-sans">
                          Loading trial balance...
                        </td>
                      </tr>
                    ) : (
                      trialBalanceData?.rows?.map((row: any) => (
                        <tr
                          key={row.accountId}
                          className={`hover:bg-muted/40 transition-colors ${
                            row.isGroup ? 'bg-muted/15 font-semibold' : ''
                          }`}
                        >
                          <td className="py-2 px-3 font-bold text-foreground">
                            {row.accountCode}
                          </td>
                          <td className="py-2 px-3 font-sans">
                            <span className={row.isGroup ? 'font-bold' : ''}>
                              {row.accountName}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-sans">
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-muted">
                              {row.accountType}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right text-muted-foreground">
                            {row.grossDebit > 0
                              ? `₹${row.grossDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                          <td className="py-2 px-3 text-right text-muted-foreground">
                            {row.grossCredit > 0
                              ? `₹${row.grossCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                            {row.netDebit > 0
                              ? `₹${row.netDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-indigo-600 dark:text-indigo-400">
                            {row.netCredit > 0
                              ? `₹${row.netCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot className="bg-muted/70 font-mono text-xs border-t-2 border-border font-bold">
                    <tr>
                      <td colSpan={5} className="py-3 px-3 font-sans text-sm font-bold">
                        Grand Totals (Trial Balance Equality Check)
                      </td>
                      <td className="py-3 px-3 text-right text-emerald-600 text-sm">
                        ₹{trialBalanceData?.grandTotalDebit?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right text-indigo-600 text-sm">
                        ₹{trialBalanceData?.grandTotalCredit?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 5: FINANCIAL STATEMENTS (P&L AND BALANCE SHEET) */}
        {/* ==================================================================== */}
        {activeTab === 'FINANCIALS' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Profit & Loss Statement */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-foreground">Statement of Profit & Loss</h3>
                  <p className="text-xs text-muted-foreground">For Financial Year 2026-27</p>
                </div>
                <button
                  onClick={() => {
                    setPrintDocumentType('P_AND_L');
                    setIsPrintModalOpen(true);
                  }}
                  className="p-1.5 hover:bg-muted rounded text-muted-foreground transition-colors"
                  title="Print P&L Statement"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>

              {/* Revenues */}
              <div>
                <h4 className="text-xs font-bold uppercase text-emerald-600 tracking-wider mb-2">
                  Operating Revenues & Income
                </h4>
                <div className="space-y-1.5 font-mono text-xs">
                  {financialsData?.profitAndLoss?.revenues?.map((r: any) => (
                    <div key={r.accountId} className="flex justify-between py-1 border-b border-border/50">
                      <span className="font-sans text-foreground">{r.accountName}</span>
                      <span className="font-semibold text-emerald-600">
                        ₹{r.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 font-bold text-sm bg-emerald-50/50 dark:bg-emerald-950/20 px-2 rounded">
                    <span className="font-sans">Total Revenue (A)</span>
                    <span className="text-emerald-700 dark:text-emerald-300">
                      ₹{financialsData?.profitAndLoss?.totalRevenue?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expenses */}
              <div>
                <h4 className="text-xs font-bold uppercase text-amber-600 tracking-wider mb-2">
                  Manufacturing & Operating Expenses
                </h4>
                <div className="space-y-1.5 font-mono text-xs">
                  {financialsData?.profitAndLoss?.expenses?.map((e: any) => (
                    <div key={e.accountId} className="flex justify-between py-1 border-b border-border/50">
                      <span className="font-sans text-foreground">{e.accountName}</span>
                      <span className="font-semibold text-amber-600">
                        ₹{e.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 font-bold text-sm bg-amber-50/50 dark:bg-amber-950/20 px-2 rounded">
                    <span className="font-sans">Total Expenses (B)</span>
                    <span className="text-amber-700 dark:text-amber-300">
                      ₹{financialsData?.profitAndLoss?.totalExpense?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Net Profit Summary */}
              <div className="pt-3 border-t-2 border-border flex justify-between items-center bg-primary/5 p-3 rounded-xl">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground block">
                    Net Profit / (Loss) for Period (A - B)
                  </span>
                  <span className="text-[11px] text-muted-foreground">Transferred to Balance Sheet Reserves</span>
                </div>
                <span
                  className={`text-xl font-bold font-mono ${
                    (financialsData?.profitAndLoss?.netProfit || 0) >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  ₹{financialsData?.profitAndLoss?.netProfit?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Balance Sheet */}
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <h3 className="text-base font-bold text-foreground">Balance Sheet</h3>
                  <p className="text-xs text-muted-foreground">As on {financialsData?.asOfDate || 'Current Period'}</p>
                </div>
                <button
                  onClick={() => {
                    setPrintDocumentType('BALANCE_SHEET');
                    setIsPrintModalOpen(true);
                  }}
                  className="p-1.5 hover:bg-muted rounded text-muted-foreground transition-colors"
                  title="Print Balance Sheet"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>

              {/* Assets */}
              <div>
                <h4 className="text-xs font-bold uppercase text-primary tracking-wider mb-2">
                  1. Assets (Application of Funds)
                </h4>
                <div className="space-y-1.5 font-mono text-xs">
                  {financialsData?.balanceSheet?.assets?.map((a: any) => (
                    <div key={a.accountId} className="flex justify-between py-1 border-b border-border/50">
                      <span className="font-sans text-foreground">{a.accountName}</span>
                      <span className="font-semibold text-foreground">
                        ₹{a.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 font-bold text-sm bg-primary/10 px-2 rounded">
                    <span className="font-sans text-primary">Total Assets</span>
                    <span className="text-primary font-bold">
                      ₹{financialsData?.balanceSheet?.totalAssets?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Liabilities & Equity */}
              <div>
                <h4 className="text-xs font-bold uppercase text-indigo-600 tracking-wider mb-2">
                  2. Liabilities & Equity (Sources of Funds)
                </h4>
                <div className="space-y-1.5 font-mono text-xs">
                  {financialsData?.balanceSheet?.equity?.map((eq: any) => (
                    <div key={eq.accountId} className="flex justify-between py-1 border-b border-border/50">
                      <span className="font-sans text-foreground">{eq.accountName}</span>
                      <span className="font-semibold text-foreground">
                        ₹{eq.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}

                  {/* Current Period P&L */}
                  <div className="flex justify-between py-1 border-b border-border/50 bg-emerald-50/30 px-1 rounded">
                    <span className="font-sans text-foreground italic">Current Period Net Profit / (Loss)</span>
                    <span className="font-semibold text-emerald-600">
                      ₹{financialsData?.balanceSheet?.currentPeriodNetProfit?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  {financialsData?.balanceSheet?.liabilities?.map((l: any) => (
                    <div key={l.accountId} className="flex justify-between py-1 border-b border-border/50">
                      <span className="font-sans text-foreground">{l.accountName}</span>
                      <span className="font-semibold text-foreground">
                        ₹{l.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}

                  <div className="flex justify-between py-2 font-bold text-sm bg-indigo-50/50 dark:bg-indigo-950/20 px-2 rounded">
                    <span className="font-sans text-indigo-700 dark:text-indigo-300">Total Liabilities & Equity</span>
                    <span className="text-indigo-700 dark:text-indigo-300 font-bold">
                      ₹{financialsData?.balanceSheet?.totalLiabilitiesAndEquity?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* Balance Check */}
              <div
                className={`p-3 rounded-xl border flex items-center justify-between text-xs font-semibold ${
                  financialsData?.balanceSheet?.isBalanced
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300'
                }`}
              >
                <span>Balance Sheet Equation Check (Assets = Liabilities + Equity)</span>
                <span>{financialsData?.balanceSheet?.isBalanced ? 'Balanced OK' : 'Out of Balance'}</span>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL 1: POST MANUAL JOURNAL VOUCHER */}
        {/* ==================================================================== */}
        {isPostVoucherModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  <h3 className="text-base font-bold text-foreground">Post Manual Journal Voucher</h3>
                </div>
                <button
                  onClick={() => setIsPostVoucherModalOpen(false)}
                  className="p-1 hover:bg-muted rounded text-muted-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 overflow-y-auto space-y-5 flex-1 text-xs">
                {/* Header Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Voucher Date *</label>
                    <input
                      type="date"
                      value={newVoucherHeader.voucherDate}
                      onChange={(e) =>
                        setNewVoucherHeader((prev) => ({ ...prev, voucherDate: e.target.value }))
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-semibold text-foreground">Voucher Type *</label>
                    <select
                      value={newVoucherHeader.voucherType}
                      onChange={(e) =>
                        setNewVoucherHeader((prev) => ({
                          ...prev,
                          voucherType: e.target.value as VoucherType,
                        }))
                      }
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                    >
                      <option value="GENERAL">General Journal</option>
                      <option value="PAYMENT">Bank Payment</option>
                      <option value="RECEIPT">Bank Receipt</option>
                      <option value="STOCK_ADJUSTMENT">Stock Adjustment</option>
                      <option value="ABSORPTION_COST">Absorption Costing</option>
                      <option value="OPENING_BALANCE">Opening Balance</option>
                    </select>
                  </div>

                  <div className="space-y-1 sm:col-span-1">
                    <label className="font-semibold text-foreground">Voucher Series</label>
                    <input
                      type="text"
                      disabled
                      value="Auto (JV-AHM-2627-XXXX)"
                      className="w-full px-3 py-1.5 rounded-lg border border-border bg-muted/50 text-muted-foreground font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Narration / Description *</label>
                  <textarea
                    rows={2}
                    placeholder="Enter journal description, purpose, or authorization reference..."
                    value={newVoucherHeader.narration}
                    onChange={(e) =>
                      setNewVoucherHeader((prev) => ({ ...prev, narration: e.target.value }))
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  />
                </div>

                {/* Multi-Line Items Grid */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground uppercase tracking-wider text-[11px]">
                      Double-Entry Lines (Debits & Credits)
                    </span>
                    <button
                      type="button"
                      onClick={addVoucherLine}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Line
                    </button>
                  </div>

                  <div className="border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-semibold border-b border-border">
                        <tr>
                          <th className="py-2 px-3 text-left w-64">Account *</th>
                          <th className="py-2 px-3 text-right w-32">Debit (₹)</th>
                          <th className="py-2 px-3 text-right w-32">Credit (₹)</th>
                          <th className="py-2 px-3 text-left w-40">Cost Center</th>
                          <th className="py-2 px-3 text-left w-40">Party Sub-Ledger</th>
                          <th className="py-2 px-3 text-left">Line Note</th>
                          <th className="py-2 px-2 text-center w-8"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {newVoucherLines.map((line, idx) => (
                          <tr key={idx} className="hover:bg-muted/30">
                            <td className="p-2">
                              <select
                                value={line.accountId}
                                onChange={(e) =>
                                  updateVoucherLine(idx, 'accountId', Number(e.target.value))
                                }
                                className="w-full px-2 py-1 rounded border border-border bg-background text-xs font-medium"
                              >
                                {(lookupsData?.accounts || [])
                                  .filter((a) => !a.isGroup)
                                  .map((a) => (
                                    <option key={a.accountId} value={a.accountId}>
                                      {a.accountCode} - {a.accountName}
                                    </option>
                                  ))}
                              </select>
                            </td>

                            <td className="p-2 text-right">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder="0.00"
                                value={line.debitAmount || ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  updateVoucherLine(idx, 'debitAmount', val);
                                  if (val > 0) updateVoucherLine(idx, 'creditAmount', 0);
                                }}
                                className="w-full px-2 py-1 rounded border border-border bg-background text-right font-mono font-semibold text-emerald-600"
                              />
                            </td>

                            <td className="p-2 text-right">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder="0.00"
                                value={line.creditAmount || ''}
                                onChange={(e) => {
                                  const val = parseFloat(e.target.value) || 0;
                                  updateVoucherLine(idx, 'creditAmount', val);
                                  if (val > 0) updateVoucherLine(idx, 'debitAmount', 0);
                                }}
                                className="w-full px-2 py-1 rounded border border-border bg-background text-right font-mono font-semibold text-indigo-600"
                              />
                            </td>

                            <td className="p-2">
                              <select
                                value={line.costCenterId || ''}
                                onChange={(e) =>
                                  updateVoucherLine(
                                    idx,
                                    'costCenterId',
                                    e.target.value ? Number(e.target.value) : undefined,
                                  )
                                }
                                className="w-full px-2 py-1 rounded border border-border bg-background text-xs"
                              >
                                <option value="">None</option>
                                {(lookupsData?.costCenters || []).map((cc) => (
                                  <option key={cc.costCenterId} value={cc.costCenterId}>
                                    {cc.costCenterCode}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="p-2">
                              <select
                                value={line.partyId || ''}
                                onChange={(e) =>
                                  updateVoucherLine(
                                    idx,
                                    'partyId',
                                    e.target.value ? Number(e.target.value) : undefined,
                                  )
                                }
                                className="w-full px-2 py-1 rounded border border-border bg-background text-xs"
                              >
                                <option value="">None</option>
                                {(lookupsData?.parties || []).map((p) => (
                                  <option key={p.partyId} value={p.partyId}>
                                    {p.partyName}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="p-2">
                              <input
                                type="text"
                                placeholder="Line narration..."
                                value={line.lineNarration || ''}
                                onChange={(e) =>
                                  updateVoucherLine(idx, 'lineNarration', e.target.value)
                                }
                                className="w-full px-2 py-1 rounded border border-border bg-background text-xs"
                              />
                            </td>

                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeVoucherLine(idx)}
                                className="text-muted-foreground hover:text-rose-600 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {/* Live Tally Footer */}
                      <tfoot className="bg-muted/80 font-mono text-xs border-t-2 border-border font-bold">
                        <tr>
                          <td className="p-2 text-foreground font-sans">Total Balanced Sum</td>
                          <td className="p-2 text-right text-emerald-600 font-bold">
                            ₹{totalVoucherDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="p-2 text-right text-indigo-600 font-bold">
                            ₹{totalVoucherCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </td>
                          <td colSpan={4} className="p-2 font-sans text-right">
                            {isVoucherBalanced ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                                <Check className="w-4 h-4" /> Double-Entry Balanced (Difference: ₹0.00)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                                <AlertCircle className="w-4 h-4" /> Out of balance by ₹
                                {Math.abs(totalVoucherDebit - totalVoucherCredit).toFixed(2)}
                              </span>
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  * Both debits and credits must balance before posting to the General Ledger.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPostVoucherModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={!isVoucherBalanced || !newVoucherHeader.narration || postVoucherMutation.isPending}
                    onClick={() => {
                      postVoucherMutation.mutate({
                        ...newVoucherHeader,
                        items: newVoucherLines.map((l) => ({
                          accountId: l.accountId,
                          debitAmount: Number(l.debitAmount || 0),
                          creditAmount: Number(l.creditAmount || 0),
                          partyId: l.partyId || undefined,
                          costCenterId: l.costCenterId || undefined,
                          lineNarration: l.lineNarration || undefined,
                        })),
                      });
                    }}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
                  >
                    {postVoucherMutation.isPending ? 'Posting...' : 'Post to General Ledger'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL 2: ADD / EDIT CHART OF ACCOUNT */}
        {/* ==================================================================== */}
        {isAccountModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
                <h3 className="text-base font-bold text-foreground">
                  {editingAccount ? `Edit Account: ${editingAccount.accountCode}` : 'Create New Ledger Account'}
                </h3>
                <button
                  onClick={() => setIsAccountModalOpen(false)}
                  className="p-1 hover:bg-muted rounded text-muted-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget;
                  const payload: any = {
                    accountName: (form.elements.namedItem('accountName') as HTMLInputElement).value,
                    description: (form.elements.namedItem('description') as HTMLInputElement).value,
                    isReconciliation: (form.elements.namedItem('isReconciliation') as HTMLInputElement).checked,
                  };

                  if (!editingAccount) {
                    payload.accountCode = (form.elements.namedItem('accountCode') as HTMLInputElement).value;
                    payload.accountType = (form.elements.namedItem('accountType') as HTMLSelectElement).value;
                    payload.normalBalance = (form.elements.namedItem('normalBalance') as HTMLSelectElement).value;
                    payload.isGroup = (form.elements.namedItem('isGroup') as HTMLInputElement).checked;
                    const parentId = (form.elements.namedItem('parentAccountId') as HTMLSelectElement).value;
                    if (parentId) payload.parentAccountId = Number(parentId);
                  }

                  saveAccountMutation.mutate(payload);
                }}
                className="p-5 space-y-4 text-xs"
              >
                {!editingAccount && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-foreground">Account Code *</label>
                      <input
                        name="accountCode"
                        required
                        placeholder="e.g. 111004"
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-background font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-foreground">Account Class *</label>
                      <select
                        name="accountType"
                        required
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                      >
                        <option value="ASSET">ASSET</option>
                        <option value="LIABILITY">LIABILITY</option>
                        <option value="EQUITY">EQUITY</option>
                        <option value="REVENUE">REVENUE</option>
                        <option value="EXPENSE">EXPENSE</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Account Name *</label>
                  <input
                    name="accountName"
                    required
                    defaultValue={editingAccount?.accountName || ''}
                    placeholder="e.g. Axis Bank Current Account"
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  />
                </div>

                {!editingAccount && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="font-semibold text-foreground">Parent Group</label>
                      <select
                        name="parentAccountId"
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                      >
                        <option value="">None (Top Level)</option>
                        {(lookupsData?.accounts || [])
                          .filter((a) => a.isGroup)
                          .map((a) => (
                            <option key={a.accountId} value={a.accountId}>
                              {a.accountCode} - {a.accountName}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-semibold text-foreground">Normal Balance</label>
                      <select
                        name="normalBalance"
                        defaultValue="DEBIT"
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-background font-mono"
                      >
                        <option value="DEBIT">DEBIT (Assets & Expenses)</option>
                        <option value="CREDIT">CREDIT (Liabilities & Revenues)</option>
                      </select>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Description / Notes</label>
                  <input
                    name="description"
                    defaultValue={editingAccount?.description || ''}
                    placeholder="Optional notes or account purpose..."
                    className="w-full px-3 py-1.5 rounded-lg border border-border bg-background"
                  />
                </div>

                <div className="flex items-center gap-6 pt-2">
                  {!editingAccount && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" name="isGroup" className="rounded border-border text-primary" />
                      <span className="font-medium text-foreground">Is Header Group (No Direct Postings)</span>
                    </label>
                  )}

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="isReconciliation"
                      defaultChecked={editingAccount?.isReconciliation}
                      className="rounded border-border text-primary"
                    />
                    <span className="font-medium text-foreground">Reconciliation Account (Bank/Cash)</span>
                  </label>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => setIsAccountModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveAccountMutation.isPending}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    {saveAccountMutation.isPending ? 'Saving...' : 'Save Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL 3: VIEW VOUCHER DETAILS */}
        {/* ==================================================================== */}
        {isViewVoucherModalOpen && viewingVoucher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      Journal Voucher: {viewingVoucher.voucherNo}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Date: {viewingVoucher.voucherDate} | Type: {viewingVoucher.voucherType}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsViewVoucherModalOpen(false)}
                  className="p-1 hover:bg-muted rounded text-muted-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                {/* Meta details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3 rounded-lg border border-border">
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Status</span>
                    <span
                      className={`font-semibold ${
                        viewingVoucher.status === 'POSTED' ? 'text-emerald-600' : 'text-rose-600'
                      }`}
                    >
                      {viewingVoucher.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Posted By</span>
                    <span className="font-semibold text-foreground">{viewingVoucher.postedByName}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Source Module</span>
                    <span className="font-semibold text-foreground">{viewingVoucher.sourceModule}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Source Ref No</span>
                    <span className="font-semibold text-foreground">{viewingVoucher.sourceRefNo || 'Manual'}</span>
                  </div>
                </div>

                <div>
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                    Narration
                  </span>
                  <p className="p-3 bg-muted/20 border border-border rounded-lg text-foreground italic">
                    "{viewingVoucher.narration}"
                  </p>
                </div>

                {/* Items */}
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-xs font-mono">
                    <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-semibold border-b border-border">
                      <tr>
                        <th className="py-2 px-3 text-left">Account</th>
                        <th className="py-2 px-3 text-left">Party / Cost Center</th>
                        <th className="py-2 px-3 text-right">Debit (₹)</th>
                        <th className="py-2 px-3 text-right">Credit (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {viewingVoucher.items?.map((it: any) => (
                        <tr key={it.journalItemId} className="hover:bg-muted/30">
                          <td className="py-2 px-3">
                            <span className="font-bold text-foreground">{it.accountCode}</span> —{' '}
                            <span className="font-sans text-muted-foreground">{it.accountName}</span>
                            {it.lineNarration && (
                              <span className="block text-[11px] font-sans text-muted-foreground italic">
                                {it.lineNarration}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-sans text-foreground">
                            {it.partyName || it.costCenterName || '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-emerald-600">
                            {it.debitAmount > 0
                              ? `₹${it.debitAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                          <td className="py-2 px-3 text-right font-semibold text-indigo-600">
                            {it.creditAmount > 0
                              ? `₹${it.creditAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted font-semibold text-xs border-t-2 border-border font-bold">
                      <tr>
                        <td colSpan={2} className="py-2.5 px-3 font-sans">
                          Total Double-Entry Balance
                        </td>
                        <td className="py-2.5 px-3 text-right text-emerald-600 font-bold">
                          ₹{viewingVoucher.totalDebit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-3 text-right text-indigo-600 font-bold">
                          ₹{viewingVoucher.totalCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="p-4 border-t border-border bg-muted/40 flex items-center justify-between">
                <button
                  onClick={() => {
                    setPrintDocumentType('VOUCHER');
                    setIsPrintModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-xs font-semibold"
                >
                  <Printer className="w-4 h-4" />
                  Print Official Voucher
                </button>

                <button
                  onClick={() => setIsViewVoucherModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL 4: REVERSE JOURNAL VOUCHER */}
        {/* ==================================================================== */}
        {isReverseModalOpen && reversingVoucher && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between p-4 border-b border-border bg-rose-500/10">
                <div className="flex items-center gap-2 text-rose-600">
                  <RotateCcw className="w-5 h-5" />
                  <h3 className="text-base font-bold">
                    Reverse Voucher: {reversingVoucher.voucherNo}
                  </h3>
                </div>
                <button
                  onClick={() => setIsReverseModalOpen(false)}
                  className="p-1 hover:bg-muted rounded text-muted-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <p className="text-muted-foreground leading-relaxed">
                  Reversing will generate a compensating journal voucher with debits and credits swapped, and mark{' '}
                  <span className="font-semibold text-foreground">{reversingVoucher.voucherNo}</span> as REVERSED.
                </p>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Reversal Justification / Reason *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Enter reason for reversal (e.g. Invoicing error, duplicate posting, accounting correction)..."
                    value={reversalReason}
                    onChange={(e) => setReversalReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-background"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-border bg-muted/40 flex items-center justify-end gap-2">
                <button
                  onClick={() => setIsReverseModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-border bg-card hover:bg-muted font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  disabled={!reversalReason || reverseVoucherMutation.isPending}
                  onClick={() =>
                    reverseVoucherMutation.mutate({
                      id: reversingVoucher.journalId,
                      reason: reversalReason,
                    })
                  }
                  className="px-4 py-2 rounded-lg bg-rose-600 text-white font-semibold text-xs hover:bg-rose-700 transition-colors disabled:opacity-50"
                >
                  {reverseVoucherMutation.isPending ? 'Reversing...' : 'Confirm Reversal'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL 5: 1-CLICK OPERATIONAL INTEGRATION BRIDGE */}
        {/* ==================================================================== */}
        {isOpsBridgeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-indigo-600" />
                  <div>
                    <h3 className="text-base font-bold text-foreground">
                      Automated Operational Postings Bridge
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Post unposted Sales Invoices, Purchase Invoices & Production Output directly to General Ledger
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpsBridgeModalOpen(false)}
                  className="p-1 hover:bg-muted rounded text-muted-foreground transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
                {/* Unposted Sales Invoices */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-foreground flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Unposted Sales Tax Invoices ({unpostedOpsData?.salesInvoices?.length || 0})
                    </h4>
                  </div>
                  {unpostedOpsData?.salesInvoices?.length === 0 ? (
                    <p className="text-muted-foreground italic text-xs p-3 bg-muted/20 rounded-lg">
                      All posted sales invoices have already been integrated into General Ledger.
                    </p>
                  ) : (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-semibold border-b border-border">
                          <tr>
                            <th className="py-2 px-3 text-left">Invoice No</th>
                            <th className="py-2 px-3 text-left">Customer</th>
                            <th className="py-2 px-3 text-right">Taxable</th>
                            <th className="py-2 px-3 text-right">GST Total</th>
                            <th className="py-2 px-3 text-right">Gross Total</th>
                            <th className="py-2 px-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {unpostedOpsData?.salesInvoices?.map((si: any) => (
                            <tr key={si.invoiceId} className="hover:bg-muted/30">
                              <td className="py-2 px-3 font-semibold text-primary">{si.invoiceNo}</td>
                              <td className="py-2 px-3 text-foreground">{si.customerName}</td>
                              <td className="py-2 px-3 text-right font-mono">
                                ₹{si.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                                ₹{(si.cgstAmount + si.sgstAmount + si.igstAmount).toLocaleString('en-IN', {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                                ₹{si.totalInvoiceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  disabled={autoPostOpMutation.isPending}
                                  onClick={() =>
                                    autoPostOpMutation.mutate({
                                      opType: 'SALES_INVOICE',
                                      opId: si.invoiceId,
                                    })
                                  }
                                  className="px-2 py-1 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90 font-medium"
                                >
                                  Post to GL
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Unposted Purchase Invoices */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-foreground flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Unposted Purchase Invoices ({unpostedOpsData?.purchaseInvoices?.length || 0})
                    </h4>
                  </div>
                  {unpostedOpsData?.purchaseInvoices?.length === 0 ? (
                    <p className="text-muted-foreground italic text-xs p-3 bg-muted/20 rounded-lg">
                      All purchase invoices have already been integrated into General Ledger.
                    </p>
                  ) : (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-semibold border-b border-border">
                          <tr>
                            <th className="py-2 px-3 text-left">Invoice No</th>
                            <th className="py-2 px-3 text-left">Vendor</th>
                            <th className="py-2 px-3 text-right">Taxable</th>
                            <th className="py-2 px-3 text-right">Input GST</th>
                            <th className="py-2 px-3 text-right">Total Payable</th>
                            <th className="py-2 px-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {unpostedOpsData?.purchaseInvoices?.map((pi: any) => (
                            <tr key={pi.invoiceId} className="hover:bg-muted/30">
                              <td className="py-2 px-3 font-semibold text-primary">{pi.invoiceNo}</td>
                              <td className="py-2 px-3 text-foreground">{pi.vendorName}</td>
                              <td className="py-2 px-3 text-right font-mono">
                                ₹{pi.taxableAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                                ₹{(pi.cgstAmount + pi.sgstAmount + pi.igstAmount).toLocaleString('en-IN', {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-foreground">
                                ₹{pi.totalInvoiceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  disabled={autoPostOpMutation.isPending}
                                  onClick={() =>
                                    autoPostOpMutation.mutate({
                                      opType: 'PURCHASE_INVOICE',
                                      opId: pi.invoiceId,
                                    })
                                  }
                                  className="px-2 py-1 bg-amber-600 text-white text-xs rounded hover:bg-amber-700 font-medium"
                                >
                                  Post to GL
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Unposted FG Receipts */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-bold text-foreground flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-500" />
                      Unposted FG Production Receipts ({unpostedOpsData?.fgReceipts?.length || 0})
                    </h4>
                  </div>
                  {unpostedOpsData?.fgReceipts?.length === 0 ? (
                    <p className="text-muted-foreground italic text-xs p-3 bg-muted/20 rounded-lg">
                      All finished goods production receipts have been capitalized to GL.
                    </p>
                  ) : (
                    <div className="border border-border rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted text-muted-foreground uppercase text-[10px] font-semibold border-b border-border">
                          <tr>
                            <th className="py-2 px-3 text-left">Receipt No</th>
                            <th className="py-2 px-3 text-left">Manufactured Item</th>
                            <th className="py-2 px-3 text-right">Accepted Qty</th>
                            <th className="py-2 px-3 text-right">Absorption Cost</th>
                            <th className="py-2 px-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {unpostedOpsData?.fgReceipts?.map((fgr: any) => (
                            <tr key={fgr.fgReceiptId} className="hover:bg-muted/30">
                              <td className="py-2 px-3 font-semibold text-primary">{fgr.fgReceiptNo}</td>
                              <td className="py-2 px-3 text-foreground">{fgr.itemName}</td>
                              <td className="py-2 px-3 text-right font-mono font-semibold">
                                {fgr.acceptedQty}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-purple-600">
                                ₹{fgr.totalProductionCost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  disabled={autoPostOpMutation.isPending}
                                  onClick={() =>
                                    autoPostOpMutation.mutate({
                                      opType: 'FG_RECEIPT',
                                      opId: fgr.fgReceiptId,
                                    })
                                  }
                                  className="px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 font-medium"
                                >
                                  Capitalize to GL
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-4 border-t border-border bg-muted/40 flex justify-end">
                <button
                  onClick={() => setIsOpsBridgeModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* MODAL 6: PRINTABLE STATUTORY FINANCIAL & VOUCHER REPORTS */}
        {/* ==================================================================== */}
        {isPrintModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
            <div className="bg-card border border-border rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between p-4 border-b border-border bg-muted/50 print:hidden">
                <div className="flex items-center gap-2">
                  <Printer className="w-5 h-5 text-primary" />
                  <span className="font-bold text-sm text-foreground">
                    Official Statutory Report & Document Print View
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    <Printer className="w-4 h-4" />
                    Print Document
                  </button>
                  <button
                    onClick={() => setIsPrintModalOpen(false)}
                    className="p-1 hover:bg-muted rounded text-muted-foreground"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Printable Canvas */}
              <div className="p-8 overflow-y-auto flex-1 bg-white text-black font-sans print:p-0">
                {/* Corporate Header */}
                <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-black">
                      KASHVIRA MANUFACTURING & PRECISION VALVES LTD.
                    </h1>
                    <p className="text-xs text-gray-700">
                      Plot 104-106, GIDC Industrial Estate, Vatva, Ahmedabad, Gujarat - 382445
                    </p>
                    <p className="text-xs text-gray-700">
                      GSTIN: 24AAACK1928L1Z5 | CIN: U29253GJ2026PLC088192 | Email: accounts@ks-mfg.com
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 border border-black rounded inline-block mb-1">
                      {printDocumentType === 'VOUCHER'
                        ? 'GENERAL JOURNAL VOUCHER'
                        : printDocumentType === 'STATEMENT'
                          ? 'GENERAL LEDGER ACCOUNT STATEMENT'
                          : printDocumentType === 'TRIAL_BALANCE'
                            ? 'STATUTORY TRIAL BALANCE'
                            : printDocumentType === 'P_AND_L'
                              ? 'PROFIT & LOSS STATEMENT'
                              : 'BALANCE SHEET'}
                    </span>
                    <p className="text-xs text-gray-600">
                      Date: {new Date().toLocaleDateString('en-GB')}
                    </p>
                  </div>
                </div>

                {/* Printable Content for Voucher */}
                {printDocumentType === 'VOUCHER' && viewingVoucher && (
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-2 gap-4 border border-black p-3 rounded">
                      <div>
                        <p><strong>Voucher No:</strong> {viewingVoucher.voucherNo}</p>
                        <p><strong>Voucher Date:</strong> {viewingVoucher.voucherDate}</p>
                        <p><strong>Voucher Type:</strong> {viewingVoucher.voucherType}</p>
                      </div>
                      <div>
                        <p><strong>Source Document:</strong> {viewingVoucher.sourceRefNo || 'Manual Entry'}</p>
                        <p><strong>Posted By:</strong> {viewingVoucher.postedByName}</p>
                        <p><strong>Status:</strong> {viewingVoucher.status}</p>
                      </div>
                    </div>

                    <div className="border border-black p-2.5 rounded bg-gray-50 italic">
                      <strong>Narration:</strong> {viewingVoucher.narration}
                    </div>

                    <table className="w-full text-xs border-collapse border border-black font-mono">
                      <thead className="bg-gray-100 font-bold border-b border-black">
                        <tr>
                          <th className="border border-black p-2 text-left">A/c Code</th>
                          <th className="border border-black p-2 text-left">Account Description</th>
                          <th className="border border-black p-2 text-left">Sub-Ledger Party / Cost Center</th>
                          <th className="border border-black p-2 text-right">Debit (INR)</th>
                          <th className="border border-black p-2 text-right">Credit (INR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewingVoucher.items?.map((it: any, idx: number) => (
                          <tr key={idx}>
                            <td className="border border-black p-2 font-bold">{it.accountCode}</td>
                            <td className="border border-black p-2 font-sans">{it.accountName}</td>
                            <td className="border border-black p-2 font-sans">{it.partyName || it.costCenterName || '—'}</td>
                            <td className="border border-black p-2 text-right font-bold">
                              {it.debitAmount > 0 ? it.debitAmount.toFixed(2) : '—'}
                            </td>
                            <td className="border border-black p-2 text-right font-bold">
                              {it.creditAmount > 0 ? it.creditAmount.toFixed(2) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-black font-bold bg-gray-50 text-xs">
                        <tr>
                          <td colSpan={3} className="border border-black p-2 font-sans">
                            Total Balanced Sum
                          </td>
                          <td className="border border-black p-2 text-right font-bold">
                            ₹{viewingVoucher.totalDebit.toFixed(2)}
                          </td>
                          <td className="border border-black p-2 text-right font-bold">
                            ₹{viewingVoucher.totalCredit.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* Printable Content for Statement */}
                {printDocumentType === 'STATEMENT' && statementData && (
                  <div className="space-y-4 text-xs">
                    <div className="border border-black p-3 rounded">
                      <h3 className="font-bold text-sm">
                        {statementData.account.accountCode} — {statementData.account.accountName}
                      </h3>
                      <p className="text-gray-600">
                        Class: {statementData.account.accountType} | Period: {statementData.fromDate} to {statementData.toDate}
                      </p>
                    </div>

                    <table className="w-full text-xs border-collapse border border-black font-mono">
                      <thead className="bg-gray-100 font-bold border-b border-black">
                        <tr>
                          <th className="border border-black p-2 text-left">Date</th>
                          <th className="border border-black p-2 text-left">Voucher</th>
                          <th className="border border-black p-2 text-left">Ref / Party</th>
                          <th className="border border-black p-2 text-left">Particulars</th>
                          <th className="border border-black p-2 text-right">Debit (INR)</th>
                          <th className="border border-black p-2 text-right">Credit (INR)</th>
                          <th className="border border-black p-2 text-right">Balance (INR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-gray-50 italic">
                          <td className="border border-black p-1.5">{statementData.fromDate}</td>
                          <td className="border border-black p-1.5">—</td>
                          <td className="border border-black p-1.5">—</td>
                          <td className="border border-black p-1.5">Opening Balance B/F</td>
                          <td className="border border-black p-1.5 text-right">—</td>
                          <td className="border border-black p-1.5 text-right">—</td>
                          <td className="border border-black p-1.5 text-right font-bold">
                            {statementData.openingBalance.toFixed(2)}
                          </td>
                        </tr>
                        {statementData.transactions?.map((t: any) => (
                          <tr key={t.journalItemId}>
                            <td className="border border-black p-1.5">{t.voucherDate}</td>
                            <td className="border border-black p-1.5 font-bold">{t.voucherNo}</td>
                            <td className="border border-black p-1.5 font-sans">{t.partyName || t.sourceRefNo || '—'}</td>
                            <td className="border border-black p-1.5 font-sans">{t.narration}</td>
                            <td className="border border-black p-1.5 text-right">{t.debitAmount > 0 ? t.debitAmount.toFixed(2) : '—'}</td>
                            <td className="border border-black p-1.5 text-right">{t.creditAmount > 0 ? t.creditAmount.toFixed(2) : '—'}</td>
                            <td className="border border-black p-1.5 text-right font-bold">{t.runningBalance.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-black font-bold bg-gray-100">
                        <tr>
                          <td colSpan={4} className="border border-black p-2 font-sans">Closing Balance</td>
                          <td className="border border-black p-2 text-right">₹{statementData.periodTotalDebit.toFixed(2)}</td>
                          <td className="border border-black p-2 text-right">₹{statementData.periodTotalCredit.toFixed(2)}</td>
                          <td className="border border-black p-2 text-right font-bold">₹{statementData.closingBalance.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* Printable Content for Trial Balance */}
                {printDocumentType === 'TRIAL_BALANCE' && trialBalanceData && (
                  <div className="space-y-4 text-xs">
                    <table className="w-full text-xs border-collapse border border-black font-mono">
                      <thead className="bg-gray-100 font-bold border-b border-black">
                        <tr>
                          <th className="border border-black p-2 text-left">Code</th>
                          <th className="border border-black p-2 text-left">Account Description</th>
                          <th className="border border-black p-2 text-left">Class</th>
                          <th className="border border-black p-2 text-right">Net Debit (INR)</th>
                          <th className="border border-black p-2 text-right">Net Credit (INR)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trialBalanceData.rows?.map((r: any) => (
                          <tr key={r.accountId} className={r.isGroup ? 'bg-gray-50 font-bold' : ''}>
                            <td className="border border-black p-1.5">{r.accountCode}</td>
                            <td className="border border-black p-1.5 font-sans">{r.accountName}</td>
                            <td className="border border-black p-1.5 font-sans">{r.accountType}</td>
                            <td className="border border-black p-1.5 text-right">{r.netDebit > 0 ? r.netDebit.toFixed(2) : '—'}</td>
                            <td className="border border-black p-1.5 text-right">{r.netCredit > 0 ? r.netCredit.toFixed(2) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t-2 border-black font-bold bg-gray-100">
                        <tr>
                          <td colSpan={3} className="border border-black p-2 font-sans font-bold">
                            Grand Totals (Trial Balance Equality Check)
                          </td>
                          <td className="border border-black p-2 text-right font-bold">
                            ₹{trialBalanceData.grandTotalDebit?.toFixed(2)}
                          </td>
                          <td className="border border-black p-2 text-right font-bold">
                            ₹{trialBalanceData.grandTotalCredit?.toFixed(2)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                {/* Statutory Sign-off Blocks */}
                <div className="mt-12 pt-8 border-t border-black grid grid-cols-3 gap-8 text-center text-xs">
                  <div>
                    <div className="h-12 border-b border-gray-400 mb-1" />
                    <span className="font-bold">Prepared By</span>
                    <p className="text-gray-500 text-[10px]">Accounts Executive / Costing</p>
                  </div>
                  <div>
                    <div className="h-12 border-b border-gray-400 mb-1" />
                    <span className="font-bold">Verified By</span>
                    <p className="text-gray-500 text-[10px]">Internal Audit / Finance Controller</p>
                  </div>
                  <div>
                    <div className="h-12 border-b border-gray-400 mb-1" />
                    <span className="font-bold">Authorized Signatory</span>
                    <p className="text-gray-500 text-[10px]">Chief Financial Officer / Director</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGate>
  );
};
