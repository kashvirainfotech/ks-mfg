# Task-Wise Implementation Checklist (KS-MFG)

**Document Version:** 2.0.0  
**Project:** KS-MFG Web ERP & Mobile API Parity  
**Last Updated:** 2026-10-20  
**Usage:** Progress tracking across development sprints. Mark tasks with `[x]` upon completion and verification.

---

## ✅ Phase 0: Core Database Foundation, Security Kernel & AppShell
- [x] Canonical PostgreSQL schema architecture (`tbl_`, `vw_`, `fn_`, `trg_`, `idx_`) with `BIGINT` sequence PKs and 7 standard audit/tenant columns (`comp_id`, `branch_id`, `fyear_id`, `created_by`, `created_date`, `updated_by`, `updated_date`)
- [x] In `dbscripts/01_schema_objects.sql`: Core sequences, `tbl_org_company`, `tbl_org_branch`, `tbl_org_financial_year`, `tbl_org_branch_fyear`, `tbl_sec_user_preference`, `tbl_sys_audit_log`
- [x] In `dbscripts/02_initial_data.sql`: Seed root Super Admin (`admin` / `Admin@123`), initial screens and standard action permissions
- [x] In `dbscripts/03_sample_demo_data.sql`: Realistic manufacturing enterprise seed data (heavy discrete & process manufacturing)
- [x] NestJS 11 Security & Architecture Kernel:
  - [x] Global `JwtAuthGuard` and `@RequirePermission()` `PermissionsGuard`
  - [x] `CorrelationIdMiddleware` with `X-Correlation-Id` header tracking
  - [x] `ResponseEnvelopeInterceptor` for standardized JSON envelope
  - [x] `AllExceptionsFilter` with structured error handling
  - [x] `AuditLogService` with automated JSONB `old_value` vs `new_value` field diffing
  - [x] `DependencyCheckService` for pre-delete foreign key verification
  - [x] Redis caching with automatic graceful fallback to PostgreSQL
  - [x] Drizzle ORM + `pg.Pool` connection pooling in strict non-sync query builder mode
- [x] Modern Web ERP Frontend Shell (React 19, Vite 8, Tailwind v4):
  - [x] Persistent Theme Engine (Light / Dark / System modes + 6 dynamic brand palettes: Indigo, Blue, Emerald, Violet, Amber, Rose)
  - [x] Full CSS utility token mapping (`--card`, `--background`, `--foreground`, `--muted`, `--border`, `--erp-*`)
  - [x] Dynamic Company, Branch, and Financial Year switcher in top navigation
  - [x] Hover-to-peek collapsible sidebar navigation
  - [x] `<MasterDataTable>` (multi-column search, grouping, sorting, pagination, CSV export, print)
  - [x] `<PermissionGate>` UI component for button-level RBAC enforcement
  - [x] `<ConfirmDeleteModal>` with structured dependency conflict breakdowns

---

## ✅ Phase 1: Organization & Multi-Tenant Hierarchy (`ORGANIZATION`)
- [x] **Step 1.1 — Company Master (`/org/companies`)**: Full CRUD on `tbl_org_company` with 15-char Indian GSTIN derivation, PAN, CIN, base currency, and pre-delete checks across branches, FYs, and user mappings.
- [x] **Step 1.2 — Branch & Plant Master (`/org/branches`)**: Full CRUD on `tbl_org_branch` supporting `PLANT`, `HO`, `WAREHOUSE`, and `SALES_OFFICE` facility types, state GSTIN validation, and Head Office rules.
- [x] **Step 1.3 — Financial Year Master & Branch-FY Locking (`/org/financial-years`)**: Full CRUD on `tbl_org_financial_year` with automatic `tbl_org_branch_fyear` provisioning, Quick FY Generator, company-wide period closing (`is_closed`), and branch-specific fiscal period locking (`is_locked`).

---

