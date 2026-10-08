# AI Agents & Developer Engineering Rules (KS-MFG)

**Document Version:** 1.0.0  
**Scope:** Mandatory rules and guidelines for AI Agents (Antigravity, Copilot, Cursor) and Software Engineers working on KS-MFG.  

---

## 1. Prime Directives (Non-Negotiable)

### 1.1 Strict Database Authority: ZERO Automated Sync
> [!CAUTION]
> **NEVER configure, propose, or execute any automated ORM schema sync command.**
> Commands such as `drizzle-kit push`, `prisma db push`, `typeorm.synchronize: true`, or automated auto-migrations against any live database are strictly prohibited.
>
> 1. All database modifications **must** be written as raw, versioned SQL migration scripts located in `backend/db/scripts/`.
> 2. Scripts must follow sequential prefix naming: `001_sequences.sql`, `002_core_tenancy.sql`, etc.
> 3. Each script must be idempotent (using `CREATE TABLE IF NOT EXISTS`, `CREATE SEQUENCE IF NOT EXISTS`, etc.) where appropriate.
> 4. The user/DBA manually inspects, approves, and executes all scripts.

### 1.2 Primary Key & Sequence Convention
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

### 1.3 Mandatory Seven Standard Audit & Multi-Tenancy Columns
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

## 2. Backend Engineering Guidelines (NestJS)

### 2.1 Layered Separation of Concerns
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

### 2.2 Security, Tokens & Authentication Rules
* **Dual-Token System:**
  * Access Token (JWT): 15-minute lifespan. Sent in `Authorization: Bearer <token>` or parsed from secure context.
  * Refresh Token: 7-day lifespan. Must be transmitted in `httpOnly`, `Secure`, `SameSite=Strict` cookies (with header fallback for mobile clients).
* **Redis Token Blacklist:**
  * Every token payload contains a unique `sessionId`.
  * User logout or administrative deactivation writes `sessionId` to Redis with TTL matching remaining token lifespan.
* **Password Hashing:**
  * Always use `Argon2id` or `bcrypt` with a minimum of 12 salt rounds. Plaintext passwords must never be logged or persisted.

### 2.3 Voucher Number Generation & Sequence Concurrency
* **Voucher Type Codes:** Always use defined integer codes (e.g., PO = 1, GRN = 2, PI = 3, SO = 5, DC = 6, SI = 7, BTI = 11, BTR = 12, JWI = 21, JWR = 22, BOM = 31, PWO = 32, MIS = 33, PRN = 34).
* **Zero-Collision Rule:**
  * Sequence generation **must** run within a PostgreSQL database transaction (`trx`).
  * Acquire a row lock on `tbl_trn_voucher_sequence_tracker` using `SELECT ... FOR UPDATE` filtered by `(comp_id, branch_id, fyear_id, voucher_type_id)`.
  * Increment the counter, generate formatted string (e.g., `PO/PUN/26-27/000042`), and persist within the transaction.

### 2.4 Error Handling & JSON Response Standard
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

## 3. Dynamic Configuration & Feature Gate Rules

### 3.1 Parameter Cascading Inheritance
When resolving any configuration parameter `PARAM_KEY`:
1. Check User-specific override in `tbl_cfg_user_override`.
2. If null, check Branch-specific override in `tbl_cfg_branch_override`.
3. If null, check Company-specific default in `tbl_cfg_company_override`.
4. If null, return hardcoded system default from `tbl_cfg_parameter_master`.

### 3.2 Feature-Flag Hard Guarding
If a feature parameter (such as `ENABLE_DUAL_UNIT`, `ENABLE_BATCH_TRACKING`, or `ENABLE_SERIAL_TRACKING`) is evaluated as `false`:
* The backend API **must reject** incoming transactions containing non-null secondary units, batch details, or serial allocations with an appropriate error code (e.g., `FEATURE_DISABLED`).
* The frontend UI **must hide or disable** the corresponding tabs, switches, and input columns.

---

## 4. Frontend Engineering Guidelines (React 19, Vite, TypeScript)

### 4.1 Strict Typing & Architecture
* **Strict TypeScript:** Set `"strict": true` in `tsconfig.json`. Use of `any` is strictly prohibited. Use explicit types or `unknown` with type guards.
* **Component Architecture:**
  * Small, focused components.
  * Use Shadcn UI primitives for inputs, dialogs, dropdowns, and buttons.
  * Use React Hook Form + Zod for all form validation.

### 4.2 Declarative Permission Enforcing
* Every UI action button representing a sensitive business capability (Print, Export, Authorize, Cancel, Reopen) **must** be wrapped in `<PermissionGate>`:
```tsx
<PermissionGate screen="PURCHASE_ORDER" action="AUTHORIZE">
  <Button onClick={onAuthorize}>Authorize</Button>
</PermissionGate>
```
* If the active user lacks permission in the currently selected branch, the component must hide the button or render a disabled button with an informative tooltip based on the `fallback` prop.

### 4.3 High-Density Manufacturing Grids
* Line item tables in vouchers (Purchase Orders, GRNs, Production Issues) must support keyboard navigation (`Tab` to next cell, `Enter` to commit row).
* Dynamically compute base quantity:
  $$\text{base\_qty} = \text{trans\_qty} \times \text{conversion\_factor}$$
  with immediate live calculation in the grid.

---

## 5. Dynamic Warehouse Location Rules

* Support arbitrary physical storage depths per branch/warehouse:
  * Chamber $\rightarrow$ Rack $\rightarrow$ Bin
  * Unit $\rightarrow$ Chamber $\rightarrow$ Rack $\rightarrow$ Bin
  * Floor $\rightarrow$ Block $\rightarrow$ Rack $\rightarrow$ Bin
  * Single Level Location
* Persist dynamic location hierarchy using Adjacency List + Materialized Path (`path_string` e.g., `/1/14/82/`).
* Location types (`General`, `QC`, `Quarantine`, `Damaged`, `WIP`, `Scrap`) can be mapped to any node level in the tree.
* Stock deposited in locations flagged as `is_allocatable = false` (e.g., QC, Quarantine, Damaged) must never be picked for Production Material Issues or Sales Delivery Challans.

---

## 6. Coding Standards & Git Protocols

### 6.1 Code Formatting & Linting
* ESLint and Prettier configurations must be adhered to on every commit.
* Imports must be organized:
  1. Standard library / Node built-ins
  2. Third-party packages (NestJS, React, TanStack, etc.)
  3. Internal aliases (`@/components`, `@/features`, `@/lib`)
  4. Relative imports (`./types`, `./utils`)

### 6.2 Commit Message Standard
Follow the Conventional Commits specification:
* `feat(procurement): add dynamic unit conversion to grn line items`
* `fix(sequence): prevent race condition on voucher sequence tracker`
* `docs(db): add sql script 009 for voucher sequence locks`
* `refactor(auth): switch branch context using scoped jwt tokens`
