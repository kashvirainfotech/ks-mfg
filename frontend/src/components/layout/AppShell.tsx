import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeftRight,
  Bell,
  Boxes,
  Building2,
  Calculator,
  CalendarRange,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ClipboardCheck,
  Cpu,
  Factory,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  Gauge,
  GitBranch,
  History,
  Hourglass,
  IdCard,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  Moon,
  Network,
  Package,
  PackageCheck,
  Palette,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  ReceiptText,
  RotateCcw,
  Scale,
  ShieldCheck,
  ShoppingCart,
  Sliders,
  Sun,
  Tag,
  Truck,
  UserCog,
  Users,
  Warehouse,
  Workflow,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useThemeStore } from '../../store/useThemeStore';
import { apiClient } from '../../lib/apiClient';
import { ThemeCustomizerModal } from '../theme/ThemeCustomizerModal';

interface NavGroup {
  groupLabel: string;
  items: {
    code: string;
    label: string;
    path: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: string;
  }[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    groupLabel: 'OVERVIEW',
    items: [
      {
        code: 'DASHBOARD',
        label: 'Plant Dashboard',
        path: '/dashboard',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    groupLabel: 'CRM & PARTIES',
    items: [
      {
        code: 'PARTY_MASTER',
        label: 'Customer Master',
        path: '/parties/customers',
        icon: Users,
      },
      {
        code: 'PRICE_LIST',
        label: 'Tiered Price Lists',
        path: '/parties/price-lists',
        icon: Tag,
      },
    ],
  },
  {
    groupLabel: 'INVENTORY & WMS',
    items: [
      {
        code: 'WAREHOUSE_MASTER',
        label: 'Warehouse & Bins',
        path: '/inventory/warehouses',
        icon: Warehouse,
      },
      {
        code: 'UOM_MASTER',
        label: 'UOM & Categories',
        path: '/inventory/uoms',
        icon: Scale,
      },
      {
        code: 'ITEM_MASTER',
        label: 'Item & BOM Catalog',
        path: '/inventory/items',
        icon: Package,
      },
      {
        code: 'BIN_PUTAWAY',
        label: 'Bin Put-Away & Stock',
        path: '/inventory/put-away',
        icon: Layers,
      },
      {
        code: 'STOCK_BALANCE',
        label: 'Stock Balance & Valuation',
        path: '/inventory/balance',
        icon: Calculator,
      },
      {
        code: 'STOCK_ADJUSTMENT',
        label: 'Stock Reconciliation & Audit',
        path: '/inventory/adjustments',
        icon: ClipboardCheck,
      },
      {
        code: 'STOCK_TRANSFER',
        label: 'Stock Transfers & STO',
        path: '/inventory/transfers',
        icon: ArrowLeftRight,
      },
      {
        code: 'STOCK_TRACEABILITY',
        label: 'Traceability & Genealogy',
        path: '/inventory/traceability',
        icon: Network,
      },
      {
        code: 'STOCK_AGING',
        label: 'Aging & Dead Stock Alerts',
        path: '/inventory/aging',
        icon: Hourglass,
      },
    ],
  },
  {
    groupLabel: 'PROCUREMENT & SOURCING',
    items: [
      {
        code: 'PURCHASE_REQ',
        label: 'Purchase Requisitions',
        path: '/procurement/requisitions',
        icon: ShoppingCart,
      },
      {
        code: 'PROCUREMENT_RFQ',
        label: 'Requests for Quotation',
        path: '/procurement/rfqs',
        icon: FileSpreadsheet,
      },
      {
        code: 'PURCHASE_ORDER',
        label: 'Purchase Orders',
        path: '/procurement/purchase-orders',
        icon: Receipt,
      },
      {
        code: 'GATE_INWARD',
        label: 'Gate Inward & Security',
        path: '/procurement/gate-inward',
        icon: Truck,
      },
      {
        code: 'PURCHASE_GRN',
        label: 'Goods Receipt (GRN)',
        path: '/procurement/grn',
        icon: FileCheck2,
      },
      {
        code: 'PURCHASE_INVOICE',
        label: 'Invoices & 3-Way Match',
        path: '/procurement/invoices',
        icon: ReceiptText,
      },
    ],
  },
  {
    groupLabel: 'QUALITY ASSURANCE & QC',
    items: [
      {
        code: 'INWARD_QC',
        label: 'Inward Material QC',
        path: '/quality/inward-qc',
        icon: FlaskConical,
      },
      {
        code: 'IN_PROCESS_QC',
        label: 'In-Process & Stage QC',
        path: '/quality/in-process-qc',
        icon: CheckCircle2,
      },
      {
        code: 'PDI_QC',
        label: 'Pre-Dispatch QC & CoA',
        path: '/quality/pdi',
        icon: ShieldCheck,
      },
      {
        code: 'NCR_QC',
        label: 'NCR & 8D CAPA Engine',
        path: '/quality/ncr',
        icon: AlertTriangle,
      },
      {
        code: 'CALIBRATION_QC',
        label: 'Gauge Calibration Register',
        path: '/quality/calibration',
        icon: Gauge,
      },
    ],
  },
  {
    groupLabel: 'MANUFACTURING & PRODUCTION',
    items: [
      {
        code: 'MFG_BOM',
        label: 'Bill of Materials (BOM)',
        path: '/manufacturing/boms',
        icon: Layers,
      },
      {
        code: 'MFG_WORK_CENTER',
        label: 'Work Centers & Capacities',
        path: '/manufacturing/work-centers',
        icon: Cpu,
      },
      {
        code: 'MFG_ROUTING',
        label: 'Production Routings',
        path: '/manufacturing/routings',
        icon: Workflow,
      },
      {
        code: 'MFG_MRP',
        label: 'Material Requirements (MRP)',
        path: '/manufacturing/mrp',
        icon: Calculator,
      },
      {
        code: 'MFG_WORK_ORDER',
        label: 'Production Work Orders',
        path: '/manufacturing/work-orders',
        icon: Factory,
      },
      {
        code: 'MFG_MATERIAL_ISSUE',
        label: 'Material Issues & Staging',
        path: '/manufacturing/material-issues',
        icon: Boxes,
      },
      {
        code: 'MFG_JOB_CARD',
        label: 'Job Cards & Shopfloor MES',
        path: '/manufacturing/job-cards',
        icon: CheckSquare,
      },
      {
        code: 'MFG_JOB_WORK',
        label: 'Subcontractor Job-Work',
        path: '/manufacturing/job-work',
        icon: Truck,
      },
      {
        code: 'MFG_FG_RECEIPT',
        label: 'Finished Goods Receipts',
        path: '/manufacturing/fg-receipts',
        icon: PackageCheck,
      },
    ],
  },
  {
    groupLabel: 'SALES & DISTRIBUTION',
    items: [
      {
        code: 'SALES_QUOTATION',
        label: 'Quotations & Proforma Invoices',
        path: '/sales/quotations',
        icon: FileText,
      },
      {
        code: 'SALES_ORDER',
        label: 'Sales Orders & ATP Stock',
        path: '/sales/orders',
        icon: ShoppingCart,
      },
      {
        code: 'DELIVERY_CHALLAN',
        label: 'Delivery Challans & Dispatch',
        path: '/sales/delivery-challans',
        icon: Truck,
      },
      {
        code: 'SALES_INVOICE',
        label: 'Tax Invoices & Receivables',
        path: '/sales/invoices',
        icon: Receipt,
      },
      {
        code: 'SALES_RETURN',
        label: 'Returns & Credit Notes',
        path: '/sales/returns',
        icon: RotateCcw,
      },
    ],
  },
  {
    groupLabel: 'ORGANIZATION',
    items: [
      {
        code: 'COMPANY_MASTER',
        label: 'Company Master',
        path: '/org/companies',
        icon: Building2,
      },
      {
        code: 'BRANCH_MASTER',
        label: 'Branch & Plants',
        path: '/org/branches',
        icon: GitBranch,
      },
      {
        code: 'FYEAR_MASTER',
        label: 'Financial Years',
        path: '/org/financial-years',
        icon: CalendarRange,
      },
    ],
  },
  {
    groupLabel: 'SECURITY & RBAC',
    items: [
      {
        code: 'DEPT_MASTER',
        label: 'Depts & Designations',
        path: '/hr/departments',
        icon: Network,
      },
      {
        code: 'EMPLOYEE_MASTER',
        label: 'Employee Master',
        path: '/hr/employees',
        icon: IdCard,
      },
      {
        code: 'ROLE_MASTER',
        label: 'Global Roles & Perms',
        path: '/security/roles',
        icon: ShieldCheck,
      },
      {
        code: 'USER_MASTER',
        label: 'User Master',
        path: '/security/users',
        icon: UserCog,
      },
      {
        code: 'AUDIT_LOG',
        label: 'Activity & Delta Log',
        path: '/security/audit-logs',
        icon: History,
      },
      {
        code: 'CONFIG_MASTER',
        label: 'System Configuration',
        path: '/admin/configurations',
        icon: Sliders,
      },
    ],
  },
];

export const AppShell: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    user,
    activeContext,
    allowedCompanies,
    allowedBranches,
    allowedFinancialYears,
    updateContext,
    clearSession,
    isCurrentFyearLocked,
  } = useAuthStore();

