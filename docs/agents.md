# AI Agents & Developer Engineering Rules (KS-MFG)

**Document Version:** 1.3.0  
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

### 1.4 User Persona Mapping & Super Admin Seed Exception
* **Mandatory Persona Link:** Every normal user login **must be mapped** to either an **Employee** (`tbl_mst_employee`) or a **Party** (`tbl_mst_party` e.g., Customer, Supplier, Job-Worker). No orphan users are allowed in production.
* **Super Admin Exception:** The initial root Super Admin login (e.g., `admin` / `superadmin`) is the **only exception** and is not tied to an employee or party.
* **Seed Requirement:** The Super Admin user record, its initial password hash, and root role mapping **must be included in `dbscripts/02_initial_data.sql`** as an essential seed required to run and access the web application.

### 1.5 Roles & Multi-Tenancy Assignment Architecture
* **Roles are Independent of Company or Branch:**
  * Role definitions (e.g., "Branch Manager", "Plant Supervisor", "QC Inspector", "Inventory Operator", "Billing Clerk") are **global master records** and are NOT bound to a specific company or branch.
  * Roles hold permissions to screens and specific action items within screens.
* **Users and Roles Mapping:**
  * A user can have **one or more roles**.
  * A user can be mapped to **one or more companies with a role**.
  * A user can be mapped to **one or more branches with a role** (e.g., User X can be "Branch Manager" in Branch A, but "Viewer" in Branch B).

### 1.6 Mandatory Pre-Deletion Dependency Check
* > [!CAUTION]
  > **NEVER perform a blind delete on any master record or transaction voucher.**
* Before deleting any master (e.g. Item, UOM, Department, Employee, Party, Warehouse, Location) or transaction voucher:
  1. The system **must execute a dependency check** querying all related tables (e.g., checking if an Item is referenced in Purchase Orders, BOMs, GRNs, or Stock Ledgers; checking if a Location contains stock or child locations).
  2. If the record is referenced or used anywhere, **the deletion MUST be blocked**.
  3. The system must display a clear, descriptive message to the user explaining where and in which records the entity is currently in use.

### 1.7 Universal Activity & Field-Level Change Tracking
* **Comprehensive Activity Trail:** All user activities across all screens and tables must be tracked:
  * Master additions, edits, and deletions.
  * Transaction additions, edits, deletions/voids, and status transitions.
  * Screen action executions (button clicks for `Print`, `Export`, `Authorize`, `Cancel`, `Reopen`).
* **Field-Level Delta Tracking on Edit:**
  * Whenever a master or transaction record is edited, the system **must capture exactly which fields changed**, recording:
    `field_name`, `old_value`, and `new_value`.
  * Audit logs must be recorded in `tbl_sys_audit_log` with `user_id`, `comp_id`, `branch_id`, `screen_code`, `action_type`, `record_id`, `changed_fields` (JSONB), `old_values` (JSONB), `new_values` (JSONB), IP address, and timestamp.

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
* All necessary INSERT statements required for the application to function (system configuration parameters, voucher types, standard UOMs, system roles, screen registry, actions, and the root Super Admin seed) must reside in a **single `.sql` file** in `dbscripts/`:
  $$\text{dbscripts/02\_initial\_data.sql}$$
* When a screen/feature requires mandatory baseline seed data, append the INSERT statements to the **END of `dbscripts/02_initial_data.sql`** with Date and Feature comments.

### 2.4 Views, Functions, Triggers & Procedures: Individual Object Files
* Database objects like views, functions, triggers, and stored procedures must **NOT** be placed in the common schema file.
* Instead, they must have **individual `.sql` files for each separate object** placed inside dedicated subfolders in `dbscripts/`:
  * `dbscripts/views/<view_name>.sql`
  * `dbscripts/functions/<function_name>.sql`
  * `dbscripts/triggers/<trigger_name>.sql`
  * `dbscripts/procedures/<procedure_name>.sql`

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

## 3. UI/UX Design Standards & Theming

### 3.1 Dual Theme (Light & Dark) Support
* The web application **must support both Light and Dark themes**, adhering to WCAG 2.1 AA contrast standards.
* Seamless switching without page reloads using CSS variables (Tailwind CSS theme tokens).

### 3.2 Dynamic Theme Color & User Profile Personalization
* The UI palette must be driven by a configurable **Theme Color** (e.g. Zinc, Blue, Indigo, Violet, Emerald, Amber, Rose).
* **User Profile Provision:**
  * There must be a dedicated setting in the **User Profile Screen** allowing each user to:
    1. Select their Theme Mode (`Light`, `Dark`, or `System`).
    2. Choose their preferred primary **Theme Color**.
  * The user's preference must be saved in user profile settings in the database, cached locally, and dynamically applied to the application's root theme provider.

