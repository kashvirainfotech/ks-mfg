# Project Implementation & Architecture Master Plan (KS-MFG)

**Document Version:** 1.0.0  
**Target Milestone:** Production-Ready Enterprise Manufacturing Web ERP (Phase 1)  

---

## 1. Project Phasing & Milestone Roadmap

```
[Phase 1: Foundation & DB Pipeline]
        │
        ▼
[Phase 2: Org, Auth & Granular RBAC]
        │
        ▼
[Phase 3: Dynamic Config & Multi-Level Warehouses]
        │
        ▼
[Phase 4: Items, Dynamic Units & Unified Parties]
        │
        ▼
[Phase 5: Voucher Engine & Sequence Reset Utility]
        │
        ▼
[Phase 6: Procurement & Inward Bin Put-Away]
        │
        ▼
[Phase 7: Manufacturing & 3rd-Party Job-Work]
        │
        ▼
[Phase 8: Inventory Ledger, Traceability & Analytics]
        │
        ▼
[Phase 9: Quality Assurance & Mobile API Readiness]
```

---

## 2. Phase-by-Phase Implementation Blueprint

### Phase 1: Database Foundation, Tenancy Core & SQL Pipeline
* **Duration Estimate:** Week 1 - 2
* **Objective:** Establish the manual SQL migration harness, database sequences, multi-tenancy core, and audit infrastructure.
* **Key Deliverables:**
  * Directory layout for `backend/db/scripts/` and verification runner scripts.
  * `001_sequences.sql`: Dedicated sequence creators for all database entities (`seq_comp_id`, `seq_branch_id`, `seq_fyear_id`, `seq_user_id`, etc.).
  * `002_core_tenancy.sql`:
    * Company Master (`tbl_mst_company`).
    * Branch Master (`tbl_mst_branch`).
    * Financial Year Master (`tbl_mst_financial_year`).
    * Branch-Wise Financial Year Status (`tbl_mst_branch_fyear`).
  * Universal audit triggers updating `updated_date` automatically.
  * Base NestJS project setup with Pino Logger, Drizzle ORM configured in manual query mode (auto-sync disabled), Redis connection, and standard response envelopes.
  * Base Vite + React 19 + TypeScript + Tailwind CSS + Shadcn UI dashboard shell.

---

### Phase 2: Organization Hierarchy, Users, Roles & Granular RBAC
* **Duration Estimate:** Week 3 - 4
* **Objective:** Deliver human resource master entities, dual-persona user creation, multi-branch role mapping, and action-item permission gates.
* **Key Deliverables:**
  * `003_org_and_users.sql` & `004_permissions.sql`.
  * **Masters:** Department Master, Designation Master, Employee Master.
  * **User Management:**
    * Create user UI with dynamic radio button: `EMPLOYEE` vs `CUSTOMER`.
    * If `EMPLOYEE`: dynamic lookup linking to `tbl_mst_employee`.
    * If `CUSTOMER`: dynamic lookup linking to `tbl_mst_party`.
  * **Multi-Branch Multi-Role Assignment:**
    * Matrix table `tbl_sec_user_branch_role` allowing User X to have Role A in Branch 1 and Role B in Branch 2.
    * Branch switching backend endpoint and frontend switcher component.
  * **Screen & Action Item Engine:**
    * Screen registry and Action Item master (`PRINT`, `EXPORT`, `AUTHORIZE`, `CANCEL`, `REOPEN`).
    * NestJS `PermissionsGuard` and React `<PermissionGate>` component.

---

### Phase 3: Dynamic Hierarchical Configuration & Dynamic Warehouse Locations
* **Duration Estimate:** Week 5 - 6
* **Objective:** Build the parameter cascading engine and dynamic multi-depth warehouse location tree.
* **Key Deliverables:**
  * `005_config_parameters.sql` & `006_dynamic_warehouses.sql`.
  * **Dynamic Configuration Engine:**
    * Hierarchy resolution logic: User $\rightarrow$ Branch $\rightarrow$ Company $\rightarrow$ System Default.
    * Configuration administration UI with category grouping and override matrix.
    * Redis caching for sub-millisecond parameter resolution.
  * **Dynamic Warehouse Hierarchy:**
    * Warehouse Master per branch.
    * Recursive tree data structure (Adjacency list with materialized path) supporting any topology:
      * Chamber $\rightarrow$ Rack $\rightarrow$ Bin
      * Unit $\rightarrow$ Chamber $\rightarrow$ Rack $\rightarrow$ Bin
      * Floor $\rightarrow$ Block $\rightarrow$ Bin
      * Flat Location
    * Location Type Master (`General`, `QC`, `Quarantine`, `Damaged`, `WIP`, `Scrap`).
    * Location mapping UI: ability to tag any node (Chamber, Rack, or Bin) to a specific Location Type.

---

### Phase 4: Product Catalog, Dynamic Multi-Units & Unified Party Master
* **Duration Estimate:** Week 7 - 8
* **Objective:** Implement items with dynamic conversion factors, conditional tracking flags, unified party master, and tiered pricing.
* **Key Deliverables:**
  * `007_items_and_units.sql` & `008_parties_and_pricing.sql`.
  * **Item Master:**
    * Primary Base UOM for stock valuation.
    * Secondary UOM mapping with base conversion factors.
    * Feature gates: Dual unit, Batch tracking, Serial tracking, and Barcode flags toggleable **only if** parent feature configurations are active.
  * **Party Master:**
    * Common table for Customers, Suppliers, Job-Workers, Transporters with boolean flags (`is_customer`, `is_supplier`, `is_job_worker`, `is_transporter`).
    * Multiple billing and shipping addresses, tax identifiers.
  * **Tiered Price List Engine:**
    * Standard sales price list.
    * Region-specific, customer-group-specific, and customer-specific price list rules.

