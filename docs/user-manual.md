# KS-MFG Web ERP - End-User Operational Manual

**Document Version:** 1.0.0  
**Target Audience:** Plant Managers, Production Supervisors, Warehouse Keepers, Quality Inspectors, Procurement & Sales Clerks  

---

## 1. System Overview & Navigation Basics

Welcome to **KS-MFG ERP**, the comprehensive manufacturing and inventory management portal.

### 1.1 Accessing the Application
* **Browser Requirements:** Google Chrome, Microsoft Edge, or Mozilla Firefox (latest versions recommended).
* **Logging In:**
  1. Open your assigned ERP web address.
  2. Enter your authorized `Username` and `Password`.
  3. Upon successful authentication, the system opens the main operations dashboard.

### 1.2 Company & Branch Switcher
* If you have access to multiple companies or manufacturing branches:
  1. Locate the **Branch Selector** in the top navigation bar.
  2. Click the dropdown to switch to your target branch.
  3. The system instantly loads the active branch context, roles, and allowed warehouse locations.

---

## 2. Screen & Feature Operational Guides

*(Note: As each screen and feature is implemented step-by-step, its operational user manual will be appended here.)*

### 2.0 Template Structure for Each Screen
When a new screen is released, this manual provides:
* **Purpose:** What business activity this screen performs.
* **Prerequisites:** What master data must exist before using this screen.
* **Step-by-Step Usage:**
  1. Entering header details.
  2. Adding line items, selecting dynamic units, and verifying conversions.
  3. Allocating batch/serial numbers and selecting warehouse bins.
* **Action Buttons Guide:** Explanations of `Save Draft`, `Submit`, `Authorize`, `Print`, and `Export`.
* **Troubleshooting & FAQs:** Common validation errors and resolutions.

---

### 2.1 Authentication, Multi-Branch Context Switching & Theme Personalization (Step 0.1)

* **Purpose:** Authenticate users into KS-MFG ERP, resolve their authorized Company, Branch, and Financial Year context, load granular role permissions, and persist personal UI theme preferences.
* **Default Root Super Admin Credentials:**
  * **Username / Email:** `admin` or `admin@ksmfg.com`
  * **Password:** `Admin@123`
* **Multi-Company / Branch / Financial Year Switching:**
  * Upon login, your active **Company** (`KSMFG - Kashvira Manufacturing ERP`), **Branch** (`PLT-AHM-01 - Ahmedabad Main Plant & HO`), and **Financial Year** (`FY 2026-2027`) are automatically loaded.
  * Switching Company, Branch, or Financial Year validates your assigned roles (`tbl_sec_user_company_role` and `tbl_sec_user_branch_role`) and refreshes your active screen and action permissions immediately.
* **Theme Mode & Color Personalization:**
  * Users can choose between **Light**, **Dark**, or **System** mode and select from 6 brand palettes (**Indigo**, **Blue**, **Emerald**, **Violet**, **Amber**, **Rose**) plus default sidebar collapsed/expanded state.
  * Changes are saved directly to your user profile in the database (`tbl_sec_user_preference`) with full audit trail tracking.

---

### 2.2 Application Shell, Hover-to-Peek Sidebar, Login & Plant Dashboard (Step 0.2)

* **Split Login Screen (`/login`):**
  * Left panel displays KS-MFG ERP enterprise capabilities and architecture pillars; right panel provides credential login (`admin` / `Admin@123`) and quick Light/Dark theme toggle.
* **Hover-to-Peek Collapsible Sidebar (`AppShell`):**
  * Click the collapse toggle in the sidebar header to switch between **Pinned Expanded (256px)** and **Compact Icon Rail (72px)**.
  * When collapsed, hovering your mouse over the icon rail smoothly expands the full menu drawer (`hover-expanded`) with group headers without shifting page layout; clicking any menu item immediately collapses the sidebar back to the 72px rail and opens the selected screen.
* **Header Context Switcher:**
  * Click the **Company / Branch / Financial Year** selector in the top header to switch between authorized companies (`KSMFG`, `KSAUTO`), branches (`PLT-AHM-01`, `PLT-RAJ-02`, `PLT-PNQ-01`), and accounting periods (`FY 2026-2027`, `FY 2025-2026`). Locked financial years display an amber `Read-Only Period` badge.
