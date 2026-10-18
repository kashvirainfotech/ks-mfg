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

---

### 2.10 Security & Field-Delta Audit Trail Viewer (`/security/audit-logs` — Step 2.5)

* **Purpose:** Provide an immutable, read-only compliance and forensic audit explorer over `tbl_sys_audit_log` so security administrators and auditors can inspect every `LOGIN`, `LOGOUT`, `CREATE`, `UPDATE`, `DELETE`, `PRINT`, `EXPORT`, `APPROVE`, and `LOCK` event across all companies, branches/plants, modules, screens, and database tables, complete with side-by-side field-delta comparisons (`old_value` vs. `new_value`).
* **Prerequisites:** Users must have `AUDIT_LOG_VIEWER -> VIEW` permission in their active role (`SUPER_ADMIN` or granted via `/security/roles`).
* **Step-by-Step Usage:**
  1. Navigate to **Security & RBAC $\rightarrow$ Audit Trail Logs** (`/security/audit-logs`).
  2. Review the 4 top forensic KPI summary cards:
     * **Total Audit Events** (matching the active filter set, plus distinct Active Actors count).
     * **Data Mutations** (`CREATE`, `UPDATE`, `DELETE` count + breakdown).
     * **Field-Delta Captures** (events containing non-empty `changed_fields` before/after snapshots).
     * **Auth & Document Actions** (`LOGIN` / `LOGOUT` count vs. `PRINT` / `EXPORT` count).
  3. Use the **Multi-Dimensional Forensic Filter Bar** to narrow down events by:
     * **Module** (e.g., `ORGANIZATION`, `SECURITY`, `HR`, `ADMINISTRATION`, `INVENTORY`, `CRM_SRM`)
     * **Action Type** (`LOGIN`, `LOGOUT`, `CREATE`, `UPDATE`, `DELETE`, `PRINT`, `EXPORT`, `APPROVE`, `LOCK`)
     * **Screen Code**, **Target DB Table** (e.g., `tbl_org_company`, `tbl_hr_employee`, `tbl_sec_user`), **Actor User**, **Company Scope**, **From Date**, **To Date**, or **Record PK**.
  4. Use the grid's **Group By** selector to group audit trails by **ERP Module**, **Action Type**, **Screen**, **Target DB Table**, **Actor User**, or **Company Context**.
  5. Click **Inspect Delta** on any row to open the **Forensic Audit Event & Field-Delta Inspector Modal**:
     * **Event Metadata Banner:** Displays Timestamp, Actor (`username`, full name, category), IP Address, Client User-Agent, Company & Branch/Plant scope, Module/Screen, Target Table, and Record Primary Key (`record_pk`).
     * **Tab 1 — Field-by-Field Delta Comparison:** Displays a side-by-side comparison table of every field in `old_value` and `new_value`. Modified fields are highlighted in amber with a `CHANGED` badge; added fields are highlighted in emerald (`ADDED`); removed fields are highlighted in rose (`REMOVED`). Includes a **Modified Fields Only (`N`)** toggle to hide unchanged attributes.
     * **Tab 2 — Raw JSONB Snapshots (`old_value` / `new_value`):** Displays formatted JSONB payloads for `changed_fields`, `old_value` (Before Snapshot), and `new_value` (After Snapshot).
* **Action Buttons:** `Print` (`AUDIT_LOG -> PRINT`), `Export CSV` (`AUDIT_LOG -> EXPORT`), and `Inspect Delta` (`AUDIT_LOG -> VIEW`).

---

### 2.11 System Configuration Matrix & Document Numbering Series Engine (`/admin/configurations` — Step 2.6)

* **Purpose:** Manage hierarchical enterprise parameters and feature flags (`tbl_sys_config` at `GLOBAL`, `COMPANY`, and `BRANCH` / Plant scopes) alongside multi-plant, multi-financial-year transaction document numbering series (`tbl_sys_doc_number_series`).
* **Prerequisites:** Active Companies (`/org/companies`), Branches/Plants (`/org/branches`), and Financial Years (`/org/financial-years`) must exist.
* **Step-by-Step Usage:**
  1. Navigate to **Security & RBAC $\rightarrow$ System Configuration** (`/admin/configurations`).
  2. **Tab 1 — System Configuration Matrix (`tbl_sys_config`):**
     * Filter parameters by **Domain Group** (`INVENTORY_VALUATION`, `PRODUCTION_SHOPFLOOR`, `QUALITY_CONTROL`, `PROCUREMENT_APPROVAL`, `GST_STATUTORY`, `SECURITY_SESSION`) or **Hierarchy Scope** (`GLOBAL`, `COMPANY`, `BRANCH`).
     * Click **Override** on any Global parameter row to immediately pre-fill a Plant or Company override for that parameter key.
     * Click **Edit** to modify the active value using a data-type-aware editor (`BOOLEAN` toggle selector, `ENUM` dropdown of allowed options, `NUMBER` input, or `STRING`/`JSON` text editor).
     * When a parameter's active value differs from its factory default (`CUSTOMIZED`), click **Reset** to restore `default_value` and log a field-delta audit entry.
     * Click **Delete** on custom or override rules to remove them. Core system parameters (`is_system_locked = TRUE`) are protected from deletion.
  3. **Tab 2 — Document Numbering Series Engine (`tbl_sys_doc_number_series`):**
     * Filter numbering series by **ERP Module** (`PROCUREMENT`, `INVENTORY_WMS`, `QUALITY`, `PRODUCTION`, `SALES_DISPATCH`), **Company**, **Plant / Branch**, or **Financial Year**.
     * Click **+ Create Document Series** (or **Edit** on an existing series) to configure the **Target Company, Plant, Financial Year, Document Type, Prefix Template, FY Suffix, Separator (`/`, `-`, `.`), Zero-Padding Digits (`2`–`10`), Starting Sequence No, Current Next Counter No, and Reset Frequency (`FYEAR`, `MONTHLY`, `NEVER`)**.
     * Observe the **Live Next Voucher Number Format Preview Banner** inside the modal (e.g., `KSMFG/AHM/PO/26-27/0014`) update in real time as you type.
     * Click **Simulate** on any series row to open the **Voucher Sequence Generator Simulation Modal**, displaying the next 5 sequential document numbers from PostgreSQL.
     * Click **Delete** on an unused series (`0` documents issued) to remove it. Any series that has already generated vouchers (`current_next_no > starting_no`) is protected from deletion (`409 Conflict`) to preserve statutory numbering continuity.
* **Action Buttons:** `Print` (`CONFIG_MASTER -> PRINT`), `Export CSV` (`CONFIG_MASTER -> EXPORT`), `+ Add Parameter / Create Document Series` (`CONFIG_MASTER -> ADD`), `Override / Reset / Edit` (`CONFIG_MASTER -> EDIT`), and `Delete` (`CONFIG_MASTER -> DELETE`).

---

### 2.12 Multi-Level Warehouse, Zone, Rack, Shelf & Bin Hierarchy Master (`/inventory/warehouses` — Step 3.1)

* **Purpose:** Configure plant-scoped physical and virtual stores (`tbl_inv_warehouse`: Raw Material, Shopfloor WIP, Finished Goods, IQC Quarantine Hold, Rejection/Scrap, Engineering Spares MRO, Tool Crib, and Subcontractor Job-Work stores) along with a 5-level WMS storage bin coordinate matrix (`tbl_inv_storage_bin`: `Warehouse ▸ Zone ▸ Rack ▸ Shelf ▸ Bin Position`) for barcode-guided putaway, FIFO/FEFO batch picking, and load/volume capacity control.
* **Prerequisites:** Active Companies (`/org/companies`) and Plant/Branches (`/org/branches`) must exist. Optional Store Custodians are selected from Employee Master (`/hr/employees`).
* **Step-by-Step Usage:**
  1. Navigate to **Inventory & WMS $\rightarrow$ Warehouses & Bins** (`/inventory/warehouses`).
  2. **Tab 1 — Plant Warehouses & Stores (`tbl_inv_warehouse`):**
     * Filter stores by **Plant / Branch** or group by **Plant / Branch** or **Store Type**.
     * Click **New Plant Warehouse** to register a store with its **Target Company, Plant/Branch, Warehouse Code, Store Classification Type, Store In-Charge Employee, Storage Temperature Range (`°C`), Default Store Flag, Negative Stock Policy, QC Quarantine Hold Flag, and Shopfloor WIP Backflush Flag**.
     * Click **Inspect Bins ▸** on any warehouse row to switch directly to Tab 2 filtered to that warehouse's storage bin coordinates.
     * Click **Delete** to remove an unused warehouse. If storage bins are mapped to the warehouse, `DependencyCheckService` blocks deletion (`409 Conflict`) and lists the dependent `tbl_inv_storage_bin` count inside `<ConfirmDeleteModal>`.
  3. **Tab 2 — Multi-Level Storage Bin Hierarchy (`tbl_inv_storage_bin`):**
     * Use the **Interactive Warehouse Pill Bar** to filter storage bins by parent warehouse, or group bins by **Warehouse**, **Warehouse Zone**, or **Physical Bin Type** (`PALLET_RACK`, `CANTILEVER`, `MEZZANINE_SHELF`, `FLOOR_BULK`, `COLD_CHAMBER`, `SILO_TANK`, `QC_QUARANTINE_CAGE`).
     * Click **+ Add Storage Bin** to create a single 5-level bin coordinate with live preview of the `WH ▸ ZONE ▸ RACK ▸ SHELF ▸ BIN` breadcrumb, safe weight capacity (`kg`), volume limit (`CBM`), and putaway governance flags (`Allow Mixed Items`, `Allow Mixed Batches`, `Pick-Face`, `GRN Staging Bay`, `Blocked for Putaway`).
     * Click **Bulk Rack/Bin Matrix Generator** to atomically generate up to 100 storage bins across a specified **Zone, Rack Range (`R01`–`Rnn`), Shelf Range (`S01`–`Snn`), and Bin Position Range (`B01`–`Bnn`)** in a single PostgreSQL transaction.
* **Action Buttons:** `Print` (`WAREHOUSE_MASTER -> PRINT`), `Export CSV` (`WAREHOUSE_MASTER -> EXPORT`), `New Plant Warehouse / + Add Storage Bin / Bulk Rack/Bin Matrix Generator / Clone Bin` (`WAREHOUSE_MASTER -> ADD`), `Edit` (`WAREHOUSE_MASTER -> EDIT`), and `Delete` (`WAREHOUSE_MASTER -> DELETE`).

---

### 2.13 UOM, UOM Conversion Matrix & Item Category Hierarchy Master (`/inventory/uoms` — Step 3.2)

