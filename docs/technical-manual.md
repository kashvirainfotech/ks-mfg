# KS-MFG Web ERP - Technical Architecture & Developer Reference Manual

**Document Version:** 1.0.0  
**Target Audience:** Backend Developers, Frontend Engineers, DevOps Engineers, System Integrators  

---

## 1. Developer Onboarding & Core Architecture

### 1.1 Architectural Foundations
* **Backend:** Node.js (v22 LTS), NestJS, Drizzle ORM (strictly in non-sync query mode), PostgreSQL 16+, Redis.
* **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, Shadcn UI, TanStack Query, TanStack Table.
* **Database Management:** Manual versioned SQL scripts in `backend/db/scripts/`. No auto-sync tools permitted.
* **Key Conventions:**
  * All PKs named `<singular_entity>_id` with values sourced from PostgreSQL sequences (`seq_<singular_entity>_id`).
  * 7 standard audit & tenancy columns on every table (`comp_id`, `branch_id`, `fyear_id`, `created_by`, `created_date`, `updated_by`, `updated_date`).
  * Granular RBAC enforcing screen permissions (`can_view`, `can_add`, `can_edit`, `can_delete`) and action items (`PRINT`, `EXPORT`, `AUTHORIZE`, `CANCEL`, `REOPEN`).

---

## 2. Feature & Screen Technical Implementations

*(Note: As each screen and feature is implemented step-by-step, its technical reference will be appended here.)*

### 2.0 Standard Template for Each Screen/Feature Entry
Each screen or feature documentation entry must contain:
1. **Database Objects:** Tables, sequences, indexes, and triggers used or modified.
2. **Backend API Contracts:** Endpoints, HTTP methods, route guards (`AuthGuard`, `PermissionsGuard`), DTO validation rules.
3. **Domain Logic & Math:** Formulas (e.g. conversion factors, tax computations, sequence locking logic).
4. **Frontend Architecture:** Component hierarchy, React Hook Form schemas, TanStack Query keys, `<PermissionGate>` wrappers.
5. **Cross-Feature Impacts:** Dependencies and touchpoints with other modules.

---

### 2.1 Step 0.1 — Core Database Schema, RBAC Engine, Audit Trail & Auth API

1. **Database Objects (`dbscripts/`):**
   * **Schema Objects (`dbscripts/01_schema_objects.sql`):**
     * Tenancy: `tbl_org_company` (`seq_comp_id`), `tbl_org_branch` (`seq_branch_id`), `tbl_org_financial_year` (`seq_fyear_id`), `tbl_org_branch_fyear` (`seq_branch_fyear_id`).
     * RBAC: `tbl_sec_role` (`seq_role_id`), `tbl_sec_screen` (`seq_screen_id`), `tbl_sec_action` (`seq_action_id`), `tbl_sec_role_permission` (`seq_role_permission_id`), `tbl_sec_role_action_permission` (`seq_role_action_permission_id`).
     * Users & Preferences: `tbl_sec_user` (`seq_user_id`), `tbl_sec_user_company_role` (`seq_user_company_role_id`), `tbl_sec_user_branch_role` (`seq_user_branch_role_id`), `tbl_sec_user_preference` (`seq_user_preference_id`).
     * Universal Audit Trail: `tbl_sys_audit_log` (`seq_audit_id`).
   * **Functions & Triggers:**
     * `dbscripts/functions/fn_set_updated_timestamp.sql`
     * `dbscripts/triggers/trg_set_updated_timestamp.sql`
   * **System Seeds & Demo Data:**
     * `dbscripts/02_initial_data.sql`: Seeds default Company (`1001`), Branch (`1001`), Financial Year (`1001`), 5 Global Roles (`1001..1005`), 15 System Screens (`1001..1015`), Action Items, and Root Super Admin (`admin` / `Admin@123`).
     * `dbscripts/03_sample_demo_data.sql`: Seeds secondary demo Company (`1002`), additional plant branches (`1002`, `1003`), and FY `2025-26` (`1002`).
