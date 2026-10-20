<div align="center">

# 🏭 KS-MFG (Kashvira Infotech - Manufacturing, Supply Chain & Inventory Execution ERP)

### *Enterprise Discrete & Process Manufacturing, Multi-Plant Inventory, and Supply Chain ERP*

[![Status: Beta](https://img.shields.io/badge/Status-Beta%20Version-orange.svg)](https://github.com/kashvirainfotech/ks-mfg)
[![License: Source Available / Non-Commercial](https://img.shields.io/badge/License-Source_Available_%7C_Non--Commercial-blue.svg)](#-license--terms-of-use)
[![Backend: NestJS](https://img.shields.io/badge/Backend-NestJS%2011-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Frontend: React + Vite](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite%208-61DAFB?logo=react&logoColor=black)](https://vitejs.dev/)
[![Database: PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2015+-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![ORM: Drizzle + pg.Pool](https://img.shields.io/badge/Data_Layer-Drizzle%20ORM%20%2B%20pg.Pool-C5F74F?logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![Cache: Redis](https://img.shields.io/badge/Cache-Redis%207+-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Tailwind CSS: v4](https://img.shields.io/badge/Styling-Tailwind%20CSS%20v4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

---

**KS-MFG** is a centralized, self-hosted Enterprise Manufacturing, Supply Chain, and Inventory Execution ERP platform engineered for **discrete and process manufacturing enterprises** operating across **multiple companies, plants, branches, and warehouses**. Built with a **100% API-first backend**, it powers both the responsive Web ERP workspace and future Android/iOS shopfloor mobile apps without backend rework.

</div>

---

> [!IMPORTANT]
> ### ⚠️ Beta Version Notice — Database Installation & Upgrade Policy
>
> **KS-MFG is currently in Beta version (active phased development).**
> - **Blank Database / Fresh Install Only**: All database scripts located in [`dbscripts/`](dbscripts/) are strictly intended for a **blank database / fresh installation** and **not for upgrade purposes**. During this phase, database schemas are maintained directly in their canonical `CREATE` definitions (`01_schema_objects.sql`), system seeds (`02_initial_data.sql`), and demo data (`03_sample_demo_data.sql`) without intermediate `ALTER` migration history.
> - **Future Upgrades & Migration Scripts**: Once we complete development of all planned phases and thorough shopfloor testing, we will establish a stable baseline. From that point onward, all future changes, feature additions, and bug fixes will be provided with formal **upgrade and migration scripts** to preserve existing database installations.

---

## 📑 Table of Contents

- [⚠️ Beta Version & Database Notice](#️-beta-version-notice--database-installation--upgrade-policy)
- [Architectural Overview](#-architectural-overview)
- [What KS-MFG Does](#-what-ks-mfg-does)
- [Completed Features & Functional Modules](#-completed-features--functional-modules)
- [Planned Roadmap & Phased Scope](#-planned-roadmap--phased-scope)
- [Core Documentation Index](#-core-documentation-index)
- [Technology Stack](#-technology-stack)
- [Directory Structure](#-directory-structure)
- [Quick Start & Installation Guide](#-quick-start--installation-guide)
  - [Prerequisites](#prerequisites)
  - [Step 1: Database Setup (Static SQL Scripts)](#step-1-database-setup-static-sql-scripts)
  - [Step 2: Backend REST API Setup (`backend/`)](#step-2-backend-rest-api-setup-backend)
  - [Step 3: Web ERP Frontend Setup (`frontend/`)](#step-3-web-erp-frontend-setup-frontend)
  - [Windows 1-Click Start & Stop Scripts](#windows-1-click-start--stop-scripts)
- [Default Super Admin Credentials](#-default-super-admin-credentials)
- [Community, Feedback & Support](#-community-feedback--support)
- [License & Terms of Use (Non-Commercial)](#-license--terms-of-use)
- [About Kashvira Infotech & Project Policy](#about-kashvira-infotech--project-policy)
  - [Professional Services & Implementation](#-professional-services--implementation)

---

## 🏛 Architectural Overview

```
                               +-------------------------------+
                               |    Plant Operators & Users    |
                               +---------------+---------------+
                                               |
                     +-------------------------+-------------------------+
                     |                                                   |
         [Modern Web ERP Workspace]                        [Future Shopfloor Mobile App]
      (React 19 + Vite 8 + Tailwind v4)                     (Android & iOS REST Client)
                     |                                                   |
                     +-------------------------+-------------------------+
                                               | HTTPS / REST API (/api/v1/*)
                                               | + X-Correlation-Id Header
                                               v
                               +-------------------------------+
                               |      NestJS 11 Backend API    |
                               |  - JwtAuthGuard & RBAC Guard  |
                               |  - AuditLogService (JSONB)    |
                               |  - DependencyCheckService     |
                               +---+---------------+-------+---+
                                   |               |       |
                  +----------------+               |       +----------------+
                  |                                |                        |
                  v                                v                        v
      +-----------------------+        +-----------------------+   +-------------------+
      | PostgreSQL 15+ (DB)   |        | Redis 7+ Cache        |   | PL/pgSQL Triggers |
      | - Multi-Company / FY  |        | - Session & RBAC      |   | - Auto Timestamps |
      | - Multi-Plant Ledger  |        |   Permission Cache    |   | - Stock & Ledger  |
      | - JSONB Delta Audits  |        |   (Graceful Fallback) |   |   Invariants      |
      +-----------------------+        +-----------------------+   +-------------------+
```

---

## 💡 What KS-MFG Does

Most mid-market manufacturing companies outgrow basic accounting software (which lacks multi-level BOMs, shopfloor routings, QC hold/release, and bin-level lot traceability) but face prohibitive licensing costs and rigid workflows in legacy tier-1 ERPs. **KS-MFG bridges that gap**:

1. **Multi-Company, Multi-Plant & Financial Year Isolation**: Every master and transaction record carries mandatory tenant and audit context (`comp_id`, `branch_id`, `fyear_id`, `created_by`, `created_date`, `updated_by`, `updated_date`). Supports company-wide financial year closing and **branch-specific period locking** (`tbl_org_branch_fyear`) for independent plant stock audits.
2. **Global Roles with Multi-Company & Multi-Branch User Assignment**: Roles (`tbl_sec_role`) and their screen/action permission matrices (`VIEW`, `ADD`, `EDIT`, `DELETE`, `PRINT`, `EXPORT`, `AUTHORIZE`, etc.) are defined globally once, while users can be assigned **different roles in different companies and plants** (`tbl_sec_user_company_role` and `tbl_sec_user_branch_role`).
3. **Pre-Delete Dependency Verification & Immutable Field-Delta Auditing**: Every delete request is inspected by `DependencyCheckService` across all child/referencing tables (returning a structured `409 Conflict` breakdown if linked records exist), and every `ADD`, `EDIT`, `DELETE`, `PRINT`, and `EXPORT` action records JSONB `old_value` / `new_value` field deltas in `tbl_sys_audit_log`.
4. **Discrete & Process Manufacturing Ready**: Designed for multi-level Bills of Material (BOM), co-products/by-products, shopfloor work orders, stage-wise QC inspections, subcontractor job-work challans, and FIFO/FEFO batch/serial inventory valuation.

---

## ✅ Completed Features & Functional Modules

### 🏗️ Phase 0: Core Database Foundation, Security Kernel & AppShell
- **Static PostgreSQL Schema & Seed Architecture**: Standardized `tbl_` / `vw_` / `fn_` / `trg_` / `idx_` naming conventions with `BIGINT` sequence primary keys and 7 mandatory audit/tenant columns across all tables.
- **NestJS 11 Security & Audit Kernel**: Global `JwtAuthGuard`, `PermissionsGuard` (`@RequirePermission(screenCode, actionCode)`), `CorrelationIdMiddleware`, `ResponseEnvelopeInterceptor`, `AllExceptionsFilter`, `AuditLogService`, and `DependencyCheckService`.
- **Dynamic Theme Engine & Enterprise AppShell**: Light/Dark/System mode with 6 brand accent palettes (`Indigo`, `Blue`, `Emerald`, `Violet`, `Amber`, `Rose`) persisted per user in `tbl_sec_user_preference`, plus live Company / Branch / Financial Year context switcher.
- **Reusable Master Data Engine**: `<MasterDataTable>` (multi-column search, client-side grouping, sorting, pagination, CSV export, print view), `<ConfirmDeleteModal>` (structured dependency conflict breakdown), and `<PermissionGate>`.

### 🏢 Phase 1: Organization & Multi-Tenant Hierarchy (`ORGANIZATION`)
- **Step 1.1 — Company Master (`/org/companies`)**: Full CRUD on `tbl_org_company` with Indian GSTIN (15-character state code auto-derivation), PAN, CIN, base currency, and pre-delete dependency verification across branches, financial years, and user role mappings.
- **Step 1.2 — Branch & Plant Master (`/org/branches`)**: Full CRUD on `tbl_org_branch` supporting `PLANT`, `HO`, `WAREHOUSE`, and `SALES_OFFICE` facility types, state-wise GSTIN validation, Head Office designation, and dependency checks.
- **Step 1.3 — Financial Year Master & Branch-FY Locking (`/org/financial-years`)**: Full CRUD on `tbl_org_financial_year` with automatic `tbl_org_branch_fyear` provisioning for all company branches, Quick FY Generator, Company-Wide Period Closing (`is_closed`), and an interactive **Branch-Wise Period Activation & Locking Modal** (`is_locked`).

### 🛡️ Phase 2: HR Workforce Hierarchy, Global RBAC & Security (`SECURITY`)
- **Step 2.1 — Department & Designation Master (`/hr/departments`)**: Dual-tab management for functional plant departments (`tbl_hr_department` with parent-child hierarchy and cost centers) and job designations (`tbl_hr_designation` with grade bands `E1`–`L5` and hierarchy levels).
- **Step 2.2 — Employee Master Directory (`/hr/employees`)**: 3-tab workforce registry (`tbl_hr_employee`) covering organization/plant/department/designation assignment, self-referencing reporting manager hierarchy (`reporting_manager_id`), emergency contacts, statutory identifiers (PAN, Masked Aadhaar, PF UAN, ESIC), and payroll bank records.
- **Step 2.3 — Global Roles & Granular Screen/Action Permissions Matrix (`/security/roles`)**: Global role catalogue (`tbl_sec_role`) with optional **Baseline Permission Cloning** and an interactive **Screen & Action Permissions Matrix** (`tbl_sec_role_permission` and `tbl_sec_role_action_permission`) with module filtering, bulk presets, and `SUPER_ADMIN` self-lockout protection.
- **Step 2.4 — User Master & Multi-Company / Multi-Branch Role Assignment (`/security/users`)**: ERP user account management (`tbl_sec_user`) with HR Employee linking, 12-round Bcrypt password hashing, atomic multi-company (`tbl_sec_user_company_role`) and multi-branch (`tbl_sec_user_branch_role`) role assignments, administrative password reset, and account lockout unlock.
- **Step 2.5 — Security & Field-Delta Audit Trail Viewer (`/security/audit-logs`)**: Complete immutable audit viewer (`tbl_sys_audit_log`) with side-by-side JSONB `old_value` vs `new_value` field diff inspector, multi-column search, and CSV export.
- **Step 2.6 — System Configuration Matrix & Document Numbering Series Engine (`/admin/configurations`)**: Dual-tab administration engine managing company/plant configuration overrides (`tbl_sys_config`) and multi-plant document numbering series (`tbl_sys_doc_number_series`) with live preview, token generation, and rollover rules.

### 📦 Phase 3: Inventory Foundation & Warehouse Hierarchy (`INVENTORY`)
- **Step 3.1 — Multi-level Warehouse, Zone, Rack, and Bin Master (`/inventory/warehouses`)**: Physical logistics model (`tbl_inv_warehouse` and `tbl_inv_storage_bin`) supporting raw materials, QC quarantine hold bays, WIP lineside kanbans, finished goods, and scrap yards with temperature ranges, storage volume capacities, and bin put-away blocks.
- **Step 3.2 — Unit of Measure (UOM), UOM Conversion Matrix & Item Category Hierarchy (`/inventory/uoms`)**: 3-tab inventory configuration managing standardized industrial UOMs (`tbl_inv_uom`), bidirectional conversion factor ratios (`tbl_inv_uom_conversion`), and recursive item category tree hierarchies (`tbl_inv_item_category`).
- **Step 3.3 — Item & Material Master, Multi-UOM, Pricing, Quality & BOM Parameters (`/inventory/items`)**: Comprehensive 4-tab engineering material master (`tbl_inv_item`) managing standard/purchase/sales rates, multi-UOM mappings (Base, Purchase, Sales), inventory buffer thresholds (ROP, Min, Safety Stock), QC inspection flags, heat/batch/serial tracking, and BOM parent flags.

### 🤝 Phase 4: Unified Party Master & Commercial Terms (`CRM_SRM`)
- **Step 4.1 — Unified Customer, Supplier, Transporter & Job-Worker Master (`/parties/customers` & `/parties/master`)**: Multi-faceted corporate entity directory (`tbl_crm_party`) with 1-to-N multi-plant addresses and state-level GSTINs (`tbl_crm_party_address`), PAN, MSME Udyam classification, credit limit controls, and payment terms.
- **Step 4.2 — Tiered Price Lists, Volume Discounts & Vendor Rate Contracts (`/parties/price-lists`)**: Commercial sales price lists, vendor procurement contracts, and subcontractor machining rate cards (`tbl_crm_price_list`) with multi-tier quantity break discounts (`tbl_crm_price_list_item`), validity dates, default fallback rules, and authorized trading partner assignments (`tbl_crm_party_price_list`).

### 🚚 Phase 5: Procurement & Physical Inward Supply Chain (`PROCUREMENT`)
- **Step 5.1 — Material Purchase Requisition (MR) & Multi-Level Authorization (`/procurement/requisitions`)**: Internal shopfloor & department material indents (`tbl_pr_header` & `tbl_pr_item`) with multi-level approval workflows, item-level quantity adjustment, benchmark rate estimation, and printable requisition vouchers.
- **Step 5.2 — Supplier Request for Quotation (RFQ) & Comparative Statement Matrix (`/procurement/rfqs`)**: Multi-vendor bidding tenders (`tbl_rfq_header`, `tbl_rfq_item`, `tbl_rfq_vendor`, `tbl_rfq_vendor_item`) with 1-click requisition import, supplier bid logging, dynamic Comparative Statement (CS) evaluation matrix with automated L1 bidder detection and price variance benchmarks, and formal contract awarding.
- **Step 5.3 — Purchase Order (PO) Management & Commercial Release Workflow (`/procurement/purchase-orders`)**: Legally binding purchase contracts (`tbl_po_header` & `tbl_po_item`) covering Standard PO, Blanket Agreement, Subcontracting Job-Work, Service PO, and CapEx, real-time GST tax computation, 1-click sourcing import from Awarded RFQs / Approved PRs, commercial sign-off release (`RELEASE`), cancellation workflows, and printable purchase order vouchers.
- **Step 5.4 — Gate Entry & Security Inward Register (`/procurement/gate-inward`)**: Factory perimeter security checkpoints (`tbl_gate_inward_header` & `tbl_gate_inward_item`) tracking incoming supplier transport trucks, delivery challans, Indian GST E-Way Bills, LR consignment notes, weighbridge gross/tare/net weight verification, stores offloading clearance (`UNLOAD`), and security outward departure passes (`EXIT`).
- **Step 5.5 — Goods Receipt Note (GRN) & Quarantine Put-Away (`/procurement/grn`)**: Dock receiving vouchers (`tbl_inv_grn_header` & `tbl_inv_grn_item`) with 1-click Gate Inward / PO sync, shortage/excess variance logging, supplier heat/batch number tracking, quarantine staging cage put-away (`QC_IN_PROGRESS`), store approval (`APPROVED`) with automatic PO received balance increments, and printable official GRN vouchers.
- **Step 5.6 — Inward Material QC Inspection, Heat/Batch Allocation & Quarantine Clearance (`/quality/inward-qc`)**: Full metallurgical and physical laboratory testing (`tbl_qc_inward_inspection_header` & `tbl_qc_inward_inspection_item`) with 1-click Quarantine GRN import, 4-pillar testing checklist (Visual, Dimensional, Chemical/Spectro, Hardness), JSON observed parameters tracking, split accepted vs rejected lot disposition, upstream PO and GRN synchronization on approval, and printable official QC certificates.
- **Step 5.7 — Warehouse Bin Put-Away, Lot Allocation & Stock Ledger Posting (`/inventory/put-away`)**: WMS execution (`tbl_inv_putaway_header` & `tbl_inv_putaway_item`) transferring accepted materials from quarantine staging to permanent storage racks, operator dispatching (`ASSIGN`), and real-time on-hand stock balance updates in `tbl_inv_bin_stock` and immutable transactions in `tbl_inv_stock_ledger`.
- **Step 5.8 — Purchase Invoice 3-Way Matching, GST Input Tax Credit & Accounts Payable Clearance (`/procurement/invoices`)**: Commercial finance 3-way matching engine (`tbl_pur_invoice_header` & `tbl_pur_invoice_item`) comparing PO rates, GRN received quantities, and QC accepted quantities, automated price/quantity variance detection, GST Input Tax Credit (ITC) breakdown, TDS/TCS withholding tax calculations, AP clearance approvals, payment disbursements, and printable commercial vouchers.

### ⚙️ Phase 6: Manufacturing Engineering, MRP, Shopfloor Execution & Job-Work (`MANUFACTURING`)
- **Step 6.1 — Multi-Level Bill of Materials (BOM), Versions, Scrap Factors & Co-Products / By-Products (`/manufacturing/boms`)**: Engineering product recipes and hierarchical assembly structures (`tbl_mfg_bom_header`, `tbl_mfg_bom_item`, `tbl_mfg_bom_byproduct`) with recursive indented tree explosion (`EXPLODE`), automated cycle detection, process scrap factors (`scrap_factor_percent`), co-product and recoverable scrap recovery credits, 1-click version cloning (`CLONE`), engineering approval workflow (`APPROVE`), live absorption cost rollups, and printable costed engineering datasheets (`PRINT`).
- **Step 6.2 — Work Centers, Production Lines, Capacity & Shift Calendars (`/manufacturing/work-centers`)**: Shopfloor workstations, CNC machining cells, assembly lines, and furnaces (`tbl_mfg_work_center`), capital machinery assets (`tbl_mfg_work_center_machine`), factory production shifts (`tbl_mfg_shift`), working shift allocations (`tbl_mfg_work_center_shift`), daily rated capacity & OEE efficiency calculations, machine breakdown and maintenance logging (`MAINTENANCE`), absorption hourly cost matrices (machine + labor + overhead rates), and printable work center capacity sheets (`PRINT`).
- **Step 6.3 — Production Routings, Operation Sequences, Standard Cycle Times & Machine Tooling (`/manufacturing/routings`)**: Chronological multi-stage manufacturing operation sequences (`tbl_mfg_routing_header` & `tbl_mfg_routing_operation`), work center cell assignment, preferred machine tooling and fixture tracking, setup & run cycle times, interactive sequential operation flow timeline visualizer (`VIEW`), engineering approval workflow (`APPROVE`), 1-click revision cloning (`CLONE`), absorption unit costing rollups, and printable ISO/IATF shopfloor route traveler cards (`PRINT`).
- **Step 6.4 — Material Requirements Planning (MRP-I Engine) & Gross-to-Net Planned Orders (`/manufacturing/mrp`)**: Supply chain calculation engine (`tbl_mfg_mrp_run_header` & `tbl_mfg_mrp_planned_order`) computing multi-level gross-to-net material deficits ($\text{Net} = \text{Gross} - \text{On-Hand Stock} - \text{Scheduled PO Receipts} + \text{Safety Buffer}$), recursive BOM scrap factor explosion, action classification (`MAKE` for assembly work orders vs `BUY` for raw materials/consumables vs `SUBCONTRACT`), backward scheduling ($\text{Order Release Date} = \text{Required Date} - \text{Lead Time Days}$) with past-due expedite warnings, 1-click batch conversion into official Purchase Requisitions (`CONVERT`), multi-level indented BOM tree visualization, and printable planning schedules (`PRINT`).
- **Step 6.5 — Production Work Orders (WO), Scheduling, BOM Snapshot & Operation Routing Release (`/manufacturing/work-orders`)**: Discrete manufacturing shopfloor execution engine (`tbl_mfg_wo_header`, `tbl_mfg_wo_bom_item`, `tbl_mfg_wo_routing_op`) featuring frozen bill-of-material component snapshots insulating active production from engineering revisions, sequential routing operation freezing, multi-warehouse segregation (Finished Goods vs WIP Lineside), 1-click conversion from MRP suggested/confirmed `MAKE` planned orders (`CONVERT_TO_WO`), shopfloor release authorization (`RELEASE`), production completion & yield efficiency calculation (`CLOSE`), and printable ISO 9001 / IATF 16949 job card traveler sheets (`PRINT`).
- **Step 6.6 — Shopfloor Material Issue, Lineside Staging & Backflushing (`/manufacturing/material-issues`)**: Production component requisition and staging register (`tbl_mfg_material_issue_header` & `tbl_mfg_material_issue_item`) tracking issue vouchers (`MI-{BRANCH}-{FYEAR}-XXXX`), 1-click "Load from Work Order" pre-populating frozen BOM components with pending balances, automated stock posting (`SUBMIT`) debiting store inventory (`ISSUE_TO_WIP`), incrementing Work Order `issued_qty`, auto-transitioning Work Orders to `IN_PROGRESS`, accumulating actual material cost, shopfloor unconsumed surplus returns (`RETURN`), and printable ISO store requisition vouchers (`PRINT`).
- **Step 6.7 — Stage-Wise Production Job Cards, Operation Time Logging & In-Process QC Inspection (`/manufacturing/job-cards`)**: Shopfloor routing traveler cards and MES execution register (`tbl_mfg_job_card` & `tbl_mfg_job_card_time_log`) tracking travelers (`JC-{BRANCH}-{FYEAR}-XXXX`), 1-click batch generation of sequential operation travelers from active Work Orders, shopfloor clock-in (`START`), granular shift-wise setup/run/downtime booking and output reporting (`LOG_TIME`), mandatory in-process QC inspection clearance (`APPROVE`), automatic sequential stage handover queueing, cumulative operation cost rollup into parent Work Order headers upon completion (`COMPLETE`), and printable ISO 9001 / IATF 16949 job card traveler sheets (`PRINT`).
- **Step 6.8 — Subcontractor Job-Work Outward Delivery Challan, Inward Receipt & Material Reconciliation (`/manufacturing/job-work`)**: Statutory Indian GST Section 143 & Rule 55 delivery challan register (`tbl_mfg_job_work_challan`, `tbl_mfg_job_work_challan_item`, `tbl_mfg_job_work_receipt`, `tbl_mfg_job_work_receipt_item`) tracking outward challans (`JW-OUT-{BRANCH}-{FYEAR}-XXXX`), vendor third-party processing, Work Order and routing step link, outward warehouse inventory issue (`PRODUCTION_ISSUE` in `tbl_inv_stock_ledger`), inward goods receipt (`JW-IN-{BRANCH}-{FYEAR}-XXXX`) with QC disposition, warehouse put-away (`PUTAWAY_INWARD`), processing charges + 18% GST calculation, absorption into Work Order actual machining costs, multi-line material reconciliation ($\text{Sent} = \text{Received} + \text{Scrap} + \text{Loss}$), and printable GST Section 143 delivery challans (`PRINT`).
- **Step 6.9 — Finished Goods (FG) Production Receipt, Scrap/By-Product Accounting & Absorption Cost Rollup (`/manufacturing/fg-receipts`)**: Finished goods receipt register (`tbl_mfg_fg_receipt_header`, `tbl_mfg_fg_receipt_byproduct`) tracking production output vouchers (`FGR-{BRANCH}-{FYEAR}-XXXX`), Work Order linkage, batch/lot and melt heat traceability, output yield efficiency percentage, 1-click "Suggest from BOM" co-product and recoverable scrap recovery crediting, live actual absorption costing rollups ($\text{Net Cost} = \text{Actual Material} + \text{Actual Operation} - \text{Scrap Credit}$), in-process/final QC clearance (`APPROVE`), automated stock ledger posting (`PUTAWAY_INWARD` in `tbl_inv_stock_ledger`), bin inventory put-away (`tbl_inv_bin_stock`), Work Order completion synchronization, and printable ISO 9001:2015 production inward vouchers (`PRINT`).

### 📈 Phase 7: Sales Order, Reservation, Dispatch & Invoicing (`SALES`)
- **Step 7.1 — Customer Inquiry & Quotation / Proforma Invoice (`/sales/quotations`)**: Pre-sales commercial quotations (`tbl_sales_quotation_header` & `tbl_sales_quotation_item`) featuring auto-numbering (`QT-{BRANCH}-{FYEAR}-XXXX`), customer address & GSTIN sync, intra-state vs inter-state tax engine, commercial revision tracking (`Revise`), 1-click conversion to Sales Order (`CONVERT_TO_SO`), and printable statutory Indian GST proforma invoices (`PRINT`).
- **Step 7.2 — Sales Order (SO), Commercial Credit Check & Available-to-Promise (ATP) Stock Reservation (`/sales/orders`)**: Legally binding customer contracts (`tbl_sales_order_header` & `tbl_sales_order_item`) with auto-numbering (`SO-{BRANCH}-{FYEAR}-XXXX`), 1-click quotation import, customer commercial credit check vs master limits (`tbl_crm_party`) with managerial override (`AUTHORIZE`), real-time Available-to-Promise (ATP) FIFO finished goods stock reservation engine against warehouse bins (`tbl_inv_bin_stock`), 1-click production Work Order generation for deficit unreserved quantities (`CREATE_WO`), operational & credit hold management (`HOLD`), and printable ISO/GST sales order acknowledgements (`PRINT`).
- **Step 7.3 — Outward Warehouse Pick/Pack Slip & Dispatch Delivery Challan (`/sales/delivery-challans`)**: Statutory outward dispatch delivery challans and warehouse pick/pack slips (`tbl_sales_delivery_challan_header` & `tbl_sales_delivery_challan_item`) compliant with Rule 55 of CGST Rules, 2017, featuring auto-numbering (`DC-{BRANCH}-{FYEAR}-XXXX`), 1-click import from confirmed Sales Orders (`so_id`), 5-stage warehouse milestone lifecycle (`DRAFT` $\rightarrow$ `PICKED` $\rightarrow$ `PACKED` $\rightarrow$ `DISPATCHED` $\rightarrow$ `DELIVERED`), real-time WMS stock ledger deduction engine (`SALES_DISPATCH` in `tbl_inv_stock_ledger` and on-hand bin reduction in `tbl_inv_bin_stock`), automated Sales Order delivery status updates (`COMPLETED` / `PARTIALLY_DELIVERED`), reversible cancellation engine with automated inventory restitution, and printable statutory GST Rule 55 delivery challans and packing slips (`PRINT`).
- **Step 7.4 — Statutory GST Tax Invoice Generation, E-Invoicing (IRN) & Customer Accounts Receivable (`/sales/invoices`)**: Statutory GST Rule 46 Tax Invoices and Accounts Receivable sub-ledger (`tbl_sales_invoice_header`, `tbl_sales_invoice_item`, `tbl_sales_ar_payment_receipt`) featuring FY-sequenced numbering (`INV-{BRANCH}-{FYEAR}-XXXX`), 1-click loading from dispatched Delivery Challans (`challan_id`) and confirmed Sales Orders (`so_id`), automated intra-state (CGST + SGST) vs inter-state (IGST) tax calculation with TCS and round-off, commercial invoice posting (`POST`) with line locking and Sales Order `invoiced_qty` synchronization, statutory Rule 48(4) E-Invoicing (IRN) engine generating 64-character SHA-256 hash, 16-digit Ack Number, signed QR code payload, and optional E-Way Bill link, Accounts Receivable (AR) payment receipt recording with TDS withholding and real-time balance reduction, and printable statutory Rule 46 GST Tax Invoices (`PRINT`).
- **Step 7.5 — Sales Return (Credit Note) & Inward RMA Quarantine Inspection (`/sales/returns`)**: Customer return and Return Merchandise Authorization (RMA) register (`tbl_sales_return_header` & `tbl_sales_return_item`) compliant with Section 34 of the CGST Act, 2017 & Rule 53 of CGST Rules, 2017, featuring auto-numbering (`SR-{BRANCH}-{FYEAR}-XXXX`), 1-click loading from posted Tax Invoices (`invoice_id`), quarantine QC inspection (`INSPECT`) recording accepted vs scrap quantities with technical defect categorizations, statutory Section 34 Credit Note issuance (`CN-{BRANCH}-{FYEAR}-XXXX`) with commercial credit computation and real-time customer invoice balance reconciliation (`tbl_sales_invoice_header.balance_amount`) via AR adjustment receipts (`CREDIT_ADJUSTMENT`), statutory Rule 48(4) E-Invoicing (IRN) generation with 64-character SHA-256 hash and signed QR code, automated warehouse restocking (`RESTOCK`) putting away accepted units into storage bins (`tbl_inv_bin_stock`) with immutable stock ledger entries (`SALES_RETURN` in `tbl_inv_stock_ledger`), reversible cancellation engine with automatic inventory restitution, and printable statutory GST Rule 53 credit notes (`PRINT`).

### 📊 Phase 8: Inventory Ledger, Valuation & Analytics (`INVENTORY_ANALYTICS`)
- **Step 8.1 — Real-Time Stock Balance, Multi-Bin Inventory Ledger & FIFO Stock Valuation (`/inventory/balance`)**: Multi-bin perpetual inventory register (`tbl_inv_bin_stock`) compliant with Ind AS 2 / AS-2, real-time Available-to-Promise (ATP) stock visibility across plants, warehouses, and storage bins, batch/heat number traceability, safety stock buffer alert engine, chronological double-entry movement ledger drilldown (`tbl_inv_stock_ledger`), periodic revaluation and standard absorption cost realignment (`REVALUE`), and printable official stock valuation certificates (`PRINT`).
- **Step 8.2 — Physical Stock Reconciliation, Periodic Stock Audit & Stock Adjustments / Write-Offs (`/inventory/adjustments`)**: Physical inventory audit and variance reconciliation register (`tbl_inv_adjustment_header` & `tbl_inv_adjustment_item`) compliant with CARO 2020 Clause 3(ii) and Ind AS 2 / AS-2, featuring auto-numbering (`SA-{BRANCH}-{FYEAR}-XXXX`), 1-Click loading of warehouse bin book stock, dynamic real-time variance calculation ($\text{Physical} - \text{Book}$), 2-tier managerial sign-off (`DRAFT` $\rightarrow$ `SUBMITTED` $\rightarrow$ `POSTED`), atomic inventory balance synchronization with double-entry stock ledger postings (`ADJUSTMENT` in `tbl_inv_stock_ledger`), reversible voucher cancellation engine with automated restitution, and printable CARO 2020 physical verification audit certificates (`PRINT`).
- **Step 8.3 — Warehouse Internal Transfers & Inter-Branch Stock Transfers (STO) (`/inventory/transfers`)**: Internal logistics and inter-branch stock transfer register (`tbl_inv_transfer_header` & `tbl_inv_transfer_item`) compliant with Rule 55 of the CGST Rules, 2017 & Section 25 of the CGST Act, 2017, featuring auto-numbering (`ST-` / `STO-`), 3 movement modes (`BIN_TO_BIN`, `INTER_WAREHOUSE`, `INTER_BRANCH_STO`), 1-Click "Available Stock Picker by Warehouse", multi-stage physical dispatch & logistics tracking (`DISPATCH`), destination material receipt (`RECEIVE`), 1-Click atomic bin transfers, reversible cancellation with stock restitution, and printable statutory CGST Rule 55 Delivery Challans (`PRINT`).
- **Step 8.4 — End-to-End Batch & Serial Number 360-Degree Genealogy & Traceability Explorer (`/inventory/traceability`)**: Complete bi-directional 360° genealogy engine (`tbl_inv_batch_master`, `tbl_inv_batch_genealogy`, `tbl_inv_serial_master`) conforming to EN 10204:2004 Type 3.1 & ISO 9001:2015 Clause 8.5.2, featuring universal 360° quick-search with 1-click sample exploration pills, interactive visual Directed Acyclic Graph (DAG) tree, Mill Test Certificate (MTC) quality passport with 8-element chemical composition matrix (% C, Mn, Si, P, S, Cr, Ni, Mo), mechanical tensile & hardness test results, NDE certifications, chronological physical stock movement ledger audit trail, batch & serial master registers, parent-child transformation mapping, and printable statutory EN 10204 Type 3.1 Material Inspection Certificates (`PRINT`).
- **Step 8.5 — Inventory Aging, Dead Stock Analysis & Reorder Level Alert Dashboard (`/inventory/aging`)**: Enterprise inventory velocity and statutory provisioning engine (`tbl_inv_stock_provision_header` & `tbl_inv_stock_provision_item`) conforming to Ind AS 2 / AS-2 & CARO 2020 Clause 3(ii), featuring FIFO aging brackets (0-30, 31-60, 61-90, 91-180, 181-365, >365 Days), Fast/Slow/Non-Moving (FSN) velocity matrix, Net Realisable Value (NRV) write-down provisioning reviews, Reorder Point (ROP) & Safety Stock buffer breach console, 1-Click Purchase Requisition (PR) generation bridge (`PR-AHM-2627-XXXX`), multi-warehouse distribution breakdown, and printable statutory CARO 2020 / Ind AS 2 Inventory Valuation & Provisioning Certificates (`PRINT`).

### 🛡️ Phase 9: Quality Control & Inspection Management (`QUALITY`)
- **Step 9.1 — In-Process & Stage-Wise Quality Inspection (`/quality/in-process-qc`)**: Operational quality gating engine (`tbl_qc_in_process_header` & `tbl_qc_in_process_param`) compliant with ISO 9001:2015 Clause 8.6 & IATF 16949 Section 8.5.1, featuring 4 inspection stage gates (`FIRST_PIECE` setup approval, `PATROL_INSPECTION` periodic checks, `STAGE_COMPLETION` batch clearance, `LAST_PIECE` tool wear verification), characteristic parameter matrix across 6 inspection categories (Dimensional, Surface Ra, Metallurgical Hardness, Visual Flaws, Functional/Hydrostatic Pressure), 5-point observation sampling with live calculated mean and automatic tolerance pass/fail determination, bidirectional synchronization with shopfloor job cards (`tbl_mfg_job_card`), technical concession / engineering deviation clearance (`DEVIATION`), material disposition actions (`DIRECT_ACCEPT`, `SCRAP`, `REWORK_SAME_OP`, `CONCESSION_USE_AS_IS`), CAPA / 8D investigation triggers, and printable statutory ISO/IATF Stage Inspection Certificates (`PRINT`).
- **Step 9.2 — Final Pre-Dispatch Inspection (PDI) & Certificate of Analysis (CoA) (`/quality/pdi`)**: Statutory quality gating & certification engine (`tbl_qc_pdi_header`, `tbl_qc_pdi_param`, `tbl_qc_pdi_coa_spec`) compliant with ISO 9001:2015 Clause 8.6, API Spec Q1 / API 6D, and EN 10204:2004 Type 3.1, featuring 4-tier view tabs (All PDI Lots, Released CoAs, Concessions, Quarantine Holds), comprehensive characteristic parameter matrix across 6 categories (Dimensional, Functional Pressure, Surface Paint DFT, Visual Packaging/Stamping, Electrical Actuator, Metallurgical Hardness), 8-element ladle chemical analysis matrix (% C, Mn, Si, P, S, Cr, Ni, Mo), mechanical tensile and impact toughness properties (Yield, Tensile, Elongation, Hardness, Charpy V-Notch), hydrostatic shell and seat hold pressure test registers, non-destructive examination (NDE) tracking, packaging and anti-rust preservation coating verification, customer / Third-Party Inspection (TPI) witness sign-off, digital CoA release authorization (`RELEASE`), and printable statutory EN 10204 Type 3.1 Inspection Certificates with 3-tier authorized signatures (`PRINT`).
- **Step 9.3 — Non-Conformance Reports (NCR), Material Review Board & CAPA Action Engine (`/quality/ncr`)**: Closed-loop quality deviation management and 8D problem-solving engine (`tbl_qc_ncr_header`, `tbl_qc_ncr_mrb_vote`, `tbl_qc_capa_action`) compliant with ISO 9001:2015 Clause 8.7 & 10.2 and IATF 16949 Section 10.2.3, featuring multi-source NCR initiation (Inward IQC, In-Process IPQC, Final PDI, RMA Sales Returns, Customer Audits, Supplier Defect), 3 severity tiers (Critical, Major, Minor), quarantine containment gating, 5-Why root cause breakdown, cross-functional Material Review Board (MRB) voting matrix (`APPROVE_SCRAP`, `APPROVE_REWORK`, `APPROVE_CONCESSION`, `APPROVE_RTV`), final disposition authorization (`DISPOSITION`) with scrap/rework cost accounting, 8D Problem-Solving discipline tracker (D1 through D8), preventive CAPA assignment with target completion dates, quality effectiveness verification sign-off (`CLOSE_CAPA`), and printable statutory ISO/IATF 8D Non-Conformance Investigation Reports (`PRINT`).
- **Step 9.4 — Gauge, Tool & Measuring Instrument Calibration Register (`/quality/calibration`)**: Metrology asset lifecycle and calibration management subsystem (`tbl_qc_gauge_master` & `tbl_qc_gauge_calibration_history`) compliant with ISO 9001:2015 Clause 7.1.5 & ISO/IEC 17025, featuring comprehensive instrument registry (Vernier Calipers, Micrometers, Dial Indicators, Pressure Gauges, Torque Wrenches, Temperature Controllers, Bore Gauges, Height Gauges, CMMs, Weighing Scales), custodian location tracking, dynamic recalibration scheduler (monthly, quarterly, semi-annual, annual) with automated due-date alerts (`DUE_SOON` < 30 days and `OVERDUE_EXPIRED`), certified calibration event logging (`CALIBRATE`) verifying observed error against permissible limits, ambient temperature/humidity environmental tracking, NABL certificate linking with national primary standard traceability, automated out-of-tolerance and expired instrument lockouts (`LOCKOUT` / `OUT_OF_TOLERANCE_LOCKED`), and printable ISO/IEC 17025 Calibration Certificates and Shopfloor Instrument Sticker Tags (`PRINT`).

---

## 🗺️ Planned Roadmap & Phased Scope

Development proceeds strictly **one screen/feature at a time**, completely implemented end-to-end (PostgreSQL DDL/DML $\rightarrow$ NestJS API $\rightarrow$ React UI $\rightarrow$ Living Manuals):

### 🏁 Milestone Execution Summary

| Phase | Functional Scope | Status | Details |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Core DB Foundation, Security Kernel & AppShell | **100% Complete** | Multi-tenant schema, Drizzle ORM, Redis session cache, Theme engine |
| **Phase 1** | Organization & Multi-Tenant Hierarchy | **100% Complete** | Company, Branch/Plant, Financial Year & Branch-FY Locking |
| **Phase 2** | HR Workforce, Global RBAC & Security | **100% Complete** | Departments, Designations, Employees, Roles, Users, Audit Logs, System Config |
| **Phase 3** | Inventory Foundation & Warehouse Hierarchy | **100% Complete** | 5-Level Warehouses/Bins, Standard UOMs & Conversions, Item Master |
| **Phase 4** | Unified Party Master & Commercial Terms | **100% Complete** | Unified Customers/Suppliers/Transporters/Job-Workers, Tiered Price Lists |
| **Phase 5** | Procurement & Physical Inward Supply Chain | **100% Complete** | Requisitions, RFQ Comparative Matrix, PO, Gate Entry, GRN, Inward QC, Put-Away, Invoices |
| **Phase 6** | Manufacturing Engineering, MRP & Shopfloor | **100% Complete** | Multi-level BOMs, Work Centers, Routings, MRP-I, Work Orders, Issues, Job Cards, Job-Work, FG Receipts |
| **Phase 7** | Sales Order, Reservation, Dispatch & Invoicing | **100% Complete** | Quotations, Sales Orders & ATP, Delivery Challans, GST Tax Invoices & IRN, Sales Returns / Credit Notes |
| **Phase 8** | Inventory Ledger, Valuation & Analytics | **100% Complete** | Real-Time Stock Balance, Physical Audit Adjustments, STO Transfers, 360° Genealogy, Aging & ROP |
| **Phase 9** | Quality Control & Inspection Management | **100% Complete** | In-Process QC, Final PDI & CoA, Non-Conformance (NCR) & 8D CAPA, Gauge Calibration Register |
| **Phase 10** | Financial Accounting & Statutory Sync | **Planned** | General Ledger, Chart of Accounts, Bank Reconciliation, Direct E-Way Bill / NIC Portal API |
| **Phase 11** | Plant Maintenance & Mobile PDA Execution | **Planned** | Equipment Calibration & CMMS, Mobile Barcode/QR Scanner PDA App, Visual Gantt Scheduling |

---

### 🔄 Upcoming Implementation Roadmap

#### Phase 10: Financial Accounting, Sub-Ledgers & Direct Statutory Gateway
- 🔄 **Step 10.1 — Chart of Accounts (COA) & General Ledger (GL) Subsystem (`/accounts/gl`)**:
  - Standard 5-level Chart of Accounts (Assets, Liabilities, Equity, Revenue, Expense) with multi-company and branch cost center tagging.
  - Automated journal voucher posting from operational events (Purchase Invoices, Sales Invoices, Inventory Revaluations, Absorption Costing).
- 🔄 **Step 10.2 — Accounts Payable (AP) & Accounts Receivable (AR) Cash & Bank Management (`/accounts/banking`)**:
  - Vendor payment processing, customer receipt allocations, cheque / NEFT / RTGS tracking, and bank statement reconciliation.
- 🔄 **Step 10.3 — Direct GST Portal & E-Way Bill API Gateway (`/admin/integrations/gst`)**:
  - Direct machine-to-machine API integration with NIC E-Way Bill and E-Invoice portal via GSP (GST Suvidha Provider) for automatic 1-click IRN generation, cancellation, and active vehicle part-B updating without manual JSON upload.

#### Phase 11: Enterprise Plant Maintenance (CMMS) & Shopfloor Mobile PDA App
- 🔄 **Step 11.1 — Computerized Maintenance Management System (CMMS) (`/maintenance`)**:
  - Preventative maintenance schedules (running hours / calendar-based), breakdown maintenance tickets, spare parts consumption, and MTBF / MTTR machinery analytics.
- 🔄 **Step 11.2 — Shopfloor Mobile Scanner / Handheld Terminal App (Android & iOS)**:
  - 100% native mobile client utilizing existing REST APIs (`/api/v1/*`) for camera-based 1D/2D barcode and QR scanning.
  - Real-time dock receiving GRN scanning, bin-to-bin put-away confirmation, lineside material issue picking, and physical stock count auditing.
- 🔄 **Step 11.3 — Advanced Visual Finite Capacity Scheduling & Gantt Board (`/manufacturing/scheduling`)**:
  - Interactive drag-and-drop Gantt chart visualizer for Work Orders and Job Cards across machine work centers with live machine maintenance conflict alerts and shift capacity constraints.

---

## 📚 Core Documentation Index

KS-MFG maintains authoritative, continuously updated living documentation in [`docs/`](docs/) and [`dbscripts/`](dbscripts/):

| Document | Purpose | Key Contents |
| :--- | :--- | :--- |
| **[User & Functional Manual](docs/user-manual.md)** | End-User & Functional Guide | Screen-by-screen step-by-step operating instructions, business rules, filter/group-by guides, and action button permissions. |
| **[Technical & Architecture Manual](docs/technical-manual.md)** | Developer & DBA Reference | System architecture, database schema conventions, RBAC evaluation rules, API endpoint contracts, and module design. |
| **[Database Execution Order](dbscripts/db_scripts_execution_order.txt)** | Blank Database Setup Guide | Exact chronological execution order of SQL scripts in `dbscripts/` for initializing a fresh PostgreSQL database. |

---

## 🛠 Technology Stack

| Layer | Technologies | Description |
| :--- | :--- | :--- |
| **Backend Framework** | [NestJS 11](https://nestjs.com/) (Node.js 22+, TypeScript) | Modular enterprise REST API (`/api/v1/*`) with global JWT authentication, RBAC permission guards, and standardized response envelopes. |
| **Database** | [PostgreSQL 15+](https://www.postgresql.org/) | Relational database using `BIGINT` sequence PKs, composite unique constraints, PL/pgSQL triggers, and JSONB field-delta audit trails. |
| **Data Access Layer** | [Drizzle ORM](https://orm.drizzle.team/) + Native `pg.Pool` | Type-safe schema definitions combined with direct, high-performance parameterized SQL queries and transactional connection pooling. |
| **Caching Layer** | [Redis 7+](https://redis.io/) (`ioredis`) | High-speed session and RBAC permission cache with automatic graceful fallback to PostgreSQL if Redis is offline. |
| **Security & Auth** | JWT, Passport, Bcrypt (12 rounds), Helmet | Stateless access tokens, HttpOnly refresh cookies, 5-attempt account lockout protection, and multi-company/multi-branch RBAC. |
| **Web Frontend** | [React 19](https://react.dev/), [Vite 8](https://vitejs.dev/), TypeScript | Responsive SPA with [Tailwind CSS v4](https://tailwindcss.com/), [Zustand](https://zustand-demo.pmnd.rs/) state persistence, [TanStack Query v5](https://tanstack.com/query/latest), and [Lucide React](https://lucide.dev/). |

---

## 📂 Directory Structure

```text
ks-mfg/
├── dbscripts/                              # Static PostgreSQL DDL/DML scripts (Blank-database policy)
│   ├── db_scripts_execution_order.txt      # Exact script execution order for a fresh PostgreSQL database
│   ├── 01_schema_objects.sql               # Canonical sequences, tables, constraints & indexes (tbl_*)
│   ├── functions/
│   │   └── fn_set_updated_timestamp.sql    # PL/pgSQL trigger function for automatic updated_date
│   ├── triggers/
│   │   └── trg_set_updated_timestamp.sql   # BEFORE UPDATE triggers on all mutable tables
│   ├── views/
│   │   └── vw_active_user_permissions.sql  # Consolidated RBAC & user context reporting view
│   ├── 02_initial_data.sql                 # Essential system seeds (Default Company, Roles, Screens, Actions, Admin)
│   └── 03_sample_demo_data.sql             # Sample multi-company, plant, department, employee & user demo data
│
├── backend/                                # NestJS 11 REST API Backend (/api/v1/*)
│   ├── src/
│   │   ├── common/                         # Guards (JwtAuth, Permissions), Interceptors, Filters,
│   │   │                                   # AuditLogService, DependencyCheckService, RedisService
│   │   ├── database/                       # pg.Pool + Drizzle ORM connection & core.schema.ts
│   │   └── modules/
│   │       ├── auth/                       # Login, Context Switcher, User Preferences, Me endpoint
│   │       ├── organization/               # Company, Branch/Plant, Financial Year & Branch-FY Lock modules
│   │       ├── hr/                         # Department, Designation & Employee Master modules
│   │       └── security/                   # Global Roles, Permission Matrix & User/Role Assignment modules
│   └── package.json
│
├── frontend/                               # React 19 + Vite 8 + Tailwind CSS v4 Web ERP
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/                     # MasterDataTable, ConfirmDeleteModal, PermissionGate
│   │   │   ├── layout/                     # AppShell (Sidebar, Topbar, Context Switcher, User Menu)
│   │   │   └── theme/                      # ThemeProvider & ThemeCustomizerModal
│   │   ├── lib/                            # Axios apiClient with JWT & X-Correlation-Id interceptors
│   │   ├── pages/                          # Auth, Dashboard, Organization, HR, Security & Party screens
│   │   └── store/                          # Zustand persisted Auth & Theme stores
│   └── vite.config.ts
│
├── docs/                                   # Authoritative Living Documentation
│   ├── user-manual.md                      # Functional & End-User Operating Manual
│   └── technical-manual.md                 # Technical Architecture, Schema & API Manual
│
├── start.bat                               # Windows 1-click launcher for Backend (:3000) & Frontend (:5173)
└── stop.bat                                # Safe Windows port terminator (strictly LISTENING on :3000/:5173)
```

---

## 🚀 Quick Start & Installation Guide

### Prerequisites

- **Node.js**: `v20.x` or `v22.x` (LTS)
- **PostgreSQL**: `v15+` running on port `5432`
- **Redis**: `v7+` running on port `6379` *(Optional in local dev — backend automatically falls back to PostgreSQL if Redis is unavailable)*

---

### Step 1: Database Setup (Static SQL Scripts)

> [!IMPORTANT]
> **Fresh / Blank Database Policy**: All SQL files inside [`dbscripts/`](dbscripts/) are designed to be executed on a **blank PostgreSQL database** in the exact order listed in [`dbscripts/db_scripts_execution_order.txt`](dbscripts/db_scripts_execution_order.txt).

**1. Create a blank PostgreSQL database** (using pgAdmin 4 or `createdb`):

```bash
createdb -U postgres ks_mfg_erp
```

**2. Execute the scripts in exact dependency order**:

#### Option A — Using `psql` CLI from Project Root:
```bash
psql -U postgres -d ks_mfg_erp -v ON_ERROR_STOP=1 -f dbscripts/01_schema_objects.sql
psql -U postgres -d ks_mfg_erp -v ON_ERROR_STOP=1 -f dbscripts/functions/fn_set_updated_timestamp.sql
psql -U postgres -d ks_mfg_erp -v ON_ERROR_STOP=1 -f dbscripts/triggers/trg_set_updated_timestamp.sql
psql -U postgres -d ks_mfg_erp -v ON_ERROR_STOP=1 -f dbscripts/views/vw_active_user_permissions.sql
psql -U postgres -d ks_mfg_erp -v ON_ERROR_STOP=1 -f dbscripts/02_initial_data.sql
psql -U postgres -d ks_mfg_erp -v ON_ERROR_STOP=1 -f dbscripts/03_sample_demo_data.sql
```

#### Option B — Using pgAdmin 4 Query Tool:
Open **Query Tool** on your blank `ks_mfg_erp` database and execute the 6 files in the exact order above (see [`dbscripts/db_scripts_execution_order.txt`](dbscripts/db_scripts_execution_order.txt)).
*(Note: `03_sample_demo_data.sql` is optional and loads sample multi-company, plant, department, employee, and user records for testing/demo).*

---

### Step 2: Backend REST API Setup (`backend/`)

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables (`.env`)**:
   Create or verify `backend/.env`:
   ```env
   PORT=3000
   DATABASE_URL=postgresql://postgres:your_postgres_password@localhost:5432/ks_mfg_erp
   REDIS_URL=redis://localhost:6379
   JWT_ACCESS_SECRET=ks_mfg_super_secret_access_key_2026_enterprise
   JWT_REFRESH_SECRET=ks_mfg_super_secret_refresh_key_2026_enterprise
   CORS_ORIGIN=http://localhost:5173
   ```

4. **Build & Start the NestJS Server**:
   ```bash
   npm run build
   npm run start:dev
   ```
   The REST API will listen at `http://localhost:3000/api/v1` (Health check: `GET http://localhost:3000/api/v1/health`).

---

### Step 3: Web ERP Frontend Setup (`frontend/`)

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the Vite Development Server**:
   ```bash
   npm run dev
   ```
   Open your browser and navigate to `http://localhost:5173`.

4. **Build for Production**:
   ```bash
   npm run build
   ```

---

### Windows 1-Click Start & Stop Scripts

For rapid local development on Windows, use the root batch scripts:
- **`start.bat`**: Launches both the NestJS Backend (`:3000`) and Vite React Frontend (`:5173`) in separate terminal windows.
- **`stop.bat`**: Safely terminates only `node.exe` processes in `LISTENING` state on local ports `:3000` and `:5173` without disturbing your browser, pgAdmin, or IDE.

---

## 🔐 Default Super Admin Credentials

Running `dbscripts/02_initial_data.sql` provisions the root Super Administrator account:

| Parameter | Default Value | Notes |
| :--- | :--- | :--- |
| **Username** | `admin` | Can also log in using email `admin@ksmfg.com` |
| **Password** | `Admin@123` | *Change immediately in production deployments* |
| **Default Company** | `KSMFG` (`comp_id = 1001`) | Kashvira Manufacturing ERP |
| **Default Plant / Branch** | `PLT-AHM-01` (`branch_id = 1001`) | Ahmedabad Main Plant & HO |
| **Default Financial Year** | `2026-27` (`fyear_id = 1001`) | FY 2026-2027 (`2026-04-01` to `2027-03-31`) |

---

## 🤝 Community, Feedback & Support

This project is published as a **Source-Available, Non-Commercial** application by **Kashvira Infotech**. We are building **KS-MFG** to empower discrete and process manufacturing enterprises with a modern, self-hosted ERP that gives them complete ownership over their shopfloor operations, inventory ledgers, and multi-plant data.

### 📬 Get in Touch
- **Contact Email**: [`kashvirainfotech@gmail.com`](mailto:kashvirainfotech@gmail.com)

### 🙌 Let Us Know If You Are Using KS-MFG!
If you or your manufacturing organization are evaluating or using this project, **please drop us a short email at [`kashvirainfotech@gmail.com`](mailto:kashvirainfotech@gmail.com)**.
Hearing how KS-MFG helps your plant or warehouse team encourages us and helps us understand how the platform is being used in the field.

### 💡 Stopped Using KS-MFG? Help Us Improve!
If you tested, installed, or previously evaluated KS-MFG but decided to stop using it, **we would genuinely love to know why**.
Please email us with your feedback, shopfloor challenges, or missing features. We appreciate these insights as we work through our phased manufacturing roadmap.

### 🐛 Feedback, Suggestions & Bug Reports
Feedback, feature suggestions, and bug reports are warmly welcomed! Please open an issue on GitHub to share your ideas or report a problem, or email us directly at [`kashvirainfotech@gmail.com`](mailto:kashvirainfotech@gmail.com).

---

## 📜 License & Terms of Use

**KS-MFG** is licensed under the **Kashvira Infotech Non-Commercial / Source-Available License**.

The full source code is freely viewable, downloadable, and modifiable, but **commercial use, resale, and commercial SaaS hosting are strictly restricted**.

### ✅ Permitted Uses (Free of Charge)
You are permitted to download, install, build, inspect, and modify KS-MFG free of charge for:
- **Internal Business Operations**: Deploying and using the ERP within your own manufacturing company or organization to manage your internal plants, warehouses, inventory, procurement, production, and workforce.
- **Personal & Educational Use**: Learning, experimentation, academic research, and ERP architecture training.
- **Testing, Security & Evaluation**: Proofs of concept, staging trials, and technical security assessments.

### ❌ Prohibited Commercial Uses (Without Prior Written License)
Unless you have obtained a separate written commercial license agreement from Kashvira Infotech, you **may not**:
- **Sell, Resell, or Sublicense**: Charge others for access to the software, sell copies, or license/sub-license the codebase or any derivative works.
- **Offer as a Paid SaaS or Managed Cloud Service**: Host KS-MFG as a commercial Software-as-a-Service (SaaS), multi-tenant ERP service, or managed hosting offering for external paying clients.
- **Commercial Redistribution**: Distribute, bundle, market, or re-brand the software or derivative versions as part of any commercial offering or ERP consultancy package.
- **Compete Commercially**: Create a commercial ERP/WMS/MES product or service substantially based on or derived from this codebase.

### 💼 Commercial Licensing Requests
If you are an enterprise, ERP system integrator, cloud service provider, or software vendor looking to:
- Package or integrate KS-MFG into a commercial product offering,
- Host and operate KS-MFG as a commercial service for your clients, or
- Acquire dedicated commercial redistribution rights,

Please contact our commercial licensing desk:
📧 **Commercial Licensing Inquiries**: [`kashvirainfotech@gmail.com`](mailto:kashvirainfotech@gmail.com)

---

## About Kashvira Infotech & Project Policy

### Our Company & Why We Built KS-MFG

**Kashvira Infotech** is an IT startup specializing in software solutions for **manufacturing enterprises (ERP / MES)**, **warehouse management systems (WMS)**, **transportation management systems (TMS)**, custom enterprise software tailored to client shopfloor requirements, and web and mobile application development services.

We built **KS-MFG** to provide manufacturing businesses with a fast, transparent, audit-ready ERP foundation—eliminating per-user SaaS license bloat while supporting real-world Indian and global plant workflows (multi-company GSTINs, branch-wise period locking, multi-level BOMs, subcontractor job-work, and bin-level inventory traceability).

### 🛠️ Professional Services & Implementation

We help discrete and process manufacturers, industrial fabricators, engineering units, and multi-warehouse distributors digitize their operations from **raw material gate entry to finished goods dispatch**.

#### 🎯 Role-Tailored Clarity Across Your Plant & Corporate Office

1. **For Plant Heads & Production Managers — Real-Time Shopfloor Visibility**
   - Track work orders, shift-wise machine output, scrap/rework percentages, and stage-wise bottlenecks across multiple manufacturing plants from a single console.
2. **For Warehouse & Store Officers — Zero Stock Discrepancies**
   - Enforce structured GRN inward, QC quarantine hold/release, bin-level put-away, BOM kitting, and branch-level financial period locking during physical stock audits.
3. **For Quality Assurance (QA) Teams — Enforced Inspection Gates**
   - Prevent uninspected raw materials or semi-finished batches from being consumed in production or dispatched to customers without mandatory QC clearance.
4. **For Procurement & Sales Teams — Controlled Commercial Execution**
   - Automate purchase requisitions, tiered vendor/customer price lists, GST tax calculations, credit limit checks, and delivery challans.
5. **For Promoters, CFOs & IT Heads — Full Data Sovereignty & Zero Per-User SaaS Taxes**
   - Deploy on your own on-premise plant server or private cloud with unlimited users, branches, and complete field-delta audit trails (`tbl_sys_audit_log`).

#### 🚀 What We Offer

- **Turnkey ERP Implementation & Cloud/On-Premise Setup**: End-to-end installation, PostgreSQL tuning, automated backup configuration, and SSL/domain setup.
- **Custom Manufacturing & Shopfloor Engineering**: Tailoring BOM structures, barcode/QR label printing, weighbridge/IoT machine integrations, and custom approval workflows to match your exact manufacturing process.
- **Dedicated Private Codebase & Custom Development**: For each client's customization engagement, we establish a separate private GitHub repository branched from this repository and develop bespoke requirements exclusively for your organization.
- **Master Data Migration & Plant User Training**: Hands-on onboarding for storekeepers, QC inspectors, production supervisors, purchase/sales executives, and management.
- **Ongoing AMC, Support & Maintenance**: Periodic security updates, database optimization, and dedicated technical support.

> 📩 **Ready to modernize your manufacturing & supply chain operations?**
> Contact our engineering and ERP consulting team at **[`kashvirainfotech@gmail.com`](mailto:kashvirainfotech@gmail.com)** to discuss your plant requirements, schedule a walkthrough, or request a custom implementation quote.

### Repository Usage & Future Changes

> [!IMPORTANT]
> **Please treat this repository as a starting point for your own implementation. Future changes in this public repository, particularly database scripts inside `dbscripts/`, are intended for fresh installations only and should not be treated as upgrade or migration scripts for existing installations.**

You are welcome to fork this repository and adapt it to your internal manufacturing requirements under the [Non-Commercial License Terms](#-license--terms-of-use). If you would like assistance with customization, dedicated private hosting, or commercial licensing, please contact us at [`kashvirainfotech@gmail.com`](mailto:kashvirainfotech@gmail.com).

### Contributions & Maintenance Expectations

**We do not accept pull requests for this repository.** As a focused team, we are dedicating our available engineering resources to completing the planned phased roadmap. Ongoing community development and pull request review would require dedicated staffing that we are unable to commit to. Please refrain from submitting pull requests; you are welcome to maintain enhancements in your own fork.

Feedback, suggestions, and bug reports remain welcome through GitHub issues or email. However, we cannot commit to continuous feature development, ongoing maintenance, or a fixed response/resolution timeline for the public repository.

---

<div align="center">
  <sub>Engineered with ❤️ by <b>Kashvira Infotech</b></sub>
</div>