* **Purpose:** Define standard physical units of measurement (`tbl_inv_uom`) equipped with Indian GST Unique Quantity Codes (UQCs) and decimal precisions, mathematical and packaging inter-UOM conversion ratios (`tbl_inv_uom_conversion`), and recursive multi-level item categorization trees (`tbl_inv_item_category`) for Raw Materials, WIP Sub-Assemblies, Finished Goods, MRO Consumables, and Press Tooling.
* **Prerequisites:** Users must have `UOM_MASTER -> VIEW` permission in their assigned role.
* **Step-by-Step Usage:**
  1. Navigate to **Inventory & WMS $\rightarrow$ UOM & Categories** (`/inventory/uoms`).
  2. **Tab 1 — Units of Measurement (`tbl_inv_uom`):**
     * Filter units by **Physical Metric Type** (`WEIGHT`, `COUNT`, `LENGTH`, `VOLUME`, `AREA`, `TIME`).
     * Click **New UOM** to register a unit with its **UOM Code (`KG`, `NOS`, `MTR`), UOM Title, Metric Type, Decimal Precision (`0`–`6`), GST UQC Code, and Base Reference UOM flag**.
     * Click **View Ratios ▸** on any UOM row to view all active mathematical conversions originating from or targeting this unit.
     * Click **Delete** to remove an unused UOM. If the UOM is mapped as a source or target in `tbl_inv_uom_conversion`, `DependencyCheckService` blocks deletion (`409 Conflict`) and displays active dependencies in `<ConfirmDeleteModal>`.
  3. **Tab 2 — Unit Conversion Matrix (`tbl_inv_uom_conversion`):**
     * Group conversions by **Source Unit** or **Ratio Type** (`STANDARD`, `PACKAGING`, `ITEM_SPECIFIC`).
     * Click **+ Add Conversion Ratio** to create an inter-unit multiplier (`1 Source UOM = Factor Target UOM`) with live formula visualization and optional **Auto-Create Reciprocal Pair** (e.g., automatically creates both `1 TON = 1000 KG` and `1 KG = 0.001 TON` in a single transaction).
  4. **Tab 3 — Item Category Hierarchy Tree (`tbl_inv_item_category`):**
     * Filter categories by **Classification Pillar** (`RAW_MATERIAL`, `WIP_SUB_ASSEMBLY`, `FINISHED_GOODS`, `PACKING_MATERIAL`, `CONSUMABLES_MRO`, `TOOLS_DIES`, `SCRAP_REJECT`).
     * Click **+ Add Item Category** (or click the `+` button on an existing category row) to register a new tree node. The system auto-calculates the node's **Hierarchy Depth Level (`L1`, `L2`, `L3`)** and materialized path (e.g. `RAW_MATERIAL / RM_FERROUS / RM_HR_SHEET`) while updating parent node folder status (`is_leaf = FALSE`).
     * Specify default **HSN/SAC Codes**, **GST Tax Rates (`%`)**, and **Valuation Methods (`FIFO`, `WEIGHTED_AVG`, `STANDARD_COST`)** to be automatically inherited by items in this category.
     * Click **Delete** to remove an empty leaf category. Categories with child sub-categories are protected from deletion (`409 Conflict`).
* **Action Buttons:** `Print` (`UOM_MASTER -> PRINT`), `Export CSV` (`UOM_MASTER -> EXPORT`), `New UOM / + Add Conversion Ratio / + Add Item Category` (`UOM_MASTER -> ADD`), `Edit` (`UOM_MASTER -> EDIT`), and `Delete` (`UOM_MASTER -> DELETE`).


---

### 2.14 Item & Material Master, Multi-UOM, Pricing, Quality & BOM Parameters (`/inventory/items` — Step 3.3)

* **Purpose:** Centrally manage all engineering materials, purchased items, WIP sub-assemblies, finished goods, consumables, and press tooling (`tbl_inv_item`). Configure multi-UOM mappings (Inventory Base UOM vs. Purchase Order UOM vs. Sales Invoice UOM), standard and actual cost benchmarks, GST statutory rates & HSN codes, buffer inventory thresholds (ROP, Min Stock, Safety Stock, Lead Time), and discrete manufacturing governance parameters (Batch/Heat traceability, Serial number tracking, Mandatory Quality Control inspection, and Bill of Materials parent allowance).
* **Prerequisites:** 
  1. Base and secondary units must exist in **UOM Master** (`/inventory/uoms`).
  2. Leaf category nodes must exist in **Item Category Hierarchy Tree** (`/inventory/uoms`).
  3. Physical warehouses and storage bins must exist in **Warehouse & Bin Hierarchy** (`/inventory/warehouses`).
* **Step-by-Step Usage:**
  1. Navigate to **Inventory & WMS $\rightarrow$ Item & BOM Catalog** (`/inventory/items`).
  2. **Catalog Overview & KPI Metric Cards:**
     * Review real-time catalog analytics: **Total Master SKUs**, **Finished Goods (Saleable)**, **WIP & Sub-Assemblies**, and **Batch & QC Governed SKUs**.
     * Filter items by **Classification Pillar Pills** (`All Types`, `Raw Material`, `WIP / Sub-Assembly`, `Finished Goods`, `Packing Material`, `MRO Consumable`, `Tooling & Die`, `Scrap & Rejection`).
     * Filter or group items dynamically by **Classification**, **Category Pillar**, **Valuation Method (`FIFO`, `WEIGHTED_AVG`, `STANDARD_COST`)**, or **Default Storing Warehouse**.
  3. **Creating or Editing an Item SKU:**
     * Click **New Item SKU** (or the pencil icon on an existing row) to open the 4-tab item configuration modal:
     * **Tab 1 — Identity & Classification:**
       * Enter unique **Item Code** (e.g. `RM-SS316-ROUND-50`, `WIP-VLV-BODY-MACH`, `FG-GATE-VALVE-50`).
       * Select **Classification Pillar** and **Item Category Tree Node** (automatically inherits category HSN, default tax rate, and valuation method).
       * Enter **Item Name & Title**, optional **Material Specification / Engineering Notes**, **Engineering Drawing Number & Revision** (e.g. `DWG-VB-2026-01 Rev.B`), and **Unit Weight (`kg`)**.
     * **Tab 2 — Multi-UOM & Warehouse Planning:**
       * Select **Base Inventory UOM** (strictly used for stock ledger valuation).
       * Select default **Purchase UOM** and **Sales UOM** (e.g., steel sheet purchased in `TON` but inventoried in `KG`, or automotive mounts sold in `BOX` of 50).
       * Select default putaway **Warehouse** and specific **Storage Bin coordinate** (filtered dynamically to the chosen warehouse).
       * Configure replenishment buffers: **Reorder Point (ROP)**, **Minimum Stock Level**, **Safety Stock**, and **Procurement/Production Lead Time (Days)**.
     * **Tab 3 — Costing & Taxation:**
       * Enter **Standard Cost (₹)**, default **Purchase Rate (₹)**, and list **Selling Rate (₹)**.
       * Verify statutory **HSN / SAC Code**, **GST Tax Rate (%)**, and choose inventory **Valuation Method** (`FIFO`, `Moving Weighted Average`, `Standard Costing`).
     * **Tab 4 — Quality & BOM Governance:**
       * **Batch / Heat Number Managed:** Mandatory heat/batch allocation during GRN inward and job-work receipts.
       * **Serial Number Individual Tracking:** Generates unique individual serial tracking for critical high-value assemblies.
       * **Mandatory QC Inspection Required:** Inward receipts route automatically to the Quarantine QC bay before clearance to active bin storage.
       * **Shelf Life (Days):** Enter expiration horizon for chemicals, adhesives, or rubber seals.
       * **Allow as BOM Parent SKU:** Enables creating multi-level Bill of Materials for this SKU.
       * **Expected Standard Yield %:** Enter anticipated manufacturing process yield (e.g., `98.00%` factoring in turning scrap).
       * **QC Inspection Lead Time (Days):** Allocation for metallurgy testing, dimensional CMM inspection, or hydrostatic test certification.
  4. **Datasheet Printing & Export:**
     * Click the **Printer icon** on any item row to preview and print a clean, high-density industrial specification sheet.
     * Click **Export CSV** to download the comprehensive item catalogue with all engineering, multi-UOM, and costing attributes. All export and print activities are automatically logged in `tbl_sec_audit_log`.
  5. **Safe Deletion with Dependency Checking:**
     * Click the **Trash icon** on an item row. If the SKU is linked to active Bills of Materials (`tbl_bom_header`, `tbl_bom_item`), Warehouse Stock Balances (`tbl_inv_stock_balance`), Purchase Orders (`tbl_po_item`), Goods Receipts (`tbl_grn_item`), or Shopfloor Work Orders (`tbl_prod_work_order`), `DependencyCheckService` blocks deletion (`409 Conflict`) and lists all child references in `<ConfirmDeleteModal>`.
* **Action Buttons:** `Print Datasheet` (`ITEM_MASTER -> PRINT`), `Export CSV` (`ITEM_MASTER -> EXPORT`), `New Item SKU` (`ITEM_MASTER -> ADD`), `Edit Item Master` (`ITEM_MASTER -> EDIT`), and `Delete Item Master` (`ITEM_MASTER -> DELETE`).


---

### 2.15 Unified Customer, Supplier, Transporter & Job-Worker Master (`/parties/customers` & `/parties/master` — Step 4.1)

* **Purpose:** Centrally manage all external and internal business counter-parties (`tbl_crm_party`) within a unified, multi-role entity architecture. Configure multi-faceted trading partner roles (Customer, Supplier, Transporter, Job-Worker), statutory tax identifiers (PAN, GSTIN, MSME Udyam registration, TAN), financial risk & credit terms (credit limit ₹, payment grace days, interest on overdue, bank account details), and unlimited physical operating locations & warehouse delivery sites (`tbl_crm_party_address`) with GSTIN validation and default billing/shipping designations.
* **Prerequisites:**
  1. Base operational currency and financial years configured in **Financial Year Master** (`/org/financial-years`).
  2. Operating branch entities configured in **Branch Master** (`/org/branches`).
