import React from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from './components/theme/ThemeProvider';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/auth/LoginPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { CustomerMasterPage } from './pages/parties/CustomerMasterPage';
import { PriceListMasterPage } from './pages/parties/PriceListMasterPage';
import { CompanyMasterPage } from './pages/org/CompanyMasterPage';
import { BranchMasterPage } from './pages/org/BranchMasterPage';
import { FinancialYearMasterPage } from './pages/org/FinancialYearMasterPage';
import { DepartmentDesignationPage } from './pages/hr/DepartmentDesignationPage';
import { EmployeeMasterPage } from './pages/hr/EmployeeMasterPage';
import { RoleMasterPage } from './pages/security/RoleMasterPage';
import { UserMasterPage } from './pages/security/UserMasterPage';
import { AuditLogViewerPage } from './pages/security/AuditLogViewerPage';
import { SystemConfigPage } from './pages/admin/SystemConfigPage';
import { WarehouseMasterPage } from './pages/inventory/WarehouseMasterPage';
import { UomMasterPage } from './pages/inventory/UomMasterPage';
import { ItemMasterPage } from './pages/inventory/ItemMasterPage';
import { PutAwayMasterPage } from './pages/inventory/PutAwayMasterPage';
import { RequisitionMasterPage } from './pages/procurement/RequisitionMasterPage';
import { RfqMasterPage } from './pages/procurement/RfqMasterPage';
import { PurchaseOrderMasterPage } from './pages/procurement/PurchaseOrderMasterPage';
import { GateInwardMasterPage } from './pages/procurement/GateInwardMasterPage';
import { GrnMasterPage } from './pages/procurement/GrnMasterPage';
import { PurchaseInvoiceMasterPage } from './pages/procurement/PurchaseInvoiceMasterPage';
import { InwardQcMasterPage } from './pages/quality/InwardQcMasterPage';
import { useAuthStore } from './store/useAuthStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const UpcomingModulePlaceholder: React.FC = () => {
  const location = useLocation();
  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-8 text-center space-y-2 shadow-xs">
      <div className="mx-auto inline-flex rounded-full bg-[var(--brand-50)] dark:bg-[var(--brand-500)]/20 px-3 py-1 text-xs font-bold text-[var(--brand-600)] dark:text-[var(--brand-300)]">
        Scheduled in Step-by-Step Roadmap
      </div>
      <h2 className="text-lg font-extrabold text-[var(--text-primary)]">
        Screen Route: <code className="font-mono-code">{location.pathname}</code>
      </h2>
      <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
        This screen is registered in the sidebar navigation and `tbl_sec_screen`
        catalogue and will be built end-to-end in its scheduled step.
      </p>
    </div>
  );
};

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <AppShell>{children}</AppShell>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedLayout>
                  <DashboardPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/org/companies"
              element={
                <ProtectedLayout>
                  <CompanyMasterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/org/branches"
              element={
                <ProtectedLayout>
                  <BranchMasterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/org/financial-years"
              element={
                <ProtectedLayout>
                  <FinancialYearMasterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/hr/departments"
              element={
                <ProtectedLayout>
                  <DepartmentDesignationPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/hr/employees"
              element={
                <ProtectedLayout>
                  <EmployeeMasterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/security/roles"
              element={
                <ProtectedLayout>
                  <RoleMasterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/security/users"
              element={
                <ProtectedLayout>
                  <UserMasterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/security/audit-logs"
              element={
                <ProtectedLayout>
                  <AuditLogViewerPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/admin/configurations"
              element={
                <ProtectedLayout>
                  <SystemConfigPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/inventory/warehouses"
              element={
                <ProtectedLayout>
                  <WarehouseMasterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/inventory/uoms"
              element={
                <ProtectedLayout>
                  <UomMasterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/inventory/items"
              element={
                <ProtectedLayout>
                  <ItemMasterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/inventory/put-away"
              element={
                <ProtectedLayout>
                  <PutAwayMasterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/parties/customers"
              element={
                <ProtectedLayout>
                  <CustomerMasterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/parties/master"
              element={
                <ProtectedLayout>
                  <CustomerMasterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/parties/price-lists"
              element={
                <ProtectedLayout>
                  <PriceListMasterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/procurement/requisitions"
              element={
                <ProtectedLayout>
                  <RequisitionMasterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/procurement/rfqs"
              element={
                <ProtectedLayout>
                  <RfqMasterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/procurement/purchase-orders"
              element={
                <ProtectedLayout>
                  <PurchaseOrderMasterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/procurement/gate-inward"
              element={
                <ProtectedLayout>
                  <GateInwardMasterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/procurement/grn"
              element={
                <ProtectedLayout>
                  <GrnMasterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/procurement/invoices"
              element={
                <ProtectedLayout>
                  <PurchaseInvoiceMasterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/quality/inward-qc"
              element={
                <ProtectedLayout>
                  <InwardQcMasterPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="*"
              element={
                <ProtectedLayout>
                  <UpcomingModulePlaceholder />
                </ProtectedLayout>
              }
            />
          </Routes>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
