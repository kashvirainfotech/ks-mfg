import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  Clock,
  Download,
  Factory,
  Layers,
  PackageCheck,
  Plus,
  Users,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { PermissionGate } from '../../components/common/PermissionGate';

const PRODUCTION_ORDERS = [
  {
    woNo: 'PLT-AHM/26-27/PWO/00142',
    itemCode: 'FG-VLV-200',
    itemName: 'High-Pressure Forged Ball Valve 50mm',
    stage: 'CNC Machining & Lapping',
    batchNo: 'LOT-2610-A8',
    plannedQty: '250 PCS',
    completedQty: '195 PCS',
    progress: 78,
    status: 'IN_PROGRESS',
  },
  {
    woNo: 'PLT-AHM/26-27/PWO/00143',
    itemCode: 'SFG-SHF-104',
    itemName: 'SS-316 Precision Actuator Stem Shaft',
    stage: 'Subcontract Heat Treatment (JWI-0089)',
    batchNo: 'LOT-2610-B2',
    plannedQty: '500 PCS',
    completedQty: '500 PCS',
    progress: 100,
    status: 'COMPLETED',
  },
  {
    woNo: 'PLT-AHM/26-27/PWO/00144',
    itemCode: 'FG-PMP-410',
    itemName: 'Centrifugal Chemical Process Pump 15HP',
    stage: 'Dynamic Balancing & Hydro Testing',
    batchNo: 'LOT-2610-C1',
    plannedQty: '40 NOS',
    completedQty: '18 NOS',
    progress: 45,
    status: 'QC_HOLD',
  },
  {
    woNo: 'PLT-AHM/26-27/PWO/00145',
    itemCode: 'FG-FLG-880',
    itemName: 'ANSI B16.5 Weld-Neck Flange 150#',
    stage: 'Raw Material Bin Picking (MIS-0211)',
    batchNo: 'LOT-2610-D4',
    plannedQty: '1,200 PCS',
    completedQty: '360 PCS',
    progress: 30,
    status: 'IN_PROGRESS',
  },
];