* **Step-by-Step Usage:**
  1. Navigate to **CRM & Sales $\rightarrow$ Customer Master** or direct URL `/parties/customers` / `/parties/master`.
  2. **Entity Portfolio & KPI Metrics:**
     * Monitor real-time partner distributions: **Total Master Entities**, **Active Customers**, **Vendors & Suppliers**, and **Job-Workers & Transporters**.
     * Filter dynamically using quick role toggle pills (`All Counter-Parties`, `Customers Only`, `Suppliers Only`, `Job-Workers`, `Transporters / Logistics`).
     * Search instantly by **Party Code**, **Legal / Trade Name**, **PAN Number**, or **Primary GSTIN**.
  3. **Creating or Editing a Unified Party:**
     * Click **+ New Counter-Party** (or click the pencil icon on an existing party row) to launch the unified partner modal:
     * **Tab 1 — Basic Identity & Roles:**
       * Enter unique **Party Code** (e.g. `CUST-MARUTI-01`, `SUPP-JSW-STEEL-01`, `JW-MICRO-PREC-01`).
       * Enter **Legal Company Name** and optional **Trade / Brand Name**.
       * Check applicable enterprise role flags: **Customer (Debtor)**, **Supplier (Creditor)**, **Job-Worker (Subcontractor)**, and/or **Transporter (Logistics Carrier)**. A single corporate group can simultaneously operate as a supplier of raw materials and a customer for finished goods without duplicating legal PAN records.
       * Select **Party Classification Group** (`ENTERPRISE_OEM`, `TIER_1_AUTO`, `DISTRIBUTOR`, `RAW_MATERIAL_MILL`, `SPECIALTY_JOB_WORKER`, `FREIGHT_FORWARDER`).
       * Enter **Primary Email**, **Primary Phone / Mobile**, and **Website URL**.
     * **Tab 2 — Statutory, Tax & MSME Compliance:**
       * Enter 10-character Permanent Account Number (**PAN**) (e.g., `AAACM1234F`).
       * Enter **Primary GSTIN** (15-character statutory GST identification).
       * Enter Tax Deduction Account Number (**TAN**) if applicable.
       * Enter **MSME Udyam Registration Number** (e.g., `UDYAM-MH-12-0012345`) and MSME Enterprise Category (`MICRO`, `SMALL`, `MEDIUM`, or `NOT_APPLICABLE`) for Indian MSME payment compliance (45-day statutory vendor settlement clause).
     * **Tab 3 — Credit, Banking & Payment Terms:**
       * Enter **Credit Limit (₹)** and **Credit Grace Period (Days)** (e.g., Net 30, Net 60, Net 90).
       * Enter **Overdue Interest Rate (% per annum)** for customer credit control.
       * Select default **Price List Group** (`STANDARD_WHOLESALE`, `OEM_SPECIAL`, `RETAIL_DISTRIBUTION`).
       * Enter disbursement banking details: **Bank Name**, **Bank Branch**, **Bank Account Number**, and **IFSC Code**.
     * **Tab 4 — Multi-Location Addresses & GSTINs:**
       * Maintain an unlimited list of physical branches, registered offices, plants, and delivery points for this counter-party.
       * Click **+ Add Location / Address** to append an address row.
       * Specify **Address Title / Label** (e.g., `Gurugram Plant Delivery Bay`, `Coimbatore Machine Works`, `Mumbai Corporate HQ`).
       * Enter **Street Address Line 1 & 2**, **City**, **State**, 2-digit **State Code** (e.g., `06` for Haryana, `27` for Maharashtra, `33` for Tamil Nadu), **Postal PIN Code**, and **Location-specific GSTIN**.
       * Toggle **Default Billing Address** and **Default Shipping Address** radio markers.
       * Enter site-level **Contact Person Name**, **Contact Phone**, and **Contact Email**.
  4. **Datasheet Printing & CSV Export:**
     * Click the **Printer icon** on any party row to view and print an industrial partner summary report including statutory registration details, banking particulars, and all operating addresses.
     * Click **Export CSV** to download the complete counter-party register with address details. All print and export operations are captured in the security audit trail (`tbl_sec_audit_log`).
  5. **Safe Deletion with Referential Integrity:**
     * Click the **Trash icon** on a party row. If the party has active linked Sales Orders (`tbl_so_header`), Purchase Orders (`tbl_po_header`), Job-Work Outward DC vouchers (`tbl_subcon_dc_header`), or Accounting Invoices, the transaction is rejected with `409 Conflict` and detailed dependency references are displayed.
* **Action Buttons:** `Print Party Datasheet` (`PARTY_MASTER -> PRINT`), `Export CSV` (`PARTY_MASTER -> EXPORT`), `+ New Counter-Party` (`PARTY_MASTER -> ADD`), `Edit Party Master` (`PARTY_MASTER -> EDIT`), and `Delete Party Master` (`PARTY_MASTER -> DELETE`).


---

### 2.16 Tiered Price Lists, Volume Discounts & Vendor Rate Contracts (`/parties/price-lists` — Step 4.2)

* **Purpose:** Centrally manage commercial sales price lists, vendor procurement contracts, and subcontractor machining rate cards (`tbl_crm_price_list`). Configure multi-tier volume discount brackets (`tbl_crm_price_list_item`) where unit rates automatically scale according to order batch quantity, establish contract validity periods (`effective_from` to `effective_to`), define company-wide fallback defaults (`is_default`), and link rate cards directly to authorized counter-parties (`tbl_crm_party_price_list`).
* **Prerequisites:**
  1. Engineering materials, finished goods, and sub-assemblies configured in **Item & BOM Catalog** (`/inventory/items`).
  2. Baseline inventory and secondary packaging units configured in **UOM Master** (`/inventory/uoms`).
  3. Commercial trading partners configured in **Unified Customer & Supplier Master** (`/parties/customers` or `/parties/master`).
* **Step-by-Step Usage:**
  1. Navigate to **CRM & Parties $\rightarrow$ Tiered Price Lists** (`/parties/price-lists`).
  2. **Rate Card Portfolio & KPI Metrics:**
     * Review real-time pricing analytics: **Total Master Contracts**, **Sales Rate Cards**, **Vendor Rate Contracts**, and **Job-Work & Machining Cards** with total active item tier brackets.
     * Filter dynamically using quick role toggle pills (`All Price Lists`, `Sales Rate Cards`, `Vendor Rate Contracts`, `Job-Work Subcontracting`).
     * Toggle **Default Lists Only** or **Active Contracts Only** to isolate active baseline rate sheets.
     * Search instantly by **Price List Code**, **Contract Name**, **Contract Type**, or **Description notes**.
  3. **Creating or Editing a Price List / Rate Contract:**
     * Click **+ New Price List / Contract** (or click the pencil icon on an existing row) to open the 3-tab configuration modal:
     * **Tab 1 — Header & Validity:**
       * Enter unique **Price List Code** (e.g. `PL-OEM-MARUTI-2026`, `VRC-JSW-STEEL-2026`, `JWC-PREC-HEAT-2026`).
       * Enter descriptive **Contract / List Name**.
       * Select **Contract Type**:
         * `Sales Rate Card (Customers)`: Outward finished goods and spare parts selling prices.
         * `Purchase Contract (Vendors)`: Inward raw materials, tooling, and consumables procurement rates.
         * `Job-Work Machining Card`: Outward/inward subcontractor machining, heat treatment, or electroplating rates.
       * Select **Currency** (`INR (₹)`, `USD ($)`, `EUR (€)`, `GBP (£)`).
       * Set **Effective From Date** and optional **Effective To Date** (leave blank for perpetual open-ended agreement).
       * Toggle **Company Default List** checkbox (auto-applied when no party-specific contract exists).
       * Enter commercial terms notes in **Description** (freight terms, packaging specs, annual escalation).
     * **Tab 2 — Tiered Rate Brackets:**
       * Click **+ Add Item / Tier** to append a line item row:
       * Select **Item SKU** from searchable dropdown (e.g. `FG-AUTO-MNT-DRV`, `RM-CR-COIL-2MM`, `MRO-CNMG-120408`).
       * Select applicable **UOM** (e.g. `NOS`, `TON`, `KGS`).
       * Enter **Min Qty** and optional **Max Qty** (e.g. Bracket 1: 1–99 pcs, Bracket 2: 100–499 pcs, Bracket 3: 500+ pcs with blank Max Qty).
       * Enter **Base Rate (₹)** and **Discount %**. The system automatically computes **Effective Rate (₹)**: `Base Rate × (1 - Discount % / 100)`.
       * Enter supplier/delivery **Lead Time (Days)** and batch-specific remarks.
     * **Tab 3 — Assigned Counter-Parties:**
       * View filtered list of eligible trading partners (Customers for Sales cards, Suppliers for Purchase contracts, Job-Workers for Job-work cards).
       * Click any partner card to toggle assignment. When generating Sales Orders or Purchase Orders, the ERP automatically resolves the partner's assigned price list and exact quantity bracket.
  4. **Datasheet Printing & CSV Export:**
     * Click the **Printer icon** on any price list row to preview and print an industrial rate card specification sheet complete with company header, quantity brackets, effective unit rates, and authorized counter-parties.
     * Click **Export CSV** to download the master contract register. All print and export operations are logged in `tbl_sec_audit_log`.
  5. **Safe Deletion with Referential Integrity:**
     * Click the **Trash icon** on a price list row. If the contract is referenced in active downstream transactions (Sales Orders in `tbl_so_header` or Purchase Orders in `tbl_po_header`), `DependencyCheckService` blocks deletion (`409 Conflict`) and lists all child references in `<ConfirmDeleteModal>`.
* **Action Buttons:** `Print Rate Card` (`PRICE_LIST -> PRINT`), `Export CSV` (`PRICE_LIST -> EXPORT`), `+ New Price List / Contract` (`PRICE_LIST -> ADD`), `Edit Price List` (`PRICE_LIST -> EDIT`), and `Delete Price List` (`PRICE_LIST -> DELETE`).

---

### 2.17 Material Purchase Requisition (MR) & Multi-Level Authorization (Step 5.1 - `/procurement/requisitions`)

* **Purpose:** Enable shop-floor supervisors, store officers, and plant engineers to indent raw materials, tooling, capital spares, and job-work services against discrete work orders or buffer minimums. Provides multi-level review and authorization (`APPROVE` with approved quantity controls or `REJECT` with mandatory remarks) before converting into RFQs or Purchase Orders.
* **Prerequisites:**
  * Active Company & Plant Branch context.
  * Active Department Master (`tbl_hr_department`) & Warehouse/Store Master (`tbl_inv_warehouse`).
  * Item SKU catalog (`tbl_inv_item`) with assigned base UOMs.
  * Optional: Registered suppliers (`tbl_crm_party`) for suggested sourcing.
* **Step-by-Step Usage:**
  1. **Accessing Requisitions:**
     * Navigate to **PROCUREMENT & SOURCING** $\rightarrow$ **Purchase Requisitions** (`/procurement/requisitions`).
     * Review the 4 real-time KPI metric cards: **Total Requisitions**, **Pending Approvals** (awaiting sign-off), **Authorized / Approved** (ready for PO/RFQ), and **Critical & Urgent** (high-priority / line-stoppage indents).
     * Filter indents dynamically using quick status pills (`All Statuses`, `Draft`, `Submitted`, `Approved`, `Rejected`), priority levels (`Critical / Urgent`, `High`, `Medium`, `Low`), department selectors, or warehouse filters.
     * Group items by Status, Priority, Requesting Department, Receiving Warehouse, or Requisition Type using the table group-by selector.
  2. **Creating a Material Purchase Requisition:**
     * Click **+ New Material Requisition** to launch the requisition builder modal:
     * **Header Information:**
       * **PR Number:** Enter manual code or leave blank for automatic sequence generation (`PR-AHM-2627-XXXX`).
       * **Requisition Date:** Defaults to current date.
       * **Required By Date:** Target arrival date at the receiving warehouse.
       * **Requesting Department:** Select initiating department (e.g., *Production - Machine Shop*, *Tool Room & Die Maintenance*, *Quality Assurance*).
       * **Destination Warehouse:** Target storage location (e.g., *Main Raw Materials Warehouse*, *Tool Crib & Spare Parts Store*).
       * **Priority Level:** Choose from `Low`, `Medium`, `High`, or `Critical / Urgent (Line Stoppage)`.
       * **Requisition Type:** Select `Raw Material`, `Capital Asset`, `Consumable & MRO`, `Tooling & Spares`, or `Job Work Service`.
       * **Purpose / Justification:** Enter operational justification (e.g., *For Job Order JO-AHM-2627-010, replacement cutter inserts*).
     * **Material Line Items Grid:**
       * Click **+ Add Item** to append indent rows.
       * Select **Item SKU** from searchable item dropdown. System auto-fills base UOM and standard purchase rate.
       * Specify **Required Quantity** and verify/adjust **Estimated Rate (₹)**. Line item **Estimated Amount (₹)** is calculated automatically (`Required Qty × Estimated Rate`).
       * Optionally designate a **Suggested Vendor** from qualified suppliers and add item-specific specification notes in **Remarks**.
       * Review the **Total Estimated Amount** summary footer.
     * Click **Save Requisition**. New indents are saved in `DRAFT` status.
  3. **Submitting for Authorization:**
     * On any `DRAFT` requisition row, click the paper airplane icon (**Submit for Approval**).
     * Status updates to `SUBMITTED` (`Pending Approval`), routing the indent into the authorization queue.
  4. **Multi-Level Authorization (Approve / Reject):**
     * Authorized managers (Plant Managers, Purchase Officers) click the shield check icon (**Authorize Requisition**) on any `SUBMITTED` row.
     * In the authorization modal:
       * Review requisition details and line items.
       * Choose **Approve Requisition**: Adjust **Approved Qty** on individual line items (e.g., reduce requested quantity based on current plant budget or warehouse stock reserves) and enter optional approval remarks.
       * Choose **Reject Requisition**: Enter mandatory rejection justification remarks (e.g., *Budget exceeded, substitute material already in stock*).
       * Click **Confirm Approval** or **Confirm Rejection**. The system updates the requisition header and line item approved quantities and total estimated amount atomically.
  5. **Printing Requisition Vouchers & CSV Export:**
     * Click the **Printer icon** on any row to open the high-fidelity internal voucher modal with company header, indent details, item specifications with requested vs approved quantities, and triple-signature sign-off blocks (*Requested By*, *Store In-charge*, *Plant Head / Approver*).
     * Click **Print Document** to invoke system print dialog.
     * Click **Export CSV** in `<MasterDataTable>` to export requisitions data. All print and export operations are logged in `tbl_sec_audit_log`.
  6. **Safe Deletion with Referential Integrity:**
     * Click the **Trash icon** on any `DRAFT` or `CANCELLED` requisition row.
     * Requisitions linked to downstream Requests for Quotation (`tbl_rfq_item`) or Purchase Orders (`tbl_po_item`) cannot be deleted; the ERP's `DependencyCheckService` blocks deletion with conflict details.