## ✅ Phase 2: HR Workforce Hierarchy, Global RBAC & Security (`SECURITY`)
- [x] **Step 2.1 — Department & Designation Master (`/hr/departments`)**: Dual-tab management for functional plant departments (`tbl_hr_department` with parent-child tree and cost centers) and job designations (`tbl_hr_designation` with grade bands `E1`–`L5`).
- [x] **Step 2.2 — Employee Master Directory (`/hr/employees`)**: 3-tab workforce registry (`tbl_hr_employee`) covering plant/department assignment, self-referencing reporting manager hierarchy, statutory identifiers (PAN, Masked Aadhaar, PF UAN, ESIC), and payroll bank records.
- [x] **Step 2.3 — Global Roles & Granular Screen/Action Permissions Matrix (`/security/roles`)**: Global role catalogue (`tbl_sec_role`) with baseline role cloning and interactive Screen/Action permissions matrix (`tbl_sec_role_permission` and `tbl_sec_role_action_permission`) with `SUPER_ADMIN` self-lockout protection.
- [x] **Step 2.4 — User Master & Multi-Company / Multi-Branch Role Assignment (`/security/users`)**: ERP user accounts (`tbl_sec_user`) with HR employee linking, Bcrypt hashing, atomic multi-company (`tbl_sec_user_company_role`) and multi-branch (`tbl_sec_user_branch_role`) role assignments, administrative password reset, and account lockout unlock.
- [x] **Step 2.5 — Security & Field-Delta Audit Trail Viewer (`/security/audit-logs`)**: Complete immutable audit viewer (`tbl_sys_audit_log`) with side-by-side JSONB `old_value` vs `new_value` field diff inspector, multi-column search, and CSV export.
- [x] **Step 2.6 — System Configuration Matrix & Document Numbering Series Engine (`/admin/configurations`)**: Dual-tab administration engine managing company/plant configuration overrides (`tbl_sys_config`) and multi-plant document numbering series (`tbl_sys_doc_number_series`) with live preview, token generation, and rollover rules.

---

## ✅ Phase 3: Inventory Foundation & Warehouse Hierarchy (`INVENTORY`)
- [x] **Step 3.1 — Multi-Level Warehouse, Zone, Rack, Shelf & Bin Master (`/inventory/warehouses`)**: Physical logistics model (`tbl_inv_warehouse` and `tbl_inv_storage_bin`) supporting Raw Materials, Quarantine Hold, WIP Lineside, Finished Goods, and Scrap Yards with coordinate path preview (`Warehouse` $\rightarrow$ `Zone` $\rightarrow$ `Rack` $\rightarrow$ `Shelf` $\rightarrow$ `Bin`).
- [x] **Step 3.2 — Unit of Measure (UOM), UOM Conversion Matrix & Item Category Hierarchy (`/inventory/uoms`)**: 3-tab inventory configuration managing standardized industrial UOMs (`tbl_inv_uom`), bidirectional conversion ratios (`tbl_inv_uom_conversion`), and recursive item category tree hierarchies (`tbl_inv_item_category`).
- [x] **Step 3.3 — Item & Material Master, Multi-UOM, Pricing, Quality & BOM Parameters (`/inventory/items`)**: Comprehensive 4-tab engineering material master (`tbl_inv_item`) managing standard/purchase/sales rates, multi-UOM mappings (Base, Purchase, Sales), inventory buffer thresholds (ROP, Min, Safety Stock), QC inspection flags, heat/batch/serial tracking, and BOM parent flags.

---

## ✅ Phase 4: Unified Party Master & Commercial Terms (`CRM_SRM`)
- [x] **Step 4.1 — Unified Customer, Supplier, Transporter & Job-Worker Master (`/parties/customers` & `/parties/master`)**: Multi-faceted corporate entity directory (`tbl_crm_party`) with 1-to-N multi-plant addresses and state-level GSTINs (`tbl_crm_party_address`), PAN, MSME Udyam classification, credit limit controls, and payment terms.
- [x] **Step 4.2 — Tiered Price Lists, Volume Discounts & Vendor Rate Contracts (`/parties/price-lists`)**: Commercial sales price lists, vendor procurement contracts, and subcontractor machining rate cards (`tbl_crm_price_list`) with multi-tier quantity break discounts (`tbl_crm_price_list_item`), validity dates, default fallback rules, and authorized trading partner assignments (`tbl_crm_party_price_list`).

