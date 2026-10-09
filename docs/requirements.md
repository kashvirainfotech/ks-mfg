# Manufacturing ERP (KS-MFG) - Comprehensive System Requirements

**Document Version:** 1.0.0  
**Status:** Approved for Implementation  
**Target Systems:** Web Application (Phase 1, Primary), Native Mobile Apps (Phase 2, API-First Parity)  
**Target Audience:** Engineering Leads, Software Architects, Database Administrators, Product Owners  

---

## 1. Executive Summary & Core Objectives

**KS-MFG** is an enterprise-grade Manufacturing, Supply Chain, and Inventory Execution ERP system engineered for discrete and process manufacturing enterprises. The system manages the complete lifecycle from multi-tier procurement, multi-stage production execution, dynamic multi-level warehouse bin storage, and subcontracted job-work to customer sales and dispatch.

### 1.1 Core Strategic Principles
1. **Multi-Tenant & Multi-Branch First:** Complete logical separation and cross-branch operational control under a single corporate umbrella.
2. **Strict Multi-Level Governance:** Dynamic configuration engine inheriting parameters from Company $\rightarrow$ Branch $\rightarrow$ User levels.
3. **Strict Database Authority:** Database objects, sequences, and DDL are strictly authored via versioned SQL scripts with DBA review; zero automated ORM schema sync.
4. **Granular Access Control:** Role-Based and User-Based Access Control (RBAC/UBAC) extending down to individual UI action buttons (e.g., Authorize, Print, Export).
5. **Dynamic Inventory Architecture:** Multi-unit conversion at transaction time, flexible multi-level warehouse topologies (Chamber $\rightarrow$ Rack $\rightarrow$ Bin), and conditional batch/serial tracking.

---

## 2. Multi-Company, Multi-Branch & Financial Year Framework

### 2.1 Multi-Company Architecture
* The system shall support unlimited parent companies within a single database instance.
* Each company maintains distinct legal identities, tax identifiers (GSTIN, PAN, CIN, VAT), base currencies, fiscal periods, and logo/branding.
* Every transaction and master entity record must be bound to `comp_id`.

### 2.2 Multi-Branch Architecture
* Each company can have multiple operating branches (factories, regional warehouses, retail depots, corporate offices).
* Branches possess independent addresses, state tax registrations, default dispatch warehouses, and operational parameters.
* Users can be assigned access to one or more branches. A single user can possess **different roles in different branches** (e.g., Branch Manager in Branch 1, Auditor in Branch 2).

### 2.3 Financial Year (FY) Master & Branch-Wise Fiscal Control
* **Financial Year Definition:** Defined with `fyear_id`, `comp_id`, `fyear_code` (e.g., `FY-2026-27`), `start_date`, `end_date`, and `is_locked` status.
* **Branch-Wise FY Activation:** Provision to create, open, or close financial years specifically on a branch level. One branch can close fiscal books while another branch remains open during annual audit periods.
* **Transaction Header Enrolment:** Every transactional header record (Voucher) strictly persists `fyear_id` alongside `comp_id` and `branch_id`.
* **Voucher Sequence Reset Utility:**
  * Provision to reset voucher numbering sequences branch-wise and financial-year-wise.
  * Configurable voucher numbering patterns: `[PREFIX]/[BRANCH_CODE]/[FY_CODE]/[PADDED_SEQUENCE]` (e.g., `PO/PUN/26-27/000042`).
  * System UI allows the administrator to define sequence starting numbers, reset sequence counters at the start of a financial year, or repair fragmented sequence numbers.

---

## 3. Organizational Structure & User Management

