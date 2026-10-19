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
---

### 2.6 Step 2.1 — Department & Designation Master Screen (`/hr/departments`)

1. **Database Objects (`dbscripts/`):**
   * Tables: `tbl_hr_department` (`dept_id` PK backed by `seq_dept_id`, unique `uq_hr_dept_code (comp_id, dept_code)`, self-FK `parent_dept_id`) and `tbl_hr_designation` (`desig_id` PK backed by `seq_desig_id`, unique `uq_hr_desig_code (comp_id, desig_code)`, FK `dept_id REFERENCES tbl_hr_department(dept_id)`).
   * Triggers: `trg_hr_department_updated_date` and `trg_hr_designation_updated_date` appended to `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds: `02_initial_data.sql` (`EXPORT` `1012` and `PRINT` `1013` action items on `screen_id = 1005`), `03_sample_demo_data.sql` (sample departments `1001`–`1007` and designations `1001`–`1008`).
2. **Backend API Contracts (`backend/src/modules/hr/department/`):**
   * `GET /api/v1/hr/departments` & `GET /api/v1/hr/departments/:id` (`@RequirePermission('DEPT_MASTER', 'VIEW')`)
   * `POST /api/v1/hr/departments` (`@RequirePermission('DEPT_MASTER', 'ADD')`)
   * `PUT /api/v1/hr/departments/:id` (`@RequirePermission('DEPT_MASTER', 'EDIT')`)
   * `DELETE /api/v1/hr/departments/:id` (`@RequirePermission('DEPT_MASTER', 'DELETE')`) — invokes `DependencyCheckService.verifyCanDelete()` across `tbl_hr_department (parent_dept_id)`, `tbl_hr_designation (dept_id)`, and `tbl_hr_employee (dept_id)`.
   * `GET /api/v1/hr/designations` & `GET /api/v1/hr/designations/:id` (`@RequirePermission('DEPT_MASTER', 'VIEW')`)
   * `POST /api/v1/hr/designations` (`@RequirePermission('DEPT_MASTER', 'ADD')`)
   * `PUT /api/v1/hr/designations/:id` (`@RequirePermission('DEPT_MASTER', 'EDIT')`)
   * `DELETE /api/v1/hr/designations/:id` (`@RequirePermission('DEPT_MASTER', 'DELETE')`) — invokes `DependencyCheckService.verifyCanDelete()` across `tbl_hr_employee (desig_id)`.
3. **Frontend Architecture (`frontend/src/pages/hr/DepartmentDesignationPage.tsx`):**
   * Dual-tab interface (`Departments` and `Designations & Grades`) reusing `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="DEPT_MASTER">`.
   * Strictly fetches and mutates live PostgreSQL data via `/api/v1/hr/departments` and `/api/v1/hr/designations` with zero dummy data.
---

### 2.7 Step 2.2 — Employee Master Screen (`/hr/employees`)

1. **Database Objects (`dbscripts/`):**
   * Table: `tbl_hr_employee` (`employee_id` PK backed by `seq_employee_id`, unique `uq_hr_employee_code (comp_id, emp_code)`, FKs to `tbl_org_company`, `tbl_org_branch`, `tbl_hr_department`, `tbl_hr_designation`, and self-FK `reporting_manager_id REFERENCES tbl_hr_employee(employee_id)`).
   * Trigger: `trg_hr_employee_updated_date` appended to `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds: `02_initial_data.sql` (`EXPORT` `1014` and `PRINT` `1015` action items on `screen_id = 1006`), `03_sample_demo_data.sql` (sample employees `EMP-1001` through `EMP-1006` and HOD assignments on `tbl_hr_department`).
2. **Backend API Contracts (`backend/src/modules/hr/employee/`):**
   * `GET /api/v1/hr/employees` (`@RequirePermission('EMPLOYEE_MASTER', 'VIEW')`) — joins `tbl_hr_employee` with `tbl_org_company`, `tbl_org_branch`, `tbl_hr_department`, `tbl_hr_designation`, and self-joins `tbl_hr_employee` (`reportingManagerCode`, `reportingManagerName`, `directReportCount`).
   * `GET /api/v1/hr/employees/:id` (`@RequirePermission('EMPLOYEE_MASTER', 'VIEW')`)
   * `POST /api/v1/hr/employees` (`@RequirePermission('EMPLOYEE_MASTER', 'ADD')`)
   * `PUT /api/v1/hr/employees/:id` (`@RequirePermission('EMPLOYEE_MASTER', 'EDIT')`)
   * `DELETE /api/v1/hr/employees/:id` (`@RequirePermission('EMPLOYEE_MASTER', 'DELETE')`) — invokes `DependencyCheckService.verifyCanDelete()` across `tbl_hr_employee (reporting_manager_id)`, `tbl_hr_department (hod_employee_id)`, and `tbl_sec_user (linked_entity_id)`.
   * `POST /api/v1/hr/employees/action/:actionType` — logs `PRINT` and `EXPORT` action clicks to `tbl_sys_audit_log`.
3. **Frontend Architecture (`frontend/src/pages/hr/EmployeeMasterPage.tsx`):**
   * Reuses `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="EMPLOYEE_MASTER">`.
   * Features multi-dimensional filter bar (Company, Plant/Branch, Department, Employment Status), 4 workforce KPI cards, and a 3-tab modal (Organization & Role Assignment, Contact/Emergency/Address, Statutory PAN/PF/ESI & Payroll Bank) with zero dummy data.

---

### 2.8 Step 2.3 — Global Roles & Granular Screen/Action Permissions Matrix (`/security/roles`)

1. **Database Objects (`dbscripts/`):**
   * Tables: `tbl_sec_role` (`role_id` PK, unique `role_code`, `is_system_role`), `tbl_sec_screen` (`screen_id` PK, unique `screen_code`), `tbl_sec_action` (`action_id` PK, unique `(screen_id, action_code)`), `tbl_sec_role_permission` (`role_permission_id` PK, unique `(role_id, screen_id)`), and `tbl_sec_role_action_permission` (`role_action_permission_id` PK, unique `(role_id, action_id)`).
   * Seeds: `02_initial_data.sql` (`EXPORT` `1016` and `PRINT` `1017` action items on `screen_id = 1007`, plus baseline screen permissions for `PLANT_MANAGER`, `STORE_OFFICER`, `PURCHASE_EXEC`, and `SALES_EXEC`), `03_sample_demo_data.sql` (`1006 QA_MANAGER` and `1007 HR_EXECUTIVE` custom roles with baseline screen permissions).
2. **Backend API Contracts (`backend/src/modules/security/role/`):**
   * `GET /api/v1/security/roles` (`@RequirePermission('ROLE_MASTER', 'VIEW')`) — returns all global roles enriched with `grantedScreenCount`, `totalScreenCount`, `grantedActionCount`, and `assignedUserCount`.
   * `GET /api/v1/security/roles/:id` (`@RequirePermission('ROLE_MASTER', 'VIEW')`)
   * `POST /api/v1/security/roles` (`@RequirePermission('ROLE_MASTER', 'ADD')`) — creates a global role and optionally clones `tbl_sec_role_permission` and `tbl_sec_role_action_permission` rows from `cloneFromRoleId` inside a PostgreSQL transaction.
   * `PUT /api/v1/security/roles/:id` (`@RequirePermission('ROLE_MASTER', 'EDIT')`) — updates role metadata while protecting `is_system_role` codes and preventing `SUPER_ADMIN` deactivation.
   * `DELETE /api/v1/security/roles/:id` (`@RequirePermission('ROLE_MASTER', 'DELETE')`) — blocks deletion of `is_system_role = TRUE` roles and invokes `DependencyCheckService.verifyCanDelete()` across `tbl_sec_user_company_role (role_id)` and `tbl_sec_user_branch_role (role_id)`.
   * `GET /api/v1/security/roles/:id/matrix` (`@RequirePermission('ROLE_MASTER', 'VIEW')`) — returns the full `tbl_sec_screen` and `tbl_sec_action` catalogue left-joined with the role's current boolean flags.
   * `PUT /api/v1/security/roles/:id/matrix` (`@RequirePermission('ROLE_MASTER', 'EDIT')`) — atomically upserts `tbl_sec_role_permission` and `tbl_sec_role_action_permission` with self-lockout protection on `SUPER_ADMIN` (`ROLE_MASTER` and `USER_MASTER`) and logs before/after permission summaries to `tbl_sys_audit_log`.
3. **Frontend Architecture (`frontend/src/pages/security/RoleMasterPage.tsx`):**
   * Dual-tab interface (*1. Global Roles Directory* using `<MasterDataTable>` + `<ConfirmDeleteModal>`, and *2. Screen & Action Permissions Matrix* with module filter, search, bulk presets, and atomic matrix save) with zero dummy data.

---

### 2.9 Step 2.4 — User Master & Multi-Company / Multi-Branch Role Assignment Screen (`/security/users`)

1. **Database Objects (`dbscripts/`):**
   * Tables: `tbl_sec_user` (`user_id` PK, unique `username`, unique `email`, `password_hash`, `user_category`, `linked_entity_id`, `is_super_admin`, `failed_login_count`, `locked_until`), `tbl_sec_user_company_role` (`user_company_role_id` PK, unique `(user_id, mapped_comp_id, role_id)`), `tbl_sec_user_branch_role` (`user_branch_role_id` PK, unique `(user_id, mapped_branch_id, role_id)`), and `tbl_sec_user_preference` (`user_preference_id` PK).
   * Seeds: `02_initial_data.sql` (`EXPORT` `1018` and `PRINT` `1019` action items on `screen_id = 1008`), `03_sample_demo_data.sql` (sample employee-linked user accounts `1002 arjun.mehta`, `1003 kiran.desai`, `1004 priya.nair` and multi-company / multi-branch role mappings).
2. **Backend API Contracts (`backend/src/modules/security/user/`):**
   * `GET /api/v1/security/users` & `GET /api/v1/security/users/:id` (`@RequirePermission('USER_MASTER', 'VIEW')`) — returns users joined with `tbl_hr_employee`, `tbl_hr_department`, `tbl_hr_designation`, and nested `companyRoles` (`tbl_sec_user_company_role`) + `branchRoles` (`tbl_sec_user_branch_role`).
   * `POST /api/v1/security/users` (`@RequirePermission('USER_MASTER', 'ADD')`) — hashes password with 12-round `bcrypt`, inserts `tbl_sec_user`, and atomically syncs `companyRoles` and `branchRoles` inside a transaction.
   * `PUT /api/v1/security/users/:id` (`@RequirePermission('USER_MASTER', 'EDIT')`) — updates user profile and atomically syncs role mappings while protecting `user_id = 1001`.
   * `PUT /api/v1/security/users/:id/role-assignments` (`@RequirePermission('USER_MASTER', 'EDIT')`) — dedicated endpoint to replace a user's company and branch role mappings atomically.
   * `PUT /api/v1/security/users/:id/reset-password` & `PUT /api/v1/security/users/:id/unlock` (`@RequirePermission('USER_MASTER', 'EDIT')`) — administrative password reset and lockout clearance.
   * `DELETE /api/v1/security/users/:id` (`@RequirePermission('USER_MASTER', 'DELETE')`) — blocks deletion of `user_id = 1001` or active session user, and invokes `DependencyCheckService.verifyCanDelete()` across `tbl_sec_user_company_role`, `tbl_sec_user_branch_role`, and `tbl_sys_audit_log`.
3. **Frontend Architecture (`frontend/src/pages/security/UserMasterPage.tsx`):**
   * Reuses `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="USER_MASTER">`.
   * Features a 3-tab User & Role Assignment Modal (*1. User Identity & Employee Link*, *2. Company Role Mappings*, *3. Plant / Branch Role Mappings*) and an Administrative Password Reset Modal with zero dummy data.

---

### 2.10 Step 2.5 — Security & Field-Delta Audit Trail Viewer (`/security/audit-logs`)

1. **Database Objects (`dbscripts/`):**
   * Table: `tbl_sys_audit_log` (`audit_id` BIGSERIAL PK, `comp_id`, `branch_id`, `fyear_id`, `user_id`, `module_code`, `screen_code`, `action_type`, `table_name`, `record_pk`, `old_value` JSONB, `new_value` JSONB, `changed_fields` JSONB, `ip_address`, `user_agent`, `created_at` TIMESTAMPTZ) with composite index `idx_audit_log_lookup (comp_id, module_code, table_name, record_pk, created_at DESC)`.
   * Seeds: `02_initial_data.sql` (`PRINT` `1020` action item on `screen_id = 1009`, alongside existing `EXPORT` `1005`), `03_sample_demo_data.sql` (baseline audit trail records `1001`–`1004` demonstrating `LOGIN`, `CREATE`, and `UPDATE` events with JSONB `old_value`, `new_value`, and `changed_fields` snapshots).
2. **Backend API Contracts (`backend/src/modules/security/audit-log/`):**
   * `GET /api/v1/security/audit-logs` (`@RequirePermission('AUDIT_LOG_VIEWER', 'VIEW')`) — queries `tbl_sys_audit_log` left-joined with `tbl_sec_user`, `tbl_org_company`, `tbl_org_branch`, `tbl_org_financial_year`, and `tbl_sec_screen`, supporting multi-dimensional query filters (`compId`, `branchId`, `userId`, `moduleCode`, `screenCode`, `actionType`, `tableName`, `recordPk`, `fromDate`, `toDate`, `limit`) and returning both `items` and aggregated `summary` metrics.
   * `GET /api/v1/security/audit-logs/filter-facets` (`@RequirePermission('AUDIT_LOG_VIEWER', 'VIEW')`) — returns distinct filter facet catalogues (`modules`, `screens`, `actionTypes`, `tableNames`, `users`, `companies`, `branches`) populated strictly from PostgreSQL.
   * `GET /api/v1/security/audit-logs/:id` (`@RequirePermission('AUDIT_LOG_VIEWER', 'VIEW')`) — fetches a single audit log entry by `audit_id`.
   * `POST /api/v1/security/audit-logs/action/:actionType` (`@RequirePermission('AUDIT_LOG_VIEWER', 'VIEW')`) — records `PRINT` and `EXPORT` compliance audit trail entries when auditors export or print logs.
3. **Frontend Architecture (`frontend/src/pages/security/AuditLogViewerPage.tsx`):**
   * Reuses `<MasterDataTable>` and `<PermissionGate screen="AUDIT_LOG">`.
   * Provides an 8-filter Forensic Filter Bar, 4 KPI summary cards, and the **Forensic Audit Event & Field-Delta Inspector Modal** with two views (*Field-by-Field Delta Comparison* with `CHANGED`/`ADDED`/`REMOVED`/`UNCHANGED` badges and *Raw JSONB Snapshots*) with zero dummy data.

---

### 2.11 Step 2.6 — System Configuration Matrix & Document Numbering Series Engine (`/admin/configurations`)

1. **Database Objects (`dbscripts/`):**
   * Tables: `tbl_sys_config` (`config_id` PK, `config_key`, `config_name`, `config_group`, `data_type`, `config_value`, `default_value`, `allowed_values`, `scope_level`, `target_comp_id`, `target_branch_id`, `is_system_locked`, `is_active`) and `tbl_sys_doc_number_series` (`series_id` PK, `series_code`, `series_name`, `doc_type_code`, `doc_type_name`, `module_name`, `target_comp_id`, `target_branch_id`, `target_fyear_id`, `prefix_template`, `suffix_template`, `separator_char`, `padding_digits`, `starting_no`, `current_next_no`, `reset_frequency`, `allow_manual_override`, `is_default`, `is_active`, unique `(target_comp_id, target_branch_id, target_fyear_id, series_code)`).
   * Triggers: `trg_sys_config_updated_date` and `trg_sys_doc_series_updated_date` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds: `02_initial_data.sql` (`EXPORT` `1021` and `PRINT` `1022` action items on `screen_id = 1010`, 9 core global parameters `1001`–`1009` in `tbl_sys_config`, and 8 baseline voucher numbering series `1001`–`1008` in `tbl_sys_doc_number_series`), `03_sample_demo_data.sql` (Company/Plant overrides `1010`–`1012` in `tbl_sys_config` and multi-plant document series `1009`–`1012` in `tbl_sys_doc_number_series`).
2. **Backend API Contracts (`backend/src/modules/admin/system-config/`):**
   * `GET /api/v1/admin/configurations/configs` & `GET /api/v1/admin/configurations/configs/:id` (`@RequirePermission('CONFIG_MASTER', 'VIEW')`)
   * `POST /api/v1/admin/configurations/configs` (`@RequirePermission('CONFIG_MASTER', 'ADD')`) — validates `BOOLEAN`/`NUMBER`/`ENUM`/`JSON` values and `(config_key, scope_level, target_comp_id, target_branch_id)` uniqueness.
   * `PUT /api/v1/admin/configurations/configs/:id` & `PUT /api/v1/admin/configurations/configs/:id/reset-default` (`@RequirePermission('CONFIG_MASTER', 'EDIT')`)
   * `DELETE /api/v1/admin/configurations/configs/:id` (`@RequirePermission('CONFIG_MASTER', 'DELETE')`) — blocks deletion of `is_system_locked = TRUE` parameters.
   * `GET /api/v1/admin/configurations/doc-series`, `GET /api/v1/admin/configurations/doc-series/:id`, & `GET /api/v1/admin/configurations/doc-series/:id/preview` (`@RequirePermission('CONFIG_MASTER', 'VIEW')`)
   * `POST /api/v1/admin/configurations/doc-series` & `PUT /api/v1/admin/configurations/doc-series/:id` (`@RequirePermission('CONFIG_MASTER', 'ADD' | 'EDIT')`) — atomically manages `is_default` per `(target_comp_id, target_branch_id, target_fyear_id, doc_type_code)` and prevents rolling back `current_next_no` below already issued document counters.
   * `DELETE /api/v1/admin/configurations/doc-series/:id` (`@RequirePermission('CONFIG_MASTER', 'DELETE')`) — blocks deletion (`409 Conflict`) if `current_next_no > starting_no`.
3. **Frontend Architecture (`frontend/src/pages/admin/SystemConfigPage.tsx`):**
   * Dual-tab interface (*1. System Configuration Matrix* and *2. Document Numbering Series Engine*) reusing `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="CONFIG_MASTER">`, complete with live voucher number preview and sequence simulator modal with zero dummy data.

---

### 2.12 Step 3.1 — Multi-Level Warehouse, Zone, Rack, Shelf & Bin Hierarchy Master (`/inventory/warehouses`)

1. **Database Objects (`dbscripts/`):**
   * Tables: `tbl_inv_warehouse` (`warehouse_id` PK, `warehouse_code`, `warehouse_name`, `warehouse_type`, `target_comp_id` FK $\rightarrow$ `tbl_org_company`, `target_branch_id` FK $\rightarrow$ `tbl_org_branch`, `incharge_employee_id` FK $\rightarrow$ `tbl_hr_employee`, `allow_negative_stock`, `is_qc_hold_store`, `is_shopfloor_wip`, `storage_temp_min_c`, `storage_temp_max_c`, `address_location`, `is_default`, `is_active`, unique `(target_comp_id, target_branch_id, warehouse_code)`) and `tbl_inv_storage_bin` (`bin_id` PK, `warehouse_id` FK $\rightarrow$ `tbl_inv_warehouse`, `bin_code`, `bin_name`, `zone_code`, `rack_code`, `shelf_level`, `bin_position`, `bin_type`, `max_weight_kg`, `max_volume_cbm`, `allow_mixed_items`, `allow_mixed_batches`, `is_pick_face`, `is_receiving_staging`, `is_blocked_for_putaway`, `is_active`, unique `(warehouse_id, bin_code)`).
   * Triggers: `trg_inv_warehouse_updated_date` and `trg_inv_storage_bin_updated_date` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds: `02_initial_data.sql` (`EXPORT` `1023` and `PRINT` `1024` action items on `screen_id = 1011`), `03_sample_demo_data.sql` (7 multi-plant warehouses `1001`–`1007` across Changodar, Sanand, and Pune plants, plus 8 5-level storage bins `1001`–`1008`).
