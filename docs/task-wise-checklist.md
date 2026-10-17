# Task-Wise Implementation Checklist (KS-MFG)

**Document Version:** 1.0.0  
**Project:** KS-MFG Web ERP (Phase 1) & Mobile API Parity  
**Usage:** Progress tracking across development sprints. Mark tasks with `[x]` upon completion and peer review.

---

## Phase 1: Database Foundation, Tenancy Core & Infrastructure

### 1.1 Database Scripts & Schema Setup (`dbscripts/` Root Folder)
- [x] Verify root folder structure `dbscripts/`, `dbscripts/views/`, `dbscripts/functions/`, `dbscripts/triggers/`, `dbscripts/procedures/`
- [x] In `dbscripts/01_schema_objects.sql`:
  - [x] Create core sequences (`seq_comp_id`, `seq_branch_id`, `seq_fyear_id`, `seq_user_id`, `seq_role_id`, `seq_screen_id`, `seq_action_id`, `seq_audit_id`)
  - [x] Create `tbl_org_company` (with standard 7 audit columns)
  - [x] Create `tbl_org_branch` (with standard 7 audit columns)
  - [x] Create `tbl_org_financial_year` (`fyear_id`, `fyear_code`, `start_date`, `end_date`, `is_closed`)
  - [x] Create `tbl_org_branch_fyear` mapping table for branch-level financial year activation and locking
  - [x] Create `tbl_sec_user_preference` for user theme mode and theme color preferences
  - [x] Create `tbl_sys_audit_log` (`audit_id`, `comp_id`, `branch_id`, `user_id`, `screen_code`, `action_type`, `entity_table`, `record_id`, `changed_fields` JSONB, `old_value` JSONB, `new_value` JSONB, `ip_address`, `user_agent`, `created_date`)
- [x] In `dbscripts/functions/fn_set_updated_timestamp.sql`:
  - [x] Create trigger function updating `updated_date` automatically
- [x] In `dbscripts/triggers/trg_set_updated_timestamp.sql`:
  - [x] Create trigger binding for company and branch tables
- [x] In `dbscripts/02_initial_data.sql`:
  - [x] Add root Super Admin user seed (`admin` / `Admin@123`) unmapped to employee/party
  - [x] Add default system parameters and initial screen codes

### 1.2 Backend Framework Setup (NestJS & Drizzle ORM)
- [x] Initialize NestJS project with TypeScript strict mode
- [x] Configure environment variable management (`@nestjs/config`) with `.env.example`
- [x] Configure Drizzle ORM in strict non-sync query builder mode
  - [x] Verify `drizzle-kit push` and auto-sync are disabled
  - [x] Establish connection pool with `pg` driver
  - [x] Create schema mapping classes matching reviewed SQL tables
- [x] Set up structured logging and Correlation ID middleware
- [x] Set up global `AuditLogInterceptor` for automated activity logging and JSONB field-level change deltas
- [x] Set up `DependencyCheckService` to verify foreign references before any master or transaction deletion
- [x] Configure Redis client for session tokens and cache management
- [x] Set up Zod schema validation for DTOs
- [x] Set up global `AllExceptionsFilter` and `ResponseEnvelopeInterceptor` for standardized JSON responses

### 1.3 Frontend Framework Setup (Vite + React 19 + TypeScript)
- [x] Initialize Vite React TypeScript project
- [ ] Install and configure Tailwind CSS and `tailwind.config.ts` with CSS variable design tokens
- [ ] Configure Theme Engine with Light and Dark mode support (`next-themes` / ThemeProvider)
- [ ] Configure Dynamic Theme Color system (Zinc, Blue, Indigo, Violet, Emerald, Amber, Rose) via `data-theme-color` attribute
- [ ] Configure Shadcn UI component library and Radix UI primitives
- [ ] Set up TanStack Query (React Query) provider with default stale-time policies
- [ ] Set up Zustand client stores (session, active company, active branch, theme preferences)
- [ ] Set up React Router (or TanStack Router) with protected layout routes
- [ ] Configure Axios / Fetch API client with automatic token attachment and refresh interceptors

---

## Phase 2: Organization Hierarchy, Users Management, Global Roles & Granular RBAC