### 3.1 Organization Hierarchy Masters
1. **Department Master:** Code, Name, Head of Department (HOD Employee ID), Branch binding, Status.
2. **Designation Master:** Code, Title, Grade/Hierarchy Level, Description, Status.
3. **Employee Master:**
   * Employee Code, First Name, Last Name, Gender, DOB, Date of Joining, Department ID, Designation ID, Primary Branch ID.
   * Contact details (Mobile, Official Email, Emergency Contact), Statutory IDs (PAN, Aadhaar/SSN, PF, ESI).
   * Reporting Manager (Self-referencing Employee ID).
   * Status: `Active`, `Probation`, `Notice Period`, `Terminated`, `Suspended`.

### 3.2 User Management, Persona Mapping & Global Role Architecture
* **User Entity:** `user_id`, `username`, `email`, `mobile_no`, `password_hash`, `user_type` (`EMPLOYEE` | `PARTY`), `ref_id`, `is_active`, `is_super_admin`.
* **Mandatory Persona Mapping:**
  * Every regular user login must be mapped to either:
    1. An **Employee** (`tbl_mst_employee`), or
    2. A **Party** (`tbl_mst_party` e.g., Customer, Supplier, Job-Worker, Transporter).
  * In the User Creation UI, an administrative radio toggle selects `user_type` (`Employee` vs `Party`), dynamically populating the appropriate autocomplete dropdown.
* **Super Admin Exception:**
  * The initial root Super Admin login (`admin` / `superadmin`) is the sole exception and is not mapped to an employee or party.
  * This account and its credentials must be seeded in `dbscripts/02_initial_data.sql` as essential data required to operate the web application.
* **Roles are Independent of Company and Branch:**
  * Role definitions (e.g., "Branch Manager", "QC Inspector", "Inventory Operator", "Billing Clerk", "Store Keeper") are **global master records** and are NOT bound to a specific company or branch.
  * Roles hold permissions to screens (View, Add, Edit, Delete) and specific action items (Print, Export, Authorize, Cancel, Reopen) within screens.
* **Users, Companies & Branches Assignment Matrix:**
  * A user can possess **one or more roles**.
  * A user can be mapped to **one or more companies with a role** (`tbl_sec_user_company_role`).
  * A user can be mapped to **one or more branches with a role** (`tbl_sec_user_branch_role`).
  * A user can have different roles across different branches (e.g., User A is "Branch Manager" in Pune Branch, but "Viewer / Auditor" in Mumbai Branch).

---

## 4. Screen-Level & Action-Item RBAC Engine

### 4.1 Screen & Module Registry
* Hierarchical screen registry (`module` $\rightarrow$ `sub_module` $\rightarrow$ `screen_id` $\rightarrow$ `route_path`).
* Screen metadata defines standard CRUD abilities: `can_view`, `can_add`, `can_edit`, `can_delete`.

### 4.2 Action-Item Registry (Granular Button-Level Control)
Beyond CRUD, manufacturing workflows demand granular action authorizations. Every screen registers specific action items:
* `PRINT`: Print transaction vouchers, tax invoices, job slips, barcode tags.
* `EXPORT`: Export grid data to Excel, CSV, or PDF.
* `AUTHORIZE` / `APPROVE`: First-level, second-level, or final managerial approval.
* `CANCEL`: Void a voucher with cancellation reason.
* `REOPEN`: Re-open an amended or rejected transaction.
* `PRICE_OVERRIDE`: Override master default prices during order booking.
* `FORCE_CLOSE`: Forcefully close pending purchase/production orders.

### 4.3 Permission Resolution Hierarchy
```
User Effective Permission = 
   (Direct User Permissions OR Role Permissions across Assigned Roles in Current Branch)
   AND Feature Configuration Flag Enabled
```
* **Frontend Enforcement:** Declarative React UI component `<PermissionGate screen="PO" action="AUTHORIZE">` renders the button or disabled state/tooltip.
* **Backend Enforcement:** NestJS Guard/Interceptor intercepting incoming HTTP requests verifying `(user_id, branch_id, screen_id, action_code)`.

---

## 5. Dynamic Hierarchical Configuration & Parameter Engine

