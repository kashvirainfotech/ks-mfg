# AI Agents & Developer Engineering Rules (KS-MFG)

**Document Version:** 1.2.0  
**Scope:** Mandatory rules and guidelines for AI Agents (Antigravity, Copilot, Cursor) and Software Engineers working on KS-MFG.  

---

## 1. Prime Directives (Non-Negotiable)

### 1.1 Incremental Delivery: One Screen/Feature at a Time with Cross-Feature Impact Analysis
* The user will instruct development step-by-step: **one screen or feature at a time**.
* The agent/developer must implement that requested screen/feature **fully and completely** (end-to-end: SQL scripts, backend modules, validation, permissions, and frontend UI).
* **Cross-Feature Impact Assessment:** Before writing code, the agent must evaluate and preserve the impact on other existing or future screens/features (e.g., changes to Item Master UOM or Batch tracking flags impact Inward GRN, Inventory Ledger, Production Material Issue, Sales Dispatch, and Valuation). Never build a feature in isolation that breaks or complicates adjacent workflows.

### 1.2 Component-Based Architecture & Generic Component Pre-Approval Checkpoint
* The frontend UI must be strictly **component-based** and modular (modular widgets, atomic dialogs, specialized form inputs).
* > [!IMPORTANT]
  > **MANDATORY APPROVAL CHECKPOINT:**
  > As far as possible, the UI must be component-based. However, **before creating any generic/shared component** (e.g., a generic DataGrid wrapper, generic dynamic unit input, generic barcode scanner widget, generic voucher header, or generic tree picker), **the agent MUST ask the user first** and obtain explicit approval before creating it.
  > The proposal must outline the component's purpose, prop interface, and why making it generic is advantageous.

### 1.3 Mandatory Living Manuals Update for Every Screen/Feature
While implementing each screen or feature, two dedicated living manual documents in the `docs/` folder **must be updated immediately**:
1. **User Manual (`docs/user-manual.md`):**
   * Clear, non-technical instructions for plant managers, operators, and clerks.
   * Prerequisites, setup steps, field-by-field guidelines, action button operations (`Print`, `Export`, `Authorize`), and practical tips.
2. **Technical Manual (`docs/technical-manual.md`):**
   * Concise technical architecture for future developers.
   * Tables, sequences, and DDL scripts touched.
   * API endpoints, request/response DTO contracts, and backend services.
   * Frontend components, hooks, stores, and `<PermissionGate>` bindings.
   * Important design decisions, edge cases, and future extension points.

---

## 2. Database Script Rules & Organization (`dbscripts/` Folder)

### 2.1 Development Phase Fresh Database Rule (Only CREATE Statements)
* As this project is currently in the active development phase, all database scripts must contain **ONLY `CREATE` statements** designed to be run manually on a fresh/new PostgreSQL database.
* Do **NOT** generate incremental `ALTER TABLE` migration scripts during this phase. Whenever a table is modified or added, the complete, final `CREATE TABLE` / `CREATE INDEX` / `CREATE SEQUENCE` statement must be maintained in the common schema file.
* Zero automated ORM schema sync is permitted (`drizzle-kit push`, `prisma db push`, `typeorm.synchronize: true` are strictly prohibited).

### 2.2 Tables, Indexes & Sequences: Single Common SQL File
* All tables, indexes, and sequences must be maintained in **one common `.sql` file** located inside the root `dbscripts/` directory:
  $$\text{dbscripts/01\_schema\_objects.sql}$$
* **Append at End Rule:** Whenever a new screen or feature introduces new tables, indexes, or sequences:
  1. Add all new `CREATE` statements at the **very END of `dbscripts/01_schema_objects.sql`**.
  2. Every addition must begin with a clear comment header documenting the Date, Screen/Feature Name, and Brief Description:
  ```sql
  -- ============================================================================
  -- Date: 2026-10-09
  -- Feature / Screen: Warehouse Master & Dynamic Location Hierarchy
  -- Description: Creates tbl_mst_warehouse, seq_warehouse_id, tbl_mst_location_type,
  --              tbl_mst_warehouse_location, and covering B-Tree indexes.
  -- ============================================================================
  CREATE SEQUENCE IF NOT EXISTS seq_warehouse_id START WITH 101 INCREMENT BY 1;
  
  CREATE TABLE IF NOT EXISTS tbl_mst_warehouse (
      ...
  );
  ```