### 2.1 Database Scripts (`dbscripts/`)
- [ ] In `dbscripts/01_schema_objects.sql` (appended at end with date & comment header):
  - [ ] Create `tbl_mst_department`
  - [ ] Create `tbl_mst_designation`
  - [ ] Create `tbl_mst_employee` (with self-referencing reporting manager)
  - [ ] Create `tbl_sec_user` (`user_id`, `username`, `email`, `mobile_no`, `password_hash`, `user_type` ENUM: `EMPLOYEE`/`PARTY`, `ref_id`, `is_active`)
  - [ ] Create `tbl_sec_role` (Global definition independent of company/branch)
  - [ ] Create `tbl_sec_screen` (`screen_id`, `screen_code`, `module_name`, `route_path`)
  - [ ] Create `tbl_sec_action_item` (`action_id`, `action_code`, `action_name` e.g., `PRINT`, `EXPORT`, `AUTHORIZE`, `CANCEL`, `REOPEN`)
  - [ ] Create `tbl_sec_screen_action` mapping screen to eligible actions
  - [ ] Create `tbl_sec_role_screen_permission` (`role_id`, `screen_id`, `can_view`, `can_add`, `can_edit`, `can_delete`)
  - [ ] Create `tbl_sec_role_action_permission` (`role_id`, `screen_id`, `action_id`, `is_allowed`)
  - [ ] Create `tbl_sec_user_company_role` mapping `(user_id, comp_id, role_id)`
  - [ ] Create `tbl_sec_user_branch_role` mapping `(user_id, comp_id, branch_id, role_id)`
  - [ ] Create `tbl_sec_user_session` (for active refresh tokens and device metadata)
- [ ] In `dbscripts/02_initial_data.sql`:
  - [ ] Append initial global roles ("Super Admin", "Branch Manager", "QC Inspector", "Inventory Operator", "Billing Clerk")
  - [ ] Append initial screen definitions and standard action items
- [ ] In `dbscripts/03_sample_demo_data.sql`:
  - [ ] Append sample company, branches, departments, designations, employees, parties, and demo users

### 2.2 Backend APIs
- [ ] Implement Authentication Module:
  - [ ] `POST /api/v1/auth/login` (Returns short-lived access token + sets `httpOnly` refresh token cookie)
  - [ ] `POST /api/v1/auth/refresh` (Rotates refresh token and issues new access token)
  - [ ] `POST /api/v1/auth/logout` (Blacklists session in Redis and clears cookie)
  - [ ] `POST /api/v1/auth/switch-branch` (Validates branch assignment, switches active branch in token)
- [ ] Implement User Profile & Theme Preferences API:
  - [ ] `GET /api/v1/users/profile/preferences`
  - [ ] `PUT /api/v1/users/profile/preferences` (Updates theme mode: Light/Dark/System and theme color)
- [ ] Implement Organization & Employee Endpoints:
  - [ ] Department CRUD (`/api/v1/departments`) with pre-deletion dependency check
  - [ ] Designation CRUD (`/api/v1/designations`) with pre-deletion dependency check
  - [ ] Employee CRUD (`/api/v1/employees`) with pre-deletion dependency check
- [ ] Implement User Management Endpoints:
  - [ ] User CRUD (`/api/v1/users`) enforcing mandatory persona mapping (`EMPLOYEE` vs `PARTY`)
  - [ ] User Company-Role Assignment endpoint (`POST /api/v1/users/:id/company-roles`)
  - [ ] User Branch-Role Assignment endpoint (`POST /api/v1/users/:id/branch-roles`)
  - [ ] User Effective Permissions endpoint (`GET /api/v1/users/me/permissions`)
- [ ] Implement Global Role Management Endpoints (`/api/v1/roles`)
- [ ] Implement RBAC Security Guards:
  - [ ] `AuthGuard` (Verifies JWT access token)
  - [ ] `TenantGuard` (Ensures `comp_id` and `branch_id` context match user claims)
  - [ ] `PermissionsGuard` (Validates screen and action permissions against active branch roles)