All operational features in the system must be parameter-driven to suit varying factory protocols without code changes.

### 5.1 Parameter Hierarchy & Fallback Cascading
Parameters cascade across three strict tiers:
$$\text{User Level Override} \longrightarrow \text{Branch Level Override} \longrightarrow \text{Company Level Default} \longrightarrow \text{System Factory Default}$$
* If a parameter is requested for `(comp_id: 1, branch_id: 2, user_id: 5)`:
  1. The engine checks for a user-specific override.
  2. If absent/null, it cascades to the branch-specific override (`branch_id: 2`).
  3. If absent/null, it cascades to the company-specific default (`comp_id: 1`).
  4. If absent/null, it resolves the hardcoded system factory default.

### 5.2 Dynamic Configuration Registry
Configuration parameters are registered in `config_parameter_master`:
* `param_code`: Unique string key (e.g., `ENABLE_DUAL_UNIT`, `ENABLE_BATCH_TRACKING`, `ENABLE_SERIAL_TRACKING`, `ENABLE_BARCODE_SCANNING`, `ALLOW_NEGATIVE_STOCK`, `AUTO_VOUCHER_APPROVAL`).
* `data_type`: `BOOLEAN`, `INTEGER`, `DECIMAL`, `STRING`, `JSON`.
* `scope_level`: `COMPANY_ONLY`, `BRANCH_ALLOWED`, `USER_ALLOWED`.
* `default_value`: Baseline system default.
* `category`: `INVENTORY`, `PRODUCTION`, `PROCUREMENT`, `SALES`, `SECURITY`.

### 5.3 Administrative Parameter UI
* A dedicated administrative interface displays all parameters grouped by category.
* Matrix view allows toggling values at Company level, overriding per Branch, and overriding per User.
* Real-time cache invalidation (Redis pub/sub or TTL cache) ensures parameter changes apply immediately across active sessions.

---

## 6. Dynamic Multi-Level Warehouse & Location Hierarchy

Manufacturing facilities use diverse storage topologies. The system must accommodate arbitrary nesting depths per warehouse.

### 6.1 Warehouse Master
* Bound to `comp_id` and `branch_id`.
* Attributes: `warehouse_id`, `warehouse_code`, `warehouse_name`, `address`, `is_active`.
* Hierarchy Depth Definition: Configures whether this warehouse uses 1, 2, 3, 4, or 5 levels of physical storage.

### 6.2 Fully Dynamic Hierarchical Location Tree
The system supports variable path depths, such as:
* **Topology A:** `Chamber` $\rightarrow$ `Rack` $\rightarrow$ `Bin`
* **Topology B:** `Unit` $\rightarrow$ `Chamber` $\rightarrow$ `Rack` $\rightarrow$ `Bin`
* **Topology C:** `Chamber` $\rightarrow$ `Floor` $\rightarrow$ `Block` $\rightarrow$ `Rack` $\rightarrow$ `Bin`
* **Topology D:** `Chamber` $\rightarrow$ `Floor` $\rightarrow$ `Block` $\rightarrow$ `Bin`
* **Topology E:** `Location` (Single Level flat storage)

**Data Structure:** Adjacency List with Materialized Path:
* `location_id` (PK via sequence)
* `warehouse_id` (FK)
* `parent_location_id` (Self-referencing FK, nullable for root nodes)
* `level_depth` (1 = Root, 2 = Child, etc.)
* `level_name` (e.g., "Chamber A", "Floor 2", "Block D", "Rack 14", "Bin 08")
* `path_string` (e.g., `/1/4/19/82/`) for lightning-fast sub-tree queries.
* `location_type_id` (FK to Location Type Master).