2. **Backend API Contracts (`backend/src/`):**
   * `GET /api/v1/health` (`@Public()`): Service health check.
   * `POST /api/v1/auth/login` (`@Public()`): Authenticates credentials with `bcrypt`, issues short-lived Access Token + `httpOnly` Refresh Token cookie, resolves allowed companies/branches/FYs, permissions matrix, and user theme preferences, and logs `LOGIN` in `tbl_sys_audit_log`.
   * `GET /api/v1/auth/me`: Returns current authenticated user context, allowed tenancy options, permissions matrix, and preferences.
   * `POST /api/v1/auth/switch-context`: Validates access to target `(compId, branchId, fyearId)` and re-issues scoped JWT tokens + updated permissions.
   * `PATCH /api/v1/auth/preferences`: Updates `themeMode`, `themeColor`, `sidebarCollapsed`, and default context in `tbl_sec_user_preference` with JSONB field-delta audit logging.
   * `POST /api/v1/auth/refresh` & `POST /api/v1/auth/logout`: Token rotation and Redis blacklist revocation.
3. **Core Cross-Cutting Services & Guards:**
   * `DependencyCheckService` (`backend/src/common/services/dependency-check.service.ts`): Enforces pre-deletion referential checks across specified child tables and throws HTTP `409 Conflict` (`DependencyConflictException`) with detailed table/count breakdown.
   * `AuditLogService` & `AuditLogInterceptor`: Computes JSONB `old_value`, `new_value`, and `changed_fields` diffs for all mutations and action items.
   * `JwtAuthGuard` & `PermissionsGuard`: Enforces JWT validity, Redis token revocation check, and screen/action RBAC rules.

---

### 2.2 Step 0.2 — Frontend Core, Theme Engine, AppShell & Login/Dashboard

1. **State Management & API Client (`frontend/src/`):**
   * `useAuthStore` (`frontend/src/store/useAuthStore.ts`): Persisted Zustand store holding `accessToken`, `user`, `activeContext` (`compId`, `branchId`, `fyearId`), `allowedCompanies`, `allowedBranches`, `allowedFinancialYears`, `permissions`, `hasPermission(screenCode, action)`, and `isCurrentFyearLocked()`.
   * `useThemeStore` (`frontend/src/store/useThemeStore.ts`): Persisted Zustand store managing `themeMode` (`light` | `dark` | `system`), `themeColor` (`indigo` | `blue` | `emerald` | `violet` | `amber` | `rose`), and `sidebarCollapsed`, synchronized with `<html>` classes and `data-theme-color`.
   * `apiClient` (`frontend/src/lib/apiClient.ts`): Axios instance attaching `Authorization: Bearer <token>`, `x-comp-id`, `x-branch-id`, `x-fyear-id` headers, and automatic `401` token refresh rotation via `/api/v1/auth/refresh`.
2. **Approved Generic UI Components (`frontend/src/components/`):**
   * `<ThemeProvider>` & `<ThemeCustomizerModal>` (`frontend/src/components/theme/`): Live workspace appearance customizer syncing changes to `PATCH /api/v1/auth/preferences`.
   * `<AppShell>` (`frontend/src/components/layout/AppShell.tsx`): Hover-to-peek collapsible sidebar (`#sidebar-wrapper` + `#app-sidebar.collapsed.hover-expanded`), top header Company/Branch/FY context switcher (`POST /api/v1/auth/switch-context`), and user profile menu.
   * `<PermissionGate>` (`frontend/src/components/common/PermissionGate.tsx`): Declarative RBAC wrapper gating `VIEW`, `ADD`, `EDIT`, `DELETE`, `PRINT`, `EXPORT`, `AUTHORIZE`, `CANCEL`, and `REOPEN` actions.