### 2.3 Frontend Screens & Components
- [ ] Build Theme Switcher & Color Customizer in User Profile screen
- [ ] Build Login Screen with modern layout and validation
- [ ] Build Top Navigation Bar with Company & Branch Context Switcher dropdown
- [ ] Build Department, Designation, and Employee Master Management screens
- [ ] Build User Management UI:
  - [ ] User Creation Dialog with Radio Buttons for User Type (`Employee` vs `Party`)
  - [ ] Dynamic conditional dropdown: Shows Employee autocomplete if Employee selected; Shows Party autocomplete if Party selected
  - [ ] Company-Role and Multi-Branch Role Assignment Matrix
- [ ] Build Screen & Action Item Permission Management UI:
  - [ ] Global Role editor with screen permission matrix (View, Add, Edit, Delete checkboxes)
  - [ ] Action item permission sub-matrix (Print, Export, Authorize, Cancel checkboxes)
- [ ] Build Activity Trail & Audit Log viewer dialog/drawer (shows field-level before/after diffs)
- [ ] Create reusable `<PermissionGate>` component to wrap UI buttons

---

## Phase 3: Dynamic Parameter Engine & Dynamic Multi-Level Warehouses

### 3.1 Database Scripts
- [ ] Author `005_config_parameters.sql`
  - [ ] Create `tbl_cfg_parameter_master` (`param_id`, `param_code`, `data_type`, `scope_level`, `default_value`, `category`)
  - [ ] Create `tbl_cfg_company_override` (`comp_id`, `param_id`, `param_value`)
  - [ ] Create `tbl_cfg_branch_override` (`comp_id`, `branch_id`, `param_id`, `param_value`)
  - [ ] Create `tbl_cfg_user_override` (`comp_id`, `branch_id`, `user_id`, `param_id`, `param_value`)
- [ ] Author `006_dynamic_warehouses.sql`
  - [ ] Create `tbl_mst_warehouse` (`warehouse_id`, `warehouse_code`, `warehouse_name`, `hierarchy_levels`)
  - [ ] Create `tbl_mst_location_type` (`location_type_id`, `type_code`, `type_name`, `is_allocatable`)
  - [ ] Create `tbl_mst_warehouse_location` (Adjacency list with `parent_location_id`, `level_depth`, `level_name`, `path_string`, `location_type_id`)
- [ ] Author `backend/db/seeds/002_seed_default_configs.sql` with default flags:
  - [ ] `ENABLE_DUAL_UNIT` = false
  - [ ] `ENABLE_BATCH_TRACKING` = false
  - [ ] `ENABLE_SERIAL_TRACKING` = false
  - [ ] `ENABLE_BARCODE_SCANNING` = false
  - [ ] `ALLOW_NEGATIVE_STOCK` = false

### 3.2 Backend Services & APIs
- [ ] Implement Configuration Resolution Engine Service:
  - [ ] Implements fallback cascading: User $\rightarrow$ Branch $\rightarrow$ Company $\rightarrow$ System Default
  - [ ] Redis caching layer for evaluated configurations with bulk invalidation
  - [ ] CRUD endpoints for updating Company, Branch, and User config overrides
  - [ ] API endpoint `GET /api/v1/config/resolved` to load all active parameters for client session
- [ ] Implement Dynamic Warehouse & Location Services:
  - [ ] Warehouse CRUD (`/api/v1/warehouses`)
  - [ ] Location Type CRUD (`/api/v1/location-types`)
  - [ ] Location Node management (Add child node, edit node, move node)
  - [ ] Endpoint `GET /api/v1/warehouses/:id/tree` returning nested JSON hierarchy
  - [ ] Endpoint to map any location level node to a `location_type_id`

### 3.3 Frontend Screens & Components
- [ ] Build Configuration & Parameter Setting Screen:
  - [ ] Dynamic parameter matrix with category tabs (Inventory, Production, Security)
  - [ ] Company-level toggle, Branch-level override toggle, User-level override toggle
  - [ ] Visual indicator showing where a value is inherited from (e.g., "Inherited from Company")