### 6.3 Location Type Master
* Defines the functional quarantine and staging nature of physical locations.
* Standard Types: `General Stock`, `Incoming QC`, `Quarantine`, `Damaged / Rejected`, `WIP Staging`, `Finished Goods Staging`, `Job-Work Transit`, `Scrap Yard`.
* **Dynamic Mapping:** Any node in the tree (whether a Block, a Rack, or a specific Bin) can be tagged with a `location_type_id`.
* **Inventory Constraint:** Stock moved to a location typed as `Incoming QC` or `Quarantine` or `Damaged` is automatically marked as **Non-Allocatable** for production issues or sales dispatches.

---

## 7. Product Catalog, Dynamic Units & Tracking Flags

### 7.1 Unified Item Master
* `item_id`, `item_code`, `item_name`, `description`, `item_group_id`, `item_category_id`.
* Item Classification: `RAW_MATERIAL`, `COMPONENT`, `CONSUMABLE`, `SEMI_FINISHED_GOOD` (WIP), `FINISHED_GOOD`, `PACKING_MATERIAL`, `SCRAP`, `SERVICE`.
* Primary / Base Unit of Measurement (`base_uom_id`): Required for base inventory valuation and the single ledger balance of truth.
* Tax Details: HSN/SAC Code, GST Rate %, Purchase Tax Category, Sales Tax Category.
* Thresholds: Minimum Reorder Level, Maximum Level, Safety Stock, Lead Time (Days).

### 7.2 Multi-Unit & Dynamic Conversion System
* **Feature Gate:** Unit conversion fields in Item Master and Transactions are enabled **only if** `ENABLE_DUAL_UNIT` configuration parameter is ON.
* **Secondary Units Definition (Item Unit Mapping Table):**
  * An item can have multiple alternate units (e.g., Base: `Kg`; Secondary 1: `Bag` (25 Kg); Secondary 2: `Ton` (1000 Kg); Secondary 3: `Drum` (200 Kg)).
  * Master defines standard conversion: $\text{1 Secondary Unit} = X \times \text{Base Unit}$.
* **Dynamic Transaction-Time Overrides:**
  * Raw materials can be ordered in `Bags`, received in `Tons`, issued to shop-floor in `Kgs`.
  * Finished goods can be manufactured in `Meters`, packed in `Rolls`, and invoiced in `Boxes`.
  * During voucher entry, the operator selects the transaction unit (`trans_uom_id`) and quantity (`trans_qty`).
  * The system pre-fills the standard `conversion_factor`, but allows manual override if dynamic packaging yields weight variations (e.g., 1 Box of metal castings weighs 48.2 Kg instead of standard 50.0 Kg).
  * The ledger persistently logs both `(trans_qty, trans_uom_id)` and calculated `(base_qty, base_uom_id)`.

### 7.3 Conditional Tracking Flags (Batch & Serial)
* **Batch Tracking:**
  * Visible and toggleable on Item Master **only if** `ENABLE_BATCH_TRACKING` config is ON.
  * When enabled on an item, every inward receipt (GRN, Production Receipt) mandates Batch Number, Manufacturing Date, and Expiry Date. Every outward issue mandates selecting an existing batch (with FIFO/FEFO recommendations).
* **Serial Number Tracking:**
  * Visible and toggleable on Item Master **only if** `ENABLE_SERIAL_TRACKING` config is ON.
  * When enabled on an item, each discrete piece has a unique serial number string.
  * Inward transactions record individual serial numbers (or ranges); outward transactions scan or select specific serials.
* **Barcode / QR Tagging:**
  * Enabled **only if** `ENABLE_BARCODE_SCANNING` config is ON.
  * Auto-generates or parses GS1 / 2D DataMatrix containing `[ITEM_CODE]-[BATCH]-[SERIAL]`.

---

## 8. Party Master & Multi-Tier Pricing