* **Action Buttons:** `Print Voucher` (`PURCHASE_REQ -> PRINT`), `Export CSV` (`PURCHASE_REQ -> EXPORT`), `+ New Material Requisition` (`PURCHASE_REQ -> ADD`), `Edit Requisition` (`PURCHASE_REQ -> EDIT`), `Submit for Approval` (`PURCHASE_REQ -> SUBMIT`), `Authorize Requisition` (`PURCHASE_REQ -> AUTHORIZE`), and `Delete Requisition` (`PURCHASE_REQ -> DELETE`).

---

### 2.18 Supplier Request for Quotation (RFQ) & Comparative Statement (Step 5.2 - `/procurement/rfqs`)

* **Purpose:** Enable procurement executives and purchase managers to issue competitive multi-vendor inquiries (RFQs) against approved material requisitions or manual indents, log supplier quotation bids, generate automatic Comparative Statements (CS) with L1 (Lowest Bidder) calculation and variance benchmarks, and formally award purchase contracts with complete audit traceability.
* **Prerequisites:**
  * Active Company & Plant Branch context.
  * Receiving Plant / Warehouse Master (`tbl_inv_warehouse`).
  * Item SKU catalog (`tbl_inv_item`) with UOMs and benchmark purchase rates.
  * Registered vendor suppliers (`tbl_crm_party` where `is_supplier = true`).
  * Optional: Approved Material Purchase Requisitions (`tbl_pr_header` / `tbl_pr_item`) for 1-click indent import.
* **Step-by-Step Usage:**
  1. **Accessing RFQ Register:**
     * Navigate to **PROCUREMENT & SOURCING** $\rightarrow$ **Requests for Quotation** (`/procurement/rfqs`).
     * Inspect 4 real-time KPI metric cards: **Total RFQ Tenders**, **Open Inquiries** (Drafts & Issued to vendors), **Comparative Analysis** (Quotes in & ready for CS evaluation), and **Contracts Awarded** (Ready for Purchase Order generation).
     * Filter dynamically using quick status pills (`All Tenders`, `Draft`, `Sent`, `Quotes In`, `CS Ready`, `Awarded`) and warehouse selectors.
     * Group rows by Status, Destination Warehouse, or Awarded Supplier using the table grouping menu.
  2. **Creating an RFQ Tender:**
     * Click **+ New RFQ Tender** to launch the inquiry builder modal:
     * **Header Details:**
       * **RFQ Number:** Auto-generated sequence (`RFQ-AHM-2627-XXXX`) or custom code.
       * **Issue Date & Due Date:** Quotation submission cutoff date for suppliers.
       * **Receiving Warehouse:** Destination plant store.
       * **Commercial Terms:** Default payment terms (e.g., *30 Days Net from GRN*) and delivery terms (*FOR Destination Plant*).
       * **Tender Scope / Remarks:** Operational instructions for suppliers.
     * **Line Items & Quick Requisition Import:**
       * Click any **Approved Requisition Pill** (e.g. `+ PR-AHM-2627-0001`) to automatically pull all approved indented line items, quantities, and target benchmark rates directly into the inquiry.
       * Alternatively, click **+ Add Item** to select SKUs manually from the catalog, specify required quantities, target estimated unit rates (₹), and technical tolerances/specs.
     * **Inviting Qualified Suppliers:**
       * Select 2 or more qualified vendors from the multi-select vendor supplier list.
     * Click **Save RFQ Tender**. Saved in `DRAFT` status.
  3. **Issuing RFQ to Suppliers:**
     * On any `DRAFT` row, click the paper airplane icon (**Issue to Invited Vendors**).
     * Status updates to `SENT`, locking initial specifications and opening the inquiry for bid recording.
  4. **Recording Vendor Quotation Bids:**
     * When supplier quotes arrive (via email, portal, or sealed envelope), click the green dollar icon (**Record Supplier Quotation Bid**).
     * Select the responding vendor, enter **Vendor Quote Ref No**, **Quotation Date**, offered payment terms, and delivery lead time (days).
     * For each line item, input **Offered Quantity**, **Quoted Unit Rate (₹)**, **Discount %**, and applicable **GST/Tax %**. The system computes Net Unit Rate and Total Line Amount in real-time.
     * Click **Save Vendor Quotation**. The system saves the bid, updates the vendor's total quote amount, and auto-calculates L1 flags.
  5. **Comparative Statement (CS) Evaluation & L1 Analysis:**
     * Click the spreadsheet icon (**View Comparative Statement**) on any RFQ row.
     * **Vendor Bid Summary:** Displays total bid value, payment terms, delivery lead days, and L1 item win count per vendor.
     * **Item-by-Item Rate Comparison Matrix:**
       * Displays required quantities, internal target benchmark rates, and side-by-side quotes for all participating suppliers.
       * Prominently highlights the **Lowest (L1) Bidder** with a live pulsing green indicator and computes the percentage **Price Variance** ($\Delta$) against internal target estimates.
  6. **Finalizing & Awarding the Contract:**
     * Inside the Comparative Statement modal, scroll to the **Finalize & Award Purchase Contract** section.
     * Select the **Winning Vendor** and enter mandatory **Award Justification / Remarks** (e.g., *Selected L1 lowest quote with verified ISO 9001 mill test certificates*).
     * Click **Confirm Contract Award**. The RFQ status transitions to `AWARDED`, locking the comparative statement and recording the selection delta in the audit log.
  7. **Printing Inquiries, CS Sheets & CSV Export:**
     * Click the **Printer icon** on any row to open the high-fidelity print modal. Toggle between **Comparative Sheet** (for internal commercial committee approvals) and **Supplier Inquiry Form** (formal tender document for vendors).
     * Click **Export CSV** in the table to export full tender registers. All print and export operations are logged in `tbl_sec_audit_log`.
  8. **Safe Deletion with Referential Integrity:**
     * Click the **Trash icon** on any `DRAFT` or `CANCELLED` RFQ.
     * If downstream Purchase Orders (`tbl_po_item`) are linked to this RFQ, `DependencyCheckService` blocks deletion with conflict details in `<ConfirmDeleteModal>`.
* **Action Buttons:** `Print CS / Inquiry` (`PROCUREMENT_RFQ -> PRINT`), `Export CSV` (`PROCUREMENT_RFQ -> EXPORT`), `+ New RFQ Tender` (`PROCUREMENT_RFQ -> ADD`), `Edit RFQ` (`PROCUREMENT_RFQ -> EDIT`), `Issue to Vendors` (`PROCUREMENT_RFQ -> SEND`), `Award Contract` (`PROCUREMENT_RFQ -> FINALIZE`), and `Delete RFQ` (`PROCUREMENT_RFQ -> DELETE`).

---

### 2.19 Step 5.3 — Purchase Order (PO) Management & Release Workflow (`/procurement/purchase-orders`)

* **Purpose:** Enable procurement managers, purchasing officers, and commercial controllers to generate legally binding purchase contracts and official purchase orders against awarded RFQ quotations or approved material requisitions. Manage multiple PO typologies (Standard PO, Blanket Agreement, Subcontracting Job-Work, Service PO, Capital Asset / CapEx), line item taxes, delivery schedules, commercial authorization sign-off (`RELEASE`), order cancellations, and official printable purchase vouchers.
* **Prerequisites:**
  * Active Company & Plant Branch context.
  * Receiving Plant / Warehouse Master (`tbl_inv_warehouse`).
  * Item SKU catalog (`tbl_inv_item`) with UOMs and benchmark purchase rates.
  * Registered vendor suppliers (`tbl_crm_party` where `is_supplier = true`).
  * Optional Sourcing Acceleration: Awarded RFQs (`tbl_rfq_header` / `tbl_rfq_item`) or Approved PRs (`tbl_pr_header` / `tbl_pr_item`) for 1-click import.