3. **Screens Implemented (`frontend/src/pages/`):**
   * `LoginPage` (`frontend/src/pages/auth/LoginPage.tsx`)
   * `DashboardPage` (`frontend/src/pages/dashboard/DashboardPage.tsx`)
   * `CustomerMasterPage` (`frontend/src/pages/parties/CustomerMasterPage.tsx`)

---

### 2.3 Step 1.1 — Company Master Screen (`/org/companies`)

1. **Database Objects (`dbscripts/`):**
   * Table: `tbl_org_company` (`comp_id` PK backed by `seq_comp_id`, unique `comp_code`).
   * Seeds: `02_initial_data.sql` (`PRINT` action item `1008` on `screen_id = 1002`), `03_sample_demo_data.sql` (`1003 KSVALVE`, `1004 KSCAST`).
2. **Backend API Contracts (`backend/src/modules/organization/company/`):**
   * `GET /api/v1/org/companies` (`@RequirePermission('COMPANY_MASTER', 'VIEW')`)
   * `GET /api/v1/org/companies/:id` (`@RequirePermission('COMPANY_MASTER', 'VIEW')`)
   * `POST /api/v1/org/companies` (`@RequirePermission('COMPANY_MASTER', 'ADD')`)
   * `PUT /api/v1/org/companies/:id` (`@RequirePermission('COMPANY_MASTER', 'EDIT')`)
   * `DELETE /api/v1/org/companies/:id` (`@RequirePermission('COMPANY_MASTER', 'DELETE')`) — invokes `DependencyCheckService.verifyCanDelete()` across `tbl_org_branch`, `tbl_org_financial_year`, `tbl_sec_user_company_role`, and `tbl_sec_user_branch_role`.
   * `POST /api/v1/org/companies/action/:actionType` — logs `PRINT` and `EXPORT` action clicks to `tbl_sys_audit_log`.
3. **Approved Generic Components & Frontend Architecture (`frontend/src/`):**
   * `<MasterDataTable>` (`frontend/src/components/common/MasterDataTable.tsx`): Generic master table supporting search, custom filters, sorting, group-by with high-contrast headers, pagination, CSV export, and print.
   * `<ConfirmDeleteModal>` (`frontend/src/components/common/ConfirmDeleteModal.tsx`): Pre-delete confirmation modal rendering structured HTTP `409 Conflict` dependency breakdowns.
   * `CompanyMasterPage` (`frontend/src/pages/org/CompanyMasterPage.tsx`): Full CRUD screen with automatic GSTIN $\rightarrow$ State Code & PAN derivation.

---

### 2.4 Step 1.2 — Branch & Plant Master Screen (`/org/branches`)

1. **Database Objects (`dbscripts/`):**
   * Table: `tbl_org_branch` (`branch_id` PK backed by `seq_branch_id`, composite unique constraint `uq_org_branch_code (comp_id, branch_code)`, FK `comp_id REFERENCES tbl_org_company(comp_id)`).
   * Seeds: `02_initial_data.sql` (`PRINT` action item `1009` on `screen_id = 1003`), `03_sample_demo_data.sql` (`1004 WH-SRT-03`, `1005 PLT-VTV-01`, `1006 SO-MUM-01`).
2. **Backend API Contracts (`backend/src/modules/organization/branch/`):**
   * `GET /api/v1/org/branches` (`@RequirePermission('BRANCH_MASTER', 'VIEW')`) — joins `tbl_org_branch` with `tbl_org_company` (`compCode`, `compName`).
   * `GET /api/v1/org/branches/:id` (`@RequirePermission('BRANCH_MASTER', 'VIEW')`)
   * `POST /api/v1/org/branches` (`@RequirePermission('BRANCH_MASTER', 'ADD')`)
   * `PUT /api/v1/org/branches/:id` (`@RequirePermission('BRANCH_MASTER', 'EDIT')`)
   * `DELETE /api/v1/org/branches/:id` (`@RequirePermission('BRANCH_MASTER', 'DELETE')`) — invokes `DependencyCheckService.verifyCanDelete()` across `tbl_org_branch_fyear`, `tbl_sec_user_branch_role`, and `tbl_sec_user_preference`.
   * `POST /api/v1/org/branches/action/:actionType` — logs `PRINT` and `EXPORT` action clicks to `tbl_sys_audit_log`.
