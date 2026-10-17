import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Calendar,
  Code2,
  Eye,
  FileDiff,
  Filter,
  GitCommitHorizontal,
  History,
  RotateCcw,
  ShieldCheck,
  Terminal,
  Trash2,
  UserCheck,
  X,
} from 'lucide-react';
import {
  MasterDataTable,
  type GroupByOption,
  type MasterTableColumn,
} from '../../components/common/MasterDataTable';
import { apiClient } from '../../lib/apiClient';

export interface AuditLogEntity {
  auditId: number;
  userId: number;
  username: string | null;
  userFullName: string | null;
  screenCode: string;
  screenName: string | null;
  moduleName: string | null;
  actionType: string;
  entityTable: string;
  recordId: number;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  changedFields: Record<string, { old: unknown; new: unknown }> | null;
  changedFieldCount: number;
  ipAddress: string | null;
  userAgent: string | null;
  correlationId: string | null;
  actionTimestamp: string;
  compId: number;
  compCode: string | null;
  compName: string | null;
  branchId: number;
  branchCode: string | null;
  branchName: string | null;
  fyearId: number | null;
}

interface AuditMetadata {
  screenCodes: { screenCode: string; screenName: string | null }[];
  actionTypes: string[];
  entityTables: string[];
  stats: {
    totalLogs: number;
    editsWithDeltaCount: number;
    deletesCount: number;
    loginsCount: number;
  };
}

interface CompanyLookup {
  compId: number;
  compCode: string;
  compName: string;
}

interface BranchLookup {
  branchId: number;
  compId: number;
  branchCode: string;
  branchName: string;
}

const ACTION_BADGE_STYLES: Record<string, string> = {
  ADD: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  EDIT: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  DELETE:
    'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  LOGIN:
    'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  LOGOUT:
    'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20',
  PRINT: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  EXPORT:
    'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
};