2. **Backend API Contracts (`backend/src/modules/inventory/warehouse/`):**
   * `GET /api/v1/inventory/warehouses` & `GET /api/v1/inventory/warehouses/:id` (`@RequirePermission('WAREHOUSE_MASTER', 'VIEW')`) — returns plant warehouses joined with company, branch, custodian employee, and aggregated bin topology statistics (`totalBinsCount`, `activeBinsCount`, `distinctZonesCount`, `totalMaxWeightKg`).
   * `POST /api/v1/inventory/warehouses` & `PUT /api/v1/inventory/warehouses/:id` (`@RequirePermission('WAREHOUSE_MASTER', 'ADD' | 'EDIT')`) — validates plant-level code uniqueness and atomically toggles `is_default` per `(target_comp_id, target_branch_id, warehouse_type)`.
   * `DELETE /api/v1/inventory/warehouses/:id` (`@RequirePermission('WAREHOUSE_MASTER', 'DELETE')`) — invokes `DependencyCheckService.verifyCanDelete()` against `tbl_inv_storage_bin (warehouse_id)` before deletion.
   * `GET /api/v1/inventory/warehouses/bins` & `GET /api/v1/inventory/warehouses/bins/:binId` (`@RequirePermission('WAREHOUSE_MASTER', 'VIEW')`) — returns 5-level storage bin coordinates enriched with computed `hierarchyPath`.
   * `POST /api/v1/inventory/warehouses/bins`, `PUT /api/v1/inventory/warehouses/bins/:binId`, & `DELETE /api/v1/inventory/warehouses/bins/:binId` (`@RequirePermission('WAREHOUSE_MASTER', 'ADD' | 'EDIT' | 'DELETE')`).
   * `POST /api/v1/inventory/warehouses/bins/bulk-generate` (`@RequirePermission('WAREHOUSE_MASTER', 'ADD')`) — atomically generates a 3D rack/shelf/bin coordinate matrix inside a PostgreSQL transaction using `ON CONFLICT (warehouse_id, bin_code) DO NOTHING`.
3. **Frontend Architecture (`frontend/src/pages/inventory/WarehouseMasterPage.tsx`):**
   * Dual-tab interface (*1. Plant Warehouses & Stores* and *2. Multi-Level Storage Bin Hierarchy*) reusing `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="WAREHOUSE_MASTER">`, with a live 5-level hierarchy path preview and an interactive Bulk Rack/Shelf/Bin Matrix Generator Modal with zero dummy data.


---

### 2.13 Step 3.2 — UOM, UOM Conversion Matrix & Item Category Hierarchy Master (`/inventory/uoms`)

1. **Database Objects (`dbscripts/`):**
   * Tables:
     * `tbl_inv_uom` (`uom_id` PK, `uom_code` UNIQUE, `uom_name`, `uom_type`, `decimal_precision`, `gst_uqc_code`, `is_base_uom`, `is_active`).
     * `tbl_inv_uom_conversion` (`conversion_id` PK, `from_uom_id` FK $\rightarrow$ `tbl_inv_uom`, `to_uom_id` FK $\rightarrow$ `tbl_inv_uom`, `conversion_factor` NUMERIC(18,6), `inverse_factor` NUMERIC(18,6), `conversion_type`, `remarks`, `is_active`, unique `(from_uom_id, to_uom_id)`).
     * `tbl_inv_item_category` (`category_id` PK, `category_code` UNIQUE, `category_name`, `parent_category_id` FK $\rightarrow$ `tbl_inv_item_category`, `category_type`, `hsn_sac_code`, `default_tax_rate`, `default_valuation_method`, `level_depth`, `hierarchy_path`, `is_leaf`, `is_active`).
   * Triggers: `trg_inv_uom_updated_date`, `trg_inv_uom_conversion_updated_date`, and `trg_inv_item_category_updated_date` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds: `02_initial_data.sql` (`EXPORT` `1025` and `PRINT` `1026` action items on `screen_id = 1012`, 10 standard industrial UOMs, and 6 baseline mathematical/packaging conversions), `03_sample_demo_data.sql` (18 multi-level item categories spanning Raw Materials, WIP, Finished Goods, MRO, and Tooling).
2. **Backend API Contracts (`backend/src/modules/inventory/uom/`):**
   * `GET /api/v1/inventory/uoms` & `GET /api/v1/inventory/uoms/:id` (`@RequirePermission('UOM_MASTER', 'VIEW')`) — returns all units of measurement enriched with linked `conversionsCount`.
   * `POST /api/v1/inventory/uoms` & `PUT /api/v1/inventory/uoms/:id` (`@RequirePermission('UOM_MASTER', 'ADD' | 'EDIT')`) — enforces uppercase sanitized codes and atomic `is_base_uom` uniqueness per `uom_type`.
   * `DELETE /api/v1/inventory/uoms/:id` (`@RequirePermission('UOM_MASTER', 'DELETE')`) — checks foreign key dependencies in `tbl_inv_uom_conversion` (both `from_uom_id` and `to_uom_id`).
   * `GET /api/v1/inventory/uoms/conversions` & `GET /api/v1/inventory/uoms/conversions/:conversionId` (`@RequirePermission('UOM_MASTER', 'VIEW')`) — returns conversion ratios enriched with source/target codes and computed human-readable equation strings.
   * `POST /api/v1/inventory/uoms/conversions` & `PUT /api/v1/inventory/uoms/conversions/:conversionId` (`@RequirePermission('UOM_MASTER', 'ADD' | 'EDIT')`) — supports optional bidirectional reciprocal creation.
   * `DELETE /api/v1/inventory/uoms/conversions/:conversionId` (`@RequirePermission('UOM_MASTER', 'DELETE')`).
   * `GET /api/v1/inventory/uoms/categories` & `GET /api/v1/inventory/uoms/categories/:categoryId` (`@RequirePermission('UOM_MASTER', 'VIEW')`) — returns recursive category trees with `parentCategoryCode`, `levelDepth`, `hierarchyPath`, and `childCategoriesCount`.
   * `POST /api/v1/inventory/uoms/categories` & `PUT /api/v1/inventory/uoms/categories/:categoryId` (`@RequirePermission('UOM_MASTER', 'ADD' | 'EDIT')`) — calculates `level_depth` and materialized `hierarchy_path` while atomically updating parent `is_leaf = FALSE`.
   * `DELETE /api/v1/inventory/uoms/categories/:categoryId` (`@RequirePermission('UOM_MASTER', 'DELETE')`) — verifies no child subcategories depend on the node.
   * `POST /api/v1/inventory/uoms/action/:actionType` (`@RequirePermission('UOM_MASTER', 'VIEW')`).
3. **Frontend Architecture (`frontend/src/pages/inventory/UomMasterPage.tsx`):**
   * 3-tab interface (*1. Units of Measurement*, *2. Conversion Matrix*, *3. Item Category Hierarchy Tree*) reusing `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="UOM_MASTER">`, with live formula preview, reciprocal creation, and category path preview with zero dummy data.


---

### 2.14 Step 3.3 — Item & Material Master, Multi-UOM, Pricing, Quality & BOM Parameters (`/inventory/items`)

1. **Database Objects (`dbscripts/`):**
   * Tables:
     * `tbl_inv_item` (`item_id` PK, `item_code` VARCHAR(50), `item_name` VARCHAR(150), `category_id` FK $\rightarrow$ `tbl_inv_item_category`, `item_type` (`RAW_MATERIAL`, `WIP_SEMI_FINISHED`, `FINISHED_GOODS`, `PACKING_MATERIAL`, `CONSUMABLE_MRO`, `TOOLING_DIE`, `SCRAP`), `description`, `base_uom_id` FK $\rightarrow$ `tbl_inv_uom`, `purchase_uom_id` FK $\rightarrow$ `tbl_inv_uom`, `sales_uom_id` FK $\rightarrow$ `tbl_inv_uom`, `hsn_sac_code`, `tax_rate`, `standard_cost`, `purchase_rate`, `sales_rate`, `min_stock_level`, `max_stock_level`, `reorder_point`, `safety_stock`, `lead_time_days`, `valuation_method` (`FIFO`, `WEIGHTED_AVG`, `STANDARD_COST`), `is_batch_managed`, `is_serial_managed`, `is_qc_inspection_required`, `shelf_life_days`, `default_warehouse_id` FK $\rightarrow$ `tbl_inv_warehouse`, `default_bin_id` FK $\rightarrow$ `tbl_inv_storage_bin`, `drawing_no`, `revision_no`, `weight_per_unit_kg`, `is_bom_allowed`, `yield_percentage`, `inspection_lead_time_days`, `is_active`, 7 audit columns, unique `(comp_id, item_code)`).
   * Sequences: `seq_item_id` (starts at 1001).
   * Indexes: `idx_inv_item_comp_cat` on `(comp_id, category_id, is_active)`, `idx_inv_item_type` on `(comp_id, item_type, is_active)`, and `idx_inv_item_name` on `(comp_id, item_name)`.
   * Triggers: `trg_inv_item_updated_date` on `tbl_inv_item` executing `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Action items `1005` (`EXPORT`) and `1027` (`PRINT`) on `screen_id = 1013` granted across global roles.
     * `03_sample_demo_data.sql`: 11 engineering items across Raw Materials (SS-316 round bars, CR steel coils, aluminum alloy ingots, PP copolymer granules), WIP Sub-Assemblies (machined valve bodies, dynamically balanced bronze impellers, stamped door shells), Finished Goods (API 600 flanged gate valves, OEM automotive powertrain hydromounts), and MRO consumables (fully synthetic CNC cutting fluid, tungsten carbide turning inserts).
2. **Backend API Contracts (`backend/src/modules/inventory/item/`):**
   * `GET /api/v1/inventory/items/summary` (`@RequirePermission('ITEM_MASTER', 'VIEW')`) — computes real-time catalog analytics (`totalItems`, `activeFinishedGoods`, `rawMaterialsCount`, `wipItemsCount`, `batchQcCount`).
   * `GET /api/v1/inventory/items` & `GET /api/v1/inventory/items/:itemId` (`@RequirePermission('ITEM_MASTER', 'VIEW')`) — returns items joined with category name/hierarchy, base/purchase/sales UOMs, default warehouse, and default bin.
   * `POST /api/v1/inventory/items` & `PUT /api/v1/inventory/items/:itemId` (`@RequirePermission('ITEM_MASTER', 'ADD' | 'EDIT')`) — enforces uppercase sanitized codes, multi-UOM assignments, category property inheritance, and delta audit logging.
   * `DELETE /api/v1/inventory/items/:itemId` (`@RequirePermission('ITEM_MASTER', 'DELETE')`) — checks foreign key dependencies via `DependencyCheckService.verifyCanDelete()` across BOM headers, BOM components, stock balances, purchase requisitions, PO items, GRN items, and work orders.
   * `POST /api/v1/inventory/items/actions/log` (`@RequirePermission('ITEM_MASTER', 'VIEW')`) — logs datasheet print and CSV export actions in `tbl_sec_audit_log`.
3. **Frontend Architecture (`frontend/src/pages/inventory/ItemMasterPage.tsx`):**
   * High-density industrial catalog screen reusing `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="ITEM_MASTER">`.
   * Real-time 4-card KPI metric display, dynamic classification pill filters, category tree dropdown, and valuation group-by options.
   * Comprehensive 4-tab Item SKU Modal (*1. Identity & Classification*, *2. Multi-UOM & Warehouse Planning*, *3. Costing & Taxation*, *4. Quality & BOM Governance*) with zero dummy data and strict live PostgreSQL integration.


---

### 2.15 Step 4.1 — Unified Customer, Supplier, Transporter & Job-Worker Master (`/parties/customers` & `/parties/master`)

1. **Database Objects (`dbscripts/`):**
   * Tables:
     * `tbl_crm_party` (`party_id` PK, `comp_id` FK $\rightarrow$ `tbl_core_company`, `party_code` VARCHAR(50), `party_name` VARCHAR(150), `legal_name` VARCHAR(200), `party_type` VARCHAR(50), `is_customer` BOOLEAN, `is_supplier` BOOLEAN, `is_transporter` BOOLEAN, `is_job_worker` BOOLEAN, `pan_no` VARCHAR(10), `gstin_primary` VARCHAR(15), `tan_no` VARCHAR(10), `msme_reg_no` VARCHAR(50), `msme_category` VARCHAR(50), `currency_code` VARCHAR(10), `credit_limit` NUMERIC(15,2), `credit_days` INT, `interest_rate_pct` NUMERIC(5,2), `price_list_id` INT, `bank_name` VARCHAR(100), `bank_branch` VARCHAR(100), `bank_acc_no` VARCHAR(50), `bank_ifsc` VARCHAR(20), `email` VARCHAR(100), `phone` VARCHAR(30), `website` VARCHAR(150), `is_active` BOOLEAN, 7 audit columns, unique `(comp_id, party_code)`).
     * `tbl_crm_party_address` (`address_id` PK, `party_id` FK $\rightarrow$ `tbl_crm_party` ON DELETE CASCADE, `comp_id` FK $\rightarrow$ `tbl_core_company`, `address_title` VARCHAR(100), `address_line1` VARCHAR(200), `address_line2` VARCHAR(200), `city` VARCHAR(100), `state` VARCHAR(100), `state_code` VARCHAR(10), `country` VARCHAR(100), `pin_code` VARCHAR(20), `gstin` VARCHAR(15), `is_default_billing` BOOLEAN, `is_default_shipping` BOOLEAN, `contact_person` VARCHAR(100), `contact_phone` VARCHAR(30), `contact_email` VARCHAR(100), `is_active` BOOLEAN, 7 audit columns).
   * Sequences: `seq_party_id` (starts at 1001), `seq_party_address_id` (starts at 1001).
   * Indexes: `idx_crm_party_code` on `(comp_id, party_code)`, `idx_crm_party_pan` on `(pan_no)`, `idx_crm_party_roles` on `(is_customer, is_supplier, is_job_worker, is_transporter)`, `idx_crm_party_address_party` on `(party_id, is_active)`, and `idx_crm_party_address_gstin` on `(gstin)`.
   * Triggers: `trg_crm_party_updated_date` on `tbl_crm_party` and `trg_crm_party_address_updated_date` on `tbl_crm_party_address` executing `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Action items `1006` (`EXPORT`) and `1007` (`PRINT`) on `screen_id = 1014` (`PARTY_MASTER`) mapped across system roles.
     * `03_sample_demo_data.sql`: 6 enterprise counter-parties (Maruti Suzuki India Ltd, L&T Valves Ltd, JSW Steel Coated Products Ltd, Sandvik Coromant India, Micro Precision Job-Works, VRL Logistics Ltd) with 8 addresses across Haryana, Gujarat, Tamil Nadu, Maharashtra, and Karnataka.
2. **Backend API Contracts (`backend/src/modules/parties/party/`):**
   * `GET /api/v1/parties/summary` (`@RequirePermission('PARTY_MASTER', 'VIEW')`) — computes live analytics (`totalParties`, `customerCount`, `supplierCount`, `jobWorkerCount`, `transporterCount`).
   * `GET /api/v1/parties` & `GET /api/v1/parties/:partyId` (`@RequirePermission('PARTY_MASTER', 'VIEW')`) — retrieves counter-parties with optional role filtering (`role=customer|supplier|job_worker|transporter`) and multi-location addresses.
   * `POST /api/v1/parties` & `PUT /api/v1/parties/:partyId` (`@RequirePermission('PARTY_MASTER', 'ADD' | 'EDIT')`) — creates or updates counter-party records and synchronizes 1-to-N location addresses atomically in Drizzle transaction.
   * `DELETE /api/v1/parties/:partyId` (`@RequirePermission('PARTY_MASTER', 'DELETE')`) — checks foreign key dependencies across Sales Orders, Purchase Orders, Subcontracting Delivery Challans, and Invoices.
   * `POST /api/v1/parties/actions/log` (`@RequirePermission('PARTY_MASTER', 'VIEW')`) — records datasheet print and CSV export activities in `tbl_sec_audit_log`.
3. **Frontend Architecture (`frontend/src/pages/parties/CustomerMasterPage.tsx`):**
   * Unified Party Master UI reachable via `/parties/customers` and `/parties/master`.
   * Reuses `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="PARTY_MASTER">`.
   * Real-time 4-card KPI metric display, dynamic role pill toggles, multi-column search, 4-tab party editing modal with dynamic location grid, and print datasheet modal. Fully wired to live PostgreSQL with zero mock data.


---

### 2.16 Step 4.2 — Tiered Price Lists, Volume Discounts & Vendor Rate Contracts (`/parties/price-lists`)

