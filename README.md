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

---

## 🗺️ Planned Roadmap & Phased Scope

Development proceeds strictly **one screen/feature at a time**, completely implemented end-to-end (PostgreSQL DDL/DML $\rightarrow$ NestJS API $\rightarrow$ React UI $\rightarrow$ Living Manuals):

- **Phase 2 (Remaining)**:
  - **Step 2.5**: Security & Field-Delta Audit Trail Viewer (`/security/audit-logs`) with side-by-side JSONB `old_value` vs `new_value` inspector.
  - **Step 2.6**: System Configuration Matrix & Document Numbering Series Engine (`/admin/configurations`).
- **Phase 3 — Inventory Foundation & Warehouse Hierarchy (`INVENTORY`)**:
  - Multi-level Warehouse, Zone, Rack, and Bin Master (`/inventory/warehouses`).
  - Unit of Measure (UOM), UOM Conversion Matrix & Item Category Hierarchy (`/inventory/uoms`).
  - Item & Material Master (`RAW`, `SFG`, `FG`, `CONSUMABLE`, `SPARE`, `SCRAP`) with reorder rules, QC flags, and batch/serial tracking (`/inventory/items`).
- **Phase 4 — Unified Party Master & Commercial Terms (`CRM_SRM`)**:
  - Unified Customer, Supplier & Job-Work Subcontractor Master with multi-address, GST, and credit limit controls (`/parties/master`).
  - Tiered Price Lists, Volume Discounts & Vendor Rate Contracts (`/parties/price-lists`).
- **Phase 5 — Procurement, Inward GRN, Quality Inspection & Put-Away (`PROCUREMENT`)**:
  - Material Requisition (MR) $\rightarrow$ RFQ & Vendor Comparison $\rightarrow$ Purchase Order (PO) with multi-level authorization.
  - Gate Entry $\rightarrow$ Goods Receipt Note (GRN) $\rightarrow$ Incoming QC Quarantine & Inspection $\rightarrow$ Bin Put-Away & Purchase Invoice matching.
- **Phase 6 — Manufacturing Engineering, MRP, Shopfloor Execution & Job-Work (`MANUFACTURING`)**:
  - Multi-Level Bill of Materials (BOM) with versions, scrap factors, and co-products/by-products.
  - Work Centers, Machines, Shift Calendars & Production Routings.
  - Material Requirements Planning (MRP) $\rightarrow$ Production Work Orders $\rightarrow$ Material Issue / Backflushing $\rightarrow$ Stage-Wise Production & QC $\rightarrow$ Subcontractor Job-Work Outward/Inward $\rightarrow$ FG Receipt & Actual Costing.
- **Phase 7 — Sales Order, Reservation, Dispatch & Invoicing (`SALES`)**:
  - Customer Inquiry / Quotation $\rightarrow$ Sales Order (SO) & ATP Stock Reservation $\rightarrow$ Pick/Pack/Delivery Challan $\rightarrow$ GST Tax Invoice & Sales Return.

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
