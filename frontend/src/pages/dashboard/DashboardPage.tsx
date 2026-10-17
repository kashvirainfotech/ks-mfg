import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  CalendarRange,
  CheckCircle2,
  GitBranch,
  Lock,
  LockOpen,
  ShieldCheck,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { apiClient } from '../../lib/apiClient';
import type { CompanyEntity } from '../org/CompanyMasterPage';
import type { BranchEntity } from '../org/BranchMasterPage';
import type { FinancialYearEntity } from '../org/FinancialYearMasterPage';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    user,
    activeContext,
    allowedCompanies,
    allowedBranches,
    allowedFinancialYears,
  } = useAuthStore();

  const [companies, setCompanies] = useState<CompanyEntity[]>([]);
  const [branches, setBranches] = useState<BranchEntity[]>([]);
  const [financialYears, setFinancialYears] = useState<FinancialYearEntity[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      setIsLoading(true);
      try {
        const [compRes, branchRes, fyRes] = await Promise.all([
          apiClient.get('/org/companies'),
          apiClient.get('/org/branches'),
          apiClient.get('/org/financial-years'),
        ]);
        if (Array.isArray(compRes.data?.data)) {
          setCompanies(compRes.data.data);
        }
        if (Array.isArray(branchRes.data?.data)) {
          setBranches(branchRes.data.data);
        }
        if (Array.isArray(fyRes.data?.data)) {
          setFinancialYears(fyRes.data.data);
        }
      } catch {
        setCompanies([]);
        setBranches([]);
        setFinancialYears([]);
      } finally {
        setIsLoading(false);
      }
    };

    void loadDashboardData();
  }, []);

  const currentCompany = allowedCompanies.find(
    (c) => c.compId === activeContext.compId,
  );
  const currentBranch = allowedBranches.find(
    (b) => b.branchId === activeContext.branchId,
  );
  const currentFyear = allowedFinancialYears.find(
    (f) => f.fyearId === activeContext.fyearId,
  );

  const activeCompaniesCount = companies.filter((c) => c.isActive).length;
  const activeBranchesCount = branches.filter((b) => b.isActive).length;
  const plantCount = branches.filter((b) => b.branchType === 'PLANT').length;
  const openFyearsCount = financialYears.filter((f) => !f.isClosed).length;
  const closedFyearsCount = financialYears.filter((f) => f.isClosed).length;

  return (
    <div className="space-y-6">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight text-[var(--text-primary)]">
              Plant Operations & Organization Command Center
            </h1>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
              Live Database
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Active Scope:{' '}
            <strong className="text-[var(--text-secondary)]">
              {currentCompany?.compName || 'No Company Selected'}
            </strong>{' '}
            •{' '}
            <strong className="text-[var(--text-secondary)]">
              {currentBranch?.branchName || 'No Branch Selected'}
            </strong>{' '}
            ({currentFyear?.fyearName || 'No FY Selected'})
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/org/companies')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--brand-500)] transition cursor-pointer"
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>Company Master</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/org/branches')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
          >
            <GitBranch className="h-3.5 w-3.5" />
            <span>Branch & Plants</span>
          </button>
        </div>
      </div>

      {/* 4 Live Database KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div
          onClick={() => navigate('/org/companies')}
          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs hover:border-[var(--brand-500)] transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Legal Companies (`tbl_org_company`)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/20 text-[var(--brand-600)] dark:text-[var(--brand-300)]">
              <Building2 className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[var(--text-primary)]">
              {isLoading ? '...' : companies.length}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {activeCompaniesCount} Active
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            Live records from PostgreSQL database
          </p>
        </div>

        <div
          onClick={() => navigate('/org/branches')}
          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs hover:border-[var(--brand-500)] transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Branches & Plants (`tbl_org_branch`)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
              <GitBranch className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[var(--text-primary)]">
              {isLoading ? '...' : branches.length}
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              {plantCount} Plants • {activeBranchesCount} Active
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            Live facilities registered across companies
          </p>
        </div>

        <div
          onClick={() => navigate('/org/financial-years')}
          className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs hover:border-[var(--brand-500)] transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Financial Years (`tbl_org_financial_year`)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
              <CalendarRange className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[var(--text-primary)]">
              {isLoading ? '...' : financialYears.length}
            </span>
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              {openFyearsCount} Open • {closedFyearsCount} Closed
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            Accounting periods configured in DB
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Active User Session (`tbl_sec_user`)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-lg font-extrabold text-[var(--text-primary)] truncate">
              {user?.username || 'Authenticated'}
            </span>
            <span className="text-xs font-semibold text-violet-600 dark:text-violet-400">
              {user?.userCategory || 'SYSTEM'}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-muted)] font-mono-code">
            comp_id={activeContext.compId} • branch_id={activeContext.branchId}{' '}
            • fyear_id={activeContext.fyearId}
          </p>
        </div>
      </div>

      {/* Live Branches & Plants Table from PostgreSQL */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              Registered Manufacturing Plants & Branches (`tbl_org_branch`)
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Real-time records fetched directly from PostgreSQL
            </p>
          </div>
          <span className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] font-mono-code font-semibold text-[var(--text-secondary)]">
            {branches.length} Records in Database
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <th className="py-3 px-4">Branch Code</th>
                <th className="py-3 px-4">Branch / Plant Name</th>
                <th className="py-3 px-4">Parent Company</th>
                <th className="py-3 px-4">Facility Type</th>
                <th className="py-3 px-4">City / State</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-xs">
              {branches.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-[var(--text-muted)]"
                  >
                    {isLoading
                      ? 'Loading branches from database...'
                      : 'No branches found in database.'}
                  </td>
                </tr>
              ) : (
                branches.map((b) => (
                  <tr
                    key={b.branchId}
                    className="hover:bg-[var(--bg-hover)] transition"
                  >
                    <td className="py-3.5 px-4 font-mono-code font-bold text-[var(--brand-600)] dark:text-[var(--brand-300)]">
                      {b.branchCode}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-[var(--text-primary)]">
                      {b.branchName}
                    </td>
                    <td className="py-3.5 px-4 text-[var(--text-secondary)]">
                      <span className="font-mono-code font-semibold">
                        {b.compCode}
                      </span>{' '}
                      — {b.compName}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 py-0.5 font-mono-code text-[11px] font-semibold text-[var(--text-primary)]">
                        {b.branchType}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[var(--text-secondary)]">
                      {b.city || '—'}, {b.stateName || '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      {b.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                          Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Financial Years Table from PostgreSQL */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              Accounting Financial Years & Branch Locks (`tbl_org_financial_year`)
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Real-time period lock status from PostgreSQL
            </p>
          </div>
          <span className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] font-mono-code font-semibold text-[var(--text-secondary)]">
            {financialYears.length} Periods in Database
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <th className="py-3 px-4">FY Code</th>
                <th className="py-3 px-4">Period Name</th>
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Start & End Date</th>
                <th className="py-3 px-4">Branch Locks</th>
                <th className="py-3 px-4">Period Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-xs">
              {financialYears.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-[var(--text-muted)]"
                  >
                    {isLoading
                      ? 'Loading financial years from database...'
                      : 'No financial years found in database.'}
                  </td>
                </tr>
              ) : (
                financialYears.map((fy) => {
                  const total = fy.branchLocks?.length || 0;
                  const locked =
                    fy.branchLocks?.filter((b) => b.isLocked).length || 0;
                  const open = total - locked;
                  return (
                    <tr
                      key={fy.fyearId}
                      className="hover:bg-[var(--bg-hover)] transition"
                    >
                      <td className="py-3.5 px-4 font-mono-code font-bold text-[var(--brand-600)] dark:text-[var(--brand-300)]">
                        {fy.fyearCode}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-[var(--text-primary)]">
                        {fy.fyearName}
                      </td>
                      <td className="py-3.5 px-4 text-[var(--text-secondary)]">
                        <span className="font-mono-code font-semibold">
                          {fy.compCode}
                        </span>{' '}
                        — {fy.compName}
                      </td>
                      <td className="py-3.5 px-4 font-mono-code text-[var(--text-secondary)]">
                        {fy.startDate} → {fy.endDate}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 font-semibold">
                          {locked > 0 ? (
                            <Lock className="h-3.5 w-3.5 text-amber-500" />
                          ) : (
                            <LockOpen className="h-3.5 w-3.5 text-emerald-500" />
                          )}
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {open} Open
                          </span>
                          <span className="text-[var(--text-muted)]">/</span>
                          <span className="text-amber-600 dark:text-amber-400">
                            {locked} Locked
                          </span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {fy.isClosed ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-300">
                            <Lock className="h-3 w-3" /> Closed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" /> Open
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