---

### Phase 5: Transaction & Voucher Engine + Sequence Reset Utility
* **Duration Estimate:** Week 9 - 10
* **Objective:** Establish the unified transaction framework, voucher integer codes, sequence generators, and sequence reset UI.
* **Key Deliverables:**
  * `009_voucher_framework.sql`.
  * **Voucher Type Master:** Integer codes (PO = 1, GRN = 2, PI = 3, SO = 5, DC = 6, SI = 7, BTI = 11, BTR = 12, JWI = 21, JWR = 22, BOM = 31, PWO = 32, MIS = 33, PRN = 34).
  * **Concurrent Sequence Number Engine:**
    * Atomic sequence generation using PostgreSQL `SELECT ... FOR UPDATE` on `tbl_trn_voucher_sequence_tracker`.
    * Supports custom patterns: `[PREFIX]/[BRANCH]/[FYEAR]/[SEQ]`.
  * **Voucher Sequence Reset Screen:**
    * Administrative UI to view, edit, repair, and reset sequences branch-wise and financial-year-wise.
    * Reset confirmation modal with audit logging.

---

### Phase 6: Procurement Lifecycle & Multi-Level Put-Away
* **Duration Estimate:** Week 11 - 12
* **Objective:** Complete end-to-end purchasing from Purchase Order to Inward GRN and Purchase Bill.
* **Key Deliverables:**
  * `010_procurement_transactions.sql`.
  * **Purchase Order (Voucher 1):** Multi-line item entry, dynamic unit selection, delivery schedules.
  * **Goods Receipt Note (Voucher 2):**
    * Multi-unit conversion at receiving time.
    * Batch details (Mfg/Exp date) and Serial Number entry for tagged items.
    * Warehouse bin put-away selector into dynamic location tree.
    * Auto-quarantine routing if location is tagged with QC type.
  * **Purchase Invoice (Voucher 3):** 3-way matching (PO $\rightarrow$ GRN $\rightarrow$ Invoice), landed cost allocations.

---

### Phase 7: Manufacturing Lifecycle & 3rd-Party Subcontracting (Job-Work)
* **Duration Estimate:** Week 13 - 15
* **Objective:** Build production recipes, shop-floor work orders, process tracking, and vendor job-work execution.
* **Key Deliverables:**
  * `011_manufacturing_tables.sql` & `012_subcontracting_tables.sql`.
  * **BOM & Routing:** Multi-level Bill of Materials with scrap allowances and machine operations.
  * **Production Work Order & Material Issue (Voucher 32 & 33):**
    * Reservation and picking from warehouse bins to WIP floor location.
    * Tracking of batch/serial numbers issued into production.
  * **Job-Work Delivery Challan (Voucher 21):**
    * Dispatch raw materials / semi-finished goods to 3rd party vendor.
    * E-Way bill tagging, return turnaround tracking.
  * **Job-Work Receipt Note (Voucher 22):**
    * Record receipt of processed goods, scrap return, and vendor service cost liabilities.
  * **Finished Goods Receipt Note (Voucher 34):**
    * Record finished items output, scrap generation, and put-away into Finished Goods warehouse bins.

---

### Phase 8: Inventory Ledger, Valuation & Traceability Analytics
* **Duration Estimate:** Week 16 - 17
* **Objective:** Immutable inventory ledger, FIFO stock valuation, batch/serial genealogy, and reporting.
* **Key Deliverables:**
  * `013_inventory_ledger.sql` & `014_indexes_and_triggers.sql`.
  * Real-time stock ledger (`tbl_inv_stock_ledger`) tracking both transaction units and primary base units.
  * End-to-end Batch and Serial number traceability explorer: Raw Material Vendor $\rightarrow$ GRN $\rightarrow$ Shopfloor Issue $\rightarrow$ Finished Good Batch $\rightarrow$ Customer Invoice.
  * Stock aging, reorder level alerts, and physical stock reconciliation.

---

### Phase 9: Quality Assurance, Security Audits & Mobile API Verification
* **Duration Estimate:** Week 18
* **Objective:** End-to-end stress testing, concurrency verification of sequences, automated test suites, and OpenAPI contract validation for mobile clients.
* **Key Deliverables:**
  * Concurrency load tests simulating 100 simultaneous voucher generations.
  * Manual SQL migration script verification on fresh PostgreSQL instances.
  * OpenAPI 3.1 Swagger verification for mobile SDK generation.
  * Production deployment runbooks.

---

## 3. Risk Management & Technical Mitigation Strategy

| Risk Category | Identified Risk | Impact | Architectural Mitigation |
| :--- | :--- | :--- | :--- |
| **Data Integrity** | Concurrency race condition during voucher number generation | High | Row-level locking (`FOR UPDATE`) on isolated `tbl_trn_voucher_sequence_tracker` rows per `(comp_id, branch_id, fyear_id, voucher_type_id)`. |
| **Inventory Divergence** | Dynamic unit rounding discrepancy | High | Single Base Unit rule: All ledger accounting balances and inventory valuation strictly convert and settle in the Item's Primary Base Unit using 6-decimal floating/numeric precision. |
| **Performance** | Deep recursive queries on dynamic warehouse tree | Medium | Materialized Path string indexing (`path_string` e.g., `/1/4/19/`) combined with Postgres B-Tree indexing enables $O(1)$ sub-tree lookups without recursive CTE overhead. |
| **Governance** | Accidental schema drift across environments | High | Strict manual execution rule. Automated ORM migrations disabled in production and development containers; all changes documented in versioned SQL scripts. |