* **Plant Operations Dashboard (`/dashboard`) & Customer Master (`/parties/customers`):**
  * Displays real-time work order KPIs, OEE & yield metrics, monthly production attainment chart, multi-level warehouse zone occupancy, and active shopfloor batch execution table.

---

### 2.3 Company Master Screen (`/org/companies` — Step 1.1)

* **Purpose:** Manage legal manufacturing entities (`tbl_org_company`) including GSTIN, PAN, CIN, Import-Export Code (IEC), MSME Udyam registration, registered address, and base currency.
* **Step-by-Step Usage:**
  1. Navigate to **Organization $\rightarrow$ Company Master** (`/org/companies`).
  2. Use the search bar, **State Filter**, **Status Filter**, or **Group By** selector (`Registered State` or `Operational Status`) to inspect existing companies.
  3. Click **+ Add Company** to create a new legal entity. Entering a 15-character **GSTIN** automatically populates the **GST State Code**, **State Name**, and 10-character **PAN Number**.
  4. Click the **Edit** icon on any row to update company details; all field changes are recorded as JSONB `old_value` / `new_value` deltas in `tbl_sys_audit_log`.
  5. Click the **Delete** icon to remove an unused company. If the company has linked Branches, Financial Years, or User Role assignments, deletion is automatically blocked with an HTTP `409 Conflict` breakdown showing exact child record counts.
* **Action Buttons:** `Print` (`COMPANY_MASTER -> PRINT`), `Export CSV` (`COMPANY_MASTER -> EXPORT`), and `+ Add Company` (`COMPANY_MASTER -> ADD`).

---

### 2.4 Branch & Plant Master Screen (`/org/branches` — Step 1.2)

* **Purpose:** Manage operational manufacturing plants, head offices, distribution warehouses, and regional sales offices (`tbl_org_branch`) linked to a parent legal Company (`comp_id`).
* **Prerequisites:** At least one active Company must exist in **Company Master** (`/org/companies`).
* **Step-by-Step Usage:**
  1. Navigate to **Organization $\rightarrow$ Branch & Plants** (`/org/branches`).
  2. Filter records by **Parent Company**, **Facility Type** (`Manufacturing Plant`, `Head Office`, `Distribution Warehouse`, `Regional Sales Office`), or **Status**, or group records by **Parent Company**, **Facility Type**, or **State / Region**.
  3. Click **+ Add Branch / Plant** to register a new facility. Selecting a Parent Company pre-fills the company's default GSTIN; entering a state-specific 15-character GSTIN automatically updates the **GST State Code** and **State Name**.
  4. Click **Edit** to update plant details; all modifications record JSONB `old_value` / `new_value` deltas in `tbl_sys_audit_log`.
  5. Click **Delete** to remove an unused branch. `DependencyCheckService` blocks deletion (`409 Conflict`) if the branch has active Financial Year mappings (`tbl_org_branch_fyear`), User Branch Role assignments (`tbl_sec_user_branch_role`), or User Default Branch preferences (`tbl_sec_user_preference`).
* **Action Buttons:** `Print` (`BRANCH_MASTER -> PRINT`), `Export CSV` (`BRANCH_MASTER -> EXPORT`), and `+ Add Branch / Plant` (`BRANCH_MASTER -> ADD`).




---

### 2.5 Financial Year Master & Branch-FY Activation/Locking Screen (`/org/financial-years` — Step 1.3)