- [ ] Build Warehouse & Dynamic Location Tree Builder Screen:
  - [ ] Tree view component (expand/collapse nodes)
  - [ ] "Add Child Location" dialog supporting arbitrary names (e.g., Chamber, Rack, Bin, Floor, Block)
  - [ ] Dynamic dropdown to assign `Location Type` (General, QC, Quarantine, Damaged, WIP) to any selected node
  - [ ] Visual badges displaying assigned location types on tree nodes

---

## Phase 4: Product Catalog, Dynamic Units, Tracking Flags & Unified Party Master

### 4.1 Database Scripts
- [ ] Author `007_items_and_units.sql`
  - [ ] Create `tbl_mst_uom` (Unit of Measurement Master: `uom_id`, `uom_code`, `uom_name`, `decimal_places`)
  - [ ] Create `tbl_mst_item_group` and `tbl_mst_item_category`
  - [ ] Create `tbl_mst_item` (`item_id`, `item_code`, `item_name`, `item_type`, `base_uom_id`, `has_batch_tracking`, `has_serial_tracking`, `has_dual_unit`, `hsn_code`, `gst_rate`)
  - [ ] Create `tbl_mst_item_uom_conversion` (`item_id`, `secondary_uom_id`, `conversion_factor`, `is_default_purchase_uom`, `is_default_sales_uom`)
- [ ] Author `008_parties_and_pricing.sql`
  - [ ] Create `tbl_mst_party` (`party_id`, `party_code`, `party_name`, `is_customer`, `is_supplier`, `is_job_worker`, `is_transporter`, `pan_no`, `gstin`, `credit_limit`, `credit_days`)
  - [ ] Create `tbl_mst_party_address` (Multiple Billing and Shipping addresses)
  - [ ] Create `tbl_mst_pricelist_hdr` and `tbl_mst_pricelist_dtl` (Standard, Customer Group, and Customer-specific prices)

### 4.2 Backend APIs
- [ ] Implement UOM Master CRUD (`/api/v1/uoms`)
- [ ] Implement Item Master Service & Controller:
  - [ ] Item CRUD endpoints (`/api/v1/items`)
  - [ ] Backend validation: Reject saving `has_dual_unit = true` if `ENABLE_DUAL_UNIT` config is OFF
  - [ ] Backend validation: Reject saving `has_batch_tracking = true` if `ENABLE_BATCH_TRACKING` config is OFF
  - [ ] Backend validation: Reject saving `has_serial_tracking = true` if `ENABLE_SERIAL_TRACKING` config is OFF
  - [ ] Multi-UOM conversion factor management endpoints
- [ ] Implement Unified Party Master Service & Controller:
  - [ ] Party CRUD endpoints (`/api/v1/parties`) supporting filtering by `?type=customer`, `?type=supplier`, `?type=job_worker`
  - [ ] Party Address CRUD endpoints
- [ ] Implement Tiered Pricing Resolution Service:
  - [ ] Price list CRUD endpoints
  - [ ] Evaluation API: `GET /api/v1/pricing/resolve?party_id=X&item_id=Y` resolving customer-specific $\rightarrow$ group $\rightarrow$ standard rate

### 4.3 Frontend Screens & Components
- [ ] Build UOM Master Screen
- [ ] Build Item Master Creation/Edit Screen:
  - [ ] Base Unit selection (mandatory)
  - [ ] Conditional UI: Multi-Unit tab displayed **only if** `ENABLE_DUAL_UNIT` is active
  - [ ] Conditional UI: Batch Tracking switch displayed **only if** `ENABLE_BATCH_TRACKING` is active
  - [ ] Conditional UI: Serial Tracking switch displayed **only if** `ENABLE_SERIAL_TRACKING` is active
  - [ ] Secondary UOM conversion table editor (e.g., 1 Box = 50 Pcs)
- [ ] Build Unified Party Master Screen:
  - [ ] Role flags checkboxes (`Customer`, `Supplier`, `Job Worker`, `Transporter`)
  - [ ] Dynamic address grid (Billing, Shipping with GSTIN & State Code)
- [ ] Build Price List Management Screen:
  - [ ] Price list header editor (scope: General, Region, Customer Group, Customer)
  - [ ] Excel-like data grid to bulk-set item prices

---

## Phase 5: Transaction & Voucher Engine & Sequence Reset Utility