---

## ✅ Phase 5: Procurement & Physical Inward Supply Chain (`PROCUREMENT`)
- [x] **Step 5.1 — Material Purchase Requisition (MR) & Multi-Level Authorization (`/procurement/requisitions`)**: Internal shopfloor & department material indents (`tbl_pur_requisition_header` & `tbl_pur_requisition_item`) with multi-level approval workflows, benchmark rate estimation, and printable requisition vouchers.
- [x] **Step 5.2 — Supplier Request for Quotation (RFQ) & Comparative Statement Matrix (`/procurement/rfqs`)**: Multi-vendor bidding tenders (`tbl_pur_rfq_header`, `tbl_pur_rfq_item`, `tbl_pur_rfq_vendor`, `tbl_pur_rfq_vendor_item`) with 1-click requisition import, supplier bid logging, dynamic Comparative Statement (CS) evaluation matrix with automated L1 bidder detection, and contract awarding.
- [x] **Step 5.3 — Purchase Order (PO) Management & Commercial Release Workflow (`/procurement/purchase-orders`)**: Legally binding purchase contracts (`tbl_pur_po_header` & `tbl_pur_po_item`) covering Standard PO, Blanket Agreement, Subcontracting Job-Work, Service PO, and CapEx, real-time GST tax computation, 1-click sourcing import from Awarded RFQs / Approved PRs, commercial release (`RELEASE`), cancellation workflows, and printable purchase order vouchers.
- [x] **Step 5.4 — Gate Entry & Security Inward Register (`/procurement/gate-inward`)**: Factory perimeter security checkpoints (`tbl_pur_gate_inward_header` & `tbl_pur_gate_inward_item`) tracking incoming supplier transport trucks, delivery challans, Indian GST E-Way Bills, LR consignment notes, weighbridge gross/tare/net weight verification, stores offloading clearance (`UNLOAD`), and security outward departure passes (`EXIT`).
- [x] **Step 5.5 — Goods Receipt Note (GRN) & Quarantine Put-Away (`/procurement/grn`)**: Dock receiving vouchers (`tbl_pur_grn_header` & `tbl_pur_grn_item`) with 1-click Gate Inward / PO sync, shortage/excess variance logging, supplier heat/batch number tracking, quarantine staging cage put-away (`QC_IN_PROGRESS`), store approval (`APPROVED`) with automatic PO received balance increments, and printable official GRN vouchers.
- [x] **Step 5.6 — Inward Material QC Inspection, Heat/Batch Allocation & Quarantine Clearance (`/quality/inward-qc`)**: Full metallurgical and physical laboratory testing (`tbl_pur_inward_qc_header` & `tbl_pur_inward_qc_item`) with 1-click Quarantine GRN import, 4-pillar testing checklist (Visual, Dimensional, Chemical/Spectro, Hardness), JSON observed parameters tracking, split accepted vs rejected lot disposition, upstream PO and GRN synchronization on approval, and printable official QC certificates.
- [x] **Step 5.7 — Warehouse Bin Put-Away, Lot Allocation & Stock Ledger Posting (`/inventory/put-away`)**: WMS execution (`tbl_inv_putaway_header` & `tbl_inv_putaway_item`) transferring accepted materials from quarantine staging to permanent storage racks, operator dispatching (`ASSIGN`), and real-time on-hand stock balance updates in `tbl_inv_bin_stock` and immutable transactions in `tbl_inv_stock_ledger`.
- [x] **Step 5.8 — Purchase Invoice 3-Way Matching, GST Input Tax Credit & Accounts Payable Clearance (`/procurement/invoices`)**: Commercial finance 3-way matching engine (`tbl_pur_invoice_header` & `tbl_pur_invoice_item`) comparing PO rates, GRN received quantities, and QC accepted quantities, automated price/quantity variance detection, GST Input Tax Credit (ITC) breakdown, TDS/TCS withholding tax calculations, AP clearance approvals, payment disbursements, and printable commercial vouchers.

---