const MONTHLY_OUTPUT = [
  { month: 'May', target: 82, actual: 79 },
  { month: 'Jun', target: 85, actual: 84 },
  { month: 'Jul', target: 88, actual: 86 },
  { month: 'Aug', target: 90, actual: 92 },
  { month: 'Sep', target: 92, actual: 91 },
  { month: 'Oct', target: 95, actual: 94 },
];

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    user,
    activeContext,
    allowedCompanies,
    allowedBranches,
    allowedFinancialYears,
  } = useAuthStore();

  const currentCompany = allowedCompanies.find(
    (c) => c.compId === activeContext.compId,
  );
  const currentBranch = allowedBranches.find(
    (b) => b.branchId === activeContext.branchId,
  );
  const currentFyear = allowedFinancialYears.find(
    (f) => f.fyearId === activeContext.fyearId,
  );

  return (
    <div className="space-y-6">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold tracking-tight text-[var(--text-primary)]">
              Plant Operations & Inventory Command Center
            </h1>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
              Live Telemetry
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            Active Scope:{' '}
            <strong className="text-[var(--text-secondary)]">
              {currentCompany?.compName || 'Kashvira Manufacturing ERP'}
            </strong>{' '}
            •{' '}
            <strong className="text-[var(--text-secondary)]">
              {currentBranch?.branchName || 'Ahmedabad Main Plant & HO'}
            </strong>{' '}
            ({currentFyear?.fyearName || 'FY 2026-2027'})
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <PermissionGate screen="DASHBOARD" action="EXPORT">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3.5 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--brand-500)] transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export KPIs</span>
            </button>
          </PermissionGate>

          <button
            type="button"
            onClick={() => navigate('/parties/customers')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] px-3.5 py-2 text-xs font-bold text-white shadow-xs transition cursor-pointer"
          >
            <Users className="h-3.5 w-3.5" />
            <span>Open Customer Master</span>
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Active Work Orders
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/20 text-[var(--brand-600)] dark:text-[var(--brand-300)]">
              <Factory className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[var(--text-primary)]">
              38
            </span>
            <span className="inline-flex items-center text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <ArrowUpRight className="h-3.5 w-3.5" /> +12.4%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            29 Discrete Assembly • 9 Process Batches
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Plant OEE & First-Pass Yield
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
              <Activity className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[var(--text-primary)]">
              94.2%
            </span>
            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              Target 92.0%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            Scrap rate held at 0.84% across 4 CNC cells
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Warehouse Bin Utilization
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
              <Boxes className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[var(--text-primary)]">
              1,420
            </span>
            <span className="text-xs font-semibold text-[var(--text-muted)]">
              / 1,680 Active Bins
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            14 GRNs pending bin put-away allocation
          </p>
        </div>

        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Subcontracting (Job-Work)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
              <Layers className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-extrabold text-[var(--text-primary)]">
              ₹18.6L
            </span>
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              11 Open Challans
            </span>
          </div>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            Material lying with 6 approved Job-Workers
          </p>
        </div>
      </div>

      {/* Charts Row: Production Output vs Target & Warehouse Hierarchy Health */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Bar Chart Card */}
        <div className="lg:col-span-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                Shopfloor Production Attainment (Target vs Actual)
              </h2>
              <p className="text-xs text-[var(--text-muted)]">
                Monthly finished goods receipt (PRN) efficiency across active
                work centers
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="inline-flex items-center gap-1.5 text-[var(--text-secondary)]">
                <span className="h-2.5 w-2.5 rounded-xs bg-[var(--brand-600)]" />
                Actual %
              </span>
              <span className="inline-flex items-center gap-1.5 text-[var(--text-muted)]">
                <span className="h-2.5 w-2.5 rounded-xs bg-slate-300 dark:bg-slate-700" />
                Target %
              </span>
            </div>
          </div>

          <div className="grid grid-cols-6 gap-4 items-end h-44 pt-4 px-2">
            {MONTHLY_OUTPUT.map((m) => (
              <div
                key={m.month}
                className="flex flex-col items-center gap-2 h-full justify-end"
              >
                <div className="flex items-end gap-1.5 w-full justify-center h-32">
                  <div
                    className="w-3.5 rounded-t-md bg-slate-300 dark:bg-slate-700 transition-all"
                    style={{ height: `${m.target}%` }}
                    title={`Target: ${m.target}%`}
                  />
                  <div
                    className="w-3.5 rounded-t-md bg-[var(--brand-600)] transition-all"
                    style={{ height: `${m.actual}%` }}
                    title={`Actual: ${m.actual}%`}
                  />
                </div>
                <span className="text-[11px] font-bold text-[var(--text-secondary)]">
                  {m.month}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Multi-Level Warehouse Storage Breakdown */}
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              Multi-Level Storage Occupancy
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Real-time bin capacity by warehouse zone
            </p>

            <div className="mt-4 space-y-3.5">
              {[
                {
                  zone: 'WH-01 • Raw Material Rack Bins',
                  used: 86,
                  color: 'bg-[var(--brand-600)]',
                },
                {
                  zone: 'WH-02 • Semi-Finished WIP Cage',
                  used: 64,
                  color: 'bg-emerald-500',
                },
                {
                  zone: 'WH-03 • Finished Goods Dispatch',
                  used: 72,
                  color: 'bg-amber-500',
                },
                {
                  zone: 'WH-04 • QC Quarantine Chamber',
                  used: 28,
                  color: 'bg-violet-500',
                },
              ].map((w) => (
                <div key={w.zone}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-semibold text-[var(--text-secondary)]">
                      {w.zone}
                    </span>
                    <span className="font-mono-code font-bold text-[var(--text-primary)]">
                      {w.used}%
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[var(--bg-muted)] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${w.color}`}
                      style={{ width: `${w.used}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-xs flex items-center justify-between">
            <span className="text-[var(--text-muted)]">
              Logged in as{' '}
              <strong className="text-[var(--text-primary)]">
                {user?.username}
              </strong>
            </span>
            <span className="font-mono-code text-[11px] text-[var(--brand-600)] dark:text-[var(--brand-300)] font-bold">
              comp_id={activeContext.compId} • branch_id=
              {activeContext.branchId}
            </span>
          </div>
        </div>
      </div>

      {/* Active Shopfloor Production Work Orders Table */}
      <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)]">
              Live Production Work Orders & Batch Execution
            </h2>
            <p className="text-xs text-[var(--text-muted)]">
              Real-time shopfloor status with Batch/Lot traceability and Dual-UOM
              tracking
            </p>
          </div>
          <span className="rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2.5 py-1 text-[11px] font-mono-code font-semibold text-[var(--text-secondary)]">
            Showing 4 Active Batches
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <th className="py-3 px-4">Work Order No</th>
                <th className="py-3 px-4">Item & Specification</th>
                <th className="py-3 px-4">Current Routing Operation</th>
                <th className="py-3 px-4">Batch / Lot</th>
                <th className="py-3 px-4">Planned vs Completed</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)] text-xs">
              {PRODUCTION_ORDERS.map((row) => (
                <tr
                  key={row.woNo}
                  className="hover:bg-[var(--bg-hover)] transition"
                >
                  <td className="py-3.5 px-4 font-mono-code font-bold text-[var(--brand-600)] dark:text-[var(--brand-300)]">
                    {row.woNo}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-bold text-[var(--text-primary)]">
                      {row.itemName}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] font-mono-code">
                      {row.itemCode}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-[var(--text-secondary)] font-medium">
                    {row.stage}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="rounded-md bg-[var(--bg-elevated)] border border-[var(--border-subtle)] px-2 py-0.5 font-mono-code text-[11px] font-semibold text-[var(--text-primary)]">
                      {row.batchNo}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                      <span className="text-[var(--text-primary)]">
                        {row.completedQty}
                      </span>
                      <span className="text-[var(--text-muted)]">
                        of {row.plannedQty} ({row.progress}%)
                      </span>
                    </div>
                    <div className="h-1.5 w-36 rounded-full bg-[var(--bg-muted)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--brand-600)]"
                        style={{ width: `${row.progress}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    {row.status === 'COMPLETED' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> Completed
                      </span>
                    )}
                    {row.status === 'IN_PROGRESS' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/20 px-2.5 py-0.5 text-[11px] font-bold text-[var(--brand-600)] dark:text-[var(--brand-300)]">
                        <Clock className="h-3 w-3" /> In Progress
                      </span>
                    )}
                    {row.status === 'QC_HOLD' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[11px] font-bold text-violet-600 dark:text-violet-300">
                        <AlertTriangle className="h-3 w-3" /> QC Quarantine
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
