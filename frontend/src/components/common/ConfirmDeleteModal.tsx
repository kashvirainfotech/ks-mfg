import React from 'react';
import { AlertTriangle, ShieldAlert, Trash2, X } from 'lucide-react';

export interface DependencyConflictItem {
  table: string;
  label: string;
  count: number;
}

export interface ConfirmDeleteModalProps {
  isOpen: boolean;
  entityType: string;
  entityName: string;
  entityCode?: string;
  isDeleting?: boolean;
  errorMessage?: string | null;
  dependencies?: DependencyConflictItem[];
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Reusable pre-delete confirmation modal with built-in HTTP 409 DependencyConflictException
 * breakdown display (shows referencing child tables and record counts).
 */
export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  entityType,
  entityName,
  entityCode,
  isDeleting = false,
  errorMessage = null,
  dependencies = [],
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  const hasConflict = dependencies.length > 0 || Boolean(errorMessage);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                hasConflict
                  ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                  : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
              }`}
            >
              {hasConflict ? (
                <ShieldAlert className="h-5 w-5" />
              ) : (
                <AlertTriangle className="h-5 w-5" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-[var(--text-primary)]">
                {hasConflict
                  ? `Deletion Blocked — Referential Integrity`
                  : `Confirm Delete ${entityType}`}
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                Pre-deletion dependency verification (`DependencyCheckService`)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 text-xs">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5">
            <div className="text-[11px] text-[var(--text-muted)]">
              Target {entityType} Record:
            </div>
            <div className="mt-0.5 flex items-center gap-2 font-bold text-sm text-[var(--text-primary)]">
              <span>{entityName}</span>
              {entityCode && (
                <span className="rounded-md bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/20 px-2 py-0.5 font-mono-code text-xs text-[var(--brand-600)] dark:text-[var(--brand-300)]">
                  {entityCode}
                </span>
              )}
            </div>
          </div>

          {hasConflict ? (
            <div className="space-y-3">
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-rose-600 dark:text-rose-300 font-semibold leading-relaxed">
                {errorMessage ||
                  `This ${entityType} cannot be deleted because it is actively referenced in child or transaction records.`}
              </div>

              {dependencies.length > 0 && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] overflow-hidden">
                  <div className="border-b border-[var(--border-subtle)] px-3.5 py-2 text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    Dependent Records Found
                  </div>
                  <div className="divide-y divide-[var(--border-subtle)]">
                    {dependencies.map((dep) => (
                      <div
                        key={dep.table}
                        className="flex items-center justify-between px-3.5 py-2.5"
                      >
                        <div>
                          <div className="font-bold text-[var(--text-primary)]">
                            {dep.label}
                          </div>
                          <div className="font-mono-code text-[10px] text-[var(--text-muted)]">
                            {dep.table}
                          </div>
                        </div>
                        <span className="rounded-full bg-rose-500/15 px-2.5 py-0.5 font-mono-code text-xs font-extrabold text-rose-600 dark:text-rose-300">
                          {dep.count} {dep.count === 1 ? 'record' : 'records'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Are you sure you want to permanently delete this{' '}
              <strong>{entityType}</strong>? The system will first verify that no
              branches, financial years, roles, or transactions reference this
              record, and will log the deletion in{' '}
              <code className="font-mono-code">tbl_sys_audit_log</code>.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-3.5 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-2 font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            {hasConflict ? 'Close' : 'Cancel'}
          </button>

          {!hasConflict && (
            <button
              type="button"
              disabled={isDeleting}
              onClick={onConfirm}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 px-4 py-2 font-bold text-white shadow-xs transition cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{isDeleting ? 'Verifying & Deleting...' : 'Delete Record'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