## ✅ Phase 6: Manufacturing Engineering, MRP, Shopfloor Execution & Job-Work (`MANUFACTURING`)
- [x] **Step 6.1 — Multi-Level Bill of Materials (BOM), Versions, Scrap Factors & Co-Products / By-Products (`/manufacturing/boms`)**: Engineering product recipes and hierarchical assembly structures (`tbl_mfg_bom_header`, `tbl_mfg_bom_item`, `tbl_mfg_bom_byproduct`) with recursive indented tree explosion (`EXPLODE`), cycle detection, process scrap factors, co-product recovery credits, 1-click version cloning, engineering approval workflow, live absorption cost rollups, and printable costed engineering datasheets.
- [x] **Step 6.2 — Work Centers, Production Lines, Capacity & Shift Calendars (`/manufacturing/work-centers`)**: Shopfloor workstations, CNC machining cells, assembly lines, and furnaces (`tbl_mfg_work_center`), capital machinery assets (`tbl_mfg_work_center_machine`), factory production shifts (`tbl_mfg_shift`), working shift allocations, daily rated capacity & OEE efficiency calculations, maintenance logging, absorption hourly cost matrices, and printable capacity sheets.
- [x] **Step 6.3 — Production Routings, Operation Sequences, Standard Cycle Times & Machine Tooling (`/manufacturing/routings`)**: Chronological multi-stage manufacturing operation sequences (`tbl_mfg_routing_header` & `tbl_mfg_routing_operation`), work center assignment, machine tooling and fixture tracking, setup & run cycle times, interactive sequential operation timeline visualizer, engineering approval workflow, 1-click revision cloning, absorption unit costing rollups, and printable shopfloor route traveler cards.
- [x] **Step 6.4 — Material Requirements Planning (MRP-I Engine) & Gross-to-Net Planned Orders (`/manufacturing/mrp`)**: Supply chain calculation engine (`tbl_mfg_mrp_run_header` & `tbl_mfg_mrp_planned_order`) computing multi-level gross-to-net material deficits ($\text{Net} = \text{Gross} - \text{On-Hand Stock} - \text{Scheduled PO Receipts} + \text{Safety Buffer}$), recursive BOM scrap factor explosion, action classification (`MAKE` vs `BUY` vs `SUBCONTRACT`), backward scheduling, 1-click batch conversion into Purchase Requisitions, indented BOM tree visualization, and printable planning schedules.
- [x] **Step 6.5 — Production Work Orders (WO), Scheduling, BOM Snapshot & Operation Routing Release (`/manufacturing/work-orders`)**: Discrete manufacturing shopfloor execution engine (`tbl_mfg_wo_header`, `tbl_mfg_wo_bom_item`, `tbl_mfg_wo_routing_op`) featuring frozen bill-of-material component snapshots, sequential routing operation freezing, multi-warehouse segregation (Finished Goods vs WIP Lineside), 1-click conversion from MRP planned orders, shopfloor release authorization, production yield efficiency calculation, and printable job card traveler sheets.
- [x] **Step 6.6 — Shopfloor Material Issue, Lineside Staging & Backflushing (`/manufacturing/material-issues`)**: Production component requisition and staging register (`tbl_mfg_material_issue_header` & `tbl_mfg_material_issue_item`) tracking issue vouchers (`MI-`), 1-click "Load from Work Order", automated stock posting debiting store inventory (`ISSUE_TO_WIP`), incrementing Work Order `issued_qty`, auto-transitioning Work Orders to `IN_PROGRESS`, accumulating actual material cost, shopfloor unconsumed surplus returns, and printable store requisition vouchers.
- [x] **Step 6.7 — Stage-Wise Production Job Cards, Operation Time Logging & In-Process QC Inspection (`/manufacturing/job-cards`)**: Shopfloor routing traveler cards and MES execution register (`tbl_mfg_job_card` & `tbl_mfg_job_card_time_log`) tracking travelers (`JC-`), 1-click batch generation of sequential operation travelers from active Work Orders, shopfloor clock-in, shift-wise setup/run/downtime booking and output reporting, mandatory in-process QC inspection clearance, automatic sequential stage handover queueing, cumulative operation cost rollup into parent Work Order headers upon completion, and printable traveler sheets.
- [x] **Step 6.8 — Subcontractor Job-Work Outward Delivery Challan, Inward Receipt & Material Reconciliation (`/manufacturing/job-work`)**: Statutory Indian GST Section 143 & Rule 55 delivery challan register (`tbl_mfg_job_work_challan`, `tbl_mfg_job_work_challan_item`, `tbl_mfg_job_work_receipt`, `tbl_mfg_job_work_receipt_item`) tracking outward challans (`JW-OUT-`), vendor third-party processing, Work Order and routing step link, outward warehouse inventory issue (`PRODUCTION_ISSUE` in `tbl_inv_stock_ledger`), inward goods receipt (`JW-IN-`) with QC disposition, warehouse put-away (`PUTAWAY_INWARD`), processing charges + 18% GST calculation, absorption into Work Order actual machining costs, multi-line material reconciliation ($\text{Sent} = \text{Received} + \text{Scrap} + \text{Loss}$), and printable GST Section 143 delivery challans.
- [x] **Step 6.9 — Finished Goods (FG) Production Receipt, Scrap/By-Product Accounting & Absorption Cost Rollup (`/manufacturing/fg-receipts`)**: Finished goods receipt register (`tbl_mfg_fg_receipt_header`, `tbl_mfg_fg_receipt_byproduct`) tracking production output vouchers (`FGR-`), Work Order linkage, batch/lot and melt heat traceability, output yield efficiency percentage, 1-click "Suggest from BOM" co-product and recoverable scrap recovery crediting, live actual absorption costing rollups ($\text{Net Cost} = \text{Actual Material} + \text{Actual Operation} - \text{Scrap Credit}$), in-process/final QC clearance, automated stock ledger posting (`PUTAWAY_INWARD` in `tbl_inv_stock_ledger`), bin inventory put-away (`tbl_inv_bin_stock`), Work Order completion synchronization, and printable production inward vouchers.

