import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  CopyPlus,
  Edit3,
  Eye,
  GitBranch,
  Globe,
  Hash,
  Layers,
  Lock,
  Plus,
  RotateCcw,
  ShieldAlert,
  Sliders,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { apiClient, type ApiResponse } from '../../lib/apiClient';
import {
  MasterDataTable,
  type MasterTableColumn,
} from '../../components/common/MasterDataTable';
import { ConfirmDeleteModal } from '../../components/common/ConfirmDeleteModal';
import { PermissionGate } from '../../components/common/PermissionGate';

// ============================================================================
// TYPES & CATALOGUES
// ============================================================================

export type ConfigGroupType =
  | 'INVENTORY_VALUATION'
  | 'PRODUCTION_SHOPFLOOR'
  | 'QUALITY_CONTROL'
  | 'PROCUREMENT_APPROVAL'
  | 'GST_STATUTORY'
  | 'SECURITY_SESSION';

export type ConfigDataType = 'BOOLEAN' | 'NUMBER' | 'STRING' | 'ENUM' | 'JSON';
export type ConfigScopeLevel = 'GLOBAL' | 'COMPANY' | 'BRANCH';

export interface SystemConfigRecord {
  configId: number;
  configKey: string;
  configName: string;
  configGroup: ConfigGroupType;
  dataType: ConfigDataType;
  configValue: string;
  defaultValue: string;
  allowedValues: string | null;
  scopeLevel: ConfigScopeLevel;
  targetCompId: number | null;
  targetCompCode: string | null;
  targetCompName: string | null;
  targetBranchId: number | null;
  targetBranchCode: string | null;
  targetBranchName: string | null;
  description: string | null;
  isSystemLocked: boolean;
  isActive: boolean;
  isModifiedFromDefault: boolean;
  createdDate: string;
  updatedDate: string | null;
}

export type DocSeriesModuleType =
  | 'PROCUREMENT'
  | 'INVENTORY_WMS'
  | 'QUALITY'
  | 'PRODUCTION'
  | 'SALES_DISPATCH';

export type DocSeriesResetFrequency = 'FYEAR' | 'MONTHLY' | 'NEVER';

export interface DocNumberSeriesRecord {
  seriesId: number;
  seriesCode: string;
  seriesName: string;
  docTypeCode: string;
  docTypeName: string;
  moduleName: DocSeriesModuleType;
  targetCompId: number;
  targetCompCode: string;
  targetCompName: string;
  targetBranchId: number;
  targetBranchCode: string;
  targetBranchName: string;
  targetFyearId: number;
  targetFyearCode: string;
  targetFyearName: string;
  prefixTemplate: string;
  suffixTemplate: string | null;
  separatorChar: string;
  paddingDigits: number;
  startingNo: number;
  currentNextNo: number;
  issuedDocumentsCount: number;
  resetFrequency: DocSeriesResetFrequency;
  allowManualOverride: boolean;
  isDefault: boolean;
  isActive: boolean;
  firstFormattedVoucherNo: string;
  nextFormattedVoucherNo: string;
  createdDate: string;
  updatedDate: string | null;
}

interface CompanyOption {
  compId: number;
  compCode: string;
  compName: string;
  isActive: boolean;
}

interface BranchOption {
  branchId: number;
  compId: number;
  branchCode: string;
  branchName: string;
  branchType: string;
  isActive: boolean;
}

interface FinancialYearOption {
  fyearId: number;
  compId: number;
  fyearCode: string;
  fyearName: string;
  isCurrent: boolean;
  isClosed: boolean;
}