### 5.1 Database Scripts
- [ ] Author `009_voucher_framework.sql`
  - [ ] Create `tbl_mst_voucher_type` (`voucher_type_id` INT, `voucher_type_code`, `voucher_type_name`, `category`)
  - [ ] Create `tbl_trn_voucher_sequence_tracker` (`comp_id`, `branch_id`, `fyear_id`, `voucher_type_id`, `prefix`, `current_seq`, `padding_digits`, `suffix`, `last_generated_no`)
  - [ ] Insert unique constraint on `(comp_id, branch_id, fyear_id, voucher_type_id)` in sequence tracker
- [ ] Author `backend/db/seeds/001_seed_voucher_types.sql`:
  - [ ] PO = 1, GRN = 2, PI = 3, SQ = 4, SO = 5, DC = 6, SI = 7
  - [ ] BTI = 11, BTR = 12, WBT = 13
  - [ ] JWI = 21, JWR = 22
  - [ ] BOM = 31, PWO = 32, MIS = 33, PRN = 34
  - [ ] STK_ADJ = 41, SCRAP = 42

### 5.2 Backend Services & APIs
- [ ] Implement Atomic Voucher Sequence Generator Service:
  - [ ] `generateNextVoucherNo(compId, branchId, fyearId, voucherTypeId, trx)`
  - [ ] Uses PostgreSQL row-level lock `SELECT ... FOR UPDATE` on sequence tracker row
  - [ ] Increments `current_seq` and formats voucher number string (e.g., `PO/PUN/26-27/000042`)
  - [ ] Returns generated number within the same active database transaction
- [ ] Implement Sequence Configuration & Reset Service:
  - [ ] Endpoint `GET /api/v1/voucher-sequences` (Filter by branch and financial year)
  - [ ] Endpoint `POST /api/v1/voucher-sequences/reset` (Resets counter with admin audit logging)
  - [ ] Endpoint `PUT /api/v1/voucher-sequences/:id` (Updates prefix, suffix, and padding)

### 5.3 Frontend Screens & Components
- [ ] Build Voucher Sequence Reset & Management Screen:
  - [ ] Branch and Financial Year selector
  - [ ] Table listing all Voucher Types with current sequence, prefix, and last generated voucher number
  - [ ] Edit Prefix / Suffix modal
  - [ ] "Reset Sequence" action with confirmation dialog and warning prompt

---

## Phase 6: Procurement Lifecycle & Multi-Level Bin Put-Away

### 6.1 Database Scripts
- [ ] Author `010_procurement_transactions.sql`
  - [ ] Create `tbl_trn_purchase_order_hdr` (with standard 7 audit columns + `fyear_id`, `voucher_no`, `voucher_type_id = 1`)
  - [ ] Create `tbl_trn_purchase_order_dtl` (`item_id`, `trans_uom_id`, `trans_qty`, `conversion_factor`, `base_qty`, `base_uom_id`, `unit_rate`, `tax_amount`, `total_amount`)
  - [ ] Create `tbl_trn_grn_hdr` (`voucher_type_id = 2`, `po_id`, `vendor_invoice_no`, `vendor_invoice_date`)
  - [ ] Create `tbl_trn_grn_dtl` (`item_id`, `trans_uom_id`, `trans_qty`, `base_qty`, `accepted_qty`, `rejected_qty`)
  - [ ] Create `tbl_trn_grn_bin_allocation` (`grn_dtl_id`, `warehouse_id`, `location_id`, `allocated_qty`, `batch_no`, `serial_no`, `mfg_date`, `expiry_date`)
  - [ ] Create `tbl_trn_purchase_invoice_hdr` & `tbl_trn_purchase_invoice_dtl` (`voucher_type_id = 3`)

### 6.2 Backend APIs
- [ ] Implement Purchase Order Service & Controller (`/api/v1/purchase-orders`)
  - [ ] Save draft, submit, approve, print, export endpoints with RBAC guards
- [ ] Implement Goods Receipt Note (GRN) Service & Controller (`/api/v1/grn`):
  - [ ] Inward receipt against PO or direct receipt
  - [ ] Validate dynamic unit conversion (`trans_qty * conversion_factor = base_qty`)
  - [ ] Validate batch and serial mandatory fields if item has corresponding flags active
  - [ ] Validate warehouse location IDs against dynamic location hierarchy
  - [ ] Automatically route items to Non-Allocatable inventory if location has QC/Quarantine type