* **Step-by-Step Usage:**
  1. **Accessing Purchase Orders Register:**
     * Navigate to **PROCUREMENT & SOURCING** $\rightarrow$ **Purchase Orders** (`/procurement/purchase-orders`).
     * Inspect 4 real-time KPI metric cards: **Total Purchase Orders**, **Pending Authorization** (Drafts & Submitted orders awaiting commercial sign-off), **Commercially Released** (Active orders dispatched to suppliers), and **Committed Spend Value** (Net valuation in ₹).
     * Filter dynamically using quick status pills (`All Statuses`, `Draft`, `Submitted`, `Released`, `Closed`, `Cancelled`), PO Type filter, Vendor dropdown, and Plant / Warehouse dropdown.
     * Group rows by Order Status, Vendor / Supplier, PO Type, or Receiving Plant using the table grouping menu.
  2. **Creating a Purchase Order:**
     * Click **+ New Purchase Order** to launch the order builder modal:
     * **Sourcing Acceleration Toolbar:**
       * Click **Import Awarded RFQ** to select from awarded quotation tenders. Selecting an RFQ auto-populates the winning vendor, destination plant, payment terms, delivery terms, and negotiated line items with final unit rates.
       * Click **Import Approved PR Items** to multi-select approved indented lines from department requisitions.
     * **Order Header Information:**
       * **Supplier / Vendor:** Select qualified vendor from the supplier directory.
       * **Receiving Warehouse:** Select plant raw material stores.
       * **PO Type:** Choose between *Standard PO (Stock / RM)*, *Blanket Agreement (Contract)*, *Subcontracting Job-Work*, *Service PO*, or *Capital Asset (CapEx)*.
       * **Order Date & Expected Delivery Date:** Set procurement issue date and delivery schedule deadline.
       * **Commercial Terms:** Specify Payment Terms (e.g. *30 Days Net from GRN*) and Delivery Incoterms (e.g. *FOR Destination Plant*).
       * **Shipping & Billing Addresses:** Review and adjust plant delivery address and corporate tax billing address.
     * **Order Items & Real-Time Tax Valuation:**
       * Click **+ Add Item Line** to select items from catalog, specify ordered quantity, UOM, unit rate (₹), discount %, GST tax %, and expected delivery date.
       * Live calculation footer displays **Gross Total**, **Total Discount**, **Tax (GST)**, and **Net Payable Amount**.
     * Click **Create Purchase Order**. Saved in `DRAFT` status with automatic sequence code (e.g. `PO-AHM-2627-0006`).
  3. **Submitting PO for Commercial Review:**
     * On any `DRAFT` purchase order, click the paper airplane icon (**Submit Order**).
     * Status updates to `SUBMITTED`, indicating that the purchase contract is pending commercial sign-off.
  4. **Commercial Release Sign-Off Workflow:**
     * Authorized purchase heads / commercial managers inspect submitted orders.
     * Click the green shield icon (**Commercial Release Sign-Off**).
     * Review the committed order value and enter mandatory **Commercial Sign-Off Notes / Remarks** (e.g., *Terms verified against RFQ comparison. Approved for delivery schedule*).
     * Click **Authorize & Release Order**.
     * The order status transitions to `RELEASED`. The system records the authorizer's user ID, release timestamp, and sign-off remarks in the audit trail.
  5. **Printing Official Purchase Order Vouchers:**
     * On any purchase order, click the printer icon (**Print Purchase Order Voucher**).
     * Preview the official manufacturing purchase voucher formatted for `@media print` printing:
       * Company branding: Kashvira Infotech Private Limited, Plant address, GSTIN, CIN.
       * Vendor billing and destination warehouse ship-to details.
       * Full line item table with item codes, specifications, quantities, UOM, rates, discount, GST %, and line amounts.
       * Commercial terms, delivery terms, and standard manufacturing terms & conditions.
       * Triple signature sign-off blocks: Prepared By, Checked By, and Commercial Signatory.
     * Click **Print Document** to trigger high-fidelity browser print/PDF export. Logged in `tbl_sec_audit_log` as `PRINT` action.
  6. **Cancelling an Order:**
     * On any `DRAFT`, `SUBMITTED`, or `RELEASED` order, click the red cross icon (**Cancel Order**).
     * Enter mandatory **Reason for Cancellation** (e.g. *Vendor delivery delay / design revision*).
     * Status transitions to `CANCELLED`, blocking any downstream goods receipts.
  7. **Safe Deletion with Referential Integrity:**
     * Click the **Trash icon** on any `DRAFT` PO.
     * If downstream Goods Receipt Notes (GRN) or supplier invoices are linked, `DependencyCheckService` blocks deletion with conflict details in `<ConfirmDeleteModal>`.
* **Action Buttons:** `Print Voucher` (`PURCHASE_ORDER -> PRINT`), `Export Register` (`PURCHASE_ORDER -> EXPORT`), `+ New Purchase Order` (`PURCHASE_ORDER -> ADD`), `Edit Order` (`PURCHASE_ORDER -> EDIT`), `Submit Order` (`PURCHASE_ORDER -> SUBMIT`), `Commercial Release` (`PURCHASE_ORDER -> RELEASE`), `Cancel Order` (`PURCHASE_ORDER -> CANCEL`), and `Delete Order` (`PURCHASE_ORDER -> DELETE`).

---

### 2.20 Step 5.4 — Gate Entry & Security Inward Register (`/procurement/gate-inward`)

* **Purpose:** Manage factory perimeter security checkpoints and physical consignment inward logistics. Track arriving supplier transport trucks, verify statutory documents (Delivery Challans, Tax Invoices, Indian GST E-Way Bills, and Lorry Receipts), record gross and tare weighbridge calibration weights, register declared item packages, authorize physical material unloading into plant stores, and record security outward clearance upon truck departure.
* **Prerequisites:**
  * Active Company & Plant Branch context.
  * Receiving Plant / Warehouse Master (`tbl_inv_warehouse`).
  * Registered vendor suppliers (`tbl_crm_party` where `is_supplier = true`).
  * Item SKU catalog (`tbl_inv_item`) with UOMs.
  * Optional: Commercially Released Purchase Orders (`tbl_po_header` where `status = 'RELEASED'`) for 1-click PO item import.
* **Step-by-Step Usage:**
  1. **Accessing Gate Inward Register:**
     * Navigate to **PROCUREMENT & SOURCING** $\rightarrow$ **Gate Inward & Security** (`/procurement/gate-inward`).
     * Inspect 4 real-time KPI metric cards: **Total Inward Entries**, **Vehicles Inside Plant** (Arrived at gate & currently offloading at receiving bays), **Ready for Stores GRN** (Offloaded materials awaiting Goods Receipt Note voucher generation), and **Departed / Completed** (Vehicles cleared through outward gate).
     * Filter dynamically using quick status pills (`All Inwards`, `At Gate`, `Unloaded`, `GRN Pending`, `Completed`, `Voided`), Destination Plant, and Supplier dropdowns.
     * Group rows by Inward Status, Supplier, Receiving Plant, or Transporter Agency using the table grouping menu.
  2. **Registering Vehicle Inward at Security Gate:**
     * When a supplier truck arrives at the factory gate, security officers click **+ New Gate Entry** to open the register modal:
     * **PO Synchronization Toolbar:**
       * Click **Import Released PO Items** to select from active purchase orders (`status = 'RELEASED'`). Selecting a PO auto-fills the vendor, receiving plant, and all open ordered line items!
     * **Vehicle & Transport Logistics:**
       * **Vehicle Registration Number:** Enter truck number (e.g. `GJ-01-BX-4421`). Automatically formatted in uppercase.
       * **Transporter, Driver & Contact:** Enter transporter agency name, driver full name, and mobile number.
       * **Entry Date & Time:** Auto-populated with current gate timestamp.
       * **Destination Plant:** Select receiving warehouse/plant stores.
     * **Supplier Inward Documents:**
       * **Supplier Challan / Invoice No & Date:** Mandatory delivery challan identifiers.
       * **Statutory Logistics:** 12-digit Indian GST E-Way Bill Number, Lorry Receipt (LR) No and Date.
     * **Weighbridge & Package Inspection:**
       * **Gross Weight (kg):** Truck scale reading with full material load.
       * **Tare Weight (kg):** Empty vehicle weight (initial or estimated). Net material weight is computed in real time (`gross - tare`).
       * **Total Packages:** Count of crates, bundles, barrels, or boxes.
     * **Declared Consignment Items:**
       * Line items grid capturing Item SKU, Description, UOM, declared Challan Quantity, package count, and bundle tag remarks.
     * Click **Register Gate Inward**. The system saves the record in `INWARDED` status with an automatic sequence code (e.g. `GIN-AHM-2627-0001`).
  3. **Marking Consignment Unloaded at Plant Bays:**
     * Once the vehicle docks at the assigned store bay and goods are physically transferred, store personnel click the box icon (**Mark Consignment Unloaded**).
     * Record the post-unloading empty vehicle tare weight from the weighbridge (updating net material weight) and input offload bay/stacking remarks.
     * Click **Confirm Consignment Unloaded**. Status transitions to `GRN_PENDING`, signaling store officers to issue an official Goods Receipt Note (GRN).
  4. **Authorizing Vehicle Gate Exit:**
     * After unloading is confirmed and delivery documents are stamped, the driver proceeds to the exit gate.
     * Security officers click the exit door icon (**Authorize Vehicle Gate Exit**).
     * Enter outward remarks and click **Authorize Exit & Depart**. Status transitions to `COMPLETED`, recording the outward departure timestamp.
  5. **Printing Security Inward Gate Passes:**
     * On any gate record, click the printer icon (**Print Inward Pass**).
     * Preview the official manufacturing gate pass formatted for clean `@media print` printing:
       * Company branding: Kashvira Infotech Private Limited, Plant Gate Security.
       * Large GIN Number and Barcode header.
       * Vehicle No, Entry Timestamp, Transporter, Driver details.
       * Supplier Name, Delivery Challan No & Date, E-Way Bill No.
       * Weighbridge Calibration Certificate: Gross, Tare, and Net Weight in kg.
       * Item lines breakdown with declared challan quantities and package counts.
       * Triple signature sign-off blocks: Security Gate Officer, Weighbridge Operator, and Stores Receiving Clerk.
     * Click **Print Pass** to trigger high-fidelity browser print/PDF export. Logged in `tbl_sec_audit_log` as `PRINT` action.
  6. **Voiding / Turning Back a Vehicle:**
     * If goods are damaged in transit, documentation is invalid, or the consignment is addressed to the wrong plant unit, click the red cross icon (**Void / Turn Back Vehicle**).
     * Input mandatory **Reason for Cancellation** (e.g. *Challan addressed to wrong plant unit / seal broken*).
     * Status transitions to `CANCELLED`.
  7. **Safe Deletion:**
     * Click the **Trash icon** on any `INWARDED` or `CANCELLED` gate entry.
     * If downstream Goods Receipt Notes (GRN) are linked to this entry, `DependencyCheckService` blocks deletion with conflict details in `<ConfirmDeleteModal>`.
* **Action Buttons:** `Print Pass` (`GATE_INWARD -> PRINT`), `Export Register` (`GATE_INWARD -> EXPORT`), `+ New Gate Entry` (`GATE_INWARD -> ADD`), `Edit Entry` (`GATE_INWARD -> EDIT`), `Mark Unloaded` (`GATE_INWARD -> UNLOAD`), `Authorize Exit` (`GATE_INWARD -> EXIT`), `Cancel Entry` (`GATE_INWARD -> CANCEL`), and `Delete Entry` (`GATE_INWARD -> DELETE`).

### 2.21 Step 5.5 — Goods Receipt Note (GRN) & Quarantine Put-Away (`/procurement/grn`)