3. **Frontend Architecture (`frontend/src/pages/org/BranchMasterPage.tsx`):**
   * Reuses `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="BRANCH_MASTER">`.
   * Supports multi-company filtering, facility type badges (`PLANT`, `HO`, `WAREHOUSE`, `SALES_OFFICE`), and GSTIN state auto-derivation.




---

### 2.5 Step 1.3 — Financial Year Master & Branch-FY Activation/Locking Screen (`/org/financial-years`)

1. **Database Objects (`dbscripts/`):**
   * Tables: `tbl_org_financial_year` (`fyear_id` PK backed by `seq_fyear_id`, unique `uq_org_fyear_code (comp_id, fyear_code)`) and `tbl_org_branch_fyear` (`branch_fyear_id` PK backed by `seq_branch_fyear_id`, unique `uq_branch_fyear (branch_id, fyear_id)`).
   * Seeds: `02_initial_data.sql` (`EXPORT` `1010` and `PRINT` `1011` action items on `screen_id = 1004`), `03_sample_demo_data.sql` (`1004 FY24-25` closed period under KSMFG, `1005 FY26-27` open period under KSVALVE, and branch-fyear mappings `1009`–`1013`).
2. **Backend API Contracts (`backend/src/modules/organization/financial-year/`):**
   * `GET /api/v1/org/financial-years` (`@RequirePermission('FYEAR_MASTER', 'VIEW')`) — returns financial years enriched with parent company metadata and nested `branchMappings` (`branchFyearId`, `branchId`, `branchCode`, `branchName`, `branchType`, `isLocked`, `lockedBy`, `lockedAt`, `isActive`).
   * `GET /api/v1/org/financial-years/:id` (`@RequirePermission('FYEAR_MASTER', 'VIEW')`)
   * `POST /api/v1/org/financial-years` (`@RequirePermission('FYEAR_MASTER', 'ADD')`) — validates date range (`end_date > start_date`), inserts `tbl_org_financial_year`, and auto-provisions `tbl_org_branch_fyear` rows for every branch of `comp_id`.
   * `PUT /api/v1/org/financial-years/:id` (`@RequirePermission('FYEAR_MASTER', 'EDIT')`) — updates period attributes; if `is_closed` toggles, cascades lock status across `tbl_org_branch_fyear` and records JSONB deltas in `tbl_sys_audit_log`.
   * `PUT /api/v1/org/financial-years/:id/branch-lock` (`@RequirePermission('FYEAR_MASTER', 'EDIT')`) — upserts branch-specific `is_locked`, `locked_by`, `locked_at`, and `is_active` in `tbl_org_branch_fyear` and logs a `STATUS_CHANGE` audit event.
   * `DELETE /api/v1/org/financial-years/:id` (`@RequirePermission('FYEAR_MASTER', 'DELETE')`) — invokes `DependencyCheckService.verifyCanDelete()` across `tbl_org_branch_fyear` and `tbl_sec_user_preference`.
   * `POST /api/v1/org/financial-years/action/:actionType` — logs `PRINT` and `EXPORT` action clicks to `tbl_sys_audit_log`.
3. **Frontend Architecture (`frontend/src/pages/org/FinancialYearMasterPage.tsx`):**
   * Reuses `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="FYEAR_MASTER">`.
   * Includes Quick FY Generator preset (`2024`–`2028`), one-click Company-Wide Lock/Unlock toggle, and an interactive **Branch-Wise Period Activation & Locking Modal** with individual branch lock switches and bulk Lock/Unlock actions.