- [ ] Implement Purchase Invoice 3-Way Match Service (`/api/v1/purchase-invoices`)

### 6.3 Frontend Screens & Components
- [ ] Build Purchase Order Entry Screen:
  - [ ] Supplier autocomplete (filtered by `is_supplier = true`)
  - [ ] High-density line items grid (Item, Trans Unit dropdown, Trans Qty, Conv Factor, Base Qty, Rate, Tax)
  - [ ] Action buttons: Save Draft, Submit, Authorize (wrapped in `<PermissionGate screen="PO" action="AUTHORIZE">`), Print, Export
- [ ] Build Inward GRN Entry Screen:
  - [ ] PO lookup and pending balance loader
  - [ ] Bin Put-Away Modal: Interactive dynamic tree selector to pick destination Chamber/Rack/Bin
  - [ ] Conditional Batch modal (Mfg Date, Exp Date, Batch No) if item is batch-tracked
  - [ ] Conditional Serial Numbers input (manual entry or CSV/barcode paste) if item is serial-tracked
- [ ] Build Purchase Invoice Verification & Booking Screen

---

## Phase 7: Manufacturing Lifecycle & 3rd-Party Subcontracting (Job-Work)

### 7.1 Database Scripts
- [ ] Author `011_manufacturing_tables.sql`
  - [ ] Create `tbl_mfg_bom_hdr` & `tbl_mfg_bom_dtl` (`voucher_type_id = 31`, output FG item, input components, scrap %)
  - [ ] Create `tbl_mfg_routing` & `tbl_mfg_routing_operation` (Operations, work centers, cycle times)
  - [ ] Create `tbl_trn_production_work_order` (`voucher_type_id = 32`, planned qty, start/end dates)
  - [ ] Create `tbl_trn_material_issue_hdr` & `dtl` (`voucher_type_id = 33`, source bin $\rightarrow$ shopfloor WIP)
  - [ ] Create `tbl_trn_fg_receipt_hdr` & `dtl` (`voucher_type_id = 34`, WIP relief $\rightarrow$ destination FG bins)
- [ ] Author `012_subcontracting_tables.sql`
  - [ ] Create `tbl_trn_jobwork_challan_hdr` & `dtl` (`voucher_type_id = 21`, party_id, challan_no, dispatch items)
  - [ ] Create `tbl_trn_jobwork_receipt_hdr` & `dtl` (`voucher_type_id = 22`, received processed items, consumed RM, scrap returned, vendor service charges)

### 7.2 Backend APIs
- [ ] Implement BOM & Routing Management Service (`/api/v1/manufacturing/bom`)
- [ ] Implement Production Work Order Service (`/api/v1/manufacturing/work-orders`)
- [ ] Implement Material Issue Service (`/api/v1/manufacturing/material-issues`):
  - [ ] Deducts Raw Material stock from source bin
  - [ ] Credits WIP Floor Account
  - [ ] Validates batch/serial availability in source bin
- [ ] Implement Finished Goods Receipt Service (`/api/v1/manufacturing/fg-receipts`):
  - [ ] Relieves WIP inventory
  - [ ] Credits FG inventory in destination warehouse bins
  - [ ] Generates batch/serial numbers for newly minted finished goods
- [ ] Implement Subcontracting (Job-Work) Services:
  - [ ] Job-Work Delivery Challan endpoints (`/api/v1/subcontracting/challans`)
  - [ ] Job-Work Receipt Note endpoints (`/api/v1/subcontracting/receipts`)
  - [ ] Track outstanding vendor job-work material balances

### 7.3 Frontend Screens & Components
- [ ] Build BOM & Recipe Designer Screen (Interactive tree showing finished good with child raw materials & scrap)
- [ ] Build Production Work Order Management Screen
- [ ] Build Material Issue to Shopfloor Screen:
  - [ ] Pick-list assistant showing available stock in dynamic bins
  - [ ] Batch/Serial picker modal
