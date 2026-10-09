# KS-MFG Frontend UI Mockup

**Purpose:** Standalone, interactive HTML/CSS/JavaScript mockup for visual verification and feedback before full React development.

---

## 1. How to Open & Run

You can view this mockup in any web browser without running any servers or installing dependencies:
1. Double-click [`mockup/open-mockup.bat`](file:///c:/Projects/KashviraInfotech/ks-mfg/mockup/open-mockup.bat) in Windows Explorer, OR
2. Double-click or open [`mockup/index.html`](file:///c:/Projects/KashviraInfotech/ks-mfg/mockup/index.html) directly in Google Chrome, Microsoft Edge, or Mozilla Firefox.

---

## 2. Included Screens & Interactive Features

### 1. Top Floating Mockup Navigation Bar
* Located at the top right:
  * **"1. Login Screen"**: Swaps view to the split-screen login.
  * **"2. Home Dashboard"**: Swaps view to the plant operations dashboard.
  * **"3. Customer Master"**: Swaps view to the customer master directory table.
  * **Sun/Moon Icon**: Instantly toggles between **Light** and **Dark** mode.

---

### 2. Login Page
* **Left Column:**
  * Project branding, manufacturing highlights, and production control features.
  * Security & compliance indicators (256-bit TLS, RBAC, Field-level Audit).
* **Right Column:**
  * Clean login form (Username, Password, Remember Me).
  * Persona switcher toggle: `Employee / Plant Staff` vs `Customer / Vendor Portal`.
  * **1-Click Demo Credentials:** Instant buttons for **Super Admin** (`admin`), **Branch Manager** (`rajesh.patel`), and **Customer** (`tatamotors.pune`).
  * Clicking "Sign In" navigates into the ERP dashboard.

---

### 3. Home Page (Dashboard)
* **Header:**
  * Logo (`KS-MFG ERP`).
  * **Multi-Tenant Branch Switcher:** Interactive dropdown allowing switching between `Pune Plant`, `Mumbai HQ`, and `Ahmedabad Depo`.
  * Global Search (`Ctrl+K`).
  * Header Action Icons: Quick "+ New Voucher" button, Notification Bell with unread badge.
  * **Theme Accent Color Picker:** Palette selector (Indigo, Blue, Emerald, Violet, Amber, Rose) dynamically restyling theme CSS tokens.
  * **User Profile Menu:** Displays logged-in user (`Rajesh Patel - Branch Manager`), employee mapping (`EMP-1042`), link to profile settings modal, and Sign Out.
* **Collapsible Sidebar:**
  * Responsive navigation tree with badges (Dashboard, Customer Master, Items, Dynamic Warehouses, Purchase PO/GRN, Production Work Orders, Job-Work Subcontracting, Sequence Reset).
  * System connectivity status indicator ("Online | PostgreSQL 16 | Redis Cache Active").
* **KPI Metrics Cards:**
  * Active Work Orders (`38`, +12% trend).
  * Today's Inward GRN (`142.5 MT`, +5.4% trend).
  * Vendor Job-Work Outstanding (`18 Lots`, 3 overdue indicator).
  * Finished Goods Stock Valuation (`₹ 4.82 Cr`, 94.2% allocatable).
* **Interactive Charts (Chart.js):**
  * **Daily Production Output vs Target:** Dual Bar (Actual MT) and Line (Planned MT) chart.
  * **Warehouse Inventory by Category:** Doughnut chart breaking down Raw Material, FG, WIP, and Scrap.
* **Operational Info Tables:**
  * Recent Production Work Orders with status badges (`Machining`, `QC Inspection`, `Completed`).
  * Stock Threshold & Reorder Triggers table highlighting low stock items.

---

### 4. Customer Master Listing Screen
* **Toolbar:**
  * Instant search bar filtering by customer code, legal name, GSTIN, and city.
  * Customer Group filter dropdown (`Automotive OEM`, `Heavy Engineering`, `Industrial Distributor`, `Export Global`).
  * Status filter dropdown (`Active` / `Inactive`).
  * Sort dropdown (Name A-Z, Name Z-A, Highest Credit Limit, Customer Code).
  * **"Group By" Toggle:** Group table rows by Customer Group with collapsible headers.
  * **Action Buttons:** `Export Excel` and `Print` with simulated permission checks.
  * **"+ Add Customer" Button:** Opens the Add/Edit Popup modal.
* **Enterprise High-Density Table:**
  * Columns: Customer Code, Legal Name & City, Group & Region, Contact Person & Phone, GSTIN & PAN, Credit Limit (₹), Credit Days, Status Badge, and Action buttons (Edit & Delete).
* **Pagination Bar:**
  * Shows records count (`Showing 1 to 5 of 24 entries`).
  * Rows per page dropdown (`5`, `10`, `25`).
  * Interactive page number pills (`Previous`, `1`, `2`, `Next`).

---

### 5. Add / Edit Customer Popup (Modal)
* High-density modal dialog with organized sections:
  1. **General Information:** Customer Code, Legal / Trade Name, Group, Region, Default Currency.
  2. **Statutory & Tax Compliance:** GSTIN (15 Digits), PAN, MSME Registration number.
  3. **Contact & Credit Control:** Key Contact Person, Mobile, Credit Limit (₹), Credit Days.
  4. **Address & Price List:** Billing Street Address, City, Assigned Price List, and Account Status.
* Validation and save handler that updates the data table in real time with mock activity trail confirmation.

---

### 6. Mandatory Referential Dependency Check Simulation
* When clicking the **Trash / Delete icon** on a customer who is referenced in transactions (e.g. `Tata Motors` or `Bharat Forge`):
  * The system **blocks deletion** as mandated in `agents.md` § 1.6!
  * Opens the **Referential Dependency Conflict Dialog** showing which active transactions (Sales Orders, Dispatch Challans, Price Lists) block the deletion.
* When deleting a customer with no active transactions (e.g. `Mahindra & Mahindra`), the system prompts for confirmation and safely deletes the record.

---

### 7. User Profile & Theme Customization Modal
* Accessible via the top profile dropdown &rarr; "My Profile & Theme Settings":
  * Select Theme Mode (`Light Mode` vs `Dark Mode`).
  * Select Primary Accent Theme Color (`Indigo`, `Blue`, `Emerald`, `Violet`, `Amber`, `Rose`).