* **Purpose:** Manage company accounting periods (`tbl_org_financial_year`), auto-provision branch period mappings (`tbl_org_branch_fyear`), and control both Company-wide Period Closing (`is_closed`) and Branch-specific Period Locking (`is_locked`) for month-end / year-end stock audit cutoffs.
* **Prerequisites:** At least one active Company (`/org/companies`) and Branch (`/org/branches`) must exist.
* **Step-by-Step Usage:**
  1. Navigate to **Organization $\rightarrow$ Financial Years** (`/org/financial-years`).
  2. Filter records by **Parent Company** or **Period Status** (`Open & Active` vs. `Closed / Locked`), or group by **Parent Company**, **Period Lock Status**, or **Operational Status**.
  3. Click **+ Add Financial Year** to create a new accounting period. Selecting an **April 1 Start Year** (e.g., `2026 -> FY 2026-27`) automatically populates `fyear_code`, `fyear_name`, `start_date` (`YYYY-04-01`), and `end_date` (`YYYY+1-03-31`). Saving a new Financial Year automatically creates open `tbl_org_branch_fyear` mapping rows for all branches belonging to that company.
  4. Click the **Branches (`X / Y Open`)** button on any row (or the Shield icon in the Actions column) to open the **Branch-Wise Period Activation & Locking** modal:
     * Toggle any individual plant/branch between **Open for Transactions** and **Branch Locked (Read-Only)**.
     * Or use **Unlock All Branches** / **Lock All Branches** to bulk-update all facilities in that company.
  5. Click the **Lock / Unlock** icon in the Actions column to toggle **Company-Wide Period Closing (`is_closed`)** across all branches simultaneously.
  6. Click **Delete** to remove an unused Financial Year. If the Financial Year has active Branch-FY mappings (`tbl_org_branch_fyear`) or User Default FY preferences (`tbl_sec_user_preference`), deletion is blocked (`409 Conflict`) with an exact dependency breakdown.
* **Action Buttons:** `Print` (`FYEAR_MASTER -> PRINT`), `Export CSV` (`FYEAR_MASTER -> EXPORT`), `Branch Period Lock` (`FYEAR_MASTER -> EDIT`), and `+ Add Financial Year` (`FYEAR_MASTER -> ADD`).
---

### 2.6 Department & Designation Master Screen (`/hr/departments` — Step 2.1)

* **Purpose:** Manage plant functional departments (`tbl_hr_department`), parent-child division hierarchies, cost centers, and job designations with cadre/grade hierarchy levels (`tbl_hr_designation`).
* **Prerequisites:** At least one active Company (`/org/companies`) must exist.
* **Step-by-Step Usage:**
  1. Navigate to **Security & RBAC $\rightarrow$ Depts & Designations** (`/hr/departments`).
  2. Switch between the two tabs at the top:
     * **Departments (`tbl_hr_department`):** Manage functional departments (`PRODUCTION`, `QUALITY`, `SUPPLY_CHAIN`, `ENGINEERING`, `MAINTENANCE`, `FINANCE_HR`, `SALES_ADMIN`), parent-child department hierarchy (`parent_dept_id`), and cost center codes.
     * **Designations & Grades (`tbl_hr_designation`):** Manage job titles, default department bindings (`dept_id`), grade bands (`E1`, `M1`, `M2`, `L1`–`L5`), and organizational hierarchy levels (`1` = Executive/Director down to `8` = Shopfloor Operator).
  3. Filter records by **Parent Company**, **Functional Category** (or **Department** on the Designations tab), and **Status**, or group records by **Parent Company**, **Functional Category**, **Department**, or **Grade Band**.
  4. Click **+ Add Department** or **+ Add Designation** to create a record, or click **Edit** on any row to modify it (recording JSONB `old_value` / `new_value` deltas in `tbl_sys_audit_log`).
  5. Click **Delete** to remove an unused Department or Designation. `DependencyCheckService` blocks deletion (`409 Conflict`) if a Department has child Sub-Departments (`tbl_hr_department.parent_dept_id`), linked Designations (`tbl_hr_designation.dept_id`), or assigned Employees (`tbl_hr_employee.dept_id`), or if a Designation has assigned Employees (`tbl_hr_employee.desig_id`).
* **Action Buttons:** `Print` (`DEPT_MASTER -> PRINT`), `Export CSV` (`DEPT_MASTER -> EXPORT`), `+ Add Department` / `+ Add Designation` (`DEPT_MASTER -> ADD`).
---

### 2.7 Employee Master Screen (`/hr/employees` — Step 2.2)