* **Screen Code:** `PURCHASE_GRN` (Screen ID: `1020`)
* **Navigation Path:** `Sidebar -> PROCUREMENT & SOURCING -> Goods Receipt (GRN)`
* **Primary Roles Authorized:** `SUPER_ADMIN`, `PLANT_MANAGER`, `STORE_OFFICER`, `QA_HEAD`, `PURCHASE_EXEC`
* **Operational Capabilities:**
  1. **Executive Operational KPI Metrics:**
     * **Total GRNs Logged:** Cumulative count of all goods receipt vouchers recorded across manufacturing plants.
     * **Quarantine / QC Hold:** Count of receipt batches in `SUBMITTED` or `QC_IN_PROGRESS` status pending metallurgical or dimensional laboratory clearance.
     * **Store Approved & Cleared:** Count of receipt notes where quality clearance is complete and inventory is put away into storage bins.
     * **Receipt Valuation (INR):** Total cumulative commercial valuation of active received materials calculated from line item quantities and contracted rates.
  2. **Fast Sourcing & Logistics Synchronization:**
     * **1-Click Gate Inward Import:** Select from active security gate entries (`GIN-AHM-2627-XXXX`) in `INWARDED`, `UNLOADED`, or `GRN_PENDING` status. Instantly populates receiving warehouse, supplier, PO reference, delivery challan number, challan date, vehicle number, E-Way Bill, and declared consignment line items.
     * **Purchase Order Linking:** Select from approved or released POs (`tbl_po_header`). Automatically loads open ordered quantities and contracted purchase rates.
  3. **Dual-Quantity & Variance Logging:**
     * Record declared supplier **Challan Quantity** and verified physical **Received Quantity**.
     * Real-time calculation of **Shortage** (`shortage_qty = challan - received`) and **Excess** (`excess_qty = received - challan`).
     * Line item commercial valuation dynamically calculated as `received_qty * unit_rate`.
  4. **Metallurgical Heat / Batch Traceability:**
     * Capture supplier Heat / Melt / Batch numbers (e.g. `HEAT-JSW-SS316-9812`), manufacturing dates, and expiration dates.
     * Traceable downstream to quality inspections, work order issues, and finished goods BOM genealogy.
  5. **Quarantine Staging Bay Put-Away (`QC_IN_PROGRESS`):**
     * Move uninspected materials or raw alloys requiring spectroscopy/PMI tests into physical quarantine staging cages (e.g. `QC-Z1-R01-S01-B01`).
     * Assigns inspector user ID, inspection timestamp, and sampling notes. Status advances to `QC_IN_PROGRESS`.
  6. **Final Store Approval & Upstream Auto-Sync (`APPROVED`):**
     * Storekeeper or QA supervisor verifies accepted vs rejected quantities and assigns permanent destination storage bins (e.g. `RM-Z1-R01-S01-B01` cantilever bar rack or pallet bin).
     * Authorizes approval remarks. System automatically:
       * Marks GRN status as `APPROVED`.
       * Increments received balance on Purchase Order items (`tbl_po_item.received_qty += received_qty`).
       * Updates Purchase Order status to `COMPLETED` (if fully fulfilled) or `PARTIALLY_RECEIVED`.
       * Sets Gate Inward status to `COMPLETED`.
  7. **Official Goods Receipt Note Voucher Printing:**
     * High-density industrial voucher designed for `@media print` A4 printing and archiving.
     * Features Kashvira corporate header, CIN & GSTIN, barcode simulation, supplier address & GSTIN, delivery challan & vehicle info, itemized table with heat numbers, received quantities, valuation in INR, and 3-tier authorized signatures (Prepared By, Inspected By, Store Manager).
  8. **Controlled Cancellation & Dependency Guard:**
     * Voids GRN with mandatory cancellation reason.
     * If previously approved, automatically rolls back PO received quantities and recomputes PO status.
     * Draft entries can be permanently deleted with `DependencyCheckService` foreign key validation.
* **Action Buttons:** `Print Voucher` (`PURCHASE_GRN -> PRINT`), `Export Register` (`PURCHASE_GRN -> EXPORT`), `+ Create GRN Indent` (`PURCHASE_GRN -> ADD`), `Edit Indent` (`PURCHASE_GRN -> EDIT`), `Submit for QC` (`PURCHASE_GRN -> SUBMIT`), `Quarantine Put-Away` (`PURCHASE_GRN -> EDIT`), `Store Inward Approval` (`PURCHASE_GRN -> APPROVE`), `Cancel GRN` (`PURCHASE_GRN -> CANCEL`), and `Delete Indent` (`PURCHASE_GRN -> DELETE`).
### 2.22 Step 5.6 — Inward Material QC Inspection, Heat/Batch Allocation & Quarantine Clearance (`/quality/inward-qc`)

* **Screen Code:** `INWARD_QC` (Screen ID: `1021`)
* **Navigation Path:** `Sidebar -> QUALITY ASSURANCE & QC -> Inward Material QC`
* **Primary Roles Authorized:** `SUPER_ADMIN`, `PLANT_MANAGER`, `QA_HEAD`, `STORE_OFFICER`, `PURCHASE_EXEC`
* **Operational Capabilities:**
  1. **Executive Quality KPI Dashboard:**
     * **Total Inspections:** Cumulative count of all inward goods quality inspection certificates registered across plant locations.
     * **Pending QC Lab Clearance:** Count of inspection records in `DRAFT` or `UNDER_INSPECTION` state held in quarantine cages pending laboratory tests.
     * **Accepted Lots:** Cumulative count of incoming consignments meeting engineering tolerances and released to inventory storage bins.
     * **Rejected / Quarantine Holds:** Cumulative count of non-conforming or quarantined lots flagged for return to vendor (RTV) or rework.
  2. **1-Click Quarantine GRN Import:**
     * Direct linking with active Goods Receipt Notes in `SUBMITTED`, `QC_IN_PROGRESS`, or `DRAFT` status (`tbl_inv_grn_header`).
     * Automatically extracts supplier details, purchase order references, delivery challan numbers, heat/batch numbers, and received line items with inspection sample quantities.
  3. **Comprehensive Metallurgical & Physical Testing Checklist:**
     * **Visual & Packaging Verification:** Surface defects, oxidation, dent marks, mill scale, shipping damage, identification tagging, and vendor MTC (Mill Test Certificate) verification.
     * **Dimensional & Metrology Checks:** Diameter, wall thickness, outer length, machined bores, thread pitch, and profile tolerances against engineering drawings using calibrated vernier calipers/micrometers.
     * **Chemical & Spectrometry Composition:** PMI (Positive Material Identification) or optical emission spectroscopy logging (% Carbon, % Chromium, % Nickel, % Manganese, % Silicon, % Phosphorus, % Sulfur) against alloy grade specifications (e.g. SS316, EN8, EN19, LM6, IS 2062).
     * **Hardness & Mechanical Testing:** Rockwell (HRC), Brinell (HBW), or Vickers (HV) indentation readings across core and case depths.
  4. **Dynamic Observed Parameters Engine:**
     * Free-form JSON parameter key-value pairs (e.g. `{"cr": "17.4%", "ni": "12.1%", "hrc": "28", "vis_coating": "Uniform"}`) recorded per inspected item.
     * Stores instrument calibration IDs, test methods (ASTM/IS/DIN), sample sizes, and defect classifications.
  5. **Traceable Heat / Batch Allocation & Split Dispositions:**
     * Allocates exact received lots into **Accepted Quantity** (`accepted_qty`) and **Rejected Quantity** (`rejected_qty`).
     * Direct assignment of approved permanent destination warehouse bins (e.g. `RM-Z1-R01-S01-B01`) and quarantine non-conformance quarantine bins (e.g. `QC-Z1-R01-S01-B01`).
     * Rejection category tagging: `DIMENSIONAL_OUT_OF_SPEC`, `CHEMICAL_MISMATCH`, `SURFACE_DEFECTS`, `DOCUMENTATION_DEFICIT`, `HARDNESS_FAILURE`, or `TRANSIT_DAMAGE`.
  6. **Enterprise Upstream Auto-Synchronization (`APPROVE`):**
     * Executing **Approve & Clear to Stock** completes the inspection certificate (`COMPLETED`, `ACCEPTED`) and automatically:
       * Releases quarantine holds on linked GRN items (`quarantine_qty = 0`, sets `accepted_qty`, `rejected_qty`, `storage_bin_id`, `batch_no`).
       * Updates the Goods Receipt Note status to `APPROVED` with quality inspector and clearance timestamps.
       * Increments `received_qty` on Purchase Order line items (`tbl_po_item.received_qty += accepted_qty`).
       * Recomputes Purchase Order status to `COMPLETED` or `PARTIALLY_RECEIVED`.
       * Updates Gate Inward entry status to `COMPLETED`.
  7. **Quarantine Rejection Workflow (`REJECT`):**
     * Flags non-compliant items as `REJECTED`, sets non-conformance report (NCR) reference number, logs quarantine holding location, and prevents release into active plant WIP or assembly racks.
  8. **Official Quality Inspection Certificate & MTC Co-sign:**
     * Printable A4 quality test certificate (`@media print`) complete with Kashvira plant header, Heat/Melt number tracking, chemical and mechanical test summaries, disposition metrics, vendor MTC attachment references, and dual signature blocks (QA Inspector & Quality Assurance Head).
  9. **Controlled Cancellation & Security Validation:**
     * Revokes inspection record with mandatory cancellation remarks.
     * If linked to upstream GRNs, safely rolls back inspection states.
* **Action Buttons:** `Print Certificate` (`INWARD_QC -> PRINT`), `Export Register` (`INWARD_QC -> EXPORT`), `+ New QC Inspection` (`INWARD_QC -> ADD`), `Edit Inspection` (`INWARD_QC -> EDIT`), `Submit for Lab Approval` (`INWARD_QC -> SUBMIT`), `Approve & Clear to Stock` (`INWARD_QC -> APPROVE`), `Reject Lot` (`INWARD_QC -> REJECT`), `Cancel QC` (`INWARD_QC -> CANCEL`), and `Delete Inspection` (`INWARD_QC -> DELETE`).

### 2.23 Step 5.7 — Warehouse Bin Put-Away, Lot Allocation & Stock Ledger Posting (`/inventory/put-away`)

* **Screen Code:** `BIN_PUTAWAY` (Screen ID: `1022`)
* **Navigation Path:** `Sidebar -> INVENTORY & WMS -> Bin Put-Away & Stock`
* **Primary Roles Authorized:** `SUPER_ADMIN`, `PLANT_MANAGER`, `STORE_OFFICER`, `PURCHASE_EXEC`
* **Operational Capabilities:**
  1. **Executive WMS Operational KPIs:**
     * **Total Put-Away Tasks:** Cumulative count of all warehouse put-away orders registered across plant facilities.
     * **Pending Assignment:** Count of material movements in `DRAFT` or `ASSIGNED` state awaiting forklift operator dispatch.
     * **In-Progress Moves:** Real-time active material transport tasks between receiving staging docks and racking aisles.
     * **Completed & Stock Posted:** Count of fulfilled put-away orders where items have been verified and credited to live on-hand stock ledgers.
  2. **1-Click Sourcing from Approved QC Clearance:**
     * Direct import from QC Inspection certificates in `COMPLETED` and `ACCEPTED` status (`tbl_qc_inward_inspection_header`).
     * Automatically pulls approved items, accepted quantities, supplier heat/batch numbers, quarantine source bins, and target storage bins.
  3. **Multi-Type Put-Away Execution:**
     * **QC Inspection Release (`QC_RELEASE`):** Transfer from quarantine inspection bays (`QC-Z1-R01-S01-B01`) to permanent storage racks.
     * **Direct GRN Inward (`GRN_INWARD`):** For fast-track standard consumables or non-QC items moving directly from dock to bin.
     * **Internal Relocation (`INTERNAL_TRANSFER`):** Inter-bay or inter-rack optimization and replenishment.
     * **Rework Stock Return (`REWORK_RETURN`):** Restocking post-rework or inspection deviation clearance.
  4. **Forklift & Store Operator Task Dispatch (`ASSIGN`):**
     * Assign specific material relocation tasks to registered plant storekeepers or forklift operators.
     * Provides bay instructions, aisle stacking rules, and crane requirements.
  5. **Physical Put-Away Confirmation & Real-Time Stock Ledger Posting (`CONFIRM`):**
     * Operator verifies physical destination bin (e.g. `RM-Z1-R01-S01-B01` cantilever rack or `CHEM-Z2-R01-S01-B01` chemical ground bay) and confirmed put-away quantity.
     * Upon confirmation, system atomically:
       * Transitions put-away task and line items to `COMPLETED`.
       * Upserts live on-hand and available balance in `tbl_inv_bin_stock` for `(warehouse_id, bin_id, item_id, batch_no)`.
       * Inserts an immutable transaction row into `tbl_inv_stock_ledger` recording transaction type `PUTAWAY_INWARD`, reference voucher, source/destination bins, quantity in, unit cost, and closing balance.
  6. **Official Put-Away Voucher & Stock Transfer Slip:**
     * Printable A4 transfer sheet (`@media print`) complete with Kashvira manufacturing header, CIN/GSTIN, task barcode, source document references, itemized movement table (Material, Heat/Batch, Source Bay, Target Storage Bin, Verified Qty), special bay handling instructions, and dual sign-off blocks (Forklift Operator & Warehouse Manager).
  7. **Controlled Task Cancellation & Safe Deletion:**
     * Voids uncompleted tasks with mandatory cancellation reason.
     * Prevents deletion of completed tasks; draft tasks verified through `DependencyCheckService`.