const CONFIG_GROUPS: { value: ConfigGroupType; label: string; badgeClass: string }[] = [
  {
    value: 'INVENTORY_VALUATION',
    label: 'Inventory & Valuation',
    badgeClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  },
  {
    value: 'PRODUCTION_SHOPFLOOR',
    label: 'Production & Shopfloor',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  },
  {
    value: 'QUALITY_CONTROL',
    label: 'Quality Assurance (QC)',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  {
    value: 'PROCUREMENT_APPROVAL',
    label: 'Procurement & Tolerance',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  {
    value: 'GST_STATUTORY',
    label: 'GST & Statutory Compliance',
    badgeClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
  },
  {
    value: 'SECURITY_SESSION',
    label: 'Security & Auth Session',
    badgeClass: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  },
];

const DOC_TYPES_CATALOGUE: {
  code: string;
  name: string;
  module: DocSeriesModuleType;
}[] = [
  { code: 'PO', name: 'Purchase Order', module: 'PROCUREMENT' },
  { code: 'JOB_WORK_OUT', name: 'Outward Job-Work Challan', module: 'PROCUREMENT' },
  { code: 'GRN', name: 'Goods Receipt Note (GRN)', module: 'INVENTORY_WMS' },
  { code: 'MAT_ISSUE', name: 'Material Issue Slip (MIS)', module: 'INVENTORY_WMS' },
  { code: 'QC_INSP', name: 'Quality Inspection Lot', module: 'QUALITY' },
  { code: 'WORK_ORDER', name: 'Manufacturing Work Order', module: 'PRODUCTION' },
  { code: 'PROD_RECEIPT', name: 'Production Receipt Note', module: 'PRODUCTION' },
  { code: 'SALES_ORDER', name: 'Customer Sales Order', module: 'SALES_DISPATCH' },
  { code: 'DELIVERY_CHALLAN', name: 'Delivery Challan', module: 'SALES_DISPATCH' },
  { code: 'SALES_INVOICE', name: 'GST Tax Invoice', module: 'SALES_DISPATCH' },
];

function formatClientVoucherPreview(params: {
  prefixTemplate: string;
  suffixTemplate?: string | null;
  separatorChar: string;
  paddingDigits: number;
  sequenceNo: number;
}): string {
  const sep = params.separatorChar || '/';
  const prefix = (params.prefixTemplate || '').trim().toUpperCase();
  const suffix = (params.suffixTemplate || '').trim().toUpperCase();
  const digits = Math.max(2, Math.min(10, Number(params.paddingDigits) || 4));
  const paddedSeq = String(Math.max(1, Number(params.sequenceNo) || 1)).padStart(
    digits,
    '0',
  );
  const parts = [prefix, suffix, paddedSeq].filter(Boolean);
  return parts.join(sep);
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

export const SystemConfigPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'CONFIG_MATRIX' | 'DOC_SERIES'>(
    'CONFIG_MATRIX',
  );

  // Filters for Tab 1: System Config Matrix
  const [filterGroup, setFilterGroup] = useState<string>('');
  const [filterScope, setFilterScope] = useState<string>('');

  // Filters for Tab 2: Document Numbering Series
  const [filterModule, setFilterModule] = useState<string>('');
  const [filterCompId, setFilterCompId] = useState<string>('');
  const [filterBranchId, setFilterBranchId] = useState<string>('');
  const [filterFyearId, setFilterFyearId] = useState<string>('');

  // Modal State — Tab 1: System Config
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SystemConfigRecord | null>(
    null,
  );
  const [configFormError, setConfigFormError] = useState<string | null>(null);
  const [configForm, setConfigForm] = useState({
    configKey: '',
    configName: '',
    configGroup: 'INVENTORY_VALUATION' as ConfigGroupType,
    dataType: 'BOOLEAN' as ConfigDataType,
    configValue: 'TRUE',
    defaultValue: 'TRUE',
    allowedValues: '',
    scopeLevel: 'GLOBAL' as ConfigScopeLevel,
    targetCompId: '' as string | number,
    targetBranchId: '' as string | number,
    description: '',
    isActive: true,
  });

  // Modal State — Tab 2: Document Numbering Series
  const [isSeriesModalOpen, setIsSeriesModalOpen] = useState(false);
  const [editingSeries, setEditingSeries] =
    useState<DocNumberSeriesRecord | null>(null);
  const [seriesFormError, setSeriesFormError] = useState<string | null>(null);
  const [seriesForm, setSeriesForm] = useState({
    seriesCode: '',
    seriesName: '',
    docTypeCode: 'PO',
    docTypeName: 'Purchase Order',
    moduleName: 'PROCUREMENT' as DocSeriesModuleType,
    targetCompId: 1001,
    targetBranchId: 1001,
    targetFyearId: 1001,
    prefixTemplate: 'KSMFG/AHM/PO',
    suffixTemplate: '26-27',
    separatorChar: '/',
    paddingDigits: 4,
    startingNo: 1,
    currentNextNo: 1,
    resetFrequency: 'FYEAR' as DocSeriesResetFrequency,
    allowManualOverride: false,
    isDefault: true,
    isActive: true,
  });

  // Sequence Simulator Modal State
  const [previewSeriesId, setPreviewSeriesId] = useState<number | null>(null);

  // Delete Confirmation Modal State
  const [deletingConfig, setDeletingConfig] =
    useState<SystemConfigRecord | null>(null);
  const [deletingSeries, setDeletingSeries] =
    useState<DocNumberSeriesRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // ==========================================================================
  // DATA QUERIES (Strictly PostgreSQL API — Zero Dummy Data)
  // ==========================================================================

  const { data: companies = [] } = useQuery({
    queryKey: ['org', 'companies'],
    queryFn: async () => {
      const res =
        await apiClient.get<ApiResponse<CompanyOption[]>>('/org/companies');
      return res.data.data || [];
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['org', 'branches'],
    queryFn: async () => {
      const res =
        await apiClient.get<ApiResponse<BranchOption[]>>('/org/branches');
      return res.data.data || [];
    },
  });

  const { data: financialYears = [] } = useQuery({
    queryKey: ['org', 'financial-years'],
    queryFn: async () => {
      const res = await apiClient.get<ApiResponse<FinancialYearOption[]>>(
        '/org/financial-years',
      );
      return res.data.data || [];
    },
  });

  const {
    data: configs = [],
    isLoading: isConfigsLoading,
  } = useQuery({
    queryKey: ['admin', 'configs', filterGroup, filterScope],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filterGroup) params.configGroup = filterGroup;
      if (filterScope) params.scopeLevel = filterScope;
      const res = await apiClient.get<ApiResponse<SystemConfigRecord[]>>(
        '/admin/configurations/configs',
        { params },
      );
      return res.data.data || [];
    },
  });

  const {
    data: docSeries = [],
    isLoading: isDocSeriesLoading,
  } = useQuery({
    queryKey: [
      'admin',
      'doc-series',
      filterModule,
      filterCompId,
      filterBranchId,
      filterFyearId,
    ],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filterModule) params.moduleName = filterModule;
      if (filterCompId) params.targetCompId = filterCompId;
      if (filterBranchId) params.targetBranchId = filterBranchId;
      if (filterFyearId) params.targetFyearId = filterFyearId;
      const res = await apiClient.get<ApiResponse<DocNumberSeriesRecord[]>>(
        '/admin/configurations/doc-series',
        { params },
      );
      return res.data.data || [];
    },
  });

  const { data: sequencePreviewData, isLoading: isPreviewLoading } = useQuery({
    queryKey: ['admin', 'doc-series-preview', previewSeriesId],
    enabled: previewSeriesId !== null,
    queryFn: async () => {
      const res = await apiClient.get<
        ApiResponse<{
          series: DocNumberSeriesRecord;
          nextFiveSamples: {
            step: number;
            sequenceNo: number;
            formattedVoucherNo: string;
          }[];
        }>
      >(`/admin/configurations/doc-series/${previewSeriesId}/preview`);
      return res.data.data;
    },
  });

  // ==========================================================================
  // MUTATIONS
  // ==========================================================================

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        configKey: configForm.configKey.trim().toUpperCase(),
        configName: configForm.configName.trim(),
        configGroup: configForm.configGroup,
        dataType: configForm.dataType,
        configValue: configForm.configValue.trim(),
        defaultValue: configForm.defaultValue.trim(),
        allowedValues:
          configForm.dataType === 'ENUM'
            ? configForm.allowedValues.trim()
            : null,
        scopeLevel: configForm.scopeLevel,
        targetCompId:
          configForm.scopeLevel === 'GLOBAL'
            ? null
            : Number(configForm.targetCompId) || null,
        targetBranchId:
          configForm.scopeLevel === 'BRANCH'
            ? Number(configForm.targetBranchId) || null
            : null,
        description: configForm.description.trim() || null,
        isActive: configForm.isActive,
      };

      if (editingConfig) {
        const res = await apiClient.put<ApiResponse<SystemConfigRecord>>(
          `/admin/configurations/configs/${editingConfig.configId}`,
          payload,
        );
        return res.data.data;
      } else {
        const res = await apiClient.post<ApiResponse<SystemConfigRecord>>(
          '/admin/configurations/configs',
          payload,
        );
        return res.data.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'configs'] });
      setIsConfigModalOpen(false);
      setEditingConfig(null);
      setConfigFormError(null);
    },
    onError: (err: any) => {
      setConfigFormError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Failed to save system configuration rule.',
      );
    },
  });

  const resetDefaultMutation = useMutation({
    mutationFn: async (configId: number) => {
      await apiClient.put(
        `/admin/configurations/configs/${configId}/reset-default`,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'configs'] });
    },
  });

  const deleteConfigMutation = useMutation({
    mutationFn: async (configId: number) => {
      await apiClient.delete(`/admin/configurations/configs/${configId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'configs'] });
      setDeletingConfig(null);
      setDeleteError(null);
    },
    onError: (err: any) => {
      setDeleteError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Unable to delete system configuration parameter.',
      );
    },
  });

  const saveSeriesMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        seriesCode: seriesForm.seriesCode.trim().toUpperCase(),
        seriesName: seriesForm.seriesName.trim(),
        docTypeCode: seriesForm.docTypeCode,
        docTypeName: seriesForm.docTypeName,
        moduleName: seriesForm.moduleName,
        targetCompId: Number(seriesForm.targetCompId),
        targetBranchId: Number(seriesForm.targetBranchId),
        targetFyearId: Number(seriesForm.targetFyearId),
        prefixTemplate: seriesForm.prefixTemplate.trim().toUpperCase(),
        suffixTemplate: seriesForm.suffixTemplate.trim() || null,
        separatorChar: seriesForm.separatorChar || '/',
        paddingDigits: Number(seriesForm.paddingDigits) || 4,
        startingNo: Number(seriesForm.startingNo) || 1,
        currentNextNo: Number(seriesForm.currentNextNo) || 1,
        resetFrequency: seriesForm.resetFrequency,
        allowManualOverride: seriesForm.allowManualOverride,
        isDefault: seriesForm.isDefault,
        isActive: seriesForm.isActive,
      };

      if (editingSeries) {
        const res = await apiClient.put<ApiResponse<DocNumberSeriesRecord>>(
          `/admin/configurations/doc-series/${editingSeries.seriesId}`,
          payload,
        );
        return res.data.data;
      } else {
        const res = await apiClient.post<ApiResponse<DocNumberSeriesRecord>>(
          '/admin/configurations/doc-series',
          payload,
        );
        return res.data.data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'doc-series'] });
      setIsSeriesModalOpen(false);
      setEditingSeries(null);
      setSeriesFormError(null);
    },
    onError: (err: any) => {
      setSeriesFormError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Failed to save document numbering series.',
      );
    },
  });

  const deleteSeriesMutation = useMutation({
    mutationFn: async (seriesId: number) => {
      await apiClient.delete(`/admin/configurations/doc-series/${seriesId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'doc-series'] });
      setDeletingSeries(null);
      setDeleteError(null);
    },
    onError: (err: any) => {
      setDeleteError(
        err?.response?.data?.error?.message ||
          err?.message ||
          'Unable to delete document numbering series.',
      );
    },
  });

  // ==========================================================================
  // HANDLERS
  // ==========================================================================

  const openCreateConfigModal = (templateRow?: SystemConfigRecord) => {
    setEditingConfig(null);
    setConfigFormError(null);
    const defaultCompId = companies[0]?.compId || 1001;
    const defaultBranchId =
      branches.find((b) => b.compId === defaultCompId)?.branchId || 1001;

    if (templateRow) {
      // Pre-fill as a Company or Branch override of an existing global parameter
      setConfigForm({
        configKey: templateRow.configKey,
        configName: `${templateRow.configName} (Plant Override)`,
        configGroup: templateRow.configGroup,
        dataType: templateRow.dataType,
        configValue: templateRow.configValue,
        defaultValue: templateRow.defaultValue,
        allowedValues: templateRow.allowedValues || '',
        scopeLevel: 'BRANCH',
        targetCompId: defaultCompId,
        targetBranchId: defaultBranchId,
        description: templateRow.description || '',
        isActive: true,
      });
    } else {
      setConfigForm({
        configKey: '',
        configName: '',
        configGroup: 'INVENTORY_VALUATION',
        dataType: 'BOOLEAN',
        configValue: 'TRUE',
        defaultValue: 'TRUE',
        allowedValues: '',
        scopeLevel: 'GLOBAL',
        targetCompId: '',
        targetBranchId: '',
        description: '',
        isActive: true,
      });
    }
    setIsConfigModalOpen(true);
  };

  const openEditConfigModal = (row: SystemConfigRecord) => {
    setEditingConfig(row);
    setConfigFormError(null);
    setConfigForm({
      configKey: row.configKey,
      configName: row.configName,
      configGroup: row.configGroup,
      dataType: row.dataType,
      configValue: row.configValue,
      defaultValue: row.defaultValue,
      allowedValues: row.allowedValues || '',
      scopeLevel: row.scopeLevel,
      targetCompId: row.targetCompId || '',
      targetBranchId: row.targetBranchId || '',
      description: row.description || '',
      isActive: row.isActive,
    });
    setIsConfigModalOpen(true);
  };

  const openCreateSeriesModal = () => {
    setEditingSeries(null);
    setSeriesFormError(null);
    const defaultComp = companies[0]?.compId || 1001;
    const defaultBranch =
      branches.find((b) => b.compId === defaultComp)?.branchId || 1001;
    const defaultFy =
      financialYears.find((f) => f.compId === defaultComp && f.isCurrent)
        ?.fyearId ||
      financialYears[0]?.fyearId ||
      1001;

    setSeriesForm({
      seriesCode: '',
      seriesName: '',
      docTypeCode: 'PO',
      docTypeName: 'Purchase Order',
      moduleName: 'PROCUREMENT',
      targetCompId: defaultComp,
      targetBranchId: defaultBranch,
      targetFyearId: defaultFy,
      prefixTemplate: 'KSMFG/AHM/PO',
      suffixTemplate: '26-27',
      separatorChar: '/',
      paddingDigits: 4,
      startingNo: 1,
      currentNextNo: 1,
      resetFrequency: 'FYEAR',
      allowManualOverride: false,
      isDefault: true,
      isActive: true,
    });
    setIsSeriesModalOpen(true);
  };

  const openEditSeriesModal = (row: DocNumberSeriesRecord) => {
    setEditingSeries(row);
    setSeriesFormError(null);
    setSeriesForm({
      seriesCode: row.seriesCode,
      seriesName: row.seriesName,
      docTypeCode: row.docTypeCode,
      docTypeName: row.docTypeName,
      moduleName: row.moduleName,
      targetCompId: row.targetCompId,
      targetBranchId: row.targetBranchId,
      targetFyearId: row.targetFyearId,
      prefixTemplate: row.prefixTemplate,
      suffixTemplate: row.suffixTemplate || '',
      separatorChar: row.separatorChar || '/',
      paddingDigits: row.paddingDigits,
      startingNo: row.startingNo,
      currentNextNo: row.currentNextNo,
      resetFrequency: row.resetFrequency,
      allowManualOverride: row.allowManualOverride,
      isDefault: row.isDefault,
      isActive: row.isActive,
    });
    setIsSeriesModalOpen(true);
  };

  const handleExportCsv = async () => {
    await apiClient.post('/admin/configurations/action/EXPORT');
    if (activeTab === 'CONFIG_MATRIX') {
      const headers = [
        'Config ID',
        'Config Key',
        'Config Name',
        'Domain Group',
        'Scope',
        'Target Company',
        'Target Plant',
        'Data Type',
        'Active Value',
        'Default Value',
        'System Locked',
      ];
      const csvRows = configs.map((c) => [
        c.configId,
        `"${c.configKey}"`,
        `"${c.configName.replace(/"/g, '""')}"`,
        c.configGroup,
        c.scopeLevel,
        c.targetCompCode || 'GLOBAL',
        c.targetBranchCode || 'ALL',
        c.dataType,
        `"${c.configValue}"`,
        `"${c.defaultValue}"`,
        c.isSystemLocked ? 'YES' : 'NO',
      ]);
      const csv = [headers.join(','), ...csvRows.map((r) => r.join(','))].join(
        '\n',
      );
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ks_mfg_system_config_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const headers = [
        'Series ID',
        'Series Code',
        'Series Name',
        'Doc Type',
        'Module',
        'Company',
        'Plant/Branch',
        'Financial Year',
        'Next Voucher Preview',
        'Current Next No',
        'Issued Docs',
        'Reset Frequency',
      ];
      const csvRows = docSeries.map((s) => [
        s.seriesId,
        `"${s.seriesCode}"`,
        `"${s.seriesName.replace(/"/g, '""')}"`,
        s.docTypeCode,
        s.moduleName,
        s.targetCompCode,
        s.targetBranchCode,
        s.targetFyearCode,
        `"${s.nextFormattedVoucherNo}"`,
        s.currentNextNo,
        s.issuedDocumentsCount,
        s.resetFrequency,
      ]);
      const csv = [headers.join(','), ...csvRows.map((r) => r.join(','))].join(
        '\n',
      );
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ks_mfg_doc_number_series_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handlePrint = async () => {
    await apiClient.post('/admin/configurations/action/PRINT');
    window.print();
  };

  // ==========================================================================
  // KPI METRICS
  // ==========================================================================

  const kpiStats = useMemo(() => {
    const totalConfigs = configs.length;
    const lockedConfigs = configs.filter((c) => c.isSystemLocked).length;
    const scopedOverrides = configs.filter(
      (c) => c.scopeLevel !== 'GLOBAL',
    ).length;
    const modifiedFromDefault = configs.filter(
      (c) => c.isModifiedFromDefault,
    ).length;
    const totalSeries = docSeries.length;
    const totalIssuedDocs = docSeries.reduce(
      (acc, s) => acc + s.issuedDocumentsCount,
      0,
    );
    return {
      totalConfigs,
      lockedConfigs,
      scopedOverrides,
      modifiedFromDefault,
      totalSeries,
      totalIssuedDocs,
    };
  }, [configs, docSeries]);

  // ==========================================================================
  // TABLE COLUMNS — TAB 1: SYSTEM CONFIGURATION MATRIX
  // ==========================================================================

  const configColumns: MasterTableColumn<SystemConfigRecord>[] = useMemo(
    () => [
      {
        key: 'configKey',
        header: 'Parameter Key & Name',
        render: (row) => (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="font-mono-code text-xs font-bold text-[var(--brand-600)] dark:text-[var(--brand-400)]">
                {row.configKey}
              </span>
              {row.isSystemLocked && (
                <span
                  title="Core System Parameter (Key & Type Locked)"
                  className="inline-flex items-center gap-1 rounded-md bg-slate-500/10 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-500/20"
                >
                  <Lock className="h-2.5 w-2.5" />
                  SYSTEM
                </span>
              )}
            </div>
            <div className="text-xs font-semibold text-[var(--text-primary)]">
              {row.configName}
            </div>
            {row.description && (
              <div className="text-[11px] text-[var(--text-muted)] line-clamp-1 max-w-md">
                {row.description}
              </div>
            )}
          </div>
        ),
      },
      {
        key: 'configGroup',
        header: 'Domain Group',
        render: (row) => {
          const meta = CONFIG_GROUPS.find((g) => g.value === row.configGroup);
          return (
            <span
              className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-bold ${
                meta?.badgeClass ||
                'bg-slate-500/10 text-slate-600 border-slate-500/20'
              }`}
            >
              {meta?.label || row.configGroup}
            </span>
          );
        },
      },
      {
        key: 'scopeLevel',
        header: 'Hierarchy Scope',
        render: (row) => {
          if (row.scopeLevel === 'GLOBAL') {
            return (
              <span className="inline-flex items-center gap-1 rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                <Globe className="h-3 w-3" />
                GLOBAL DEFAULT
              </span>
            );
          }
          if (row.scopeLevel === 'COMPANY') {
            return (
              <div className="space-y-0.5">
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                  <Building2 className="h-3 w-3" />
                  COMPANY OVERRIDE
                </span>
                <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
                  {row.targetCompCode} — {row.targetCompName}
                </div>
              </div>
            );
          }
          return (
            <div className="space-y-0.5">
              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <GitBranch className="h-3 w-3" />
                PLANT OVERRIDE
              </span>
              <div className="text-[11px] font-semibold text-[var(--text-secondary)]">
                {row.targetCompCode} / {row.targetBranchCode} ({row.targetBranchName})
              </div>
            </div>
          );
        },
      },
      {
        key: 'configValue',
        header: 'Active Value vs. Default',
        render: (row) => (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {row.dataType === 'BOOLEAN' ? (
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono-code text-xs font-extrabold ${
                    row.configValue === 'TRUE'
                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {row.configValue}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-md bg-[var(--bg-subtle)] border border-[var(--border-subtle)] px-2 py-0.5 font-mono-code text-xs font-extrabold text-[var(--text-primary)]">
                  {row.configValue}
                </span>
              )}
              <span className="text-[10px] font-bold uppercase text-[var(--text-muted)]">
                {row.dataType}
              </span>
              {row.isModifiedFromDefault && (
                <span className="inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                  CUSTOMIZED
                </span>
              )}
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Factory Default:{' '}
              <code className="font-mono-code font-semibold text-[var(--text-secondary)]">
                {row.defaultValue}
              </code>
            </div>
          </div>
        ),
      },
      {
        key: 'isActive',
        header: 'Status',
        render: (row) =>
          row.isActive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-bold text-slate-500">
              Inactive
            </span>
          ),
      },
    ],
    [],
  );

  // ==========================================================================
  // TABLE COLUMNS — TAB 2: DOCUMENT NUMBERING SERIES ENGINE
  // ==========================================================================

  const docSeriesColumns: MasterTableColumn<DocNumberSeriesRecord>[] = useMemo(
    () => [
      {
        key: 'seriesCode',
        header: 'Series Code & Document Type',
        render: (row) => (
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="font-mono-code text-xs font-bold text-[var(--brand-600)] dark:text-[var(--brand-400)]">
                {row.seriesCode}
              </span>
              {row.isDefault && (
                <span className="inline-flex items-center rounded-md bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  DEFAULT
                </span>
              )}
            </div>
            <div className="text-xs font-semibold text-[var(--text-primary)]">
              {row.seriesName}
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Doc Type:{' '}
              <span className="font-mono-code font-semibold text-[var(--text-secondary)]">
                {row.docTypeCode}
              </span>{' '}
              ({row.docTypeName})
            </div>
          </div>
        ),
      },
      {
        key: 'moduleName',
        header: 'Module & Plant Scope',
        render: (row) => (
          <div className="space-y-1">
            <span className="inline-flex items-center rounded-md bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
              {row.moduleName}
            </span>
            <div className="text-xs font-semibold text-[var(--text-primary)]">
              {row.targetCompCode} / {row.targetBranchCode}
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              {row.targetBranchName} • FY{' '}
              <span className="font-mono-code font-bold text-[var(--text-secondary)]">
                {row.targetFyearCode}
              </span>
            </div>
          </div>
        ),
      },
      {
        key: 'nextFormattedVoucherNo',
        header: 'Next Generated Voucher No',
        render: (row) => (
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/15 border border-[var(--brand-500)]/30 px-2.5 py-1 font-mono-code text-xs font-extrabold text-[var(--brand-700)] dark:text-[var(--brand-300)]">
              <Hash className="h-3.5 w-3.5" />
              {row.nextFormattedVoucherNo}
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Starts at:{' '}
              <code className="font-mono-code">{row.firstFormattedVoucherNo}</code>
            </div>
          </div>
        ),
      },
      {
        key: 'currentNextNo',
        header: 'Running Counter & Reset Policy',
        render: (row) => (
          <div className="space-y-0.5 text-xs">
            <div className="font-semibold text-[var(--text-primary)]">
              Next Seq:{' '}
              <span className="font-mono-code font-bold text-[var(--brand-600)] dark:text-[var(--brand-400)]">
                #{row.currentNextNo}
              </span>{' '}
              <span className="text-[var(--text-muted)]">
                ({row.issuedDocumentsCount} issued)
              </span>
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">
              Padding: <span className="font-mono-code">{row.paddingDigits}d</span> • Reset:{' '}
              <span className="font-semibold text-[var(--text-secondary)]">
                {row.resetFrequency}
              </span>{' '}
              • Manual:{' '}
              <span className="font-semibold">
                {row.allowManualOverride ? 'Allowed' : 'Auto-Locked'}
              </span>
            </div>
          </div>
        ),
      },
      {
        key: 'isActive',
        header: 'Status',
        render: (row) =>
          row.isActive ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2.5 py-0.5 text-xs font-bold text-slate-500">
              Inactive
            </span>
          ),
      },
    ],
    [],
  );

  // Filtered branches for modals
  const configModalBranches = useMemo(
    () =>
      branches.filter(
        (b) => !configForm.targetCompId || b.compId === Number(configForm.targetCompId),
      ),
    [branches, configForm.targetCompId],
  );

  const seriesModalBranches = useMemo(
    () =>
      branches.filter((b) => b.compId === Number(seriesForm.targetCompId)),
    [branches, seriesForm.targetCompId],
  );

  const seriesModalFyears = useMemo(
    () =>
      financialYears.filter((f) => f.compId === Number(seriesForm.targetCompId)),
    [financialYears, seriesForm.targetCompId],
  );

  const liveModalVoucherPreview = useMemo(
    () =>
      formatClientVoucherPreview({
        prefixTemplate: seriesForm.prefixTemplate,
        suffixTemplate: seriesForm.suffixTemplate,
        separatorChar: seriesForm.separatorChar,
        paddingDigits: seriesForm.paddingDigits,
        sequenceNo: seriesForm.currentNextNo,
      }),
    [
      seriesForm.prefixTemplate,
      seriesForm.suffixTemplate,
      seriesForm.separatorChar,
      seriesForm.paddingDigits,
      seriesForm.currentNextNo,
    ],
  );

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-500)]/10 text-[var(--brand-600)] dark:text-[var(--brand-400)]">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-[var(--text-primary)]">
                System Configuration Matrix & Document Numbering Engine
              </h1>
              <p className="text-xs text-[var(--text-muted)]">
                Global / Company / Plant hierarchical ERP parameters (
                <code className="font-mono-code">tbl_sys_config</code>) and
                multi-plant, financial-year voucher numbering series (
                <code className="font-mono-code">tbl_sys_doc_number_series</code>)
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PermissionGate screen="CONFIG_MASTER" action="ADD">
            {activeTab === 'CONFIG_MATRIX' ? (
              <button
                type="button"
                onClick={() => openCreateConfigModal()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[var(--brand-700)] transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Add Parameter / Plant Override
              </button>
            ) : (
              <button
                type="button"
                onClick={openCreateSeriesModal}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-[var(--brand-700)] transition-colors cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                Create Document Series
              </button>
            )}
          </PermissionGate>
        </div>
      </div>

      {/* 4 Executive KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              ERP Config Rules
            </span>
            <Sliders className="h-4 w-4 text-[var(--brand-500)]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[var(--text-primary)]">
              {kpiStats.totalConfigs}
            </span>
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              ({kpiStats.lockedConfigs} Core Locked)
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Scoped Plant Overrides
            </span>
            <Layers className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[var(--text-primary)]">
              {kpiStats.scopedOverrides}
            </span>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {kpiStats.modifiedFromDefault} Customized vs Default
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Numbering Series
            </span>
            <Hash className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[var(--text-primary)]">
              {kpiStats.totalSeries}
            </span>
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              Active Plant/FY Series
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Sequential Docs Issued
            </span>
            <Sparkles className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[var(--text-primary)]">
              {kpiStats.totalIssuedDocs}
            </span>
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              Across All Voucher Types
            </span>
          </div>
        </div>
      </div>

      {/* Dual-Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
        <div className="inline-flex rounded-xl bg-[var(--bg-subtle)] p-1 border border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setActiveTab('CONFIG_MATRIX')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'CONFIG_MATRIX'
                ? 'bg-[var(--bg-surface)] text-[var(--brand-600)] dark:text-[var(--brand-400)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            1. System Configuration Matrix ({configs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('DOC_SERIES')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-extrabold transition-all cursor-pointer ${
              activeTab === 'DOC_SERIES'
                ? 'bg-[var(--bg-surface)] text-[var(--brand-600)] dark:text-[var(--brand-400)] shadow-xs'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Hash className="h-3.5 w-3.5" />
            2. Document Numbering Series Engine ({docSeries.length})
          </button>
        </div>

        {/* Context Filter Bar */}
        {activeTab === 'CONFIG_MATRIX' ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterGroup}
              onChange={(e) => setFilterGroup(e.target.value)}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
            >
              <option value="">All Domain Groups</option>
              {CONFIG_GROUPS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>

            <select
              value={filterScope}
              onChange={(e) => setFilterScope(e.target.value)}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
            >
              <option value="">All Hierarchy Scopes</option>
              <option value="GLOBAL">GLOBAL (System Default)</option>
              <option value="COMPANY">COMPANY Override</option>
              <option value="BRANCH">BRANCH / PLANT Override</option>
            </select>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterModule}
              onChange={(e) => setFilterModule(e.target.value)}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
            >
              <option value="">All ERP Modules</option>
              <option value="PROCUREMENT">PROCUREMENT</option>
              <option value="INVENTORY_WMS">INVENTORY_WMS</option>
              <option value="QUALITY">QUALITY</option>
              <option value="PRODUCTION">PRODUCTION</option>
              <option value="SALES_DISPATCH">SALES_DISPATCH</option>
            </select>

            <select
              value={filterCompId}
              onChange={(e) => {
                setFilterCompId(e.target.value);
                setFilterBranchId('');
              }}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
            >
              <option value="">All Companies</option>
              {companies.map((c) => (
                <option key={c.compId} value={c.compId}>
                  {c.compCode} — {c.compName}
                </option>
              ))}
            </select>

            <select
              value={filterBranchId}
              onChange={(e) => setFilterBranchId(e.target.value)}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
            >
              <option value="">All Plants / Branches</option>
              {branches
                .filter(
                  (b) => !filterCompId || b.compId === Number(filterCompId),
                )
                .map((b) => (
                  <option key={b.branchId} value={b.branchId}>
                    {b.branchCode} — {b.branchName}
                  </option>
                ))}
            </select>

            <select
              value={filterFyearId}
              onChange={(e) => setFilterFyearId(e.target.value)}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]"
            >
              <option value="">All Financial Years</option>
              {financialYears.map((fy) => (
                <option key={fy.fyearId} value={fy.fyearId}>
                  {fy.fyearCode} ({fy.fyearName})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: SYSTEM CONFIGURATION MATRIX TABLE */}
      {activeTab === 'CONFIG_MATRIX' && (
        <MasterDataTable<SystemConfigRecord>
          title="Hierarchical System Parameters & Feature Flags"
          subtitle="Global defaults cascade down to Company and Plant/Branch overrides automatically"
          screenCode="CONFIG_MASTER"
          tableNameBadge="tbl_sys_config"
          data={configs}
          columns={configColumns}
          rowKey={(r) => r.configId}
          isLoading={isConfigsLoading}
          searchPlaceholder="Search parameter key, name, group, value, or plant code..."
          searchPredicate={(row, q) =>
            row.configKey.toLowerCase().includes(q) ||
            row.configName.toLowerCase().includes(q) ||
            row.configGroup.toLowerCase().includes(q) ||
            row.configValue.toLowerCase().includes(q) ||
            (row.targetCompCode || '').toLowerCase().includes(q) ||
            (row.targetBranchCode || '').toLowerCase().includes(q) ||
            (row.description || '').toLowerCase().includes(q)
          }
          groupByOptions={[
            {
              key: 'configGroup',
              label: 'Domain Group',
              groupValue: (r) => r.configGroup,
            },
            {
              key: 'scopeLevel',
              label: 'Hierarchy Scope',
              groupValue: (r) => r.scopeLevel,
            },
            {
              key: 'dataType',
              label: 'Data Type',
              groupValue: (r) => r.dataType,
            },
          ]}
          onExportClick={handleExportCsv}
          onPrintClick={handlePrint}
          renderRowActions={(row) => (
            <div className="flex items-center justify-end gap-1.5">
              {row.scopeLevel === 'GLOBAL' && (
                <PermissionGate screen="CONFIG_MASTER" action="ADD">
                  <button
                    type="button"
                    title="Create Company / Plant Override for this Parameter"
                    onClick={() => openCreateConfigModal(row)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2 py-1 text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--brand-600)] hover:border-[var(--brand-500)]/40 transition-colors cursor-pointer"
                  >
                    <CopyPlus className="h-3.5 w-3.5" />
                    Override
                  </button>
                </PermissionGate>
              )}

              {row.isModifiedFromDefault && (
                <PermissionGate screen="CONFIG_MASTER" action="EDIT">
                  <button
                    type="button"
                    title={`Reset to Default (${row.defaultValue})`}
                    onClick={() => resetDefaultMutation.mutate(row.configId)}
                    className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset
                  </button>
                </PermissionGate>
              )}

              <PermissionGate screen="CONFIG_MASTER" action="EDIT">
                <button
                  type="button"
                  title="Edit Parameter Value"
                  onClick={() => openEditConfigModal(row)}
                  className="inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--brand-600)] transition-colors cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              </PermissionGate>

              <PermissionGate screen="CONFIG_MASTER" action="DELETE">
                <button
                  type="button"
                  disabled={row.isSystemLocked}
                  title={
                    row.isSystemLocked
                      ? 'System Locked core rule cannot be deleted'
                      : 'Delete Parameter / Override'
                  }
                  onClick={() => {
                    setDeleteError(null);
                    setDeletingConfig(row);
                  }}
                  className={`inline-flex items-center justify-center rounded-lg border p-1.5 transition-colors ${
                    row.isSystemLocked
                      ? 'border-transparent text-slate-300 dark:text-slate-700 cursor-not-allowed'
                      : 'border-[var(--border-subtle)] text-rose-500 hover:bg-rose-500/10 cursor-pointer'
                  }`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </PermissionGate>
            </div>
          )}
        />
      )}

      {/* TAB 2: DOCUMENT NUMBERING SERIES ENGINE TABLE */}
      {activeTab === 'DOC_SERIES' && (
        <MasterDataTable<DocNumberSeriesRecord>
          title="Multi-Plant & Financial Year Document Numbering Series"
          subtitle="Automatic prefix, plant code, financial year suffix, and zero-padded running voucher sequence generator"
          screenCode="CONFIG_MASTER"
          tableNameBadge="tbl_sys_doc_number_series"
          data={docSeries}
          columns={docSeriesColumns}
          rowKey={(r) => r.seriesId}
          isLoading={isDocSeriesLoading}
          searchPlaceholder="Search series code, voucher type, prefix preview, or plant code..."
          searchPredicate={(row, q) =>
            row.seriesCode.toLowerCase().includes(q) ||
            row.seriesName.toLowerCase().includes(q) ||
            row.docTypeCode.toLowerCase().includes(q) ||
            row.docTypeName.toLowerCase().includes(q) ||
            row.nextFormattedVoucherNo.toLowerCase().includes(q) ||
            row.targetBranchCode.toLowerCase().includes(q) ||
            row.targetCompCode.toLowerCase().includes(q)
          }
          groupByOptions={[
            {
              key: 'moduleName',
              label: 'ERP Module',
              groupValue: (r) => r.moduleName,
            },
            {
              key: 'docTypeCode',
              label: 'Document Type',
              groupValue: (r) => `${r.docTypeCode} — ${r.docTypeName}`,
            },
            {
              key: 'targetBranchCode',
              label: 'Plant / Branch',
              groupValue: (r) => `${r.targetCompCode} / ${r.targetBranchCode}`,
            },
          ]}
          onExportClick={handleExportCsv}
          onPrintClick={handlePrint}
          renderRowActions={(row) => (
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                title="Preview Next 5 Sequential Voucher Numbers"
                onClick={() => setPreviewSeriesId(row.seriesId)}
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--brand-600)] hover:border-[var(--brand-500)]/40 transition-colors cursor-pointer"
              >
                <Eye className="h-3.5 w-3.5" />
                Simulate
              </button>

              <PermissionGate screen="CONFIG_MASTER" action="EDIT">
                <button
                  type="button"
                  title="Edit Document Numbering Series"
                  onClick={() => openEditSeriesModal(row)}
                  className="inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--brand-600)] transition-colors cursor-pointer"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
              </PermissionGate>

              <PermissionGate screen="CONFIG_MASTER" action="DELETE">
                <button
                  type="button"
                  title="Delete Document Numbering Series"
                  onClick={() => {
                    setDeleteError(null);
                    setDeletingSeries(row);
                  }}
                  className="inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] p-1.5 text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </PermissionGate>
            </div>
          )}
        />
      )}

      {/* ====================================================================
          MODAL 1: CREATE / EDIT SYSTEM CONFIGURATION PARAMETER
         ==================================================================== */}
      {isConfigModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setIsConfigModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-500)]/10 text-[var(--brand-600)]">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[var(--text-primary)]">
                    {editingConfig
                      ? `Edit System Parameter — ${editingConfig.configKey}`
                      : 'Create System Parameter / Plant Override'}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Configure Global defaults or Company/Plant-specific rule overrides
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfigModalOpen(false)}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveConfigMutation.mutate();
              }}
              className="p-6 space-y-4 max-h-[80vh] overflow-y-auto"
            >
              {configFormError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{configFormError}</span>
                </div>
              )}

              {editingConfig?.isSystemLocked && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                  <ShieldAlert className="h-4 w-4 shrink-0" />
                  <span>
                    Core system parameter: Key, Data Type, and Hierarchy Scope are
                    protected. You can modify the Active Value and Description.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Parameter Key <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingConfig?.isSystemLocked)}
                    value={configForm.configKey}
                    onChange={(e) =>
                      setConfigForm((prev) => ({
                        ...prev,
                        configKey: e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9_]/g, '_'),
                      }))
                    }
                    placeholder="e.g., INV_BATCH_TRACEABILITY_STRICT"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 font-mono-code text-xs font-bold text-[var(--text-primary)] disabled:opacity-60"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Domain Group <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={configForm.configGroup}
                    onChange={(e) =>
                      setConfigForm((prev) => ({
                        ...prev,
                        configGroup: e.target.value as ConfigGroupType,
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
                  >
                    {CONFIG_GROUPS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Parameter Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={configForm.configName}
                    onChange={(e) =>
                      setConfigForm((prev) => ({
                        ...prev,
                        configName: e.target.value,
                      }))
                    }
                    placeholder="Human-readable parameter title"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Hierarchy Scope <span className="text-rose-500">*</span>
                  </label>
                  <select
                    disabled={Boolean(editingConfig?.isSystemLocked)}
                    value={configForm.scopeLevel}
                    onChange={(e) => {
                      const nextScope = e.target.value as ConfigScopeLevel;
                      const defComp = companies[0]?.compId || 1001;
                      const defBranch =
                        branches.find((b) => b.compId === defComp)?.branchId ||
                        1001;
                      setConfigForm((prev) => ({
                        ...prev,
                        scopeLevel: nextScope,
                        targetCompId:
                          nextScope === 'GLOBAL'
                            ? ''
                            : prev.targetCompId || defComp,
                        targetBranchId:
                          nextScope === 'BRANCH'
                            ? prev.targetBranchId || defBranch
                            : '',
                      }));
                    }}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-60"
                  >
                    <option value="GLOBAL">GLOBAL (Enterprise Default)</option>
                    <option value="COMPANY">COMPANY Override</option>
                    <option value="BRANCH">BRANCH / PLANT Override</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Data Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    disabled={Boolean(editingConfig?.isSystemLocked)}
                    value={configForm.dataType}
                    onChange={(e) => {
                      const nextType = e.target.value as ConfigDataType;
                      setConfigForm((prev) => ({
                        ...prev,
                        dataType: nextType,
                        configValue:
                          nextType === 'BOOLEAN' ? 'TRUE' : prev.configValue,
                        defaultValue:
                          nextType === 'BOOLEAN' ? 'TRUE' : prev.defaultValue,
                      }));
                    }}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-60"
                  >
                    <option value="BOOLEAN">BOOLEAN (TRUE / FALSE)</option>
                    <option value="NUMBER">NUMBER (Numeric / Decimal)</option>
                    <option value="ENUM">ENUM (Allowed Options List)</option>
                    <option value="STRING">STRING (Text)</option>
                    <option value="JSON">JSON (Structured Object)</option>
                  </select>
                </div>

                {configForm.scopeLevel !== 'GLOBAL' && (
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                      Target Company <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={configForm.targetCompId}
                      onChange={(e) => {
                        const compId = Number(e.target.value);
                        const firstBranch = branches.find(
                          (b) => b.compId === compId,
                        )?.branchId;
                        setConfigForm((prev) => ({
                          ...prev,
                          targetCompId: compId,
                          targetBranchId:
                            prev.scopeLevel === 'BRANCH'
                              ? firstBranch || ''
                              : '',
                        }));
                      }}
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
                    >
                      <option value="">Select Company...</option>
                      {companies.map((c) => (
                        <option key={c.compId} value={c.compId}>
                          {c.compCode} — {c.compName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {configForm.scopeLevel === 'BRANCH' && (
                  <div>
                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                      Target Plant / Branch <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={configForm.targetBranchId}
                      onChange={(e) =>
                        setConfigForm((prev) => ({
                          ...prev,
                          targetBranchId: Number(e.target.value),
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
                    >
                      <option value="">Select Plant / Branch...</option>
                      {configModalBranches.map((b) => (
                        <option key={b.branchId} value={b.branchId}>
                          {b.branchCode} — {b.branchName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {configForm.dataType === 'ENUM' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                      Allowed ENUM Options (Comma-Separated){' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={Boolean(editingConfig?.isSystemLocked)}
                      value={configForm.allowedValues}
                      onChange={(e) =>
                        setConfigForm((prev) => ({
                          ...prev,
                          allowedValues: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="e.g., FIFO,WEIGHTED_AVG,STANDARD_COST"
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 font-mono-code text-xs font-bold text-[var(--text-primary)] disabled:opacity-60"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Active Configuration Value{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  {configForm.dataType === 'BOOLEAN' ? (
                    <select
                      value={configForm.configValue}
                      onChange={(e) =>
                        setConfigForm((prev) => ({
                          ...prev,
                          configValue: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 font-mono-code text-xs font-bold text-[var(--text-primary)]"
                    >
                      <option value="TRUE">TRUE (Enabled)</option>
                      <option value="FALSE">FALSE (Disabled)</option>
                    </select>
                  ) : configForm.dataType === 'ENUM' &&
                    configForm.allowedValues.trim() ? (
                    <select
                      value={configForm.configValue}
                      onChange={(e) =>
                        setConfigForm((prev) => ({
                          ...prev,
                          configValue: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 font-mono-code text-xs font-bold text-[var(--text-primary)]"
                    >
                      {configForm.allowedValues
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <input
                      type={configForm.dataType === 'NUMBER' ? 'number' : 'text'}
                      step="any"
                      required
                      value={configForm.configValue}
                      onChange={(e) =>
                        setConfigForm((prev) => ({
                          ...prev,
                          configValue: e.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 font-mono-code text-xs font-bold text-[var(--text-primary)]"
                    />
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Factory Default Value <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingConfig?.isSystemLocked)}
                    value={configForm.defaultValue}
                    onChange={(e) =>
                      setConfigForm((prev) => ({
                        ...prev,
                        defaultValue: e.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 font-mono-code text-xs font-bold text-[var(--text-primary)] disabled:opacity-60"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Operational Description & Impact Notes
                  </label>
                  <textarea
                    rows={2}
                    value={configForm.description}
                    onChange={(e) =>
                      setConfigForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Explain how this configuration affects inventory, shopfloor, QC, or statutory workflows..."
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs text-[var(--text-primary)]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[var(--border-subtle)] pt-4">
                <label className="inline-flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={configForm.isActive}
                    onChange={(e) =>
                      setConfigForm((prev) => ({
                        ...prev,
                        isActive: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-[var(--border-subtle)] text-[var(--brand-600)]"
                  />
                  Parameter Rule Active
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsConfigModalOpen(false)}
                    className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveConfigMutation.isPending}
                    className="rounded-xl bg-[var(--brand-600)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--brand-700)] disabled:opacity-60 cursor-pointer"
                  >
                    {saveConfigMutation.isPending
                      ? 'Saving...'
                      : editingConfig
                        ? 'Save Parameter Changes'
                        : 'Create Parameter Rule'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: CREATE / EDIT DOCUMENT NUMBERING SERIES
         ==================================================================== */}
      {isSeriesModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setIsSeriesModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-500)]/10 text-[var(--brand-600)]">
                  <Hash className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[var(--text-primary)]">
                    {editingSeries
                      ? `Edit Document Numbering Series — ${editingSeries.seriesCode}`
                      : 'Create Document Numbering Series'}
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Configure plant & financial-year voucher prefix, padding, and
                    running sequence counter
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSeriesModalOpen(false)}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveSeriesMutation.mutate();
              }}
              className="p-6 space-y-4 max-h-[82vh] overflow-y-auto"
            >
              {seriesFormError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{seriesFormError}</span>
                </div>
              )}

              {/* Live Voucher Format Preview Banner */}
              <div className="rounded-xl border border-[var(--brand-500)]/30 bg-[var(--brand-50)]/60 dark:bg-[var(--brand-500)]/10 p-3.5 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-600)] dark:text-[var(--brand-300)]">
                    Live Next Voucher Number Format Preview
                  </div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">
                    Prefix + Separator + FY Suffix + Separator + Zero-Padded Counter
                  </div>
                </div>
                <div className="rounded-lg bg-[var(--bg-surface)] border border-[var(--brand-500)]/40 px-3 py-1.5 font-mono-code text-sm font-extrabold text-[var(--brand-600)] dark:text-[var(--brand-300)] shadow-2xs">
                  {liveModalVoucherPreview}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Target Company <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={seriesForm.targetCompId}
                    onChange={(e) => {
                      const compId = Number(e.target.value);
                      const firstBranch =
                        branches.find((b) => b.compId === compId)?.branchId ||
                        1001;
                      const firstFy =
                        financialYears.find((f) => f.compId === compId)
                          ?.fyearId || 1001;
                      setSeriesForm((prev) => ({
                        ...prev,
                        targetCompId: compId,
                        targetBranchId: firstBranch,
                        targetFyearId: firstFy,
                      }));
                    }}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
                  >
                    {companies.map((c) => (
                      <option key={c.compId} value={c.compId}>
                        {c.compCode} — {c.compName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Target Plant / Branch <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={seriesForm.targetBranchId}
                    onChange={(e) =>
                      setSeriesForm((prev) => ({
                        ...prev,
                        targetBranchId: Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
                  >
                    {seriesModalBranches.map((b) => (
                      <option key={b.branchId} value={b.branchId}>
                        {b.branchCode} — {b.branchName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Financial Year <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={seriesForm.targetFyearId}
                    onChange={(e) =>
                      setSeriesForm((prev) => ({
                        ...prev,
                        targetFyearId: Number(e.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
                  >
                    {seriesModalFyears.map((fy) => (
                      <option key={fy.fyearId} value={fy.fyearId}>
                        {fy.fyearCode} ({fy.fyearName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Document Type <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={seriesForm.docTypeCode}
                    onChange={(e) => {
                      const docMeta = DOC_TYPES_CATALOGUE.find(
                        (d) => d.code === e.target.value,
                      );
                      if (docMeta) {
                        setSeriesForm((prev) => ({
                          ...prev,
                          docTypeCode: docMeta.code,
                          docTypeName: docMeta.name,
                          moduleName: docMeta.module,
                        }));
                      }
                    }}
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
                  >
                    {DOC_TYPES_CATALOGUE.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.code} — {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Series Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={seriesForm.seriesCode}
                    onChange={(e) =>
                      setSeriesForm((prev) => ({
                        ...prev,
                        seriesCode: e.target.value
                          .toUpperCase()
                          .replace(/[^A-Z0-9_-]/g, '-'),
                      }))
                    }
                    placeholder="e.g., AHM-PO-2627"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 font-mono-code text-xs font-bold text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Series Descriptive Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={seriesForm.seriesName}
                    onChange={(e) =>
                      setSeriesForm((prev) => ({
                        ...prev,
                        seriesName: e.target.value,
                      }))
                    }
                    placeholder="e.g., Ahmedabad Plant PO Series"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Prefix Template <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={seriesForm.prefixTemplate}
                    onChange={(e) =>
                      setSeriesForm((prev) => ({
                        ...prev,
                        prefixTemplate: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="e.g., KSMFG/AHM/PO"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 font-mono-code text-xs font-bold text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    FY / Series Suffix
                  </label>
                  <input
                    type="text"
                    value={seriesForm.suffixTemplate}
                    onChange={(e) =>
                      setSeriesForm((prev) => ({
                        ...prev,
                        suffixTemplate: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="e.g., 26-27"
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 font-mono-code text-xs font-bold text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Separator & Zero-Padding
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={seriesForm.separatorChar}
                      onChange={(e) =>
                        setSeriesForm((prev) => ({
                          ...prev,
                          separatorChar: e.target.value,
                        }))
                      }
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-2 font-mono-code text-xs font-bold text-[var(--text-primary)]"
                    >
                      <option value="/">/ (Slash)</option>
                      <option value="-">- (Hyphen)</option>
                      <option value=".">. (Dot)</option>
                    </select>
                    <input
                      type="number"
                      min={2}
                      max={10}
                      value={seriesForm.paddingDigits}
                      onChange={(e) =>
                        setSeriesForm((prev) => ({
                          ...prev,
                          paddingDigits: Number(e.target.value) || 4,
                        }))
                      }
                      title="Zero-Padding Digits (2 to 10)"
                      className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-2.5 py-2 font-mono-code text-xs font-bold text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Starting Sequence No
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={seriesForm.startingNo}
                    onChange={(e) =>
                      setSeriesForm((prev) => ({
                        ...prev,
                        startingNo: Number(e.target.value) || 1,
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 font-mono-code text-xs font-bold text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Current Next Counter No
                  </label>
                  <input
                    type="number"
                    min={seriesForm.startingNo}
                    value={seriesForm.currentNextNo}
                    onChange={(e) =>
                      setSeriesForm((prev) => ({
                        ...prev,
                        currentNextNo: Number(e.target.value) || 1,
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 font-mono-code text-xs font-bold text-[var(--text-primary)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1">
                    Counter Reset Policy
                  </label>
                  <select
                    value={seriesForm.resetFrequency}
                    onChange={(e) =>
                      setSeriesForm((prev) => ({
                        ...prev,
                        resetFrequency:
                          e.target.value as DocSeriesResetFrequency,
                      }))
                    }
                    className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
                  >
                    <option value="FYEAR">FYEAR (Reset Every Financial Year)</option>
                    <option value="MONTHLY">MONTHLY (Reset Every Month)</option>
                    <option value="NEVER">NEVER (Continuous Sequence)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--border-subtle)] pt-4">
                <div className="flex flex-wrap items-center gap-4">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={seriesForm.isDefault}
                      onChange={(e) =>
                        setSeriesForm((prev) => ({
                          ...prev,
                          isDefault: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-[var(--border-subtle)] text-[var(--brand-600)]"
                    />
                    Default Series for Plant & Doc Type
                  </label>

                  <label className="inline-flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={seriesForm.allowManualOverride}
                      onChange={(e) =>
                        setSeriesForm((prev) => ({
                          ...prev,
                          allowManualOverride: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-[var(--border-subtle)] text-[var(--brand-600)]"
                    />
                    Allow Manual Voucher No Override
                  </label>

                  <label className="inline-flex items-center gap-2 text-xs font-bold text-[var(--text-primary)] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={seriesForm.isActive}
                      onChange={(e) =>
                        setSeriesForm((prev) => ({
                          ...prev,
                          isActive: e.target.checked,
                        }))
                      }
                      className="h-4 w-4 rounded border-[var(--border-subtle)] text-[var(--brand-600)]"
                    />
                    Active
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSeriesModalOpen(false)}
                    className="rounded-xl border border-[var(--border-subtle)] px-4 py-2 text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saveSeriesMutation.isPending}
                    className="rounded-xl bg-[var(--brand-600)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--brand-700)] disabled:opacity-60 cursor-pointer"
                  >
                    {saveSeriesMutation.isPending
                      ? 'Saving...'
                      : editingSeries
                        ? 'Save Series Changes'
                        : 'Create Numbering Series'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: SEQUENCE SIMULATOR PREVIEW MODAL (Next 5 Voucher Numbers)
         ==================================================================== */}
      {previewSeriesId !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setPreviewSeriesId(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-500)]/10 text-[var(--brand-600)]">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[var(--text-primary)]">
                    Voucher Sequence Generator Simulation
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Read-only preview of the next 5 sequential document numbers
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewSeriesId(null)}
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {isPreviewLoading || !sequencePreviewData ? (
                <div className="py-8 text-center text-xs text-[var(--text-muted)]">
                  Computing sequence preview from PostgreSQL...
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] p-3.5 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--text-secondary)]">
                        Series:
                      </span>
                      <span className="font-mono-code font-bold text-[var(--text-primary)]">
                        {sequencePreviewData.series.seriesCode} (
                        {sequencePreviewData.series.docTypeName})
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--text-secondary)]">
                        Plant & Financial Year:
                      </span>
                      <span className="font-semibold text-[var(--text-primary)]">
                        {sequencePreviewData.series.targetCompCode} /{' '}
                        {sequencePreviewData.series.targetBranchCode} • FY{' '}
                        {sequencePreviewData.series.targetFyearCode}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[var(--text-secondary)]">
                        Documents Already Issued:
                      </span>
                      <span className="font-mono-code font-bold text-emerald-600 dark:text-emerald-400">
                        {sequencePreviewData.series.issuedDocumentsCount} vouchers
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-extrabold uppercase tracking-wider text-[var(--text-muted)]">
                      Next 5 Generated Voucher Numbers
                    </div>
                    {sequencePreviewData.nextFiveSamples.map((sample) => (
                      <div
                        key={sample.step}
                        className="flex items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2.5"
                      >
                        <span className="text-xs font-semibold text-[var(--text-muted)]">
                          #{sample.step} (Counter: {sample.sequenceNo})
                        </span>
                        <span className="font-mono-code text-xs font-extrabold text-[var(--brand-600)] dark:text-[var(--brand-400)]">
                          {sample.formattedVoucherNo}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setPreviewSeriesId(null)}
                  className="rounded-xl bg-[var(--brand-600)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--brand-700)] cursor-pointer"
                >
                  Close Preview
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          DELETE CONFIRMATION MODALS
         ==================================================================== */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingConfig)}
        entityType="System Configuration Override"
        entityName={deletingConfig ? deletingConfig.configName : ''}
        entityCode={
          deletingConfig
            ? `${deletingConfig.configKey} (${deletingConfig.scopeLevel})`
            : undefined
        }
        errorMessage={deleteError}
        isDeleting={deleteConfigMutation.isPending}
        onClose={() => {
          setDeletingConfig(null);
          setDeleteError(null);
        }}
        onConfirm={() => {
          if (deletingConfig) {
            deleteConfigMutation.mutate(deletingConfig.configId);
          }
        }}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(deletingSeries)}
        entityType="Document Numbering Series"
        entityName={deletingSeries ? deletingSeries.seriesName : ''}
        entityCode={deletingSeries ? deletingSeries.seriesCode : undefined}
        errorMessage={deleteError}
        isDeleting={deleteSeriesMutation.isPending}
        onClose={() => {
          setDeletingSeries(null);
          setDeleteError(null);
        }}
        onConfirm={() => {
          if (deletingSeries) {
            deleteSeriesMutation.mutate(deletingSeries.seriesId);
          }
        }}
      />
    </div>
  );
};