* **Purpose:** Maintain the enterprise manufacturing and corporate workforce registry (`tbl_hr_employee`), linking employees to Companies (`tbl_org_company`), Primary Plants/Branches (`tbl_org_branch`), Functional Departments (`tbl_hr_department`), Job Designations (`tbl_hr_designation`), and self-referencing Reporting Managers (`reporting_manager_id`), along with statutory identifiers (PAN, Masked Aadhaar, PF UAN, ESIC) and payroll banking details.
* **Prerequisites:** At least one active Company (`/org/companies`), Plant/Branch (`/org/branches`), Department, and Designation (`/hr/departments`) must exist.
* **Step-by-Step Usage:**
  1. Navigate to **Security & RBAC $\rightarrow$ Employee Master** (`/hr/employees`).
  2. Use the top filter bar to filter employees by **Company**, **Primary Plant / Branch**, **Department**, or **Employment Status** (`Active On-Duty`, `Serving Notice`, `Suspended / Hold`, `Relieved / Exited`), or group records inside the table by **Department**, **Primary Plant / Branch**, **Employment Type**, **Employment Status**, or **Company**.
  3. Click **+ Add Employee** to open the 3-tab Employee Registration Modal:
     * **1. Organization & Role Assignment:** Select Company, enter Employee Code (e.g., `EMP-1007`), Date of Joining, First/Last Name, Mobile Number, Primary Plant/Branch, Department, Designation, Reporting Manager, Employment Type (`PERMANENT`, `PROBATION`, `CONTRACT`, `TRAINEE`, `CONSULTANT`), and Employment Status.
     * **2. Contact, Emergency & Address:** Enter Official Work Email, Gender, Date of Birth, Blood Group, Emergency Contact Name & Phone, and Residential Address.
     * **3. Statutory (PAN/PF/ESI) & Payroll Bank:** Enter PAN, Masked Aadhaar, EPFO PF UAN, ESIC Number, Bank Name, Account Number, IFSC Code, and HR/Shopfloor Skill Remarks.
  4. Click **Edit** on any employee row to modify details (recording JSONB `old_value` / `new_value` deltas in `tbl_sys_audit_log`).
  5. Click **Delete** to remove an unused employee record. `DependencyCheckService` blocks deletion (`409 Conflict`) if the employee is assigned as a Reporting Manager for other employees (`tbl_hr_employee.reporting_manager_id`), assigned as a Department HOD (`tbl_hr_department.hod_employee_id`), or linked to an ERP Security User Account (`tbl_sec_user.linked_entity_id`).
* **Action Buttons:** `Print` (`EMPLOYEE_MASTER -> PRINT`), `Export CSV` (`EMPLOYEE_MASTER -> EXPORT`), and `+ Add Employee` (`EMPLOYEE_MASTER -> ADD`).

---

### 2.8 Global Roles & Granular Screen/Action Permissions Matrix (`/security/roles` — Step 2.3)

* **Purpose:** Define global, reusable security roles (`tbl_sec_role`) independent of Company and Branch/Plant, and configure fine-grained screen permissions (`VIEW`, `ADD`, `EDIT`, `DELETE` in `tbl_sec_role_permission`) and screen-specific action permissions (`PRINT`, `EXPORT`, etc. in `tbl_sec_role_action_permission`).
* **Prerequisites:** Core screen catalogue (`tbl_sec_screen`) and custom action definitions (`tbl_sec_action`) are seeded in `02_initial_data.sql`.
* **Step-by-Step Usage:**
  1. Navigate to **Security & RBAC $\rightarrow$ Global Roles & Matrix** (`/security/roles`).
  2. **Tab 1 — Global Roles Directory (`tbl_sec_role`):**
     * Review built-in System Roles (`SUPER_ADMIN`, `PLANT_MANAGER`, `STORE_OFFICER`, `PURCHASE_EXEC`, `SALES_EXEC`) and custom enterprise roles (`QA_MANAGER`, `HR_EXECUTIVE`, etc.), along with Screen Access Coverage bars (`X / Y Screens`), Allowed Custom Actions count, and Assigned Users count.
     * Click **+ Create Global Role** to create a new role. Optionally select **Clone Baseline Permissions From Existing Role** to copy all screen and action rights from an existing template role.
     * Click **Delete** on any custom role to remove it. Built-in system roles (`is_system_role = TRUE`) are protected from deletion, and `DependencyCheckService` blocks deletion (`409 Conflict`) if any user is mapped to the role in `tbl_sec_user_company_role` or `tbl_sec_user_branch_role`.
  3. **Tab 2 — Screen & Action Permissions Matrix (`tbl_sec_role_permission` & `tbl_sec_role_action_permission`):**
     * Click the **Matrix** button on any role row (or switch to Tab 2 and pick a role from the **Target Global Role** selector).
     * Filter screens by **ERP Module** (`DASHBOARD`, `ORGANIZATION`, `SECURITY`, `ADMINISTRATION`, `INVENTORY`, `CRM_SRM`) or search by screen/action name.
     * Use the quick bulk presets (**Grant View + Export**, **Grant Full Access**, **Revoke All**) or toggle individual checkboxes (`Row All`, `View`, `Add`, `Edit`, `Delete`, and custom action pills like `EXPORT` and `PRINT`).
     * Enabling `Add`, `Edit`, `Delete`, or any custom action automatically checks `View`; unchecking `View` automatically clears all dependent rights on that screen.
     * Click **Save Permission Matrix** to atomically persist all screen and action permissions and record a before/after delta in `tbl_sys_audit_log`.
