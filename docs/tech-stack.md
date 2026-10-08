# Technology Stack & Architectural Standards (KS-MFG)

**Document Version:** 1.0.0  
**Target Systems:** Enterprise Web Application (Primary) & Future Mobile Clients (REST/OpenAPI Parity)  

---

## 1. Executive Technology Summary

| Layer | Selected Technology | Version / Spec | Key Justification |
| :--- | :--- | :--- | :--- |
| **Backend Runtime** | Node.js | v22 LTS | Long-term stability, native fetch, V8 performance optimizations. |
| **Backend Framework** | **NestJS** | v10+ / v11 (TypeScript) | Enterprise-grade modular architecture, native Dependency Injection, first-class Controller/Service/Guard/Middleware lifecycle, automatic OpenAPI (Swagger) generation. |
| **ORM / Query Engine** | **Drizzle ORM** (Strict Query Mode) | v0.38+ | Zero runtime bloat, TypeScript-first SQL query builder. **Strictly configured with ZERO auto-sync / zero automated DDL push**. |
| **Database Engine** | **PostgreSQL** | v16+ | ACID compliance, advanced indexing (BRIN, GIN, Composite B-Tree), native sequences, row-level locking (`FOR UPDATE`), JSONB support. |
| **Database Migration Policy** | **Manual Versioned SQL Scripts** | Raw SQL in `db/scripts/` | **Strict manual execution requirement**. All DDL, sequences, constraints, and seed data are maintained in reviewed `.sql` files executed manually by DBA/developer. |
| **Frontend Framework** | **React 19** with **Vite 6** & **TypeScript** | v19 / TS 5.7+ | Lightning-fast HMR, strict type safety, zero Next.js server-action lock-in for enterprise ERP portals. |
| **UI Component System** | **Tailwind CSS** + **Shadcn UI** | Latest | Highly accessible (Radix UI primitives), dense data-entry ergonomics, completely customizable code ownership. |
| **Data Grid & Tables** | **TanStack Table (React Table v8)** | v8+ | High-performance virtualized grids for large inventory ledgers, vouchers, batch lists, and location trees. |
| **Client State & Cache** | **TanStack Query (React Query v5)** + **Zustand** | v5 / v5 | Server-state caching, automatic background invalidation, lightweight client store for branch context and session state. |
| **Form Validation** | **React Hook Form** + **Zod** | v7+ / v3+ | Uncontrolled form performance for 100+ line-item voucher screens, strict schema validation. |
| **Caching & Pub/Sub** | **Redis** | v7.4+ | Token revocation blocklist, session store, real-time configuration cache, voucher sequence caching. |
| **API Documentation** | **OpenAPI 3.1 (Swagger)** | Integrated NestJS | Instant contract generation for frontend developers and future mobile app teams (React Native/Flutter). |

---

## 2. Database Design & Migration Policy (Strict Rule Enforcement)

### 2.1 The "Zero Auto-Sync" Mandate
> [!CAUTION]
> **No automated database synchronization tool (such as `prisma db push`, `typeorm synchronize: true`, or `drizzle-kit push`) is permitted to run against any database environment.**
> All database schema mutations must be written as raw, idempotent SQL scripts, saved in the project repository, manually reviewed, and manually executed against PostgreSQL.

### 2.2 Script Storage & Directory Structure
```
ks-mfg/
└── dbscripts/                                # Root folder for all database scripts
    ├── 01_schema_objects.sql                 # ALL tables, indexes, sequences (CREATE only, appended at end)
    ├── 02_initial_data.sql                   # ALL necessary system setup & seed inserts (single file)
    ├── 03_sample_demo_data.sql               # Single file for sample demo data per screen/feature
    ├── views/                                # Individual .sql for each view
    ├── functions/                            # Individual .sql for each function
    ├── triggers/                             # Individual .sql for each trigger
    └── procedures/                           # Individual .sql for each stored procedure
```

