import React, { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Download,
  Layers,
  Plus,
  Printer,
  Search,
} from 'lucide-react';
import { PermissionGate } from './PermissionGate';

export interface MasterTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number;
  exportValue?: (row: T) => string | number;
}

export interface GroupByOption<T> {
  key: string;
  label: string;
  groupValue: (row: T) => string;
}

export interface MasterDataTableProps<T> {
  title: string;
  subtitle: string;
  screenCode: string;
  tableNameBadge?: string;
  data: T[];
  rowKey: (row: T) => string | number;
  columns: MasterTableColumn<T>[];
  searchPlaceholder?: string;
  searchPredicate: (row: T, query: string) => boolean;
  groupByOptions?: GroupByOption<T>[];
  filterToolbarSlot?: React.ReactNode;
  addButtonLabel?: string;
  onAddClick?: () => void;
  onPrintClick?: () => void;
  onExportClick?: () => void;
  renderRowActions?: (row: T) => React.ReactNode;
  pageSize?: number;
  isLoading?: boolean;
}

/**
 * Reusable high-density Master Listing Data Table matching the approved mockup.
 * Supports search, custom filter slots, column sorting, dynamic group-by with
 * high-contrast headers, pagination, CSV export, print, and RBAC permission gates.
 */
export function MasterDataTable<T>({
  title,
  subtitle,
  screenCode,
  tableNameBadge,
  data,
  rowKey,
  columns,
  searchPlaceholder = 'Search records...',
  searchPredicate,
  groupByOptions = [],
  filterToolbarSlot,
  addButtonLabel = 'Add New',
  onAddClick,
  onPrintClick,
  onExportClick,
  renderRowActions,
  pageSize = 8,
  isLoading = false,
}: MasterDataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string>(columns[0]?.key || '');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [groupByKey, setGroupByKey] = useState<string>('NONE');
  const [page, setPage] = useState(1);

  const filteredAndSorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = data.filter((row) => (!q ? true : searchPredicate(row, q)));

    const activeCol = columns.find((c) => c.key === sortKey);
    if (activeCol && activeCol.sortable) {
      list.sort((a, b) => {
        const valA = activeCol.sortValue
          ? activeCol.sortValue(a)
          : String((a as any)[sortKey] ?? '');
        const valB = activeCol.sortValue
          ? activeCol.sortValue(b)
          : String((b as any)[sortKey] ?? '');

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDir === 'asc' ? valA - valB : valB - valA;
        }
        return sortDir === 'asc'
          ? String(valA).localeCompare(String(valB))
          : String(valB).localeCompare(String(valA));
      });
    }

    return list;
  }, [data, search, searchPredicate, columns, sortKey, sortDir]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAndSorted.length / pageSize),
  );
  const currentPage = Math.min(page, totalPages);
  const paginatedRows = filteredAndSorted.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const groupedSections = useMemo(() => {
    const activeGroupOpt = groupByOptions.find((g) => g.key === groupByKey);
    if (!activeGroupOpt) {
      return [{ groupTitle: null as string | null, rows: paginatedRows }];
    }

    const map = new Map<string, T[]>();
    for (const r of filteredAndSorted) {
      const label = activeGroupOpt.groupValue(r) || 'Unassigned';
      const arr = map.get(label) || [];
      arr.push(r);
      map.set(label, arr);
    }
    return Array.from(map.entries()).map(([groupTitle, rows]) => ({
      groupTitle,
      rows,
    }));
  }, [groupByKey, groupByOptions, paginatedRows, filteredAndSorted]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleDefaultCsvExport = () => {
    if (onExportClick) {
      onExportClick();
    }
    const headers = columns.map((c) => `"${c.header.replace(/"/g, '""')}"`);
    const csvRows = [headers.join(',')];

    for (const row of filteredAndSorted) {
      const vals = columns.map((c) => {
        const raw = c.exportValue
          ? c.exportValue(row)
          : c.sortValue
            ? c.sortValue(row)
            : ((row as any)[c.key] ?? '');
        return `"${String(raw).replace(/"/g, '""')}"`;
      });
      csvRows.push(vals.join(','));
    }

    const blob = new Blob([csvRows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${screenCode.toLowerCase()}_export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDefaultPrint = () => {
    if (onPrintClick) {
      onPrintClick();
    }
    window.print();
  };

  const totalColSpan = columns.length + (renderRowActions ? 1 : 0);

  return (
    <div className="space-y-5">
      {/* Screen Header & Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-extrabold tracking-tight text-[var(--text-primary)]">
              {title}
            </h1>
            {tableNameBadge && (
              <span className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2 py-0.5 font-mono-code text-[11px] font-semibold text-[var(--brand-600)] dark:text-[var(--brand-300)]">
                {tableNameBadge}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">{subtitle}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PermissionGate screen={screenCode} action="PRINT">
            <button
              type="button"
              onClick={handleDefaultPrint}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--brand-500)] transition cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>
          </PermissionGate>

          <PermissionGate screen={screenCode} action="EXPORT">
            <button
              type="button"
              onClick={handleDefaultCsvExport}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--brand-500)] transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
          </PermissionGate>

          {onAddClick && (
            <PermissionGate screen={screenCode} action="ADD">
              <button
                type="button"
                onClick={onAddClick}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>{addButtonLabel}</span>
              </button>
            </PermissionGate>
          )}
        </div>
      </div>

      {/* Search, Filter & Group-By Bar */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-xs">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
              className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] pl-10 pr-4 py-2 text-xs font-medium text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-none"
            />
          </div>

          {/* Custom Filter Controls */}
          {filterToolbarSlot && (
            <div className="flex flex-wrap items-center gap-2.5">
              {filterToolbarSlot}
            </div>
          )}

          {/* Group By Selector */}
          {groupByOptions.length > 0 && (
            <div className="flex items-center gap-1.5 shrink-0">
              <Layers className="h-3.5 w-3.5 text-[var(--brand-500)]" />
              <select
                value={groupByKey}
                onChange={(e) => setGroupByKey(e.target.value)}
                className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)]"
              >
                <option value="NONE">Group By: None</option>
                {groupByOptions.map((opt) => (
                  <option key={opt.key} value={opt.key}>
                    Group By: {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`py-3 px-4 ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                    }`}
                  >
                    {col.sortable ? (
                      <button
                        type="button"
                        onClick={() => handleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-[var(--text-primary)] cursor-pointer"
                      >
                        <span>{col.header}</span>
                        <ArrowUpDown className="h-3 w-3" />
                      </button>
                    ) : (
                      <span>{col.header}</span>
                    )}
                  </th>
                ))}
                {renderRowActions && (
                  <th className="py-3 px-4 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-xs">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={totalColSpan}
                    className="py-10 text-center text-[var(--text-muted)]"
                  >
                    Loading records...
                  </td>
                </tr>
              ) : filteredAndSorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={totalColSpan}
                    className="py-10 text-center text-[var(--text-muted)]"
                  >
                    No matching records found.
                  </td>
                </tr>
              ) : (
                groupedSections.map((sec, idx) => (
                  <React.Fragment key={sec.groupTitle || idx}>
                    {sec.groupTitle && (
                      <tr className="bg-[var(--brand-50)]/60 dark:bg-slate-800/90 border-y border-[var(--border-strong)]">
                        <td
                          colSpan={totalColSpan}
                          className="py-2.5 px-4 text-xs font-extrabold text-[var(--brand-700)] dark:text-[var(--brand-300)]"
                        >
                          <div className="flex items-center gap-2">
                            <Layers className="h-3.5 w-3.5" />
                            <span>{sec.groupTitle}</span>
                            <span className="rounded-full bg-[var(--brand-600)] px-2 py-0.5 text-[10px] font-bold text-white">
                              {sec.rows.length}{' '}
                              {sec.rows.length === 1 ? 'record' : 'records'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}

                    {sec.rows.map((row) => (
                      <tr
                        key={rowKey(row)}
                        className="hover:bg-[var(--bg-hover)] transition"
                      >
                        {columns.map((col) => (
                          <td
                            key={col.key}
                            className={`py-3.5 px-4 ${
                              col.align === 'right'
                                ? 'text-right'
                                : col.align === 'center'
                                  ? 'text-center'
                                  : 'text-left'
                            }`}
                          >
                            {col.render(row)}
                          </td>
                        ))}
                        {renderRowActions && (
                          <td className="py-3.5 px-4 text-right">
                            {renderRowActions(row)}
                          </td>
                        )}
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 text-xs">
          <span className="text-[var(--text-muted)]">
            Showing{' '}
            <strong className="text-[var(--text-primary)]">
              {filteredAndSorted.length === 0
                ? 0
                : (currentPage - 1) * pageSize + 1}
            </strong>{' '}
            to{' '}
            <strong className="text-[var(--text-primary)]">
              {Math.min(currentPage * pageSize, filteredAndSorted.length)}
            </strong>{' '}
            of{' '}
            <strong className="text-[var(--text-primary)]">
              {filteredAndSorted.length}
            </strong>{' '}
            records
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 font-semibold text-[var(--text-secondary)] disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <span className="px-2 font-mono-code font-bold text-[var(--text-primary)]">
              Page {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 font-semibold text-[var(--text-secondary)] disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