### 2.3 Necessary System Inserts: Single Common SQL File
* All necessary INSERT statements required for the application to function (system configuration parameters, voucher types, standard UOMs, system roles, screen registry, actions, default admin) must reside in a **single `.sql` file** in `dbscripts/`:
  $$\text{dbscripts/02\_initial\_data.sql}$$
* When a screen/feature requires mandatory baseline seed data (e.g. registering a new screen and its action items, adding a new voucher type code), append the INSERT statements to the **END of `dbscripts/02_initial_data.sql`** with Date and Feature comments.

### 2.4 Views, Functions, Triggers & Procedures: Individual Object Files
* Database objects like views, functions, triggers, and stored procedures must **NOT** be placed in the common schema file.
* Instead, they must have **individual `.sql` files for each separate object** placed inside dedicated subfolders in `dbscripts/`:
  * `dbscripts/views/<view_name>.sql`
  * `dbscripts/functions/<function_name>.sql`
  * `dbscripts/triggers/<trigger_name>.sql`
  * `dbscripts/procedures/<procedure_name>.sql`
* Example:
  * Trigger function updating `updated_date`: `dbscripts/functions/fn_set_updated_timestamp.sql`
  * Trigger binding to table: `dbscripts/triggers/trg_tbl_mst_company_updated_date.sql`
  * Complex stock valuation view: `dbscripts/views/vw_inv_current_stock_balance.sql`

### 2.5 Screen/Feature Sample & Demo Data: Single Common SQL File
* For each screen or feature implemented, realistic sample data for testing and client demonstration must be provided.
* All sample data must be appended to a **single `.sql` file** in `dbscripts/`:
  $$\text{dbscripts/03\_sample\_demo_data.sql}$$
* Always append at the end with a date and screen/feature header block, ensuring foreign key references match existing sample records.

### 2.6 Primary Key & Sequence Convention
* **Never use UUIDs as primary keys.**
* Every table primary key must be named `<singular_entity>_id` (e.g., `user_id`, `party_id`, `comp_id`, `branch_id`, `item_id`, `voucher_id`).
* All primary keys must draw values from a dedicated PostgreSQL sequence named `seq_<singular_entity>_id`:
  ```sql
  CREATE SEQUENCE IF NOT EXISTS seq_party_id START WITH 1001 INCREMENT BY 1;
  
  CREATE TABLE tbl_mst_party (
      party_id BIGINT PRIMARY KEY DEFAULT nextval('seq_party_id'),
      ...
  );
  ```

### 2.7 Mandatory Seven Standard Audit & Multi-Tenancy Columns
Every table created in the database without exception must include these exact 7 columns:
```sql
comp_id        BIGINT       NOT NULL,
branch_id      BIGINT       NOT NULL,
fyear_id       BIGINT,                      -- Mandatory in voucher headers & transaction tables
created_by     BIGINT       NOT NULL,
created_date   TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
updated_by     BIGINT,
updated_date   TIMESTAMPTZ
```

---

## 3. UI/UX Design Standards & Industry Best Practices

### 3.1 Modern Web ERP Aesthetics & Ergonomics
* **Latest Industry Trends:** Adopt clean, modern enterprise design paradigms (similar to modern SaaS leaders like Linear, Stripe, and SAP S/4HANA Fiori modern web suites).
* **High Information Density:** Manufacturing operators manage large orders and complex multi-line receipts; prioritize compact spacing, clear typography, and minimal unnecessary padding.
* **Ergonomic Data Entry:**
  * Full keyboard accessibility for rapid voucher entry (`Tab` navigation between cells, `Enter` to commit line items, `Esc` to dismiss modals).
  * Auto-focusing on the first input of forms and dialogs.
  * Searchable autocompletes with debounced backend lookups for 10,000+ item and party catalogs.