### 3.3 Modern Web ERP Aesthetics & Ergonomics
* High information density for manufacturing operations with compact spacing and legible typography.
* Full keyboard accessibility for rapid voucher entry (`Tab` navigation between cells, `Enter` to commit line items, `Esc` to dismiss modals).
* Consistent color semantics for status indicators:
  * Draft: Slate / Neutral
  * Pending Approval: Amber / Warning
  * Approved / Completed: Emerald / Success
  * Rejected / Cancelled: Rose / Destructive
  * QC Quarantine: Violet / Purple

---

## 4. Backend Engineering Guidelines (NestJS)

### 4.1 Layered Separation of Concerns
1. **Controllers:** Pure routing, request extraction, DTO validation. Never write business logic or SQL queries directly in a controller.
2. **Services:** Domain logic, workflow transitions, multi-unit conversions, transaction boundaries, dependency verification before deletion.
3. **Database Layer (Drizzle ORM):** Type-safe SQL query builder and data mapper without auto-sync decorators.
4. **Middlewares, Guards & Interceptors:**
   * `CorrelationIdMiddleware`: Assigns a unique UUID to every request.
   * `PinoHttpLogger`: Structured JSON logging with tenant context and latency.
   * `AuthGuard`: Validates short-lived JWT access tokens.
   * `TenantGuard`: Enforces `comp_id` and `branch_id` matches user access.
   * `PermissionsGuard`: Enforces screen-level and action-item authorizations.
   * `AuditLogInterceptor`: Automatically intercepts mutations (POST, PUT, PATCH, DELETE) and records action trails with field deltas.

### 4.2 Universal Dependency Checking Service
Before executing any `DELETE` operation, services must call a centralized `DependencyCheckService`:
```typescript
await this.dependencyCheckService.verifyCanDelete({
  entity: 'ITEM',
  entityId: itemId,
  relations: [
    { table: 'tbl_trn_purchase_order_dtl', column: 'item_id', label: 'Purchase Orders' },
    { table: 'tbl_mfg_bom_dtl', column: 'item_id', label: 'Bill of Materials' },
    { table: 'tbl_inv_stock_ledger', column: 'item_id', label: 'Stock Ledger Records' },
  ],
});
```
If any relations return count > 0, throw a `DependencyConflictException` containing the detailed breakdown.

### 4.3 Security, Tokens & Authentication Rules
* Dual-token pattern: Short-lived Access Token (15 min) + Rotating Refresh Token (7 days) in `httpOnly`, `Secure`, `SameSite=Strict` cookies.
* Redis token revocation blacklist for instantaneous logout across devices.
* Password hashing with `Argon2id` or `bcrypt` (minimum 12 rounds).

### 4.4 Voucher Number Generation & Sequence Concurrency
* Concurrency-safe sequence generation inside database transaction with `SELECT ... FOR UPDATE` on `tbl_trn_voucher_sequence_tracker`.
* Integer voucher type codes (PO = 1, GRN = 2, PI = 3, SO = 5, DC = 6, SI = 7, BTI = 11, BTR = 12, JWI = 21, JWR = 22, BOM = 31, PWO = 32, MIS = 33, PRN = 34).

---

## 5. Dynamic Configuration & Feature Gate Rules

* Hierarchical parameter fallback: User Override $\rightarrow$ Branch Override $\rightarrow$ Company Default $\rightarrow$ System Default.
* Feature parameters (`ENABLE_DUAL_UNIT`, `ENABLE_BATCH_TRACKING`, `ENABLE_SERIAL_TRACKING`, `ENABLE_BARCODE_SCANNING`) strictly guard both backend API endpoints and frontend input fields.

---

## 6. Frontend Engineering Guidelines (React 19, Vite, TypeScript)

* Strict TypeScript: Zero `any`.
* Declarative `<PermissionGate screen="..." action="...">` wrapping all sensitive buttons (`Print`, `Export`, `Authorize`, `Cancel`, `Reopen`).
* Dynamic live calculation for dynamic units: $\text{base\_qty} = \text{trans\_qty} \times \text{conversion\_factor}$.
* High-density TanStack Table grids with keyboard cell navigation.

---

## 7. Living Documentation Management Protocol

Every time a screen or feature is added or updated:
* [user-manual.md](file:///c:/Projects/KashviraInfotech/ks-mfg/docs/user-manual.md): Update navigation path, prerequisites, field explanations, action button guides, theme options, and user instructions.
* [technical-manual.md](file:///c:/Projects/KashviraInfotech/ks-mfg/docs/technical-manual.md): Update tables, sequences, API routes, dependency check queries, DTOs, audit log bindings, and developer notes.
