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

