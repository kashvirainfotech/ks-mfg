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