### 8.1 Unified Party Master
To eliminate duplicate customer and vendor ledgers, all external trading entities reside in a single `party_master` table:
* `party_id`, `party_code`, `legal_name`, `trade_name`, `party_group_id`.
* Role Flags:
  * `is_customer`: Eligible for Sales Orders, Quotations, and Tax Invoices.
  * `is_supplier`: Eligible for Purchase Orders, Inward GRNs, and Vendor Bills.
  * `is_job_worker`: Eligible for Subcontracting Delivery Challans and Job-Work Receipts.
  * `is_transporter`: Eligible for Logistics, E-Way Bill transporter tagging.
* Compliance & Banking: GSTIN, PAN, MSME Registration, Bank Name, Account Number, IFSC, Credit Period (Days), Credit Limit amount.
* Multiple Addresses: Billing Address, Shipping Addresses (Branch/Plant locations), Dispatch Ports.

### 8.2 Standard & Customer-Specific Pricing Lists
* **Standard Price List:** Default Selling Price (Base Rate) per item.
* **Tiered Price List Engine:**
  * Price List Header: `pricelist_id`, `pricelist_name`, `valid_from`, `valid_to`, `currency_id`.
  * Price List Scope:
    * Global Default
    * Region / Territory Specific (e.g., North Zone, Export)
    * Customer Group Specific (e.g., Distributors, Wholesalers, OEM)
    * Customer Specific (Direct binding to `party_id`).
* **Pricing Rule Hierarchy on Sales Transactions:**
  1. Customer-Specific Price List (if active)
  2. Customer-Group Specific Price List
  3. Regional Price List
  4. Standard Global Sales Price List
  5. Master Base Price Fallback

---

## 9. Transaction Engine & Voucher Numbering Architecture

### 9.1 Voucher Type Master (Integer Enums)
Every transactional voucher in the system is categorized by a strict integer code:

| Voucher Type ID | Voucher Name | Abbreviation | Typical Inventory Effect |
| :--- | :--- | :--- | :--- |
| **1** | Purchase Order | `PO` | None (Commitment only) |
| **2** | Purchase Goods Receipt Note | `GRN` | Inward (+) to QC/Warehouse |
| **3** | Purchase Invoice / Bill | `PI` | Financial Liability Booking |
| **4** | Sales Quotation / Estimation | `SQ` | None |
| **5** | Sales Order | `SO` | Inventory Allocation / Reservation |
| **6** | Delivery Challan / Dispatch Note | `DC` | Outward (-) from Finished Goods |
| **7** | Sales Tax Invoice | `SI` | Outward (-) (if direct) & Accounts Receivable |
| **11** | Branch Stock Transfer Issue | `BTI` | Outward (-) from Origin Branch |
| **12** | Branch Stock Transfer Receipt | `BTR` | Inward (+) into Destination Branch |
| **13** | Warehouse Bin-to-Bin Transfer | `WBT` | Relocation between Bins within Branch |
| **21** | Job-Work Material Issue (Vendor) | `JWI` | Outward (-) to Vendor Job-Work Location |
| **22** | Job-Work Material Receipt | `JWR` | Inward (+) from Vendor with Scrap / Wastage |
| **31** | Bill of Materials / Recipe | `BOM` | Master Template |
| **32** | Production Work Order | `PWO` | Planned Requirement |
| **33** | Material Issue to Shopfloor | `MIS` | Outward (-) RM $\rightarrow$ Inward (+) WIP |
| **34** | Production FG Receipt Note | `PRN` | Outward (-) WIP $\rightarrow$ Inward (+) FG Stock |
| **41** | Physical Stock Adjustment / Audit | `STK_ADJ` | Balance Reconcile (+/-) |
| **42** | Stock Scrapping Note | `SCRAP` | Outward (-) to Scrap Yard |

