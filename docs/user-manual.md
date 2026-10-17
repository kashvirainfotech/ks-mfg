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