1. **Database Objects (`dbscripts/`):**
   * Tables:
     * `tbl_crm_price_list` (`price_list_id` PK, `comp_id` FK $\rightarrow$ `tbl_org_company`, `price_list_code` VARCHAR(50), `price_list_name` VARCHAR(150), `price_list_type` VARCHAR(30) (`SALES`, `PURCHASE`, `JOB_WORK`), `currency_code` VARCHAR(10), `effective_from` DATE, `effective_to` DATE, `is_default` BOOLEAN, `description` VARCHAR(350), `is_active` BOOLEAN, 7 audit columns, unique `(comp_id, price_list_code)`).
     * `tbl_crm_price_list_item` (`price_list_item_id` PK, `price_list_id` FK $\rightarrow$ `tbl_crm_price_list` ON DELETE CASCADE, `item_id` FK $\rightarrow$ `tbl_inv_item`, `uom_id` FK $\rightarrow$ `tbl_inv_uom`, `min_qty` NUMERIC(14,3), `max_qty` NUMERIC(14,3), `base_rate` NUMERIC(14,4), `discount_pct` NUMERIC(5,2), `effective_rate` NUMERIC(14,4), `lead_time_days` INT, `remarks` VARCHAR(250), `is_active` BOOLEAN, 7 audit columns, unique `(price_list_id, item_id, min_qty)`).
     * `tbl_crm_party_price_list` (`party_price_list_id` PK, `party_id` FK $\rightarrow$ `tbl_crm_party` ON DELETE CASCADE, `price_list_id` FK $\rightarrow$ `tbl_crm_price_list` ON DELETE CASCADE, `is_primary` BOOLEAN, `is_active` BOOLEAN, 7 audit columns, unique `(party_id, price_list_id)`).
   * Sequences: `seq_price_list_id` (starts at 1001), `seq_price_list_item_id` (starts at 1001), `seq_party_price_list_id` (starts at 1001).
   * Indexes: `idx_crm_price_list_type` on `(comp_id, price_list_type, is_active)`, `idx_crm_price_list_effective` on `(effective_from, effective_to)`, `idx_crm_price_list_item_lookup` on `(price_list_id, item_id, is_active)`, `idx_crm_party_price_list_party` on `(party_id, is_active)`.
   * Triggers: `trg_crm_price_list_updated_date`, `trg_crm_price_list_item_updated_date`, and `trg_crm_party_price_list_updated_date` on respective tables executing `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Action items `1028` (`EXPORT`) and `1029` (`PRINT`) on `screen_id = 1015` (`PRICE_LIST`) granted across all core roles.
     * `03_sample_demo_data.sql`: 5 master price lists spanning Automotive OEM sales rate cards (`PL-OEM-MARUTI-2026`), pan-India industrial valve wholesale lists (`PL-VALVES-STD-2026`), CR steel procurement contracts (`VRC-JSW-STEEL-2026`), CNC tooling contracts (`VRC-SANDVIK-TOOL-2026`), and precision induction hardening job-work cards (`JWC-PREC-HEAT-2026`), with 11 tiered line items and 5 party mapping links.
2. **Backend API Contracts (`backend/src/modules/parties/price-list/`):**
   * `GET /api/v1/price-lists/summary` (`@RequirePermission('PRICE_LIST', 'VIEW')`) — returns real-time catalog metrics (`totalPriceLists`, `salesCount`, `purchaseCount`, `jobWorkCount`, `activeItemsCount`).
   * `GET /api/v1/price-lists` & `GET /api/v1/price-lists/:priceListId` (`@RequirePermission('PRICE_LIST', 'VIEW')`) — retrieves price lists with line items count, assigned parties count, and detailed line items array with computed effective rates and linked party records.
   * `GET /api/v1/price-lists/lookup` (`@RequirePermission('PRICE_LIST', 'VIEW')`) — dynamic price resolution engine matching the exact quantity tier bracket (`min_qty <= qty <= max_qty`) for a given item and price list or counter-party.
   * `POST /api/v1/price-lists` & `PUT /api/v1/price-lists/:priceListId` (`@RequirePermission('PRICE_LIST', 'ADD' | 'EDIT')`) — manages transactional persistence for header, tiered quantity brackets, default exclusivity per type, and assigned counter-parties.
   * `DELETE /api/v1/price-lists/:priceListId` (`@RequirePermission('PRICE_LIST', 'DELETE')`) — checks foreign key dependencies across downstream sales orders (`tbl_so_header`) and purchase orders (`tbl_po_header`) via `DependencyCheckService`.
   * `POST /api/v1/price-lists/actions/log` (`@RequirePermission('PRICE_LIST', 'VIEW')`) — records datasheet print and CSV export activities in `tbl_sec_audit_log`.
3. **Frontend Architecture (`frontend/src/pages/parties/PriceListMasterPage.tsx`):**
   * Mounted at route `/parties/price-lists` with sidebar navigation badge `'Live'`.
   * Built with `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="PRICE_LIST">`.
   * Real-time 4-card KPI metric display, dynamic contract type filter pills, default and active toggles, multi-column search, 3-tab price list modal (*1. Header & Validity*, *2. Tiered Rate Brackets*, *3. Assigned Counter-Parties*), and printable rate card datasheet modal with zero dummy data.

---

### 2.17 Step 5.1 — Material Purchase Requisition (MR) & Multi-Level Authorization (`/procurement/requisitions`)

1. **Database Objects (`dbscripts/`):**
   * Tables:
     * `tbl_pr_header` (`pr_id` PK, `comp_id` FK $\rightarrow$ `tbl_org_company`, `branch_id` FK $\rightarrow$ `tbl_org_branch`, `fyear_id` FK $\rightarrow$ `tbl_org_financial_year`, `pr_no` VARCHAR(50), `pr_date` DATE, `required_by_date` DATE, `department_id` FK $\rightarrow$ `tbl_hr_department`, `requester_user_id` FK $\rightarrow$ `tbl_sec_user`, `warehouse_id` FK $\rightarrow$ `tbl_inv_warehouse`, `priority` VARCHAR(20) (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL_URGENT`), `pr_type` VARCHAR(30) (`RAW_MATERIAL`, `CAPITAL_ASSET`, `CONSUMABLE_MRO`, `TOOLING_SPARE`, `JOB_WORK_SERVICE`), `status` VARCHAR(20) (`DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `CONVERTED`, `CANCELLED`), `total_estimated_amount` NUMERIC(14,2), `purpose` VARCHAR(350), `approval_remarks` VARCHAR(350), `approved_by` FK $\rightarrow$ `tbl_sec_user`, `approved_date` TIMESTAMP, `rejected_by` FK $\rightarrow$ `tbl_sec_user`, `rejected_date` TIMESTAMP, `is_active` BOOLEAN, 7 audit columns, unique `(comp_id, pr_no)`).
     * `tbl_pr_item` (`pr_item_id` PK, `pr_id` FK $\rightarrow$ `tbl_pr_header` ON DELETE CASCADE, `item_id` FK $\rightarrow$ `tbl_inv_item`, `uom_id` FK $\rightarrow$ `tbl_inv_uom`, `required_qty` NUMERIC(14,3), `approved_qty` NUMERIC(14,3), `ordered_qty` NUMERIC(14,3), `estimated_rate` NUMERIC(14,2), `estimated_amount` NUMERIC(14,2), `suggested_vendor_id` FK $\rightarrow$ `tbl_crm_party`, `remarks` VARCHAR(250), `is_active` BOOLEAN, 7 audit columns).
   * Sequences: `seq_pr_id` (starts at 1001), `seq_pr_item_id` (starts at 1001).
   * Indexes: `idx_pr_header_status` on `(comp_id, status, is_active)`, `idx_pr_header_dates` on `(pr_date, required_by_date)`, `idx_pr_header_dept` on `(department_id)`, `idx_pr_header_wh` on `(warehouse_id)`, `idx_pr_item_lookup` on `(pr_id, item_id, is_active)`.
   * Triggers: `trg_pr_header_updated_date` and `trg_pr_item_updated_date` executing `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered screen `1016` (`PURCHASE_REQ`) with action codes `1030` (`EXPORT`), `1031` (`PRINT`), `1032` (`SUBMIT`), and `1033` (`AUTHORIZE`). Granted role actions to `SUPER_ADMIN`, `PLANT_MANAGER`, `STORE_OFFICER`, `PURCHASE_EXEC`, and `SALES_EXEC`.
     * `03_sample_demo_data.sql`: 5 realistic manufacturing requisitions (`PR-AHM-2627-0001` through `PR-PNQ-2627-0005`) with 5 line items spanning CR sheet coils, carbide milling inserts, hydraulic oil, pneumatic fittings, and forging dies across Draft, Submitted, Approved, and Converted states.
2. **Backend API Contracts (`backend/src/modules/procurement/requisition/`):**
   * `GET /api/v1/procurement/requisitions/summary` (`@RequirePermission('PURCHASE_REQ', 'VIEW')`) — computes real-time operational KPI metrics (`totalRequisitions`, `pendingCount`, `approvedCount`, `criticalCount`, `draftCount`).
   * `GET /api/v1/procurement/requisitions` (`@RequirePermission('PURCHASE_REQ', 'VIEW')`) — filters indents by status, priority, requisition type, department, warehouse, and free-text search with requester and approver names.
   * `GET /api/v1/procurement/requisitions/:prId` (`@RequirePermission('PURCHASE_REQ', 'VIEW')`) — returns header and full line item details including SKU, UOM, required vs approved vs ordered quantities, estimated rate/amount, and suggested vendor details.
   * `POST /api/v1/procurement/requisitions` & `PUT /api/v1/procurement/requisitions/:prId` (`@RequirePermission('PURCHASE_REQ', 'ADD' | 'EDIT')`) — creates or updates requisitions with transactional line item replacement and automatic PR numbering (`PR-AHM-YYNextYY-XXXX`).
   * `POST /api/v1/procurement/requisitions/:prId/submit` (`@RequirePermission('PURCHASE_REQ', 'SUBMIT')`) — transitions requisition from `DRAFT` to `SUBMITTED`, logging state delta in audit trail.
   * `POST /api/v1/procurement/requisitions/:prId/authorize` (`@RequirePermission('PURCHASE_REQ', 'AUTHORIZE')`) — implements multi-level sign-off:
     * `APPROVE`: Updates per-line `approved_qty`, recalculates header `total_estimated_amount`, records approver user ID, and marks status as `APPROVED`.
     * `REJECT`: Validates mandatory rejection justification remarks, records rejecter user ID, and marks status as `REJECTED`.
   * `DELETE /api/v1/procurement/requisitions/:prId` (`@RequirePermission('PURCHASE_REQ', 'DELETE')`) — deletes `DRAFT` or `CANCELLED` requisitions after verifying foreign key relations against `tbl_rfq_item` and `tbl_po_item` via `DependencyCheckService`.
   * `POST /api/v1/procurement/requisitions/actions/log` (`@RequirePermission('PURCHASE_REQ', 'VIEW')`) — logs `PRINT` and `EXPORT` activities into `tbl_sec_audit_log`.
3. **Frontend Architecture (`frontend/src/pages/procurement/RequisitionMasterPage.tsx`):**
   * Accessible at route `/procurement/requisitions` under the `PROCUREMENT & SOURCING` navigation group with `'Live'` badge.
   * Features 4 KPI metric cards, interactive status pills (`All`, `Draft`, `Submitted`, `Approved`, `Rejected`), priority dropdown, department & warehouse filters, and `<MasterDataTable>` with custom grouping.
   * Requisition Builder modal with dynamic line items grid, live rate/amount calculation, and validation guards.
   * Multi-Level Authorization modal enabling item-by-item quantity adjustment for approval or mandatory rejection remarks.
   * Printable internal requisition voucher modal complete with company header, item breakdown, and triple signature blocks.
   * Full RBAC protection via `<PermissionGate screen="PURCHASE_REQ">` across ADD, EDIT, DELETE, SUBMIT, AUTHORIZE, and PRINT actions.

---

### 2.18 Step 5.2 — Supplier Request for Quotation (RFQ) & Comparative Statement (`/procurement/rfqs`)

1. **Database Objects (`dbscripts/`):**
   * Tables:
     * `tbl_rfq_header` (`rfq_id` PK, `comp_id` FK $\rightarrow$ `tbl_org_company`, `branch_id` FK $\rightarrow$ `tbl_org_branch`, `fyear_id` FK $\rightarrow$ `tbl_org_financial_year`, `rfq_no` VARCHAR(50), `rfq_date` DATE, `due_date` DATE, `warehouse_id` FK $\rightarrow$ `tbl_inv_warehouse`, `status` VARCHAR(25) (`DRAFT`, `SENT`, `QUOTES_RECEIVED`, `COMPARISON_DONE`, `AWARDED`, `CANCELLED`), `payment_terms` VARCHAR(150), `delivery_terms` VARCHAR(150), `remarks` VARCHAR(350), `awarded_vendor_id` FK $\rightarrow$ `tbl_crm_party`, `awarded_date` TIMESTAMP, `awarded_remarks` VARCHAR(350), `is_active` BOOLEAN, 7 audit columns, unique `(comp_id, rfq_no)`).
     * `tbl_rfq_item` (`rfq_item_id` PK, `rfq_id` FK $\rightarrow$ `tbl_rfq_header` ON DELETE CASCADE, `pr_item_id` FK $\rightarrow$ `tbl_pr_item`, `item_id` FK $\rightarrow$ `tbl_inv_item`, `uom_id` FK $\rightarrow$ `tbl_inv_uom`, `required_qty` NUMERIC(14,3), `target_rate` NUMERIC(14,4), `technical_specs` VARCHAR(350), `is_active` BOOLEAN, 7 audit columns, unique `(rfq_id, item_id)`).
     * `tbl_rfq_vendor` (`rfq_vendor_id` PK, `rfq_id` FK $\rightarrow$ `tbl_rfq_header` ON DELETE CASCADE, `party_id` FK $\rightarrow$ `tbl_crm_party`, `invitation_date` TIMESTAMP, `status` VARCHAR(25) (`INVITED`, `QUOTED`, `DECLINED`, `SELECTED`), `vendor_quote_ref` VARCHAR(100), `quote_date` DATE, `total_quote_amount` NUMERIC(14,2), `payment_terms` VARCHAR(150), `delivery_lead_time_days` INT, `vendor_remarks` VARCHAR(350), `is_active` BOOLEAN, 7 audit columns, unique `(rfq_id, party_id)`).
     * `tbl_rfq_vendor_item` (`rfq_vendor_item_id` PK, `rfq_vendor_id` FK $\rightarrow$ `tbl_rfq_vendor` ON DELETE CASCADE, `rfq_item_id` FK $\rightarrow$ `tbl_rfq_item` ON DELETE CASCADE, `offered_qty` NUMERIC(14,3), `quoted_rate` NUMERIC(14,4), `discount_pct` NUMERIC(5,2), `net_rate` NUMERIC(14,4), `tax_pct` NUMERIC(5,2), `total_amount` NUMERIC(14,2), `is_l1` BOOLEAN, `is_awarded` BOOLEAN, `remarks` VARCHAR(250), `is_active` BOOLEAN, 7 audit columns, unique `(rfq_vendor_id, rfq_item_id)`).
   * Sequences: `seq_rfq_id` (starts at 1001), `seq_rfq_item_id` (starts at 1001), `seq_rfq_vendor_id` (starts at 1001), `seq_rfq_vendor_item_id` (starts at 1001).
   * Indexes: `idx_rfq_header_comp_status`, `idx_rfq_header_due_date`, `idx_rfq_header_wh`, `idx_rfq_item_lookup`, `idx_rfq_item_pr`, `idx_rfq_vendor_rfq`, `idx_rfq_vendor_item_lookup`, `idx_rfq_vendor_item_l1`.
   * Triggers: `trg_rfq_header_updated_date`, `trg_rfq_item_updated_date`, `trg_rfq_vendor_updated_date`, and `trg_rfq_vendor_item_updated_date` executing `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered screen `1017` (`PROCUREMENT_RFQ`) with actions `1034` (`EXPORT`), `1035` (`PRINT`), `1036` (`SEND`), and `1037` (`FINALIZE`). Granted permissions across roles.
     * `03_sample_demo_data.sql`: 5 RFQ tenders spanning SS-316 bars (`RFQ-AHM-2627-0001` - Awarded to JSW Steel), CNC coolant (`RFQ-AHM-2627-0002` - CS Ready), CR coils (`RFQ-RJK-2627-0003` - Quotes in), Aluminum ingots (`RFQ-AHM-2627-0004` - Sent), and PP granules (`RFQ-AHM-2627-0005` - Draft) with 8 invited vendors and 5 detailed quotation bids.
2. **Backend API Contracts (`backend/src/modules/procurement/rfq/`):**
   * `GET /api/v1/procurement/rfqs/summary` (`@RequirePermission('PROCUREMENT_RFQ', 'VIEW')`) — computes real-time sourcing KPI metrics (`totalRfqs`, `openCount`, `evaluatingCount`, `awardedCount`, `totalQuotesReceived`).
   * `GET /api/v1/procurement/rfqs` (`@RequirePermission('PROCUREMENT_RFQ', 'VIEW')`) — filters RFQ register by status, warehouse, and free-text search with invited vendors and quotes count.
   * `GET /api/v1/procurement/rfqs/:rfqId` (`@RequirePermission('PROCUREMENT_RFQ', 'VIEW')`) — returns full RFQ details with items and invited suppliers.
   * `GET /api/v1/procurement/rfqs/:rfqId/comparative-statement` (`@RequirePermission('PROCUREMENT_RFQ', 'VIEW')`) — builds Comparative Statement (CS) matrix comparing line items across all quoting suppliers, recalculating L1 bids and percentage variance vs target benchmark.
   * `POST /api/v1/procurement/rfqs` & `PUT /api/v1/procurement/rfqs/:rfqId` (`@RequirePermission('PROCUREMENT_RFQ', 'ADD' | 'EDIT')`) — creates or updates RFQ tenders with line items and vendor invitations.
   * `POST /api/v1/procurement/rfqs/:rfqId/send` (`@RequirePermission('PROCUREMENT_RFQ', 'SEND')`) — transitions status from `DRAFT` to `SENT`.
   * `POST /api/v1/procurement/rfqs/:rfqId/vendors/:vendorPartyId/quote` (`@RequirePermission('PROCUREMENT_RFQ', 'EDIT')`) — records supplier quotation, computes net rates and line totals, and recalculates L1 rank across all bids.
   * `POST /api/v1/procurement/rfqs/:rfqId/award` (`@RequirePermission('PROCUREMENT_RFQ', 'FINALIZE')`) — awards purchase contract to chosen vendor, sets status to `AWARDED`, flags winning quote items, and logs audit delta.
   * `DELETE /api/v1/procurement/rfqs/:rfqId` (`@RequirePermission('PROCUREMENT_RFQ', 'DELETE')`) — deletes `DRAFT` or `CANCELLED` RFQs after verifying foreign key relations against `tbl_po_item` via `DependencyCheckService`.
   * `POST /api/v1/procurement/rfqs/actions/log` (`@RequirePermission('PROCUREMENT_RFQ', 'VIEW')`) — logs `PRINT` and `EXPORT` activities into `tbl_sec_audit_log`.
3. **Frontend Architecture (`frontend/src/pages/procurement/RfqMasterPage.tsx`):**
   * Accessible at route `/procurement/rfqs` under `PROCUREMENT & SOURCING` with `'Live'` badge.
   * Built with `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="PROCUREMENT_RFQ">`.
   * Includes 4 KPI cards, status pills, tender creation modal with 1-click import from approved Material Requisitions (`tbl_pr_item`), vendor quote bid recording modal, interactive Comparative Statement (CS) evaluation matrix with L1 badges and price variance indicators, contract awarding workflow, and dual-mode printable datasheet modal (Comparative Sheet vs Supplier Inquiry Form).

---

### 2.19 Step 5.3 — Purchase Order (PO) Management & Release Workflow (`/procurement/purchase-orders`)

1. **Database Objects (`dbscripts/`):**
   * Tables:
     * `tbl_po_header` (`po_id` PK, `comp_id` FK $\rightarrow$ `tbl_org_company`, `branch_id` FK $\rightarrow$ `tbl_org_branch`, `fyear_id` FK $\rightarrow$ `tbl_org_financial_year`, `po_no` VARCHAR(50), `po_date` DATE, `expected_delivery_date` DATE, `vendor_id` FK $\rightarrow$ `tbl_crm_party`, `warehouse_id` FK $\rightarrow$ `tbl_inv_warehouse`, `po_type` VARCHAR(30) (`STANDARD`, `BLANKET`, `SUBCONTRACTING`, `SERVICE`, `CAPITAL_EXPENDITURE`), `status` VARCHAR(25) (`DRAFT`, `SUBMITTED`, `RELEASED`, `CLOSED`, `CANCELLED`), `gross_amount` NUMERIC(14,2), `discount_amount` NUMERIC(14,2), `tax_amount` NUMERIC(14,2), `net_amount` NUMERIC(14,2), `payment_terms` VARCHAR(150), `delivery_terms` VARCHAR(150), `shipping_address` VARCHAR(350), `billing_address` VARCHAR(350), `release_date` TIMESTAMP, `released_by` FK $\rightarrow$ `tbl_sec_user`, `release_remarks` VARCHAR(350), `cancel_reason` VARCHAR(350), `remarks` VARCHAR(350), `is_active` BOOLEAN, 7 audit columns, unique `(comp_id, po_no)`).
     * `tbl_po_item` (`po_item_id` PK, `po_id` FK $\rightarrow$ `tbl_po_header` ON DELETE CASCADE, `pr_item_id` FK $\rightarrow$ `tbl_pr_item`, `rfq_item_id` FK $\rightarrow$ `tbl_rfq_item`, `item_id` FK $\rightarrow$ `tbl_inv_item`, `item_description` VARCHAR(250), `uom_id` FK $\rightarrow$ `tbl_inv_uom`, `ordered_qty` NUMERIC(14,3), `received_qty` NUMERIC(14,3) DEFAULT 0, `rejected_qty` NUMERIC(14,3) DEFAULT 0, `unit_rate` NUMERIC(14,4), `discount_pct` NUMERIC(5,2) DEFAULT 0, `discount_amount` NUMERIC(14,2) DEFAULT 0, `tax_pct` NUMERIC(5,2) DEFAULT 0, `tax_amount` NUMERIC(14,2) DEFAULT 0, `gross_amount` NUMERIC(14,2), `net_amount` NUMERIC(14,2), `delivery_date` DATE, `remarks` VARCHAR(250), `is_active` BOOLEAN, 7 audit columns).
   * Sequences: `seq_po_id` (starts at 1001), `seq_po_item_id` (starts at 1001).
   * Indexes: `idx_po_header_comp_status`, `idx_po_header_vendor`, `idx_po_header_warehouse`, `idx_po_header_fyear`, `idx_po_item_po`, `idx_po_item_item`, `idx_po_item_pr`, `idx_po_item_rfq`.
   * Triggers: `trg_po_header_updated_date` and `trg_po_item_updated_date` executing `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered screen `1018` (`PURCHASE_ORDER`) with actions `1038` (`EXPORT`), `1039` (`PRINT`), `1040` (`SUBMIT`), `1041` (`RELEASE`), and `1042` (`CANCEL`). Granted role permissions across `SUPER_ADMIN`, `PLANT_MANAGER`, `STORE_OFFICER`, and `PURCHASE_EXEC`.
     * `03_sample_demo_data.sql`: 5 manufacturing purchase orders (`PO-AHM-2627-0001` through `PO-PNQ-2627-0005`) with 5 line items spanning raw materials (SS-316 bars), synthetic cutting fluid, subcontracting heat treatment, blanket supply contracts, and capital assets across Draft, Submitted, Released, and Cancelled states.
2. **Backend API Contracts (`backend/src/modules/procurement/purchase-order/`):**
   * `GET /api/v1/procurement/purchase-orders/summary` (`@RequirePermission('PURCHASE_ORDER', 'VIEW')`) — computes real-time operational KPI metrics (`totalPos`, `pendingReleaseCount`, `releasedCount`, `totalSpendValue`).
   * `GET /api/v1/procurement/purchase-orders` (`@RequirePermission('PURCHASE_ORDER', 'VIEW')`) — filters purchase order register by status, poType, vendorId, warehouseId, and free-text search.
   * `GET /api/v1/procurement/purchase-orders/:poId` (`@RequirePermission('PURCHASE_ORDER', 'VIEW')`) — returns full PO header and line items with tax breakdown and commercial sign-off audit data.
   * `POST /api/v1/procurement/purchase-orders` & `PUT /api/v1/procurement/purchase-orders/:poId` (`@RequirePermission('PURCHASE_ORDER', 'ADD' | 'EDIT')`) — creates or updates purchase orders with auto-calculated gross, discount, tax, and net totals, auto PO numbering (`PO-AHM-YYNextYY-XXXX`), and transactional item replacement.
   * `POST /api/v1/procurement/purchase-orders/:poId/submit` (`@RequirePermission('PURCHASE_ORDER', 'SUBMIT')`) — transitions PO from `DRAFT` to `SUBMITTED`, verifying item validity and logging audit delta.
   * `POST /api/v1/procurement/purchase-orders/:poId/release` (`@RequirePermission('PURCHASE_ORDER', 'RELEASE')`) — executes commercial release authorization, records `released_by`, `release_date`, and mandatory `release_remarks`, transitioning status to `RELEASED`.
   * `POST /api/v1/procurement/purchase-orders/:poId/cancel` (`@RequirePermission('PURCHASE_ORDER', 'CANCEL')`) — cancels order with mandatory `cancel_reason`, blocking downstream receipts.
   * `DELETE /api/v1/procurement/purchase-orders/:poId` (`@RequirePermission('PURCHASE_ORDER', 'DELETE')`) — deletes `DRAFT` purchase orders after verifying foreign key relations against `tbl_inv_grn_item` and `tbl_acc_bill_item` via `DependencyCheckService`.
   * `POST /api/v1/procurement/purchase-orders/actions/log` (`@RequirePermission('PURCHASE_ORDER', 'VIEW')`) — logs `PRINT` and `EXPORT` activities into `tbl_sec_audit_log`.
3. **Frontend Architecture (`frontend/src/pages/procurement/PurchaseOrderMasterPage.tsx`):**
   * Accessible at route `/procurement/purchase-orders` under `PROCUREMENT & SOURCING` with `'Live'` badge.
   * Built with `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="PURCHASE_ORDER">`.
   * Features 4 KPI metric cards, interactive status pills (`All`, `Draft`, `Submitted`, `Released`, `Closed`, `Cancelled`), PO Type, Vendor, and Plant filters.
   * Order builder modal with dynamic item lines, live tax calculation (Gross, Disc, GST, Net), and 1-click Sourcing Acceleration:
     * **Import from Awarded RFQ**: Pulls winning supplier, plant, payment terms, and negotiated line items with final unit rates from awarded tenders.
     * **Import from Approved PR**: Multi-selects approved material requisition lines.
   * Commercial Release sign-off modal (`RELEASE` action) with validation and authorization audit capture.
   * Cancellation modal (`CANCEL` action) with reason logging.
   * Official Purchase Order Voucher preview and `@media print` print layout complete with corporate manufacturing headers, GST breakdown, terms & conditions, and triple signature blocks.

---

### 2.20 Step 5.4 — Gate Entry & Security Inward Register (`/procurement/gate-inward`)

1. **Database Objects (`dbscripts/`):**
   * Tables:
     * `tbl_gate_inward_header` (`gate_inward_id` PK, `comp_id` FK $\rightarrow$ `tbl_org_company`, `branch_id` FK $\rightarrow$ `tbl_org_branch`, `fyear_id` FK $\rightarrow$ `tbl_org_financial_year`, `gate_inward_no` VARCHAR(50), `inward_date` DATE, `inward_time` VARCHAR(10), `warehouse_id` FK $\rightarrow$ `tbl_inv_warehouse`, `vendor_id` FK $\rightarrow$ `tbl_crm_party`, `po_id` FK $\rightarrow$ `tbl_po_header`, `challan_no` VARCHAR(100), `challan_date` DATE, `vehicle_no` VARCHAR(50), `transporter_name` VARCHAR(150), `driver_name` VARCHAR(100), `driver_phone` VARCHAR(30), `eway_bill_no` VARCHAR(50), `lr_no` VARCHAR(50), `lr_date` DATE, `gross_weight` NUMERIC(14,3), `tare_weight` NUMERIC(14,3), `net_weight` NUMERIC(14,3), `total_packages` INT, `status` VARCHAR(25) (`INWARDED`, `UNLOADED`, `GRN_PENDING`, `COMPLETED`, `CANCELLED`), `security_remarks` VARCHAR(350), `unloaded_date` TIMESTAMP, `unloaded_by` FK $\rightarrow$ `tbl_sec_user`, `unloading_remarks` VARCHAR(350), `exit_date` TIMESTAMP, `exit_remarks` VARCHAR(350), `cancel_reason` VARCHAR(350), `is_active` BOOLEAN, 7 audit columns, unique `(comp_id, gate_inward_no)`).
     * `tbl_gate_inward_item` (`gate_inward_item_id` PK, `gate_inward_id` FK $\rightarrow$ `tbl_gate_inward_header` ON DELETE CASCADE, `po_item_id` FK $\rightarrow$ `tbl_po_item`, `item_id` FK $\rightarrow$ `tbl_inv_item`, `item_description` VARCHAR(250), `uom_id` FK $\rightarrow$ `tbl_inv_uom`, `challan_qty` NUMERIC(14,3), `package_count` INT, `remarks` VARCHAR(250), `is_active` BOOLEAN, 7 audit columns, unique `(gate_inward_id, item_id)`).
   * Sequences: `seq_gate_inward_id` (starts at 1001), `seq_gate_inward_item_id` (starts at 1001).
   * Indexes: `idx_gate_inward_comp_status`, `idx_gate_inward_vendor`, `idx_gate_inward_warehouse`, `idx_gate_inward_po`, `idx_gate_inward_vehicle`, `idx_gate_inward_dates`, `idx_gate_inward_item_gin`, `idx_gate_inward_item_po_item`.
   * Triggers: `trg_gate_inward_header_updated_date` and `trg_gate_inward_item_updated_date` executing `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered screen `1019` (`GATE_INWARD`) with actions `1043` (`EXPORT`), `1044` (`PRINT`), `1045` (`UNLOAD`), `1046` (`EXIT`), and `1047` (`CANCEL`). Granted role permissions across `SUPER_ADMIN`, `PLANT_MANAGER`, `STORE_OFFICER`, and `PURCHASE_EXEC`.
     * `03_sample_demo_data.sql`: 5 gate entries (`GIN-AHM-2627-0001` through `GIN-AHM-2627-0005`) with 5 line items spanning raw materials (SS-316 bars), cutting oil, subcontracted job-work pieces, and spare parts across `INWARDED`, `UNLOADED`, `GRN_PENDING`, `COMPLETED`, and `CANCELLED` states.
2. **Backend API Contracts (`backend/src/modules/procurement/gate-inward/`):**
   * `GET /api/v1/procurement/gate-inward/summary` (`@RequirePermission('GATE_INWARD', 'VIEW')`) — computes real-time operational KPI metrics (`totalInwards`, `inwardedCount`, `unloadedCount`, `grnPendingCount`, `completedCount`, `inPlantCount`).
   * `GET /api/v1/procurement/gate-inward` (`@RequirePermission('GATE_INWARD', 'VIEW')`) — filters gate inward register by status, warehouseId, vendorId, poId, date range, and free-text search.
   * `GET /api/v1/procurement/gate-inward/:id` (`@RequirePermission('GATE_INWARD', 'VIEW')`) — returns full gate inward header and line items with weighbridge details and audit data.
   * `POST /api/v1/procurement/gate-inward` & `PUT /api/v1/procurement/gate-inward/:id` (`@RequirePermission('GATE_INWARD', 'ADD' | 'EDIT')`) — creates or updates gate inward records with auto-calculated net weight (`gross - tare`), auto numbering (`GIN-<BRANCH>-<YYNextYY>-XXXX`), and transactional item replacement.
   * `POST /api/v1/procurement/gate-inward/:id/unload` (`@RequirePermission('GATE_INWARD', 'UNLOAD')`) — records consignment physical offloading, second weighbridge tare weight, and updates status to `GRN_PENDING`.
   * `POST /api/v1/procurement/gate-inward/:id/exit` (`@RequirePermission('GATE_INWARD', 'EXIT')`) — records outward departure timestamp and security clearance remarks, transitioning status to `COMPLETED`.
   * `POST /api/v1/procurement/gate-inward/:id/cancel` (`@RequirePermission('GATE_INWARD', 'CANCEL')`) — voids entry or turns back vehicle with mandatory cancellation reason.
   * `DELETE /api/v1/procurement/gate-inward/:id` (`@RequirePermission('GATE_INWARD', 'DELETE')`) — deletes pending or voided entries after checking foreign key relations against `tbl_inv_grn_header` via `DependencyCheckService`.
   * `POST /api/v1/procurement/gate-inward/actions/log` (`@RequirePermission('GATE_INWARD', 'VIEW')`) — logs `PRINT` and `EXPORT` activities into `tbl_sec_audit_log`.
3. **Frontend Architecture (`frontend/src/pages/procurement/GateInwardMasterPage.tsx`):**
   * Accessible at route `/procurement/gate-inward` under `PROCUREMENT & SOURCING` with `'Live'` badge.
   * Built with `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="GATE_INWARD">`.
   * Features 4 KPI metric cards, interactive status pills (`All`, `At Gate`, `Unloaded`, `GRN Pending`, `Completed`, `Voided`), Plant and Supplier filters.
   * Gate entry modal with live weighbridge net weight calculation, document validation, and 1-click import from released Purchase Orders (`tbl_po_header` where `status = 'RELEASED'`).
   * Consignment offloading modal (`UNLOAD` action) and vehicle outward exit authorization modal (`EXIT` action).
   * Official Security Inward Gate Pass preview and `@media print` layout complete with corporate manufacturing headers, barcode header, weighbridge certificate box, challan items table, and triple signature blocks.

---

### 2.21 Step 5.5 — Goods Receipt Note (GRN) & Quarantine Put-Away (`/procurement/grn`)

1. **Database Objects (`dbscripts/`):**
   * Tables:
     * `tbl_inv_grn_header` (`grn_id` BIGINT PK, `comp_id` FK $\rightarrow$ `tbl_org_company`, `branch_id` FK $\rightarrow$ `tbl_org_branch`, `fyear_id` FK $\rightarrow$ `tbl_org_financial_year`, `grn_no` VARCHAR(50), `grn_date` DATE, `warehouse_id` FK $\rightarrow$ `tbl_inv_warehouse`, `vendor_id` FK $\rightarrow$ `tbl_crm_party`, `po_id` FK $\rightarrow$ `tbl_po_header`, `gate_inward_id` FK $\rightarrow$ `tbl_gate_inward_header`, `challan_no` VARCHAR(100), `challan_date` DATE, `invoice_no` VARCHAR(100), `invoice_date` DATE, `vehicle_no` VARCHAR(50), `eway_bill_no` VARCHAR(50), `lr_no` VARCHAR(50), `lr_date` DATE, `total_received_amount` NUMERIC(14,2), `status` VARCHAR(25) (`DRAFT`, `SUBMITTED`, `QC_IN_PROGRESS`, `APPROVED`, `CANCELLED`), `store_remarks` VARCHAR(350), `inspected_by` FK $\rightarrow$ `tbl_sec_user`, `inspection_date` TIMESTAMPTZ, `approved_by` FK $\rightarrow$ `tbl_sec_user`, `approval_date` TIMESTAMPTZ, `approval_remarks` VARCHAR(350), `cancel_reason` VARCHAR(350), `is_active` BOOLEAN, 7 mandatory audit columns, UNIQUE `(comp_id, grn_no)`).
     * `tbl_inv_grn_item` (`grn_item_id` BIGINT PK, `grn_id` FK $\rightarrow$ `tbl_inv_grn_header` ON DELETE CASCADE, `po_item_id` FK $\rightarrow$ `tbl_po_item`, `gate_inward_item_id` FK $\rightarrow$ `tbl_gate_inward_item`, `item_id` FK $\rightarrow$ `tbl_inv_item`, `item_description` VARCHAR(250), `uom_id` FK $\rightarrow$ `tbl_inv_uom`, `order_qty` NUMERIC(14,3), `challan_qty` NUMERIC(14,3), `received_qty` NUMERIC(14,3), `accepted_qty` NUMERIC(14,3), `rejected_qty` NUMERIC(14,3), `quarantine_qty` NUMERIC(14,3), `shortage_qty` NUMERIC(14,3), `excess_qty` NUMERIC(14,3), `unit_rate` NUMERIC(14,4), `received_amount` NUMERIC(14,2), `batch_no` VARCHAR(100), `mfg_date` DATE, `expiry_date` DATE, `quarantine_bin_id` FK $\rightarrow$ `tbl_inv_storage_bin`, `storage_bin_id` FK $\rightarrow$ `tbl_inv_storage_bin`, `is_qc_required` BOOLEAN, `remarks` VARCHAR(250), `is_active` BOOLEAN, 7 mandatory audit columns, UNIQUE `(grn_id, item_id)`).
   * Sequences: `seq_grn_id` (starts at 1001), `seq_grn_item_id` (starts at 1001).
   * Indexes: `idx_inv_grn_header_comp_status`, `idx_inv_grn_header_vendor`, `idx_inv_grn_header_warehouse`, `idx_inv_grn_header_po`, `idx_inv_grn_header_gate_inward`, `idx_inv_grn_header_dates`, `idx_inv_grn_item_grn`, `idx_inv_grn_item_po_item`, `idx_inv_grn_item_batch`, `idx_inv_grn_item_qbin`.
   * Triggers: `trg_inv_grn_header_updated_date` and `trg_inv_grn_item_updated_date` executing `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered screen `1020` (`PURCHASE_GRN`) with actions `1048` (`EXPORT`), `1049` (`PRINT`), `1050` (`SUBMIT`), `1051` (`APPROVE`), and `1052` (`CANCEL`). Role permission mappings configured for `SUPER_ADMIN`, `PLANT_MANAGER`, `STORE_OFFICER`, and `PURCHASE_EXEC`.
     * `03_sample_demo_data.sql`: 5 realistic manufacturing GRNs (`GRN-AHM-2627-0001` through `GRN-AHM-2627-0005`) across raw material bars, cutting coolants, subcontracted valve bodies, and aluminum ingots, spanning `DRAFT`, `SUBMITTED`, `QC_IN_PROGRESS`, and `APPROVED` states.
2. **Backend API Contracts (`backend/src/modules/procurement/grn/`):**
   * `GET /api/v1/procurement/grn/summary` (`@RequirePermission('PURCHASE_GRN', 'VIEW')`) — computes real-time operational KPI metrics (`totalGrns`, `qcPendingCount`, `approvedCount`, `draftCount`, `totalReceivedValuation`).
   * `GET /api/v1/procurement/grn` (`@RequirePermission('PURCHASE_GRN', 'VIEW')`) — lists GRN register with filters by status, warehouseId, vendorId, poId, gateInwardId, date range, and text search.
   * `GET /api/v1/procurement/grn/:id` (`@RequirePermission('PURCHASE_GRN', 'VIEW')`) — retrieves single GRN with full header, vendor details, and item lines.
   * `POST /api/v1/procurement/grn` & `PUT /api/v1/procurement/grn/:id` (`@RequirePermission('PURCHASE_GRN', 'ADD' | 'EDIT')`) — creates or updates GRNs with automatic sequential numbering (`GRN-<BRANCH>-<YYNextYY>-XXXX`), variance calculations (`shortage_qty`, `excess_qty`), and transactional item replacement.
   * `POST /api/v1/procurement/grn/:id/submit` (`@RequirePermission('PURCHASE_GRN', 'SUBMIT')`) — submits draft indent to store receiving queue.
   * `POST /api/v1/procurement/grn/:id/put-away` (`@RequirePermission('PURCHASE_GRN', 'EDIT')`) — assigns quarantine staging bin and marks status as `QC_IN_PROGRESS`.
   * `POST /api/v1/procurement/grn/:id/approve` (`@RequirePermission('PURCHASE_GRN', 'APPROVE')`) — records store approval, sets status to `APPROVED`, increments upstream `tbl_po_item.received_qty`, recomputes PO status (`COMPLETED` or `PARTIALLY_RECEIVED`), and updates Gate Inward status to `COMPLETED`.
   * `POST /api/v1/procurement/grn/:id/cancel` (`@RequirePermission('PURCHASE_GRN', 'CANCEL')`) — cancels GRN with mandatory reason and rolls back PO received quantities if previously approved.
   * `DELETE /api/v1/procurement/grn/:id` (`@RequirePermission('PURCHASE_GRN', 'DELETE')`) — deletes `DRAFT` GRNs with `DependencyCheckService` foreign key validation.
   * `GET /api/v1/procurement/grn/pending-gate-inwards`, `approved-pos`, `po-items/:poId`, `storage-bins` — sourcing accelerator and inventory lookup helper endpoints.
3. **Frontend Architecture (`frontend/src/pages/procurement/GrnMasterPage.tsx`):**
   * Accessible at route `/procurement/grn` under `PROCUREMENT & SOURCING` with `'Live'` badge.
   * Built with `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="PURCHASE_GRN">`.
   * 4 KPI cards (`Total GRNs`, `Quarantine / QC Hold`, `Store Approved & Cleared`, `Receipt Valuation`).
   * 1-Click Sourcing Accelerators: Fast autofill from Security Gate Inwards or Purchase Orders.
   * Dynamic item editor with live calculation of shortage/excess, received valuation, heat/batch logging, and storage bin assignments.
   * Dedicated Quarantine Put-Away modal (`Layers`), Store Approval modal (`CheckCircle2`), Cancellation modal (`XCircle`), and Details inspection drawer.
   * Official Goods Receipt Note Voucher preview and `@media print` layout featuring corporate manufacturing headers, GSTIN, heat/batch breakdown, quarantine and storage bin tagging, and triple authorization signature blocks.
---

### 2.22 Step 5.6 — Inward Material QC Inspection, Heat/Batch Allocation & Quarantine Clearance (`/quality/inward-qc`)

1. **Database Objects (`dbscripts/`):**
   * Tables:
     * `tbl_qc_inward_inspection_header` (`qc_inspection_id` BIGINT PK, `comp_id` FK $\rightarrow$ `tbl_org_company`, `branch_id` FK $\rightarrow$ `tbl_org_branch`, `fyear_id` FK $\rightarrow$ `tbl_org_financial_year`, `inspection_no` VARCHAR(50), `inspection_date` DATE, `grn_id` FK $\rightarrow$ `tbl_inv_grn_header`, `po_id` FK $\rightarrow$ `tbl_po_header`, `vendor_id` FK $\rightarrow$ `tbl_crm_party`, `warehouse_id` FK $\rightarrow$ `tbl_inv_warehouse`, `inspector_id` FK $\rightarrow$ `tbl_sec_user`, `inspection_type` VARCHAR(50) (`METALLURGICAL_LAB`, `VISUAL_DIMENSIONAL`, `CHEMICAL_SPECTRO`, `EXTERNAL_NABL_LAB`, `FAST_TRACK`), `status` VARCHAR(25) (`DRAFT`, `UNDER_INSPECTION`, `COMPLETED`, `CANCELLED`), `overall_result` VARCHAR(25) (`PENDING`, `ACCEPTED`, `REJECTED`, `ACCEPTED_UNDER_DEVIATION`), `vendor_mtc_no` VARCHAR(100), `vendor_mtc_date` DATE, `sample_size` NUMERIC(14,3), `sample_uom_id` FK $\rightarrow$ `tbl_inv_uom`, `general_remarks` VARCHAR(350), `approved_by` FK $\rightarrow$ `tbl_sec_user`, `approved_date` TIMESTAMPTZ, `approval_remarks` VARCHAR(350), `cancel_reason` VARCHAR(350), `is_active` BOOLEAN, 7 mandatory audit columns, UNIQUE `(comp_id, inspection_no)`).
     * `tbl_qc_inward_inspection_item` (`qc_inspection_item_id` BIGINT PK, `qc_inspection_id` FK $\rightarrow$ `tbl_qc_inward_inspection_header` ON DELETE CASCADE, `grn_item_id` FK $\rightarrow$ `tbl_inv_grn_item`, `item_id` FK $\rightarrow$ `tbl_inv_item`, `item_description` VARCHAR(250), `uom_id` FK $\rightarrow$ `tbl_inv_uom`, `received_qty` NUMERIC(14,3), `inspected_qty` NUMERIC(14,3), `accepted_qty` NUMERIC(14,3), `rejected_qty` NUMERIC(14,3), `batch_no` VARCHAR(100), `heat_no` VARCHAR(100), `test_certificate_ref` VARCHAR(100), `visual_inspection_passed` BOOLEAN, `dimension_check_passed` BOOLEAN, `chemical_analysis_passed` BOOLEAN, `hardness_test_passed` BOOLEAN, `observed_parameters` JSONB, `destination_bin_id` FK $\rightarrow$ `tbl_inv_storage_bin`, `quarantine_bin_id` FK $\rightarrow$ `tbl_inv_storage_bin`, `item_result` VARCHAR(25) (`PENDING`, `ACCEPTED`, `REJECTED`, `ACCEPTED_UNDER_DEVIATION`), `rejection_reason` VARCHAR(350), `rejection_category` VARCHAR(50), `remarks` VARCHAR(250), `is_active` BOOLEAN, 7 mandatory audit columns, UNIQUE `(qc_inspection_id, item_id)`).
   * Sequences: `seq_qc_inspection_id` (starts at 1001), `seq_qc_inspection_item_id` (starts at 1001).
   * Indexes: `idx_qc_inward_header_comp_status`, `idx_qc_inward_header_grn`, `idx_qc_inward_header_vendor`, `idx_qc_inward_header_warehouse`, `idx_qc_inward_header_po`, `idx_qc_inward_header_dates`, `idx_qc_inward_item_inspection`, `idx_qc_inward_item_grn_item`, `idx_qc_inward_item_batch`, `idx_qc_inward_item_heat`.
   * Triggers: `trg_qc_inward_header_updated_date` and `trg_qc_inward_item_updated_date` executing `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered screen `1021` (`INWARD_QC`) with actions `1053` (`EXPORT`), `1054` (`PRINT`), `1055` (`SUBMIT`), `1056` (`APPROVE`), `1057` (`REJECT`), `1058` (`CANCEL`). Role permission mappings configured for `SUPER_ADMIN`, `PLANT_MANAGER`, `QA_HEAD`, `STORE_OFFICER`, and `PURCHASE_EXEC`.
     * `03_sample_demo_data.sql`: 5 realistic manufacturing QC inspections (`QC-AHM-2627-0001` through `QC-AHM-2627-0005`) across raw material bars, cutting coolants, subcontracted valve bodies, aluminum ingots, and steel coils spanning `DRAFT`, `UNDER_INSPECTION`, and `COMPLETED` states.
2. **Backend API Contracts (`backend/src/modules/quality/inward-qc/`):**
   * `GET /api/v1/quality/inward-qc/summary` (`@RequirePermission('INWARD_QC', 'VIEW')`) — computes real-time operational quality KPI metrics (`totalInspections`, `pendingCount`, `acceptedCount`, `rejectedCount`).
   * `GET /api/v1/quality/inward-qc` (`@RequirePermission('INWARD_QC', 'VIEW')`) — lists inward QC register with filters by status, result, warehouseId, vendorId, grnId, date range, and free-text search.
   * `GET /api/v1/quality/inward-qc/:id` (`@RequirePermission('INWARD_QC', 'VIEW')`) — retrieves single inspection record with full header, vendor MTC metadata, inspector user info, and line items.
   * `POST /api/v1/quality/inward-qc` & `PUT /api/v1/quality/inward-qc/:id` (`@RequirePermission('INWARD_QC', 'ADD' | 'EDIT')`) — creates or updates QC inspections with automatic sequential numbering (`QC-<BRANCH>-<YYNextYY>-XXXX`), transactional item replacement, and JSON observed parameters.
   * `POST /api/v1/quality/inward-qc/:id/submit` (`@RequirePermission('INWARD_QC', 'SUBMIT')`) — submits inspection indent to laboratory testing queue (`UNDER_INSPECTION`).
   * `POST /api/v1/quality/inward-qc/:id/approve` (`@RequirePermission('INWARD_QC', 'APPROVE')`) — records QA supervisor clearance, transitions inspection status to `COMPLETED` and overall result to `ACCEPTED`, updates accepted vs rejected quantities, releases quarantine on `tbl_inv_grn_item` (`quarantine_qty = 0`, sets `accepted_qty`, `rejected_qty`, `storage_bin_id`, `batch_no`), marks GRN status as `APPROVED`, increments upstream `tbl_po_item.received_qty`, recomputes PO status (`COMPLETED` or `PARTIALLY_RECEIVED`), and updates Gate Inward status to `COMPLETED`.
   * `POST /api/v1/quality/inward-qc/:id/reject` (`@RequirePermission('INWARD_QC', 'REJECT')`) — flags lot as `REJECTED`, sets non-conformance quarantine bin, logs rejection category and failure reasoning.
   * `POST /api/v1/quality/inward-qc/:id/cancel` (`@RequirePermission('INWARD_QC', 'CANCEL')`) — revokes inspection with mandatory cancellation reason.
   * `DELETE /api/v1/quality/inward-qc/:id` (`@RequirePermission('INWARD_QC', 'DELETE')`) — deletes `DRAFT` inspections with `DependencyCheckService` foreign key validation.
   * `GET /api/v1/quality/inward-qc/pending-grns`, `grn-items/:grnId`, `storage-bins` — sourcing accelerator and inventory lookup helper endpoints.
3. **Frontend Architecture (`frontend/src/pages/quality/InwardQcMasterPage.tsx`):**
   * Accessible at route `/quality/inward-qc` under `QUALITY ASSURANCE & QC` with `'Live'` badge.
   * Built with `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="INWARD_QC">`.
   * 4 KPI cards (`Total Inspections`, `Pending QC Lab Clearance`, `Accepted & Released Lots`, `Rejected / Quarantine Holds`).
   * 1-Click Import from Quarantine GRNs (`tbl_inv_grn_header`).
   * 4-Pillar Quality Checklist (Visual/Packaging, Dimensional/Tolerances, Chemical/Spectrometry, Hardness/Mechanical) with JSON observed parameters tracking.
   * Dedicated Clearance Approval modal (`CheckCircle2`), Rejection modal (`XCircle`), Cancellation modal, and Inspection Drawer.
   * Official Quality Inspection Certificate preview and `@media print` layout complete with corporate manufacturing headers, GSTIN, Heat/Melt number tracking, chemical and mechanical test summaries, disposition metrics, vendor MTC attachment references, and dual signature blocks.

---

### 2.23 Step 5.7 — Warehouse Bin Put-Away, Lot Allocation & Stock Ledger Posting (`/inventory/put-away`)

1. **Database Objects (`dbscripts/`):**
   * Tables:
     * `tbl_inv_putaway_header` (`putaway_id` BIGINT PK, `comp_id` FK $\rightarrow$ `tbl_org_company`, `branch_id` FK $\rightarrow$ `tbl_org_branch`, `fyear_id` FK $\rightarrow$ `tbl_org_financial_year`, `putaway_no` VARCHAR(50), `putaway_date` DATE, `warehouse_id` FK $\rightarrow$ `tbl_inv_warehouse`, `grn_id` FK $\rightarrow$ `tbl_inv_grn_header`, `qc_id` FK $\rightarrow$ `tbl_qc_inward_inspection_header`, `assigned_to` FK $\rightarrow$ `tbl_sec_user`, `putaway_type` VARCHAR(50) (`GRN_INWARD`, `QC_RELEASE`, `INTERNAL_TRANSFER`, `REWORK_RETURN`), `status` VARCHAR(25) (`DRAFT`, `ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`), `total_items` INT, `total_qty` NUMERIC(14,3), `completed_date` TIMESTAMPTZ, `completed_by` FK $\rightarrow$ `tbl_sec_user`, `remarks` VARCHAR(350), `cancel_reason` VARCHAR(350), `is_active` BOOLEAN, 7 mandatory audit columns, UNIQUE `(comp_id, putaway_no)`).
     * `tbl_inv_putaway_item` (`putaway_item_id` BIGINT PK, `putaway_id` FK $\rightarrow$ `tbl_inv_putaway_header` ON DELETE CASCADE, `grn_item_id` FK $\rightarrow$ `tbl_inv_grn_item`, `qc_item_id` FK $\rightarrow$ `tbl_qc_inward_inspection_item`, `item_id` FK $\rightarrow$ `tbl_inv_item`, `item_description` VARCHAR(250), `uom_id` FK $\rightarrow$ `tbl_inv_uom`, `source_bin_id` FK $\rightarrow$ `tbl_inv_storage_bin`, `destination_bin_id` FK $\rightarrow$ `tbl_inv_storage_bin`, `allocated_qty` NUMERIC(14,3), `putaway_qty` NUMERIC(14,3), `batch_no` VARCHAR(100), `heat_no` VARCHAR(100), `mfg_date` DATE, `expiry_date` DATE, `status` VARCHAR(25) (`PENDING`, `COMPLETED`), `remarks` VARCHAR(250), `is_active` BOOLEAN, 7 mandatory audit columns).
     * `tbl_inv_bin_stock` (`bin_stock_id` BIGINT PK, `comp_id` FK $\rightarrow$ `tbl_org_company`, `branch_id` FK $\rightarrow$ `tbl_org_branch`, `fyear_id` FK $\rightarrow$ `tbl_org_financial_year`, `warehouse_id` FK $\rightarrow$ `tbl_inv_warehouse`, `bin_id` FK $\rightarrow$ `tbl_inv_storage_bin`, `item_id` FK $\rightarrow$ `tbl_inv_item`, `uom_id` FK $\rightarrow$ `tbl_inv_uom`, `batch_no` VARCHAR(100), `heat_no` VARCHAR(100), `on_hand_qty` NUMERIC(14,3), `reserved_qty` NUMERIC(14,3), `available_qty` NUMERIC(14,3), `unit_cost` NUMERIC(14,4), `total_valuation` NUMERIC(14,2), `last_stock_date` TIMESTAMPTZ, `is_active` BOOLEAN, 7 mandatory audit columns, UNIQUE `(warehouse_id, bin_id, item_id, batch_no)`).
     * `tbl_inv_stock_ledger` (`ledger_id` BIGINT PK, `comp_id` FK $\rightarrow$ `tbl_org_company`, `branch_id` FK $\rightarrow$ `tbl_org_branch`, `fyear_id` FK $\rightarrow$ `tbl_org_financial_year`, `transaction_date` TIMESTAMPTZ, `transaction_type` VARCHAR(50) (`PUTAWAY_INWARD`, `QUARANTINE_HOLD`, `QC_RELEASE`, `INTERNAL_TRANSFER`, `PRODUCTION_ISSUE`, `SCRAP_WRITE_OFF`, `ADJUSTMENT`), `reference_doc_type` VARCHAR(50) (`GRN`, `QC_INSPECTION`, `PUTAWAY`, `TRANSFER`, `WORK_ORDER`, `ADJUSTMENT`), `reference_doc_id` BIGINT, `reference_doc_no` VARCHAR(50), `warehouse_id` FK $\rightarrow$ `tbl_inv_warehouse`, `from_bin_id` FK $\rightarrow$ `tbl_inv_storage_bin`, `to_bin_id` FK $\rightarrow$ `tbl_inv_storage_bin`, `item_id` FK $\rightarrow$ `tbl_inv_item`, `uom_id` FK $\rightarrow$ `tbl_inv_uom`, `batch_no` VARCHAR(100), `heat_no` VARCHAR(100), `qty_in` NUMERIC(14,3), `qty_out` NUMERIC(14,3), `unit_cost` NUMERIC(14,4), `total_cost` NUMERIC(14,2), `closing_balance` NUMERIC(14,3), `remarks` VARCHAR(350), `is_active` BOOLEAN, 7 mandatory audit columns).
   * Sequences: `seq_putaway_id`, `seq_putaway_item_id`, `seq_bin_stock_id`, `seq_stock_ledger_id` (all starting at 1001).
   * Indexes: `idx_inv_putaway_header_comp_status`, `idx_inv_putaway_header_warehouse`, `idx_inv_putaway_header_grn`, `idx_inv_putaway_header_qc`, `idx_inv_putaway_item_putaway`, `idx_inv_putaway_item_dest_bin`, `idx_inv_bin_stock_wh_bin`, `idx_inv_bin_stock_item`, `idx_inv_stock_ledger_comp`, `idx_inv_stock_ledger_item_date`.
   * Triggers: `trg_inv_putaway_header_updated_date`, `trg_inv_putaway_item_updated_date`, and `trg_inv_bin_stock_updated_date` executing `fn_set_updated_timestamp()`.
   * Seeds:
     * `02_initial_data.sql`: Registered screen `1022` (`BIN_PUTAWAY`) with actions `1059` (`EXPORT`), `1060` (`PRINT`), `1061` (`ASSIGN`), `1062` (`CONFIRM`), and `1063` (`CANCEL`). Role permission mappings configured for `SUPER_ADMIN`, `PLANT_MANAGER`, `STORE_OFFICER`, and `PURCHASE_EXEC`.
     * `03_sample_demo_data.sql`: 5 realistic manufacturing Put-Away tasks (`PUT-AHM-2627-0001` through `PUT-AHM-2627-0005`), initial `tbl_inv_bin_stock` balances, and `tbl_inv_stock_ledger` records across stainless steel bars, cutting oil drums, aluminum ingots, valve bodies, and CRCA coils.
2. **Backend API Contracts (`backend/src/modules/inventory/put-away/`):**
   * `GET /api/v1/inventory/put-away/summary` (`@RequirePermission('BIN_PUTAWAY', 'VIEW')`) — computes real-time operational WMS KPI metrics (`totalTasks`, `pendingCount`, `inProgressCount`, `completedCount`, `totalPutawayQty`).
   * `GET /api/v1/inventory/put-away` (`@RequirePermission('BIN_PUTAWAY', 'VIEW')`) — lists put-away task register with filters by status, putawayType, warehouseId, assignedTo, date range, and free-text search.
   * `GET /api/v1/inventory/put-away/:id` (`@RequirePermission('BIN_PUTAWAY', 'VIEW')`) — retrieves single put-away task with full header, assigned operator, and line item bin routing.
   * `POST /api/v1/inventory/put-away` & `PUT /api/v1/inventory/put-away/:id` (`@RequirePermission('BIN_PUTAWAY', 'ADD' | 'EDIT')`) — creates or updates put-away tasks with automatic sequential numbering (`PUT-<BRANCH>-<YYNextYY>-XXXX`) and transactional item replacement.
   * `POST /api/v1/inventory/put-away/:id/assign` (`@RequirePermission('BIN_PUTAWAY', 'ASSIGN')`) — dispatches task to forklift/store operator and transitions status to `ASSIGNED`.
   * `POST /api/v1/inventory/put-away/:id/start` (`@RequirePermission('BIN_PUTAWAY', 'EDIT')`) — marks task as `IN_PROGRESS`.
   * `POST /api/v1/inventory/put-away/:id/confirm` (`@RequirePermission('BIN_PUTAWAY', 'CONFIRM')`) — completes put-away task, upserts on-hand and available balance in `tbl_inv_bin_stock`, and posts audit movement into `tbl_inv_stock_ledger`.
   * `POST /api/v1/inventory/put-away/:id/cancel` (`@RequirePermission('BIN_PUTAWAY', 'CANCEL')`) — cancels uncompleted task with mandatory cancellation reason.
   * `DELETE /api/v1/inventory/put-away/:id` (`@RequirePermission('BIN_PUTAWAY', 'DELETE')`) — deletes `DRAFT` tasks with `DependencyCheckService` foreign key validation.
   * `GET /api/v1/inventory/put-away/pending-qc`, `qc-items/:qcId`, `storage-bins/:warehouseId`, `operators` — sourcing accelerators and lookup helper endpoints.
3. **Frontend Architecture (`frontend/src/pages/inventory/PutAwayMasterPage.tsx`):**
   * Accessible at route `/inventory/put-away` under `INVENTORY & WMS` with `'Live'` badge.
   * Built with `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="BIN_PUTAWAY">`.
   * 4 KPI cards (`Total Put-Away Tasks`, `Pending Assignment`, `In-Progress Moves`, `Completed & Stock Posted`).
   * 1-Click Import from Approved QC Inspections (`tbl_qc_inward_inspection_header`).
   * Dedicated Operator Assignment modal (`UserCheck`), Confirmation & Stock Posting modal (`CheckCircle2`), Cancellation modal (`XCircle`), and Traceability Drawer.
   * Official Put-Away Voucher / Stock Transfer Pass preview and `@media print` layout complete with corporate manufacturing headers, task barcode, source document references, item movement table, handling instructions, and dual sign-off blocks.



### 2.24 Step 5.8 — Purchase Invoice 3-Way Matching, GST Input Tax Credit & Accounts Payable Clearance (`/procurement/invoices`)

1. **Database Objects (`dbscripts/`):**
   * Tables:
     * `tbl_pur_invoice_header` (`invoice_id` BIGINT PK, `comp_id` FK $\rightarrow$ `tbl_org_company`, `branch_id` FK $\rightarrow$ `tbl_org_branch`, `fyear_id` FK $\rightarrow$ `tbl_org_financial_year`, `invoice_no` VARCHAR(50), `invoice_date` DATE, `vendor_id` FK $\rightarrow$ `tbl_crm_party`, `po_id` FK $\rightarrow$ `tbl_po_header`, `grn_id` FK $\rightarrow$ `tbl_inv_grn_header`, `qc_id` FK $\rightarrow$ `tbl_qc_inward_inspection_header`, `vendor_invoice_no` VARCHAR(100), `vendor_invoice_date` DATE, `vendor_gstin` VARCHAR(20), `payment_terms_days` INT, `due_date` DATE, `subtotal_amount` NUMERIC(14,2), `discount_amount` NUMERIC(14,2), `taxable_amount` NUMERIC(14,2), `cgst_amount` NUMERIC(14,2), `sgst_amount` NUMERIC(14,2), `igst_amount` NUMERIC(14,2), `total_tax_amount` NUMERIC(14,2), `freight_charges` NUMERIC(14,2), `insurance_charges` NUMERIC(14,2), `packaging_charges` NUMERIC(14,2), `tds_rate` NUMERIC(6,3), `tds_amount` NUMERIC(14,2), `tcs_rate` NUMERIC(6,3), `tcs_amount` NUMERIC(14,2), `round_off` NUMERIC(8,2), `net_payable_amount` NUMERIC(14,2), `paid_amount` NUMERIC(14,2), `balance_amount` NUMERIC(14,2), `matching_status` VARCHAR(30) (`MATCHED`, `PRICE_VARIANCE`, `QTY_VARIANCE`, `TAX_VARIANCE`, `PENDING_REVIEW`), `status` VARCHAR(25) (`DRAFT`, `SUBMITTED`, `APPROVED`, `PAID`, `PARTIALLY_PAID`, `CANCELLED`), `payment_status` VARCHAR(25) (`UNPAID`, `PARTIALLY_PAID`, `PAID`), `approved_by` FK $\rightarrow$ `tbl_sec_user`, `approved_date` TIMESTAMPTZ, `approval_remarks` VARCHAR(350), `cancel_reason` VARCHAR(350), `remarks` VARCHAR(350), `is_active` BOOLEAN, 7 mandatory audit columns, UNIQUE `(comp_id, invoice_no)`, UNIQUE `(comp_id, vendor_id, vendor_invoice_no)`).
     * `tbl_pur_invoice_item` (`invoice_item_id` BIGINT PK, `invoice_id` BIGINT FK $\rightarrow$ `tbl_pur_invoice_header` ON DELETE CASCADE, `po_item_id` FK $\rightarrow$ `tbl_po_item`, `grn_item_id` FK $\rightarrow$ `tbl_inv_grn_item`, `qc_item_id` FK $\rightarrow$ `tbl_qc_inward_inspection_item`, `item_id` FK $\rightarrow$ `tbl_inv_item`, `item_description` VARCHAR(250), `hsn_code` VARCHAR(20), `uom_id` FK $\rightarrow$ `tbl_inv_uom`, `po_qty` NUMERIC(14,3), `received_qty` NUMERIC(14,3), `accepted_qty` NUMERIC(14,3), `billed_qty` NUMERIC(14,3), `po_rate` NUMERIC(14,4), `invoiced_rate` NUMERIC(14,4), `rate_variance` NUMERIC(14,4), `item_amount` NUMERIC(14,2), `discount_percent` NUMERIC(6,2), `discount_amount` NUMERIC(14,2), `taxable_amount` NUMERIC(14,2), `gst_rate` NUMERIC(6,2), `cgst_rate` NUMERIC(6,2), `cgst_amount` NUMERIC(14,2), `sgst_rate` NUMERIC(6,2), `sgst_amount` NUMERIC(14,2), `igst_rate` NUMERIC(6,2), `igst_amount` NUMERIC(14,2), `total_item_amount` NUMERIC(14,2), `batch_no` VARCHAR(100), `remarks` VARCHAR(250), `is_active` BOOLEAN, 7 mandatory audit columns).
   * Sequences: `seq_pur_invoice_id` (starts at 1001), `seq_pur_invoice_item_id` (starts at 1001).
   * Indexes: `idx_pur_invoice_header_comp_status`, `idx_pur_invoice_header_vendor`, `idx_pur_invoice_header_po`, `idx_pur_invoice_header_grn`, `idx_pur_invoice_header_dates`, `idx_pur_invoice_item_invoice`, `idx_pur_invoice_item_item`, `idx_pur_invoice_item_po_item`, `idx_pur_invoice_item_grn_item`.
   * Triggers: `trg_pur_invoice_header_updated_date` and `trg_pur_invoice_item_updated_date` executing `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered screen `1023` (`PURCHASE_INVOICE`) with actions `1064` (`EXPORT`), `1065` (`PRINT`), `1066` (`SUBMIT`), `1067` (`APPROVE`), and `1068` (`CANCEL`). Role permission mappings configured for `SUPER_ADMIN`, `PLANT_MANAGER`, `PURCHASE_EXEC`, and `STORE_OFFICER`.
     * `03_sample_demo_data.sql`: 5 realistic manufacturing purchase invoices (`PINV-AHM-2627-0001` through `PINV-AHM-2627-0005`) across JSPL raw material bars, Castrol cutting fluid, Rajkot Precision machining job-work, Vedanta aluminum ingots, and JSW Steel cold-rolled coils, covering `APPROVED`, `SUBMITTED`, and `PRICE_VARIANCE` states.
2. **Backend API Contracts (`backend/src/modules/procurement/invoice/`):**
   * `GET /api/v1/procurement/invoices/summary` (`@RequirePermission('PURCHASE_INVOICE', 'VIEW')`) — computes real-time operational KPI metrics (`totalInvoices`, `totalPayable`, `matchedCount`, `varianceCount`, `pendingApprovalCount`, `approvedCount`, `paidAmount`, `unpaidAmount`).
   * `GET /api/v1/procurement/invoices` (`@RequirePermission('PURCHASE_INVOICE', 'VIEW')`) — lists invoice register with filters by status, matchingStatus, paymentStatus, vendorId, poId, grnId, date range, and free-text search.
   * `GET /api/v1/procurement/invoices/:id` (`@RequirePermission('PURCHASE_INVOICE', 'VIEW')`) — retrieves single invoice record with full header, line items, and audit data.
   * `POST /api/v1/procurement/invoices` & `PUT /api/v1/procurement/invoices/:id` (`@RequirePermission('PURCHASE_INVOICE', 'ADD' | 'EDIT')`) — creates or updates commercial invoices with automatic sequential numbering (`PINV-<BRANCH>-<YYNextYY>-XXXX`), real-time 3-way variance detection (`rate_variance`, `matching_status`), tax recalculation, and transactional item replacement.
   * `POST /api/v1/procurement/invoices/:id/submit` (`@RequirePermission('PURCHASE_INVOICE', 'SUBMIT')`) — submits draft invoice for AP review (`SUBMITTED`).
   * `POST /api/v1/procurement/invoices/:id/approve` (`@RequirePermission('PURCHASE_INVOICE', 'APPROVE')`) — records AP clearance approval, sets status to `APPROVED`, timestamps `approved_date`, records approver user ID, and establishes balance payable.
   * `POST /api/v1/procurement/invoices/:id/record-payment` (`@RequirePermission('PURCHASE_INVOICE', 'APPROVE')`) — records bank payment against approved invoice, updates `paid_amount` and `balance_amount`, and updates status to `PARTIALLY_PAID` or `PAID`.
   * `POST /api/v1/procurement/invoices/:id/cancel` (`@RequirePermission('PURCHASE_INVOICE', 'CANCEL')`) — revokes commercial invoice with mandatory cancellation reasoning.
   * `DELETE /api/v1/procurement/invoices/:id` (`@RequirePermission('PURCHASE_INVOICE', 'DELETE')`) — deletes `DRAFT` invoices with `DependencyCheckService` foreign key validation.
   * `GET /api/v1/procurement/invoices/pending-grns`, `grn-details/:grnId`, `approved-pos`, `po-details/:poId`, `vendors` — sourcing accelerator and inventory lookup helper endpoints.
3. **Frontend Architecture (`frontend/src/pages/procurement/PurchaseInvoiceMasterPage.tsx`):**
   * Accessible at route `/procurement/invoices` under `PROCUREMENT & SOURCING` with `'Live'` badge.
   * Built with `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="PURCHASE_INVOICE">`.
   * 4 KPI cards (`Total Invoices`, `3-Way Clean Matched`, `Variances Flagged`, `Accounts Payable`).
   * 1-Click Sourcing Accelerators: Fast autofill from Approved GRN/QC or Purchase Orders.
   * Dynamic item editor with live calculation of rate variance, line total, GST breakdown, TDS deduction, TCS addition, and round off.
   * Real-time 3-Way Match Status Banner (Clean Match vs Price Variance vs Quantity Variance).
   * Dedicated AP Approval modal (`ShieldCheck`), Payment Clearance modal (`CreditCard`), Cancellation modal (`XCircle`), 3-Way Match Audit modal (`Eye`), and printable AP Voucher modal (`Printer`).


### 2.25 Step 6.1 — Multi-Level Bill of Materials (BOM), Versions, Scrap Factors & Co-Products / By-Products (`/manufacturing/boms`)

1. **Database Objects (`dbscripts/` & `backend/src/database/schema/core.schema.ts`):**
   * Tables:
     * `tbl_mfg_bom_header` (`bom_id` BIGINT PK backed by `seq_bom_id`, `comp_id` FK $\rightarrow$ `tbl_org_company`, `branch_id` FK $\rightarrow$ `tbl_org_branch`, `fyear_id` FK $\rightarrow$ `tbl_org_financial_year`, `bom_code` VARCHAR(50), `bom_name` VARCHAR(250), `item_id` FK $\rightarrow$ `tbl_inv_item`, `uom_id` FK $\rightarrow$ `tbl_inv_uom`, `output_qty` NUMERIC(14,4), `version_no` VARCHAR(20), `bom_type` VARCHAR(30) (`PRODUCTION`, `TEMPLATE`, `ENGINEERING`, `PROTOTYPE`), `status` VARCHAR(25) (`DRAFT`, `ACTIVE`, `OBSOLETE`), `is_default` BOOLEAN, `effective_from` DATE, `effective_to` DATE, `routing_id` BIGINT, `total_material_cost` NUMERIC(14,2), `total_labour_cost` NUMERIC(14,2), `total_overhead_cost` NUMERIC(14,2), `total_byproduct_recovery` NUMERIC(14,2), `net_unit_cost` NUMERIC(14,4), `approved_by` FK $\rightarrow$ `tbl_sec_user`, `approved_date` TIMESTAMPTZ, `approval_remarks` VARCHAR(350), `remarks` VARCHAR(350), `is_active` BOOLEAN, 7 mandatory audit columns, UNIQUE `(comp_id, item_id, version_no)`).
     * `tbl_mfg_bom_item` (`bom_item_id` BIGINT PK backed by `seq_bom_item_id`, `bom_id` FK $\rightarrow$ `tbl_mfg_bom_header` ON DELETE CASCADE, `item_id` FK $\rightarrow$ `tbl_inv_item`, `item_description` VARCHAR(250), `uom_id` FK $\rightarrow$ `tbl_inv_uom`, `quantity` NUMERIC(14,4), `scrap_factor_percent` NUMERIC(6,2), `gross_quantity` NUMERIC(14,4), `child_bom_id` FK $\rightarrow$ `tbl_mfg_bom_header`, `unit_cost` NUMERIC(14,4), `line_cost` NUMERIC(14,2), `source_type` VARCHAR(30) (`PURCHASED`, `MANUFACTURED`, `SUBCONTRACTED`), `operation_seq` INT, `operation_name` VARCHAR(100), `is_critical` BOOLEAN, `remarks` VARCHAR(250), `is_active` BOOLEAN, 7 mandatory audit columns).
     * `tbl_mfg_bom_byproduct` (`bom_byproduct_id` BIGINT PK backed by `seq_bom_byproduct_id`, `bom_id` FK $\rightarrow$ `tbl_mfg_bom_header` ON DELETE CASCADE, `item_id` FK $\rightarrow$ `tbl_inv_item`, `item_description` VARCHAR(250), `uom_id` FK $\rightarrow$ `tbl_inv_uom`, `quantity` NUMERIC(14,4), `product_type` VARCHAR(30) (`BY_PRODUCT`, `CO_PRODUCT`, `RECOVERABLE_SCRAP`), `cost_allocation_percent` NUMERIC(6,2), `estimated_recovery_rate` NUMERIC(14,4), `estimated_recovery_value` NUMERIC(14,2), `remarks` VARCHAR(250), `is_active` BOOLEAN, 7 mandatory audit columns).
   * Sequences: `seq_bom_id`, `seq_bom_item_id`, `seq_bom_byproduct_id` (all starting at 1001).
   * Indexes: `idx_mfg_bom_header_comp_item`, `idx_mfg_bom_header_status`, `idx_mfg_bom_header_item_ver`, `idx_mfg_bom_item_bom_id`, `idx_mfg_bom_item_item_id`, `idx_mfg_bom_item_child_bom`, `idx_mfg_bom_byproduct_bom_id`, `idx_mfg_bom_byproduct_item_id`.
   * Triggers: `trg_mfg_bom_header_updated_date`, `trg_mfg_bom_item_updated_date`, and `trg_mfg_bom_byproduct_updated_date` executing `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered screen `1024` (`MFG_BOM`) with actions `1069` (`EXPORT`), `1070` (`PRINT`), `1071` (`APPROVE`), `1072` (`CLONE`), and `1073` (`EXPLODE`). Role permissions assigned for `SUPER_ADMIN`, `PLANT_MANAGER`, and `DESIGN_ENG`.
     * `03_sample_demo_data.sql`: 5 realistic engineering BOMs (`BOM-FG-001-V1.0` through `BOM-ENG-001-V1.0`), including multi-tier assemblies linking sub-assemblies `1003` (Sub-Assembly Pump Unit) and `1004` (Sub-Assembly Valve Block) via `child_bom_id`, 12 component lines with process scrap factors, and 5 byproducts/recoverable scrap rows.
2. **Backend API Contracts (`backend/src/modules/manufacturing/bom/`):**
   * `GET /api/v1/manufacturing/boms/summary` (`@RequirePermission('MFG_BOM', 'VIEW')`) — computes real-time operational KPI metrics (`totalBoms`, `activeBoms`, `distinctAssemblies`, `avgUnitCost`, `multiLevelBoms`).
   * `GET /api/v1/manufacturing/boms` (`@RequirePermission('MFG_BOM', 'VIEW')`) — lists BOM register with filters by status, bomType, itemId, isDefault, and free-text search.
   * `GET /api/v1/manufacturing/boms/:id` (`@RequirePermission('MFG_BOM', 'VIEW')`) — retrieves single BOM record with full header, components, and by-products.
   * `GET /api/v1/manufacturing/boms/:id/tree` (`@RequirePermission('MFG_BOM', 'EXPLODE')`) — recursive multi-level tree explosion algorithm with cycle detection (`visitedBoms: Set<number>`) and compounding cumulative multipliers.
   * `POST /api/v1/manufacturing/boms` & `PUT /api/v1/manufacturing/boms/:id` (`@RequirePermission('MFG_BOM', 'ADD' | 'EDIT')`) — creates or updates engineering BOMs with automatic document code generation (`BOM-{ITEM_CODE}-V{VERSION}`), dynamic gross scrap calculations, cost rollups, and transactional item/byproduct replacement.
   * `POST /api/v1/manufacturing/boms/:id/approve` (`@RequirePermission('MFG_BOM', 'APPROVE')`) — marks BOM as `ACTIVE`, sets `approved_by` and `approved_date`, and unsets other defaults if `is_default` is true.
   * `POST /api/v1/manufacturing/boms/:id/clone` (`@RequirePermission('MFG_BOM', 'CLONE')`) — deep copies all component lines, scrap factors, operations, and byproducts into a new version.
   * `DELETE /api/v1/manufacturing/boms/:id` (`@RequirePermission('MFG_BOM', 'DELETE')`) — deletes draft or unreferenced BOMs, enforcing that child-referenced sub-assembly BOMs cannot be deleted (`ConflictException`).
   * `GET /api/v1/manufacturing/boms/manufactured-items`, `component-items`, `child-boms`, `uoms` — sourcing accelerators and lookup helper endpoints.
3. **Domain Logic & Formulas:**
   * Gross Quantity Calculation: $\text{Gross Qty} = \text{Net Qty} \times \left(1 + \frac{\text{Scrap Factor \%}}{100}\right)$.
   * Line Item Cost: $\text{Line Cost} = \text{Gross Qty} \times \text{Unit Rate}$.
   * By-Product Recovery Value: $\text{Recovery Value} = \text{Qty} \times \text{Recovery Rate}$.
   * Net Finished Good Unit Cost:
     $$\text{Net Unit Cost} = \frac{\sum \text{Line Cost} + \text{Direct Labour} + \text{Overhead} - \sum \text{Recovery Value}}{\text{Batch Output Quantity}}$$
   * Recursive Cumulative Multiplier:
     $$\text{Cum Qty}_{\text{child}} = \text{Parent Multiplier} \times \frac{\text{Gross Qty}_{\text{child}}}{\text{Output Qty}_{\text{parent}}}$$
4. **Frontend Architecture (`frontend/src/pages/manufacturing/BomMasterPage.tsx`):**
   * Accessible at route `/manufacturing/boms` under `MANUFACTURING & PRODUCTION` with `'Live'` badge.
   * Built with `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="MFG_BOM">`.
   * 4 KPI cards (`Total BOMs`, `Active Production BOMs`, `Multi-Level Assemblies`, `Avg Net Unit Cost`).
   * 4-Tab BOM Creation / Edit modal (`General & Header`, `Components & Scrap %`, `Co-Products & Scrap`, `Live Cost Rollup Summary`).
   * Recursive Indented BOM Tree Explosion modal (`FolderTree` / `GitFork`) with expand/collapse and cumulative required quantity calculation.
   * Dedicated Version Clone modal (`Copy`), Approval modal (`CheckCircle2`), and printable Costed BOM Datasheet modal (`Printer`).


### 2.26 Step 6.2 — Work Centers, Production Lines, Capacity & Shift Calendars (`/manufacturing/work-centers`)

1. **Database Objects (`dbscripts/` & `backend/src/database/schema/core.schema.ts`):**
   * Tables:
     * `tbl_mfg_shift` (`shift_id` BIGINT PK backed by `seq_shift_id`, `shift_code` VARCHAR(30), `shift_name` VARCHAR(100), `start_time` TIME, `end_time` TIME, `break_duration_mins` INT, `effective_working_hours` NUMERIC(5,2), `is_night_shift` BOOLEAN, `remarks` VARCHAR(250), `is_active` BOOLEAN, 7 mandatory audit columns, UNIQUE `(comp_id, branch_id, shift_code)`).
     * `tbl_mfg_work_center` (`work_center_id` BIGINT PK backed by `seq_work_center_id`, `work_center_code` VARCHAR(50), `work_center_name` VARCHAR(250), `work_center_type` VARCHAR(30) (`MACHINE`, `LINE_ASSEMBLY`, `MANUAL`, `FURNACE`, `TEST_BENCH`, `SUBCONTRACTOR`), `dept_id` FK $\rightarrow$ `tbl_hr_department(dept_id)`, `location_desc` VARCHAR(200), `capacity_per_day_hours` NUMERIC(6,2), `efficiency_percent` NUMERIC(5,2), `capacity_uom` VARCHAR(20), `cost_per_hour` NUMERIC(14,2), `labour_cost_per_hour` NUMERIC(14,2), `overhead_cost_per_hour` NUMERIC(14,2), `total_hourly_rate` NUMERIC(14,2), `status` VARCHAR(30) (`ACTIVE`, `UNDER_MAINTENANCE`, `INACTIVE`), `remarks` VARCHAR(350), `is_active` BOOLEAN, 7 mandatory audit columns, UNIQUE `(comp_id, branch_id, work_center_code)`).
     * `tbl_mfg_work_center_machine` (`wc_machine_id` BIGINT PK backed by `seq_wc_machine_id`, `work_center_id` FK $\rightarrow$ `tbl_mfg_work_center` ON DELETE CASCADE, `machine_code` VARCHAR(50), `machine_name` VARCHAR(200), `model_no` VARCHAR(100), `serial_no` VARCHAR(100), `manufacturer` VARCHAR(150), `installation_date` DATE, `warranty_expiry_date` DATE, `power_rating_kw` NUMERIC(8,2), `status` VARCHAR(30) (`OPERATIONAL`, `BREAKDOWN`, `STANDBY`, `DECOMMISSIONED`), `last_maintenance_date` DATE, `next_maintenance_due` DATE, `remarks` VARCHAR(250), `is_active` BOOLEAN, 7 mandatory audit columns, UNIQUE `(comp_id, branch_id, machine_code)`).
     * `tbl_mfg_work_center_shift` (`wc_shift_id` BIGINT PK backed by `seq_wc_shift_id`, `work_center_id` FK $\rightarrow$ `tbl_mfg_work_center` ON DELETE CASCADE, `shift_id` FK $\rightarrow$ `tbl_mfg_shift`, `days_of_week` VARCHAR(50), `operator_count` INT, `remarks` VARCHAR(250), `is_active` BOOLEAN, 7 mandatory audit columns, UNIQUE `(work_center_id, shift_id)`).
   * Sequences: `seq_shift_id`, `seq_work_center_id`, `seq_wc_machine_id`, `seq_wc_shift_id` (starting at 1001).
   * Indexes: `idx_mfg_shift_comp_branch`, `idx_mfg_work_center_comp`, `idx_mfg_work_center_status`, `idx_mfg_work_center_type`, `idx_mfg_wc_machine_wc`, `idx_mfg_wc_machine_status`, `idx_mfg_wc_shift_wc`, `idx_mfg_wc_shift_shift`.
   * Triggers: `trg_mfg_shift_updated_date`, `trg_mfg_work_center_updated_date`, `trg_mfg_work_center_machine_updated_date`, and `trg_mfg_work_center_shift_updated_date` executing `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered screen `1025` (`MFG_WORK_CENTER`) with actions `1074` (`EXPORT`), `1075` (`PRINT`), and `1076` (`MAINTENANCE`). Role permissions assigned for `SUPER_ADMIN`, `PLANT_MANAGER`, `DESIGN_ENG`, and `STORE_OFFICER`.
     * `03_sample_demo_data.sql`: 4 factory shifts (`SHIFT-GEN`, `SHIFT-M1`, `SHIFT-E1`, `SHIFT-N1`), 5 production work centers (`WC-CNC-01`, `WC-FAB-01`, `WC-HT-01`, `WC-ASSY-01`, `WC-PAINT-01`), 10 machine assets, and 10 shift allocation rows.
2. **Backend API Contracts (`backend/src/modules/manufacturing/work-center/`):**
   * `GET /api/v1/manufacturing/work-centers/summary` (`@RequirePermission('MFG_WORK_CENTER', 'VIEW')`) — computes real-time operational KPI metrics (`totalWorkCenters`, `activeWorkCenters`, `totalDailyCapacityHours`, `avgEfficiencyPercent`, `totalMachines`, `operationalMachines`).
   * `GET /api/v1/manufacturing/work-centers` (`@RequirePermission('MFG_WORK_CENTER', 'VIEW')`) — lists work centers with filters by status, workCenterType, deptId, and free-text search.
   * `GET /api/v1/manufacturing/work-centers/:id` (`@RequirePermission('MFG_WORK_CENTER', 'VIEW')`) — retrieves single work center record with machines and operating shifts.
   * `POST /api/v1/manufacturing/work-centers` & `PUT /api/v1/manufacturing/work-centers/:id` (`@RequirePermission('MFG_WORK_CENTER', 'ADD' | 'EDIT')`) — creates or updates work center definitions with automatic sequential numbering (`WC-{PREFIX}-{SEQ}`), total hourly rate calculation, and transactional machine/shift replacement.
   * `POST /api/v1/manufacturing/work-centers/:id/machines/:machineId/maintenance` (`@RequirePermission('MFG_WORK_CENTER', 'MAINTENANCE')`) — logs machine operational status (`OPERATIONAL`, `BREAKDOWN`, `STANDBY`, `DECOMMISSIONED`), updates maintenance dates, and triggers automated cell status transition if all machines are in breakdown.
   * `DELETE /api/v1/manufacturing/work-centers/:id` (`@RequirePermission('MFG_WORK_CENTER', 'DELETE')`) — deletes unlinked work centers with foreign key verification via `DependencyCheckService`.
   * `GET /api/v1/manufacturing/work-centers/shifts`, `POST /shifts`, `GET /departments` — lookup helper endpoints.
3. **Domain Logic & Formulas:**
   * Standard Total Hourly Rate:
     $$\text{Total Hourly Rate} = \text{Direct Machine Cost} + \text{Direct Labor Rate} + \text{Overhead Rate}$$
   * Effective Daily Working Capacity:
     $$\text{Effective Daily Capacity (Hours)} = \text{Daily Rated Capacity Hours} \times \left(\frac{\text{Efficiency / OEE \%}}{100}\right)$$
   * Monthly Theoretical Working Capacity:
     $$\text{Monthly Capacity (Hours)} = \text{Effective Daily Capacity} \times 25 \text{ Working Days}$$
4. **Frontend Architecture (`frontend/src/pages/manufacturing/WorkCenterMasterPage.tsx`):**
   * Accessible at route `/manufacturing/work-centers` under `MANUFACTURING & PRODUCTION` with `'Live'` badge.
   * Built with `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="MFG_WORK_CENTER">`.
   * 4 KPI cards (`Total Work Centers`, `Daily Rated Capacity`, `Plant Machinery Assets`, `Weighted Factory Efficiency`).
   * 3-Tab Creation / Edit modal (`General Specifications & Capacity`, `Machinery & Capital Assets`, `Shift Calendars & Hourly Cost Absorption Matrix`).
   * Dedicated Machinery Maintenance & Status Modal (`Wrench`), Shift Quick-Add Modal (`Clock`), and printable Work Center Datasheet modal (`Printer`).

### 2.27 Step 6.3 — Production Routings, Operation Sequences, Standard Cycle Times & Machine Tooling (`/manufacturing/routings`)

1. **Database Objects (`dbscripts/` & `backend/src/database/schema/core.schema.ts`):**
   * Tables:
     * `tbl_mfg_routing_header` (`routing_id` BIGINT PK backed by `seq_routing_id`, `routing_code` VARCHAR(50), `routing_name` VARCHAR(200), `item_id` BIGINT FK $\rightarrow$ `tbl_inv_item(item_id)`, `version_no` VARCHAR(20) DEFAULT `'1.0'`, `status` VARCHAR(30) (`DRAFT`, `ACTIVE`, `OBSOLETE`, `UNDER_REVIEW`), `is_default` BOOLEAN DEFAULT TRUE, `effective_from` DATE, `effective_to` DATE, `batch_size` NUMERIC(14,3), `total_setup_time_mins` NUMERIC(10,2), `total_run_time_mins` NUMERIC(10,2), `total_lead_time_days` NUMERIC(6,2), `total_machine_cost` NUMERIC(14,2), `total_labor_cost` NUMERIC(14,2), `total_overhead_cost` NUMERIC(14,2), `total_cost_per_unit` NUMERIC(14,4), `approved_by` BIGINT FK $\rightarrow$ `tbl_sec_user(user_id)`, `approved_date` TIMESTAMPTZ, `approval_remarks` VARCHAR(350), `remarks` VARCHAR(350), `is_active` BOOLEAN, 7 mandatory audit columns, UNIQUE `(comp_id, routing_code)`, UNIQUE `(comp_id, item_id, version_no)`).
     * `tbl_mfg_routing_operation` (`routing_op_id` BIGINT PK backed by `seq_routing_op_id`, `routing_id` BIGINT FK $\rightarrow$ `tbl_mfg_routing_header(routing_id)` ON DELETE CASCADE, `op_sequence` INT, `op_code` VARCHAR(30), `op_name` VARCHAR(200), `work_center_id` BIGINT FK $\rightarrow$ `tbl_mfg_work_center(work_center_id)`, `machine_id` BIGINT FK $\rightarrow$ `tbl_mfg_work_center_machine(wc_machine_id)`, `setup_time_mins` NUMERIC(10,2), `run_time_mins` NUMERIC(10,2), `overlap_percent` NUMERIC(5,2), `machine_hourly_rate` NUMERIC(14,2), `labor_hourly_rate` NUMERIC(14,2), `overhead_hourly_rate` NUMERIC(14,2), `total_hourly_rate` NUMERIC(14,2), `machine_cost_per_unit` NUMERIC(14,4), `labor_cost_per_unit` NUMERIC(14,4), `overhead_cost_per_unit` NUMERIC(14,4), `total_cost_per_unit` NUMERIC(14,4), `tooling_description` VARCHAR(300), `fixture_no` VARCHAR(100), `is_inspection_required` BOOLEAN DEFAULT FALSE, `qc_checkpoints` VARCHAR(350), `is_subcontracted` BOOLEAN DEFAULT FALSE, `subcontract_vendor_id` BIGINT FK $\rightarrow$ `tbl_crm_party(party_id)`, `remarks` VARCHAR(250), `is_active` BOOLEAN, 7 mandatory audit columns, UNIQUE `(routing_id, op_sequence)`).
   * Sequences: `seq_routing_id`, `seq_routing_op_id` (starting at 1001).
   * Indexes: `idx_mfg_routing_header_comp`, `idx_mfg_routing_header_item`, `idx_mfg_routing_header_status`, `idx_mfg_routing_op_routing`, `idx_mfg_routing_op_wc`.
   * Triggers: `trg_mfg_routing_header_updated_date` and `trg_mfg_routing_operation_updated_date` executing `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered screen `1026` (`MFG_ROUTING`) with actions `1077` (`EXPORT`), `1078` (`PRINT`), `1079` (`APPROVE`), and `1080` (`CLONE`). Role permissions assigned for `SUPER_ADMIN`, `PLANT_MANAGER`, `DESIGN_ENG`, `STORE_OFFICER`, and `PURCHASE_EXEC`.
     * `03_sample_demo_data.sql`: 4 production routings (`ROUT-FG-VALVE-50-V1`, `ROUT-AUTO-MNT-V1`, `ROUT-SUB-BODY-V1`, `ROUT-FG-VALVE-50-V2`), 16 operations mapped across CNC turning, milling, gas carburizing, grinding, hydro testing, powder coating, and stamping cells. Updated active BOM headers with corresponding routing IDs.
2. **Backend API Contracts (`backend/src/modules/manufacturing/routing/`):**
   * `GET /api/v1/manufacturing/routings/summary` (`@RequirePermission('MFG_ROUTING', 'VIEW')`) — returns KPI metrics (`totalRoutings`, `activeRoutings`, `distinctItems`, `avgCycleTimeMins`, `totalRoutingCost`).
   * `GET /api/v1/manufacturing/routings/lookups` (`@RequirePermission('MFG_ROUTING', 'VIEW')`) — provides manufactured assemblies from `tbl_inv_item`, work centers with rates, machine tools, and subcontractor vendors.
   * `GET /api/v1/manufacturing/routings` (`@RequirePermission('MFG_ROUTING', 'VIEW')`) — paginated listing with search on routing/item code and filtering by status, item, or default flag.
   * `GET /api/v1/manufacturing/routings/:id` (`@RequirePermission('MFG_ROUTING', 'VIEW')`) — full routing header and sequential operations ordered by `op_sequence ASC`.
   * `POST /api/v1/manufacturing/routings` (`@RequirePermission('MFG_ROUTING', 'ADD')`) — creates routing header and child operations with automated document code generation (`ROUT-{ITEM_CODE}-V{VER}`), rate defaults from work centers, and transaction-safe rollups.
   * `PUT /api/v1/manufacturing/routings/:id` (`@RequirePermission('MFG_ROUTING', 'EDIT')`) — updates header parameters and atomically reconciles operations.
   * `DELETE /api/v1/manufacturing/routings/:id` (`@RequirePermission('MFG_ROUTING', 'DELETE')`) — deletes routing after verifying unlinked status from active Bill of Materials.
   * `POST /api/v1/manufacturing/routings/:id/approve` (`@RequirePermission('MFG_ROUTING', 'APPROVE')`) — releases routing to `ACTIVE`, marks as default, and syncs `routing_id` to active BOM.
   * `POST /api/v1/manufacturing/routings/:id/clone` (`@RequirePermission('MFG_ROUTING', 'CLONE')`) — duplicates routing and operation stages into a new draft revision.
3. **Absorption Costing & Cycle Time Formulas:**
   * Amortized Setup Time per Unit:
     $$\text{Amortized Setup (mins)} = \frac{\text{setup\_time\_mins}}{\text{batch\_size}}$$
   * Total Operation Processing Time per Unit:
     $$\text{Total Op Time (mins)} = \text{run\_time\_mins} + \text{Amortized Setup (mins)}$$
     $$\text{Total Op Time (hours)} = \frac{\text{Total Op Time (mins)}}{60}$$
   * Operation Absorption Cost Contributions:
     $$\text{machine\_cost\_per\_unit} = \text{Total Op Time (hours)} \times \text{machine\_hourly\_rate}$$
     $$\text{labor\_cost\_per\_unit} = \text{Total Op Time (hours)} \times \text{labor\_hourly\_rate}$$
     $$\text{overhead\_cost\_per\_unit} = \text{Total Op Time (hours)} \times \text{overhead\_hourly\_rate}$$
     $$\text{total\_cost\_per\_unit} = \text{machine\_cost\_per\_unit} + \text{labor\_cost\_per\_unit} + \text{overhead\_cost\_per\_unit}$$
   * Cumulative Header Rollups:
     $$\text{total\_cost\_per\_unit} = \sum \text{total\_cost\_per\_unit}_{\text{ops}}$$
     $$\text{total\_lead\_time\_days} = \max\left(0.5, \frac{(\text{total\_setup\_time\_mins} + \text{total\_run\_time\_mins} \times \text{batch\_size})}{8 \times 60} \times 1.2\right)$$
4. **Frontend Architecture (`frontend/src/pages/manufacturing/RoutingMasterPage.tsx`):**
   * Accessible at route `/manufacturing/routings` under `MANUFACTURING & PRODUCTION` with `'Live'` badge.
   * Built with `<MasterDataTable>`, `<ConfirmDeleteModal>`, and `<PermissionGate screen="MFG_ROUTING">`.
   * 4 KPI cards (`Total Routings`, `Active Released Routings`, `Configured Assemblies`, `Avg Run Cycle Time`).
   * Interactive Sequential Operation Flow Timeline modal (`Eye`) displaying chronological manufacturing stages, machine assets, cycle times, tooling specs, and QC gates.
   * 3-Tab Creation / Edit modal (`Header & General Parameters`, `Operation Sequencer`, `Absorption Costing & Summary`) with dynamic stage reordering (`ArrowUp`/`ArrowDown`).
   * Dedicated Engineering Approval modal (`CheckCircle2`), Revision Cloning modal (`Copy`), and printable Shopfloor Route Traveler Card modal (`Printer`).

### 2.28 Step 6.4 — Material Requirements Planning (MRP-I Engine) & Gross-to-Net Planned Orders (`/manufacturing/mrp`)

1. **Database Objects (`dbscripts/` & `backend/src/database/schema/core.schema.ts`):**
   * Tables:
     * `tbl_mfg_mrp_run_header` (`mrp_run_id` BIGINT PK backed by `seq_mrp_run_id`, `mrp_run_no` VARCHAR(50) NOT NULL, `run_date` TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, `planning_horizon_days` INT NOT NULL DEFAULT 30, `demand_source` VARCHAR(30) NOT NULL DEFAULT `'BUFFER_DEFICIT'` CHECK IN (`'ALL'`, `'BUFFER_DEFICIT'`, `'SALES_ORDERS'`, `'MANUAL_FORECAST'`), `status` VARCHAR(25) NOT NULL DEFAULT `'COMPLETED'` CHECK IN (`'DRAFT'`, `'RUNNING'`, `'COMPLETED'`, `'RELEASED'`, `'CANCELLED'`), `total_items_analyzed` INT NOT NULL DEFAULT 0, `total_planned_orders` INT NOT NULL DEFAULT 0, `total_planned_buy_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `total_planned_make_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `total_estimated_spend` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `execution_time_ms` INT DEFAULT 0, `run_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `remarks` VARCHAR(350), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns, UNIQUE `(comp_id, branch_id, mrp_run_no)`).
     * `tbl_mfg_mrp_planned_order` (`planned_order_id` BIGINT PK backed by `seq_mrp_planned_order_id`, `mrp_run_id` BIGINT NOT NULL REFERENCES `tbl_mfg_mrp_run_header(mrp_run_id)` ON DELETE CASCADE, `planned_order_no` VARCHAR(50) NOT NULL, `item_id` BIGINT NOT NULL REFERENCES `tbl_inv_item(item_id)`, `bom_id` BIGINT REFERENCES `tbl_mfg_bom_header(bom_id)`, `routing_id` BIGINT REFERENCES `tbl_mfg_routing_header(routing_id)`, `order_type` VARCHAR(25) NOT NULL DEFAULT `'BUY'` CHECK IN (`'MAKE'`, `'BUY'`, `'SUBCONTRACT'`), `source_demand_type` VARCHAR(35) NOT NULL DEFAULT `'BUFFER_DEFICIT'` CHECK IN (`'BUFFER_DEFICIT'`, `'PARENT_BOM_EXPLOSION'`, `'SALES_ORDER'`, `'MANUAL_FORECAST'`), `parent_planned_order_id` BIGINT REFERENCES `tbl_mfg_mrp_planned_order(planned_order_id)` ON DELETE SET NULL, `bom_level` INT NOT NULL DEFAULT 0, `gross_requirement_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `on_hand_stock_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `scheduled_receipts_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `safety_stock_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `net_requirement_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `planned_order_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `uom_id` BIGINT NOT NULL REFERENCES `tbl_inv_uom(uom_id)`, `lead_time_days` INT NOT NULL DEFAULT 1, `required_by_date` DATE NOT NULL, `order_release_date` DATE NOT NULL, `estimated_unit_cost` NUMERIC(14,4) NOT NULL DEFAULT 0.0000, `estimated_total_cost` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `status` VARCHAR(25) NOT NULL DEFAULT `'SUGGESTED'` CHECK IN (`'SUGGESTED'`, `'CONFIRMED'`, `'CONVERTED_TO_PR'`, `'CONVERTED_TO_WO'`, `'CANCELLED'`), `converted_pr_id` BIGINT REFERENCES `tbl_pr_header(pr_id)`, `converted_wo_id` BIGINT, `remarks` VARCHAR(350), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns).
   * Sequences: `seq_mrp_run_id`, `seq_mrp_planned_order_id` (starting at 1001).
   * Indexes: `idx_mfg_mrp_run_comp_branch`, `idx_mfg_mrp_run_date`, `idx_mfg_mrp_run_status`, `idx_mfg_mrp_plan_run`, `idx_mfg_mrp_plan_item`, `idx_mfg_mrp_plan_dates`, `idx_mfg_mrp_plan_type`.
   * Triggers: `trg_mfg_mrp_run_header_updated_date` and `trg_mfg_mrp_planned_order_updated_date` calling `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered screen `1027` (`MFG_MRP`) with actions `1081` (`RUN_MRP`), `1082` (`EXPORT`), `1083` (`PRINT`), and `1084` (`CONVERT`). Role permissions assigned for `SUPER_ADMIN`, `PLANT_MANAGER`, `STORE_MGR`, and `PUR_EXEC`.
     * `03_sample_demo_data.sql`: 2 MRP execution runs (`MRP-AHM-2627-0001`, `MRP-AHM-2627-0002`), 11 planned orders spanning Level 0 finished assemblies (`FG-GATE-VALVE-50`, `FG-AUTO-MNT-DRV`), Level 1 sub-assemblies (`WIP-VLV-BODY-MACH`, `WIP-AUTO-STAMP-SHL`), and Level 2 raw materials/tooling (`RM-SS316-ROUND-50`, `RM-CR-COIL-1.2MM`, `RM-ALUM-LM24-ING`, turning inserts, cutting fluid).
2. **Backend Architecture & API Contracts (`backend/src/modules/manufacturing/mrp/`):**
   * Controller: `MrpController` mapped to `/api/v1/manufacturing/mrp`.
   * Endpoints:
     * `GET /manufacturing/mrp/summary` (`@RequirePermission('MFG_MRP', 'VIEW')`) — returns KPI metrics (`totalRuns`, `totalPlannedOrders`, `totalPlannedBuySpend`, `totalPlannedMakeOrders`, `criticalPastDueCount`).
     * `GET /manufacturing/mrp/lookups` (`@RequirePermission('MFG_MRP', 'VIEW')`) — returns items, warehouses, departments, and vendors for filter and conversion workflows.
     * `GET /manufacturing/mrp/runs` (`@RequirePermission('MFG_MRP', 'VIEW')`) — paginated listing of MRP runs with execution time, order counts, and spend totals.
     * `GET /manufacturing/mrp/runs/:id` (`@RequirePermission('MFG_MRP', 'VIEW')`) — single MRP run with all child planned orders ordered by `bom_level ASC` and `required_by_date ASC`.
     * `GET /manufacturing/mrp/planned-orders` (`@RequirePermission('MFG_MRP', 'VIEW')`) — comprehensive paginated planned orders register with filtering by `mrpRunId`, `orderType`, `status`, `bomLevel`, `isPastDue`, and full-text search.
     * `POST /manufacturing/mrp/run` (`@RequirePermission('MFG_MRP', 'RUN_MRP')`) — executes the Gross-to-Net MRP engine across on-hand inventory, open PO receipts, and multi-level BOM explosions.
     * `POST /manufacturing/mrp/convert-to-pr` (`@RequirePermission('MFG_MRP', 'CONVERT')`) — 1-click batch conversion of planned `BUY` orders into an official Purchase Requisition (`tbl_pr_header` and `tbl_pr_item`).
     * `PUT /manufacturing/mrp/planned-orders/:id/status` (`@RequirePermission('MFG_MRP', 'RUN_MRP')`) — updates planned order status (`SUGGESTED` $\leftrightarrow$ `CONFIRMED` $\leftrightarrow$ `CANCELLED`).
     * `DELETE /manufacturing/mrp/runs/:id` (`@RequirePermission('MFG_MRP', 'RUN_MRP')`) — cascade deletion of unreleased MRP runs and associated planned orders with referential protection against converted orders.
3. **Domain Logic & Algorithms:**
   * **Gross-to-Net Balance Engine:**
     $$\text{Target Buffer} = \begin{cases} \text{reorder\_point} & \text{if } \text{reorder\_point} > 0 \\ \text{safety\_stock} & \text{if } \text{safety\_stock} > 0 \\ \text{min\_stock\_level} & \text{otherwise} \end{cases}$$
     $$\text{Deficit} = \max\left(0, \text{Target Buffer} - (\text{On-Hand Stock} + \text{Scheduled PO Receipts})\right)$$
     $$\text{Net Requirement} = \text{Deficit} + \text{Safety Stock}$$
   * **Multi-Level BOM Recursive Explosion:**
     $$\text{Component Gross Requirement} = \text{Parent Planned Qty} \times \left(\frac{\text{Component Gross Quantity}}{\text{BOM Batch Size}}\right)$$
   * **Backward Scheduling & Lead Time Offset:**
     $$\text{Order Release Date} = \text{Required By Date} - \text{Lead Time Days}$$
     $$\text{Past-Due Condition}: \text{Order Release Date} < \text{CURRENT\_DATE}$$
4. **Frontend Architecture (`frontend/src/pages/manufacturing/MrpMasterPage.tsx`):**
   * Accessible at route `/manufacturing/mrp` under `MANUFACTURING & PRODUCTION` with `'Live'` badge.
   * Built with `<PermissionGate screen="MFG_MRP">` and `<ConfirmDeleteModal>`.
   * 4 KPI cards (`MRP Engine Executions`, `Total Planned Orders`, `Planned BUY Spend`, `Past-Due Expedite Alerts`).
   * 3 View Tabs:
     * **Planned Orders Register:** Full interactive table with order selection checkboxes, BOM level pills (`L0`, `L1`, `L2`), Gross-to-Net quantities, lead times, release dates, past-due alerts, status badges, and inline actions.
     * **MRP Execution Runs:** Historical execution audit table showing duration, counts, spend, and triggering operator.
     * **Multi-Level BOM Hierarchy:** Visual hierarchical tree mapping Level 0 assemblies down to child sub-assemblies and purchased materials.
   * Modals:
     * **Run MRP Modal (`RUN_MRP`):** Horizon selector (15/30/60/90 days), demand source radio group, safety stock buffer toggle, and justification notes.
     * **Convert to PR Modal (`CONVERT`):** Selected items breakdown, delivery warehouse, department, required delivery date, and priority.
     * **Order Calculation Drill-down Modal (`Eye`):** Formula breakdown and backward scheduling timeline.
     * **Printable Schedule Modal (`PRINT`):** Formatted printable schedule with corporate manufacturing layout.


### 2.29 Step 6.5 — Production Work Orders (WO), Scheduling, BOM Snapshot & Operation Routing Release (`/manufacturing/work-orders`)

1. **Database Objects (`dbscripts/` & `backend/src/database/schema/core.schema.ts`):**
   * Tables:
     * `tbl_mfg_wo_header` (`wo_id` BIGINT PK backed by `seq_wo_id`, `wo_no` VARCHAR(50) NOT NULL, `wo_date` DATE NOT NULL DEFAULT CURRENT_DATE, `item_id` BIGINT NOT NULL REFERENCES `tbl_inv_item(item_id)`, `bom_id` BIGINT REFERENCES `tbl_mfg_bom_header(bom_id)`, `routing_id` BIGINT REFERENCES `tbl_mfg_routing_header(routing_id)`, `target_warehouse_id` BIGINT NOT NULL REFERENCES `tbl_inv_warehouse(warehouse_id)`, `wip_warehouse_id` BIGINT REFERENCES `tbl_inv_warehouse(warehouse_id)`, `planned_qty` NUMERIC(14,3) NOT NULL, `completed_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `scrapped_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `uom_id` BIGINT NOT NULL REFERENCES `tbl_inv_uom(uom_id)`, `scheduled_start_date` DATE NOT NULL, `scheduled_end_date` DATE NOT NULL, `actual_start_date` TIMESTAMPTZ, `actual_end_date` TIMESTAMPTZ, `priority` VARCHAR(25) NOT NULL DEFAULT `'MEDIUM'` CHECK IN (`'LOW'`, `'MEDIUM'`, `'HIGH'`, `'CRITICAL_URGENT'`), `status` VARCHAR(25) NOT NULL DEFAULT `'DRAFT'` CHECK IN (`'DRAFT'`, `'RELEASED'`, `'IN_PROGRESS'`, `'COMPLETED'`, `'CLOSED'`, `'CANCELLED'`), `sales_order_id` BIGINT, `mrp_planned_order_id` BIGINT REFERENCES `tbl_mfg_mrp_planned_order(planned_order_id)` ON DELETE SET NULL, `batch_no` VARCHAR(60), `estimated_material_cost` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `estimated_operation_cost` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `estimated_total_cost` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `actual_material_cost` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `actual_operation_cost` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `actual_total_cost` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `released_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `released_date` TIMESTAMPTZ, `remarks` VARCHAR(400), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns, UNIQUE `(comp_id, branch_id, wo_no)`).
     * `tbl_mfg_wo_bom_item` (`wo_bom_item_id` BIGINT PK backed by `seq_wo_bom_item_id`, `wo_id` BIGINT NOT NULL REFERENCES `tbl_mfg_wo_header(wo_id)` ON DELETE CASCADE, `item_id` BIGINT NOT NULL REFERENCES `tbl_inv_item(item_id)`, `item_description` VARCHAR(255), `uom_id` BIGINT NOT NULL REFERENCES `tbl_inv_uom(uom_id)`, `standard_qty_per_unit` NUMERIC(14,4) NOT NULL DEFAULT 1.0000, `scrap_factor_percent` NUMERIC(5,2) NOT NULL DEFAULT 0.00, `required_qty` NUMERIC(14,3) NOT NULL, `issued_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `consumed_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `unit_cost` NUMERIC(14,4) NOT NULL DEFAULT 0.0000, `estimated_cost` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `actual_cost` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `source_type` VARCHAR(25) NOT NULL DEFAULT `'PURCHASED'` CHECK IN (`'PURCHASED'`, `'MANUFACTURED'`, `'SUBCONTRACT'`), `operation_seq` INT, `is_critical` BOOLEAN NOT NULL DEFAULT FALSE, `remarks` VARCHAR(255), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns).
     * `tbl_mfg_wo_routing_op` (`wo_routing_op_id` BIGINT PK backed by `seq_wo_routing_op_id`, `wo_id` BIGINT NOT NULL REFERENCES `tbl_mfg_wo_header(wo_id)` ON DELETE CASCADE, `op_sequence` INT NOT NULL, `op_code` VARCHAR(50) NOT NULL, `op_name` VARCHAR(150) NOT NULL, `work_center_id` BIGINT NOT NULL REFERENCES `tbl_mfg_work_center(work_center_id)`, `machine_id` BIGINT REFERENCES `tbl_mfg_machine(machine_id)`, `planned_setup_time_mins` NUMERIC(8,2) NOT NULL DEFAULT 0.00, `planned_run_time_mins` NUMERIC(8,2) NOT NULL DEFAULT 0.00, `actual_setup_time_mins` NUMERIC(8,2) NOT NULL DEFAULT 0.00, `actual_run_time_mins` NUMERIC(8,2) NOT NULL DEFAULT 0.00, `planned_cost` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `actual_cost` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `planned_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `completed_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `scrapped_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `status` VARCHAR(25) NOT NULL DEFAULT `'PENDING'` CHECK IN (`'PENDING'`, `'IN_PROGRESS'`, `'COMPLETED'`, `'SKIPPED'`), `scheduled_start_date` DATE, `scheduled_end_date` DATE, `is_inspection_required` BOOLEAN NOT NULL DEFAULT FALSE, `is_subcontracted` BOOLEAN NOT NULL DEFAULT FALSE, `subcontract_vendor_id` BIGINT REFERENCES `tbl_party_master(party_id)`, `remarks` VARCHAR(255), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns).
   * Sequences: `seq_wo_id`, `seq_wo_bom_item_id`, `seq_wo_routing_op_id` (starting at 1001).
   * Indexes: `idx_mfg_wo_comp_branch`, `idx_mfg_wo_item`, `idx_mfg_wo_status`, `idx_mfg_wo_dates`, `idx_mfg_wo_mrp_order`, `idx_mfg_wo_bom_wo_id`, `idx_mfg_wo_bom_item`, `idx_mfg_wo_routing_wo_id`, `idx_mfg_wo_routing_wc`.
   * Triggers: `trg_mfg_wo_header_updated_date`, `trg_mfg_wo_bom_item_updated_date`, and `trg_mfg_wo_routing_op_updated_date` calling `fn_set_updated_timestamp()`.
   * Seeds:
     * `02_initial_data.sql`: Registered Screen `1028` (`MFG_WORK_ORDER`) with actions `1085` (`EXPORT`), `1086` (`PRINT`), `1087` (`RELEASE`), and `1088` (`CLOSE`). Granular role permissions assigned to `SUPER_ADMIN`, `PLANT_MANAGER`, and `STORE_MGR`.
     * `03_sample_demo_data.sql`: 3 realistic Work Orders (`WO-AHM-2627-0001` in `IN_PROGRESS`, `WO-AHM-2627-0002` in `RELEASED`, `WO-AHM-2627-0003` in `DRAFT`), 8 frozen BOM component items, and 11 routing operations.
2. **Backend Architecture & API Contracts (`backend/src/modules/manufacturing/work-order/`):**
   * Controller: `WorkOrderController` mapped to `/api/v1/manufacturing/work-orders`.
   * Endpoints:
     * `GET /manufacturing/work-orders/summary` (`@RequirePermission('MFG_WORK_ORDER', 'VIEW')`) — returns KPI summary (`totalWorkOrders`, `activeJobs`, `completedQtyTotal`, `overdueCount`, `totalEstimatedCost`).
     * `GET /manufacturing/work-orders/lookups` (`@RequirePermission('MFG_WORK_ORDER', 'VIEW')`) — returns items, active BOMs, active Routings, Warehouses, and open MRP Make orders.
     * `GET /manufacturing/work-orders` (`@RequirePermission('MFG_WORK_ORDER', 'VIEW')`) — paginated listing with filtering by `status`, `priority`, `targetWarehouseId`, `isOverdue`, and search.
     * `GET /manufacturing/work-orders/:id` (`@RequirePermission('MFG_WORK_ORDER', 'VIEW')`) — single work order with fully populated child BOM snapshot (`bomItems`) and routing operations (`routingOps`).
     * `POST /manufacturing/work-orders` (`@RequirePermission('MFG_WORK_ORDER', 'ADD')`) — creates Work Order with automatic BOM & Routing snapshotting within an ACID transaction.
     * `PUT /manufacturing/work-orders/:id` (`@RequirePermission('MFG_WORK_ORDER', 'EDIT')`) — updates draft Work Order parameters and recalculates required material/operation allocations.
     * `DELETE /manufacturing/work-orders/:id` (`@RequirePermission('MFG_WORK_ORDER', 'DELETE')`) — deletes draft or cancelled work order and its frozen snapshot rows.
     * `POST /manufacturing/work-orders/:id/release` (`@RequirePermission('MFG_WORK_ORDER', 'RELEASE')`) — executes shopfloor dispatch transition (`DRAFT` $\rightarrow$ `RELEASED`) and stamps release authority.
     * `POST /manufacturing/work-orders/:id/close` (`@RequirePermission('MFG_WORK_ORDER', 'CLOSE')`) — executes production closure transition (`COMPLETED` / `CLOSED`), recording finished good and scrap quantities.
     * `POST /manufacturing/work-orders/convert-mrp` (`@RequirePermission('MFG_WORK_ORDER', 'ADD')`) — converts an open MRP Make order into a formal Work Order, setting `converted_wo_id`.
3. **Domain Snapshot & Calculation Engine:**
   * **BOM Material Freezing:**
     $$\text{Required Qty} = \text{Planned Batch Qty} \times \left(\frac{\text{Gross Component Qty}}{\text{BOM Batch Size}}\right)$$
     $$\text{Estimated Cost} = \text{Required Qty} \times \text{Unit Cost}$$
   * **Routing Operation Freezing:**
     $$\text{Planned Run Time} = \text{Planned Batch Qty} \times \text{Run Time Mins per Unit}$$
     $$\text{Planned Operation Cost} = \text{Planned Batch Qty} \times \text{Total Cost per Unit}$$
   * **Total Work Order Cost Rollup:**
     $$\text{Estimated Total Cost} = \sum \text{Estimated Cost}_{\text{BOM}} + \sum \text{Planned Cost}_{\text{Routing}}$$
4. **Frontend Architecture (`frontend/src/pages/manufacturing/WorkOrderMasterPage.tsx`):**
   * Accessible at route `/manufacturing/work-orders` under `MANUFACTURING & PRODUCTION` with `'Live'` badge.
   * Built with `<MasterDataTable>`, `<PermissionGate screen="MFG_WORK_ORDER">`, and `<ConfirmDeleteModal>`.
   * 4 KPI summary cards (`Total Work Orders`, `Active Shopfloor Jobs`, `Total Output Delivered`, `Overdue Alerts`).
   * Filter controls (`status`, `priority`, `targetWarehouseId`, `isOverdue`, search).
   * Visual planned vs completed progress bar with scrap indicators and overdue badges.
   * Modals & Drawers:
     * **Work Order Details Drawer (`Eye`):** 3-tab slideout view displaying frozen BOM component lines (required, issued, consumed), sequential routing operations with work centers and status, and timeline & cost variances.
     * **Create / Edit Modal (3 Tabs):** Tab 1 Order Specifications, Tab 2 Live BOM snapshot preview, Tab 3 Live Routing workflow preview.
     * **1-Click Convert MRP Make Order Modal:** Direct order generation from open MRP planning records.
     * **Release Modal (`RELEASE`):** Dispatches job to production lines with shift notes.
     * **Complete & Close Modal (`CLOSE`):** Captures good units, scrap units, and computes yield efficiency.
     * **Printable Job Card / Route Traveler Sheet (`PRINT`):** Formatted route traveler with barcode simulation, picking verifications, and multi-department sign-offs.


### 2.30 Step 6.6 — Shopfloor Material Issue, Lineside Staging & Backflushing (`/manufacturing/material-issues`)

1. **Database Objects (`dbscripts/` & `backend/src/database/schema/core.schema.ts`):**
   * Tables:
     * `tbl_mfg_material_issue_header` (`issue_id` BIGINT PK backed by `seq_material_issue_id`, `issue_no` VARCHAR(50) NOT NULL, `issue_date` DATE NOT NULL DEFAULT CURRENT_DATE, `wo_id` BIGINT NOT NULL REFERENCES `tbl_mfg_wo_header(wo_id)`, `issue_type` VARCHAR(30) NOT NULL DEFAULT `'STANDARD_ISSUE'` CHECK IN (`'STANDARD_ISSUE'`, `'RETURN_TO_STORE'`, `'SCRAP_ADJUSTMENT'`, `'LINESIDE_TRANSFER'`), `from_warehouse_id` BIGINT NOT NULL REFERENCES `tbl_inv_warehouse(warehouse_id)`, `to_warehouse_id` BIGINT REFERENCES `tbl_inv_warehouse(warehouse_id)`, `status` VARCHAR(25) NOT NULL DEFAULT `'DRAFT'` CHECK IN (`'DRAFT'`, `'SUBMITTED'`, `'POSTED'`, `'CANCELLED'`), `total_items` INT NOT NULL DEFAULT 0, `total_quantity` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `total_cost` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `issued_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `received_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `remarks` VARCHAR(350), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns, UNIQUE `(comp_id, branch_id, issue_no)`).
     * `tbl_mfg_material_issue_item` (`issue_item_id` BIGINT PK backed by `seq_material_issue_item_id`, `issue_id` BIGINT NOT NULL REFERENCES `tbl_mfg_material_issue_header(issue_id)` ON DELETE CASCADE, `wo_bom_item_id` BIGINT REFERENCES `tbl_mfg_wo_bom_item(wo_bom_item_id)`, `item_id` BIGINT NOT NULL REFERENCES `tbl_inv_item(item_id)`, `uom_id` BIGINT NOT NULL REFERENCES `tbl_inv_uom(uom_id)`, `required_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `previously_issued_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `issue_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `unit_cost` NUMERIC(14,4) NOT NULL DEFAULT 0.0000, `total_cost` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `batch_no` VARCHAR(60), `heat_no` VARCHAR(60), `bin_location` VARCHAR(60), `remarks` VARCHAR(255), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns).
   * Sequences: `seq_material_issue_id`, `seq_material_issue_item_id` (starting at 1001).
   * Indexes: `idx_mfg_mat_issue_comp_branch`, `idx_mfg_mat_issue_wo`, `idx_mfg_mat_issue_status`, `idx_mfg_mat_issue_dates`, `idx_mfg_mat_issue_wh`, `idx_mfg_mat_issue_item_issue`, `idx_mfg_mat_issue_item_item`.
   * Triggers: `trg_mfg_material_issue_header_updated_date` and `trg_mfg_material_issue_item_updated_date` executing `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered Screen `1029` (`MFG_MATERIAL_ISSUE`) with actions `1089` (`EXPORT`), `1090` (`PRINT`), `1091` (`SUBMIT`), and `1092` (`RETURN`). Granular role permissions assigned to `SUPER_ADMIN`, `PLANT_MANAGER`, and `STORE_MGR`.
     * `03_sample_demo_data.sql`: 2 realistic Material Issue vouchers (`MI-AHM-2627-0001` for WO 1001 in `POSTED` status, `MI-AHM-2627-0002` for WO 1002 in `DRAFT` status) and 5 component issue items with lot numbers and warehouse bin coordinates.
2. **Backend Architecture & API Contracts (`backend/src/modules/manufacturing/material-issue/`):**
   * Controller: `MaterialIssueController` mapped to `/api/v1/manufacturing/material-issues`.
   * Endpoints:
     * `GET /manufacturing/material-issues/summary` (`@RequirePermission('MFG_MATERIAL_ISSUE', 'VIEW')`) — returns KPI summary (`totalIssues`, `postedIssues`, `draftIssues`, `totalMaterialValue`, `activeWipOrders`, `pendingPickingOrders`).
     * `GET /manufacturing/material-issues/lookups` (`@RequirePermission('MFG_MATERIAL_ISSUE', 'VIEW')`) — returns active Work Orders (`RELEASED` / `IN_PROGRESS`), storage warehouses, catalog items, and personnel.
     * `GET /manufacturing/material-issues/wo-bom-items/:woId` (`@RequirePermission('MFG_MATERIAL_ISSUE', 'VIEW')`) — retrieves frozen BOM component items with required quantity, previously issued quantity, pending picking balance, and current on-hand store stock.
     * `GET /manufacturing/material-issues` (`@RequirePermission('MFG_MATERIAL_ISSUE', 'VIEW')`) — paginated listing with filtering by `status`, `issueType`, `fromWarehouseId`, `toWarehouseId`, `woId`, date range, and free-text search.
     * `GET /manufacturing/material-issues/:id` (`@RequirePermission('MFG_MATERIAL_ISSUE', 'VIEW')`) — retrieves single issue voucher with full header metadata and component line items.
     * `POST /manufacturing/material-issues` (`@RequirePermission('MFG_MATERIAL_ISSUE', 'ADD')`) — creates draft material issue voucher with automatic document sequence numbering (`MI-{BRANCH}-{FYEAR}-XXXX`).
     * `PUT /manufacturing/material-issues/:id` (`@RequirePermission('MFG_MATERIAL_ISSUE', 'EDIT')`) — updates draft issue slip parameters and line item quantities.
     * `DELETE /manufacturing/material-issues/:id` (`@RequirePermission('MFG_MATERIAL_ISSUE', 'DELETE')`) — deletes draft issue slips with dependency validation.
     * `POST /manufacturing/material-issues/:id/submit` (`@RequirePermission('MFG_MATERIAL_ISSUE', 'SUBMIT')`) — submits and posts issue slip:
       * Updates `tbl_mfg_wo_bom_item.issued_qty = issued_qty + issue_qty`.
       * If Work Order is in `RELEASED` status, auto-transitions status to `IN_PROGRESS` and sets `actual_start_date`.
       * Accumulates issued value into `tbl_mfg_wo_header.actual_material_cost`.
       * Inserts stock ledger movements into `tbl_inv_stock_ledger` (`transaction_type = 'ISSUE_TO_WIP'`).
       * Records immutable audit log in `tbl_sys_audit_log`.
     * `POST /manufacturing/material-issues/return-to-store` (`@RequirePermission('MFG_MATERIAL_ISSUE', 'RETURN')`) — handles unconsumed shopfloor material return:
       * Creates and immediately posts `RETURN_TO_STORE` issue voucher.
       * Decrements `tbl_mfg_wo_bom_item.issued_qty`.
       * Reverses cost on `tbl_mfg_wo_header.actual_material_cost`.
       * Inserts return stock ledger movements (`transaction_type = 'WIP_RETURN_TO_STORE'`).
       * Records audit log in `tbl_sys_audit_log`.
3. **Frontend Architecture (`frontend/src/pages/manufacturing/MaterialIssueMasterPage.tsx`):**
   * Accessible at route `/manufacturing/material-issues` under `MANUFACTURING & PRODUCTION` with `'Live'` badge.
   * Built with `<MasterDataTable>`, `<PermissionGate screen="MFG_MATERIAL_ISSUE">`, and `<ConfirmDeleteModal>`.
   * 4 KPI summary cards (`Total Issue Slips`, `Total Material Issued`, `Active WIP Orders`, `Pending Picking Allocations`).
   * Filter controls (`status`, `issueType`, `fromWarehouseId`, `woId`, search).
   * Modals & Drawers:
     * **Material Issue Details Drawer (`Eye`):** High-density slideout showing header details, linked Work Order snapshot, component lines table with lot numbers and bin coordinates, and audit timestamps.
     * **Create Material Issue Modal:** Select active Work Order, choose source store and lineside WIP warehouse, 1-Click **"1-Click Load BOM Items"** button pre-populating pending balances, custom line add/remove, and instant or draft saving.
     * **Submit & Post Confirmation Modal (`SUBMIT`):** Highlights stock ledger deductions, WO status transitions, and cost accumulations.
     * **Return to Store Modal (`RETURN`):** Shopfloor surplus return workflow with validation preventing returns in excess of issued quantities.
     * **Printable Material Issue Voucher (`PRINT`):** Formatted store requisition voucher with corporate header, barcode, items breakdown, and 3-tier signature blocks (Prepared By, Issued By, Received On Shopfloor).