- [ ] Build Finished Goods Receipt Screen (With automatic batch generation and bin put-away)
- [ ] Build Job-Work Challan Dispatch Screen (Vendor selection, item dispatch, delivery challan printout)
- [ ] Build Job-Work Material Receipt Screen (Record processed output, process wastage, vendor bill amount)

---

## Phase 8: Inventory Ledger, Valuation & Analytics

### 8.1 Database Scripts
- [ ] Author `013_inventory_ledger.sql`
  - [ ] Create `tbl_inv_stock_ledger` (Immutable double-entry inventory ledger: `ledger_id`, `comp_id`, `branch_id`, `fyear_id`, `voucher_type_id`, `voucher_id`, `voucher_no`, `item_id`, `warehouse_id`, `location_id`, `batch_no`, `serial_no`, `in_trans_qty`, `out_trans_qty`, `trans_uom_id`, `in_base_qty`, `out_base_qty`, `base_uom_id`, `unit_cost`, `total_cost`, `is_allocatable`)
  - [ ] Create `tbl_inv_batch_master` (`batch_id`, `item_id`, `batch_no`, `mfg_date`, `expiry_date`, `status`)
  - [ ] Create `tbl_inv_serial_master` (`serial_id`, `item_id`, `serial_no`, `current_warehouse_id`, `current_location_id`, `status`)
- [ ] Author `014_indexes_and_triggers.sql`
  - [ ] Composite indexes on `tbl_inv_stock_ledger` for ultra-fast balance lookups
  - [ ] Materialized view or summary table for instantaneous stock balance queries

### 8.2 Backend APIs
- [ ] Implement Stock Balance & Valuation Queries (`/api/v1/inventory/balance`)
  - [ ] Filter by Item, Branch, Warehouse, specific dynamic Location Bin, or Batch
  - [ ] Real-time total base quantity and dual unit breakdown
- [ ] Implement Batch & Serial Traceability API (`/api/v1/inventory/traceability/:batchOrSerial`):
  - [ ] Returns complete genealogy tree: Vendor PO $\rightarrow$ GRN $\rightarrow$ Bin Put-away $\rightarrow$ Production Issue $\rightarrow$ Work Order $\rightarrow$ FG Receipt $\rightarrow$ Sales Invoice
- [ ] Implement Physical Stock Reconciliation endpoints (`/api/v1/inventory/adjustments`)

### 8.3 Frontend Screens & Dashboards
- [ ] Build Real-Time Inventory Balance Grid:
  - [ ] Multi-filter header (Branch, Warehouse, Dynamic Location, Item Group, Stock Status)
  - [ ] Shows Base Stock alongside Alternate Unit quantities
- [ ] Build 360-Degree Batch & Serial Traceability Explorer:
  - [ ] Visual timeline tracing a serial/batch number through every manufacturing and vendor job-work stage
- [ ] Build Stock Aging & Reorder Level Alert Dashboard

---

## Phase 9: Quality Assurance, Security Hardening & Mobile API Verification

### 9.1 Verification & Quality Checks
- [ ] Manual review of all 14 SQL scripts by DBA/Lead Engineer
- [ ] Execute SQL scripts on clean PostgreSQL test database; confirm zero errors and all sequences created
- [ ] Concurrency test on Voucher Sequence Generator (Run 100 concurrent requests; verify zero gaps and zero duplicates)
- [ ] Validate parameter cascading: Verify User override $\rightarrow$ Branch override $\rightarrow$ Company default $\rightarrow$ System default
- [ ] Validate Dynamic Unit conversion accuracy with multi-decimal floating numbers
- [ ] Validate button-level `<PermissionGate>` enforcement on both UI and NestJS API endpoints
- [ ] Execute comprehensive unit and integration test suite

### 9.2 Mobile App API Verification
- [ ] Generate OpenAPI 3.1 specification at `/api/docs-json`
- [ ] Verify all responses return consistent JSON envelopes with HTTP status codes
- [ ] Verify `Authorization: Bearer <token>` header authentication works identically to browser cookies
- [ ] Verify barcode scanner payload ingestion endpoints
- [ ] Package SDK generation scripts for future mobile app engineering team
