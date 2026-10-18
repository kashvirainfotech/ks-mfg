-- ============================================================================
-- KS-MFG ERP: Master Database Schema Objects
-- Description: Common master SQL file containing ALL CREATE statements for
--              Sequences, Tables, and Indexes to be executed manually on a
--              fresh/new PostgreSQL database.
-- Rule:
--   1. ONLY CREATE statements are allowed.
--   2. All new objects for new screens/features must be appended at the END
--      of this file with proper date and informational comment headers.
--   3. All table PKs must be <entity>_id sourced from sequences.
--   4. All tables must have standard 7 audit columns:
--      comp_id, branch_id, fyear_id, created_by, created_date, updated_by, updated_date.
-- ============================================================================

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 0.1 - Core Foundation (Tenancy, Auth/RBAC, User Preferences, Audit Log)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Organization & Multi-Tenancy Sequences & Tables
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS seq_comp_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_org_company (
    comp_id             BIGINT          PRIMARY KEY DEFAULT nextval('seq_comp_id'),
    comp_code           VARCHAR(20)     NOT NULL UNIQUE,
    comp_name           VARCHAR(150)    NOT NULL,
    legal_name          VARCHAR(200)    NOT NULL,
    gstin               VARCHAR(20),
    pan_no              VARCHAR(20),
    cin_no              VARCHAR(30),
    iec_code            VARCHAR(30),
    msme_reg_no         VARCHAR(50),
    base_currency_code  VARCHAR(10)     NOT NULL DEFAULT 'INR',
    registered_address  TEXT,
    city                VARCHAR(100),
    state_name          VARCHAR(100),
    state_code          VARCHAR(10),
    pincode             VARCHAR(15),
    country             VARCHAR(100)    NOT NULL DEFAULT 'India',
    phone               VARCHAR(30),
    email               VARCHAR(150),
    website             VARCHAR(150),
    logo_url            VARCHAR(500),
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns (comp_id is PK above)
    branch_id           BIGINT          NOT NULL DEFAULT 0,
    fyear_id            BIGINT,
    created_by          BIGINT          NOT NULL,
    created_date        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          BIGINT,
    updated_date        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_org_company_active ON tbl_org_company (is_active);


CREATE SEQUENCE IF NOT EXISTS seq_branch_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_org_branch (
    branch_id           BIGINT          PRIMARY KEY DEFAULT nextval('seq_branch_id'),
    branch_code         VARCHAR(20)     NOT NULL,
    branch_name         VARCHAR(150)    NOT NULL,
    branch_type         VARCHAR(30)     NOT NULL DEFAULT 'PLANT', -- HO, PLANT, WAREHOUSE, SALES_OFFICE
    gstin               VARCHAR(20),
    address             TEXT,
    city                VARCHAR(100),
    state_name          VARCHAR(100),
    state_code          VARCHAR(10),
    pincode             VARCHAR(15),
    country             VARCHAR(100)    NOT NULL DEFAULT 'India',
    phone               VARCHAR(30),
    email               VARCHAR(150),
    is_head_office      BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns (branch_id is PK above)
    comp_id             BIGINT          NOT NULL REFERENCES tbl_org_company(comp_id),
    fyear_id            BIGINT,
    created_by          BIGINT          NOT NULL,
    created_date        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          BIGINT,
    updated_date        TIMESTAMPTZ,
    CONSTRAINT uq_org_branch_code UNIQUE (comp_id, branch_code)
);

CREATE INDEX IF NOT EXISTS idx_org_branch_comp ON tbl_org_branch (comp_id, is_active);


CREATE SEQUENCE IF NOT EXISTS seq_fyear_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_org_financial_year (
    fyear_id            BIGINT          PRIMARY KEY DEFAULT nextval('seq_fyear_id'),
    fyear_code          VARCHAR(20)     NOT NULL, -- e.g. '2026-27'
    fyear_name          VARCHAR(50)     NOT NULL, -- e.g. 'FY 2026-2027'
    start_date          DATE            NOT NULL,
    end_date            DATE            NOT NULL,
    is_current          BOOLEAN         NOT NULL DEFAULT FALSE,
    is_closed           BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns (fyear_id is PK above)
    comp_id             BIGINT          NOT NULL REFERENCES tbl_org_company(comp_id),
    branch_id           BIGINT          NOT NULL DEFAULT 0,
    created_by          BIGINT          NOT NULL,
    created_date        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          BIGINT,
    updated_date        TIMESTAMPTZ,
    CONSTRAINT uq_org_fyear_code UNIQUE (comp_id, fyear_code)
);

CREATE INDEX IF NOT EXISTS idx_org_fyear_comp ON tbl_org_financial_year (comp_id, is_active);


CREATE SEQUENCE IF NOT EXISTS seq_branch_fyear_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_org_branch_fyear (
    branch_fyear_id     BIGINT          PRIMARY KEY DEFAULT nextval('seq_branch_fyear_id'),
    is_locked           BOOLEAN         NOT NULL DEFAULT FALSE,
    books_begin_from    DATE,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id             BIGINT          NOT NULL REFERENCES tbl_org_company(comp_id),
    branch_id           BIGINT          NOT NULL REFERENCES tbl_org_branch(branch_id),
    fyear_id            BIGINT          NOT NULL REFERENCES tbl_org_financial_year(fyear_id),
    created_by          BIGINT          NOT NULL,
    created_date        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          BIGINT,
    updated_date        TIMESTAMPTZ,
    CONSTRAINT uq_org_branch_fyear UNIQUE (comp_id, branch_id, fyear_id)
);

CREATE INDEX IF NOT EXISTS idx_org_branch_fyear_lookup ON tbl_org_branch_fyear (comp_id, branch_id, fyear_id);


-- ----------------------------------------------------------------------------
-- 2. Global Roles, Screens, Actions & RBAC Permission Tables
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS seq_role_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sec_role (
    role_id             BIGINT          PRIMARY KEY DEFAULT nextval('seq_role_id'),
    role_code           VARCHAR(40)     NOT NULL UNIQUE,
    role_name           VARCHAR(100)    NOT NULL,
    role_description    VARCHAR(300),
    is_system_role      BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns (Global roles default comp_id/branch_id to 1001)
    comp_id             BIGINT          NOT NULL DEFAULT 1001,
    branch_id           BIGINT          NOT NULL DEFAULT 1001,
    fyear_id            BIGINT,
    created_by          BIGINT          NOT NULL,
    created_date        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          BIGINT,
    updated_date        TIMESTAMPTZ
);


CREATE SEQUENCE IF NOT EXISTS seq_screen_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sec_screen (
    screen_id           BIGINT          PRIMARY KEY DEFAULT nextval('seq_screen_id'),
    screen_code         VARCHAR(60)     NOT NULL UNIQUE,
    screen_name         VARCHAR(120)    NOT NULL,
    module_name         VARCHAR(60)     NOT NULL, -- e.g. 'DASHBOARD', 'ORGANIZATION', 'SECURITY', 'INVENTORY', 'PROCUREMENT', 'MANUFACTURING', 'SALES'
    route_path          VARCHAR(150),
    icon_name           VARCHAR(60),
    display_order       INT             NOT NULL DEFAULT 1,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id             BIGINT          NOT NULL DEFAULT 1001,
    branch_id           BIGINT          NOT NULL DEFAULT 1001,
    fyear_id            BIGINT,
    created_by          BIGINT          NOT NULL,
    created_date        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          BIGINT,
    updated_date        TIMESTAMPTZ
);


CREATE SEQUENCE IF NOT EXISTS seq_action_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sec_action (
    action_id           BIGINT          PRIMARY KEY DEFAULT nextval('seq_action_id'),
    screen_id           BIGINT          NOT NULL REFERENCES tbl_sec_screen(screen_id),
    action_code         VARCHAR(40)     NOT NULL, -- e.g. 'PRINT', 'EXPORT', 'AUTHORIZE', 'CANCEL', 'REOPEN'
    action_name         VARCHAR(100)    NOT NULL,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id             BIGINT          NOT NULL DEFAULT 1001,
    branch_id           BIGINT          NOT NULL DEFAULT 1001,
    fyear_id            BIGINT,
    created_by          BIGINT          NOT NULL,
    created_date        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          BIGINT,
    updated_date        TIMESTAMPTZ,
    CONSTRAINT uq_sec_screen_action UNIQUE (screen_id, action_code)
);


CREATE SEQUENCE IF NOT EXISTS seq_role_permission_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sec_role_permission (
    role_permission_id  BIGINT          PRIMARY KEY DEFAULT nextval('seq_role_permission_id'),
    role_id             BIGINT          NOT NULL REFERENCES tbl_sec_role(role_id),
    screen_id           BIGINT          NOT NULL REFERENCES tbl_sec_screen(screen_id),
    can_view            BOOLEAN         NOT NULL DEFAULT FALSE,
    can_add             BOOLEAN         NOT NULL DEFAULT FALSE,
    can_edit            BOOLEAN         NOT NULL DEFAULT FALSE,
    can_delete          BOOLEAN         NOT NULL DEFAULT FALSE,
    -- Mandatory 7 Audit & Context Columns
    comp_id             BIGINT          NOT NULL DEFAULT 1001,
    branch_id           BIGINT          NOT NULL DEFAULT 1001,
    fyear_id            BIGINT,
    created_by          BIGINT          NOT NULL,
    created_date        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          BIGINT,
    updated_date        TIMESTAMPTZ,
    CONSTRAINT uq_sec_role_screen UNIQUE (role_id, screen_id)
);

CREATE INDEX IF NOT EXISTS idx_sec_role_perm_role ON tbl_sec_role_permission (role_id);


CREATE SEQUENCE IF NOT EXISTS seq_role_action_permission_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sec_role_action_permission (
    role_action_permission_id BIGINT    PRIMARY KEY DEFAULT nextval('seq_role_action_permission_id'),
    role_id             BIGINT          NOT NULL REFERENCES tbl_sec_role(role_id),
    screen_id           BIGINT          NOT NULL REFERENCES tbl_sec_screen(screen_id),
    action_id           BIGINT          NOT NULL REFERENCES tbl_sec_action(action_id),
    is_allowed          BOOLEAN         NOT NULL DEFAULT FALSE,
    -- Mandatory 7 Audit & Context Columns
    comp_id             BIGINT          NOT NULL DEFAULT 1001,
    branch_id           BIGINT          NOT NULL DEFAULT 1001,
    fyear_id            BIGINT,
    created_by          BIGINT          NOT NULL,
    created_date        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          BIGINT,
    updated_date        TIMESTAMPTZ,
    CONSTRAINT uq_sec_role_action UNIQUE (role_id, action_id)
);

CREATE INDEX IF NOT EXISTS idx_sec_role_act_perm_role ON tbl_sec_role_action_permission (role_id);


-- ----------------------------------------------------------------------------
-- 3. Users, Company/Branch Role Assignments & User Theme Preferences
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS seq_user_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sec_user (
    user_id             BIGINT          PRIMARY KEY DEFAULT nextval('seq_user_id'),
    username            VARCHAR(60)     NOT NULL UNIQUE,
    email               VARCHAR(150)    NOT NULL UNIQUE,
    mobile              VARCHAR(25),
    password_hash       VARCHAR(255)    NOT NULL,
    full_name           VARCHAR(150)    NOT NULL,
    user_category       VARCHAR(20)     NOT NULL DEFAULT 'EMPLOYEE', -- 'SYSTEM', 'EMPLOYEE', 'PARTY'
    linked_entity_id    BIGINT,                                      -- employee_id or party_id (NULL for SYSTEM Super Admin)
    is_super_admin      BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    failed_login_count  INT             NOT NULL DEFAULT 0,
    locked_until        TIMESTAMPTZ,
    last_login_at       TIMESTAMPTZ,
    -- Mandatory 7 Audit & Context Columns
    comp_id             BIGINT          NOT NULL DEFAULT 1001,
    branch_id           BIGINT          NOT NULL DEFAULT 1001,
    fyear_id            BIGINT,
    created_by          BIGINT          NOT NULL,
    created_date        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          BIGINT,
    updated_date        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sec_user_category ON tbl_sec_user (user_category, linked_entity_id);


CREATE SEQUENCE IF NOT EXISTS seq_user_company_role_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sec_user_company_role (
    user_company_role_id BIGINT         PRIMARY KEY DEFAULT nextval('seq_user_company_role_id'),
    user_id             BIGINT          NOT NULL REFERENCES tbl_sec_user(user_id),
    mapped_comp_id      BIGINT          NOT NULL REFERENCES tbl_org_company(comp_id),
    role_id             BIGINT          NOT NULL REFERENCES tbl_sec_role(role_id),
    is_default          BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id             BIGINT          NOT NULL DEFAULT 1001,
    branch_id           BIGINT          NOT NULL DEFAULT 1001,
    fyear_id            BIGINT,
    created_by          BIGINT          NOT NULL,
    created_date        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          BIGINT,
    updated_date        TIMESTAMPTZ,
    CONSTRAINT uq_sec_user_comp_role UNIQUE (user_id, mapped_comp_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_sec_user_comp_role_user ON tbl_sec_user_company_role (user_id, is_active);


CREATE SEQUENCE IF NOT EXISTS seq_user_branch_role_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sec_user_branch_role (
    user_branch_role_id BIGINT          PRIMARY KEY DEFAULT nextval('seq_user_branch_role_id'),
    user_id             BIGINT          NOT NULL REFERENCES tbl_sec_user(user_id),
    mapped_comp_id      BIGINT          NOT NULL REFERENCES tbl_org_company(comp_id),
    mapped_branch_id    BIGINT          NOT NULL REFERENCES tbl_org_branch(branch_id),
    role_id             BIGINT          NOT NULL REFERENCES tbl_sec_role(role_id),
    is_default          BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id             BIGINT          NOT NULL DEFAULT 1001,
    branch_id           BIGINT          NOT NULL DEFAULT 1001,
    fyear_id            BIGINT,
    created_by          BIGINT          NOT NULL,
    created_date        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          BIGINT,
    updated_date        TIMESTAMPTZ,
    CONSTRAINT uq_sec_user_branch_role UNIQUE (user_id, mapped_branch_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_sec_user_branch_role_user ON tbl_sec_user_branch_role (user_id, is_active);


CREATE SEQUENCE IF NOT EXISTS seq_user_preference_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sec_user_preference (
    user_preference_id  BIGINT          PRIMARY KEY DEFAULT nextval('seq_user_preference_id'),
    user_id             BIGINT          NOT NULL UNIQUE REFERENCES tbl_sec_user(user_id),
    theme_mode          VARCHAR(20)     NOT NULL DEFAULT 'light',   -- 'light', 'dark', 'system'
    theme_color         VARCHAR(30)     NOT NULL DEFAULT 'indigo',  -- 'indigo', 'blue', 'emerald', 'violet', 'amber', 'rose'
    sidebar_collapsed   BOOLEAN         NOT NULL DEFAULT FALSE,
    default_comp_id     BIGINT          REFERENCES tbl_org_company(comp_id),
    default_branch_id   BIGINT          REFERENCES tbl_org_branch(branch_id),
    default_fyear_id    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    -- Mandatory 7 Audit & Context Columns
    comp_id             BIGINT          NOT NULL DEFAULT 1001,
    branch_id           BIGINT          NOT NULL DEFAULT 1001,
    fyear_id            BIGINT,
    created_by          BIGINT          NOT NULL,
    created_date        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          BIGINT,
    updated_date        TIMESTAMPTZ
);


-- ----------------------------------------------------------------------------
-- 4. Universal Activity & Field-Delta Audit Trail Table
-- ----------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS seq_audit_id START WITH 1 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sys_audit_log (
    audit_id            BIGINT          PRIMARY KEY DEFAULT nextval('seq_audit_id'),
    user_id             BIGINT          NOT NULL,
    username            VARCHAR(60),
    screen_code         VARCHAR(60)     NOT NULL,
    action_type         VARCHAR(30)     NOT NULL, -- 'ADD', 'EDIT', 'DELETE', 'PRINT', 'EXPORT', 'AUTHORIZE', 'CANCEL', 'REOPEN', 'LOGIN', 'LOGOUT'
    entity_table        VARCHAR(100)    NOT NULL,
    record_id           BIGINT          NOT NULL,
    old_value           JSONB,
    new_value           JSONB,
    changed_fields      JSONB,
    ip_address          VARCHAR(50),
    user_agent          VARCHAR(300),
    correlation_id      VARCHAR(60),
    action_timestamp    TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- Mandatory 7 Audit & Context Columns
    comp_id             BIGINT          NOT NULL,
    branch_id           BIGINT          NOT NULL,
    fyear_id            BIGINT,
    created_by          BIGINT          NOT NULL,
    created_date        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          BIGINT,
    updated_date        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sys_audit_log_tenant_time ON tbl_sys_audit_log (comp_id, branch_id, action_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sys_audit_log_entity ON tbl_sys_audit_log (entity_table, record_id);
CREATE INDEX IF NOT EXISTS idx_sys_audit_log_user ON tbl_sys_audit_log (user_id, action_timestamp DESC);

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 2.1 - Department & Designation Master Tables
--          (tbl_hr_department, tbl_hr_designation)
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS seq_dept_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_hr_department (
    dept_id             BIGINT          PRIMARY KEY DEFAULT nextval('seq_dept_id'),
    dept_code           VARCHAR(30)     NOT NULL,
    dept_name           VARCHAR(120)    NOT NULL,
    dept_category       VARCHAR(40)     NOT NULL DEFAULT 'PRODUCTION', -- 'PRODUCTION', 'QUALITY', 'SUPPLY_CHAIN', 'ENGINEERING', 'MAINTENANCE', 'FINANCE_HR', 'SALES_ADMIN'
    parent_dept_id      BIGINT          REFERENCES tbl_hr_department(dept_id),
    hod_employee_id     BIGINT,         -- Linked to tbl_hr_employee(employee_id)
    cost_center_code    VARCHAR(40),
    description         VARCHAR(300),
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id             BIGINT          NOT NULL REFERENCES tbl_org_company(comp_id),
    branch_id           BIGINT          NOT NULL DEFAULT 1001,
    fyear_id            BIGINT,
    created_by          BIGINT          NOT NULL,
    created_date        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          BIGINT,
    updated_date        TIMESTAMPTZ,
    CONSTRAINT uq_hr_dept_code UNIQUE (comp_id, dept_code)
);

CREATE INDEX IF NOT EXISTS idx_hr_dept_comp_branch ON tbl_hr_department (comp_id, branch_id, is_active);


CREATE SEQUENCE IF NOT EXISTS seq_desig_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_hr_designation (
    desig_id            BIGINT          PRIMARY KEY DEFAULT nextval('seq_desig_id'),
    desig_code          VARCHAR(30)     NOT NULL,
    desig_name          VARCHAR(120)    NOT NULL,
    dept_id             BIGINT          REFERENCES tbl_hr_department(dept_id),
    grade_code          VARCHAR(20)     NOT NULL DEFAULT 'L3', -- 'L1', 'L2', 'L3', 'L4', 'L5', 'M1', 'M2', 'E1'
    hierarchy_level     INT             NOT NULL DEFAULT 3,    -- 1 = Executive/Director ... 8 = Shopfloor Operator
    description         VARCHAR(300),
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id             BIGINT          NOT NULL REFERENCES tbl_org_company(comp_id),
    branch_id           BIGINT          NOT NULL DEFAULT 1001,
    fyear_id            BIGINT,
    created_by          BIGINT          NOT NULL,
    created_date        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          BIGINT,
    updated_date        TIMESTAMPTZ,
    CONSTRAINT uq_hr_desig_code UNIQUE (comp_id, desig_code)
);

CREATE INDEX IF NOT EXISTS idx_hr_desig_comp_dept ON tbl_hr_designation (comp_id, dept_id, is_active);

-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 2.2 - Employee Master Table (tbl_hr_employee)
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS seq_employee_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_hr_employee (
    employee_id             BIGINT          PRIMARY KEY DEFAULT nextval('seq_employee_id'),
    emp_code                VARCHAR(30)     NOT NULL,
    first_name              VARCHAR(80)     NOT NULL,
    last_name               VARCHAR(80),
    full_name               VARCHAR(165)    NOT NULL,
    gender                  VARCHAR(20)     NOT NULL DEFAULT 'MALE',        -- 'MALE', 'FEMALE', 'OTHER'
    date_of_birth           DATE,
    date_of_joining         DATE            NOT NULL,
    dept_id                 BIGINT          NOT NULL REFERENCES tbl_hr_department(dept_id),
    desig_id                BIGINT          NOT NULL REFERENCES tbl_hr_designation(desig_id),
    primary_branch_id       BIGINT          NOT NULL REFERENCES tbl_org_branch(branch_id),
    reporting_manager_id    BIGINT          REFERENCES tbl_hr_employee(employee_id),
    employment_type         VARCHAR(30)     NOT NULL DEFAULT 'PERMANENT',   -- 'PERMANENT', 'CONTRACT', 'TRAINEE', 'CONSULTANT'
    employment_status       VARCHAR(30)     NOT NULL DEFAULT 'ACTIVE',      -- 'ACTIVE', 'PROBATION', 'NOTICE_PERIOD', 'SUSPENDED', 'TERMINATED'
    work_email              VARCHAR(150),
    mobile_no               VARCHAR(25)     NOT NULL,
    emergency_contact_name  VARCHAR(120),
    emergency_contact_phone VARCHAR(25),
    blood_group             VARCHAR(10),
    pan_no                  VARCHAR(15),
    aadhaar_masked          VARCHAR(20),
    pf_uan_no               VARCHAR(25),
    esi_no                  VARCHAR(25),
    bank_name               VARCHAR(120),
    bank_account_no         VARCHAR(40),
    bank_ifsc_code          VARCHAR(20),
    address_line1           VARCHAR(200),
    city                    VARCHAR(80),
    state_name              VARCHAR(80),
    pincode                 VARCHAR(15),
    remarks                 VARCHAR(300),
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                 BIGINT          NOT NULL REFERENCES tbl_org_company(comp_id),
    branch_id               BIGINT          NOT NULL DEFAULT 1001,
    fyear_id                BIGINT,
    created_by              BIGINT          NOT NULL,
    created_date            TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by              BIGINT,
    updated_date            TIMESTAMPTZ,
    CONSTRAINT uq_hr_employee_code UNIQUE (comp_id, emp_code)
);

CREATE INDEX IF NOT EXISTS idx_hr_emp_comp_branch ON tbl_hr_employee (comp_id, primary_branch_id, is_active);
CREATE INDEX IF NOT EXISTS idx_hr_emp_dept_desig ON tbl_hr_employee (dept_id, desig_id);
CREATE INDEX IF NOT EXISTS idx_hr_emp_manager ON tbl_hr_employee (reporting_manager_id);


-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 2.6 - System Configuration Matrix & Document Numbering Series
--          Engine Tables (tbl_sys_config, tbl_sys_doc_number_series)
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS seq_config_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sys_config (
    config_id           BIGINT          PRIMARY KEY DEFAULT nextval('seq_config_id'),
    config_key          VARCHAR(80)     NOT NULL,
    config_name         VARCHAR(150)    NOT NULL,
    config_group        VARCHAR(50)     NOT NULL DEFAULT 'INVENTORY_VALUATION', -- 'INVENTORY_VALUATION', 'PRODUCTION_SHOPFLOOR', 'QUALITY_CONTROL', 'PROCUREMENT_APPROVAL', 'GST_STATUTORY', 'SECURITY_SESSION'
    data_type           VARCHAR(20)     NOT NULL DEFAULT 'STRING',              -- 'BOOLEAN', 'NUMBER', 'STRING', 'ENUM', 'JSON'
    config_value        VARCHAR(500)    NOT NULL,
    default_value       VARCHAR(500)    NOT NULL,
    allowed_values      VARCHAR(500),                                           -- Comma-separated options when data_type = 'ENUM'
    scope_level         VARCHAR(20)     NOT NULL DEFAULT 'GLOBAL',              -- 'GLOBAL', 'COMPANY', 'BRANCH'
    target_comp_id      BIGINT          REFERENCES tbl_org_company(comp_id),
    target_branch_id    BIGINT          REFERENCES tbl_org_branch(branch_id),
    description         VARCHAR(350),
    is_system_locked    BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id             BIGINT          NOT NULL DEFAULT 1001,
    branch_id           BIGINT          NOT NULL DEFAULT 1001,
    fyear_id            BIGINT,
    created_by          BIGINT          NOT NULL,
    created_date        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by          BIGINT,
    updated_date        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sys_config_group_scope ON tbl_sys_config (config_group, scope_level, is_active);
CREATE INDEX IF NOT EXISTS idx_sys_config_key ON tbl_sys_config (config_key, target_comp_id, target_branch_id);


CREATE SEQUENCE IF NOT EXISTS seq_doc_series_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_sys_doc_number_series (
    series_id               BIGINT          PRIMARY KEY DEFAULT nextval('seq_doc_series_id'),
    series_code             VARCHAR(40)     NOT NULL,
    series_name             VARCHAR(120)    NOT NULL,
    doc_type_code           VARCHAR(40)     NOT NULL, -- 'PO', 'GRN', 'QC_INSP', 'MAT_ISSUE', 'WORK_ORDER', 'PROD_RECEIPT', 'SALES_ORDER', 'DELIVERY_CHALLAN', 'SALES_INVOICE', 'JOB_WORK_OUT'
    doc_type_name           VARCHAR(100)    NOT NULL,
    module_name             VARCHAR(40)     NOT NULL DEFAULT 'PROCUREMENT', -- 'PROCUREMENT', 'INVENTORY_WMS', 'QUALITY', 'PRODUCTION', 'SALES_DISPATCH'
    target_comp_id          BIGINT          NOT NULL REFERENCES tbl_org_company(comp_id),
    target_branch_id        BIGINT          NOT NULL REFERENCES tbl_org_branch(branch_id),
    target_fyear_id         BIGINT          NOT NULL REFERENCES tbl_org_financial_year(fyear_id),
    prefix_template         VARCHAR(50)     NOT NULL,
    suffix_template         VARCHAR(30),
    separator_char          VARCHAR(5)      NOT NULL DEFAULT '/',
    padding_digits          INT             NOT NULL DEFAULT 4,
    starting_no             INT             NOT NULL DEFAULT 1,
    current_next_no         INT             NOT NULL DEFAULT 1,
    reset_frequency         VARCHAR(20)     NOT NULL DEFAULT 'FYEAR', -- 'FYEAR', 'MONTHLY', 'NEVER'
    allow_manual_override   BOOLEAN         NOT NULL DEFAULT FALSE,
    is_default              BOOLEAN         NOT NULL DEFAULT TRUE,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                 BIGINT          NOT NULL DEFAULT 1001,
    branch_id               BIGINT          NOT NULL DEFAULT 1001,
    fyear_id                BIGINT,
    created_by              BIGINT          NOT NULL,
    created_date            TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by              BIGINT,
    updated_date            TIMESTAMPTZ,
    CONSTRAINT uq_sys_doc_series_code UNIQUE (target_comp_id, target_branch_id, target_fyear_id, series_code)
);

CREATE INDEX IF NOT EXISTS idx_sys_doc_series_lookup ON tbl_sys_doc_number_series (target_comp_id, target_branch_id, target_fyear_id, doc_type_code, is_active);


-- ============================================================================
-- DATE: 2026-10-17
-- FEATURE: Step 3.1 - Multi-Level Warehouse, Zone, Rack, Shelf & Bin Hierarchy
--          Master Tables (tbl_inv_warehouse, tbl_inv_storage_bin)
-- ============================================================================

CREATE SEQUENCE IF NOT EXISTS seq_warehouse_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_warehouse (
    warehouse_id            BIGINT          PRIMARY KEY DEFAULT nextval('seq_warehouse_id'),
    warehouse_code          VARCHAR(30)     NOT NULL,
    warehouse_name          VARCHAR(120)    NOT NULL,
    warehouse_type          VARCHAR(30)     NOT NULL DEFAULT 'RAW_MATERIAL', -- 'RAW_MATERIAL', 'WIP_SHOPFLOOR', 'FINISHED_GOODS', 'QUARANTINE_QC', 'SCRAP_REJECTION', 'TOOL_CRIB', 'BONDED_EXCISE'
    target_comp_id          BIGINT          NOT NULL REFERENCES tbl_org_company(comp_id),
    target_branch_id        BIGINT          NOT NULL REFERENCES tbl_org_branch(branch_id),
    incharge_employee_id    BIGINT          REFERENCES tbl_hr_employee(employee_id),
    allow_negative_stock    BOOLEAN         NOT NULL DEFAULT FALSE,
    is_qc_hold_store        BOOLEAN         NOT NULL DEFAULT FALSE,
    is_shopfloor_wip        BOOLEAN         NOT NULL DEFAULT FALSE,
    storage_temp_min_c      NUMERIC(6,2),
    storage_temp_max_c      NUMERIC(6,2),
    address_location        VARCHAR(250),
    is_default              BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                 BIGINT          NOT NULL DEFAULT 1001,
    branch_id               BIGINT          NOT NULL DEFAULT 1001,
    fyear_id                BIGINT,
    created_by              BIGINT          NOT NULL,
    created_date            TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by              BIGINT,
    updated_date            TIMESTAMPTZ,
    CONSTRAINT uq_inv_warehouse_code UNIQUE (target_comp_id, target_branch_id, warehouse_code)
);

CREATE INDEX IF NOT EXISTS idx_inv_warehouse_branch_type ON tbl_inv_warehouse (target_comp_id, target_branch_id, warehouse_type, is_active);


CREATE SEQUENCE IF NOT EXISTS seq_storage_bin_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_storage_bin (
    bin_id                  BIGINT          PRIMARY KEY DEFAULT nextval('seq_storage_bin_id'),
    warehouse_id            BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    bin_code                VARCHAR(50)     NOT NULL, -- e.g. 'RM-Z1-R01-S01-B01'
    bin_name                VARCHAR(120)    NOT NULL,
    zone_code               VARCHAR(25)     NOT NULL, -- Level 1: Storage Zone (e.g. 'Z1-HEAVY', 'Z2-BAR', 'QC-BAY')
    rack_code               VARCHAR(25)     NOT NULL DEFAULT 'R01', -- Level 2: Aisle / Rack
    shelf_level             VARCHAR(25)     NOT NULL DEFAULT 'S01', -- Level 3: Shelf / Level
    bin_position            VARCHAR(25)     NOT NULL DEFAULT 'B01', -- Level 4: Bin / Compartment
    bin_type                VARCHAR(30)     NOT NULL DEFAULT 'PALLET_RACK', -- 'PALLET_RACK', 'CANTILEVER_BAR', 'FLOOR_BULK', 'SMALL_PARTS_TOTE', 'QUARANTINE_CAGE', 'LINESIDE_KANBAN'
    max_weight_kg           NUMERIC(12,2)   NOT NULL DEFAULT 1000.00,
    max_volume_cbm          NUMERIC(10,3),
    allow_mixed_items       BOOLEAN         NOT NULL DEFAULT TRUE,
    allow_mixed_batches     BOOLEAN         NOT NULL DEFAULT FALSE,
    is_pick_face            BOOLEAN         NOT NULL DEFAULT TRUE,
    is_receiving_staging    BOOLEAN         NOT NULL DEFAULT FALSE,
    is_blocked_for_putaway  BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                 BIGINT          NOT NULL DEFAULT 1001,
    branch_id               BIGINT          NOT NULL DEFAULT 1001,
    fyear_id                BIGINT,
    created_by              BIGINT          NOT NULL,
    created_date            TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by              BIGINT,
    updated_date            TIMESTAMPTZ,
    CONSTRAINT uq_inv_warehouse_bin_code UNIQUE (warehouse_id, bin_code)
);

CREATE INDEX IF NOT EXISTS idx_inv_storage_bin_wh_zone ON tbl_inv_storage_bin (warehouse_id, zone_code, rack_code, is_active);


-- ============================================================================
-- 13. Unit of Measurement Master (tbl_inv_uom)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_uom_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_uom (
    uom_id                  BIGINT          PRIMARY KEY DEFAULT nextval('seq_uom_id'),
    uom_code                VARCHAR(20)     NOT NULL,
    uom_name                VARCHAR(100)    NOT NULL,
    uom_type                VARCHAR(30)     NOT NULL DEFAULT 'COUNT',
    decimal_precision       SMALLINT        NOT NULL DEFAULT 0,
    gst_uqc_code            VARCHAR(10)     NOT NULL,
    is_base_uom             BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                 BIGINT          NOT NULL DEFAULT 1001,
    branch_id               BIGINT          NOT NULL DEFAULT 1001,
    fyear_id                BIGINT,
    created_by              BIGINT          NOT NULL,
    created_date            TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by              BIGINT,
    updated_date            TIMESTAMPTZ,
    CONSTRAINT uq_inv_uom_code UNIQUE (uom_code)
);

CREATE INDEX IF NOT EXISTS idx_inv_uom_type ON tbl_inv_uom (uom_type, is_active);

-- ============================================================================
-- 14. Unit of Measurement Conversion Matrix (tbl_inv_uom_conversion)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_uom_conversion_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_uom_conversion (
    conversion_id           BIGINT          PRIMARY KEY DEFAULT nextval('seq_uom_conversion_id'),
    from_uom_id             BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    to_uom_id               BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    conversion_factor       NUMERIC(18, 6)  NOT NULL,
    inverse_factor          NUMERIC(18, 6)  NOT NULL,
    conversion_type         VARCHAR(30)     NOT NULL DEFAULT 'STANDARD',
    remarks                 VARCHAR(255),
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                 BIGINT          NOT NULL DEFAULT 1001,
    branch_id               BIGINT          NOT NULL DEFAULT 1001,
    fyear_id                BIGINT,
    created_by              BIGINT          NOT NULL,
    created_date            TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by              BIGINT,
    updated_date            TIMESTAMPTZ,
    CONSTRAINT uq_inv_uom_conversion UNIQUE (from_uom_id, to_uom_id),
    CONSTRAINT chk_inv_uom_not_same CHECK (from_uom_id <> to_uom_id),
    CONSTRAINT chk_conv_factor_gt_zero CHECK (conversion_factor > 0)
);

CREATE INDEX IF NOT EXISTS idx_inv_uom_conv_lookup ON tbl_inv_uom_conversion (from_uom_id, to_uom_id, is_active);

-- ============================================================================
-- 15. Item Category & Grouping Hierarchy Master (tbl_inv_item_category)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_item_category_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_item_category (
    category_id             BIGINT          PRIMARY KEY DEFAULT nextval('seq_item_category_id'),
    category_code           VARCHAR(50)     NOT NULL,
    category_name           VARCHAR(100)    NOT NULL,
    parent_category_id      BIGINT          REFERENCES tbl_inv_item_category(category_id),
    category_type           VARCHAR(30)     NOT NULL DEFAULT 'RAW_MATERIAL',
    hsn_sac_code            VARCHAR(20),
    default_tax_rate        NUMERIC(5, 2)   NOT NULL DEFAULT 18.00,
    default_valuation_method VARCHAR(20)    NOT NULL DEFAULT 'FIFO',
    level_depth             SMALLINT        NOT NULL DEFAULT 1,
    hierarchy_path          VARCHAR(255)    NOT NULL,
    is_leaf                 BOOLEAN         NOT NULL DEFAULT TRUE,
    is_active               BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                 BIGINT          NOT NULL DEFAULT 1001,
    branch_id               BIGINT          NOT NULL DEFAULT 1001,
    fyear_id                BIGINT,
    created_by              BIGINT          NOT NULL,
    created_date            TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by              BIGINT,
    updated_date            TIMESTAMPTZ,
    CONSTRAINT uq_inv_item_category_code UNIQUE (category_code)
);

CREATE INDEX IF NOT EXISTS idx_inv_item_category_parent ON tbl_inv_item_category (parent_category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inv_item_category_type ON tbl_inv_item_category (category_type, is_active);


-- ============================================================================
-- 16. Item & Material Master (tbl_inv_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_item (
    item_id                     BIGINT          PRIMARY KEY DEFAULT nextval('seq_item_id'),
    item_code                   VARCHAR(50)     NOT NULL,
    item_name                   VARCHAR(150)    NOT NULL,
    category_id                 BIGINT          NOT NULL REFERENCES tbl_inv_item_category(category_id),
    item_type                   VARCHAR(30)     NOT NULL DEFAULT 'RAW_MATERIAL', -- 'RAW_MATERIAL', 'WIP_SEMI_FINISHED', 'FINISHED_GOODS', 'PACKING_MATERIAL', 'CONSUMABLE_MRO', 'TOOLING_DIE', 'SCRAP'
    description                 VARCHAR(500),
    base_uom_id                 BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    purchase_uom_id             BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    sales_uom_id                BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    hsn_sac_code                VARCHAR(20),
    tax_rate                    NUMERIC(5, 2)   NOT NULL DEFAULT 18.00,
    standard_cost               NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    purchase_rate               NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    sales_rate                  NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    min_stock_level             NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    max_stock_level             NUMERIC(14, 3),
    reorder_point               NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    safety_stock                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    lead_time_days              INTEGER         NOT NULL DEFAULT 7,
    valuation_method            VARCHAR(20)     NOT NULL DEFAULT 'FIFO', -- 'FIFO', 'WEIGHTED_AVG', 'STANDARD_COST'
    is_batch_managed            BOOLEAN         NOT NULL DEFAULT TRUE,
    is_serial_managed           BOOLEAN         NOT NULL DEFAULT FALSE,
    is_qc_inspection_required   BOOLEAN         NOT NULL DEFAULT TRUE,
    shelf_life_days             INTEGER,
    default_warehouse_id        BIGINT          REFERENCES tbl_inv_warehouse(warehouse_id),
    default_bin_id              BIGINT          REFERENCES tbl_inv_storage_bin(bin_id),
    drawing_no                  VARCHAR(60),
    revision_no                 VARCHAR(20),
    weight_per_unit_kg          NUMERIC(12, 4),
    is_bom_allowed              BOOLEAN         NOT NULL DEFAULT TRUE,
    yield_percentage            NUMERIC(5, 2)   NOT NULL DEFAULT 100.00,
    inspection_lead_time_days   INTEGER         NOT NULL DEFAULT 1,
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_inv_item_code UNIQUE (comp_id, item_code)
);

CREATE INDEX IF NOT EXISTS idx_inv_item_comp_cat ON tbl_inv_item (comp_id, category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inv_item_type ON tbl_inv_item (comp_id, item_type, is_active);
CREATE INDEX IF NOT EXISTS idx_inv_item_name ON tbl_inv_item (comp_id, item_name);