---

## ✅ Phase 7: Sales Order, Reservation, Dispatch & Invoicing (`SALES`)
- [x] **Step 7.1 — Customer Inquiry & Quotation / Proforma Invoice (`/sales/quotations`)**: Pre-sales commercial quotations (`tbl_sales_quotation_header` & `tbl_sales_quotation_item`) featuring auto-numbering (`QT-`), customer address & GSTIN sync, intra-state vs inter-state tax engine, commercial revision tracking, 1-click conversion to Sales Order (`CONVERT_TO_SO`), and printable statutory Indian GST proforma invoices.
- [x] **Step 7.2 — Sales Order (SO), Commercial Credit Check & Available-to-Promise (ATP) Stock Reservation (`/sales/orders`)**: Legally binding customer contracts (`tbl_sales_order_header` & `tbl_sales_order_item`) with auto-numbering (`SO-`), 1-click quotation import, customer commercial credit check vs master limits (`tbl_crm_party`) with managerial override, real-time Available-to-Promise (ATP) FIFO finished goods stock reservation engine against warehouse bins (`tbl_inv_bin_stock`), 1-click production Work Order generation for deficit unreserved quantities, operational & credit hold management, and printable sales order acknowledgements.
- [x] **Step 7.3 — Outward Warehouse Pick/Pack Slip & Dispatch Delivery Challan (`/sales/delivery-challans`)**: Statutory outward dispatch delivery challans and warehouse pick/pack slips (`tbl_sales_delivery_challan_header` & `tbl_sales_delivery_challan_item`) compliant with Rule 55 of CGST Rules, 2017, featuring auto-numbering (`DC-`), 1-click import from confirmed Sales Orders, 5-stage warehouse milestone lifecycle (`DRAFT` $\rightarrow$ `PICKED` $\rightarrow$ `PACKED` $\rightarrow$ `DISPATCHED` $\rightarrow$ `DELIVERED`), real-time WMS stock ledger deduction engine (`SALES_DISPATCH` in `tbl_inv_stock_ledger` and on-hand bin reduction in `tbl_inv_bin_stock`), automated Sales Order delivery status updates, reversible cancellation engine with automated inventory restitution, and printable delivery challans and packing slips.
- [x] **Step 7.4 — Statutory GST Tax Invoice Generation, E-Invoicing (IRN) & Customer Accounts Receivable (`/sales/invoices`)**: Statutory GST Rule 46 Tax Invoices and Accounts Receivable sub-ledger (`tbl_sales_invoice_header`, `tbl_sales_invoice_item`, `tbl_sales_ar_payment_receipt`) featuring FY-sequenced numbering (`INV-`), 1-click loading from dispatched Delivery Challans and confirmed Sales Orders, automated intra-state (CGST + SGST) vs inter-state (IGST) tax calculation with TCS and round-off, commercial invoice posting with line locking and Sales Order `invoiced_qty` synchronization, statutory Rule 48(4) E-Invoicing (IRN) engine generating 64-character SHA-256 hash, 16-digit Ack Number, signed QR code payload, and optional E-Way Bill link, Accounts Receivable (AR) payment receipt recording with TDS withholding and real-time balance reduction, and printable statutory Rule 46 GST Tax Invoices.
- [x] **Step 7.5 — Sales Return (Credit Note) & Inward RMA Quarantine Inspection (`/sales/returns`)**: Customer return and Return Merchandise Authorization (RMA) register (`tbl_sales_return_header` & `tbl_sales_return_item`) compliant with Section 34 of the CGST Act, 2017 & Rule 53 of CGST Rules, 2017, featuring auto-numbering (`SR-`), 1-click loading from posted Tax Invoices, quarantine QC inspection recording accepted vs scrap quantities with technical defect categorizations, statutory Section 34 Credit Note issuance (`CN-`) with commercial credit computation and real-time customer invoice balance reconciliation via AR adjustment receipts (`CREDIT_ADJUSTMENT`), statutory Rule 48(4) E-Invoicing (IRN) generation with 64-character SHA-256 hash and signed QR code, automated warehouse restocking putting away accepted units into storage bins (`tbl_inv_bin_stock`) with immutable stock ledger entries (`SALES_RETURN` in `tbl_inv_stock_ledger`), reversible cancellation engine with automatic inventory restitution, and printable statutory GST Rule 53 credit notes.