### 2.3 PostgreSQL Sequences & Primary Key Convention
* **No synthetic UUIDs as Primary Keys for transactional performance and human-readable references.**
* Every table primary key must follow the strict naming: `<singular_entity>_id` (e.g., `user_id`, `party_id`, `comp_id`, `branch_id`, `item_id`, `voucher_id`).
* Primary key values **must** be populated from a dedicated PostgreSQL sequence:
```sql
-- Sequence Definition Standard
CREATE SEQUENCE IF NOT EXISTS seq_user_id START WITH 1001 INCREMENT BY 1;

-- Table Definition Standard
CREATE TABLE tbl_sec_user (
    user_id BIGINT PRIMARY KEY DEFAULT nextval('seq_user_id'),
    username VARCHAR(100) NOT NULL UNIQUE,
    ...
);
```

### 2.4 Mandatory Standard Audit & Tenancy Columns
Every single table created in the KS-MFG database (without exception) must include the following 7 standard columns:

| Column Name | Data Type | Nullable | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `comp_id` | `BIGINT` / `INTEGER` | **No** | N/A | Foreign key to Company Master. |
| `branch_id` | `BIGINT` / `INTEGER` | **No** | N/A | Foreign key to Branch Master (or 0 for global company masters). |
| `fyear_id` | `BIGINT` / `INTEGER` | Conditional | N/A | Foreign key to Financial Year (mandatory in voucher headers). |
| `created_by` | `BIGINT` | **No** | N/A | User ID of the creator. |
| `created_date` | `TIMESTAMPTZ` | **No** | `CURRENT_TIMESTAMP` | System timestamp of record insertion. |
| `updated_by` | `BIGINT` | Yes | `NULL` | User ID of the last modifying user. |
| `updated_date` | `TIMESTAMPTZ` | Yes | `NULL` | System timestamp of last modification. |

---

## 3. Backend Architecture & API Standards (NestJS)

### 3.1 Layered Architecture Pattern
The backend enforces a clean 5-layer separation:
```
Client Request
      │
      ▼
[1. Middlewares]          ── (Pino HTTP Logger, Correlation-ID, Rate Limiter)
      │
      ▼
[2. Guards & Interceptors]── (JWT AuthGuard, TenantContextGuard, RBAC Screen/Action Guard)
      │
      ▼
[3. Controllers]          ── (Route endpoints, DTO validation using class-validator / Zod)
      │
      ▼
[4. Services / Domain]    ── (Business logic, Multi-unit conversions, Sequence locks, Workflow)
      │
      ▼
[5. Repositories / DB]    ── (Drizzle ORM type-safe queries, Raw SQL builders, Transactions)
      │
      ▼
PostgreSQL Database
```

### 3.2 Authentication, Tokens & Security Architecture
* **Dual-Token Pattern:**
  * **Access Token (JWT):** Short validity (15 minutes). Contains:
    ```json
    {
      "sub": 1042,
      "username": "rajesh.patel",
      "comp_id": 1,
      "branch_id": 3,
      "roles": ["INVENTORY_MANAGER", "QC_INSPECTOR"],
      "sessionId": "b47c9431-d70a-4938-8c01-7fa170f7e411"
    }
    ```
  * **Refresh Token:** Cryptographically strong random string (7 days). Stored hashed in PostgreSQL session table (`tbl_sec_user_session`) and dispatched to the browser inside an `httpOnly`, `Secure`, `SameSite=Strict` cookie.
* **Instant Session Revocation:** Redis blacklist checks `sessionId` on each incoming request. Terminating a session or logging out instantly invalidates access tokens across all devices.
* **Branch Context Switching:**
  * Endpoint: `POST /api/v1/auth/switch-branch` with `{ "target_branch_id": 5 }`.
  * The backend verifies whether the user possesses role assignment in Branch 5.
  * If valid, it issues an updated Access Token scoped specifically to Branch 5 and its corresponding roles.