export const AuditLogViewerPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntity[]>([]);
  const [metadata, setMetadata] = useState<AuditMetadata>({
    screenCodes: [],
    actionTypes: [],
    entityTables: [],
    stats: {
      totalLogs: 0,
      editsWithDeltaCount: 0,
      deletesCount: 0,
      loginsCount: 0,
    },
  });
  const [companies, setCompanies] = useState<CompanyLookup[]>([]);
  const [branches, setBranches] = useState<BranchLookup[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Filters
  const [compFilter, setCompFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [screenFilter, setScreenFilter] = useState<string>('ALL');
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [tableFilter, setTableFilter] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Inspector Modal State
  const [inspectedLog, setInspectedLog] = useState<AuditLogEntity | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'DELTA' | 'RAW_JSON'>(
    'DELTA',
  );

  // Close Inspector Modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && inspectedLog) {
        setInspectedLog(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectedLog]);

  const fetchLookupsAndMetadata = async () => {
    try {
      const [metaRes, compRes, branchRes] = await Promise.all([
        apiClient.get('/security/audit-logs/metadata'),
        apiClient.get('/org/companies'),
        apiClient.get('/org/branches'),
      ]);
      const metaData = metaRes.data?.data ?? metaRes.data;
      const compData = compRes.data?.data ?? compRes.data;
      const branchData = branchRes.data?.data ?? branchRes.data;

      if (metaData) setMetadata(metaData);
      setCompanies(Array.isArray(compData) ? compData : []);
      setBranches(Array.isArray(branchData) ? branchData : []);
    } catch {
      // Handled in main fetchLogs
    }
  };

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    setErrorBanner(null);
    try {
      const params: Record<string, string> = { limit: '500' };
      if (compFilter !== 'ALL') params.compId = compFilter;
      if (branchFilter !== 'ALL') params.branchId = branchFilter;
      if (screenFilter !== 'ALL') params.screenCode = screenFilter;
      if (actionFilter !== 'ALL') params.actionType = actionFilter;
      if (tableFilter !== 'ALL') params.entityTable = tableFilter;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;

      const res = await apiClient.get('/security/audit-logs', { params });
      const data = res.data?.data ?? res.data;
      setLogs(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setLogs([]);
      setErrorBanner(
        err?.response?.data?.error?.message ||
          'Unable to load Security & Field-Delta Audit Trail from PostgreSQL.',
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchLookupsAndMetadata();
  }, []);

  useEffect(() => {
    void fetchAuditLogs();
  }, [
    compFilter,
    branchFilter,
    screenFilter,
    actionFilter,
    tableFilter,
    fromDate,
    toDate,
  ]);

  const handleResetFilters = () => {
    setCompFilter('ALL');
    setBranchFilter('ALL');
    setScreenFilter('ALL');
    setActionFilter('ALL');
    setTableFilter('ALL');
    setFromDate('');
    setToDate('');
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      });
    } catch {
      return iso;
    }
  };

  const formatValuePreview = (val: unknown): string => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  const handleExportCsv = async () => {
    try {
      await apiClient.post('/security/audit-logs/action/EXPORT');
    } catch {
      // Non-blocking audit log
    }

    const headers = [
      'Audit ID',
      'Timestamp',
      'Username',
      'User Full Name',
      'Company',
      'Plant / Branch',
      'Screen Code',
      'Action Type',
      'Entity Table',
      'Record ID',
      'Changed Field Count',
      'IP Address',
      'Correlation ID',
    ];
    const lines = [
      headers.join(','),
      ...logs.map((l) =>
        [
          l.auditId,
          `"${l.actionTimestamp}"`,
          l.username || '',
          `"${(l.userFullName || '').replace(/"/g, '""')}"`,
          l.compCode || l.compId,
          l.branchCode || l.branchId,
          l.screenCode,
          l.actionType,
          l.entityTable,
          l.recordId,
          l.changedFieldCount,
          l.ipAddress || '',
          l.correlationId || '',
        ].join(','),
      ),
    ];

    const blob = new Blob([lines.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KS_MFG_Security_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const auditColumns: MasterTableColumn<AuditLogEntity>[] = useMemo(
    () => [
      {
        key: 'auditId',
        header: 'Audit ID & Timestamp',
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-mono font-bold text-brand-600 dark:text-brand-400">
              #{row.auditId}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              {formatTimestamp(row.actionTimestamp)}
            </span>
          </div>
        ),
      },
      {
        key: 'username',
        header: 'Actor & Tenant Context',
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
              @{row.username || `user_${row.userId}`}{' '}
              {row.userFullName ? `(${row.userFullName})` : ''}
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {row.compCode || `Comp #${row.compId}`} •{' '}
              {row.branchCode || `Branch #${row.branchId}`}
            </span>
          </div>
        ),
      },
      {
        key: 'screenCode',
        header: 'Screen & Module',
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">
              {row.screenName || row.screenCode}
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {row.screenCode}
              {row.moduleName ? ` • ${row.moduleName}` : ''}
            </span>
          </div>
        ),
      },
      {
        key: 'actionType',
        header: 'Action',
        align: 'center',
        render: (row) => {
          const style =
            ACTION_BADGE_STYLES[row.actionType] ||
            'bg-slate-500/10 text-slate-600 border-slate-500/20';
          return (
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-bold ${style}`}
            >
              {row.actionType}
            </span>
          );
        },
      },
      {
        key: 'entityTable',
        header: 'Target Table & Record PK',
        render: (row) => (
          <div className="flex flex-col">
            <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
              {row.entityTable}
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              Record ID: #{row.recordId}
            </span>
          </div>
        ),
      },
      {
        key: 'changedFields',
        header: 'Field-Delta Summary',
        render: (row) => {
          if (row.changedFields && row.changedFieldCount > 0) {
            const keys = Object.keys(row.changedFields);
            return (
              <div className="flex flex-col">
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <FileDiff className="h-3.5 w-3.5" />
                  {row.changedFieldCount} field
                  {row.changedFieldCount === 1 ? '' : 's'} modified
                </span>
                <span className="font-mono text-[11px] text-slate-400 truncate max-w-xs">
                  {keys.join(', ')}
                </span>
              </div>
            );
          }
          if (row.actionType === 'ADD' && row.newValue) {
            return (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                New record snapshot captured
              </span>
            );
          }
          if (row.actionType === 'DELETE' && row.oldValue) {
            return (
              <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                Deleted record snapshot preserved
              </span>
            );
          }
          return (
            <span className="text-xs text-slate-400">
              Event logged ({row.ipAddress || 'local'})
            </span>
          );
        },
      },
    ],
    [],
  );

  const groupByOptions: GroupByOption<AuditLogEntity>[] = [
    {
      key: 'screenCode',
      label: 'Screen / Module',
      groupValue: (r) =>
        r.screenName ? `${r.screenName} (${r.screenCode})` : r.screenCode,
    },
    {
      key: 'actionType',
      label: 'Action Type (ADD / EDIT / DELETE / LOGIN)',
      groupValue: (r) => `${r.actionType} Actions`,
    },
    {
      key: 'entityTable',
      label: 'Database Table (`entity_table`)',
      groupValue: (r) => r.entityTable,
    },
    {
      key: 'username',
      label: 'Actor / User Account',
      groupValue: (r) => `@${r.username || `user_${r.userId}`}`,
    },
  ];

  // Build unified field comparison entries for the Inspector Modal
  const inspectorFieldRows = useMemo(() => {
    if (!inspectedLog) return [];

    // If EDIT with explicit changedFields delta
    if (
      inspectedLog.changedFields &&
      Object.keys(inspectedLog.changedFields).length > 0
    ) {
      return Object.entries(inspectedLog.changedFields).map(([field, pair]) => ({
        field,
        oldVal: pair.old,
        newVal: pair.new,
        isChanged: true,
      }));
    }

    // Otherwise compare oldValue and newValue keys
    const oldObj = inspectedLog.oldValue || {};
    const newObj = inspectedLog.newValue || {};
    const allKeys = Array.from(
      new Set([...Object.keys(oldObj), ...Object.keys(newObj)]),
    );

    return allKeys.map((field) => {
      const o = oldObj[field];
      const n = newObj[field];
      return {
        field,
        oldVal: o,
        newVal: n,
        isChanged: JSON.stringify(o) !== JSON.stringify(n),
      };
    });
  }, [inspectedLog]);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/10 px-2.5 py-0.5 text-xs font-semibold text-brand-600 dark:text-brand-400">
              <History className="h-3.5 w-3.5" />
              Phase 2 • Step 2.5 — Immutable Security & Field-Delta Audit Trail
            </span>
          </div>
          <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Security & Field-Delta Audit Trail Viewer
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Inspect immutable activity logs (`tbl_sys_audit_log`) with JSONB
            before/after snapshots (`old_value`, `new_value`), computed field
            deltas (`changed_fields`), IP addresses, and correlation IDs.
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Total Immutable Audit Logs
            </span>
            <Activity className="h-4 w-4 text-brand-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-white">
            {metadata.stats.totalLogs}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Field-Delta Edits Captured
            </span>
            <FileDiff className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {metadata.stats.editsWithDeltaCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Audited Record Deletions
            </span>
            <Trash2 className="h-4 w-4 text-rose-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-rose-600 dark:text-rose-400">
            {metadata.stats.deletesCount}
          </p>
        </div>

        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Auth Login / Logout Events
            </span>
            <UserCheck className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="mt-1.5 text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {metadata.stats.loginsCount}
          </p>
        </div>
      </div>

      {/* Multi-Dimensional Audit Filter Bar */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
              Company
            </label>
            <select
              value={compFilter}
              onChange={(e) => {
                setCompFilter(e.target.value);
                setBranchFilter('ALL');
              }}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Companies</option>
              {companies.map((c) => (
                <option key={c.compId} value={String(c.compId)}>
                  {c.compCode} — {c.compName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
              Plant / Branch
            </label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Plants / Branches</option>
              {branches
                .filter(
                  (b) =>
                    compFilter === 'ALL' || String(b.compId) === compFilter,
                )
                .map((b) => (
                  <option key={b.branchId} value={String(b.branchId)}>
                    {b.branchCode} — {b.branchName}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
              Screen Code
            </label>
            <select
              value={screenFilter}
              onChange={(e) => setScreenFilter(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Screens</option>
              {metadata.screenCodes.map((s) => (
                <option key={s.screenCode} value={s.screenCode}>
                  {s.screenCode}
                  {s.screenName ? ` — ${s.screenName}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
              Action Type
            </label>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Actions</option>
              {metadata.actionTypes.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
              Database Table (`entity_table`)
            </label>
            <select
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 px-3 py-2 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200"
            >
              <option value="ALL">All Tables</option>
              {metadata.entityTables.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
              From Date
            </label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
              To Date
            </label>
            <div className="relative">
              <Calendar className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetFilters}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Filters
          </button>
        </div>
      </div>

      {errorBanner && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-600 dark:text-rose-300">
          {errorBanner}
        </div>
      )}

      {/* Master Data Table */}
      <MasterDataTable<AuditLogEntity>
        title="Immutable Activity & Field-Delta Audit Stream"
        subtitle="Read-only forensic ledger (`tbl_sys_audit_log`). Click 'Inspect Delta' on any row to compare JSONB before/after field values."
        screenCode="AUDIT_LOG"
        tableNameBadge="tbl_sys_audit_log"
        data={logs}
        rowKey={(r) => r.auditId}
        columns={auditColumns}
        isLoading={isLoading}
        onExportClick={() => {
          void handleExportCsv();
        }}
        onPrintClick={() => {
          void apiClient
            .post('/security/audit-logs/action/PRINT')
            .catch(() => {});
          window.print();
        }}
        searchPlaceholder="Search by audit ID, username, screen code, table name, record ID, IP address, or correlation ID..."
        searchPredicate={(r, q) =>
          String(r.auditId).includes(q) ||
          (r.username || '').toLowerCase().includes(q) ||
          (r.userFullName || '').toLowerCase().includes(q) ||
          r.screenCode.toLowerCase().includes(q) ||
          (r.screenName || '').toLowerCase().includes(q) ||
          r.actionType.toLowerCase().includes(q) ||
          r.entityTable.toLowerCase().includes(q) ||
          String(r.recordId).includes(q) ||
          (r.correlationId || '').toLowerCase().includes(q)
        }
        groupByOptions={groupByOptions}
        renderRowActions={(row) => (
          <button
            type="button"
            onClick={() => {
              setInspectorTab('DELTA');
              setInspectedLog(row);
            }}
            className="inline-flex items-center gap-1 rounded-lg border border-brand-500/30 bg-brand-500/10 px-2.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-500/20 dark:text-brand-400 transition cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5" />
            Inspect Delta
          </button>
        )}
      />

      {/* ====================================================================
          FIELD-DELTA & JSONB PAYLOAD INSPECTOR MODAL
          ==================================================================== */}
      {inspectedLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          onClick={() => setInspectedLog(null)}
        >
          <div
            className="w-full max-w-4xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm font-bold text-brand-600 dark:text-brand-400">
                  Audit #{inspectedLog.auditId}
                </span>
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-bold ${
                    ACTION_BADGE_STYLES[inspectedLog.actionType] ||
                    'bg-slate-500/10 text-slate-600'
                  }`}
                >
                  {inspectedLog.actionType}
                </span>
                <span className="font-mono text-xs text-slate-500">
                  {inspectedLog.entityTable} #{inspectedLog.recordId}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectedLog(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Forensic Metadata Strip */}
            <div className="grid grid-cols-2 gap-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 px-6 py-3 text-xs sm:grid-cols-4">
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400">
                  Timestamp
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formatTimestamp(inspectedLog.actionTimestamp)}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400">
                  Actor & IP Address
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  @{inspectedLog.username || inspectedLog.userId} (
                  {inspectedLog.ipAddress || 'local'})
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400">
                  Company & Plant Context
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {inspectedLog.compCode || inspectedLog.compId} •{' '}
                  {inspectedLog.branchCode || inspectedLog.branchId}
                </span>
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase text-slate-400">
                  X-Correlation-Id
                </span>
                <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                  {inspectedLog.correlationId || 'N/A'}
                </span>
              </div>
            </div>

            {/* Inspector Mode Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-6">
              <button
                type="button"
                onClick={() => setInspectorTab('DELTA')}
                className={`inline-flex items-center gap-2 border-b-2 py-2.5 px-3 text-xs font-semibold transition cursor-pointer ${
                  inspectorTab === 'DELTA'
                    ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <GitCommitHorizontal className="h-3.5 w-3.5" />
                1. Field-by-Field Delta Comparison ({inspectorFieldRows.length})
              </button>
              <button
                type="button"
                onClick={() => setInspectorTab('RAW_JSON')}
                className={`inline-flex items-center gap-2 border-b-2 py-2.5 px-3 text-xs font-semibold transition cursor-pointer ${
                  inspectorTab === 'RAW_JSON'
                    ? 'border-brand-600 text-brand-600 dark:border-brand-400 dark:text-brand-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                2. Raw JSONB Snapshots (`old_value` vs `new_value`)
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {inspectorTab === 'DELTA' ? (
                inspectorFieldRows.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-8 text-center text-xs text-slate-400">
                    No JSONB field payload recorded for this action event.
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-[11px] font-bold uppercase text-slate-500">
                          <th className="py-2.5 px-4">Field / Column</th>
                          <th className="py-2.5 px-4">
                            Previous Value (`old_value`)
                          </th>
                          <th className="py-2.5 px-2 text-center w-8"></th>
                          <th className="py-2.5 px-4">
                            Updated Value (`new_value`)
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                        {inspectorFieldRows.map((item) => (
                          <tr
                            key={item.field}
                            className={
                              item.isChanged
                                ? 'bg-amber-500/5'
                                : 'hover:bg-slate-50/60 dark:hover:bg-slate-800/30'
                            }
                          >
                            <td className="py-2.5 px-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                              {item.field}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-rose-600 dark:text-rose-400 break-all">
                              {formatValuePreview(item.oldVal)}
                            </td>
                            <td className="py-2.5 px-2 text-center text-slate-400">
                              <ArrowRight className="h-3.5 w-3.5 mx-auto" />
                            </td>
                            <td className="py-2.5 px-4 font-mono text-emerald-600 dark:text-emerald-400 break-all">
                              {formatValuePreview(item.newVal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-4 text-xs text-slate-200 overflow-x-auto">
                    <div className="mb-2 flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-rose-400">
                      <Terminal className="h-3.5 w-3.5" />
                      old_value (JSONB Before State)
                    </div>
                    <pre className="font-mono text-[11px] leading-relaxed">
                      {inspectedLog.oldValue
                        ? JSON.stringify(inspectedLog.oldValue, null, 2)
                        : 'null'}
                    </pre>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-4 text-xs text-slate-200 overflow-x-auto">
                    <div className="mb-2 flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase text-emerald-400">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      new_value (JSONB After State)
                    </div>
                    <pre className="font-mono text-[11px] leading-relaxed">
                      {inspectedLog.newValue
                        ? JSON.stringify(inspectedLog.newValue, null, 2)
                        : 'null'}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 px-6 py-3 text-xs text-slate-500">
              <span className="truncate max-w-xl">
                User-Agent: {inspectedLog.userAgent || 'Not recorded'}
              </span>
              <button
                type="button"
                onClick={() => setInspectedLog(null)}
                className="rounded-xl bg-slate-900 dark:bg-slate-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-700 transition cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