---

## ✅ Phase 8: Inventory Ledger, Valuation & Analytics (`INVENTORY_ANALYTICS`)
- [x] **Step 8.1 — Real-Time Stock Balance, Multi-Bin Inventory Ledger & FIFO Stock Valuation (`/inventory/balance`)**: Multi-bin perpetual inventory register (`tbl_inv_bin_stock`) compliant with Ind AS 2 / AS-2, real-time Available-to-Promise (ATP) stock visibility across plants, warehouses, and storage bins, batch/heat number traceability, safety stock buffer alert engine, chronological double-entry movement ledger drilldown (`tbl_inv_stock_ledger`), periodic revaluation and standard absorption cost realignment, and printable official stock valuation certificates.
- [x] **Step 8.2 — Physical Stock Reconciliation, Periodic Stock Audit & Stock Adjustments / Write-Offs (`/inventory/adjustments`)**: Physical inventory audit and variance reconciliation register (`tbl_inv_adjustment_header` & `tbl_inv_adjustment_item`) compliant with CARO 2020 Clause 3(ii) and Ind AS 2 / AS-2, featuring auto-numbering (`SA-`), 1-Click loading of warehouse bin book stock, dynamic real-time variance calculation ($\text{Physical} - \text{Book}$), 2-tier managerial sign-off, atomic inventory balance synchronization with double-entry stock ledger postings (`ADJUSTMENT` in `tbl_inv_stock_ledger`), reversible voucher cancellation engine with automated restitution, and printable CARO 2020 physical verification audit certificates.
- [x] **Step 8.3 — Warehouse Internal Transfers & Inter-Branch Stock Transfers (STO) (`/inventory/transfers`)**: Internal logistics and inter-branch stock transfer register (`tbl_inv_transfer_header` & `tbl_inv_transfer_item`) compliant with Rule 55 of the CGST Rules, 2017 & Section 25 of the CGST Act, 2017, featuring auto-numbering (`ST-` / `STO-`), 3 movement modes (`BIN_TO_BIN`, `INTER_WAREHOUSE`, `INTER_BRANCH_STO`), 1-Click "Available Stock Picker by Warehouse", multi-stage physical dispatch & logistics tracking, destination material receipt, 1-Click atomic bin transfers, reversible cancellation with stock restitution, and printable statutory CGST Rule 55 Delivery Challans.
- [x] **Step 8.4 — End-to-End Batch & Serial Number 360-Degree Genealogy & Traceability Explorer (`/inventory/traceability`)**: Complete bi-directional 360° genealogy engine (`tbl_inv_batch_master`, `tbl_inv_batch_genealogy`, `tbl_inv_serial_master`) conforming to EN 10204:2004 Type 3.1 & ISO 9001:2015 Clause 8.5.2, featuring universal 360° quick-search with 1-click sample exploration pills, interactive visual Directed Acyclic Graph (DAG) tree, Mill Test Certificate (MTC) quality passport with 8-element chemical composition matrix (% C, Mn, Si, P, S, Cr, Ni, Mo), mechanical tensile & hardness test results, NDE certifications, chronological physical stock movement ledger audit trail, batch & serial master registers, parent-child transformation mapping, and printable statutory EN 10204 Type 3.1 Material Inspection Certificates.
- [x] **Step 8.5 — Inventory Aging, Dead Stock Analysis & Reorder Level Alert Dashboard (`/inventory/aging`)**: Enterprise inventory velocity and statutory provisioning engine (`tbl_inv_stock_provision_header` & `tbl_inv_stock_provision_item`) conforming to Ind AS 2 / AS-2 & CARO 2020 Clause 3(ii), featuring FIFO aging brackets (0-30, 31-60, 61-90, 91-180, 181-365, >365 Days), Fast/Slow/Non-Moving (FSN) velocity matrix, Net Realisable Value (NRV) write-down provisioning reviews, Reorder Point (ROP) & Safety Stock buffer breach console, 1-Click Purchase Requisition (PR) generation bridge, multi-warehouse distribution breakdown, and printable statutory CARO 2020 / Ind AS 2 Inventory Valuation & Provisioning Certificates.

