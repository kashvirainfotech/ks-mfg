import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Boxes,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  Factory,
  Layers,
  Lock,
  Moon,
  ShieldCheck,
  Sun,
  User,
} from 'lucide-react';
import { apiClient } from '../../lib/apiClient';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const {
    themeMode,
    setThemeMode,
    setThemeColor,
    setSidebarCollapsed,
  } = useThemeStore();

  const [usernameOrEmail, setUsernameOrEmail] = useState('admin');
  const [password, setPassword] = useState('Admin@123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setLoading(true);

    try {
      const response = await apiClient.post('/auth/login', {
        usernameOrEmail,
        password,
      });
      const payload = response.data?.data;
      if (payload?.accessToken) {
        setSession(payload);
        if (payload.preferences) {
          setThemeMode(payload.preferences.themeMode || 'light');
          setThemeColor(payload.preferences.themeColor || 'indigo');
          setSidebarCollapsed(Boolean(payload.preferences.sidebarCollapsed));
        }
        navigate('/dashboard');
        return;
      }
    } catch (err: any) {
      setErrorMessage(
        err?.response?.data?.message ||
          'Unable to reach authentication server or invalid credentials.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-[var(--bg-app)] text-[var(--text-primary)]">
      {/* ====================================================================
          Left Panel: Enterprise Project Information & Capabilities
          ==================================================================== */}
      <div className="relative hidden lg:flex lg:w-7/12 flex-col justify-between overflow-hidden bg-slate-950 p-12 text-white">
        {/* Decorative Grid & Radial Glow */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(var(--brand-rgb), 0.45), transparent 55%), radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.25), transparent 50%)',
          }}
        />

        {/* Top Brand Bar */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--brand-600)] text-white shadow-lg">
              <Factory className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-extrabold tracking-tight">
                  KS-MFG ERP
                </span>
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-300 border border-white/10">
                  v1.0 Enterprise
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Kashvira Precision Manufacturing & Supply Chain Platform
              </p>
            </div>
          </div>
        </div>

        {/* Center Value Proposition & Pillars */}
        <div className="relative z-10 my-auto max-w-xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Discrete & Process Manufacturing Execution Ready
          </div>

          <h1 className="text-3xl xl:text-4xl font-extrabold tracking-tight leading-tight">
            Unified Plant Operations, Multi-Level WMS & Subcontracting Control.
          </h1>

          <p className="text-sm text-slate-300 leading-relaxed">
            Built for high-velocity manufacturing enterprises with multi-company,
            multi-branch, and financial-year isolation, dynamic bin hierarchies,
            dual-UOM conversions, and 360° batch/serial genealogy.
          </p>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
              <div className="flex items-center gap-2.5 text-indigo-300 font-bold text-xs mb-1.5">
                <Layers className="h-4 w-4" />
                <span>Multi-Company & Branch FY</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Strict tenant scoping (`comp_id`, `branch_id`, `fyear_id`) with
                branch-level financial year locking.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
              <div className="flex items-center gap-2.5 text-emerald-300 font-bold text-xs mb-1.5">
                <Boxes className="h-4 w-4" />
                <span>Dynamic N-Level Bins & Dual UOM</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Configurable Warehouse → Zone → Rack → Bin trees with automatic
                primary/secondary UOM conversions.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
              <div className="flex items-center gap-2.5 text-amber-300 font-bold text-xs mb-1.5">
                <Cpu className="h-4 w-4" />
                <span>BOM, Shopfloor & Job-Work</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Multi-stage BOM recipes, work orders, subcontractor challans
                (JWI/JWR), and scrap reconciliation.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-xs">
              <div className="flex items-center gap-2.5 text-rose-300 font-bold text-xs mb-1.5">
                <ShieldCheck className="h-4 w-4" />
                <span>Granular RBAC & Delta Audit</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Global roles with screen CRUD, action gates (`AUTHORIZE`,
                `PRINT`, `EXPORT`), and JSONB field deltas.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-xs text-slate-400">
          <span>© 2026 Kashvira Infotech • KS-MFG ERP</span>
          <span className="font-mono-code text-[11px] text-slate-500">
            PostgreSQL 16 • NestJS • React 19
          </span>
        </div>
      </div>

      {/* ====================================================================
          Right Panel: Authentication Form
          ==================================================================== */}
      <div className="flex flex-1 flex-col justify-between p-8 sm:p-12 bg-[var(--bg-surface)]">
        {/* Top Utility Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-600)] text-white">
              <Factory className="h-5 w-5" />
            </div>
            <span className="font-extrabold text-base">KS-MFG ERP</span>
          </div>
          <div className="ml-auto">
            <button
              type="button"
              onClick={() =>
                setThemeMode(themeMode === 'dark' ? 'light' : 'dark')
              }
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--brand-500)] transition cursor-pointer"
            >
              {themeMode === 'dark' ? (
                <>
                  <Sun className="h-4 w-4 text-amber-400" />
                  <span>Light Theme</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" />
                  <span>Dark Theme</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Center Login Card */}
        <div className="mx-auto w-full max-w-md space-y-6">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-[var(--text-primary)]">
              Sign in to Plant Workspace
            </h2>
            <p className="mt-1.5 text-xs text-[var(--text-muted)]">
              Enter your authorized ERP credentials to load your assigned
              Company, Branch, and Financial Year context.
            </p>
          </div>

          {errorMessage && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-600 dark:text-rose-300">
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                Username or Official Email
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  type="text"
                  required
                  value={usernameOrEmail}
                  onChange={(e) => setUsernameOrEmail(e.target.value)}
                  placeholder="admin or admin@ksmfg.com"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] pl-10 pr-4 py-2.5 text-sm font-medium text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[var(--text-secondary)] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] pl-10 pr-10 py-2.5 text-sm font-medium text-[var(--text-primary)] focus:border-[var(--brand-500)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-600)] hover:bg-[var(--brand-700)] disabled:opacity-60 px-4 py-3 text-sm font-bold text-white shadow-md transition cursor-pointer"
            >
              <span>
                {loading
                  ? 'Authenticating & Resolving Plant Context...'
                  : 'Sign In to KS-MFG ERP'}
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          {/* Seeded Super Admin Quick Reference Box */}
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3.5 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[var(--text-primary)]">
                Seeded Root Super Admin (`02_initial_data.sql`)
              </span>
              <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-300">
                SYSTEM Persona
              </span>
            </div>
            <div className="text-[var(--text-muted)] font-mono-code text-[11px]">
              Username: <strong className="text-[var(--text-primary)]">admin</strong> • Password:{' '}
              <strong className="text-[var(--text-primary)]">Admin@123</strong>
            </div>
          </div>
        </div>

        {/* Bottom Security Notice */}
        <div className="text-center text-[11px] text-[var(--text-muted)]">
          Protected by Dual-Token JWT Authentication, Granular RBAC &
          Field-Delta Audit Logging (`tbl_sys_audit_log`).
        </div>
      </div>
    </div>
  );
};
