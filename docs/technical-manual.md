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