* **Action Buttons:** `Print Task Sheet` (`BIN_PUTAWAY -> PRINT`), `Export Register` (`BIN_PUTAWAY -> EXPORT`), `+ Create Put-Away Task` (`BIN_PUTAWAY -> ADD`), `Edit Task` (`BIN_PUTAWAY -> EDIT`), `Assign Operator` (`BIN_PUTAWAY -> ASSIGN`), `Start Put-Away` (`BIN_PUTAWAY -> EDIT`), `Confirm & Post Stock` (`BIN_PUTAWAY -> CONFIRM`), `Void Task` (`BIN_PUTAWAY -> CANCEL`), and `Delete Task` (`BIN_PUTAWAY -> DELETE`).



### 2.24 Step 5.8 — Purchase Invoice 3-Way Matching, GST Input Tax Credit & Accounts Payable Clearance (`/procurement/invoices`)

* **Screen Code:** `PURCHASE_INVOICE` (Screen ID: `1023`)
* **Navigation Path:** `Sidebar -> PROCUREMENT & SOURCING -> Invoices & 3-Way Match`
* **Primary Roles Authorized:** `SUPER_ADMIN`, `PLANT_MANAGER`, `PURCHASE_EXEC`, `STORE_OFFICER`
* **Operational Capabilities:**
  1. **Executive Accounts Payable & 3-Way Match KPIs:**
     * **Total Invoices Logged:** Cumulative count of all vendor commercial invoices registered in the ERP across plant locations with total gross booking valuation (₹).
     * **3-Way Clean Matched:** Total count and percentage of commercial bills with zero discrepancy between purchase order unit rates, goods receipt received quantities, and laboratory QC accepted quantities.
     * **Variances Flagged:** Total count of purchase bills placed on commercial hold due to price variance (invoiced unit rate exceeds PO contracted rate) or quantity variance (billed quantity exceeds QC accepted quantity).
     * **Accounts Payable & Liabilities:** Real-time outstanding accounts payable balance due to suppliers vs cumulative cleared disbursements.
  2. **1-Click Sourcing & 3-Way Import Acceleration:**
     * **1-Click Import from Approved GRN/QC:** Select any pending inward consignment (`GRN-AHM-2627-XXXX`). The system automatically extracts the vendor, GSTIN, PO contract reference, challan reference, line items, contracted PO rates, and QC accepted quantities.
     * **Direct Purchase Order Linking:** Select active purchase orders (`tbl_po_header`) for direct commercial invoicing or progress billing.
  3. **Automated 3-Way Variance Detection Engine:**
     * **Rate Variance ($\Delta$):** Real-time line item comparison `rate_variance = invoiced_rate - po_rate`. Automatically highlights positive discrepancies and assigns `PRICE_VARIANCE` matching status.
     * **Quantity Variance ($\Delta$):** Compares `billed_qty` against `accepted_qty`. If billed quantity exceeds accepted material quantity, flags the invoice as `QTY_VARIANCE`.
     * **Clean Matching (`MATCHED`):** When all unit rates and quantities align within tolerance, tags invoice as `MATCHED` and marks the lot clean for AP approval.
  4. **GST Input Tax Credit (ITC) & Withholding Tax Architecture:**
     * Automatically breaks down HSN-wise CGST (9%), SGST (9%), or inter-state IGST (18%) on net taxable material values.
     * **TDS Withholding u/s 194Q:** Configurable tax deduction at source (0.1% on purchase of goods) deducted from gross payable.
     * **TCS Withholding u/s 206C:** Configurable tax collection at source added to final payable amount.
     * Computes ancillary freight, transit insurance, packaging charges, and mathematical round-off to derive net AP liability.
  5. **Commercial Accounts Payable Approval Workflow (`APPROVE`):**
     * Authorized finance/commercial officers review the 3-way match audit comparison.
     * Approving transitions status from `SUBMITTED` to `APPROVED`, timestamps `approved_date`, records approver user ID, and establishes final AP balance liability.
  6. **AP Payment Clearance & Disbursement Tracking (`record-payment`):**
     * Finance officers record bank payments against approved invoices.
     * Captures payment amount, clearance mode (`NEFT`, `RTGS`, `CHEQUE`, `UPI`), bank UTR / reference number, payment date, and remittance notes.
     * Real-time calculation of remaining balance: updates payment status to `PARTIALLY_PAID` or `PAID`.
  7. **Official Commercial AP Voucher Printing (`PRINT`):**
     * High-fidelity A4 printable voucher (`@media print`) complete with Kashvira Infotech corporate branding, vendor details, cross-references (Bill No, PO No, GRN No, QC No), tri-party line item audit table, GST ITC summary, TDS deduction breakdown, and 3-tier authorized signatures (Prepared By, Tax Auditor, AP Approver).
  8. **Controlled Cancellation & Referential Integrity Guard:**
     * Voids commercial invoices with mandatory cancellation reasoning (`CANCEL`).
     * Prohibits cancellation if bank payments have already been recorded.
     * Draft invoices can be permanently deleted with `DependencyCheckService` validation (`DELETE`).
* **Action Buttons:** `Print AP Voucher` (`PURCHASE_INVOICE -> PRINT`), `Export Register` (`PURCHASE_INVOICE -> EXPORT`), `+ New Purchase Invoice` (`PURCHASE_INVOICE -> ADD`), `Edit Draft` (`PURCHASE_INVOICE -> EDIT`), `Submit for Approval` (`PURCHASE_INVOICE -> SUBMIT`), `Approve Accounts Payable` (`PURCHASE_INVOICE -> APPROVE`), `Record AP Payment` (`PURCHASE_INVOICE -> APPROVE`), `Cancel Invoice` (`PURCHASE_INVOICE -> CANCEL`), and `Delete Invoice` (`PURCHASE_INVOICE -> DELETE`).


### 2.25 Step 6.1 — Multi-Level Bill of Materials (BOM), Versions, Scrap Factors & Co-Products / By-Products (`/manufacturing/boms`)

* **Screen Code:** `MFG_BOM` (Screen ID: `1024`)
* **Navigation Path:** `Sidebar -> MANUFACTURING & PRODUCTION -> Bill of Materials (BOM)`
* **Primary Roles Authorized:** `SUPER_ADMIN`, `PLANT_MANAGER`, `DESIGN_ENG` (Production / Design Engineers)
* **Operational Capabilities:**
  1. **Executive BOM & Engineering Architecture KPIs:**
     * **Total BOMs:** Cumulative count of all engineering Bill of Materials registered across assemblies and components.
     * **Active Production BOMs:** Total count of officially released, production-ready BOMs deployed for Shopfloor Work Orders and Material Requirements Planning (MRP).
     * **Multi-Level Assemblies:** Total count of assemblies featuring recursive sub-assemblies and multi-tier indented hierarchies.
     * **Avg Net Unit Cost:** Average net manufacturing unit cost (material + labor + overhead less co-product credits) across all active assemblies.
  2. **Multi-Level Recursive Indented Tree Explosion (`EXPLODE`):**
     * Click the **Multi-Level Tree Explosion** icon (`GitFork`) on any assembly to visualize the recursive indented BOM structure.
     * Recursively traverses sub-assemblies (Level 0 Top Assembly, Level 1 Sub-Assemblies & Leaf Components, Level 2 Sub-tier Raw Materials, etc.).
     * Computes cumulative required quantities by multiplying parent batch consumption factors through all hierarchy levels.
     * Includes automated cycle detection to guarantee zero circular reference loops.
     * Supports interactive expand/collapse of individual sub-assembly nodes, visual sourcing badges (`MANUFACTURED`, `PURCHASED`, `SUBCONTRACTED`), operation sequence numbers, scrap percentages, and rolled-up extended costs.
  3. **4-Tab BOM Creation & Engineering Recipe Editor:**
     * **Tab 1: General & Header Specifications:** Select finished goods or WIP sub-assemblies, set base batch output quantity and UOM, assign engineering version/revision (`v1.0`, `v2.0`), BOM classification (`PRODUCTION`, `TEMPLATE`, `ENGINEERING`, `PROTOTYPE`), effective date windows, routing ID, and primary default flag.
     * **Tab 2: Components & Process Scrap Factors:** Add/remove component line items. For each line, configure component item, net quantity, process shrinkage/scrap percentage (`scrap_factor_percent`), gross quantity calculated dynamically as $\text{Gross Qty} = \text{Net Qty} \times (1 + \frac{\text{Scrap \%}}{100})$, optional child sub-assembly BOM link, unit cost, extended line cost, sourcing type, and critical part indicator.
     * **Tab 3: Co-Products, By-Products & Recoverable Scrap:** Add/remove secondary process outputs (`RECOVERABLE_SCRAP`, `BY_PRODUCT`, `CO_PRODUCT`). Captures recovery quantity, UOM, estimated salvage recovery rate (₹), and automatically computes credit values that offset gross production costs.
     * **Tab 4: Live Manufacturing Cost Rollup Summary:** Interactive real-time cost accounting engine breaking down Direct Material Cost, Direct Labor Absorption, Factory Overhead Absorption, and Less: Co-Product Recovery Credit to derive Net Total Batch Cost and Net Unit Cost per finished product.
  4. **1-Click BOM Version Cloning (`CLONE`):**
     * Allows engineers to duplicate an entire BOM structure into a new revision (e.g. `v1.0` $\rightarrow$ `v2.0` or `v1.1`) in one click.
     * Deep-copies all line items, scrap factors, operations, and by-products while ensuring version uniqueness per item.
     * Option to mark the newly cloned revision as the primary default production BOM.
  5. **BOM Engineering Approval & Production Release Workflow (`APPROVE`):**
     * Draft engineering revisions undergo formal approval before release to shopfloor operations.
     * Promoting a BOM from `DRAFT` to `ACTIVE` logs the approving engineer user ID, timestamps the approval, records engineering remarks, and immediately enables the revision for production work order generation.
  6. **Official Printable Costed BOM Datasheet (`PRINT`):**
     * Professional A4 engineering datasheet (`@media print`) complete with Kashvira Infotech corporate manufacturing header, item details, base batch size, indented component breakdown with scrap factors and extended costs, co-product recovery table, full absorption cost rollup box, and dual engineering sign-off blocks (Design Engineer & Works Head).
  7. **Referential Integrity & Controlled BOM Deletion (`DELETE`):**
     * Deletion of active or referenced BOMs is strictly safeguarded.
     * If a BOM is referenced as a sub-assembly child in any active parent BOM, deletion is blocked with a descriptive conflict message.
     * Draft or obsolete unreferenced BOMs can be safely deleted via `<ConfirmDeleteModal>`.