* **Responsive & Adaptive:** Optimized for 1080p and 1440p desktop displays, with responsive degradation for tablets and mobile viewing.
* **Consistent Status Indicators & Badges:** Unified color semantics across all screens:
  * Draft: Slate / Neutral
  * Pending Approval: Amber / Warning
  * Approved / Completed: Emerald / Success
  * Rejected / Cancelled: Rose / Destructive
  * QC Quarantine: Violet / Purple

---

## 4. Backend Engineering Guidelines (NestJS)

### 4.1 Layered Separation of Concerns
1. **Controllers:**
   * Pure routing, request extraction, and DTO validation.
   * Apply OpenAPI/Swagger decorators (`@ApiOperation`, `@ApiResponse`).
   * Apply security guards (`@UseGuards(AuthGuard, PermissionsGuard)`).
   * **Rule:** Never execute business logic, database queries, or multi-unit conversions directly inside a Controller.
2. **Services:**
   * Contain all business logic, workflow transitions, unit conversion formulas, and transaction boundaries.
   * Coordinate between repositories, Redis caching, and notification dispatchers.
3. **Database Layer (Drizzle ORM):**
   * Acts purely as a type-safe SQL query builder and data mapper.
   * Do not declare auto-generating schema sync decorators.
4. **Middlewares, Guards & Interceptors:**
   * `CorrelationIdMiddleware`: Assigns a unique UUID to every request via `AsyncLocalStorage`.
   * `PinoHttpLogger`: Structured JSON logging with tenant context and latency.
   * `AuthGuard`: Validates short-lived JWT access tokens.
   * `TenantGuard`: Enforces that `comp_id` and `branch_id` in the request match user permissions.
   * `PermissionsGuard`: Enforces screen-level (`can_view`, `can_add`, `can_edit`, `can_delete`) and action-level (`PRINT`, `EXPORT`, `AUTHORIZE`, `CANCEL`, `REOPEN`) authorizations.

### 4.2 Security, Tokens & Authentication Rules
* **Dual-Token System:**
  * Access Token (JWT): 15-minute lifespan. Sent in `Authorization: Bearer <token>` or parsed from secure context.
  * Refresh Token: 7-day lifespan. Must be transmitted in `httpOnly`, `Secure`, `SameSite=Strict` cookies (with header fallback for mobile clients).
* **Redis Token Blacklist:**
  * Every token payload contains a unique `sessionId`.
  * User logout or administrative deactivation writes `sessionId` to Redis with TTL matching remaining token lifespan.
* **Password Hashing:**
  * Always use `Argon2id` or `bcrypt` with a minimum of 12 salt rounds. Plaintext passwords must never be logged or persisted.

### 4.3 Voucher Number Generation & Sequence Concurrency
* **Voucher Type Codes:** Always use defined integer codes (e.g., PO = 1, GRN = 2, PI = 3, SO = 5, DC = 6, SI = 7, BTI = 11, BTR = 12, JWI = 21, JWR = 22, BOM = 31, PWO = 32, MIS = 33, PRN = 34).
* **Zero-Collision Rule:**
  * Sequence generation **must** run within a PostgreSQL database transaction (`trx`).
  * Acquire a row lock on `tbl_trn_voucher_sequence_tracker` using `SELECT ... FOR UPDATE` filtered by `(comp_id, branch_id, fyear_id, voucher_type_id)`.
  * Increment the counter, generate formatted string (e.g., `PO/PUN/26-27/000042`), and persist within the transaction.

### 4.4 Error Handling & JSON Response Standard
All API endpoints must return standardized JSON payloads:
```typescript
// Success Response
{
  "success": true,
  "data": { ... },
  "message": "Purchase Order created successfully",
  "meta": { "timestamp": "2026-10-08T18:30:00Z", "correlationId": "..." }
}

// Error Response (via Global Exception Filter)
{
  "success": false,
  "errorCode": "INSUFFICIENT_STOCK",
  "message": "Available stock in Bin B-12 is 14.5 Kgs; requested 20.0 Kgs",
  "details": [ ... ],
  "timestamp": "2026-10-08T18:30:00Z",
  "correlationId": "..."
}
```

---

## 5. Dynamic Configuration & Feature Gate Rules