  const {
    themeMode,
    sidebarCollapsed,
    setThemeMode,
    toggleSidebarCollapsed,
  } = useThemeStore();

  const [isHoverExpanded, setIsHoverExpanded] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);

  const contextMenuRef = useRef<HTMLDivElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(target)
      ) {
        setIsContextMenuOpen(false);
      }
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(target)
      ) {
        setIsProfileMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsContextMenuOpen(false);
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const showFullSidebar = !sidebarCollapsed || isHoverExpanded;

  const currentCompany =
    allowedCompanies.find((c) => c.compId === activeContext.compId) ||
    allowedCompanies[0];
  const branchesForCompany = allowedBranches.filter(
    (b) => b.compId === activeContext.compId,
  );
  const currentBranch =
    branchesForCompany.find((b) => b.branchId === activeContext.branchId) ||
    branchesForCompany[0] ||
    allowedBranches[0];
  const fyearsForCompany = allowedFinancialYears.filter(
    (f) => f.compId === activeContext.compId,
  );
  const currentFyear =
    fyearsForCompany.find((f) => f.fyearId === activeContext.fyearId) ||
    fyearsForCompany[0] ||
    allowedFinancialYears[0];

  const handleMenuClick = (path: string) => {
    // Immediately collapse hover-expanded drawer when a menu item is clicked
    if (sidebarCollapsed) {
      setIsHoverExpanded(false);
    }
    navigate(path);
  };

  const handleSwitchContext = async (
    compId: number,
    branchId: number,
    fyearId: number,
  ) => {
    try {
      const res = await apiClient.post('/auth/switch-context', {
        compId,
        branchId,
        fyearId,
      });
      const payload = res.data?.data;
      if (payload) {
        updateContext(
          payload.activeContext,
          payload.accessToken,
          payload.permissions,
        );
      } else {
        updateContext({ compId, branchId, fyearId });
      }
    } catch {
      updateContext({ compId, branchId, fyearId });
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore if backend is offline
    }
    clearSession();
    navigate('/login');
  };

  const fyLocked = isCurrentFyearLocked();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-app)] text-[var(--text-primary)]">
      {/* ====================================================================
          Hover-to-Peek Collapsible Sidebar
          ==================================================================== */}
      <div
        id="sidebar-wrapper"
        className={sidebarCollapsed ? 'is-collapsed' : ''}
      >
        <aside
          id="app-sidebar"
          onMouseEnter={() => {
            if (sidebarCollapsed) setIsHoverExpanded(true);
          }}
          onMouseLeave={() => {
            if (sidebarCollapsed) setIsHoverExpanded(false);
          }}
          className={`flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] select-none ${
            sidebarCollapsed ? 'collapsed' : ''
          } ${sidebarCollapsed && isHoverExpanded ? 'hover-expanded' : ''}`}
        >
          {/* Brand Header */}
          <div className="flex h-16 items-center justify-between border-b border-[var(--border-subtle)] px-4 shrink-0">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-600)] text-white shadow-sm">
                <Factory className="h-5 w-5" />
              </div>
              {showFullSidebar && (
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-extrabold tracking-tight text-sm text-[var(--text-primary)]">
                      KS-MFG
                    </span>
                    <span className="rounded-md bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/20 px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand-600)] dark:text-[var(--brand-300)]">
                      ERP
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] truncate">
                    Discrete & Process MES
                  </p>
                </div>
              )}
            </div>

            {showFullSidebar && (
              <button
                type="button"
                onClick={toggleSidebarCollapsed}
                title={
                  sidebarCollapsed
                    ? 'Pin Sidebar Open'
                    : 'Collapse Sidebar to Icon Rail'
                }
                className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition cursor-pointer"
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen className="h-4 w-4 text-[var(--brand-500)]" />
                ) : (
                  <PanelLeftClose className="h-4 w-4" />
                )}
              </button>
            )}
          </div>

          {/* Navigation Groups */}
          <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
            {NAV_GROUPS.map((group) => (
              <div key={group.groupLabel}>
                {showFullSidebar ? (
                  <div className="px-2.5 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                    {group.groupLabel}
                  </div>
                ) : (
                  <div className="my-1.5 mx-auto h-px w-6 bg-[var(--border-subtle)]" />
                )}

                <div className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive =
                      location.pathname === item.path ||
                      (item.path !== '/dashboard' &&
                        location.pathname.startsWith(item.path));

                    return (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => handleMenuClick(item.path)}
                        title={!showFullSidebar ? item.label : undefined}
                        className={`group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition cursor-pointer ${
                          !showFullSidebar ? 'justify-center px-0' : ''
                        } ${
                          isActive
                            ? 'bg-[var(--brand-600)] text-white shadow-xs'
                            : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <Icon
                          className={`h-4 w-4 shrink-0 ${
                            isActive
                              ? 'text-white'
                              : 'text-[var(--text-muted)] group-hover:text-[var(--brand-500)]'
                          }`}
                        />
                        {showFullSidebar && (
                          <>
                            <span className="flex-1 text-left truncate">
                              {item.label}
                            </span>
                            {item.badge && (
                              <span
                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                  isActive
                                    ? 'bg-white/20 text-white'
                                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Sidebar Footer: Collapse/Expand Toggle & Active Plant Status */}
          <div className="border-t border-[var(--border-subtle)] p-3 shrink-0">
            {showFullSidebar ? (
              <div className="flex items-center justify-between rounded-xl bg-[var(--bg-elevated)] px-3 py-2.5 border border-[var(--border-subtle)]">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[11px] font-bold text-[var(--text-primary)] truncate">
                      {currentBranch?.branchCode || 'PLT-AHM-01'}
                    </span>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] truncate">
                    {currentCompany?.compCode} • {currentFyear?.fyearCode}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsThemeModalOpen(true)}
                  className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--brand-500)] transition cursor-pointer"
                  title="Appearance & Theme Settings"
                >
                  <Palette className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={toggleSidebarCollapsed}
                title="Expand Sidebar"
                className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] transition cursor-pointer"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* ====================================================================
          Main Content Area (Top Header + Screen Viewport)
          ==================================================================== */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-6">
          {/* Left: Active Company / Branch / Financial Year Switcher */}
          <div className="flex items-center gap-3">
            <div ref={contextMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  setIsContextMenuOpen((v) => !v);
                }}
                className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:border-[var(--brand-500)] transition cursor-pointer"
              >
                <Building2 className="h-4 w-4 text-[var(--brand-500)]" />
                <span className="font-bold">
                  {currentCompany?.compCode || 'KSMFG'}
                </span>
                <span className="text-[var(--text-muted)]">/</span>
                <GitBranch className="h-3.5 w-3.5 text-emerald-500" />
                <span>
                  {currentBranch?.branchName || 'Ahmedabad Main Plant'}
                </span>
                <span className="text-[var(--text-muted)]">/</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-mono-code font-bold ${
                    fyLocked
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300'
                      : 'bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/20 text-[var(--brand-600)] dark:text-[var(--brand-300)]'
                  }`}
                >
                  {fyLocked && <Lock className="h-3 w-3" />}
                  {currentFyear?.fyearCode || '2026-27'}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </button>

              {/* Context Switcher Popover */}
              {isContextMenuOpen && (
                <div className="absolute left-0 mt-2 w-88 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 shadow-2xl z-50 space-y-3">
                  <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      Switch Active Plant & Accounting Period
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsContextMenuOpen(false)}
                      className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                    >
                      Close
                    </button>
                  </div>

                  {/* Company Select */}
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
                      Company Entity (`comp_id`)
                    </label>
                    <select
                      value={activeContext.compId}
                      onChange={(e) => {
                        const newCompId = Number(e.target.value);
                        const firstBranch =
                          allowedBranches.find((b) => b.compId === newCompId)
                            ?.branchId || activeContext.branchId;
                        const firstFy =
                          allowedFinancialYears.find(
                            (f) => f.compId === newCompId,
                          )?.fyearId || activeContext.fyearId;
                        void handleSwitchContext(
                          newCompId,
                          firstBranch,
                          firstFy,
                        );
                      }}
                      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-2 text-xs font-semibold text-[var(--text-primary)]"
                    >
                      {allowedCompanies.map((c) => (
                        <option key={c.compId} value={c.compId}>
                          {c.compCode} — {c.compName}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Branch Select */}
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
                      Plant / Branch (`branch_id`)
                    </label>
                    <select
                      value={activeContext.branchId}
                      onChange={(e) => {
                        void handleSwitchContext(
                          activeContext.compId,
                          Number(e.target.value),
                          activeContext.fyearId,
                        );
                      }}
                      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-2 text-xs font-semibold text-[var(--text-primary)]"
                    >
                      {branchesForCompany.map((b) => (
                        <option key={b.branchId} value={b.branchId}>
                          {b.branchCode} — {b.branchName} ({b.city})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Financial Year Select */}
                  <div>
                    <label className="block text-[11px] font-bold text-[var(--text-muted)] mb-1">
                      Financial Year (`fyear_id`)
                    </label>
                    <select
                      value={activeContext.fyearId}
                      onChange={(e) => {
                        void handleSwitchContext(
                          activeContext.compId,
                          activeContext.branchId,
                          Number(e.target.value),
                        );
                      }}
                      className="w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-2 text-xs font-semibold text-[var(--text-primary)]"
                    >
                      {fyearsForCompany.map((f) => (
                        <option key={f.fyearId} value={f.fyearId}>
                          {f.fyearName} {f.isLocked ? '🔒 (Locked)' : '✓ (Open)'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>

            {fyLocked && (
              <span className="hidden md:inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-300">
                <Lock className="h-3.5 w-3.5" />
                Read-Only Period (Branch FY Locked)
              </span>
            )}
          </div>

          {/* Right: Quick Theme Controls, Notifications, User Profile Menu */}
          <div className="flex items-center gap-2.5">
            {/* Quick Light/Dark Toggle */}
            <button
              type="button"
              onClick={() =>
                setThemeMode(themeMode === 'dark' ? 'light' : 'dark')
              }
              title="Toggle Light / Dark Theme"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--brand-500)] hover:text-[var(--brand-500)] transition cursor-pointer"
            >
              {themeMode === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            {/* Theme Palette Customizer Button */}
            <button
              type="button"
              onClick={() => setIsThemeModalOpen(true)}
              title="Customize Theme Color & Layout"
              className="flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 text-xs font-semibold text-[var(--text-secondary)] hover:border-[var(--brand-500)] hover:text-[var(--brand-500)] transition cursor-pointer"
            >
              <Palette className="h-4 w-4 text-[var(--brand-500)]" />
              <span className="hidden sm:inline">Theme</span>
            </button>

            {/* Notifications */}
            <button
              type="button"
              title="Plant Alerts & Approvals"
              className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:border-[var(--brand-500)] transition cursor-pointer"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500" />
            </button>

            {/* User Profile Dropdown */}
            <div ref={profileMenuRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsContextMenuOpen(false);
                  setIsProfileMenuOpen((v) => !v);
                }}
                className="flex items-center gap-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] pl-2 pr-3 py-1.5 hover:border-[var(--brand-500)] transition cursor-pointer"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--brand-600)] text-xs font-bold text-white">
                  {user?.fullName?.slice(0, 2).toUpperCase() || 'SA'}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-bold text-[var(--text-primary)] leading-tight">
                    {user?.fullName || 'Rajesh Patel'}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] leading-tight">
                    {user?.isSuperAdmin
                      ? 'Global Super Admin'
                      : user?.userCategory}
                  </div>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
              </button>

              {isProfileMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 shadow-2xl z-50">
                  <div className="border-b border-[var(--border-subtle)] px-3 py-2.5">
                    <div className="text-xs font-bold text-[var(--text-primary)]">
                      {user?.fullName}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)]">
                      {user?.email}
                    </div>
                    <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/20 px-2 py-0.5 text-[10px] font-bold text-[var(--brand-600)] dark:text-[var(--brand-300)]">
                      Persona: {user?.userCategory || 'SYSTEM'}
                    </div>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        setIsThemeModalOpen(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      <Palette className="h-4 w-4 text-[var(--brand-500)]" />
                      <span>Theme & Display Preferences</span>
                    </button>
                  </div>

                  <div className="border-t border-[var(--border-subtle)] pt-1">
                    <button
                      type="button"
                      onClick={() => void handleLogout()}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Screen Content */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>

      {/* Theme Customizer Modal */}
      <ThemeCustomizerModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
      />
    </div>
  );
};
