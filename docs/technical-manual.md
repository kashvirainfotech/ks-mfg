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

### 2.31 Step 6.7 — Stage-Wise Production Job Cards, Operation Time Logging & In-Process QC Inspection (`/manufacturing/job-cards`)

1. **Database Objects (`dbscripts/` & `backend/src/database/schema/core.schema.ts`):**
   * Tables:
     * `tbl_mfg_job_card` (`job_card_id` BIGINT PK backed by `seq_job_card_id`, `job_card_no` VARCHAR(50) NOT NULL, `wo_id` BIGINT NOT NULL REFERENCES `tbl_mfg_wo_header(wo_id)` ON DELETE CASCADE, `wo_routing_op_id` BIGINT REFERENCES `tbl_mfg_wo_routing_op(wo_routing_op_id)`, `op_sequence` INT NOT NULL, `operation_name` VARCHAR(150) NOT NULL, `work_center_id` BIGINT NOT NULL REFERENCES `tbl_mfg_work_center(work_center_id)`, `machine_id` BIGINT REFERENCES `tbl_mfg_work_center_machine(machine_id)`, `assigned_operator_id` BIGINT REFERENCES `tbl_sec_user(user_id)`, `planned_start_date` DATE, `planned_end_date` DATE, `actual_start_time` TIMESTAMP WITH TIME ZONE, `actual_end_time` TIMESTAMP WITH TIME ZONE, `input_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `completed_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `scrapped_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `rework_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `total_setup_time_mins` NUMERIC(10,2) NOT NULL DEFAULT 0.00, `total_run_time_mins` NUMERIC(10,2) NOT NULL DEFAULT 0.00, `total_downtime_mins` NUMERIC(10,2) NOT NULL DEFAULT 0.00, `actual_cost` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `status` VARCHAR(25) NOT NULL DEFAULT `'PENDING'` CHECK IN (`'PENDING'`, `'IN_PROGRESS'`, `'COMPLETED'`, `'CANCELLED'`), `is_inspection_required` BOOLEAN NOT NULL DEFAULT FALSE, `in_process_qc_status` VARCHAR(25) NOT NULL DEFAULT `'NA'` CHECK IN (`'NA'`, `'PENDING'`, `'ACCEPTED'`, `'REJECTED'`, `'DEVIATION_ACCEPTED'`), `qc_sample_size` NUMERIC(10,2), `qc_accepted_qty` NUMERIC(10,2), `qc_rejected_qty` NUMERIC(10,2), `qc_inspected_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `qc_inspected_at` TIMESTAMP WITH TIME ZONE, `qc_remarks` VARCHAR(350), `remarks` VARCHAR(350), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns, UNIQUE `(comp_id, branch_id, job_card_no)`).
     * `tbl_mfg_job_card_time_log` (`time_log_id` BIGINT PK backed by `seq_job_card_time_log_id`, `job_card_id` BIGINT NOT NULL REFERENCES `tbl_mfg_job_card(job_card_id)` ON DELETE CASCADE, `operator_id` BIGINT NOT NULL REFERENCES `tbl_sec_user(user_id)`, `shift_id` BIGINT REFERENCES `tbl_mfg_shift(shift_id)`, `log_date` DATE NOT NULL DEFAULT CURRENT_DATE, `start_time` TIMESTAMP WITH TIME ZONE, `end_time` TIMESTAMP WITH TIME ZONE, `setup_time_mins` NUMERIC(8,2) NOT NULL DEFAULT 0.00, `run_time_mins` NUMERIC(8,2) NOT NULL DEFAULT 0.00, `downtime_mins` NUMERIC(8,2) NOT NULL DEFAULT 0.00, `downtime_reason` VARCHAR(255), `completed_qty` NUMERIC(12,3) NOT NULL DEFAULT 0.000, `scrapped_qty` NUMERIC(12,3) NOT NULL DEFAULT 0.000, `rework_qty` NUMERIC(12,3) NOT NULL DEFAULT 0.000, `remarks` VARCHAR(255), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns).
   * Sequences: `seq_job_card_id`, `seq_job_card_time_log_id` (starting at 1001).
   * Indexes: `idx_mfg_job_card_comp_branch`, `idx_mfg_job_card_wo`, `idx_mfg_job_card_status`, `idx_mfg_job_card_wc`, `idx_mfg_job_card_qc`, `idx_mfg_jc_time_log_card`, `idx_mfg_jc_time_log_op`.
   * Triggers: `trg_mfg_job_card_updated_date` and `trg_mfg_job_card_time_log_updated_date` calling `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered Screen `1030` (`MFG_JOB_CARD`) with actions `1093` (`EXPORT`), `1094` (`PRINT`), `1095` (`START`), `1096` (`COMPLETE`), and `1097` (`APPROVE`). Granular role permissions assigned across `SUPER_ADMIN`, `PLANT_MANAGER`, `PRODUCTION_SUPERVISOR`, `OPERATOR`, `QUALITY_HEAD`, and `QC_INSPECTOR`.
     * `03_sample_demo_data.sql`: 6 realistic Job Cards (`JC-AHM-2627-0001` to `0006`) covering machining, heat treatment, and grinding stages, with sample operator time booking logs.
2. **Backend Architecture & API Contracts (`backend/src/modules/manufacturing/job-card/`):**
   * Controller: `JobCardController` mapped to `/api/v1/manufacturing/job-cards`.
   * Endpoints:
     * `GET /manufacturing/job-cards/summary` (`@RequirePermission('MFG_JOB_CARD', 'VIEW')`) — returns KPI summary (`totalJobCards`, `inProgressJobCards`, `pendingJobCards`, `completedJobCards`, `qcAcceptedCards`).
     * `GET /manufacturing/job-cards/lookups` (`@RequirePermission('MFG_JOB_CARD', 'VIEW')`) — returns active Work Orders, work centers, machinery assets, shifts, and shopfloor operators.
     * `GET /manufacturing/job-cards` (`@RequirePermission('MFG_JOB_CARD', 'VIEW')`) — paginated listing with filtering by `status`, `woId`, `workCenterId`, `inProcessQcStatus`, date range, and free-text search.
     * `GET /manufacturing/job-cards/:id` (`@RequirePermission('MFG_JOB_CARD', 'VIEW')`) — retrieves single Job Card with full header metadata and associated time logs.
     * `POST /manufacturing/job-cards` (`@RequirePermission('MFG_JOB_CARD', 'ADD')`) — creates standalone Job Card with sequence numbering (`JC-{BRANCH}-{FYEAR}-XXXX`).
     * `POST /manufacturing/job-cards/generate-from-wo/:woId` (`@RequirePermission('MFG_JOB_CARD', 'ADD')`) — 1-click batch generation of sequential Job Cards for all unassigned routing operations of an active Work Order.
     * `PUT /manufacturing/job-cards/:id` (`@RequirePermission('MFG_JOB_CARD', 'EDIT')`) — updates Job Card parameters (machine, operator, schedule, notes).
     * `DELETE /manufacturing/job-cards/:id` (`@RequirePermission('MFG_JOB_CARD', 'DELETE')`) — deletes pending Job Cards with dependency checking.
     * `POST /manufacturing/job-cards/:id/start` (`@RequirePermission('MFG_JOB_CARD', 'START')`) — clocks into operation, sets `actual_start_time`, updates status to `IN_PROGRESS`, and transitions Work Order to `IN_PROGRESS`.
     * `POST /manufacturing/job-cards/:id/time-log` (`@RequirePermission('MFG_JOB_CARD', 'EDIT')`) — logs operator shift time (setup/run/downtime), downtime reasons, and output pieces; recomputes absorbed cost.
     * `POST /manufacturing/job-cards/:id/qc-inspection` (`@RequirePermission('MFG_JOB_CARD', 'APPROVE')`) — records in-process QC sample size, accepted/rejected counts, and inspector decision (`ACCEPTED`, `REJECTED`, `DEVIATION_ACCEPTED`).
     * `POST /manufacturing/job-cards/:id/complete` (`@RequirePermission('MFG_JOB_CARD', 'COMPLETE')`) — validates mandatory QC clearance, sets `actual_end_time` and `COMPLETED` status, auto-transfers good quantity to the next stage's input queue, and when all operations finish, rolls up cumulative operation cost into `tbl_mfg_wo_header.actual_operation_cost`.
3. **Frontend Architecture (`frontend/src/pages/manufacturing/JobCardMasterPage.tsx`):**
   * Accessible at route `/manufacturing/job-cards` under `MANUFACTURING & PRODUCTION` with `'Live'` badge.
   * Built with `<MasterDataTable>`, `<PermissionGate screen="MFG_JOB_CARD">`, and `<ConfirmDeleteModal>`.
   * 4 KPI summary cards (`Total Job Cards`, `Active Shopfloor Jobs`, `Pending Clock-In`, `In-Process QC Clearance`).
   * Filter controls (`status`, `qcStatus`, `workCenterId`, `woId`, search).
   * Modals & Drawers:
     * **Job Card Details Drawer (`Eye`):** High-density slideout showing operation specs, machine asset, actual run/downtime breakdown, and granular shift time log table.
     * **1-Click Generate Job Cards from Work Order Modal:** Select active Work Order, preview unassigned routing operations, and batch create travelers.
     * **Manual Job Card Modal (Create/Edit):** Form for ad-hoc or reworked operations.
     * **Clock-In / Start Job Modal (`START`):** Shopfloor operator machine start confirmation.
     * **Log Time & Output Modal (`LOG_TIME`):** Records shift hours, downtime causes, good pieces, and scrap pieces.
     * **In-Process QC Clearance Modal (`APPROVE`):** QA inspection form capturing sample size, disposition, and inspector remarks.
     * **Complete Operation Modal (`COMPLETE`):** Final handover verification and stage completion.
     * **Printable Job Card Traveler (`PRINT`):** Formatted ISO/IATF shopfloor route traveler sheet with barcode, specifications, operation guidance, time log grid, and QC signoff stamps.

### 2.32 Step 6.8 — Subcontractor Job-Work Outward Delivery Challan, Inward Receipt & Material Reconciliation (`/manufacturing/job-work`)

1. **Database Objects (`dbscripts/` & `backend/src/database/schema/core.schema.ts`):**
   * Tables:
     * `tbl_mfg_job_work_challan` (`challan_id` BIGINT PK backed by `seq_job_work_challan_id`, `challan_no` VARCHAR(50) NOT NULL, `vendor_id` BIGINT NOT NULL REFERENCES `tbl_crm_party(party_id)`, `wo_id` BIGINT REFERENCES `tbl_mfg_wo_header(wo_id)`, `routing_op_id` BIGINT REFERENCES `tbl_mfg_wo_routing_op(wo_routing_op_id)`, `challan_date` DATE NOT NULL DEFAULT CURRENT_DATE, `nature_of_processing` VARCHAR(255) NOT NULL, `source_warehouse_id` BIGINT NOT NULL REFERENCES `tbl_inv_warehouse(warehouse_id)`, `transporter_name` VARCHAR(150), `vehicle_no` VARCHAR(50), `eway_bill_no` VARCHAR(50), `duration_days` INT NOT NULL DEFAULT 30, `expected_return_date` DATE, `status` VARCHAR(25) NOT NULL DEFAULT `'DRAFT'` CHECK IN (`'DRAFT'`, `'DISPATCHED'`, `'PARTIALLY_RECEIVED'`, `'RECEIVED'`, `'RECONCILED'`, `'CANCELLED'`), `dispatched_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `dispatched_at` TIMESTAMP WITH TIME ZONE, `reconciled_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `reconciled_at` TIMESTAMP WITH TIME ZONE, `total_sent_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `total_received_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `total_scrap_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `total_loss_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `total_challan_value` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `remarks` VARCHAR(350), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns, UNIQUE `(comp_id, branch_id, challan_no)`).
     * `tbl_mfg_job_work_challan_item` (`challan_item_id` BIGINT PK backed by `seq_job_work_challan_item_id`, `challan_id` BIGINT NOT NULL REFERENCES `tbl_mfg_job_work_challan(challan_id)` ON DELETE CASCADE, `item_id` BIGINT NOT NULL REFERENCES `tbl_inv_item(item_id)`, `hsn_code` VARCHAR(20), `batch_no` VARCHAR(50), `heat_no` VARCHAR(50), `uom_id` BIGINT NOT NULL REFERENCES `tbl_inv_uom(uom_id)`, `sent_qty` NUMERIC(14,3) NOT NULL, `valuation_rate` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `total_value` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `received_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `scrap_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `loss_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `pending_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `remarks` VARCHAR(255), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns).
     * `tbl_mfg_job_work_receipt` (`receipt_id` BIGINT PK backed by `seq_job_work_receipt_id`, `receipt_no` VARCHAR(50) NOT NULL, `challan_id` BIGINT NOT NULL REFERENCES `tbl_mfg_job_work_challan(challan_id)`, `vendor_id` BIGINT NOT NULL REFERENCES `tbl_crm_party(party_id)`, `receipt_date` DATE NOT NULL DEFAULT CURRENT_DATE, `vendor_dc_no` VARCHAR(50), `vendor_invoice_no` VARCHAR(50), `transporter_name` VARCHAR(150), `vehicle_no` VARCHAR(50), `eway_bill_no` VARCHAR(50), `destination_warehouse_id` BIGINT NOT NULL REFERENCES `tbl_inv_warehouse(warehouse_id)`, `total_received_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `total_scrap_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `processing_charges` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `gst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `total_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `qc_status` VARCHAR(25) NOT NULL DEFAULT `'PENDING'` CHECK IN (`'PENDING'`, `'ACCEPTED'`, `'REJECTED'`, `'DEVIATION_ACCEPTED'`), `qc_inspected_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `qc_inspected_at` TIMESTAMP WITH TIME ZONE, `remarks` VARCHAR(350), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns, UNIQUE `(comp_id, branch_id, receipt_no)`).
     * `tbl_mfg_job_work_receipt_item` (`receipt_item_id` BIGINT PK backed by `seq_job_work_receipt_item_id`, `receipt_id` BIGINT NOT NULL REFERENCES `tbl_mfg_job_work_receipt(receipt_id)` ON DELETE CASCADE, `challan_item_id` BIGINT NOT NULL REFERENCES `tbl_mfg_job_work_challan_item(challan_item_id)`, `item_id` BIGINT NOT NULL REFERENCES `tbl_inv_item(item_id)`, `batch_no` VARCHAR(50), `heat_no` VARCHAR(50), `uom_id` BIGINT NOT NULL REFERENCES `tbl_inv_uom(uom_id)`, `received_qty` NUMERIC(14,3) NOT NULL, `scrap_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `loss_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `service_rate` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `service_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `qc_status` VARCHAR(25) NOT NULL DEFAULT `'ACCEPTED'` CHECK IN (`'ACCEPTED'`, `'REJECTED'`, `'DEVIATION_ACCEPTED'`), `remarks` VARCHAR(255), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns).
   * Sequences: `seq_job_work_challan_id`, `seq_job_work_challan_item_id`, `seq_job_work_receipt_id`, `seq_job_work_receipt_item_id` (starting at 1001).
   * Indexes: `idx_mfg_jw_challan_comp_branch`, `idx_mfg_jw_challan_vendor`, `idx_mfg_jw_challan_wo`, `idx_mfg_jw_challan_status`, `idx_mfg_jw_citem_challan`, `idx_mfg_jw_citem_item`, `idx_mfg_jw_receipt_comp_branch`, `idx_mfg_jw_receipt_challan`, `idx_mfg_jw_receipt_vendor`, `idx_mfg_jw_ritem_receipt`.
   * Triggers: `trg_mfg_job_work_challan_updated_date`, `trg_mfg_job_work_challan_item_updated_date`, `trg_mfg_job_work_receipt_updated_date`, and `trg_mfg_job_work_receipt_item_updated_date` calling `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered Screen `1031` (`MFG_JOB_WORK`) with actions `1098` (`EXPORT`), `1099` (`PRINT`), `1100` (`DISPATCH`), `1101` (`RECEIVE`), and `1102` (`RECONCILE`). Permissions granted across `SUPER_ADMIN`, `PLANT_MANAGER`, `PRODUCTION_SUPERVISOR`, `QUALITY_HEAD`, `QC_INSPECTOR`, and `WAREHOUSE_OFFICER`.
     * `03_sample_demo_data.sql`: Outward challans (`JW-OUT-AHM-2627-0001` and `0002`) and inward receipt (`JW-IN-AHM-2627-0001`) with item lines.
2. **Backend Architecture & API Contracts (`backend/src/modules/manufacturing/job-work/`):**
   * Controller: `JobWorkController` mapped to `/api/v1/manufacturing/job-work`.
   * Endpoints:
     * `GET /manufacturing/job-work/summary` (`@RequirePermission('MFG_JOB_WORK', 'VIEW')`) — returns KPI summary (`totalChallans`, `dispatchedChallans`, `receivedChallans`, `reconciledChallans`).
     * `GET /manufacturing/job-work/lookups` (`@RequirePermission('MFG_JOB_WORK', 'VIEW')`) — returns vendors, items, UOMs, warehouses, active Work Orders, and routing operations.
     * `GET /manufacturing/job-work` (`@RequirePermission('MFG_JOB_WORK', 'VIEW')`) — paginated listing with filtering by `status`, `vendorId`, `woId`, date range, and free-text search.
     * `GET /manufacturing/job-work/:id` (`@RequirePermission('MFG_JOB_WORK', 'VIEW')`) — retrieves single challan with items and inward receipt vouchers.
     * `POST /manufacturing/job-work` (`@RequirePermission('MFG_JOB_WORK', 'ADD')`) — creates outward delivery challan with sequence numbering (`JW-OUT-{BRANCH}-{FYEAR}-XXXX`).
     * `PUT /manufacturing/job-work/:id` (`@RequirePermission('MFG_JOB_WORK', 'EDIT')`) — updates draft challan details.
     * `DELETE /manufacturing/job-work/:id` (`@RequirePermission('MFG_JOB_WORK', 'DELETE')`) — deletes draft challan with dependency validation.
     * `POST /manufacturing/job-work/:id/dispatch` (`@RequirePermission('MFG_JOB_WORK', 'DISPATCH')`) — issues materials from source warehouse via `PRODUCTION_ISSUE` in `tbl_inv_stock_ledger` and sets `DISPATCHED` status.
     * `POST /manufacturing/job-work/:id/receipt` (`@RequirePermission('MFG_JOB_WORK', 'RECEIVE')`) — records inward receipt (`JW-IN-{BRANCH}-{FYEAR}-XXXX`), captures QC disposition, credits warehouse inventory via `PUTAWAY_INWARD`, updates challan item returned balances, and accumulates machining service costs into parent Work Order headers (`tbl_mfg_wo_header.actual_operation_cost`).
     * `POST /manufacturing/job-work/:id/reconcile` (`@RequirePermission('MFG_JOB_WORK', 'RECONCILE')`) — audits sent inputs vs good output, scrap, and allowable losses, settles balances, and transitions status to `RECONCILED`.
3. **Frontend Architecture (`frontend/src/pages/manufacturing/JobWorkMasterPage.tsx`):**
   * Accessible at route `/manufacturing/job-work` under `MANUFACTURING & PRODUCTION` with `'Live'` badge.
   * Built with `<MasterDataTable>`, `<PermissionGate screen="MFG_JOB_WORK">`, and `<ConfirmDeleteModal>`.
   * 4 KPI summary cards (`Total Outward Challans`, `Active Subcontractor Jobs`, `Inward Receipts Recorded`, `Reconciled & Closed`).
   * Filter controls (`status`, `vendorId`, `woId`, search).
   * Modals & Drawers:
     * **Job-Work Details Drawer (`Eye`):** Multi-tab slideout displaying challan specifications, sent line items with progress bars, and historical inward receipts with QC status badges.
     * **New/Edit Outward Challan Modal:** Dynamic line item builder calculating line totals, GST valuation, and total challan valuation.
     * **Outward Dispatch Modal (`DISPATCH`):** Stores departure confirmation and inventory issue verification.
     * **Inward Goods Receipt Modal (`RECEIVE`):** Vendor DC/invoice capture, accepted vs scrap quantities, service charges, 18% GST calculation, and target putaway warehouse selection.
     * **Material Reconciliation Modal (`RECONCILE`):** Comprehensive balance sheet verifying zero outstanding quantities before closure.
     * **Statutory Indian GST Section 143 Delivery Challan (`PRINT`):** Standard Rule 55 printable layout with corporate headers, vendor consignee details, e-way bill, HSN breakdown, statutory non-sale declaration, and two-tier physical signoff blocks.

### 2.33 Step 6.9 — Finished Goods (FG) Production Receipt, Scrap/By-Product Accounting & Absorption Cost Rollup (`/manufacturing/fg-receipts`)

1. **Database Objects (`dbscripts/` & `backend/src/database/schema/core.schema.ts`):**
   * Tables:
     * `tbl_mfg_fg_receipt_header` (`fg_receipt_id` BIGINT PK backed by `seq_fg_receipt_id`, `receipt_no` VARCHAR(50) NOT NULL, `receipt_date` DATE NOT NULL DEFAULT CURRENT_DATE, `wo_id` BIGINT NOT NULL REFERENCES `tbl_mfg_wo_header(wo_id)`, `item_id` BIGINT NOT NULL REFERENCES `tbl_inv_item(item_id)`, `uom_id` BIGINT NOT NULL REFERENCES `tbl_inv_uom(uom_id)`, `to_warehouse_id` BIGINT NOT NULL REFERENCES `tbl_inv_warehouse(warehouse_id)`, `to_bin_id` BIGINT REFERENCES `tbl_inv_storage_bin(bin_id)`, `batch_no` VARCHAR(100), `heat_no` VARCHAR(100), `manufacturing_date` DATE NOT NULL DEFAULT CURRENT_DATE, `expiry_date` DATE, `received_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `accepted_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `rejected_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `rework_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `qc_status` VARCHAR(30) NOT NULL DEFAULT `'PENDING'` CHECK IN (`'PENDING'`, `'ACCEPTED'`, `'REJECTED'`, `'DEVIATION_ACCEPTED'`), `qc_inspected_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `qc_inspected_at` TIMESTAMPTZ, `qc_remarks` VARCHAR(350), `material_cost` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `operation_cost` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `byproduct_credit` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `total_cost` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `unit_cost` NUMERIC(14,4) NOT NULL DEFAULT 0.0000, `status` VARCHAR(25) NOT NULL DEFAULT `'DRAFT'` CHECK IN (`'DRAFT'`, `'POSTED'`, `'CANCELLED'`), `posted_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `posted_at` TIMESTAMPTZ, `remarks` VARCHAR(400), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns, UNIQUE `(comp_id, branch_id, receipt_no)`).
     * `tbl_mfg_fg_receipt_byproduct` (`receipt_byproduct_id` BIGINT PK backed by `seq_fg_receipt_byproduct_id`, `fg_receipt_id` BIGINT NOT NULL REFERENCES `tbl_mfg_fg_receipt_header(fg_receipt_id)` ON DELETE CASCADE, `item_id` BIGINT NOT NULL REFERENCES `tbl_inv_item(item_id)`, `uom_id` BIGINT NOT NULL REFERENCES `tbl_inv_uom(uom_id)`, `product_type` VARCHAR(30) NOT NULL DEFAULT `'RECOVERABLE_SCRAP'` CHECK IN (`'CO_PRODUCT'`, `'BY_PRODUCT'`, `'RECOVERABLE_SCRAP'`, `'HAZARDOUS_WASTE'`), `quantity` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `recovery_rate` NUMERIC(14,4) NOT NULL DEFAULT 0.0000, `total_recovery_value` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `to_warehouse_id` BIGINT NOT NULL REFERENCES `tbl_inv_warehouse(warehouse_id)`, `to_bin_id` BIGINT REFERENCES `tbl_inv_storage_bin(bin_id)`, `remarks` VARCHAR(250), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns).
   * Sequences: `seq_fg_receipt_id`, `seq_fg_receipt_byproduct_id` (starting at 1001).
   * Indexes: `idx_mfg_fgr_comp_branch`, `idx_mfg_fgr_wo`, `idx_mfg_fgr_item`, `idx_mfg_fgr_status`, `idx_mfg_fgr_date`, `idx_mfg_fgr_byproduct_fgr`, `idx_mfg_fgr_byproduct_item`.
   * Triggers: `trg_mfg_fg_receipt_header_updated_date` and `trg_mfg_fg_receipt_byproduct_updated_date` calling `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered Screen `1032` (`MFG_FG_RECEIPT`) with actions `1103` (`EXPORT`), `1104` (`PRINT`), and `1105` (`POST`). Granular role permissions assigned across `SUPER_ADMIN`, `PLANT_MANAGER`, `STORE_OFFICER`, `PURCHASE_EXEC`, and `SALES_EXEC`.
     * `03_sample_demo_data.sql`: FG Receipts `FGR-AHM-2627-0001` (`POSTED`) and `FGR-AHM-2627-0002` (`DRAFT`) with associated byproducts.
2. **Backend Architecture & API Contracts (`backend/src/modules/manufacturing/fg-receipt/`):**
   * Controller: `FgReceiptController` mapped to `/api/v1/manufacturing/fg-receipts`.
   * Endpoints:
     * `GET /manufacturing/fg-receipts/summary` (`@RequirePermission('MFG_FG_RECEIPT', 'VIEW')`) — returns KPI summary (`totalReceipts`, `postedReceipts`, `draftReceipts`, `totalAcceptedQty`, `totalAbsorbedCost`, `totalByproductCredit`).
     * `GET /manufacturing/fg-receipts/lookups` (`@RequirePermission('MFG_FG_RECEIPT', 'VIEW')`) — returns active Work Orders, warehouses, storage bins, items, and units of measure.
     * `GET /manufacturing/fg-receipts/wo-byproducts/:woId` (`@RequirePermission('MFG_FG_RECEIPT', 'VIEW')`) — suggests BOM co-products and recoverable scrap items scaled to the batch receipt quantity.
     * `GET /manufacturing/fg-receipts/wo-cost-estimate/:woId` (`@RequirePermission('MFG_FG_RECEIPT', 'VIEW')`) — calculates proportional actual material and operation absorption costs from Work Order actuals.
     * `GET /manufacturing/fg-receipts` (`@RequirePermission('MFG_FG_RECEIPT', 'VIEW')`) — paginated listing with filtering by `status`, `woId`, `itemId`, `warehouseId`, date range, and free-text search.
     * `GET /manufacturing/fg-receipts/:id` (`@RequirePermission('MFG_FG_RECEIPT', 'VIEW')`) — retrieves single receipt with full line items, byproducts, and parent Work Order details.
     * `POST /manufacturing/fg-receipts` (`@RequirePermission('MFG_FG_RECEIPT', 'ADD')`) — creates draft FG receipt with sequence numbering (`FGR-{BRANCH}-{FYEAR}-XXXX`).
     * `PUT /manufacturing/fg-receipts/:id` (`@RequirePermission('MFG_FG_RECEIPT', 'EDIT')`) — updates draft receipt parameters and by-product lines.
     * `DELETE /manufacturing/fg-receipts/:id` (`@RequirePermission('MFG_FG_RECEIPT', 'DELETE')`) — deletes draft receipt with cascade on by-products.
     * `POST /manufacturing/fg-receipts/:id/qc-inspection` (`@RequirePermission('MFG_FG_RECEIPT', 'APPROVE')`) — records QA decision (`ACCEPTED`, `DEVIATION_ACCEPTED`, `REJECTED`), accepted/rejected/rework quantities, and inspector stamp.
     * `POST /manufacturing/fg-receipts/:id/post` (`@RequirePermission('MFG_FG_RECEIPT', 'POST')`) — validates mandatory QC clearance, inserts Finished Goods into stock ledger (`PUTAWAY_INWARD`), updates bin stock (`tbl_inv_bin_stock`), posts byproducts into scrap warehouse ledgers, increments Work Order `completed_qty` and `scrapped_qty` (auto-completes WO when target is fulfilled), and sets `POSTED` status.
3. **Frontend Architecture (`frontend/src/pages/manufacturing/FgReceiptMasterPage.tsx`):**
   * Accessible at route `/manufacturing/fg-receipts` under `MANUFACTURING & PRODUCTION` with `'Live'` badge.
   * Built with `<MasterDataTable>`, `<PermissionGate screen="MFG_FG_RECEIPT">`, and `<ConfirmDeleteModal>`.
   * 4 KPI summary cards (`Total FG Receipts`, `Posted & In-Stock`, `Pending QC Clearance`, `Absorbed Production Cost`).
   * Filter controls (`status`, `woId`, `warehouseId`, search).
   * Modals & Drawers:
     * **FG Receipt Details Drawer (`Eye`):** Comprehensive slideout displaying lot traceability, output quantity breakdown, absorption costing table, and by-product line items.
     * **Create / Edit FG Receipt Modal:** Work Order auto-population, 1-click "Suggest from BOM" for co-products and scrap, 1-click absorption cost estimation from WO actuals, live yield %, net cost & unit cost calculation.
     * **QC Inspection Clearance Modal (`APPROVE`):** QA disposition modal capturing accepted, rejected, and rework quantities with inspection remarks.
     * **Post to Stock Modal (`POST`):** Confirmation dialog detailing WMS inventory debit/credit, bin stock updates, and Work Order status progression.
     * **Printable Production Inward Voucher (`PRINT`):** Formatted ISO 9001:2015 voucher with corporate header, lot/heat tracking, quantity breakdown, cost rollup, and 3-tier signature blocks (Supervisor, QC Inspector, Store Officer).


### 2.34 Step 7.1 — Customer Inquiry & Quotation / Proforma Invoice (`/sales/quotations`)

1. **Database Objects (`dbscripts/` & `backend/src/database/schema/core.schema.ts`):**
   * Tables:
     * `tbl_sales_quotation_header` (`quotation_id` BIGINT PK backed by `seq_quotation_id`, `quotation_no` VARCHAR(50) NOT NULL, `quotation_date` DATE NOT NULL DEFAULT CURRENT_DATE, `inquiry_ref_no` VARCHAR(80), `inquiry_date` DATE, `customer_id` BIGINT NOT NULL REFERENCES `tbl_crm_party(party_id)`, `customer_name` VARCHAR(150) NOT NULL, `contact_person` VARCHAR(100), `contact_email` VARCHAR(150), `contact_phone` VARCHAR(25), `billing_address_id` BIGINT REFERENCES `tbl_crm_party_address(address_id)`, `billing_address` TEXT, `shipping_address_id` BIGINT REFERENCES `tbl_crm_party_address(address_id)`, `shipping_address` TEXT, `shipping_state_code` VARCHAR(10) NOT NULL DEFAULT `'24'`, `shipping_state_name` VARCHAR(100) NOT NULL DEFAULT `'Gujarat'`, `customer_gstin` VARCHAR(20), `price_list_id` BIGINT REFERENCES `tbl_crm_price_list(price_list_id)`, `currency_code` VARCHAR(10) NOT NULL DEFAULT `'INR'`, `exchange_rate` NUMERIC(10,4) NOT NULL DEFAULT 1.0000, `valid_until` DATE NOT NULL, `delivery_lead_time_days` INTEGER NOT NULL DEFAULT 14, `payment_terms` VARCHAR(100) NOT NULL DEFAULT `'NET_30'`, `delivery_terms` VARCHAR(100) NOT NULL DEFAULT `'EX_WORKS'`, `subtotal_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `discount_percent` NUMERIC(5,2) NOT NULL DEFAULT 0.00, `discount_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `taxable_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `cgst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `sgst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `igst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `total_tax_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `freight_charges` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `packaging_charges` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `round_off` NUMERIC(8,2) NOT NULL DEFAULT 0.00, `grand_total` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `revision_no` INTEGER NOT NULL DEFAULT 0, `revision_date` DATE, `revision_reason` VARCHAR(255), `status` VARCHAR(25) NOT NULL DEFAULT `'DRAFT'` CHECK IN (`'DRAFT'`, `'SUBMITTED'`, `'SENT'`, `'ACCEPTED'`, `'REJECTED'`, `'EXPIRED'`, `'CONVERTED_TO_SO'`), `submitted_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `submitted_at` TIMESTAMPTZ, `sent_at` TIMESTAMPTZ, `accepted_at` TIMESTAMPTZ, `converted_to_so_id` BIGINT, `converted_at` TIMESTAMPTZ, `remarks` VARCHAR(500), `terms_and_conditions` TEXT, `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns, CONSTRAINT `uq_sales_quotation_no` UNIQUE `(comp_id, branch_id, quotation_no, revision_no)`).
     * `tbl_sales_quotation_item` (`quotation_item_id` BIGINT PK backed by `seq_quotation_item_id`, `quotation_id` BIGINT NOT NULL REFERENCES `tbl_sales_quotation_header(quotation_id)` ON DELETE CASCADE, `item_sequence` INTEGER NOT NULL DEFAULT 1, `item_id` BIGINT NOT NULL REFERENCES `tbl_inv_item(item_id)`, `item_code` VARCHAR(50) NOT NULL, `item_name` VARCHAR(150) NOT NULL, `description` VARCHAR(400), `hsn_sac_code` VARCHAR(20), `uom_id` BIGINT NOT NULL REFERENCES `tbl_inv_uom(uom_id)`, `quantity` NUMERIC(14,3) NOT NULL DEFAULT 1.000, `unit_rate` NUMERIC(14,4) NOT NULL DEFAULT 0.0000, `gross_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `discount_percent` NUMERIC(5,2) NOT NULL DEFAULT 0.00, `discount_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `taxable_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `gst_rate` NUMERIC(5,2) NOT NULL DEFAULT 18.00, `cgst_rate` NUMERIC(5,2) NOT NULL DEFAULT 0.00, `cgst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `sgst_rate` NUMERIC(5,2) NOT NULL DEFAULT 0.00, `sgst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `igst_rate` NUMERIC(5,2) NOT NULL DEFAULT 0.00, `igst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `total_tax_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `total_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `delivery_lead_time_days` INTEGER DEFAULT 14, `remarks` VARCHAR(250), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns).
   * Sequences: `seq_quotation_id`, `seq_quotation_item_id` (starting at 1001).
   * Indexes: `idx_sales_qt_comp_branch`, `idx_sales_qt_customer`, `idx_sales_qt_status`, `idx_sales_qt_date`, `idx_sales_qt_item_qt`, `idx_sales_qt_item_item`.
   * Triggers: `trg_sales_quotation_header_updated_date` and `trg_sales_quotation_item_updated_date` calling `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered Screen `1033` (`SALES_QUOTATION`) with actions `1106` (`EXPORT`), `1107` (`PRINT`), `1108` (`SEND`), and `1109` (`CONVERT_TO_SO`). Granular permissions assigned across `SUPER_ADMIN`, `PLANT_MANAGER`, `STORE_OFFICER`, `PURCHASE_EXEC`, and `SALES_EXEC`.
     * `03_sample_demo_data.sql`: Quotations `QT-AHM-2627-0001` (`SENT` to Maruti Suzuki with IGST 28%), `QT-AHM-2627-0002` (`ACCEPTED` by L&T Valve Division with CGST+SGST 18%), and `QT-AHM-2627-0003` (`DRAFT`).
2. **Backend Architecture & API Contracts (`backend/src/modules/sales/quotation/`):**
   * Controller: `QuotationController` mapped to `/api/v1/sales/quotations`.
   * Service: `QuotationService` injecting `DrizzleDb`, `DATABASE_POOL`, and `AuditLogService`.
   * Endpoints:
     * `GET /sales/quotations/summary` (`@RequirePermission('SALES_QUOTATION', 'VIEW')`) — returns KPI metrics (`totalQuotations`, `openPipelineCount`, `openPipelineValue`, `wonCount`, `wonValue`, `draftCount`, `draftValue`, `convertedCount`).
     * `GET /sales/quotations/lookups` (`@RequirePermission('SALES_QUOTATION', 'VIEW')`) — returns active customer masters, customer address matrices, sellable finished items, UOMs, price lists, and plant branch state code.
     * `GET /sales/quotations` (`@RequirePermission('SALES_QUOTATION', 'VIEW')`) — paginated listing with filtering by `status`, `customerId`, date range, and free-text search across quotation number, customer name, and inquiry reference.
     * `GET /sales/quotations/:id` (`@RequirePermission('SALES_QUOTATION', 'VIEW')`) — retrieves single quotation with full line items, customer PAN/GSTIN, and audit log stamps.
     * `POST /sales/quotations` (`@RequirePermission('SALES_QUOTATION', 'ADD')`) — creates quotation with automatic sequential numbering (`QT-AHM-2627-XXXX`), dynamic GST calculation based on customer state vs plant branch state, header financial rollup, and audit logging.
     * `PUT /sales/quotations/:id` (`@RequirePermission('SALES_QUOTATION', 'EDIT')`) — updates draft or submitted quotation parameters and line items.
     * `POST /sales/quotations/:id/revise` (`@RequirePermission('SALES_QUOTATION', 'EDIT')`) — increments `revision_no`, records `revision_reason` and `revision_date`, resets status to `DRAFT`, and logs audit delta.
     * `PATCH /sales/quotations/:id/status` (`@RequirePermission('SALES_QUOTATION', 'EDIT')`) — executes lifecycle transitions (`DRAFT` $\rightarrow$ `SUBMITTED` $\rightarrow$ `SENT` $\rightarrow$ `ACCEPTED` / `REJECTED` / `EXPIRED`).
     * `POST /sales/quotations/:id/send` (`@RequirePermission('SALES_QUOTATION', 'SEND')`) — marks quotation as officially dispatched to customer contact, logging `sent_at` timestamp.
     * `POST /sales/quotations/:id/convert-to-so` (`@RequirePermission('SALES_QUOTATION', 'CONVERT_TO_SO')`) — converts accepted quotation to Sales Order, transitions status to `CONVERTED_TO_SO`, assigns sales order preview reference (`SO-AHM-2627-XXXX`), and returns structured production-ready line items for Step 7.2.
     * `DELETE /sales/quotations/:id` (`@RequirePermission('SALES_QUOTATION', 'DELETE')`) — performs soft delete on uncommitted draft quotations.
3. **Frontend Architecture (`frontend/src/pages/sales/QuotationMasterPage.tsx`):**
   * Accessible at route `/sales/quotations` under `SALES & DISTRIBUTION` with `'Live'` badge.
   * Built with `<MasterDataTable>`, `<PermissionGate screen="SALES_QUOTATION">`, and `<ConfirmDeleteModal>`.
   * 4 KPI summary cards (`Total Quotations`, `Open Pipeline (Sent / Submitted)`, `Won / Accepted Value`, `Converted to Sales Order`).
   * Filter controls (`status`, `customerId`, search).
   * Modals & Drawers:
     * **Quotation Details Drawer (`Eye`):** Comprehensive slideout displaying customer contact specs, consignee addresses, line item schedule with HSN/GST rates, commercial summary box, and lifecycle action triggers.
     * **Create / Edit Quotation Modal:** Customer selector with auto-fill, billing and shipping address dropdowns, live GST state evaluation indicator, multi-line item builder with item catalog picker, discount %, live calculated tax breakdown, freight and packaging charges, and terms & conditions.
     * **Revise Quotation Modal (`Sparkles`):** Captures revision justification, updates pricing/discounts/validity, and bumps revision sequence number.
     * **Convert to Sales Order Modal (`ArrowRight`):** Commercial handoff modal capturing Customer PO Number and Date, executing atomic conversion to Sales Order status.
     * **Printable Proforma Invoice Modal (`PRINT`):** Standard statutory Indian GST proforma invoice layout with supplier CIN/GSTIN header, buyer/consignee tax declarations, schedule of goods, Indian GST statutory summary table, bank remittance details, and authorized signatory signature block with native `window.print()` trigger.


### 2.35 Step 7.2 — Sales Order (SO), Commercial Credit Check & Available-to-Promise (ATP) Stock Reservation (`/sales/orders`)

1. **Database Objects (`dbscripts/` & `backend/src/database/schema/core.schema.ts`):**
   * Tables:
     * `tbl_sales_order_header` (`so_id` BIGINT PK backed by `seq_sales_order_id`, `so_no` VARCHAR(50) NOT NULL, `so_date` DATE NOT NULL DEFAULT CURRENT_DATE, `quotation_id` BIGINT REFERENCES `tbl_sales_quotation_header(quotation_id)`, `customer_po_no` VARCHAR(80), `customer_po_date` DATE, `customer_id` BIGINT NOT NULL REFERENCES `tbl_crm_party(party_id)`, `customer_name` VARCHAR(150) NOT NULL, `contact_person` VARCHAR(100), `contact_email` VARCHAR(150), `contact_phone` VARCHAR(25), `billing_address_id` BIGINT REFERENCES `tbl_crm_party_address(address_id)`, `billing_address` TEXT, `shipping_address_id` BIGINT REFERENCES `tbl_crm_party_address(address_id)`, `shipping_address` TEXT, `shipping_state_code` VARCHAR(10) NOT NULL DEFAULT `'24'`, `shipping_state_name` VARCHAR(100) NOT NULL DEFAULT `'Gujarat'`, `customer_gstin` VARCHAR(20), `price_list_id` BIGINT REFERENCES `tbl_crm_price_list(price_list_id)`, `currency_code` VARCHAR(10) NOT NULL DEFAULT `'INR'`, `exchange_rate` NUMERIC(10,4) NOT NULL DEFAULT 1.0000, `payment_terms` VARCHAR(100) NOT NULL DEFAULT `'NET_30'`, `delivery_terms` VARCHAR(100) NOT NULL DEFAULT `'EX_WORKS'`, `promised_delivery_date` DATE NOT NULL, `subtotal_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `discount_percent` NUMERIC(5,2) NOT NULL DEFAULT 0.00, `discount_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `taxable_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `cgst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `sgst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `igst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `total_tax_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `freight_charges` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `packaging_charges` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `round_off` NUMERIC(8,2) NOT NULL DEFAULT 0.00, `grand_total` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `is_credit_limit_exceeded` BOOLEAN NOT NULL DEFAULT FALSE, `credit_limit_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `current_exposure_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `credit_override_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `credit_override_at` TIMESTAMPTZ, `credit_override_reason` VARCHAR(255), `status` VARCHAR(25) NOT NULL DEFAULT `'DRAFT'` CHECK IN (`'DRAFT'`, `'CONFIRMED'`, `'IN_PRODUCTION'`, `'READY_FOR_DISPATCH'`, `'PARTIALLY_DELIVERED'`, `'COMPLETED'`, `'ON_HOLD'`, `'CANCELLED'`), `atp_reservation_status` VARCHAR(25) NOT NULL DEFAULT `'PENDING'` CHECK IN (`'PENDING'`, `'PARTIAL'`, `'FULL'`, `'RELEASED'`), `confirmed_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `confirmed_at` TIMESTAMPTZ, `hold_reason` VARCHAR(255), `hold_at` TIMESTAMPTZ, `remarks` VARCHAR(500), `terms_and_conditions` TEXT, `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns, CONSTRAINT `uq_sales_order_no` UNIQUE `(comp_id, branch_id, so_no)`).
     * `tbl_sales_order_item` (`so_item_id` BIGINT PK backed by `seq_so_item_id`, `so_id` BIGINT NOT NULL REFERENCES `tbl_sales_order_header(so_id)` ON DELETE CASCADE, `item_sequence` INTEGER NOT NULL DEFAULT 1, `item_id` BIGINT NOT NULL REFERENCES `tbl_inv_item(item_id)`, `item_code` VARCHAR(50) NOT NULL, `item_name` VARCHAR(150) NOT NULL, `description` VARCHAR(400), `hsn_sac_code` VARCHAR(20), `uom_id` BIGINT NOT NULL REFERENCES `tbl_inv_uom(uom_id)`, `ordered_qty` NUMERIC(14,3) NOT NULL DEFAULT 1.000, `reserved_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `deficit_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `dispatched_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `unit_rate` NUMERIC(14,4) NOT NULL DEFAULT 0.0000, `gross_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `discount_percent` NUMERIC(5,2) NOT NULL DEFAULT 0.00, `discount_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `taxable_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `gst_rate` NUMERIC(5,2) NOT NULL DEFAULT 18.00, `cgst_rate` NUMERIC(5,2) NOT NULL DEFAULT 0.00, `cgst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `sgst_rate` NUMERIC(5,2) NOT NULL DEFAULT 0.00, `sgst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `igst_rate` NUMERIC(5,2) NOT NULL DEFAULT 0.00, `igst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `total_tax_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `total_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `promised_date` DATE, `work_order_id` BIGINT REFERENCES `tbl_mfg_wo_header(wo_id)`, `reservation_status` VARCHAR(20) NOT NULL DEFAULT `'PENDING'` CHECK IN (`'PENDING'`, `'PARTIAL'`, `'FULL'`, `'RELEASED'`), `remarks` VARCHAR(250), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns).
   * Sequences: `seq_sales_order_id`, `seq_so_item_id` (starting at 1001).
   * Indexes: `idx_sales_order_comp_branch`, `idx_sales_order_customer`, `idx_sales_order_status`, `idx_sales_order_atp_status`, `idx_sales_order_date`, `idx_sales_order_quotation`, `idx_sales_order_item_so`, `idx_sales_order_item_item`, `idx_sales_order_item_wo`.
   * Triggers: `trg_sales_order_header_updated_date` and `trg_sales_order_item_updated_date` calling `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered Screen `1034` (`SALES_ORDER`) with actions `1110` (`EXPORT`), `1111` (`PRINT`), `1112` (`CONFIRM`), `1113` (`CREATE_WO`), and `1114` (`HOLD`). Granular permissions assigned across `SUPER_ADMIN`, `PLANT_MANAGER`, `STORE_OFFICER`, `PURCHASE_EXEC`, and `SALES_EXEC`.
     * `03_sample_demo_data.sql`: Warehouse bin stock for Finished Goods (`tbl_inv_bin_stock`) seeded with 1008 SS-316 Gate Valves and 1009 Hydromounts. Sales orders seeded: `SO-AHM-2627-0001` (`CONFIRMED`, imported from QT 1001, `FULL` ATP reservation with 15 valves allocated from A-01-01), `SO-AHM-2627-0002` (`IN_PRODUCTION`, imported from QT 1002, `PARTIAL` ATP reservation with 20 hydromounts allocated and 30 hydromounts linked to production Work Order `WO-AHM-2627-0004`), and `SO-AHM-2627-0003` (`DRAFT`, direct customer spot order).
2. **Backend Architecture & API Contracts (`backend/src/modules/sales/order/`):**
   * Controller: `OrderController` mapped to `/api/v1/sales/orders`.
   * Service: `OrderService` injecting `DrizzleDb`, `DATABASE_POOL`, and `AuditLogService`.
   * Endpoints:
     * `GET /sales/orders/summary` (`@RequirePermission('SALES_ORDER', 'VIEW')`) — returns KPI metrics (`totalOrders`, `totalOrderValue`, `confirmedCount`, `confirmedValue`, `inProductionCount`, `readyForDispatchCount`, `readyForDispatchValue`, `onHoldCount`, `pendingStockCount`).
     * `GET /sales/orders/lookups` (`@RequirePermission('SALES_ORDER', 'VIEW')`) — returns active customer parties with master credit limits, customer addresses, accepted quotations ready for conversion, sellable finished goods items, UOMs, price lists, and plant branch state code.
     * `GET /sales/orders` (`@RequirePermission('SALES_ORDER', 'VIEW')`) — paginated listing with filtering by `status`, `atpStatus`, `customerId`, date range, and free-text search across order number, customer name, and customer PO reference.
     * `GET /sales/orders/:id` (`@RequirePermission('SALES_ORDER', 'VIEW')`) — retrieves single sales order with full line items, ATP reservation details, linked Work Orders, customer credit exposure analysis, and audit timestamps.
     * `POST /sales/orders` (`@RequirePermission('SALES_ORDER', 'ADD')`) — creates sales order with automatic sequential numbering (`SO-AHM-2627-XXXX`), dynamic GST calculation based on customer shipping state vs plant state, unbilled credit exposure evaluation (`is_credit_limit_exceeded`), and automatic `ON_HOLD` assignment if credit exposure is exceeded.
     * `PUT /sales/orders/:id` (`@RequirePermission('SALES_ORDER', 'EDIT')`) — updates draft or unconfirmed sales order attributes and line items.
     * `POST /sales/orders/:id/confirm` (`@RequirePermission('SALES_ORDER', 'CONFIRM')`) — confirms order, executes real-time FIFO ATP stock reservation engine against `tbl_inv_bin_stock`, assigns `reserved_qty` and `deficit_qty`, updates order ATP status (`FULL` vs `PARTIAL` vs `PENDING`), and transitions status to `READY_FOR_DISPATCH` or `CONFIRMED`.
     * `POST /sales/orders/:id/hold` (`@RequirePermission('SALES_ORDER', 'HOLD')`) — toggles administrative/credit hold status (`ON_HOLD` vs `CONFIRMED`), logging `hold_reason` and updating audit log.
     * `POST /sales/orders/:id/credit-override` (`@RequirePermission('SALES_ORDER', 'AUTHORIZE')`) — authorizes manager credit override for credit-flagged orders, clearing `ON_HOLD` and stamping `credit_override_by`, `credit_override_at`, and `credit_override_reason`.
     * `POST /sales/orders/:id/create-wo` (`@RequirePermission('SALES_ORDER', 'CREATE_WO')`) — generates 1-Click production Work Orders in `tbl_mfg_wo_header` for unreserved line item deficit quantities (`ordered_qty - reserved_qty > 0`), attaching active BOM header and routing operations, setting priority to `HIGH`, stamping `sales_order_id`, and updating order status to `IN_PRODUCTION`.
     * `POST /sales/orders/:id/reserve-stock` (`@RequirePermission('SALES_ORDER', 'CONFIRM')`) — executes ad-hoc or re-evaluation ATP reservation run on confirmed orders when new inventory is received.
     * `DELETE /sales/orders/:id` (`@RequirePermission('SALES_ORDER', 'DELETE')`) — cancels or deletes unfulfilled order, releasing all previously reserved inventory balances back to `available_qty` in `tbl_inv_bin_stock`.
3. **Frontend Architecture (`frontend/src/pages/sales/SalesOrderMasterPage.tsx`):**
   * Accessible at route `/sales/orders` under `SALES & DISTRIBUTION` with `ShoppingCart` icon and `'Live'` badge.
   * Built with `<MasterDataTable>`, `<PermissionGate screen="SALES_ORDER">`, and `<ConfirmDeleteModal>`.
   * 5 KPI summary cards (`Total Sales Orders`, `Active Execution Value`, `Pending Stock Allocation`, `Ready for Dispatch`, `Credit / Admin Hold`).
   * Filter controls (`status`, `atpStatus`, `customerId`, search).
   * Modals & Drawers:
     * **Order Details Drawer (`Eye`):** Full breakdown of customer commercial terms, consignee addresses, line item fulfillment schedule with ATP allocation progress bars, linked Work Order badges, credit exposure summary, and lifecycle triggers.
     * **Create / Edit Sales Order Modal:** Quotation 1-click import selector, customer picker with live credit limit and current exposure indicator, line item grid with HSN, unit rate, discount, calculated GST taxes, delivery date picker, and commercial terms.
     * **Confirm & ATP Reservation Modal (`CheckCircle`):** Real-time inventory availability preview showing on-hand warehouse bin balances, projected reserved vs deficit quantities, and execution trigger for automated FIFO reservation.
     * **Manager Credit Override Modal (`ShieldAlert`):** Managerial authorization modal displaying customer credit ceiling, current unbilled commitments, and new order exposure, capturing override justification.
     * **1-Click Work Order Generator Modal (`Wrench`):** Generates production Work Orders for deficit line item quantities, scheduling shop floor start/end dates, selecting standard BOMs, and linking directly to Phase 6 Manufacturing.
     * **Hold / Release Modal (`PauseCircle` / `PlayCircle`):** Modal to put active orders on hold or release them back to execution.
     * **Printable Sales Order Acknowledgement / Contract (`PRINT`):** Statutory ISO/GST-compliant contractual acknowledgement with corporate CIN/GSTIN header, customer PO references, line item tax schedule, delivery terms, and dual authorized signatory blocks.


### 2.36 Step 7.3 — Outward Warehouse Pick/Pack Slip & Dispatch Delivery Challan (`/sales/delivery-challans`)

1. **Database Objects (`dbscripts/` & `backend/src/database/schema/core.schema.ts`):**
   * Tables:
     * `tbl_sales_delivery_challan_header` (`challan_id` BIGINT PK backed by `seq_delivery_challan_id`, `challan_no` VARCHAR(50) NOT NULL, `challan_date` DATE NOT NULL DEFAULT CURRENT_DATE, `so_id` BIGINT REFERENCES `tbl_sales_order_header(so_id)`, `so_no` VARCHAR(50), `customer_id` BIGINT NOT NULL REFERENCES `tbl_crm_party(party_id)`, `customer_name` VARCHAR(150) NOT NULL, `contact_person` VARCHAR(100), `contact_phone` VARCHAR(25), `billing_address_id` BIGINT REFERENCES `tbl_crm_party_address(address_id)`, `billing_address` TEXT, `shipping_address_id` BIGINT REFERENCES `tbl_crm_party_address(address_id)`, `shipping_address` TEXT, `shipping_state_code` VARCHAR(10) NOT NULL DEFAULT `'24'`, `shipping_state_name` VARCHAR(100) NOT NULL DEFAULT `'Gujarat'`, `customer_gstin` VARCHAR(20), `dispatch_purpose` VARCHAR(50) NOT NULL DEFAULT `'SUPPLY_ON_SALE'` CHECK IN (`'SUPPLY_ON_SALE'`, `'SAMPLE_DEMO'`, `'JOB_WORK_RETURN'`, `'EXHIBITION'`, `'APPROVAL_BASIS'`, `'OTHERS'`), `transporter_id` BIGINT REFERENCES `tbl_crm_party(party_id)`, `transporter_name` VARCHAR(150), `vehicle_no` VARCHAR(50), `lr_rr_no` VARCHAR(80), `lr_rr_date` DATE, `e_way_bill_no` VARCHAR(50), `e_way_bill_date` DATE, `delivery_terms` VARCHAR(100) NOT NULL DEFAULT `'EX_WORKS'`, `total_packages` INTEGER NOT NULL DEFAULT 1, `package_type` VARCHAR(80) DEFAULT `'Corrugated Boxes'`, `gross_weight_kg` NUMERIC(10,3) DEFAULT 0.000, `net_weight_kg` NUMERIC(10,3) DEFAULT 0.000, `warehouse_id` BIGINT NOT NULL REFERENCES `tbl_inv_warehouse(warehouse_id)`, `total_quantity` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `total_value` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `status` VARCHAR(25) NOT NULL DEFAULT `'DRAFT'` CHECK IN (`'DRAFT'`, `'PICKED'`, `'PACKED'`, `'DISPATCHED'`, `'DELIVERED'`, `'CANCELLED'`), `picked_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `picked_at` TIMESTAMPTZ, `packed_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `packed_at` TIMESTAMPTZ, `dispatched_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `dispatched_at` TIMESTAMPTZ, `delivered_at` TIMESTAMPTZ, `remarks` VARCHAR(500), `terms_and_conditions` TEXT, `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns, CONSTRAINT `uq_sales_delivery_challan_no` UNIQUE `(comp_id, branch_id, challan_no)`).
     * `tbl_sales_delivery_challan_item` (`challan_item_id` BIGINT PK backed by `seq_challan_item_id`, `challan_id` BIGINT NOT NULL REFERENCES `tbl_sales_delivery_challan_header(challan_id)` ON DELETE CASCADE, `so_item_id` BIGINT REFERENCES `tbl_sales_order_item(so_item_id)`, `item_sequence` INTEGER NOT NULL DEFAULT 1, `item_id` BIGINT NOT NULL REFERENCES `tbl_inv_item(item_id)`, `item_code` VARCHAR(50) NOT NULL, `item_name` VARCHAR(150) NOT NULL, `description` VARCHAR(400), `hsn_sac_code` VARCHAR(20), `uom_id` BIGINT NOT NULL REFERENCES `tbl_inv_uom(uom_id)`, `ordered_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `dispatched_qty` NUMERIC(14,3) NOT NULL DEFAULT 1.000, `warehouse_id` BIGINT NOT NULL REFERENCES `tbl_inv_warehouse(warehouse_id)`, `bin_id` BIGINT REFERENCES `tbl_inv_storage_bin(bin_id)`, `batch_no` VARCHAR(100), `heat_no` VARCHAR(100), `unit_rate` NUMERIC(14,4) NOT NULL DEFAULT 0.0000, `total_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `remarks` VARCHAR(250), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns).
   * Updated Constraints: `tbl_inv_stock_ledger` CHECK constraints expanded to include `transaction_type = 'SALES_DISPATCH'` and `reference_doc_type = 'DELIVERY_CHALLAN'`.
   * Sequences: `seq_delivery_challan_id`, `seq_challan_item_id` (starting at 1001).
   * Indexes: `idx_sales_dc_comp_branch`, `idx_sales_dc_customer`, `idx_sales_dc_so`, `idx_sales_dc_status`, `idx_sales_dc_date`, `idx_sales_dc_item_challan`, `idx_sales_dc_item_item`, `idx_sales_dc_item_so_item`, `idx_sales_dc_item_wh_bin`.
   * Triggers: `trg_sales_delivery_challan_header_updated_date` and `trg_sales_delivery_challan_item_updated_date` calling `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered Screen `1035` (`DELIVERY_CHALLAN`) with actions `1115` (`EXPORT`), `1116` (`PRINT`), `1117` (`PICK`), `1118` (`PACK`), and `1119` (`DISPATCH`). Granular permissions assigned across `SUPER_ADMIN`, `PLANT_MANAGER`, `STORE_OFFICER`, `PURCHASE_EXEC`, and `SALES_EXEC`.
     * `03_sample_demo_data.sql`: Seeded `DC-AHM-2627-0001` (`DISPATCHED` to L&T with 25 SS-316 Gate Valves deducted from Bin `A-01-01`, `SO-AHM-2627-0002` transitioned to `COMPLETED`), and `DC-AHM-2627-0002` (`PACKED` lot of 50 hydromount assemblies for Maruti Suzuki).
2. **Backend Architecture & API Contracts (`backend/src/modules/sales/delivery-challan/`):**
   * Controller: `DeliveryChallanController` mapped to `/api/v1/sales/delivery-challans`.
   * Service: `DeliveryChallanService` injecting `DrizzleDb`, `DATABASE_POOL`, and `AuditLogService`.
   * Endpoints:
     * `GET /sales/delivery-challans/summary` (`@RequirePermission('DELIVERY_CHALLAN', 'VIEW')`) — returns KPI metrics (`totalChallans`, `dispatchedCount`, `dispatchedValue`, `pendingDispatchCount`, `packedCount`, `pickedCount`, `deliveredCount`, `totalChallanValue`).
     * `GET /sales/delivery-challans/lookups` (`@RequirePermission('DELIVERY_CHALLAN', 'VIEW')`) — returns active customer parties, addresses, transporters, finished goods items, warehouses, storage bins with stock balances, and confirmed Sales Orders with pending deliverable quantities.
     * `GET /sales/delivery-challans` (`@RequirePermission('DELIVERY_CHALLAN', 'VIEW')`) — paginated listing with filtering by `status`, `customerId`, `transporterId`, date range, and free-text search across challan number, SO reference, customer name, vehicle number, and E-Way Bill number.
     * `GET /sales/delivery-challans/:id` (`@RequirePermission('DELIVERY_CHALLAN', 'VIEW')`) — retrieves single delivery challan with full line items, warehouse bin allocations, batch numbers, logistics metadata, and audit log stamps.
     * `POST /sales/delivery-challans` (`@RequirePermission('DELIVERY_CHALLAN', 'ADD')`) — creates delivery challan with automatic sequential numbering (`DC-AHM-2627-XXXX`), line item rollups, customer address synchronization, and audit logging.
     * `PUT /sales/delivery-challans/:id` (`@RequirePermission('DELIVERY_CHALLAN', 'EDIT')`) — updates draft or picked challan parameters and line items.
     * `POST /sales/delivery-challans/:id/pick` (`@RequirePermission('DELIVERY_CHALLAN', 'PICK')`) — confirms warehouse picking slip, updates `status = 'PICKED'`, logs `picked_by` and `picked_at`.
     * `POST /sales/delivery-challans/:id/pack` (`@RequirePermission('DELIVERY_CHALLAN', 'PACK')`) — confirms packing list, records package count, container type, gross/net weight, and updates `status = 'PACKED'`.
     * `POST /sales/delivery-challans/:id/dispatch` (`@RequirePermission('DELIVERY_CHALLAN', 'DISPATCH')`) — executes physical outward gate dispatch: deducts on-hand and reserved balances from `tbl_inv_bin_stock`, logs immutable `SALES_DISPATCH` entries in `tbl_inv_stock_ledger`, updates `delivered_qty` on linked Sales Orders (`tbl_sales_order_item`), advances order header status to `COMPLETED` or `PARTIALLY_DELIVERED`, and stamps `dispatched_at`.
     * `POST /sales/delivery-challans/:id/deliver` (`@RequirePermission('DELIVERY_CHALLAN', 'EDIT')`) — records destination customer receipt confirmation, updating `status = 'DELIVERED'` and `delivered_at`.
     * `POST /sales/delivery-challans/:id/cancel` (`@RequirePermission('DELIVERY_CHALLAN', 'EDIT')`) — cancels challan: if already dispatched, automatically reverses bin stock deductions, creates offsetting `ADJUSTMENT` entries in `tbl_inv_stock_ledger`, and resets Sales Order delivered quantities.
     * `DELETE /sales/delivery-challans/:id` (`@RequirePermission('DELIVERY_CHALLAN', 'DELETE')`) — performs soft delete on uncommitted draft delivery challans.
3. **Frontend Architecture (`frontend/src/pages/sales/DeliveryChallanMasterPage.tsx`):**
   * Accessible at route `/sales/delivery-challans` under `SALES & DISTRIBUTION` with `Truck` icon and `'Live'` badge.
   * Built with `<MasterDataTable>`, `<PermissionGate screen="DELIVERY_CHALLAN">`, and `<ConfirmDeleteModal>`.
   * 5 KPI summary cards (`Total Challans`, `Dispatched Outward Value`, `Pending Dispatch`, `Packed & Staged`, `Customer Delivered`).
   * Filter controls (`status`, `customerId`, search).
   * Modals & Drawers:
     * **Challan Details Drawer (`Eye`):** Slideout displaying customer consignee addresses, transport and vehicle metadata, LR & E-Way Bill references, packaging parameters, line item schedule with bin allocations, declared commercial values, and 3-tier milestone audit timestamps.
     * **Create / Edit Challan Modal:** 1-Click "Load from Sales Order" selector, manual customer picker, address selector, transport vehicle fields, warehouse selector, and interactive line item grid with storage bin selection and available stock indicator.
     * **Warehouse Pick Slip Modal (`ListChecks`):** Picker verification modal capturing warehouse staging remarks and transitioning status to `PICKED`.
     * **Packing Confirmation Modal (`PackageCheck`):** Packaging verification modal recording package counts, package type, gross/net weights, and packaging notes.
     * **Gate Dispatch Clearance Modal (`Truck`):** Security gate outwards modal displaying automated inventory ledger deduction warnings, driver/carrier verification, and dispatch execution trigger.
     * **Printable Statutory Delivery Challan Modal (`PRINT`):** Formatted statutory layout compliant with Rule 55 of CGST Rules, 2017 with corporate header, CIN, GSTIN, buyer/consignee tax declarations, transport metadata, schedule of goods with HSN codes, packaging weight summary, Rule 55 statutory declaration, and 3-tier signature blocks with native `window.print()` trigger.




### 2.37 Statutory GST Tax Invoice Generation, E-Invoicing (IRN) & Customer Accounts Receivable (`/sales/invoices`)
1. **Database Schema & DDL Objects (`dbscripts/01_schema_objects.sql`):**
   * Tables:
     * `tbl_sales_invoice_header`:
       * Primary Key: `invoice_id` BIGINT (`seq_sales_invoice_id`, starts at 1001).
       * Identification & Series: `invoice_no` VARCHAR(50) NOT NULL UNIQUE (formatted as `INV-{BRANCH}-{FYEAR}-XXXX`), `invoice_date` DATE NOT NULL DEFAULT CURRENT_DATE, `invoice_type` VARCHAR(30) NOT NULL DEFAULT `'TAX_INVOICE'` (`TAX_INVOICE`, `EXPORT_INVOICE`, `SUPPLEMENTARY_INVOICE`, `REVISED_INVOICE`).
       * Linked Documents: `so_id` BIGINT REFERENCES `tbl_sales_order_header(so_id)`, `challan_id` BIGINT REFERENCES `tbl_sales_delivery_challan_header(challan_id)`.
       * Parties & Addresses: `customer_id` BIGINT NOT NULL REFERENCES `tbl_sales_customer(customer_id)`, `customer_name` VARCHAR(150) NOT NULL, `customer_gstin` VARCHAR(15), `customer_pan` VARCHAR(10), `billing_address` VARCHAR(400) NOT NULL, `billing_city` VARCHAR(50), `billing_state` VARCHAR(50), `billing_pincode` VARCHAR(10), `billing_state_code` VARCHAR(2) NOT NULL DEFAULT `'24'`, `shipping_address` VARCHAR(400), `shipping_city` VARCHAR(50), `shipping_state` VARCHAR(50), `shipping_pincode` VARCHAR(10), `shipping_state_code` VARCHAR(2) NOT NULL DEFAULT `'24'`, `place_of_supply` VARCHAR(50) NOT NULL DEFAULT `'Gujarat (24)'`, `pos_state_code` VARCHAR(2) NOT NULL DEFAULT `'24'`.
       * Dispatch & Logistics: `vehicle_no` VARCHAR(50), `transporter_id` BIGINT REFERENCES `tbl_logistics_transporter(transporter_id)`, `lr_no` VARCHAR(50), `lr_date` DATE.
       * Commercial Totals: `currency_code` VARCHAR(10) NOT NULL DEFAULT `'INR'`, `exchange_rate` NUMERIC(10,4) NOT NULL DEFAULT 1.0000, `subtotal_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `discount_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `taxable_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `cgst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `sgst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `igst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `tcs_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `round_off_amount` NUMERIC(8,2) NOT NULL DEFAULT 0.00, `total_invoice_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00.
       * Accounts Receivable: `paid_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `balance_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `payment_status` VARCHAR(20) NOT NULL DEFAULT `'UNPAID'` (`UNPAID`, `PARTIALLY_PAID`, `PAID`).
       * E-Invoicing & Compliance: `irn_status` VARCHAR(20) NOT NULL DEFAULT `'NOT_APPLICABLE'` (`NOT_APPLICABLE`, `PENDING`, `GENERATED`, `FAILED`, `CANCELLED`), `irn_no` VARCHAR(64), `ack_no` VARCHAR(50), `ack_date` TIMESTAMP WITH TIME ZONE, `signed_qr_code` TEXT, `e_way_bill_no` VARCHAR(50), `e_way_bill_date` TIMESTAMP WITH TIME ZONE.
       * Terms & Workflow: `payment_terms` VARCHAR(100), `due_date` DATE, `bank_details` VARCHAR(300), `remarks` VARCHAR(500), `status` VARCHAR(20) NOT NULL DEFAULT `'DRAFT'` (`DRAFT`, `POSTED`, `PARTIALLY_PAID`, `PAID`, `CANCELLED`), `posted_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `posted_at` TIMESTAMP WITH TIME ZONE, `cancelled_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `cancelled_at` TIMESTAMP WITH TIME ZONE, `cancellation_reason` VARCHAR(300), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns.
     * `tbl_sales_invoice_item`:
       * Primary Key: `invoice_item_id` BIGINT (`seq_sales_invoice_item_id`, starts at 1001).
       * Foreign Keys: `invoice_id` BIGINT NOT NULL REFERENCES `tbl_sales_invoice_header(invoice_id)` ON DELETE CASCADE, `so_item_id` BIGINT REFERENCES `tbl_sales_order_item(so_item_id)`, `challan_item_id` BIGINT REFERENCES `tbl_sales_delivery_challan_item(challan_item_id)`.
       * Item Detail: `item_sequence` INTEGER NOT NULL DEFAULT 1, `item_id` BIGINT NOT NULL REFERENCES `tbl_inv_item(item_id)`, `item_code` VARCHAR(50) NOT NULL, `item_name` VARCHAR(150) NOT NULL, `description` VARCHAR(400), `hsn_sac_code` VARCHAR(20) NOT NULL, `uom_id` BIGINT NOT NULL REFERENCES `tbl_inv_uom(uom_id)`, `invoiced_qty` NUMERIC(14,3) NOT NULL DEFAULT 1.000, `unit_price` NUMERIC(14,4) NOT NULL DEFAULT 0.0000, `discount_percent` NUMERIC(5,2) NOT NULL DEFAULT 0.00, `discount_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `taxable_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `gst_rate` NUMERIC(5,2) NOT NULL DEFAULT 18.00, `cgst_rate` NUMERIC(5,2) NOT NULL DEFAULT 9.00, `cgst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `sgst_rate` NUMERIC(5,2) NOT NULL DEFAULT 9.00, `sgst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `igst_rate` NUMERIC(5,2) NOT NULL DEFAULT 0.00, `igst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `line_total` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `warehouse_id` BIGINT REFERENCES `tbl_inv_warehouse(warehouse_id)`, `bin_id` BIGINT REFERENCES `tbl_inv_storage_bin(bin_id)`, `batch_no` VARCHAR(100), `heat_no` VARCHAR(100), `remarks` VARCHAR(250), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns.
     * `tbl_sales_ar_payment_receipt`:
       * Primary Key: `payment_id` BIGINT (`seq_ar_payment_id`, starts at 1001).
       * Identification & Foreign Keys: `receipt_no` VARCHAR(50) NOT NULL UNIQUE (formatted as `REC-{BRANCH}-{FYEAR}-XXXX`), `invoice_id` BIGINT NOT NULL REFERENCES `tbl_sales_invoice_header(invoice_id)` ON DELETE CASCADE, `customer_id` BIGINT NOT NULL REFERENCES `tbl_sales_customer(customer_id)`.
       * Receipt Data: `receipt_date` DATE NOT NULL DEFAULT CURRENT_DATE, `payment_mode` VARCHAR(30) NOT NULL DEFAULT `'NEFT_RTGS'` (`NEFT_RTGS`, `CHEQUE`, `UPI`, `BANK_TRANSFER`, `CASH`, `CREDIT_ADJUSTMENT`), `bank_reference_no` VARCHAR(100), `instrument_date` DATE, `bank_name` VARCHAR(100), `receipt_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `tds_deducted` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `allocated_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `remarks` VARCHAR(400), `status` VARCHAR(20) NOT NULL DEFAULT `'CONFIRMED'`, `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns.
   * Sequences: `seq_sales_invoice_id`, `seq_sales_invoice_item_id`, `seq_ar_payment_id` (all starting at 1001).
   * Indexes: `idx_sales_inv_comp_branch`, `idx_sales_inv_customer`, `idx_sales_inv_so`, `idx_sales_inv_dc`, `idx_sales_inv_status`, `idx_sales_inv_pay_status`, `idx_sales_inv_irn_status`, `idx_sales_inv_date`, `idx_sales_inv_item_inv`, `idx_sales_inv_item_item`, `idx_sales_inv_item_so_item`, `idx_sales_inv_item_dc_item`, `idx_sales_ar_comp_branch`, `idx_sales_ar_inv`, `idx_sales_ar_cust`, `idx_sales_ar_date`.
   * Triggers: `trg_sales_invoice_header_updated_date`, `trg_sales_invoice_item_updated_date`, and `trg_sales_ar_payment_receipt_updated_date` calling `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered Screen `1036` (`SALES_INVOICE`, `/sales/invoices`, `Receipt`, sort order 36) with actions `1120` (`EXPORT`), `1121` (`PRINT`), `1122` (`POST`), `1123` (`GENERATE_IRN`), and `1124` (`RECORD_PAYMENT`). Full 5-role RBAC permissions across `SUPER_ADMIN`, `PLANT_MANAGER`, `STORE_OFFICER`, `PURCHASE_EXEC`, and `SALES_EXEC`.
     * `03_sample_demo_data.sql`: Seeded `INV-AHM-2627-0001` (L&T, Intra-state Gujarat, ₹1,94,582, `POSTED`, IRN Generated with 64-char hash, partially paid ₹1,00,000 via RTGS receipt `REC-AHM-2627-0001`, remaining balance ₹94,582), and `INV-AHM-2627-0002` (Maruti Suzuki, Inter-state Haryana, ₹1,03,693, `DRAFT` from `SO-AHM-2627-0001`).
2. **Backend Architecture & API Contracts (`backend/src/modules/sales/invoice/`):**
   * Controller: `SalesInvoiceController` mapped to `/api/v1/sales/invoices`.
   * Service: `SalesInvoiceService` injecting `DrizzleDb`, `DATABASE_POOL`, and `AuditLogService`.
   * Endpoints:
     * `GET /sales/invoices/summary` (`@RequirePermission('SALES_INVOICE', 'VIEW')`) — returns KPI metrics (`totalInvoicedAmount`, `totalPaidAmount`, `totalBalanceAmount`, `irnGeneratedCount`, `unpaidCount`, `totalInvoicesCount`).
     * `GET /sales/invoices/lookups` (`@RequirePermission('SALES_INVOICE', 'VIEW')`) — returns active customer parties with GSTINs, addresses, items with HSN codes, confirmed Sales Orders, dispatched Delivery Challans, and warehouses.
     * `GET /sales/invoices` (`@RequirePermission('SALES_INVOICE', 'VIEW')`) — paginated listing with filtering by `status`, `paymentStatus`, `irnStatus`, `customerId`, date range, and free-text search across invoice number, customer name, GSTIN, IRN, and SO/DC references.
     * `GET /sales/invoices/:id` (`@RequirePermission('SALES_INVOICE', 'VIEW')`) — retrieves single tax invoice with full line items, AR payment receipts history, E-Invoicing metadata, and audit log stamps.
     * `POST /sales/invoices` (`@RequirePermission('SALES_INVOICE', 'ADD')`) — creates tax invoice with automatic sequential numbering (`INV-AHM-2627-XXXX`), tax computations, and audit logging.
     * `PUT /sales/invoices/:id` (`@RequirePermission('SALES_INVOICE', 'EDIT')`) — updates draft invoice parameters and line items.
     * `POST /sales/invoices/:id/post` (`@RequirePermission('SALES_INVOICE', 'POST')`) — posts commercial invoice: locks lines, transitions status to `POSTED`, increments `invoiced_qty` on linked Sales Order items (`tbl_sales_order_item`), initializes AR balance (`balance_amount`), and records audit entry.
     * `POST /sales/invoices/:id/generate-irn` (`@RequirePermission('SALES_INVOICE', 'GENERATE_IRN')`) — generates statutory Rule 48(4) E-Invoice: computes 64-char SHA-256 hash, generates 16-digit Ack No, constructs signed QR payload, updates `irn_status = 'GENERATED'`, and optionally assigns E-Way Bill number.
     * `POST /sales/invoices/:id/payments` (`@RequirePermission('SALES_INVOICE', 'RECORD_PAYMENT')`) — logs customer AR payment receipt into `tbl_sales_ar_payment_receipt`, deducts outstanding `balance_amount`, updates `paid_amount`, and advances `payment_status` (`UNPAID` $\rightarrow$ `PARTIALLY_PAID` $\rightarrow$ `PAID`).
     * `POST /sales/invoices/:id/cancel` (`@RequirePermission('SALES_INVOICE', 'EDIT')`) — cancels invoice: if previously posted, reverts invoiced quantities on linked Sales Order items, marks IRN status as `CANCELLED`, and logs audit trail.
     * `DELETE /sales/invoices/:id` (`@RequirePermission('SALES_INVOICE', 'DELETE')`) — performs soft delete on uncommitted draft invoices.
3. **Frontend Architecture (`frontend/src/pages/sales/SalesInvoiceMasterPage.tsx`):**
   * Accessible at route `/sales/invoices` under `SALES & DISTRIBUTION` with `Receipt` icon and `'Live'` badge.
   * Built with `<MasterDataTable>`, `<PermissionGate screen="SALES_INVOICE">`, and `<ConfirmDeleteModal>`.
   * 5 KPI summary cards (`Total Invoiced`, `Realized Receipts`, `Outstanding AR Balance`, `E-Invoices Generated`, `Pending / Unpaid`).
   * Filter controls (`status`, `paymentStatus`, `irnStatus`, `customerId`, search).
   * Modals & Drawers:
     * **Invoice Details Drawer (`Eye`):** Slideout displaying customer addresses, GSTIN, place of supply, IRN compliance section with 64-character hash and Ack details, line item breakdown with HSN codes and tax split, and AR payment receipts audit history.
     * **Create / Edit Invoice Modal:** 1-Click "Load from Delivery Challan" and "Load from Sales Order" selectors, customer picker, place of supply detector, transport vehicle fields, and interactive line item grid with real-time tax calculation (Intra vs. Inter-state) and round-off logic.
     * **Commercial Posting Modal (`CheckCircle`):** Confirmation modal highlighting commercial locking and Sales Order `invoiced_qty` synchronization.
     * **Statutory E-Invoicing (IRN) Generation Modal (`QrCode`):** Cryptographic IRN generation modal displaying SHA-256 hash preview, statutory Ack issuance, signed QR code data preview, and E-Way Bill attachment.
     * **Customer Payment Receipt Modal (`CreditCard`):** Payment collection modal capturing payment modes (`NEFT_RTGS`, `CHEQUE`, `UPI`, `BANK_TRANSFER`, `CASH`, `CREDIT_ADJUSTMENT`), UTR/cheque reference, bank name, receipt amount, TDS withholding amount, and real-time balance reduction preview.
     * **Printable Statutory Tax Invoice Modal (`PRINT`):** Formatted statutory layout compliant with Section 31 & Rule 46 of CGST Rules, 2017 with corporate header, CIN, GSTIN, 64-char IRN hash, signed QR code, buyer/consignee tax declarations, transport metadata, schedule of goods with HSN codes, HSN tax summary matrix, bank remittance credentials, reverse charge declaration, and 3-tier signature blocks with native `window.print()` trigger.


### 2.38 Sales Returns & Statutory Credit Notes (`/sales/returns`)
1. **Database Schema & DDL Objects (`dbscripts/01_schema_objects.sql`):**
   * Tables:
     * `tbl_sales_return_header`:
       * Primary Key: `return_id` BIGINT (`seq_sales_return_id`, starts at 1001).
       * Document Identifiers: `return_no` VARCHAR(50) NOT NULL UNIQUE (formatted as `SR-{BRANCH}-{FYEAR}-XXXX`), `return_date` DATE NOT NULL DEFAULT CURRENT_DATE, `return_type` VARCHAR(30) NOT NULL DEFAULT `'SALES_RETURN'` (`SALES_RETURN`, `RMA_REPLACEMENT`, `REPAIR_RETURN`, `COMMERCIAL_CREDIT`).
       * Statutory Credit Note: `credit_note_no` VARCHAR(50) UNIQUE (formatted as `CN-{BRANCH}-{FYEAR}-XXXX`), `credit_note_date` DATE, `credit_note_status` VARCHAR(20) NOT NULL DEFAULT `'PENDING'` (`PENDING`, `ISSUED`, `ADJUSTED`, `CANCELLED`).
       * Cross References: `invoice_id` BIGINT REFERENCES `tbl_sales_invoice_header(invoice_id)`, `invoice_no` VARCHAR(50) NOT NULL, `invoice_date` DATE NOT NULL, `customer_id` BIGINT NOT NULL REFERENCES `tbl_crm_party(party_id)`.
       * Logistics & Inward: `rma_reference_no` VARCHAR(100), `rma_reference_date` DATE, `gate_entry_no` VARCHAR(50), `gate_entry_date` DATE, `vehicle_no` VARCHAR(50), `transporter_name` VARCHAR(100), `lr_no` VARCHAR(50), `lr_date` DATE, `return_reason` VARCHAR(500).
       * Commercial Totals: `taxable_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `cgst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `sgst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `igst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `total_tax_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `round_off_amount` NUMERIC(6,2) NOT NULL DEFAULT 0.00, `total_credit_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `ar_adjusted_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00.
       * Statutory IRN: `irn_status` VARCHAR(20) NOT NULL DEFAULT `'NOT_GENERATED'` (`NOT_GENERATED`, `GENERATED`, `FAILED`, `CANCELLED`), `irn_no` VARCHAR(64), `ack_no` VARCHAR(50), `ack_date` TIMESTAMP WITH TIME ZONE, `signed_qr_code` TEXT, `e_way_bill_no` VARCHAR(50).
       * Lifecycle & Multi-tenant: `qc_status` VARCHAR(20) NOT NULL DEFAULT `'PENDING'` (`PENDING`, `INSPECTED`, `ACCEPTED`, `PARTIALLY_ACCEPTED`, `REJECTED`), `restock_status` VARCHAR(20) NOT NULL DEFAULT `'PENDING'` (`PENDING`, `RESTOCKED`, `NOT_APPLICABLE`), `status` VARCHAR(20) NOT NULL DEFAULT `'DRAFT'` (`DRAFT`, `INSPECTED`, `CREDITED`, `RESTOCKED`, `COMPLETED`, `CANCELLED`), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns.
     * `tbl_sales_return_item`:
       * Primary Key: `return_item_id` BIGINT (`seq_sales_return_item_id`, starts at 1001).
       * Foreign Keys: `return_id` BIGINT NOT NULL REFERENCES `tbl_sales_return_header(return_id)` ON DELETE CASCADE, `invoice_item_id` BIGINT REFERENCES `tbl_sales_invoice_item(invoice_item_id)`.
       * Item & Valuation: `item_sequence` INT NOT NULL DEFAULT 1, `item_id` BIGINT NOT NULL REFERENCES `tbl_inv_item(item_id)`, `item_code` VARCHAR(50) NOT NULL, `item_name` VARCHAR(200) NOT NULL, `hsn_sac_code` VARCHAR(20) NOT NULL, `uom_id` BIGINT NOT NULL REFERENCES `tbl_inv_uom(uom_id)`.
       * Quantities: `invoiced_qty` NUMERIC(14,4) NOT NULL DEFAULT 0.0000, `returned_qty` NUMERIC(14,4) NOT NULL DEFAULT 0.0000, `accepted_qty` NUMERIC(14,4) NOT NULL DEFAULT 0.0000, `rejected_scrap_qty` NUMERIC(14,4) NOT NULL DEFAULT 0.0000.
       * Commercial & Tax: `unit_price` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `discount_percent` NUMERIC(5,2) NOT NULL DEFAULT 0.00, `taxable_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `gst_rate` NUMERIC(5,2) NOT NULL DEFAULT 0.00, `cgst_rate` NUMERIC(5,2) NOT NULL DEFAULT 0.00, `cgst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `sgst_rate` NUMERIC(5,2) NOT NULL DEFAULT 0.00, `sgst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `igst_rate` NUMERIC(5,2) NOT NULL DEFAULT 0.00, `igst_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `line_total` NUMERIC(14,2) NOT NULL DEFAULT 0.00.
       * Storage & QC: `target_warehouse_id` BIGINT REFERENCES `tbl_inv_warehouse(warehouse_id)`, `target_bin_id` BIGINT REFERENCES `tbl_inv_bin(bin_id)`, `batch_no` VARCHAR(100), `heat_no` VARCHAR(100), `defect_type` VARCHAR(50), `qc_verdict` VARCHAR(30) NOT NULL DEFAULT `'PENDING'` (`PENDING`, `ACCEPT_FOR_RESTOCK`, `ACCEPT_FOR_REWORK`, `REJECT_SCRAP`), `action_taken` VARCHAR(200), `remarks` VARCHAR(400), 7 mandatory audit columns.
   * Sequences: `seq_sales_return_id`, `seq_sales_return_item_id` (all starting at 1001).
   * Indexes: `idx_sales_return_comp_branch`, `idx_sales_return_customer`, `idx_sales_return_invoice`, `idx_sales_return_status`, `idx_sales_return_qc`, `idx_sales_return_restock`, `idx_sales_return_cn`, `idx_sales_return_irn`, `idx_sales_return_date`, `idx_sales_return_item_return`, `idx_sales_return_item_item`, `idx_sales_return_item_inv_item`.
   * Triggers: `trg_sales_return_header_updated_date` and `trg_sales_return_item_updated_date` calling `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered Screen `1037` (`SALES_RETURN`, `/sales/returns`, `RotateCcw`, sort order 37) with actions `1125` (`EXPORT`), `1126` (`PRINT`), `1127` (`INSPECT`), `1128` (`POST_CREDIT_NOTE`), and `1129` (`RESTOCK`). Full 5-role RBAC permissions across `SUPER_ADMIN`, `PLANT_MANAGER`, `STORE_OFFICER`, `PURCHASE_EXEC`, and `SALES_EXEC`.
     * `03_sample_demo_data.sql`: Seeded `SR-AHM-2627-0001` (L&T, against `INV-AHM-2627-0001`, 2 valves, 1 accepted restocked to Bin `1007`, 1 scrapped, CN `CN-AHM-2627-0001` issued for ₹15,566 with AR adjustment, IRN 64-char hash generated) and `SR-AHM-2627-0002` (Maruti Suzuki, against `INV-AHM-2627-0002`, 5 hydromounts, `DRAFT`, pending QC).
2. **Backend Architecture & API Contracts (`backend/src/modules/sales/return/`):**
   * Controller: `SalesReturnController` mapped to `/api/v1/sales/returns`.
   * Service: `SalesReturnService` injecting `DrizzleDb`, `DATABASE_POOL`, and `AuditLogService`.
   * Endpoints:
     * `GET /sales/returns/summary` (`@RequirePermission('SALES_RETURN', 'VIEW')`) — returns KPI metrics (`totalReturnsCount`, `totalCreditAmount`, `pendingQcCount`, `pendingRestockCount`, `arAdjustedAmount`).
     * `GET /sales/returns/lookups` (`@RequirePermission('SALES_RETURN', 'VIEW')`) — returns posted Tax Invoices with line items, active customer parties, items with HSN codes, warehouses, and storage bins.
     * `GET /sales/returns` (`@RequirePermission('SALES_RETURN', 'VIEW')`) — paginated listing with filtering by `status`, `qcStatus`, `restockStatus`, `creditNoteStatus`, `customerId`, and free-text search across return number, credit note number, customer name, GSTIN, invoice number, and RMA reference.
     * `GET /sales/returns/:id` (`@RequirePermission('SALES_RETURN', 'VIEW')`) — retrieves single return with full items, QC verdicts, E-Invoicing metadata, and audit log stamps.
     * `POST /sales/returns` (`@RequirePermission('SALES_RETURN', 'ADD')`) — creates sales return with automatic sequential numbering (`SR-AHM-2627-XXXX`), tax computations, and audit logging.
     * `PUT /sales/returns/:id` (`@RequirePermission('SALES_RETURN', 'EDIT')`) — updates draft return parameters and line items.
     * `POST /sales/returns/:id/inspect` (`@RequirePermission('SALES_RETURN', 'INSPECT')`) — executes quarantine QC inspection: records `returned_qty`, `accepted_qty`, `rejected_scrap_qty`, item QC verdicts (`ACCEPT_FOR_RESTOCK`, `ACCEPT_FOR_REWORK`, `REJECT_SCRAP`), defect categories, and transitions header `qc_status` (`ACCEPTED`, `PARTIALLY_ACCEPTED`, `REJECTED`).
     * `POST /sales/returns/:id/post-credit-note` (`@RequirePermission('SALES_RETURN', 'POST_CREDIT_NOTE')`) — issues statutory Section 34 Credit Note (`CN-AHM-2627-XXXX`), computes taxable/GST amounts, and optionally creates `CREDIT_ADJUSTMENT` in `tbl_sales_ar_payment_receipt`, decrementing outstanding `balance_amount` on `tbl_sales_invoice_header`.
     * `POST /sales/returns/:id/generate-irn` (`@RequirePermission('SALES_RETURN', 'POST_CREDIT_NOTE')`) — generates statutory Rule 48(4) E-Invoice for credit note: computes 64-char SHA-256 hash, generates 16-digit Ack No, constructs signed QR payload, and sets `irn_status = 'GENERATED'`.
     * `POST /sales/returns/:id/restock` (`@RequirePermission('SALES_RETURN', 'RESTOCK')`) — puts away accepted units into `tbl_inv_bin_stock` using parameterized atomic upsert and posts inward transactions in `tbl_inv_stock_ledger` (`transaction_type = 'SALES_RETURN'`, `reference_doc_type = 'SALES_RETURN'`).
     * `POST /sales/returns/:id/cancel` (`@RequirePermission('SALES_RETURN', 'EDIT')`) — cancels return: restores AR invoice balance, removes adjustment receipts, reverses restocked bin quantities with offsetting ledger adjustments, and marks IRN status as `CANCELLED`.
     * `DELETE /sales/returns/:id` (`@RequirePermission('SALES_RETURN', 'DELETE')`) — performs soft delete on uncommitted draft returns.
3. **Frontend Architecture (`frontend/src/pages/sales/SalesReturnMasterPage.tsx`):**
   * Accessible at route `/sales/returns` under `SALES & DISTRIBUTION` with `RotateCcw` icon and `'Live'` badge.
   * Built with `<MasterDataTable>`, `<PermissionGate screen="SALES_RETURN">`, and `<ConfirmDeleteModal>`.
   * 5 KPI summary cards (`Total Returns`, `Credit Note Value`, `Pending RMA QC`, `Pending Restock`, `AR Adjusted`).
   * Filter controls (`status`, `qcStatus`, `restockStatus`, `creditStatus`, `customer`).
   * Modals & Drawers:
     * **Return Details Drawer (`Eye`):** Slideout displaying customer addresses, GSTIN, RMA reference, original invoice cross-reference, IRN compliance section with 64-character hash and Ack details, line item breakdown with QC verdicts, and audit history.
     * **Create / Edit Return Modal:** 1-Click "Select Tax Invoice" loader pre-filling customer metadata, addresses, items, and tax rates, with interactive line item return quantity adjustments and defect categorizations.
     * **RMA Quarantine QC Inspection Modal (`CheckSquare`):** Inspection modal allowing QC Engineers to record accepted vs. scrap quantities, assign verdicts (`ACCEPT_FOR_RESTOCK`, `ACCEPT_FOR_REWORK`, `REJECT_SCRAP`), select target warehouses/bins, and enter technical defect remarks.
     * **Statutory Credit Note Modal (`FileSpreadsheet`):** Issues `CN-{BRANCH}-{FYEAR}-XXXX` with live credit calculation and 1-Click checkbox to rebalance customer's outstanding invoice balance.
     * **Statutory E-Invoicing (IRN) Generation Modal (`QrCode`):** Cryptographic IRN generation modal displaying SHA-256 hash preview, statutory Ack issuance, and signed QR code payload.
     * **Warehouse Put-Away & Restock Modal (`Boxes`):** Review accepted quantities and confirm atomic bin put-away and stock ledger accretion.
     * **Printable Statutory Credit Note Modal (`PRINT`):** Formatted statutory layout compliant with Section 34 & Rule 53 of CGST Rules, 2017 with corporate header, CIN, GSTIN, 64-char IRN hash, signed QR code, original invoice references, return item schedule, tax breakdown, and 3-tier signature blocks with native `window.print()` trigger.

### 2.39 Real-Time Stock Balance & Valuation (`/inventory/balance`)
1. **Database Schema & DDL Objects (`dbscripts/01_schema_objects.sql`):**
   * Tables:
     * `tbl_inv_bin_stock`:
       * Primary Key: `bin_stock_id` BIGINT (`seq_bin_stock_id`, starts at 1001).
       * Foreign Keys: `warehouse_id` BIGINT REFERENCES `tbl_inv_warehouse(warehouse_id)`, `bin_id` BIGINT REFERENCES `tbl_inv_storage_bin(bin_id)`, `item_id` BIGINT REFERENCES `tbl_inv_item(item_id)`, `uom_id` BIGINT REFERENCES `tbl_inv_uom(uom_id)`.
       * Unique Invariant: `uq_inv_bin_stock_unique UNIQUE (warehouse_id, bin_id, item_id, batch_no)`.
       * Stock Quantities: `on_hand_qty` NUMERIC(14, 3) NOT NULL DEFAULT 0.000, `reserved_qty` NUMERIC(14, 3) NOT NULL DEFAULT 0.000, `available_qty` NUMERIC(14, 3) NOT NULL DEFAULT 0.000.
       * Valuation: `unit_cost` NUMERIC(14, 4) DEFAULT 0.0000, `total_valuation` NUMERIC(14, 2) DEFAULT 0.00, `last_stock_date` TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP, `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns.
     * `tbl_inv_stock_ledger`:
       * Primary Key: `ledger_id` BIGINT (`seq_stock_ledger_id`, starts at 1001).
       * Identification & Document Reference: `transaction_type` VARCHAR(50) NOT NULL (`PUTAWAY_INWARD`, `QUARANTINE_HOLD`, `QC_RELEASE`, `INTERNAL_TRANSFER`, `PRODUCTION_ISSUE`, `SCRAP_WRITE_OFF`, `ADJUSTMENT`, `SALES_DISPATCH`, `SALES_RETURN`), `reference_doc_type` VARCHAR(50) NOT NULL (`GRN`, `QC_INSPECTION`, `PUTAWAY`, `TRANSFER`, `WORK_ORDER`, `ADJUSTMENT`, `DELIVERY_CHALLAN`, `SALES_RETURN`), `reference_doc_id` BIGINT NOT NULL, `reference_doc_no` VARCHAR(50) NOT NULL.
       * Double-Entry Location: `warehouse_id` BIGINT NOT NULL, `from_bin_id` BIGINT, `to_bin_id` BIGINT, `item_id` BIGINT NOT NULL, `uom_id` BIGINT NOT NULL, `batch_no` VARCHAR(100), `heat_no` VARCHAR(100).
       * Ledger Values: `qty_in` NUMERIC(14, 3) DEFAULT 0.000, `qty_out` NUMERIC(14, 3) DEFAULT 0.000, `unit_cost` NUMERIC(14, 4) DEFAULT 0.0000, `total_cost` NUMERIC(14, 2) DEFAULT 0.00, `closing_balance` NUMERIC(14, 3) NOT NULL DEFAULT 0.000, `remarks` VARCHAR(350), 7 mandatory audit columns.
   * Sequences: `seq_bin_stock_id`, `seq_stock_ledger_id` (all starting at 1001).
   * Indexes: `idx_inv_bin_stock_wh_bin`, `idx_inv_bin_stock_item`, `idx_inv_bin_stock_batch`, `idx_inv_stock_ledger_comp`, `idx_inv_stock_ledger_item_date`, `idx_inv_stock_ledger_wh_bin`, `idx_inv_stock_ledger_ref`.
   * Triggers: `trg_inv_bin_stock_updated_date` calling `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered Screen `1038` (`STOCK_BALANCE`, `/inventory/balance`, `Calculator`, sort order 38) with actions `1130` (`EXPORT`), `1131` (`PRINT`), `1132` (`LEDGER_DRILLDOWN`), and `1133` (`REVALUE`). Full 5-role RBAC permissions across `SUPER_ADMIN`, `PLANT_MANAGER`, `STORE_OFFICER`, `PURCHASE_EXEC`, and `SALES_EXEC`.
     * `03_sample_demo_data.sql`: Seeded 9 active bin stock records with total inventory valuation of ₹13,71,086.60 across Raw Materials (SS-316 Round Bar, Cold Rolled Coil, Aluminum Ingot LM24, PP Granules), Semi-Finished WIP (Machined Valve Body), Finished Goods (Flanged Gate Valve, Hydromount Powertrain), Consumable MRO (Synthetic CNC Coolant), and Tooling (Tungsten Carbide Inserts).
2. **Backend Architecture & API Contracts (`backend/src/modules/inventory/balance/`):**
   * Controller: `StockBalanceController` mapped to `/api/v1/inventory/balance`.
   * Service: `StockBalanceService` injecting `PG_POOL` and `AuditLogService`.
   * Endpoints:
     * `GET /inventory/balance/summary` (`@RequirePermission('STOCK_BALANCE', 'VIEW')`) — returns KPI metrics (`totalValuation`, `totalLines`, `totalOnHandUnits`, `totalAvailableUnits`, `totalReservedUnits`, `lowStockCount`, `outOfStockCount`, `valuationByWarehouse`, `valuationByCategory`).
     * `GET /inventory/balance/lookups` (`@RequirePermission('STOCK_BALANCE', 'VIEW')`) — returns active warehouses, storage bins, item categories, and UOMs.
     * `GET /inventory/balance` (`@RequirePermission('STOCK_BALANCE', 'VIEW')`) — paginated listing with filtering by `warehouseId`, `binId`, `itemType`, `stockStatus` (`ALL`, `IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`, `RESERVED`), and free-text search across item code, name, batch, heat, bin code, and warehouse name.
     * `GET /inventory/balance/:id/ledger` (`@RequirePermission('STOCK_BALANCE', 'LEDGER_DRILLDOWN')`) — retrieves complete chronological inward/outward movement history from `tbl_inv_stock_ledger` for the selected item and bin with running balances.
     * `POST /inventory/balance/:id/revalue` (`@RequirePermission('STOCK_BALANCE', 'REVALUE')`) — adjusts unit standard cost and recalculates line valuation, optionally synchronizing `tbl_inv_item.standard_cost` with audit log capture in `tbl_sys_audit_log`.
3. **Frontend Architecture (`frontend/src/pages/inventory/StockBalanceMasterPage.tsx`):**
   * Accessible at route `/inventory/balance` under `INVENTORY & WMS` with `Calculator` icon and `'Live'` badge.
   * Built with `<MasterDataTable>`, `<PermissionGate screen="STOCK_BALANCE">`.
   * 5 KPI summary cards (`Total Valuation`, `Stock Lines`, `Available Units`, `Reserved Units`, `Low Stock Warnings`).
   * Category and Warehouse Valuation breakdown visual cards.
   * Filter controls (`warehouseFilter`, `categoryFilter`, `stockStatusFilter`, instant search).
   * Group-by options: Warehouse, Item Category, Storage Bin.
   * Modals & Drawers:
     * **Stock Item Specification Drawer (`Eye`):** Slideout displaying item master attributes, warehouse coordinates, bin type, batch/heat numbers, safety stock buffer, and Ind AS 2 valuation.
     * **Movement History & Stock Ledger Modal (`History`):** Interactive drill-down table querying `GET /inventory/balance/:id/ledger` showing chronological inward/outward movements, reference documents, and running closing balances.
     * **Recalculate Valuation & Cost Modal (`Calculator`):** Adjusts unit cost with real-time valuation delta calculation and justification text.
     * **Official Ind AS 2 / AS-2 Printable Stock Valuation Certificate (`PRINT`):** Formatted statutory layout with corporate letterhead, CIN, GSTIN, category valuation summary table, itemized inventory schedule, valuation in Indian Rupee words, and 3-tier authorized signatory blocks with native `window.print()` trigger.


### 2.40 Physical Stock Reconciliation, Periodic Stock Audit & Stock Adjustments / Write-Offs (`/inventory/adjustments`)
1. **Database Schema & DDL Objects (`dbscripts/01_schema_objects.sql`):**
   * Tables:
     * `tbl_inv_adjustment_header`:
       * Primary Key: `adjustment_id` BIGINT (`seq_inv_adjustment_id`, starts at 1001).
       * Multi-tenant: `company_id` BIGINT NOT NULL REFERENCES `tbl_sec_company(company_id)`, `branch_id` BIGINT NOT NULL REFERENCES `tbl_sec_branch(branch_id)`.
       * Voucher Metadata: `adjustment_no` VARCHAR(50) NOT NULL UNIQUE (formatted as `SA-{BRANCH}-{FYEAR}-XXXX`), `adjustment_date` DATE NOT NULL DEFAULT CURRENT_DATE, `adjustment_type` VARCHAR(30) NOT NULL DEFAULT `'PERIODIC_AUDIT'` (`CYCLE_COUNT`, `PERIODIC_AUDIT`, `DAMAGE_WRITEOFF`, `EXPIRY_WRITEOFF`, `SPILLAGE_LOSS`, `FOUND_SURPLUS`, `REVALUATION_VARIANCE`).
       * Target Warehouse: `warehouse_id` BIGINT NOT NULL REFERENCES `tbl_inv_warehouse(warehouse_id)`.
       * Verification & Sign-off: `audited_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `audited_at` TIMESTAMPTZ, `approved_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `approval_date` TIMESTAMPTZ.
       * Aggregated Totals: `total_items` INT NOT NULL DEFAULT 0, `total_book_value` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `total_physical_value` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `net_variance_value` NUMERIC(14,2) NOT NULL DEFAULT 0.00.
       * Lifecycle & Multi-tenant: `status` VARCHAR(20) NOT NULL DEFAULT `'DRAFT'` (`DRAFT`, `SUBMITTED`, `POSTED`, `CANCELLED`), `cancellation_reason` VARCHAR(500), `remarks` VARCHAR(500), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns.
     * `tbl_inv_adjustment_item`:
       * Primary Key: `adjustment_item_id` BIGINT (`seq_inv_adjustment_item_id`, starts at 1001).
       * Foreign Keys: `adjustment_id` BIGINT NOT NULL REFERENCES `tbl_inv_adjustment_header(adjustment_id)` ON DELETE CASCADE, `item_id` BIGINT NOT NULL REFERENCES `tbl_inv_item(item_id)`, `bin_id` BIGINT NOT NULL REFERENCES `tbl_inv_storage_bin(bin_id)`, `uom_id` BIGINT NOT NULL REFERENCES `tbl_inv_uom(uom_id)`.
       * Item & Lot Identification: `item_sequence` INT NOT NULL DEFAULT 1, `item_code` VARCHAR(50) NOT NULL, `item_name` VARCHAR(200) NOT NULL, `batch_no` VARCHAR(100), `heat_no` VARCHAR(100).
       * Quantities: `book_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `physical_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `variance_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000.
       * Rates & Values: `unit_cost` NUMERIC(14,4) NOT NULL DEFAULT 0.0000, `book_value` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `physical_value` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `variance_value` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `variance_direction` VARCHAR(20) NOT NULL DEFAULT `'NONE'` (`SURPLUS_GAIN`, `DEFICIT_LOSS`, `NONE`).
       * Audit Justification: `discrepancy_reason` VARCHAR(250), `remarks` VARCHAR(250), 7 mandatory audit columns.
   * Sequences: `seq_inv_adjustment_id`, `seq_inv_adjustment_item_id` (all starting at 1001).
   * Indexes: `idx_inv_adjustment_header_comp_branch`, `idx_inv_adjustment_header_wh`, `idx_inv_adjustment_header_status`, `idx_inv_adjustment_header_date`, `idx_inv_adjustment_item_adj`, `idx_inv_adjustment_item_item`, `idx_inv_adjustment_item_bin`.
   * Triggers: `trg_inv_adjustment_header_updated_date` and `trg_inv_adjustment_item_updated_date` calling `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered Screen `1039` (`STOCK_ADJUSTMENT`, `/inventory/adjustments`, `ClipboardCheck`, sort order 39) with actions `1134` (`EXPORT`), `1135` (`PRINT`), `1136` (`SUBMIT`), `1137` (`APPROVE`), and `1138` (`CANCEL`). Full 5-role RBAC permissions across `SUPER_ADMIN`, `PLANT_MANAGER`, `STORE_OFFICER`, `PURCHASE_EXEC`, and `SALES_EXEC`.
     * `03_sample_demo_data.sql`: Seeded `SA-AHM-2627-0001` (Cycle count for SS-316 Round Bar with +2.000 KG surplus gain and PP Granules with -2.000 KG spillage loss, status `POSTED`, bin balances updated and stock ledger double-entry adjustments posted) and `SA-AHM-2627-0002` (Damaged finished goods write-off for 1 Hydromount Powertrain unit, status `DRAFT`, pending review).
2. **Backend Architecture & API Contracts (`backend/src/modules/inventory/adjustment/`):**
   * Controller: `StockAdjustmentController` mapped to `/api/v1/inventory/adjustments`.
   * Service: `StockAdjustmentService` injecting `PG_POOL`, `DrizzleDb`, and `AuditLogService`.
   * Endpoints:
     * `GET /inventory/adjustments/summary` (`@RequirePermission('STOCK_ADJUSTMENT', 'VIEW')`) — returns KPI metrics (`totalVouchers`, `totalBookValue`, `totalPhysicalValue`, `netVarianceValue`, `draftCount`, `submittedCount`, `postedCount`).
     * `GET /inventory/adjustments/lookups` (`@RequirePermission('STOCK_ADJUSTMENT', 'VIEW')`) — returns active warehouses, storage bins, items, and UOMs.
     * `GET /inventory/adjustments/book-stock` (`@RequirePermission('STOCK_ADJUSTMENT', 'VIEW')`) — returns live bin stock rows (`tbl_inv_bin_stock`) filtered by warehouse and optional bin for 1-Click loading.
     * `GET /inventory/adjustments` (`@RequirePermission('STOCK_ADJUSTMENT', 'VIEW')`) — paginated listing with filtering by `status`, `adjustmentType`, `warehouseId`, and free-text search across voucher number, remarks, and user names.
     * `GET /inventory/adjustments/:id` (`@RequirePermission('STOCK_ADJUSTMENT', 'VIEW')`) — retrieves single adjustment voucher with line items, variance calculations, and audit log stamps.
     * `POST /inventory/adjustments` (`@RequirePermission('STOCK_ADJUSTMENT', 'ADD')`) — creates adjustment voucher with automatic sequential numbering (`SA-{BRANCH}-{FYEAR}-XXXX`), line-level variance value computations, and audit logging.
     * `PUT /inventory/adjustments/:id` (`@RequirePermission('STOCK_ADJUSTMENT', 'EDIT')`) — updates draft adjustment voucher parameters and line items.
     * `POST /inventory/adjustments/:id/submit` (`@RequirePermission('STOCK_ADJUSTMENT', 'SUBMIT')`) — freezes physical counts, stamps verifier details, and transitions voucher status from `DRAFT` to `SUBMITTED`.
     * `POST /inventory/adjustments/:id/approve` (`@RequirePermission('STOCK_ADJUSTMENT', 'APPROVE')`) — approves voucher, updates on-hand/available quantities in `tbl_inv_bin_stock`, and posts double-entry adjustment transactions in `tbl_inv_stock_ledger` (`transaction_type = 'ADJUSTMENT'`, `reference_doc_type = 'ADJUSTMENT'`).
     * `POST /inventory/adjustments/:id/cancel` (`@RequirePermission('STOCK_ADJUSTMENT', 'CANCEL')`) — cancels voucher with mandatory reason; if previously `POSTED`, safely reverts bin stock quantities and posts offsetting ledger adjustments.
3. **Frontend Architecture (`frontend/src/pages/inventory/StockAdjustmentMasterPage.tsx`):**
   * Accessible at route `/inventory/adjustments` under `INVENTORY & WMS` with `ClipboardCheck` icon and `'Live'` badge.
   * Built with `<MasterDataTable>`, `<PermissionGate screen="STOCK_ADJUSTMENT">`.
   * 4 KPI summary cards (`Total Audits`, `Audited Book Value`, `Physical Value`, `Net Variance Value`).
   * Filter controls (`statusFilter`, `typeFilter`, `warehouseFilter`, instant search).
   * Modals & Drawers:
     * **Adjustment Details Drawer (`Eye`):** Slideout displaying voucher metadata, warehouse coordinates, audit sign-offs, full schedule of audited items with book vs physical quantities and financial variances.
     * **Create / Edit Adjustment Modal:** 1-Click "Load Book Stock by Warehouse" querying active inventory, dynamic real-time variance calculation ($\text{Physical} - \text{Book}$), automatic variance direction assignment, and line-level discrepancy reason inputs.
     * **Submit for Sign-Off Modal (`FileCheck`):** Confirmation dialog freezing counts and transferring voucher to Plant Manager.
     * **Approve & Post to Ledger Modal (`CheckCircle`):** Executive approval confirming atomic bin stock updates and double-entry stock ledger postings.
     * **Cancel Voucher Modal (`XCircle`):** Reason capture dialog reversing ledger entries and bin balances if previously posted.
     * **Official CARO 2020 Clause 3(ii) Physical Stock Verification Certificate (`PRINT`):** Formatted statutory audit certificate with corporate header, CIN, GSTIN, schedule of goods, net variance in Rupee words, and 3-tier authorized signatory blocks (Store Officer, Plant Manager, Statutory Auditor) with native `window.print()` trigger.



### 2.41 Warehouse Internal Transfers & Inter-Branch Stock Transfers (STO) (`/inventory/transfers`)
1. **Database Schema & DDL Objects (`dbscripts/01_schema_objects.sql`):**
   * Tables:
     * `tbl_inv_transfer_header`:
       * Primary Key: `transfer_id` BIGINT (`seq_inv_transfer_id`, starts at 1001).
       * Multi-tenant: `company_id` BIGINT NOT NULL REFERENCES `tbl_sec_company(company_id)`, `branch_id` BIGINT NOT NULL REFERENCES `tbl_sec_branch(branch_id)`.
       * Voucher Identification: `transfer_no` VARCHAR(50) NOT NULL UNIQUE (formatted as `ST-{BRANCH}-{FYEAR}-XXXX` or `STO-{BRANCH}-{FYEAR}-XXXX`), `transfer_date` DATE NOT NULL DEFAULT CURRENT_DATE.
       * Movement Classification: `transfer_type` VARCHAR(30) NOT NULL DEFAULT `'BIN_TO_BIN'` (`BIN_TO_BIN`, `INTER_WAREHOUSE`, `INTER_BRANCH_STO`).
       * Origin & Destination: `from_warehouse_id` BIGINT NOT NULL REFERENCES `tbl_inv_warehouse(warehouse_id)`, `to_warehouse_id` BIGINT NOT NULL REFERENCES `tbl_inv_warehouse(warehouse_id)`, `to_branch_id` BIGINT REFERENCES `tbl_sec_branch(branch_id)`.
       * Transport & Logistics: `transporter_name` VARCHAR(150), `vehicle_no` VARCHAR(50), `lr_no` VARCHAR(50), `lr_date` DATE, `eway_bill_no` VARCHAR(50), `challan_no` VARCHAR(50), `challan_date` DATE.
       * Totals: `total_items` INT NOT NULL DEFAULT 0, `total_transfer_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `total_transfer_value` NUMERIC(14,2) NOT NULL DEFAULT 0.00.
       * Lifecycle & Sign-Offs: `status` VARCHAR(20) NOT NULL DEFAULT `'DRAFT'` (`DRAFT`, `DISPATCHED`, `RECEIVED`, `CANCELLED`), `dispatched_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `dispatched_at` TIMESTAMPTZ, `received_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `received_at` TIMESTAMPTZ, `cancellation_reason` VARCHAR(500), `remarks` VARCHAR(500), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns.
     * `tbl_inv_transfer_item`:
       * Primary Key: `transfer_item_id` BIGINT (`seq_inv_transfer_item_id`, starts at 1001).
       * Foreign Keys: `transfer_id` BIGINT NOT NULL REFERENCES `tbl_inv_transfer_header(transfer_id)` ON DELETE CASCADE, `item_id` BIGINT NOT NULL REFERENCES `tbl_inv_item(item_id)`, `uom_id` BIGINT NOT NULL REFERENCES `tbl_inv_uom(uom_id)`, `from_bin_id` BIGINT NOT NULL REFERENCES `tbl_inv_storage_bin(bin_id)`, `to_bin_id` BIGINT NOT NULL REFERENCES `tbl_inv_storage_bin(bin_id)`.
       * Item & Lot Data: `item_sequence` INT NOT NULL DEFAULT 1, `item_code` VARCHAR(50) NOT NULL, `item_name` VARCHAR(200) NOT NULL, `batch_no` VARCHAR(100), `heat_no` VARCHAR(100).
       * Quantities & Valuations: `available_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `transfer_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `received_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `unit_cost` NUMERIC(14,4) NOT NULL DEFAULT 0.0000, `line_total` NUMERIC(14,2) NOT NULL DEFAULT 0.00.
       * Audit Tracking: `remarks` VARCHAR(250), 7 mandatory audit columns.
   * Sequences: `seq_inv_transfer_id`, `seq_inv_transfer_item_id` (all starting at 1001).
   * Indexes: `idx_inv_transfer_header_comp_branch`, `idx_inv_transfer_header_from_wh`, `idx_inv_transfer_header_to_wh`, `idx_inv_transfer_header_status`, `idx_inv_transfer_header_date`, `idx_inv_transfer_item_transfer`, `idx_inv_transfer_item_item`, `idx_inv_transfer_item_from_bin`, `idx_inv_transfer_item_to_bin`.
   * Triggers: `trg_inv_transfer_header_updated_date` and `trg_inv_transfer_item_updated_date` calling `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered Screen `1040` (`STOCK_TRANSFER`, `/inventory/transfers`, `ArrowLeftRight`, sort order 40) with actions `1139` (`EXPORT`), `1140` (`PRINT`), `1141` (`DISPATCH`), `1142` (`RECEIVE`), and `1143` (`CANCEL`). Full 5-role RBAC permissions configured across `SUPER_ADMIN`, `PLANT_MANAGER`, `STORE_OFFICER`, `PURCHASE_EXEC`, and `SALES_EXEC`.
     * `03_sample_demo_data.sql`: Seeded `ST-AHM-2627-0001` (Internal relocation of 50 KG SS-316 Round Bar from Central Stores Bin 1001 to Machine Shop Infeed Bin 1006, status `RECEIVED`, dual-entry ledger postings confirmed) and `STO-AHM-2627-0002` (Inter-branch STO dispatch of 25 KG SS-316 to Rajkot Plant under Rule 55 Challan `DC-STO-2627-0001` with E-Way Bill `241908219481`, status `DISPATCHED`, in-transit stock ledger outward posting confirmed).
2. **Backend Architecture & API Contracts (`backend/src/modules/inventory/transfer/`):**
   * Controller: `StockTransferController` mapped to `/api/v1/inventory/transfers`.
   * Service: `StockTransferService` injecting `PG_POOL`, `DrizzleDb`, and `AuditLogService`.
   * Endpoints:
     * `GET /inventory/transfers/summary` (`@RequirePermission('STOCK_TRANSFER', 'VIEW')`) — returns KPI metrics (`totalTransfers`, `draftCount`, `dispatchedCount`, `receivedCount`, `cancelledCount`, `totalTransferQty`, `totalTransferValue`).
     * `GET /inventory/transfers/lookups` (`@RequirePermission('STOCK_TRANSFER', 'VIEW')`) — returns active warehouses, storage bins, branches, items, and UOMs.
     * `GET /inventory/transfers/available-stock` (`@RequirePermission('STOCK_TRANSFER', 'VIEW')`) — returns available bin stock balances from `tbl_inv_bin_stock` filtered by warehouse for the 1-Click interactive stock picker.
     * `GET /inventory/transfers` (`@RequirePermission('STOCK_TRANSFER', 'VIEW')`) — paginated listing with filtering by `status`, `transferType`, `fromWarehouseId`, `toWarehouseId`, and free-text search across transfer number, vehicle, LR, challan, and remarks.
     * `GET /inventory/transfers/:id` (`@RequirePermission('STOCK_TRANSFER', 'VIEW')`) — retrieves single transfer voucher with complete item schedule, bin details, transport data, and audit stamps.
     * `POST /inventory/transfers` (`@RequirePermission('STOCK_TRANSFER', 'ADD')`) — creates transfer voucher with financial year sequential numbering (`ST-` or `STO-`), line valuation computations, and audit logging.
     * `PUT /inventory/transfers/:id` (`@RequirePermission('STOCK_TRANSFER', 'EDIT')`) — updates draft transfer voucher metadata and items.
     * `POST /inventory/transfers/:id/dispatch` (`@RequirePermission('STOCK_TRANSFER', 'DISPATCH')`) — records outward dispatch gate details (vehicle, transporter, LR, E-way bill), deducts on-hand quantities in `tbl_inv_bin_stock`, and posts outward double-entry stock ledger entries (`transaction_type = 'INTERNAL_TRANSFER'`, `qty_out = transfer_qty`).
     * `POST /inventory/transfers/:id/direct-transfer` (`@RequirePermission('STOCK_TRANSFER', 'DISPATCH')`) — 1-Click atomic bin transfer executing source bin decrement, destination bin accretion, and dual stock ledger postings simultaneously.
     * `POST /inventory/transfers/:id/receive` (`@RequirePermission('STOCK_TRANSFER', 'RECEIVE')`) — records destination receipt, accretions destination on-hand bin stock, and posts inward double-entry stock ledger entries (`transaction_type = 'INTERNAL_TRANSFER'`, `qty_in = received_qty`).
     * `POST /inventory/transfers/:id/cancel` (`@RequirePermission('STOCK_TRANSFER', 'CANCEL')`) — safely cancels transfer vouchers; automatically reverses deducted source bin stock and destination inward stock with compensating ledger entries.
3. **Frontend Architecture (`frontend/src/pages/inventory/StockTransferMasterPage.tsx`):**
   * Accessible at route `/inventory/transfers` under `INVENTORY & WMS` with `ArrowLeftRight` icon and `'Live'` badge.
   * Built with `<MasterDataTable>`, `<PermissionGate screen="STOCK_TRANSFER">`.
   * 4 KPI summary cards (`Total Transfers`, `In-Transit`, `Completed Receipts`, `Transferred Valuation`).
   * Filter controls (`statusFilter`, `typeFilter`, `fromWarehouseFilter`, `toWarehouseFilter`, instant search).
   * Modals & Drawers:
     * **Transfer Details Drawer (`Eye`):** Slideout displaying voucher metadata, origin & destination locations, logistics metadata, item schedules with source/destination bins, and audit timestamps.
     * **Create / Edit Transfer Modal:** 1-Click "Available Stock Picker" querying real-time on-hand inventory, automatic item sequence and valuation calculation, dynamic bin dropdowns filtered by origin/destination warehouses.
     * **Physical Dispatch Modal (`Truck`):** Captures transporter name, vehicle registration number, LR/RR number & date, and E-Way Bill number with outward ledger deduction.
     * **Destination Receive Modal (`PackageCheck`):** Captures physical received quantity per line item and updates destination storage bins.
     * **Cancel Transfer Modal (`XCircle`):** Reason capture dialog with full automatic restitution of bin stock balances and compensating ledger entries.
     * **Statutory GST Rule 55 Delivery Challan & Transfer Note (`PRINT`):** Formatted printable layout conforming to CGST Rule 55 with corporate letterhead, CIN, GSTIN, movement coordinates, schedule of goods, and 3-tier authorized signatory blocks (Stores Keeper, Gate Security, Receiving Store).


### 2.42 End-to-End Batch & Serial Number 360-Degree Genealogy & Traceability Explorer (`/inventory/traceability`)
1. **Database Schema & DDL Objects (`dbscripts/01_schema_objects.sql`):**
   * Tables:
     * `tbl_inv_batch_master`:
       * Primary Key: `batch_id` BIGINT (`seq_inv_batch_id`, starts at 1001).
       * Multi-tenant: `company_id` BIGINT NOT NULL REFERENCES `tbl_sec_company(company_id)`, `branch_id` BIGINT NOT NULL REFERENCES `tbl_sec_branch(branch_id)`.
       * Heat & Identification: `batch_no` VARCHAR(100) NOT NULL, `heat_no` VARCHAR(100), `lot_no` VARCHAR(100).
       * Item & Partner Links: `item_id` BIGINT NOT NULL REFERENCES `tbl_inv_item(item_id)`, `item_code` VARCHAR(50) NOT NULL, `item_name` VARCHAR(200) NOT NULL, `supplier_id` BIGINT REFERENCES `tbl_crm_party(party_id)`, `grn_id` BIGINT, `work_order_id` BIGINT REFERENCES `tbl_mfg_wo_header(wo_id)`.
       * Lifecycle Dates & Quantities: `manufacture_date` DATE, `expiry_date` DATE, `retest_date` DATE, `initial_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `current_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `uom_id` BIGINT NOT NULL REFERENCES `tbl_inv_uom(uom_id)`.
       * Quality Passport & MTC Metadata: `qc_status` VARCHAR(20) NOT NULL DEFAULT `'APPROVED'` (`APPROVED`, `RELEASED`, `QUARANTINE`, `REJECTED`), `mtc_no` VARCHAR(100), `mtc_date` DATE, `mtc_url` VARCHAR(255).
       * Spectrometry Chemical Composition (% by weight): `carbon_pct` NUMERIC(6,4), `manganese_pct` NUMERIC(6,4), `silicon_pct` NUMERIC(6,4), `phosphorus_pct` NUMERIC(6,4), `sulphur_pct` NUMERIC(6,4), `chromium_pct` NUMERIC(6,4), `nickel_pct` NUMERIC(6,4), `molybdenum_pct` NUMERIC(6,4).
       * Mechanical Properties & NDT: `yield_strength_mpa` NUMERIC(8,2), `tensile_strength_mpa` NUMERIC(8,2), `elongation_pct` NUMERIC(5,2), `hardness_value` VARCHAR(30), `impact_joules` NUMERIC(6,2), `ultrasonic_test_status` VARCHAR(50) DEFAULT `'ACCEPTABLE_LEVEL_1'`, `radiography_status` VARCHAR(50) DEFAULT `'COMPLIANT_ASME'`, `remarks` VARCHAR(500), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns.
       * Constraints: Unique constraint on `(company_id, batch_no)`.
     * `tbl_inv_batch_genealogy`:
       * Primary Key: `genealogy_id` BIGINT (`seq_inv_genealogy_id`, starts at 1001).
       * Multi-tenant: `company_id` BIGINT NOT NULL REFERENCES `tbl_sec_company(company_id)`, `branch_id` BIGINT NOT NULL REFERENCES `tbl_sec_branch(branch_id)`.
       * Parent Material Link: `parent_batch_id` BIGINT REFERENCES `tbl_inv_batch_master(batch_id)`, `parent_batch_no` VARCHAR(100) NOT NULL, `parent_item_id` BIGINT REFERENCES `tbl_inv_item(item_id)`.
       * Child Assembly Link: `child_batch_id` BIGINT REFERENCES `tbl_inv_batch_master(batch_id)`, `child_batch_no` VARCHAR(100) NOT NULL, `child_item_id` BIGINT REFERENCES `tbl_inv_item(item_id)`.
       * Manufacturing Context: `work_order_id` BIGINT REFERENCES `tbl_mfg_wo_header(wo_id)`, `job_card_id` BIGINT, `consumed_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `uom_id` BIGINT REFERENCES `tbl_inv_uom(uom_id)`.
       * Transformation Classification: `transformation_type` VARCHAR(30) NOT NULL DEFAULT `'RAW_TO_WIP'` (`RAW_TO_WIP`, `WIP_TO_FG`, `BLENDING`, `REWORK`, `SPLIT`, `MERGE`), `link_date` DATE NOT NULL DEFAULT CURRENT_DATE, `remarks` VARCHAR(500), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns.
     * `tbl_inv_serial_master`:
       * Primary Key: `serial_id` BIGINT (`seq_inv_serial_id`, starts at 1001).
       * Multi-tenant: `company_id` BIGINT NOT NULL REFERENCES `tbl_sec_company(company_id)`, `branch_id` BIGINT NOT NULL REFERENCES `tbl_sec_branch(branch_id)`.
       * Asset Identification: `item_id` BIGINT NOT NULL REFERENCES `tbl_inv_item(item_id)`, `item_code` VARCHAR(50) NOT NULL, `item_name` VARCHAR(200) NOT NULL, `batch_id` BIGINT REFERENCES `tbl_inv_batch_master(batch_id)`, `batch_no` VARCHAR(100) NOT NULL, `heat_no` VARCHAR(100), `serial_no` VARCHAR(100) NOT NULL, `barcode` VARCHAR(100), `rfid_tag` VARCHAR(100).
       * Warehouse & Bin: `current_warehouse_id` BIGINT REFERENCES `tbl_inv_warehouse(warehouse_id)`, `current_bin_id` BIGINT REFERENCES `tbl_inv_storage_bin(bin_id)`.
       * Lifecycle & Commercial Links: `status` VARCHAR(30) NOT NULL DEFAULT `'AVAILABLE'` (`AVAILABLE`, `ISSUED`, `DELIVERED`, `UNDER_MAINTENANCE`, `SCRAPPED`), `grn_id` BIGINT, `work_order_id` BIGINT REFERENCES `tbl_mfg_wo_header(wo_id)`, `job_card_id` BIGINT, `challan_id` BIGINT REFERENCES `tbl_sales_delivery_challan_header(challan_id)`, `invoice_id` BIGINT REFERENCES `tbl_sales_invoice_header(invoice_id)`, `customer_id` BIGINT REFERENCES `tbl_crm_party(party_id)`.
       * Warranty: `warranty_start_date` DATE, `warranty_end_date` DATE, `remarks` VARCHAR(500), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns.
       * Constraints: Unique constraint on `(company_id, serial_no)`.
   * Sequences: `seq_inv_batch_id`, `seq_inv_genealogy_id`, `seq_inv_serial_id` (all starting at 1001).
   * Indexes: `idx_inv_batch_master_comp_batch`, `idx_inv_batch_master_heat`, `idx_inv_batch_master_item`, `idx_inv_batch_master_qc`, `idx_inv_genealogy_parent`, `idx_inv_genealogy_child`, `idx_inv_genealogy_wo`, `idx_inv_serial_master_comp_serial`, `idx_inv_serial_master_batch`, `idx_inv_serial_master_status`, `idx_inv_serial_master_item`.
   * Triggers: `trg_inv_batch_master_updated_date`, `trg_inv_batch_genealogy_updated_date`, `trg_inv_serial_master_updated_date` calling `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered Screen `1041` (`STOCK_TRACEABILITY`, `/inventory/traceability`, `Network`, sort order 41) with actions `1144` (`EXPORT`), `1145` (`PRINT`), `1146` (`DRILLDOWN`), `1147` (`REGISTER_BATCH`), and `1148` (`REGISTER_SERIAL`). Full 5-role RBAC permissions configured.
     * `03_sample_demo_data.sql`: Seeded 5 certified Batches (`HEAT-JSW-SS316-9812`, `HEAT-AL-2026-09`, `LOT-PP-2026-02`, `BAT-WIP-VLV-01`, `FG-VLV-2026-01`), 2 multi-tier genealogy links, and 3 Serial Numbers (`VLV-2627-0001` dispatched to Larsen & Toubro, `VLV-2627-0002` & `VLV-2627-0003` available in FG Stores).
2. **Backend Architecture & API Contracts (`backend/src/modules/inventory/traceability/`):**
   * Controller: `StockTraceabilityController` mapped to `/api/v1/inventory/traceability`.
   * Service: `StockTraceabilityService` injecting `PG_POOL`, `DrizzleDb`, and `AuditLogService`.
   * Endpoints:
     * `GET /inventory/traceability/summary` (`@RequirePermission('STOCK_TRACEABILITY', 'VIEW')`) — returns KPI metrics (`totalBatches`, `activeHeats`, `totalSerials`, `deliveredSerials`, `availableSerials`, `totalGenealogyLinks`, `quarantinedBatches`, `approvedBatches`).
     * `GET /inventory/traceability/lookups` (`@RequirePermission('STOCK_TRACEABILITY', 'VIEW')`) — returns active items, warehouses, bins, UOMs, suppliers, customers, and work orders.
     * `GET /inventory/traceability/batches` (`@RequirePermission('STOCK_TRACEABILITY', 'VIEW')`) — paginated listing with filtering by `qcStatus`, `itemId`, `supplierId`, and free-text search across batch number, heat number, item, and MTC.
     * `GET /inventory/traceability/serials` (`@RequirePermission('STOCK_TRACEABILITY', 'VIEW')`) — paginated listing of serialized units with status, batch, and customer linkages.
     * `GET /inventory/traceability/genealogy` (`@RequirePermission('STOCK_TRACEABILITY', 'VIEW')`) — listing of parent-child transformations.
     * `GET /inventory/traceability/explore` (`@RequirePermission('STOCK_TRACEABILITY', 'DRILLDOWN')`) — master 360-degree multi-tier explorer assembling target batch, matching serial, upstream parents, downstream children, physical stock movement ledger audit trail, and DAG graph nodes & edges.
     * `POST /inventory/traceability/batches` (`@RequirePermission('STOCK_TRACEABILITY', 'REGISTER_BATCH')`) — registers batch quality passport with spectrometry chemical elements and mechanical test results.
     * `POST /inventory/traceability/serials` (`@RequirePermission('STOCK_TRACEABILITY', 'REGISTER_SERIAL')`) — registers serialized unit with barcode and RFID tag.
     * `POST /inventory/traceability/genealogy` (`@RequirePermission('STOCK_TRACEABILITY', 'REGISTER_BATCH')`) — creates parent-child transformation link between batches.
3. **Frontend Architecture (`frontend/src/pages/inventory/TraceabilityMasterPage.tsx`):**
   * Accessible at route `/inventory/traceability` under `INVENTORY & WMS` with `Network` icon and `'Live'` badge.
   * Built with `<PermissionGate screen="STOCK_TRACEABILITY">`.
   * 4 KPI summary cards (`Tracked Batches & Lots`, `Certified Melt Heats`, `Serialized Units Registry`, `Genealogy Transformations`).
   * 360° Quick-Search Bar with 1-click sample query pills (`MELT-8821`, `HEAT-JSW-SS316-9812`, `BAT-WIP-VLV-01`, `FG-VLV-2026-01`, `VLV-2627-0001`).
   * 3 Primary Tab Views:
     * **Tab 1: 360° Traceability Explorer:** Interactive Visual DAG flowchart (Supplier -> Melt Heat -> Machining WIP -> Serialized Delivery), MTC Quality Passport (EN 10204 3.1) with 8-element chemical composition matrix, mechanical tensile/hardness tests, NDE certifications, and chronological physical stock movement ledger audit trail.
     * **Tab 2: Batches & MTC Quality Register:** Master table with QC status filters, current stock quantities, MTC numbers, and 1-click exploration.
     * **Tab 3: Serialized Units Register:** Unit registry tracking serial numbers, barcodes, RFIDs, warehouse/bins, delivery challans, invoices, and client warranties.
   * Modals:
     * **Register Batch Quality Passport Modal (`Plus`):** Full chemical spectrometry (% C, Mn, Si, P, S, Cr, Ni, Mo) and mechanical property entry.
     * **Register Serial Unit Modal (`Barcode`):** Serial number, barcode, and RFID registration.
     * **Link Genealogy Modal (`Link`):** Parent-child transformation mapping with transformation types (`RAW_TO_WIP`, `WIP_TO_FG`, `BLENDING`, `REWORK`, `SPLIT`).
     * **Statutory EN 10204 Type 3.1 & ISO 9001:2015 Material Inspection Certificate (`PRINT`):** Formatted printable sheet with company letterhead, CIN, GSTIN, chemical spectrometry table against specified limits, mechanical test results, ASTM/ASME standards citations, compliance statements, and 3-tier authorized signatory blocks (Metallurgical QA Engineer, Head of QA, Plant Manager / Director).


### 2.43 Inventory Aging, Dead Stock Analysis & Reorder Level Alert Dashboard (`/inventory/aging`)
1. **Database Schema & DDL Objects (`dbscripts/01_schema_objects.sql`):**
   * Tables:
     * `tbl_inv_stock_provision_header`:
       * Primary Key: `provision_id` BIGINT (`seq_inv_provision_id`, starts at 1001).
       * Multi-tenant: `company_id` BIGINT NOT NULL REFERENCES `tbl_sec_company(company_id)`, `branch_id` BIGINT NOT NULL REFERENCES `tbl_sec_branch(branch_id)`.
       * Review Identification: `provision_no` VARCHAR(50) NOT NULL, `provision_date` DATE NOT NULL DEFAULT CURRENT_DATE, `valuation_date` DATE NOT NULL DEFAULT CURRENT_DATE.
       * Filter Scope: `warehouse_id` BIGINT REFERENCES `tbl_inv_warehouse(warehouse_id)`, `category_id` BIGINT REFERENCES `tbl_inv_item_category(category_id)`.
       * Totals & Valuation Brackets: `total_items_evaluated` INT NOT NULL DEFAULT 0, `total_gross_valuation` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `fresh_stock_value` NUMERIC(14,2) NOT NULL DEFAULT 0.00 (0-30 Days), `normal_stock_value` NUMERIC(14,2) NOT NULL DEFAULT 0.00 (31-60 Days), `slow_moving_value` NUMERIC(14,2) NOT NULL DEFAULT 0.00 (61-90 Days), `stagnant_stock_value` NUMERIC(14,2) NOT NULL DEFAULT 0.00 (91-180 Days), `dormant_stock_value` NUMERIC(14,2) NOT NULL DEFAULT 0.00 (181-365 Days), `dead_stock_value` NUMERIC(14,2) NOT NULL DEFAULT 0.00 (>365 Days).
       * Write-Down Provisions: `recommended_provision_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `approved_provision_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00.
       * Lifecycle & Approvals: `status` VARCHAR(25) NOT NULL DEFAULT `'DRAFT'` (`DRAFT`, `SUBMITTED`, `APPROVED`, `REJECTED`, `POSTED`), `reviewed_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `reviewed_at` TIMESTAMPTZ, `approved_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `approved_at` TIMESTAMPTZ.
       * Compliance & Audit: `audit_standard_citation` VARCHAR(150) NOT NULL DEFAULT `'Ind AS 2 (Inventories) & CARO 2020 Clause 3(ii)'`, `provision_policy_matrix` JSONB, `remarks` VARCHAR(500), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns.
       * Constraints: Unique constraint on `(comp_id, branch_id, provision_no)`.
     * `tbl_inv_stock_provision_item`:
       * Primary Key: `provision_item_id` BIGINT (`seq_inv_provision_item_id`, starts at 1001).
       * Foreign Keys: `provision_id` BIGINT NOT NULL REFERENCES `tbl_inv_stock_provision_header(provision_id)` ON DELETE CASCADE, `item_id` BIGINT NOT NULL REFERENCES `tbl_inv_item(item_id)`, `warehouse_id` BIGINT NOT NULL REFERENCES `tbl_inv_warehouse(warehouse_id)`, `bin_id` BIGINT REFERENCES `tbl_inv_storage_bin(bin_id)`, `uom_id` BIGINT NOT NULL REFERENCES `tbl_inv_uom(uom_id)`.
       * Item & Lot Data: `item_code` VARCHAR(50) NOT NULL, `item_name` VARCHAR(200) NOT NULL, `batch_no` VARCHAR(100), `heat_no` VARCHAR(100).
       * Stock & Valuation: `on_hand_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `unit_cost` NUMERIC(14,4) NOT NULL DEFAULT 0.0000, `gross_valuation` NUMERIC(14,2) NOT NULL DEFAULT 0.00.
       * Aging & FSN: `first_inward_date` DATE, `last_movement_date` DATE, `age_in_days` INT NOT NULL DEFAULT 0, `aging_bracket` VARCHAR(30) NOT NULL DEFAULT `'0_30'` (`0_30`, `31_60`, `61_90`, `91_180`, `181_365`, `GT_365`), `fsn_classification` VARCHAR(20) NOT NULL DEFAULT `'FAST'` (`FAST`, `SLOW`, `NON_MOVING`).
       * Write-down & NRV: `provision_rate_percent` NUMERIC(5,2) NOT NULL DEFAULT 0.00, `provision_amount` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `net_realizable_value` NUMERIC(14,2) NOT NULL DEFAULT 0.00, `justification` VARCHAR(250), `remarks` VARCHAR(250), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns.
       * Constraints: Unique constraint on `(provision_id, item_id, warehouse_id, batch_no)`.
   * Sequences: `seq_inv_provision_id`, `seq_inv_provision_item_id` (all starting at 1001).
   * Indexes: `idx_inv_provision_comp_branch`, `idx_inv_provision_date`, `idx_inv_provision_status`, `idx_inv_provision_wh`, `idx_inv_provision_item_prov`, `idx_inv_provision_item_item`, `idx_inv_provision_item_bracket`, `idx_inv_provision_item_fsn`.
   * Triggers: `trg_inv_stock_provision_header_updated_date` and `trg_inv_stock_provision_item_updated_date` calling `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered Screen `1042` (`STOCK_AGING`, `/inventory/aging`, `Hourglass`, sort order 42) with actions `1149` (`EXPORT`), `1150` (`PRINT`), `1151` (`PROVISION`), and `1152` (`REORDER`). Full 5-role RBAC permissions configured.
     * `03_sample_demo_data.sql`: Seeded `PROV-AHM-2627-0001` (Q1 Inventory Aging & Valuation Review, total valuation ₹445,450.00 across 6 demo items showcasing all aging brackets and FSN categories with recommended provision of ₹39,935.00).
2. **Backend Architecture & API Contracts (`backend/src/modules/inventory/aging/`):**
   * Controller: `StockAgingController` mapped to `/api/v1/inventory/aging`.
   * Service: `StockAgingService` injecting `PG_POOL`, `DrizzleDb`, and `AuditLogService`.
   * Endpoints:
     * `GET /inventory/aging/summary` (`@RequirePermission('STOCK_AGING', 'VIEW')`) — returns KPI metrics (`totalInventoryValuation`, `totalTrackedLines`, `totalTrackedSkus`, `agingBrackets`, `fsnAnalysis`, `reorderAlerts`, `provisioning`).
     * `GET /inventory/aging/lookups` (`@RequirePermission('STOCK_AGING', 'VIEW')`) — returns active warehouses, categories, items, UOMs, suppliers, and departments.
     * `GET /inventory/aging/analysis` (`@RequirePermission('STOCK_AGING', 'VIEW')`) — returns dynamically calculated item-level aging and FSN velocity table filtered by bracket, warehouse, and category.
     * `GET /inventory/aging/reorder-alerts` (`@RequirePermission('STOCK_AGING', 'VIEW')`) — returns SKUs with deficit stock below ROP or Safety buffer with estimated replenishment valuation.
     * `POST /inventory/aging/trigger-pr` (`@RequirePermission('STOCK_AGING', 'REORDER')`) — 1-Click Purchase Requisition generator inserting into `tbl_pr_header` and `tbl_pr_item` (`PR-AHM-2627-XXXX`).
     * `GET /inventory/aging/provisions` (`@RequirePermission('STOCK_AGING', 'VIEW')`) — listing of formal valuation reviews.
     * `GET /inventory/aging/provisions/:id` (`@RequirePermission('STOCK_AGING', 'VIEW')`) — single review with item schedule.
     * `POST /inventory/aging/provisions` (`@RequirePermission('STOCK_AGING', 'PROVISION')`) — creates new valuation write-down review (`PROV-AHM-2627-XXXX`).
     * `POST /inventory/aging/provisions/:id/approve` (`@RequirePermission('STOCK_AGING', 'PROVISION')`) — approves provision proposal with sign-off stamp.
3. **Frontend Architecture (`frontend/src/pages/inventory/AgingDashboardPage.tsx`):**
   * Accessible at route `/inventory/aging` under `INVENTORY & WMS` with `Hourglass` icon and `'Live'` badge.
   * Built with `<PermissionGate screen="STOCK_AGING">`.
   * 4 KPI summary cards (`Gross Inventory Valuation`, `Active Fresh Stock`, `Slow & Dead Stock`, `Critical ROP & Safety Alerts`).
   * Visual interactive multi-segment colored progress bar representing capital allocation across the 6 aging brackets with 1-click filter.
   * 4 Primary Tab Views:
     * **Tab 1: Inventory Aging & FSN Matrix:** Itemized SKU/batch grid with age in days, bracket badges, FSN velocity badges, unit rates, gross valuations, provision percentages, and net realizable values.
     * **Tab 2: Reorder Point & Safety Stock Alerts Console:** Live buffer alert list with stockout warnings, ROP deficit calculations, lead time, and 1-Click "Trigger PR" button.
     * **Tab 3: Dead Stock & Provisioning Register (Ind AS 2 / CARO 2020):** List of historical and active provisioning reviews with item schedules and approval triggers.
     * **Tab 4: Warehouse & Category Distribution:** Multi-warehouse and category valuation breakdown.
   * Modals:
     * **Run New Valuation Review Modal (`PROVISION`):** Customizable percentage provision rules per bracket with automatic line-item calculation.
     * **1-Click Purchase Requisition Modal (`REORDER`):** Pre-filled PR indent form creating official purchase requisitions for deficit SKUs.
     * **Statutory CARO 2020 & Ind AS 2 Inventory Valuation Certificate (`PRINT`):** Formatted printable sheet with company letterhead, CIN, GSTIN, aging bracket schedule, write-down amount in words, statutory management attestation, and 3-tier authorized signatory blocks (Store Officer, Cost Accountant, CFO / Statutory Auditor).

---

### 2.44 In-Process & Stage-Wise Quality Inspection Architecture (`/quality/in-process-qc`)
1. **Database Schema & Relational Model:**
   * Tables Created:
     * `tbl_qc_in_process_header` (Section 86):
       * Primary Key: `ipqc_id` BIGINT (`seq_qc_in_process_id`, starts at 1001).
       * Document Number: `ipqc_no` VARCHAR(50) NOT NULL (e.g. `IPQC-AHM-2627-0001`).
       * Date & Context: `ipqc_date` DATE NOT NULL DEFAULT CURRENT_DATE.
       * Relational Links: `wo_id` BIGINT NOT NULL REFERENCES `tbl_mfg_wo_header(wo_id)`, `job_card_id` BIGINT REFERENCES `tbl_mfg_job_card(job_card_id)`, `wo_routing_op_id` BIGINT REFERENCES `tbl_mfg_wo_routing_op(wo_routing_op_id)`, `item_id` BIGINT NOT NULL REFERENCES `tbl_inv_item(item_id)`, `work_center_id` BIGINT REFERENCES `tbl_mfg_work_center(work_center_id)`, `machine_id` BIGINT REFERENCES `tbl_mfg_work_center_machine(wc_machine_id)`, `assigned_operator_id` BIGINT REFERENCES `tbl_sec_user(user_id)`, `inspector_id` BIGINT NOT NULL REFERENCES `tbl_sec_user(user_id)`.
       * Stage & Shift: `inspection_stage` VARCHAR(40) NOT NULL DEFAULT `'STAGE_COMPLETION'` (`FIRST_PIECE`, `PATROL_INSPECTION`, `STAGE_COMPLETION`, `LAST_PIECE`), `shift_name` VARCHAR(30) NOT NULL DEFAULT `'Shift A'`.
       * Heat & Batch: `batch_no` VARCHAR(100), `heat_no` VARCHAR(100).
       * Quantities: `lot_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `sample_size` INT NOT NULL DEFAULT 5, `accepted_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `rejected_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `rework_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000.
       * Verdict & Concession: `overall_result` VARCHAR(30) NOT NULL DEFAULT `'PENDING'` (`PENDING`, `ACCEPTED`, `REJECTED`, `ACCEPTED_UNDER_DEVIATION`), `disposition_type` VARCHAR(50) DEFAULT `'DIRECT_ACCEPT'` (`DIRECT_ACCEPT`, `SCRAP`, `REWORK_SAME_OP`, `REWORK_NEW_OP`, `CONCESSION_USE_AS_IS`), `deviation_reason` VARCHAR(500), `approver_id` BIGINT REFERENCES `tbl_sec_user(user_id)`, `approval_date` TIMESTAMPTZ, `is_capa_required` BOOLEAN NOT NULL DEFAULT FALSE, `ncr_no` VARCHAR(50), `remarks` VARCHAR(500), `status` VARCHAR(25) NOT NULL DEFAULT `'DRAFT'` (`DRAFT`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns.
       * Constraint: Unique constraint on `(comp_id, branch_id, ipqc_no)`.
     * `tbl_qc_in_process_param` (Section 87):
       * Primary Key: `ipqc_param_id` BIGINT (`seq_qc_in_process_param_id`, starts at 1001).
       * Foreign Key: `ipqc_id` BIGINT NOT NULL REFERENCES `tbl_qc_in_process_header(ipqc_id)` ON DELETE CASCADE.
       * Characteristic Spec: `param_sequence` INT NOT NULL DEFAULT 1, `param_name` VARCHAR(150) NOT NULL, `param_category` VARCHAR(50) NOT NULL DEFAULT `'DIMENSIONAL'` (`DIMENSIONAL`, `METALLURGICAL`, `SURFACE_FINISH`, `VISUAL`, `FUNCTIONAL`, `TORQUE_TENSION`), `instrument_name` VARCHAR(150), `nominal_val` NUMERIC(12,4), `min_tolerance` NUMERIC(12,4), `max_tolerance` NUMERIC(12,4), `uom_code` VARCHAR(20) DEFAULT `'mm'`.
       * 5-Point Observations: `obs_val_1` to `obs_val_5` NUMERIC(12,4), `mean_val` NUMERIC(12,4), `visual_result` VARCHAR(20) DEFAULT `'PASS'`, `param_result` VARCHAR(20) NOT NULL DEFAULT `'PASS'` (`PASS`, `FAIL`, `CONCESSION`), `deviation_remarks` VARCHAR(250), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns.
   * Sequences: `seq_qc_in_process_id`, `seq_qc_in_process_param_id` (starting at 1001).
   * Indexes: `idx_qc_in_process_comp_branch`, `idx_qc_in_process_wo`, `idx_qc_in_process_jc`, `idx_qc_in_process_item`, `idx_qc_in_process_status`, `idx_qc_in_process_result`, `idx_qc_in_process_dates`, `idx_qc_in_process_param_header`, `idx_qc_in_process_param_result`.
   * Triggers: `trg_qc_in_process_header_updated_date` and `trg_qc_in_process_param_updated_date` calling `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered Screen `1043` (`IN_PROCESS_QC`, `/quality/in-process-qc`, `CheckCircle2`, sort order 43) with actions `1153` (`EXPORT`), `1154` (`PRINT`), `1155` (`APPROVE`), and `1156` (`DEVIATION`). Doc Series `AHM-IPQC-2627` added to `tbl_sys_doc_number_series`. Full 5-role RBAC permissions configured.
     * `03_sample_demo_data.sql`: Seeded `IPQC-AHM-2627-0001` (Accepted Stage Completion on WO-1001 / JC-1001 OP-10 with 5 characteristics), `IPQC-AHM-2627-0002` (First-Piece Setup with Concession on OP-20), and `IPQC-AHM-2627-0003` (In-Progress Hydro Pressure Hold on OP-30).
2. **Backend Architecture & API Contracts (`backend/src/modules/quality/in-process-qc/`):**
   * Controller: `InProcessQcController` mapped to `/api/v1/quality/in-process-qc`.
   * Service: `InProcessQcService` injecting `PG_POOL` and `AuditLogService`.
   * Endpoints:
     * `GET /quality/in-process-qc/summary` (`@RequirePermission('IN_PROCESS_QC', 'VIEW')`) — KPI metrics (`totalInspections`, `firstPieceApproved`, `deviationCount`, `rejectedCount`, `activePendingCount`).
     * `GET /quality/in-process-qc/lookups` (`@RequirePermission('IN_PROCESS_QC', 'VIEW')`) — work orders, active job cards, work centers, machines, users, and items.
     * `GET /quality/in-process-qc/:id` (`@RequirePermission('IN_PROCESS_QC', 'VIEW')`) — single inspection protocol with full characteristic parameter matrix and observations.
     * `GET /quality/in-process-qc` (`@RequirePermission('IN_PROCESS_QC', 'VIEW')`) — multi-parameter filtered query with WO/JC/item joins and pass/fail counts.
     * `POST /quality/in-process-qc` (`@RequirePermission('IN_PROCESS_QC', 'ADD')`) — atomic creation of header and parameter rows with auto document numbering.
     * `PUT /quality/in-process-qc/:id` (`@RequirePermission('IN_PROCESS_QC', 'EDIT')`) — updates header and parameter rows while in draft/in-progress.
     * `POST /quality/in-process-qc/:id/approve` (`@RequirePermission('IN_PROCESS_QC', 'APPROVE')`) — records QA verdict, updates `tbl_mfg_job_card` QC status, inspector ID, accepted/rejected quantities, and marks inspection `COMPLETED`.
     * `POST /quality/in-process-qc/:id/deviation` (`@RequirePermission('IN_PROCESS_QC', 'DEVIATION')`) — authorizes technical concession / engineering waiver, sets verdict `ACCEPTED_UNDER_DEVIATION`, and updates job card to `DEVIATION_ACCEPTED`.
     * `DELETE /quality/in-process-qc/:id` (`@RequirePermission('IN_PROCESS_QC', 'DELETE')`) — soft-cancels inspection and resets job card QC status.
3. **Frontend Architecture (`frontend/src/pages/quality/InProcessQcMasterPage.tsx`):**
   * Accessible at route `/quality/in-process-qc` under `QUALITY ASSURANCE & QC` with `CheckCircle2` icon and `'Live'` badge.
   * Built with `<PermissionGate screen="IN_PROCESS_QC">`.
   * 4 KPI summary cards (`Total Stage Inspections`, `1st Piece Setup Passes`, `Concessions & Deviations`, `Stage Rejections & Scraps`).
   * Filter toolbar with search, stage dropdown, verdict dropdown, and status dropdown.
   * Tab-based view (`All Inspections`, `1st-Piece Setup Approvals`, `Technical Concessions & Deviations`, `Rejections & Scraps`).
   * Dynamic Characteristic Parameter Matrix:
     * Interactive 5-point observation entry (`Obs 1` to `Obs 5`) with live calculated average (`Mean`).
     * Auto tolerance evaluation: Real-time visual comparison of mean value against tolerance boundaries (`PASS` in emerald, `FAIL` in rose).
     * 1-Click parameter presets: Dimensional, Surface Roughness Ra, Rockwell Hardness, Visual Flaw Check.
   * Modals:
     * **Record / Edit Stage Inspection Modal (`ADD` / `EDIT`):** Header configuration and dynamic multi-row parameter matrix.
     * **Inspection Passport Detail Modal (`VIEW`):** Full characteristic inspection data with gauge details.
     * **Approval & Gating Modal (`APPROVE`):** Quantities, material disposition, CAPA mandate, and job card synchronization.
     * **Engineering Concession / Deviation Modal (`DEVIATION`):** Technical justification waiver and Use-As-Is disposition.
     * **Statutory ISO 9001 / IATF 16949 Stage Inspection Certificate (`PRINT`):** Formatted printable report with company header, part number, heat/batch passport, 5-point observations, tolerance limits, and 3-tier authorized signatory blocks (Operator, Inspector, QA Manager).
     * **Confirm Cancel Modal (`DELETE`):** Safe cancellation modal with job card status reset.


---

### 2.45 Pre-Dispatch Quality Inspection (PDI) & Certificate of Analysis (CoA) Architecture (`/quality/pdi`)
1. **Database Schema & Relational Model:**
   * Tables Created:
     * `tbl_qc_pdi_header` (Section 88):
       * Primary Key: `pdi_id` BIGINT (`seq_qc_pdi_id`, starts at 1001).
       * Document Number: `pdi_no` VARCHAR(50) NOT NULL (e.g. `PDI-AHM-2627-0001`).
       * Date & Context: `pdi_date` DATE NOT NULL DEFAULT CURRENT_DATE.
       * Relational Links: `sales_order_id` BIGINT REFERENCES `tbl_sales_order_header(so_id)`, `customer_id` BIGINT NOT NULL REFERENCES `tbl_crm_party(party_id)`, `wo_id` BIGINT REFERENCES `tbl_mfg_wo_header(wo_id)`, `challan_id` BIGINT REFERENCES `tbl_sales_delivery_challan_header(challan_id)`, `item_id` BIGINT NOT NULL REFERENCES `tbl_inv_item(item_id)`, `warehouse_id` BIGINT NOT NULL REFERENCES `tbl_inv_warehouse(warehouse_id)`, `inspector_id` BIGINT NOT NULL REFERENCES `tbl_sec_user(user_id)`.
       * Heat & Melt Tracking: `batch_no` VARCHAR(100), `heat_no` VARCHAR(100).
       * Inspection Quantities: `lot_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `sample_size` INT NOT NULL DEFAULT 5, `accepted_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `rejected_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000, `rework_qty` NUMERIC(14,3) NOT NULL DEFAULT 0.000.
       * Verdict & Commercial Gating: `overall_verdict` VARCHAR(30) NOT NULL DEFAULT `'PENDING'` (`PENDING`, `APPROVED_FOR_DISPATCH`, `REJECTED_QUARANTINE`, `CONCESSION_ACCEPTED`), `disposition` VARCHAR(50) DEFAULT `'CLEAR_FOR_INVOICE'` (`CLEAR_FOR_INVOICE`, `QUARANTINE_HOLD`, `RETURN_TO_SHOPFLOOR`, `SCRAP`, `CONCESSION_USE_AS_IS`).
       * Approval & Certification: `approver_id` BIGINT REFERENCES `tbl_sec_user(user_id)`, `approval_date` TIMESTAMPTZ, `coa_no` VARCHAR(50), `coa_date` DATE, `mtc_no` VARCHAR(100), `standard_specification` VARCHAR(150), `packaging_condition` VARCHAR(30) DEFAULT `'ACCEPTABLE'`, `labeling_verification` VARCHAR(20) DEFAULT `'PASS'`, `preservation_coating` VARCHAR(100).
       * Customer Witness: `customer_witness_required` BOOLEAN NOT NULL DEFAULT FALSE, `customer_witness_name` VARCHAR(100), `customer_witness_date` DATE.
       * CoA Authorization: `is_coa_released` BOOLEAN NOT NULL DEFAULT FALSE, `coa_released_by` BIGINT REFERENCES `tbl_sec_user(user_id)`, `coa_released_at` TIMESTAMPTZ, `remarks` VARCHAR(500), `deviation_reason` VARCHAR(500), `status` VARCHAR(25) NOT NULL DEFAULT `'DRAFT'` (`DRAFT`, `IN_PROGRESS`, `APPROVED`, `REJECTED`, `CANCELLED`), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns.
       * Constraint: Unique constraint on `(comp_id, branch_id, pdi_no)`.
     * `tbl_qc_pdi_param` (Section 89):
       * Primary Key: `pdi_param_id` BIGINT (`seq_qc_pdi_param_id`, starts at 1001).
       * Foreign Key: `pdi_id` BIGINT NOT NULL REFERENCES `tbl_qc_pdi_header(pdi_id)` ON DELETE CASCADE.
       * Characteristic Spec: `param_sequence` INT NOT NULL DEFAULT 1, `param_name` VARCHAR(150) NOT NULL, `param_category` VARCHAR(50) NOT NULL DEFAULT `'FUNCTIONAL'` (`DIMENSIONAL`, `FUNCTIONAL_PRESSURE`, `SURFACE_PAINT_DFT`, `VISUAL_PACKAGING`, `ELECTRICAL_ACTUATOR`, `METALLURGICAL_HARDNESS`), `instrument_name` VARCHAR(150), `nominal_val` NUMERIC(12,4), `min_tolerance` NUMERIC(12,4), `max_tolerance` NUMERIC(12,4), `uom_code` VARCHAR(20) DEFAULT `'mm'`.
       * 5-Point Observations: `observed_val_1` to `observed_val_5` NUMERIC(12,4), `mean_val` NUMERIC(12,4), `visual_result` VARCHAR(20) DEFAULT `'PASS'`, `param_result` VARCHAR(20) NOT NULL DEFAULT `'PASS'` (`PASS`, `FAIL`, `CONCESSION`), `notes` VARCHAR(250), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns.
     * `tbl_qc_pdi_coa_spec` (Section 90):
       * Primary Key: `coa_spec_id` BIGINT (`seq_qc_pdi_coa_spec_id`, starts at 1001).
       * Foreign Key: `pdi_id` BIGINT NOT NULL UNIQUE REFERENCES `tbl_qc_pdi_header(pdi_id)` ON DELETE CASCADE.
       * Chemical Composition Matrix (%): `elem_c_pct`, `elem_mn_pct`, `elem_si_pct`, `elem_p_pct`, `elem_s_pct`, `elem_cr_pct`, `elem_ni_pct`, `elem_mo_pct` NUMERIC(6,4).
       * Mechanical Properties Matrix: `yield_strength_mpa` NUMERIC(8,2), `tensile_strength_mpa` NUMERIC(8,2), `elongation_pct` NUMERIC(6,2), `hardness_val` VARCHAR(30), `impact_energy_joules` NUMERIC(8,2).
       * Hydrostatic Hold Pressure: `hydro_shell_test_bar` NUMERIC(8,2), `hydro_seat_test_bar` NUMERIC(8,2), `air_seat_test_bar` NUMERIC(8,2).
       * NDE & Metallurgy: `nde_test_type` VARCHAR(100), `nde_result` VARCHAR(20) DEFAULT `'ACCEPTED'`, `lab_name` VARCHAR(150), `certified_engineer` VARCHAR(100), `certification_standard` VARCHAR(100), `is_active` BOOLEAN NOT NULL DEFAULT TRUE, 7 mandatory audit columns.
   * Sequences: `seq_qc_pdi_id`, `seq_qc_pdi_param_id`, `seq_qc_pdi_coa_spec_id` (starting at 1001).
   * Indexes: `idx_qc_pdi_comp_branch`, `idx_qc_pdi_so`, `idx_qc_pdi_customer`, `idx_qc_pdi_item`, `idx_qc_pdi_status`, `idx_qc_pdi_verdict`, `idx_qc_pdi_coa`, `idx_qc_pdi_dates`, `idx_qc_pdi_param_pdi`, `idx_qc_pdi_param_result`, `idx_qc_pdi_coa_spec_pdi`.
   * Triggers: `trg_qc_pdi_header_updated_date`, `trg_qc_pdi_param_updated_date`, and `trg_qc_pdi_coa_spec_updated_date` calling `fn_set_updated_timestamp()` in `dbscripts/triggers/trg_set_updated_timestamp.sql`.
   * Seeds:
     * `02_initial_data.sql`: Registered Screen `1044` (`PDI_QC`, `/quality/pdi`, `ShieldCheck`, sort order 44) with actions `1157` (`EXPORT`), `1158` (`PRINT`), `1159` (`APPROVE`), and `1160` (`RELEASE`). Registered Document Number Series `AHM-PDI-2627` (prefix `PDI-AHM-2627-`) and `AHM-COA-2627` (prefix `COA-AHM-2627-`). Full 5-role RBAC permissions configured.
     * `03_sample_demo_data.sql`: Seeded `PDI-AHM-2627-0001` (Cleared for Dispatch with released `COA-AHM-2627-0001` on SO-1001 / WO-1001 for Reliance Industries), `PDI-AHM-2627-0002` (Pending PDI inspection on SO-1002 for L&T Heavy Engineering), and `PDI-AHM-2627-0003` (Concession accepted under deviation on SO-1003 for Bharat Petroleum Corporation).
2. **Backend Architecture & API Contracts (`backend/src/modules/quality/pdi/`):**
   * Controller: `PdiController` mapped to `/api/v1/quality/pdi`.
   * Service: `PdiService` injecting `PG_POOL` and `AuditLogService`.
   * Endpoints:
     * `GET /quality/pdi/summary` (`@RequirePermission('PDI_QC', 'VIEW')`) — KPI metrics (`totalInspections`, `approvedForDispatch`, `releasedCoas`, `concessionCount`, `quarantineHoldCount`, `activePendingCount`).
     * `GET /quality/pdi/lookups` (`@RequirePermission('PDI_QC', 'VIEW')`) — customers, sales orders, work orders, delivery challans, items, warehouses, and users.
     * `GET /quality/pdi/:id` (`@RequirePermission('PDI_QC', 'VIEW')`) — full PDI document including characteristic parameter matrix and CoA chemical/mechanical specification.
     * `GET /quality/pdi` (`@RequirePermission('PDI_QC', 'VIEW')`) — multi-parameter filtered query with customer/item/warehouse/order joins and pass/fail counts.
     * `POST /quality/pdi` (`@RequirePermission('PDI_QC', 'ADD')`) — atomic creation of header, parameter rows, and optional CoA specification with auto document numbering.
     * `PUT /quality/pdi/:id` (`@RequirePermission('PDI_QC', 'EDIT')`) — updates header, parameters, and CoA specification while in draft/in-progress.
     * `POST /quality/pdi/:id/approve` (`@RequirePermission('PDI_QC', 'APPROVE')`) — records QA verdict, accepted/rejected quantities, material disposition, and optionally publishes CoA document.
     * `POST /quality/pdi/:id/release-coa` (`@RequirePermission('PDI_QC', 'RELEASE')`) — digitally publishes and stamps Certificate of Analysis document (`is_coa_released = TRUE`).
     * `DELETE /quality/pdi/:id` (`@RequirePermission('PDI_QC', 'DELETE')`) — soft-cancels unreleased PDI inspection.
3. **Frontend Architecture (`frontend/src/pages/quality/PdiMasterPage.tsx`):**
   * Accessible at route `/quality/pdi` under `QUALITY ASSURANCE & QC` with `ShieldCheck` icon and `'Live'` badge.
   * Built with `<PermissionGate screen="PDI_QC">`.
   * 4 KPI summary cards (`Total PDI Lots`, `Released CoAs & Cleared`, `Concessions & Deviations`, `Quarantine Holds`).
   * Tab-based view (`All PDI Lots`, `Released CoAs`, `Concessions & Deviations`, `Quarantine Holds`).
   * Filter toolbar with search, customer dropdown, verdict dropdown, and warehouse dropdown.
   * High-density `<MasterDataTable<PdiRecord>>` featuring grouping, sorting, search predicate, and row actions.
   * Modals:
     * **Record / Edit PDI Modal (`ADD` / `EDIT`):** Customer & Sales Order linkage, product traceability, packaging & preservation condition, dynamic parameter grid, and 8-element chemical/mechanical matrix entry.
     * **Quality Passport Modal (`VIEW`):** Comprehensive view of test readings, mean values, and chemical/mechanical properties.
     * **Pre-Dispatch Gating & Disposition Modal (`APPROVE`):** Overall verdict selection, accepted/rejected quantities, concession justification, and 1-click CoA release.
     * **Release Certificate of Analysis Modal (`RELEASE`):** Official digital release and authorization of EN 10204 Type 3.1 certificate.
     * **Statutory Certificate of Analysis Printable Report (`PRINT`):** ISO 9001:2015 & EN 10204:2004 Type 3.1 compliant legal inspection certificate with corporate letterhead, customer order reference, chemical ladle analysis, mechanical properties, hydrostatic hold pressure tests, NDE examination, and 3-tier authorized signatures (QC Inspector, TPI Third Party Witness, Head of QA).
     * **Confirm Delete Modal (`DELETE`):** Safe cancellation modal for unreleased inspection records.