* **Action Buttons:** `Print` (`ROLE_MASTER -> PRINT`), `Export CSV` (`ROLE_MASTER -> EXPORT`), `+ Create Global Role` (`ROLE_MASTER -> ADD`), and `Save Permission Matrix` (`ROLE_MASTER -> EDIT`).

---

### 2.9 User Master & Multi-Company / Multi-Branch Role Assignment Screen (`/security/users` — Step 2.4)

* **Purpose:** Manage ERP login accounts (`tbl_sec_user`), link accounts to HR Employee records (`tbl_hr_employee`), assign different Global Roles per Company (`tbl_sec_user_company_role`) and per Plant/Branch (`tbl_sec_user_branch_role`), and perform administrative password resets and account lockout unlocks.
* **Prerequisites:** Active Companies (`/org/companies`), Branches/Plants (`/org/branches`), Employees (`/hr/employees`), and Global Roles (`/security/roles`) must exist.
* **Step-by-Step Usage:**
  1. Navigate to **Security & RBAC $\rightarrow$ User & Role Mapping** (`/security/users`).
  2. Filter accounts by **User Category** (`EMPLOYEE`, `SYSTEM`, `PARTY`) or **Status** (`Active`, `Locked`, `Inactive`), or group records by **User Category** or **Account Status**.
  3. Click **+ Create User & Assign Roles** to open the 3-tab User & Role Assignment Modal:
     * **1. User Identity & Employee Link:** Choose User Category (`EMPLOYEE`, `SYSTEM`, `PARTY`). Selecting an Employee from the dropdown automatically populates the user's Full Name, Email, Mobile, and suggested Username. Enter an initial password (hashed with 12-round Bcrypt) and optionally toggle **Grant Global Super Admin Authority**.
     * **2. Company Role Mappings (`tbl_sec_user_company_role`):** Select a Target Company and a Global Role and click **+ Add Company Role**. Mark one company role as the user's **Default Login Company**.
     * **3. Plant / Branch Role Mappings (`tbl_sec_user_branch_role`):** Select a Company, Plant/Branch, and Global Role and click **+ Add Branch Role**. Mark one branch role as the user's **Default Plant**.
  4. Click the **Roles** button on any user row to jump directly to their Multi-Company / Multi-Branch Role Assignment tabs.
  5. Click the **Key** icon (`Reset User Password`) to set a new 12-round Bcrypt password and automatically clear any failed login lockouts. If an account is locked after 5 failed attempts, click the **Unlock** icon to immediately restore access.
  6. Click **Delete** to remove an unused user account. The Root Super Admin (`admin` / `user_id = 1001`) and the currently logged-in user cannot be deleted, and `DependencyCheckService` blocks deletion (`409 Conflict`) if the user has active Company/Branch role mappings or historical audit trail records (`tbl_sys_audit_log`).
* **Action Buttons:** `Print` (`USER_MASTER -> PRINT`), `Export CSV` (`USER_MASTER -> EXPORT`), `+ Create User & Assign Roles` (`USER_MASTER -> ADD`), `Roles / Reset Password / Unlock` (`USER_MASTER -> EDIT`), and `Delete` (`USER_MASTER -> DELETE`).