---

## 🛡️ Phase 9: Quality Control & Inspection Management (`QUALITY`)
- [x] **Step 9.1 — In-Process & Stage-Wise Quality Inspection (`/quality/in-process-qc`)**: Operational quality gating engine (`tbl_qc_in_process_header` & `tbl_qc_in_process_param`) compliant with ISO 9001:2015 Clause 8.6 & IATF 16949 Section 8.5.1, featuring 4 inspection stage gates (`FIRST_PIECE` setup approval, `PATROL_INSPECTION` periodic checks, `STAGE_COMPLETION` batch clearance, `LAST_PIECE` tool wear verification), characteristic parameter matrix across 6 inspection categories, 5-point observation sampling with live calculated mean and automatic tolerance pass/fail determination, bidirectional synchronization with shopfloor job cards (`tbl_mfg_job_card`), technical concession / engineering deviation clearance (`DEVIATION`), material disposition actions, CAPA triggers, and printable stage inspection certificates.
- [x] **Step 9.2 — Final Pre-Dispatch Inspection (PDI) & Certificate of Analysis (CoA) (`/quality/pdi`)**: Statutory quality gating & certification engine (`tbl_qc_pdi_header`, `tbl_qc_pdi_param`, `tbl_qc_pdi_coa_spec`) compliant with ISO 9001:2015 Clause 8.6, API Spec Q1 / API 6D, and EN 10204:2004 Type 3.1, featuring 4-tier view tabs (All PDI Lots, Released CoAs, Concessions, Quarantine Holds), characteristic parameter matrix across 6 categories, 8-element ladle chemical analysis matrix, mechanical tensile and impact toughness properties, hydrostatic shell and seat hold pressure test registers, NDE tracking, packaging and anti-rust preservation verification, customer/TPI witness sign-off, digital CoA release authorization (`RELEASE`), and printable statutory EN 10204 Type 3.1 Inspection Certificates with 3-tier authorized signatures.
- [x] **Step 9.3 — Non-Conformance Reports (NCR), Material Review Board & CAPA Action Engine (`/quality/ncr`)**:
  - [x] Schema objects (`tbl_qc_ncr_header`, `tbl_qc_ncr_mrb_vote`, `tbl_qc_capa_action`)
  - [x] Multi-source NCR initiation (Inward QC, In-Process QC, PDI, RMA Sales Returns, Customer Audit, Supplier Defect)
  - [x] Material Review Board (MRB) voting & disposition workflow (`SCRAP`, `REWORK`, `USE_AS_IS_CONCESSION`, `RETURN_TO_VENDOR`)
  - [x] 8D Problem Solving Methodology / 5-Why root cause analysis engine
  - [x] Preventive action assignment with target completion dates and verification sign-off