### 5.1 Parameter Cascading Inheritance
When resolving any configuration parameter `PARAM_KEY`:
1. Check User-specific override in `tbl_cfg_user_override`.
2. If null, check Branch-specific override in `tbl_cfg_branch_override`.
3. If null, check Company-specific default in `tbl_cfg_company_override`.
4. If null, return hardcoded system default from `tbl_cfg_parameter_master`.

### 5.2 Feature-Flag Hard Guarding
If a feature parameter (such as `ENABLE_DUAL_UNIT`, `ENABLE_BATCH_TRACKING`, or `ENABLE_SERIAL_TRACKING`) is evaluated as `false`:
* The backend API **must reject** incoming transactions containing non-null secondary units, batch details, or serial allocations with an appropriate error code (e.g., `FEATURE_DISABLED`).
* The frontend UI **must hide or disable** the corresponding tabs, switches, and input columns.

---

## 6. Frontend Engineering Guidelines (React 19, Vite, TypeScript)

### 6.1 Strict Typing & Architecture
* **Strict TypeScript:** Set `"strict": true` in `tsconfig.json`. Use of `any` is strictly prohibited. Use explicit types or `unknown` with type guards.
* **Component Architecture:**
  * Clean component boundaries.
  * Use Shadcn UI primitives for inputs, dialogs, dropdowns, and buttons.
  * Use React Hook Form + Zod for all form validation.

### 6.2 Declarative Permission Enforcing
* Every UI action button representing a sensitive business capability (Print, Export, Authorize, Cancel, Reopen) **must** be wrapped in `<PermissionGate>`:
```tsx
<PermissionGate screen="PURCHASE_ORDER" action="AUTHORIZE">
  <Button onClick={onAuthorize}>Authorize</Button>
</PermissionGate>
```
* If the active user lacks permission in the currently selected branch, the component must hide the button or render a disabled button with an informative tooltip based on the `fallback` prop.

### 6.3 High-Density Manufacturing Grids
* Line item tables in vouchers (Purchase Orders, GRNs, Production Issues) must support keyboard navigation (`Tab` to next cell, `Enter` to commit row).
* Dynamically compute base quantity:
  $$\text{base\_qty} = \text{trans\_qty} \times \text{conversion\_factor}$$
  with immediate live calculation in the grid.

---

## 7. Dynamic Warehouse Location Rules

* Support arbitrary physical storage depths per branch/warehouse:
  * Chamber $\rightarrow$ Rack $\rightarrow$ Bin
  * Unit $\rightarrow$ Chamber $\rightarrow$ Rack $\rightarrow$ Bin
  * Floor $\rightarrow$ Block $\rightarrow$ Rack $\rightarrow$ Bin
  * Single Level Location
* Persist dynamic location hierarchy using Adjacency List + Materialized Path (`path_string` e.g., `/1/14/82/`).
* Location types (`General`, `QC`, `Quarantine`, `Damaged`, `WIP`, `Scrap`) can be mapped to any node level in the tree.
* Stock deposited in locations flagged as `is_allocatable = false` (e.g., QC, Quarantine, Damaged) must never be picked for Production Material Issues or Sales Delivery Challans.

---

## 8. Summary of File & Folder Map

```
ks-mfg/
├── dbscripts/                                # Root folder for all database scripts
│   ├── 01_schema_objects.sql                 # ALL tables, indexes, sequences (CREATE only)
│   ├── 02_initial_data.sql                   # ALL necessary system setup & seed inserts
│   ├── 03_sample_demo_data.sql               # Single file for sample demo data per screen/feature
│   ├── views/                                # Individual .sql for each view
│   ├── functions/                            # Individual .sql for each function
│   ├── triggers/                             # Individual .sql for each trigger
│   └── procedures/                           # Individual .sql for each stored procedure
├── docs/                                     # Documentation folder
│   ├── agents.md                             # Rules for agents & developers
│   ├── plan.md                               # Phased implementation plan
│   ├── requirements.md                       # Comprehensive system requirements
│   ├── task-wise-checklist.md                # Task-wise implementation checklist
│   ├── tech-stack.md                         # Tech-stack decision log
│   ├── user-manual.md                        # Living end-user operational manual
│   └── technical-manual.md                   # Living technical developer reference
├── backend/                                  # NestJS backend application
└── frontend/                                 # Vite + React 19 + TypeScript frontend
```