### 9.2 Transaction Header Standard Schema
Every voucher header table (e.g., `trn_purchase_order_hdr`, `trn_grn_hdr`, `trn_sales_invoice_hdr`) must strictly contain:
* `voucher_id` (Primary Key from sequence)
* `voucher_type_id` (Integer from table above)
* `voucher_no` (`VARCHAR(50)`, strictly formatted sequence string)
* `voucher_date` (`DATE`)
* `comp_id` (Integer FK)
* `branch_id` (Integer FK)
* `fyear_id` (Integer FK)
* `party_id` (Integer FK, if applicable)
* `status` (`DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `PARTIALLY_EXECUTED`, `COMPLETED`, `CANCELLED`)
* Standard Audit Columns: `created_by`, `created_date`, `updated_by`, `updated_date`.

### 9.3 Branch & Financial-Year-Wise Sequence Generation
* The sequence generation algorithm generates consecutive numbers partitioned by `(comp_id, branch_id, fyear_id, voucher_type_id)`.
* Employs PostgreSQL row-level locking (`SELECT ... FOR UPDATE` on a dedicated `voucher_sequence_tracker` table) to guarantee zero gaps and zero collisions in concurrent high-throughput environments.
* Screen provided to:
  * Manually define sequence prefixes (e.g., `PO/MUM/26-27/`).
  * Set current seed index (e.g., start at 1001).
  * Zero out / reset sequence upon commencing a new financial year.

---

## 10. Manufacturing, Job-Work & Production Workflow

```
[Raw Material Purchase] 
       │
       ▼
 [Inward GRN / QC Inspection] 
       │
       ▼
[Dynamic Multi-Level Warehouse Bins]
       │
       ├───► [Issue to Shop-Floor Work Center] ──► [Multi-Stage Production Processes] ──► [Finished Goods QC & Receipt]
       │                                                                                             ▲
       └───► [Job-Work Issue to 3rd Party Vendor] ──► [Vendor Processing] ──► [Job-Work Receipt] ────┘
```

### 10.1 Bill of Materials (BOM) & Routing Master
* **BOM Header:** Finished Good `item_id`, Version No., Quantity to Produce, Base UOM, Scrap Allowance %, Active Flag.
* **BOM Input Items (Components/Raw Materials):** Component `item_id`, Consumption Qty, UOM, Wastage %, By-Product Flag.
* **Routing / Work Centers / Operations:** Operation Sequence (10, 20, 30), Operation Name (Cutting, CNC Machining, Heat Treatment, Powder Coating), Work Center ID, Setup Time, Run Time per Unit.

### 10.2 Production Work Order & Material Issue
* Production Planning initiates Work Orders based on Sales Orders or Stock Min-Max triggers.
* Material Issue Vouchers pick Raw Materials from designated warehouse bins and transfer them into the designated **WIP Floor Location**.
* Tracks dual units, batches, and specific serial numbers issued into the production lot.

### 10.3 Third-Party Subcontracting / Job-Work Lifecycle
1. **Job-Work Delivery Challan (Type 21):**
   * Ships raw materials or semi-finished items to a 3rd party vendor (`Party Master` with `is_job_worker = true`).
   * Deducts inventory from the physical factory and credits a logical **Job-Worker Stock Account**.
   * Tracks statutory job-work challan reference and expected return turnaround time.
2. **Job-Work Receipt Note (Type 22):**
   * Records receipt of processed parts back from the vendor.
   * Consumes the issued raw material based on agreed consumption ratios.
   * Records process scrap / unconsumed material returned or retained by vendor.
   * Generates liability for vendor process service charges (Job Charges per unit).

### 10.4 Production Entry & Finished Goods Receipt Note (Type 34)
* Records final completion of finished items.
* Automatically relieves WIP stock balance.
* Generates Batch Number / Serial Numbers for the newly minted Finished Goods.
* Places Finished Goods into destination warehouse bins (e.g., `Warehouse A` $\rightarrow$ `Chamber 1` $\rightarrow$ `Rack 4` $\rightarrow$ `Bin 12`).

---

## 11. Non-Functional & Security Requirements

1. **Authentication & Identity:**
   * Short-lived Access Tokens (JWT, 15 min expiry) + Sliding Refresh Tokens (7 days, stored in secure, `httpOnly`, `SameSite=Strict` cookies).
   * Cryptographic password hashing using `Argon2id` or `bcrypt` (12 rounds).
   * Redis-backed token revocation blocklist for instantaneous logout and session revocation.
2. **Data Isolation & Tenant Security:**
   * Strict application-level and database-level tenancy filtering. Every query must enforce `comp_id` and `branch_id` where applicable.
3. **Database Performance:**
   * Compound B-Tree indexes on `(comp_id, branch_id, fyear_id, voucher_type_id)`.
   * Covering indexes on inventory balance ledgers `(item_id, warehouse_id, location_id, batch_no)`.
4. **Auditability:**
   * Immutable audit logging of all transactional mutations, approvals, and manual sequence resets.
   * Standard audit fields (`created_by`, `created_date`, `updated_by`, `updated_date`) on every single database table without exception.

---

## 12. Universal Activity Trail & Field-Level Change Tracking

### 12.1 Comprehensive Activity Logging
* The system shall automatically capture every operational event across all screens and tables:
  * **Master Operations:** Record creation (ADD), updates (EDIT), and attempted or successful removals (DELETE).
  * **Transaction Operations:** Draft saves, final submissions, cancellations, voiding, and approvals.
  * **Action Button Operations:** Any execution of button actions (`PRINT`, `EXPORT`, `AUTHORIZE`, `CANCEL`, `REOPEN`).
* Each log entry captures:
  * `comp_id`, `branch_id`, `user_id`, `session_id`, `ip_address`, `user_agent`.
  * `screen_code` and `action_type`.
  * Target table name and primary key record ID.

### 12.2 Field-Level Delta Tracking on Record Edits
* When a record is edited (whether a master entity or a transaction header/line item):
  * The system must determine the precise diff between pre-update and post-update state.
  * Captures `field_name`, `old_value`, and `new_value` in JSONB format within `tbl_sys_audit_log`.
  * Enables plant managers and compliance auditors to inspect exactly what changed, by whom, and at what timestamp.

---

## 13. Mandatory Pre-Deletion Referential Dependency Checking

### 13.1 Strict Deletion Safeguard
* To maintain database integrity and prevent broken operational histories, **blind deletes are strictly prohibited**.
* Before deleting any master record (e.g., Item, UOM, Department, Employee, Party, Warehouse, Location) or transactional voucher:
  1. The system executes a comprehensive dependency check querying all foreign key relationships and operational usages.
  2. If the record is referenced in any transaction, active inventory balance, BOM recipe, or child hierarchy node, the deletion operation **must be aborted**.
  3. The API and UI must present a descriptive feedback message detailing the conflict:
     * *Example:* "Cannot delete Item 'Cold Rolled Steel Coil (CR-01)' because it is referenced in 6 Purchase Orders, 2 Goods Receipt Notes, and 1 active BOM."

---

## 14. UI Theme Engine (Light & Dark) & User Profile Personalization

### 14.1 Dual Theme Support (Light & Dark)
* The web portal must provide native support for both **Light Mode** and **Dark Mode**.
* Dark mode must provide low-glare high-contrast readability suitable for factory floor terminals and nighttime dispatch operations.
* Zero page reload during theme transitions.

### 14.2 Theme Color & User Profile Personalization
* The application interface must be dynamically styled based on a configurable **Theme Color** palette (e.g., Zinc, Blue, Indigo, Emerald, Amber, Rose, Violet).
* **User Profile Provision:**
  * In the **User Profile / Settings Screen**, each user can personalize:
    1. **Theme Mode:** `Light`, `Dark`, or `System Default`.
    2. **Theme Color:** Selection of primary accent color for buttons, active navigation pills, badges, and focus rings.
  * The user's choices are persisted in `tbl_sec_user_preference` in the database, synchronized across logins, and applied dynamically on client startup.