- [x] **Step 9.4 — Gauge, Tool & Measuring Instrument Calibration Register (`/quality/calibration`)**:
  - [x] Schema objects (`tbl_qc_gauge_master`, `tbl_qc_gauge_calibration_history`)
  - [x] Instrument master (Vernier, Micrometer, Dial Indicator, Pressure Gauges, Torque Wrenches, CMM, Weighing Scales)
  - [x] Periodic calibration scheduler (monthly, quarterly, annual) with automated due-date alerts
  - [x] Calibration certificate upload, error limit drift monitoring, and expired instrument lockout (`OUT_OF_TOLERANCE_LOCKED`)

---

## 💼 Phase 10: Financial Accounting & Statutory Compliance (`ACCOUNTS`)
- [x] **Step 10.1 — Chart of Accounts (COA) & General Ledger (GL) Subsystem (`/accounts/gl`)**:
  - [x] 5-Level Chart of Accounts (Assets, Liabilities, Equity, Revenue, Expense) with multi-company & branch cost centers
  - [x] Automated sub-ledger journal voucher posting from operational events (Purchase Invoices, Sales Invoices, Inventory Adjustments, Absorption Costing)
  - [x] Financial statements: Trial Balance, Profit & Loss (P&L), Balance Sheet
- [x] **Step 10.2 — Accounts Payable (AP) & Accounts Receivable (AR) Cash/Bank Reconciliation (`/accounts/banking`)**:
  - [x] Vendor payment disbursement vouchers (Cheque, NEFT, RTGS) with TDS deduction tracking
  - [x] Customer payment collection receipts with bank reconciliation statements (BRS)
- [ ] **Step 10.3 — Direct GST Portal & E-Way Bill API Gateway (`/admin/integrations/gst`)**:
  - [ ] Machine-to-machine direct API integration with NIC E-Way Bill and E-Invoice portal via GSP for 1-click live IRN and E-Way Bill generation without manual JSON uploads

---

## 🛠️ Phase 11: Plant Maintenance (CMMS) & Shopfloor Mobile PDA App (`OPERATIONS`)
- [ ] **Step 11.1 — Computerized Maintenance Management System (CMMS) (`/maintenance`)**:
  - [ ] Preventative maintenance schedules (running hours / calendar-based)
  - [ ] Breakdown work tickets, machine downtime logs, MTBF & MTTR calculation
  - [ ] Maintenance spare parts requisition & stock consumption
- [ ] **Step 11.2 — Shopfloor Mobile Scanner / Handheld Terminal App (Android & iOS)**:
  - [ ] Native camera-based 1D/2D barcode & QR scanner interface connected to `/api/v1/*`
  - [ ] Real-time dock receiving GRN scanning, bin put-away confirmation, lineside picking, and cycle count auditing
- [ ] **Step 11.3 — Advanced Visual Finite Capacity Scheduling & Gantt Board (`/manufacturing/scheduling`)**:
  - [ ] Interactive drag-and-drop Gantt chart visualizer for Work Orders and Job Cards across machine work centers with live maintenance conflict warnings