* **Action Buttons:** `Print Datasheet` (`MFG_BOM -> PRINT`), `Export Register` (`MFG_BOM -> EXPORT`), `+ New Bill of Materials` (`MFG_BOM -> ADD`), `Edit BOM` (`MFG_BOM -> EDIT`), `Multi-Level Tree Explosion` (`MFG_BOM -> EXPLODE`), `Clone Revision` (`MFG_BOM -> CLONE`), `Approve & Release` (`MFG_BOM -> APPROVE`), and `Delete BOM` (`MFG_BOM -> DELETE`).


### 2.26 Step 6.2 — Work Centers, Production Lines, Capacity & Shift Calendars (`/manufacturing/work-centers`)

* **Screen Code:** `MFG_WORK_CENTER` (Screen ID: `1025`)
* **Navigation Path:** `Sidebar -> MANUFACTURING & PRODUCTION -> Work Centers & Capacities`
* **Primary Roles Authorized:** `SUPER_ADMIN`, `PLANT_MANAGER`, `DESIGN_ENG`, `STORE_OFFICER`
* **Operational Capabilities:**
  1. **Executive Work Center & Capacity Architecture KPIs:**
     * **Total Work Centers:** Total production cells, CNC machining bays, assembly lines, furnaces, and workstations configured in the factory branch.
     * **Daily Rated Capacity:** Cumulative standard working hours available across all active work centers per day (e.g. 80.0 Hours/Day across 5 cells).
     * **Plant Machinery & Assets:** Total capital equipment and machine tools installed on the shopfloor along with live operational vs breakdown status (e.g. 10/10 Operational).
     * **Weighted Factory Efficiency:** Overall Equipment Effectiveness (OEE) and efficiency percentage benchmark across manufacturing bays (e.g. 85.4% average OEE).
  2. **Multi-Classification Work Center Register:**
     * High-density master listing supporting six distinct classifications: `MACHINE` (CNC lathes, milling centers), `LINE_ASSEMBLY` (conveyorized lines, packaging benches), `MANUAL` (bench fitting, deburring), `FURNACE` (sealed quench carburizing, tempering), `TEST_BENCH` (hydrostatic testing, CMM), and `SUBCONTRACTOR` (external partner processing).
     * Filterable by Operational Status (`ACTIVE`, `UNDER_MAINTENANCE`, `INACTIVE`), Classification Type, and Shopfloor Department (`PROD-CNC`, `MAINT-ENG`, etc.).
  3. **3-Tab Work Center & Cell Configuration Modal:**
     * **Tab 1: General Specifications & Rated Capacity:** Configure unique work center code (`WC-CNC-01`), descriptive title, department linkage, shopfloor bay location, daily standard working capacity in hours (up to 24 hrs), efficiency / OEE percentage rating (compounding effective hours = $\text{Capacity Hours} \times \frac{\text{OEE \%}}{100}$), capacity UOM, status, and engineering remarks.
     * **Tab 2: Machinery & Capital Assets Register:** Associate physical equipment and machine tools with machine code, description, model number, serial number, OEM manufacturer, installation date, warranty expiration date, power rating in kW, operational status, and preventive maintenance scheduling.
     * **Tab 3: Shift Calendars & Hourly Cost Absorption Matrix:** Allocate one or multiple factory working shifts with assigned operator staffing counts. Define direct machine operating cost (₹/hr), direct operator labor cost (₹/hr), and factory overhead/power absorption cost (₹/hr) to auto-compute the standard total hourly rate (₹/hr) utilized in Production Routings and Work Order variance costing.
  4. **Machinery Maintenance & Breakdown Logging (`MAINTENANCE`):**
     * Dedicated maintenance action modal (`Wrench`) to update individual machine operational statuses (`OPERATIONAL`, `BREAKDOWN`, `STANDBY`, `DECOMMISSIONED`).
     * Log preventive maintenance service dates, next PM due dates, and maintenance engineering remarks.
     * Intelligent cell failover: if all machinery assigned to a work center is marked as `BREAKDOWN`, the system automatically transitions the parent work center's status to `UNDER_MAINTENANCE`.
  5. **Factory Shift Management Modal:**
     * Shortcut to inspect and register factory production shifts (`tbl_mfg_shift`) complete with shift code (`SHIFT-GEN`, `SHIFT-M1`, `SHIFT-E1`, `SHIFT-N1`), shift start/end times, lunch/tea break durations, effective working hours (e.g. 8.00 hrs, 6.50 hrs), and overnight night shift flags.
  6. **Official Printable Work Center Capacity & Equipment Datasheet (`PRINT`):**
     * Professional A4 engineering datasheet (`@media print`) complete with Kashvira Infotech corporate manufacturing header, work center specifications, installed machinery inventory table, shift operational schedule, absorption hourly cost matrix, and dual supervisory sign-offs (Maintenance Engineer & Works Manager).
  7. **Controlled Deletion & Referential Integrity Guard (`DELETE`):**
     * Validates that work centers are unlinked from active production routings or operations before allowing permanent removal.
     * Cascading cleanup of assigned machine links and shift mappings within a managed database transaction.
* **Action Buttons:** `Print Datasheet` (`MFG_WORK_CENTER -> PRINT`), `Export Register` (`MFG_WORK_CENTER -> EXPORT`), `+ New Work Center` (`MFG_WORK_CENTER -> ADD`), `Edit Work Center` (`MFG_WORK_CENTER -> EDIT`), `Log Maintenance / Breakdown` (`MFG_WORK_CENTER -> MAINTENANCE`), and `Delete Work Center` (`MFG_WORK_CENTER -> DELETE`).

### 2.27 Step 6.3 — Production Routings, Operation Sequences, Standard Cycle Times & Machine Tooling (`/manufacturing/routings`)

* **Screen Code:** `MFG_ROUTING` (Screen ID: `1026`)
* **Navigation Path:** `Sidebar -> MANUFACTURING & PRODUCTION -> Production Routings`
* **Primary Roles Authorized:** `SUPER_ADMIN`, `PLANT_MANAGER`, `DESIGN_ENG`, `QA_HEAD`
* **Operational Capabilities:**
  1. **Executive Production Routing KPIs:**
     * **Total Routings:** Total configured multi-stage production routings across all manufactured parts and assemblies.
     * **Active Routings:** Approved and shopfloor-released production routings ready for manufacturing execution.
     * **Configured Assemblies:** Distinct manufactured finished goods and sub-assemblies possessing active process routes.
     * **Avg Run Cycle Time:** Fleet-wide average unit machining, treatment, and assembly cycle time in minutes.
  2. **High-Density Master Routing Register:**
     * Displays routing document code (`ROUT-{ITEM_CODE}-V{VER}`), item code & description, engineering version pill (`v1.0`, `v2.0`), release status badge (`ACTIVE`, `DRAFT`, `UNDER_REVIEW`, `OBSOLETE`), default indicator badge, sequential operations count, cumulative setup time, standard unit run cycle time, and standard absorption cost per unit in ₹.
     * Filterable by status, manufactured assembly item, and default-only toggle.
  3. **Interactive Sequential Operation Flow Timeline Visualizer (`Eye`):**
     * Click any routing row to open an interactive chronological visualizer mapping each manufacturing operation stage (e.g. OP-10 -> OP-20 -> OP-30...).
     * Highlights sequence number, operation name, assigned work center cell badge, preferred machine tool asset, standard setup & run minutes, line overlap percentages, tooling inserts and fixture catalog numbers, quality gate checkpoints with target tolerances, and operation cost contribution.
  4. **3-Tab Production Routing Configuration Modal:**
     * **Tab 1: Header & General Parameters:** Select manufactured assembly item, define routing document code, description name, revision version (e.g. `1.0`), standard batch lot size for setup amortization, release & expiry dates, default primary routing toggle, and engineering remarks.
     * **Tab 2: Operation Sequencer:** Dynamic multi-row builder to add sequential stages (`+10` increments: 10, 20, 30...). Select work center (auto-populating machine, labor, and overhead absorption rates), preferred machine asset, setup time (mins), unit run cycle time (mins), line overlap %, tooling & insert specifications, fixture/jig IDs, quality gate toggle with inspection checkpoints, and subcontracting flags with vendor assignments. Supports drag/arrow stage reordering.
     * **Tab 3: Absorption Costing & Summary:** Live cost distribution rollup displaying direct machinery absorption (₹), direct operator labor cost (₹), factory overhead absorption (₹), and total standard routing cost per unit. Auto-computes estimated shopfloor lead time in days.
  5. **Routing Engineering Approval & Release Workflow (`APPROVE`):**
     * Promotes draft engineering routings to `ACTIVE` status with reviewer remarks, audit timestamping, and authorized user credentials.
     * Includes automated option to mark the approved version as the primary default routing and seamlessly sync/link its routing ID to the item's active Bill of Materials (`tbl_mfg_bom_header.routing_id`).
  6. **1-Click Routing Revision & Cloning (`CLONE`):**
     * Duplicates an existing routing to a new target revision (e.g. `1.1` or `2.0`) with updated document code.
     * Copies all sequential operation stages, tooling specs, and machine assignments into a new `DRAFT` revision for engineering change optimization.
  7. **Official Printable Shopfloor Route Traveler Card (`PRINT`):**
     * Professional ISO 9001 / IATF 16949 compliant routing traveler sheet (`@media print`) complete with Kashvira Infotech manufacturing header, part numbers, batch quantity, drawing revision, operation sequence table, tooling references, inspection criticalities, and formal sign-off stamp blocks (Operator Sign, QC Inspector Stamp, Production Engineer, Quality Assurance Head, and Plant Operations Manager).
  8. **Controlled Referential Deletion Guard (`DELETE`):**
     * Prevents deletion of active routings if they are linked to Bill of Materials (BOM) or production work orders.
     * Performs cascading removal of child operations within an ACID transaction.
* **Action Buttons:** `Print Traveler` (`MFG_ROUTING -> PRINT`), `Export Register` (`MFG_ROUTING -> EXPORT`), `+ New Routing` (`MFG_ROUTING -> ADD`), `Edit Routing` (`MFG_ROUTING -> EDIT`), `Timeline Visualizer` (`MFG_ROUTING -> VIEW`), `Clone Revision` (`MFG_ROUTING -> CLONE`), `Approve & Release` (`MFG_ROUTING -> APPROVE`), and `Delete Routing` (`MFG_ROUTING -> DELETE`).