### 3.3 Granular Screen & Action Permission Interceptor / Guard
Every secure endpoint is decorated with screen code and action code:
```typescript
@Post(':id/authorize')
@RequirePermission({ screen: 'PURCHASE_ORDER', action: 'AUTHORIZE' })
async authorizePurchaseOrder(
  @Param('id', ParseIntPipe) id: number,
  @CurrentUser() user: RequestUserContext,
) {
  return this.poService.authorize(id, user);
}
```

---

## 4. Frontend Architecture (React 19, Vite, TypeScript)

### 4.1 Project Organization
```
frontend/
├── src/
│   ├── app/                      # Application entry, router configuration, providers
│   ├── assets/                   # Static branding, images, SVGs
│   ├── components/
│   │   ├── ui/                   # Reusable Shadcn UI primitives (Button, Dialog, Input, Table)
│   │   ├── common/               # DataTable, SearchableDropdown, DynamicUnitInput, BarcodeScanner
│   │   └── security/             # PermissionGate, BranchSwitcher, RoleBadge
│   ├── features/                 # Modular feature domains
│   │   ├── auth/                 # Login, MFA, Password Reset, Branch Selector
│   │   ├── admin/                # Companies, Branches, Financial Years, Users, Role Matrix
│   │   ├── config/               # Dynamic Parameter Configuration Matrix
│   │   ├── warehouse/            # Dynamic Multi-Level Tree Builder, Location Types
│   │   ├── catalog/              # Items, Units, Conversion Factor Rules, Price Lists
│   │   ├── procurement/          # PO, Inward GRN, Purchase Bill screens
│   │   ├── manufacturing/        # BOM Designer, Work Orders, Material Issue, FG Receipt
│   │   ├── subcontracting/       # Job-Work Issue Delivery Challan, Job-Work Receipt
│   │   └── inventory/            # Live Stock Ledger, Batch/Serial Explorer, Sequence Reset Screen
│   ├── hooks/                    # Reusable hooks (useAuth, usePermission, useConfigParam)
│   ├── lib/                      # Axios/Fetch client, Zod schemas, date formatters, math utilities
│   ├── stores/                   # Zustand stores (authStore, activeBranchStore, appConfigStore)
│   └── types/                    # Shared TypeScript interfaces & DTOs
```

### 4.2 Declarative Permission Gate Component
Ensures action buttons (Print, Export, Authorize) are conditionally rendered or disabled cleanly:
```tsx
<PermissionGate screen="PURCHASE_ORDER" action="AUTHORIZE" fallback={<Button disabled>Authorize (No Access)</Button>}>
  <Button variant="default" onClick={handleAuthorize}>
    <CheckCircle className="mr-2 h-4 w-4" /> Authorize Voucher
  </Button>
</PermissionGate>
```

### 4.3 High-Density Manufacturing Data Grids
* Built on **TanStack Table v8** with keyboard navigation (`Tab`, `Enter`, `Arrow` keys for fast item entry in 50+ row voucher grids).
* Sub-line dynamic unit calculation directly reacts to `trans_qty * conversion_factor = base_qty`.
* Conditional column rendering based on config parameters:
  * Batch No. column hidden if `ENABLE_BATCH_TRACKING` is OFF.
  * Serial No. column hidden if `ENABLE_SERIAL_TRACKING` is OFF.
  * Alternate UOM column hidden if `ENABLE_DUAL_UNIT` is OFF.

---

## 5. Mobile App API Parity & Preparation

Although Phase 1 targets the web application, all backend APIs are designed from Day 1 to be fully mobile-ready:
1. **Header-Based Auth Support:** While the web client uses `httpOnly` cookies, the backend auth middleware supports `Authorization: Bearer <token>` in headers for native mobile clients (React Native / Flutter).
2. **Barcode / QR Scanning Payloads:** Endpoints accept raw string scans from handheld industrial PDA scanners (Zebra, Honeywell, Android).
3. **OpenAPI / Swagger Generation:** NestJS automatically compiles OpenAPI 3.1 specifications (`/api/docs`), enabling automatic client SDK generation (`openapi-typescript-codegen`) for mobile development teams in Phase 2.
