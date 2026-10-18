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


-- ============================================================================
-- 17. Unified Customer, Supplier, Subcontractor & Transporter Master (tbl_crm_party)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_party_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_crm_party (
    party_id                    BIGINT          PRIMARY KEY DEFAULT nextval('seq_party_id'),
    party_code                  VARCHAR(40)     NOT NULL,
    party_name                  VARCHAR(150)    NOT NULL,
    trade_name                  VARCHAR(150),
    is_customer                 BOOLEAN         NOT NULL DEFAULT TRUE,
    is_supplier                 BOOLEAN         NOT NULL DEFAULT FALSE,
    is_job_worker               BOOLEAN         NOT NULL DEFAULT FALSE,
    is_transporter              BOOLEAN         NOT NULL DEFAULT FALSE,
    party_group                 VARCHAR(50)     NOT NULL DEFAULT 'OEM_AUTOMOTIVE', -- 'OEM_AUTOMOTIVE', 'TIER_1_EXPORT', 'HEAVY_ENGINEERING', 'RAW_MATERIAL_VENDOR', 'CONSUMABLE_VENDOR', 'JOB_WORK_CONTRACTOR', 'LOGISTICS_PARTNER'
    pan_no                      VARCHAR(15),
    msme_reg_no                 VARCHAR(30),
    primary_contact_name        VARCHAR(100)    NOT NULL,
    primary_email               VARCHAR(150),
    primary_phone               VARCHAR(25)     NOT NULL,
    website                     VARCHAR(150),
    credit_limit                NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    credit_days                 INTEGER         NOT NULL DEFAULT 30,
    payment_terms               VARCHAR(40)     NOT NULL DEFAULT 'NET_30', -- 'IMMEDIATE', 'NET_15', 'NET_30', 'NET_45', 'NET_60', 'NET_90', 'ADVANCE'
    currency_code               VARCHAR(5)      NOT NULL DEFAULT 'INR',
    gst_treatment_type          VARCHAR(30)     NOT NULL DEFAULT 'REGISTERED_REGULAR', -- 'REGISTERED_REGULAR', 'REGISTERED_COMPOSITION', 'UNREGISTERED', 'SEZ_DEVELOPER', 'OVERSEAS_EXPORT'
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    remarks                     VARCHAR(350),
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_crm_party_code UNIQUE (comp_id, party_code)
);

CREATE INDEX IF NOT EXISTS idx_crm_party_comp_roles ON tbl_crm_party (comp_id, is_customer, is_supplier, is_job_worker, is_transporter, is_active);
CREATE INDEX IF NOT EXISTS idx_crm_party_name ON tbl_crm_party (comp_id, party_name);
CREATE INDEX IF NOT EXISTS idx_crm_party_group ON tbl_crm_party (comp_id, party_group, is_active);


-- ============================================================================
-- 18. Party Multi-Location Billing & Shipping Addresses (tbl_crm_party_address)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_party_address_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_crm_party_address (
    address_id                  BIGINT          PRIMARY KEY DEFAULT nextval('seq_party_address_id'),
    party_id                    BIGINT          NOT NULL REFERENCES tbl_crm_party(party_id) ON DELETE CASCADE,
    address_label               VARCHAR(80)     NOT NULL DEFAULT 'Head Office / Billing',
    address_type                VARCHAR(30)     NOT NULL DEFAULT 'BOTH', -- 'BILLING', 'SHIPPING', 'BOTH', 'PLANT_SITE'
    gstin                       VARCHAR(20),
    state_code                  VARCHAR(5)      NOT NULL DEFAULT '24',
    state_name                  VARCHAR(80)     NOT NULL DEFAULT 'Gujarat',
    address_line1               VARCHAR(200)    NOT NULL,
    address_line2               VARCHAR(200),
    city                        VARCHAR(80)     NOT NULL,
    pincode                     VARCHAR(15)     NOT NULL,
    contact_person              VARCHAR(100),
    phone                       VARCHAR(25),
    email                       VARCHAR(150),
    is_default_billing          BOOLEAN         NOT NULL DEFAULT FALSE,
    is_default_shipping         BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crm_party_address_lookup ON tbl_crm_party_address (party_id, address_type, is_active);
CREATE INDEX IF NOT EXISTS idx_crm_party_address_gstin ON tbl_crm_party_address (gstin);







-- ============================================================================
-- 19. Tiered Price Lists & Rate Contracts (tbl_crm_price_list)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_price_list_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_crm_price_list (
    price_list_id               BIGINT          PRIMARY KEY DEFAULT nextval('seq_price_list_id'),
    price_list_code             VARCHAR(50)     NOT NULL,
    price_list_name             VARCHAR(150)    NOT NULL,
    price_list_type             VARCHAR(30)     NOT NULL DEFAULT 'SALES', -- 'SALES', 'PURCHASE', 'JOB_WORK'
    currency_code               VARCHAR(10)     NOT NULL DEFAULT 'INR',
    effective_from              DATE            NOT NULL DEFAULT CURRENT_DATE,
    effective_to                DATE,
    is_default                  BOOLEAN         NOT NULL DEFAULT FALSE,
    description                 VARCHAR(350),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_crm_price_list_code UNIQUE (comp_id, price_list_code)
);

CREATE INDEX IF NOT EXISTS idx_crm_price_list_type ON tbl_crm_price_list (comp_id, price_list_type, is_active);
CREATE INDEX IF NOT EXISTS idx_crm_price_list_effective ON tbl_crm_price_list (effective_from, effective_to);

-- ============================================================================
-- 20. Price List Line Items & Volume Discount Tiers (tbl_crm_price_list_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_price_list_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_crm_price_list_item (
    price_list_item_id          BIGINT          PRIMARY KEY DEFAULT nextval('seq_price_list_item_id'),
    price_list_id               BIGINT          NOT NULL REFERENCES tbl_crm_price_list(price_list_id) ON DELETE CASCADE,
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    min_qty                     NUMERIC(14, 3)  NOT NULL DEFAULT 1.000,
    max_qty                     NUMERIC(14, 3),
    base_rate                   NUMERIC(14, 4)  NOT NULL,
    discount_pct                NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    effective_rate              NUMERIC(14, 4)  NOT NULL,
    lead_time_days              INTEGER         NOT NULL DEFAULT 0,
    remarks                     VARCHAR(250),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_crm_price_list_item UNIQUE (price_list_id, item_id, min_qty)
);

CREATE INDEX IF NOT EXISTS idx_crm_price_list_item_lookup ON tbl_crm_price_list_item (price_list_id, item_id, is_active);

-- ============================================================================
-- 21. Party & Price List Association Mapping (tbl_crm_party_price_list)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_party_price_list_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_crm_party_price_list (
    party_price_list_id         BIGINT          PRIMARY KEY DEFAULT nextval('seq_party_price_list_id'),
    party_id                    BIGINT          NOT NULL REFERENCES tbl_crm_party(party_id) ON DELETE CASCADE,
    price_list_id               BIGINT          NOT NULL REFERENCES tbl_crm_price_list(price_list_id) ON DELETE CASCADE,
    is_primary                  BOOLEAN         NOT NULL DEFAULT TRUE,
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_crm_party_price_list UNIQUE (party_id, price_list_id)
);

CREATE INDEX IF NOT EXISTS idx_crm_party_price_list_party ON tbl_crm_party_price_list (party_id, is_active);
CREATE INDEX IF NOT EXISTS idx_crm_party_price_list_pl ON tbl_crm_party_price_list (price_list_id, is_active);


-- ============================================================================
-- 22. Material Purchase Requisition Header (tbl_pr_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_pr_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_pr_header (
    pr_id                       BIGINT          PRIMARY KEY DEFAULT nextval('seq_pr_id'),
    pr_no                       VARCHAR(50)     NOT NULL,
    pr_date                     DATE            NOT NULL DEFAULT CURRENT_DATE,
    required_by_date            DATE            NOT NULL,
    department_id               BIGINT          NOT NULL REFERENCES tbl_hr_department(dept_id),
    requester_user_id           BIGINT          NOT NULL REFERENCES tbl_sec_user(user_id),
    warehouse_id                BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    priority                    VARCHAR(20)     NOT NULL DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL_URGENT'
    pr_type                     VARCHAR(30)     NOT NULL DEFAULT 'RAW_MATERIAL', -- 'RAW_MATERIAL', 'CAPITAL_ASSET', 'CONSUMABLE_MRO', 'TOOLING_SPARE', 'JOB_WORK_SERVICE'
    status                      VARCHAR(20)     NOT NULL DEFAULT 'DRAFT', -- 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CONVERTED', 'CANCELLED'
    total_estimated_amount      NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    purpose                     VARCHAR(350)    NOT NULL,
    approval_remarks            VARCHAR(350),
    approved_by                 BIGINT          REFERENCES tbl_sec_user(user_id),
    approved_date               TIMESTAMPTZ,
    rejected_by                 BIGINT          REFERENCES tbl_sec_user(user_id),
    rejected_date               TIMESTAMPTZ,
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_pr_header_no UNIQUE (comp_id, pr_no)
);

CREATE INDEX IF NOT EXISTS idx_pr_header_comp_status ON tbl_pr_header (comp_id, status, is_active);
CREATE INDEX IF NOT EXISTS idx_pr_header_dept ON tbl_pr_header (department_id);
CREATE INDEX IF NOT EXISTS idx_pr_header_branch ON tbl_pr_header (branch_id);
CREATE INDEX IF NOT EXISTS idx_pr_header_req_date ON tbl_pr_header (required_by_date);

-- ============================================================================
-- 23. Material Purchase Requisition Line Items (tbl_pr_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_pr_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_pr_item (
    pr_item_id                  BIGINT          PRIMARY KEY DEFAULT nextval('seq_pr_item_id'),
    pr_id                       BIGINT          NOT NULL REFERENCES tbl_pr_header(pr_id) ON DELETE CASCADE,
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    required_qty                NUMERIC(14, 3)  NOT NULL,
    approved_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    ordered_qty                 NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    estimated_rate              NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    estimated_amount            NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    suggested_vendor_id         BIGINT          REFERENCES tbl_crm_party(party_id),
    remarks                     VARCHAR(250),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_pr_item UNIQUE (pr_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_pr_item_lookup ON tbl_pr_item (pr_id, item_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pr_item_vendor ON tbl_pr_item (suggested_vendor_id);

-- ============================================================================
-- 24. Supplier Request for Quotation Header (tbl_rfq_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_rfq_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_rfq_header (
    rfq_id                      BIGINT          PRIMARY KEY DEFAULT nextval('seq_rfq_id'),
    rfq_no                      VARCHAR(50)     NOT NULL,
    rfq_date                    DATE            NOT NULL DEFAULT CURRENT_DATE,
    due_date                    DATE            NOT NULL,
    warehouse_id                BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    status                      VARCHAR(25)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'SENT', 'QUOTES_RECEIVED', 'COMPARISON_DONE', 'AWARDED', 'CANCELLED')),
    payment_terms               VARCHAR(150),
    delivery_terms              VARCHAR(150),
    remarks                     VARCHAR(350),
    awarded_vendor_id           BIGINT          REFERENCES tbl_crm_party(party_id),
    awarded_date                TIMESTAMPTZ,
    awarded_remarks             VARCHAR(350),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_rfq_header_no UNIQUE (comp_id, rfq_no)
);

CREATE INDEX IF NOT EXISTS idx_rfq_header_comp_status ON tbl_rfq_header (comp_id, status, is_active);
CREATE INDEX IF NOT EXISTS idx_rfq_header_due_date ON tbl_rfq_header (due_date);
CREATE INDEX IF NOT EXISTS idx_rfq_header_wh ON tbl_rfq_header (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_rfq_header_awarded_vendor ON tbl_rfq_header (awarded_vendor_id);

-- ============================================================================
-- 25. Supplier RFQ Line Items (tbl_rfq_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_rfq_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_rfq_item (
    rfq_item_id                 BIGINT          PRIMARY KEY DEFAULT nextval('seq_rfq_item_id'),
    rfq_id                      BIGINT          NOT NULL REFERENCES tbl_rfq_header(rfq_id) ON DELETE CASCADE,
    pr_item_id                  BIGINT          REFERENCES tbl_pr_item(pr_item_id),
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    required_qty                NUMERIC(14, 3)  NOT NULL,
    target_rate                 NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    technical_specs             VARCHAR(350),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_rfq_item UNIQUE (rfq_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_rfq_item_lookup ON tbl_rfq_item (rfq_id, item_id, is_active);
CREATE INDEX IF NOT EXISTS idx_rfq_item_pr ON tbl_rfq_item (pr_item_id);

-- ============================================================================
-- 26. Supplier RFQ Invited Vendors (tbl_rfq_vendor)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_rfq_vendor_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_rfq_vendor (
    rfq_vendor_id               BIGINT          PRIMARY KEY DEFAULT nextval('seq_rfq_vendor_id'),
    rfq_id                      BIGINT          NOT NULL REFERENCES tbl_rfq_header(rfq_id) ON DELETE CASCADE,
    party_id                    BIGINT          NOT NULL REFERENCES tbl_crm_party(party_id),
    invitation_date             TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status                      VARCHAR(25)     NOT NULL DEFAULT 'INVITED'
                                                CHECK (status IN ('INVITED', 'QUOTED', 'DECLINED', 'SELECTED')),
    vendor_quote_ref            VARCHAR(100),
    quote_date                  DATE,
    total_quote_amount          NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    payment_terms               VARCHAR(150),
    delivery_lead_time_days     INT             DEFAULT 0,
    vendor_remarks              VARCHAR(350),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_rfq_vendor UNIQUE (rfq_id, party_id)
);

CREATE INDEX IF NOT EXISTS idx_rfq_vendor_rfq ON tbl_rfq_vendor (rfq_id, party_id, is_active);
CREATE INDEX IF NOT EXISTS idx_rfq_vendor_party ON tbl_rfq_vendor (party_id);

-- ============================================================================
-- 27. RFQ Vendor Quotation Line Items (tbl_rfq_vendor_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_rfq_vendor_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_rfq_vendor_item (
    rfq_vendor_item_id          BIGINT          PRIMARY KEY DEFAULT nextval('seq_rfq_vendor_item_id'),
    rfq_vendor_id               BIGINT          NOT NULL REFERENCES tbl_rfq_vendor(rfq_vendor_id) ON DELETE CASCADE,
    rfq_item_id                 BIGINT          NOT NULL REFERENCES tbl_rfq_item(rfq_item_id) ON DELETE CASCADE,
    offered_qty                 NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    quoted_rate                 NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    discount_pct                NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    net_rate                    NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    tax_pct                     NUMERIC(5, 2)   NOT NULL DEFAULT 18.00,
    total_amount                NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    is_l1                       BOOLEAN         NOT NULL DEFAULT FALSE,
    is_awarded                  BOOLEAN         NOT NULL DEFAULT FALSE,
    remarks                     VARCHAR(250),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_rfq_vendor_item UNIQUE (rfq_vendor_id, rfq_item_id)
);

CREATE INDEX IF NOT EXISTS idx_rfq_vendor_item_lookup ON tbl_rfq_vendor_item (rfq_vendor_id, rfq_item_id, is_active);
CREATE INDEX IF NOT EXISTS idx_rfq_vendor_item_l1 ON tbl_rfq_vendor_item (rfq_item_id, is_l1);

-- ============================================================================
-- 28. Purchase Order Header (tbl_po_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_po_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_po_header (
    po_id                       BIGINT          PRIMARY KEY DEFAULT nextval('seq_po_id'),
    po_no                       VARCHAR(50)     NOT NULL,
    po_date                     DATE            NOT NULL DEFAULT CURRENT_DATE,
    delivery_due_date           DATE            NOT NULL,
    vendor_id                   BIGINT          NOT NULL REFERENCES tbl_crm_party(party_id),
    vendor_address_id           BIGINT          REFERENCES tbl_crm_party_address(address_id),
    warehouse_id                BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    rfq_id                      BIGINT          REFERENCES tbl_rfq_header(rfq_id),
    pr_id                       BIGINT          REFERENCES tbl_pr_header(pr_id),
    po_type                     VARCHAR(30)     NOT NULL DEFAULT 'STANDARD_PO'
                                                CHECK (po_type IN ('STANDARD_PO', 'BLANKET_PO', 'JOB_WORK_PO', 'SERVICE_PO')),
    status                      VARCHAR(25)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'RELEASED', 'PARTIALLY_RECEIVED', 'CLOSED', 'CANCELLED')),
    payment_terms               VARCHAR(150),
    delivery_terms              VARCHAR(150),
    freight_terms               VARCHAR(100),
    subtotal_amount             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    discount_amount             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    tax_amount                  NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    roundoff_amount             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    net_total_amount            NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    notes                       VARCHAR(500),
    approved_by                 BIGINT          REFERENCES tbl_sec_user(user_id),
    approved_date               TIMESTAMPTZ,
    released_by                 BIGINT          REFERENCES tbl_sec_user(user_id),
    released_date               TIMESTAMPTZ,
    cancellation_reason         VARCHAR(350),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_po_header_no UNIQUE (comp_id, po_no)
);

CREATE INDEX IF NOT EXISTS idx_po_header_comp_status ON tbl_po_header (comp_id, status, is_active);
CREATE INDEX IF NOT EXISTS idx_po_header_vendor ON tbl_po_header (vendor_id);
CREATE INDEX IF NOT EXISTS idx_po_header_dates ON tbl_po_header (po_date, delivery_due_date);
CREATE INDEX IF NOT EXISTS idx_po_header_wh ON tbl_po_header (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_po_header_rfq ON tbl_po_header (rfq_id);
CREATE INDEX IF NOT EXISTS idx_po_header_pr ON tbl_po_header (pr_id);

-- ============================================================================
-- 29. Purchase Order Line Items (tbl_po_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_po_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_po_item (
    po_item_id                  BIGINT          PRIMARY KEY DEFAULT nextval('seq_po_item_id'),
    po_id                       BIGINT          NOT NULL REFERENCES tbl_po_header(po_id) ON DELETE CASCADE,
    pr_item_id                  BIGINT          REFERENCES tbl_pr_item(pr_item_id),
    rfq_item_id                 BIGINT          REFERENCES tbl_rfq_item(rfq_item_id),
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    order_qty                   NUMERIC(14, 3)  NOT NULL,
    unit_rate                   NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    discount_pct                NUMERIC(5, 2)   NOT NULL DEFAULT 0.00,
    discount_amount             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    tax_pct                     NUMERIC(5, 2)   NOT NULL DEFAULT 18.00,
    tax_amount                  NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    net_amount                  NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    received_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    billed_qty                  NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    delivery_date               DATE,
    technical_specs             VARCHAR(350),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_po_item UNIQUE (po_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_po_item_po ON tbl_po_item (po_id, item_id, is_active);
CREATE INDEX IF NOT EXISTS idx_po_item_pr ON tbl_po_item (pr_item_id);
CREATE INDEX IF NOT EXISTS idx_po_item_rfq ON tbl_po_item (rfq_item_id);


-- ============================================================================
-- 30. Security Gate Inward Entry (tbl_gate_inward_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_gate_inward_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_gate_inward_header (
    gate_inward_id              BIGINT          PRIMARY KEY DEFAULT nextval('seq_gate_inward_id'),
    gate_inward_no              VARCHAR(50)     NOT NULL,
    inward_date                 DATE            NOT NULL,
    inward_time                 VARCHAR(10)     NOT NULL DEFAULT TO_CHAR(CURRENT_TIMESTAMP, 'HH12:MI AM'),
    warehouse_id                BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    vendor_id                   BIGINT          NOT NULL REFERENCES tbl_crm_party(party_id),
    po_id                       BIGINT          REFERENCES tbl_po_header(po_id),
    challan_no                  VARCHAR(100)    NOT NULL,
    challan_date                DATE            NOT NULL,
    vehicle_no                  VARCHAR(50)     NOT NULL,
    transporter_name            VARCHAR(150),
    driver_name                 VARCHAR(100),
    driver_phone                VARCHAR(30),
    eway_bill_no                VARCHAR(50),
    lr_no                       VARCHAR(50),
    lr_date                     DATE,
    gross_weight                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    tare_weight                 NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    net_weight                  NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    total_packages              INT             NOT NULL DEFAULT 1,
    status                      VARCHAR(25)     NOT NULL DEFAULT 'INWARDED'
                                                CHECK (status IN ('INWARDED', 'UNLOADED', 'GRN_PENDING', 'COMPLETED', 'CANCELLED')),
    security_remarks            VARCHAR(350),
    unloaded_date               TIMESTAMPTZ,
    unloaded_by                 BIGINT          REFERENCES tbl_sec_user(user_id),
    unloading_remarks           VARCHAR(350),
    exit_date                   TIMESTAMPTZ,
    exit_remarks                VARCHAR(350),
    cancel_reason               VARCHAR(350),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_gate_inward_header_no UNIQUE (comp_id, gate_inward_no)
);

CREATE INDEX IF NOT EXISTS idx_gate_inward_comp_status ON tbl_gate_inward_header (comp_id, status, is_active);
CREATE INDEX IF NOT EXISTS idx_gate_inward_vendor ON tbl_gate_inward_header (vendor_id);
CREATE INDEX IF NOT EXISTS idx_gate_inward_warehouse ON tbl_gate_inward_header (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_gate_inward_po ON tbl_gate_inward_header (po_id);
CREATE INDEX IF NOT EXISTS idx_gate_inward_vehicle ON tbl_gate_inward_header (vehicle_no);
CREATE INDEX IF NOT EXISTS idx_gate_inward_dates ON tbl_gate_inward_header (inward_date, created_date);

-- ============================================================================
-- 31. Gate Inward Consignment Items (tbl_gate_inward_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_gate_inward_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_gate_inward_item (
    gate_inward_item_id         BIGINT          PRIMARY KEY DEFAULT nextval('seq_gate_inward_item_id'),
    gate_inward_id              BIGINT          NOT NULL REFERENCES tbl_gate_inward_header(gate_inward_id) ON DELETE CASCADE,
    po_item_id                  BIGINT          REFERENCES tbl_po_item(po_item_id),
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    item_description            VARCHAR(250),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    challan_qty                 NUMERIC(14, 3)  NOT NULL,
    package_count               INT             NOT NULL DEFAULT 1,
    remarks                     VARCHAR(250),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_gate_inward_item UNIQUE (gate_inward_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_gate_inward_item_gin ON tbl_gate_inward_item (gate_inward_id, item_id, is_active);
CREATE INDEX IF NOT EXISTS idx_gate_inward_item_po_item ON tbl_gate_inward_item (po_item_id);


-- ============================================================================
-- 32. Goods Receipt Note Header (tbl_inv_grn_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_grn_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_grn_header (
    grn_id                      BIGINT          PRIMARY KEY DEFAULT nextval('seq_grn_id'),
    grn_no                      VARCHAR(50)     NOT NULL, -- e.g. 'GRN-AHM-2627-0001'
    grn_date                    DATE            NOT NULL,
    warehouse_id                BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    vendor_id                   BIGINT          NOT NULL REFERENCES tbl_crm_party(party_id),
    po_id                       BIGINT          REFERENCES tbl_po_header(po_id),
    gate_inward_id              BIGINT          REFERENCES tbl_gate_inward_header(gate_inward_id),
    challan_no                  VARCHAR(100)    NOT NULL,
    challan_date                DATE            NOT NULL,
    invoice_no                  VARCHAR(100),
    invoice_date                DATE,
    vehicle_no                  VARCHAR(50),
    eway_bill_no                VARCHAR(50),
    lr_no                       VARCHAR(50),
    lr_date                     DATE,
    total_received_amount       NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    status                      VARCHAR(25)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'SUBMITTED', 'QC_IN_PROGRESS', 'APPROVED', 'CANCELLED')),
    store_remarks               VARCHAR(350),
    inspected_by                BIGINT          REFERENCES tbl_sec_user(user_id),
    inspection_date             TIMESTAMPTZ,
    approved_by                 BIGINT          REFERENCES tbl_sec_user(user_id),
    approval_date               TIMESTAMPTZ,
    approval_remarks            VARCHAR(350),
    cancel_reason               VARCHAR(350),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_inv_grn_header_no UNIQUE (comp_id, grn_no)
);

CREATE INDEX IF NOT EXISTS idx_inv_grn_header_comp_status ON tbl_inv_grn_header (comp_id, status, is_active);
CREATE INDEX IF NOT EXISTS idx_inv_grn_header_vendor ON tbl_inv_grn_header (vendor_id);
CREATE INDEX IF NOT EXISTS idx_inv_grn_header_warehouse ON tbl_inv_grn_header (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inv_grn_header_po ON tbl_inv_grn_header (po_id);
CREATE INDEX IF NOT EXISTS idx_inv_grn_header_gate_inward ON tbl_inv_grn_header (gate_inward_id);
CREATE INDEX IF NOT EXISTS idx_inv_grn_header_dates ON tbl_inv_grn_header (grn_date, created_date);

-- ============================================================================
-- 33. Goods Receipt Note Line Items (tbl_inv_grn_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_grn_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_grn_item (
    grn_item_id                 BIGINT          PRIMARY KEY DEFAULT nextval('seq_grn_item_id'),
    grn_id                      BIGINT          NOT NULL REFERENCES tbl_inv_grn_header(grn_id) ON DELETE CASCADE,
    po_item_id                  BIGINT          REFERENCES tbl_po_item(po_item_id),
    gate_inward_item_id         BIGINT          REFERENCES tbl_gate_inward_item(gate_inward_item_id),
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    item_description            VARCHAR(250),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    order_qty                   NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    challan_qty                 NUMERIC(14, 3)  NOT NULL,
    received_qty                NUMERIC(14, 3)  NOT NULL,
    accepted_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    rejected_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    quarantine_qty              NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    shortage_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    excess_qty                  NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    unit_rate                   NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    received_amount             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    batch_no                    VARCHAR(100), -- Supplier Heat / Melt / Batch number
    mfg_date                    DATE,
    expiry_date                 DATE,
    quarantine_bin_id           BIGINT          REFERENCES tbl_inv_storage_bin(bin_id),
    storage_bin_id              BIGINT          REFERENCES tbl_inv_storage_bin(bin_id),
    is_qc_required              BOOLEAN         NOT NULL DEFAULT TRUE,
    remarks                     VARCHAR(250),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_inv_grn_item UNIQUE (grn_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_inv_grn_item_grn ON tbl_inv_grn_item (grn_id, item_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inv_grn_item_po_item ON tbl_inv_grn_item (po_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_grn_item_batch ON tbl_inv_grn_item (batch_no);
CREATE INDEX IF NOT EXISTS idx_inv_grn_item_qbin ON tbl_inv_grn_item (quarantine_bin_id);

-- ============================================================================
-- 34. Inward Material QC Inspection Header (tbl_qc_inward_inspection_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_qc_inward_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_qc_inward_inspection_header (
    qc_id                       BIGINT          PRIMARY KEY DEFAULT nextval('seq_qc_inward_id'),
    qc_no                       VARCHAR(50)     NOT NULL, -- e.g. 'QC-AHM-2627-0001'
    qc_date                     DATE            NOT NULL,
    grn_id                      BIGINT          NOT NULL REFERENCES tbl_inv_grn_header(grn_id),
    warehouse_id                BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    vendor_id                   BIGINT          NOT NULL REFERENCES tbl_crm_party(party_id),
    po_id                       BIGINT          REFERENCES tbl_po_header(po_id),
    gate_inward_id              BIGINT          REFERENCES tbl_gate_inward_header(gate_inward_id),
    sample_size                 NUMERIC(14, 3)  NOT NULL DEFAULT 1.000,
    inspection_type             VARCHAR(50)     NOT NULL DEFAULT 'INCOMING_RAW_MATERIAL'
                                                CHECK (inspection_type IN ('INCOMING_RAW_MATERIAL', 'SUBCONTRACT_JOBWORK', 'CONSUMABLE_CHEMICAL', 'BOUGHT_OUT_COMPONENT')),
    overall_result              VARCHAR(30)     NOT NULL DEFAULT 'PENDING'
                                                CHECK (overall_result IN ('PENDING', 'ACCEPTED', 'REJECTED', 'ACCEPTED_UNDER_DEVIATION')),
    inspector_id                BIGINT          REFERENCES tbl_sec_user(user_id),
    inspection_date             TIMESTAMPTZ,
    approver_id                 BIGINT          REFERENCES tbl_sec_user(user_id),
    approval_date               TIMESTAMPTZ,
    remarks                     VARCHAR(350),
    deviation_reason            VARCHAR(350),
    test_cert_no                VARCHAR(100), -- Supplier MTC / COA document #
    test_cert_date              DATE,
    status                      VARCHAR(25)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_qc_inward_header_no UNIQUE (comp_id, qc_no)
);

CREATE INDEX IF NOT EXISTS idx_qc_inward_header_comp_status ON tbl_qc_inward_inspection_header (comp_id, status, is_active);
CREATE INDEX IF NOT EXISTS idx_qc_inward_header_grn ON tbl_qc_inward_inspection_header (grn_id);
CREATE INDEX IF NOT EXISTS idx_qc_inward_header_vendor ON tbl_qc_inward_inspection_header (vendor_id);
CREATE INDEX IF NOT EXISTS idx_qc_inward_header_warehouse ON tbl_qc_inward_inspection_header (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_qc_inward_header_dates ON tbl_qc_inward_inspection_header (qc_date, created_date);

-- ============================================================================
-- 35. Inward Material QC Inspection Line Items (tbl_qc_inward_inspection_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_qc_inward_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_qc_inward_inspection_item (
    qc_item_id                 BIGINT          PRIMARY KEY DEFAULT nextval('seq_qc_inward_item_id'),
    qc_id                       BIGINT          NOT NULL REFERENCES tbl_qc_inward_inspection_header(qc_id) ON DELETE CASCADE,
    grn_item_id                 BIGINT          NOT NULL REFERENCES tbl_inv_grn_item(grn_item_id),
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    received_qty                NUMERIC(14, 3)  NOT NULL,
    sample_qty                  NUMERIC(14, 3)  NOT NULL DEFAULT 1.000,
    accepted_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    rejected_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    disposition                 VARCHAR(30)     NOT NULL DEFAULT 'ACCEPTED'
                                                CHECK (disposition IN ('ACCEPTED', 'REJECTED', 'ACCEPTED_UNDER_DEVIATION', 'REWORK')),
    defect_code                 VARCHAR(50),
    batch_no                    VARCHAR(100),
    heat_no                     VARCHAR(100),
    mfg_date                    DATE,
    expiry_date                 DATE,
    quarantine_bin_id           BIGINT          REFERENCES tbl_inv_storage_bin(bin_id),
    destination_bin_id          BIGINT          REFERENCES tbl_inv_storage_bin(bin_id),
    visual_check                VARCHAR(20)     DEFAULT 'PASS' CHECK (visual_check IN ('PASS', 'FAIL', 'NA')),
    dimension_check             VARCHAR(20)     DEFAULT 'PASS' CHECK (dimension_check IN ('PASS', 'FAIL', 'NA')),
    chemical_test               VARCHAR(20)     DEFAULT 'PASS' CHECK (chemical_test IN ('PASS', 'FAIL', 'NA')),
    hardness_test               VARCHAR(20)     DEFAULT 'PASS' CHECK (hardness_test IN ('PASS', 'FAIL', 'NA')),
    observed_parameters         JSONB,
    remarks                     VARCHAR(250),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_qc_inward_item UNIQUE (qc_id, grn_item_id)
);

CREATE INDEX IF NOT EXISTS idx_qc_inward_item_qc ON tbl_qc_inward_inspection_item (qc_id, is_active);
CREATE INDEX IF NOT EXISTS idx_qc_inward_item_grn_item ON tbl_qc_inward_inspection_item (grn_item_id);
CREATE INDEX IF NOT EXISTS idx_qc_inward_item_batch ON tbl_qc_inward_inspection_item (batch_no);
CREATE INDEX IF NOT EXISTS idx_qc_inward_item_heat ON tbl_qc_inward_inspection_item (heat_no);


-- ============================================================================
-- 36. WAREHOUSE BIN PUT-AWAY HEADER (tbl_inv_putaway_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_putaway_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_putaway_header (
    putaway_id                  BIGINT          PRIMARY KEY DEFAULT nextval('seq_putaway_id'),
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    putaway_no                  VARCHAR(50)     NOT NULL,
    putaway_date                DATE            NOT NULL DEFAULT CURRENT_DATE,
    warehouse_id                BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    grn_id                      BIGINT          REFERENCES tbl_inv_grn_header(grn_id),
    qc_id                       BIGINT          REFERENCES tbl_qc_inward_inspection_header(qc_id),
    assigned_to                 BIGINT          REFERENCES tbl_sec_user(user_id),
    putaway_type                VARCHAR(50)     NOT NULL DEFAULT 'GRN_INWARD'
                                                CHECK (putaway_type IN ('GRN_INWARD', 'QC_RELEASE', 'INTERNAL_TRANSFER', 'REWORK_RETURN')),
    status                      VARCHAR(25)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    total_items                 INT             NOT NULL DEFAULT 0,
    total_qty                   NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    completed_date              TIMESTAMPTZ,
    completed_by                BIGINT          REFERENCES tbl_sec_user(user_id),
    remarks                     VARCHAR(350),
    cancel_reason               VARCHAR(350),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_inv_putaway_no UNIQUE (comp_id, putaway_no)
);

CREATE INDEX IF NOT EXISTS idx_inv_putaway_header_comp_status ON tbl_inv_putaway_header (comp_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_inv_putaway_header_warehouse ON tbl_inv_putaway_header (warehouse_id);
CREATE INDEX IF NOT EXISTS idx_inv_putaway_header_grn ON tbl_inv_putaway_header (grn_id);
CREATE INDEX IF NOT EXISTS idx_inv_putaway_header_qc ON tbl_inv_putaway_header (qc_id);
CREATE INDEX IF NOT EXISTS idx_inv_putaway_header_dates ON tbl_inv_putaway_header (putaway_date);


-- ============================================================================
-- 37. WAREHOUSE BIN PUT-AWAY LINE ITEMS (tbl_inv_putaway_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_putaway_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_putaway_item (
    putaway_item_id             BIGINT          PRIMARY KEY DEFAULT nextval('seq_putaway_item_id'),
    putaway_id                  BIGINT          NOT NULL REFERENCES tbl_inv_putaway_header(putaway_id) ON DELETE CASCADE,
    grn_item_id                 BIGINT          REFERENCES tbl_inv_grn_item(grn_item_id),
    qc_item_id                  BIGINT          REFERENCES tbl_qc_inward_inspection_item(qc_item_id),
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    item_description            VARCHAR(250),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    source_bin_id               BIGINT          REFERENCES tbl_inv_storage_bin(bin_id),
    destination_bin_id          BIGINT          NOT NULL REFERENCES tbl_inv_storage_bin(bin_id),
    allocated_qty               NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    putaway_qty                 NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    batch_no                    VARCHAR(100),
    heat_no                     VARCHAR(100),
    mfg_date                    DATE,
    expiry_date                 DATE,
    status                      VARCHAR(25)     NOT NULL DEFAULT 'PENDING'
                                                CHECK (status IN ('PENDING', 'COMPLETED')),
    remarks                     VARCHAR(250),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inv_putaway_item_putaway ON tbl_inv_putaway_item (putaway_id, is_active);
CREATE INDEX IF NOT EXISTS idx_inv_putaway_item_item ON tbl_inv_putaway_item (item_id);
CREATE INDEX IF NOT EXISTS idx_inv_putaway_item_dest_bin ON tbl_inv_putaway_item (destination_bin_id);
CREATE INDEX IF NOT EXISTS idx_inv_putaway_item_batch ON tbl_inv_putaway_item (batch_no);


-- ============================================================================
-- 38. ITEM BIN STOCK BALANCE (tbl_inv_bin_stock)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_bin_stock_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_bin_stock (
    bin_stock_id                BIGINT          PRIMARY KEY DEFAULT nextval('seq_bin_stock_id'),
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    warehouse_id                BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    bin_id                      BIGINT          NOT NULL REFERENCES tbl_inv_storage_bin(bin_id),
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    batch_no                    VARCHAR(100),
    heat_no                     VARCHAR(100),
    on_hand_qty                 NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    reserved_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    available_qty               NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    unit_cost                   NUMERIC(14, 4)  DEFAULT 0.0000,
    total_valuation             NUMERIC(14, 2)  DEFAULT 0.00,
    last_stock_date             TIMESTAMPTZ     DEFAULT CURRENT_TIMESTAMP,
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_inv_bin_stock_unique UNIQUE (warehouse_id, bin_id, item_id, batch_no)
);

CREATE INDEX IF NOT EXISTS idx_inv_bin_stock_wh_bin ON tbl_inv_bin_stock (warehouse_id, bin_id);
CREATE INDEX IF NOT EXISTS idx_inv_bin_stock_item ON tbl_inv_bin_stock (item_id);
CREATE INDEX IF NOT EXISTS idx_inv_bin_stock_batch ON tbl_inv_bin_stock (batch_no);


-- ============================================================================
-- 39. INVENTORY STOCK LEDGER (tbl_inv_stock_ledger)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_stock_ledger_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_inv_stock_ledger (
    ledger_id                   BIGINT          PRIMARY KEY DEFAULT nextval('seq_stock_ledger_id'),
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    transaction_date            TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    transaction_type            VARCHAR(50)     NOT NULL
                                                CHECK (transaction_type IN ('PUTAWAY_INWARD', 'QUARANTINE_HOLD', 'QC_RELEASE', 'INTERNAL_TRANSFER', 'PRODUCTION_ISSUE', 'SCRAP_WRITE_OFF', 'ADJUSTMENT')),
    reference_doc_type          VARCHAR(50)     NOT NULL
                                                CHECK (reference_doc_type IN ('GRN', 'QC_INSPECTION', 'PUTAWAY', 'TRANSFER', 'WORK_ORDER', 'ADJUSTMENT')),
    reference_doc_id            BIGINT          NOT NULL,
    reference_doc_no            VARCHAR(50)     NOT NULL,
    warehouse_id                BIGINT          NOT NULL REFERENCES tbl_inv_warehouse(warehouse_id),
    from_bin_id                 BIGINT          REFERENCES tbl_inv_storage_bin(bin_id),
    to_bin_id                   BIGINT          REFERENCES tbl_inv_storage_bin(bin_id),
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    batch_no                    VARCHAR(100),
    heat_no                     VARCHAR(100),
    qty_in                      NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    qty_out                     NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    unit_cost                   NUMERIC(14, 4)  DEFAULT 0.0000,
    total_cost                  NUMERIC(14, 2)  DEFAULT 0.00,
    closing_balance             NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    remarks                     VARCHAR(350),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_inv_stock_ledger_comp ON tbl_inv_stock_ledger (comp_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_inv_stock_ledger_item_date ON tbl_inv_stock_ledger (item_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_inv_stock_ledger_wh_bin ON tbl_inv_stock_ledger (warehouse_id, to_bin_id);
CREATE INDEX IF NOT EXISTS idx_inv_stock_ledger_ref ON tbl_inv_stock_ledger (reference_doc_type, reference_doc_id);


-- ============================================================================
-- 40. PURCHASE INVOICE & 3-WAY MATCHING (tbl_pur_invoice_header)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_pur_invoice_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_pur_invoice_header (
    invoice_id                  BIGINT          PRIMARY KEY DEFAULT nextval('seq_pur_invoice_id'),
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT          REFERENCES tbl_org_financial_year(fyear_id),
    invoice_no                  VARCHAR(50)     NOT NULL,
    invoice_date                DATE            NOT NULL DEFAULT CURRENT_DATE,
    vendor_id                   BIGINT          NOT NULL REFERENCES tbl_crm_party(party_id),
    po_id                       BIGINT          REFERENCES tbl_po_header(po_id),
    grn_id                      BIGINT          REFERENCES tbl_inv_grn_header(grn_id),
    qc_id                       BIGINT          REFERENCES tbl_qc_inward_inspection_header(qc_id),
    vendor_invoice_no           VARCHAR(100)    NOT NULL,
    vendor_invoice_date         DATE            NOT NULL,
    vendor_gstin                VARCHAR(20),
    payment_terms_days          INT             NOT NULL DEFAULT 30,
    due_date                    DATE            NOT NULL,
    subtotal_amount             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    discount_amount             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    taxable_amount              NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    cgst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    sgst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    igst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_tax_amount            NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    freight_charges             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    insurance_charges           NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    packaging_charges           NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    tds_rate                    NUMERIC(6, 3)   NOT NULL DEFAULT 0.000,
    tds_amount                  NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    tcs_rate                    NUMERIC(6, 3)   NOT NULL DEFAULT 0.000,
    tcs_amount                  NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    round_off                   NUMERIC(8, 2)   NOT NULL DEFAULT 0.00,
    net_payable_amount          NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    paid_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    balance_amount              NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    matching_status             VARCHAR(30)     NOT NULL DEFAULT 'MATCHED'
                                                CHECK (matching_status IN ('MATCHED', 'PRICE_VARIANCE', 'QTY_VARIANCE', 'TAX_VARIANCE', 'PENDING_REVIEW')),
    status                      VARCHAR(25)     NOT NULL DEFAULT 'DRAFT'
                                                CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'PAID', 'PARTIALLY_PAID', 'CANCELLED')),
    payment_status              VARCHAR(25)     NOT NULL DEFAULT 'UNPAID'
                                                CHECK (payment_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID')),
    approved_by                 BIGINT          REFERENCES tbl_sec_user(user_id),
    approved_date               TIMESTAMPTZ,
    approval_remarks            VARCHAR(350),
    cancel_reason               VARCHAR(350),
    remarks                     VARCHAR(350),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ,
    CONSTRAINT uq_pur_invoice_no UNIQUE (comp_id, invoice_no),
    CONSTRAINT uq_pur_vendor_bill UNIQUE (comp_id, vendor_id, vendor_invoice_no)
);

CREATE INDEX IF NOT EXISTS idx_pur_invoice_header_comp_status ON tbl_pur_invoice_header (comp_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_pur_invoice_header_vendor ON tbl_pur_invoice_header (vendor_id);
CREATE INDEX IF NOT EXISTS idx_pur_invoice_header_po ON tbl_pur_invoice_header (po_id);
CREATE INDEX IF NOT EXISTS idx_pur_invoice_header_grn ON tbl_pur_invoice_header (grn_id);
CREATE INDEX IF NOT EXISTS idx_pur_invoice_header_dates ON tbl_pur_invoice_header (invoice_date, due_date);


-- ============================================================================
-- 41. PURCHASE INVOICE LINE ITEMS (tbl_pur_invoice_item)
-- ============================================================================
CREATE SEQUENCE IF NOT EXISTS seq_pur_invoice_item_id START WITH 1001 INCREMENT BY 1;

CREATE TABLE IF NOT EXISTS tbl_pur_invoice_item (
    invoice_item_id             BIGINT          PRIMARY KEY DEFAULT nextval('seq_pur_invoice_item_id'),
    invoice_id                  BIGINT          NOT NULL REFERENCES tbl_pur_invoice_header(invoice_id) ON DELETE CASCADE,
    po_item_id                  BIGINT          REFERENCES tbl_po_item(po_item_id),
    grn_item_id                 BIGINT          REFERENCES tbl_inv_grn_item(grn_item_id),
    qc_item_id                  BIGINT          REFERENCES tbl_qc_inward_inspection_item(qc_item_id),
    item_id                     BIGINT          NOT NULL REFERENCES tbl_inv_item(item_id),
    item_description            VARCHAR(250),
    hsn_code                    VARCHAR(20),
    uom_id                      BIGINT          NOT NULL REFERENCES tbl_inv_uom(uom_id),
    po_qty                      NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    received_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    accepted_qty                NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    billed_qty                  NUMERIC(14, 3)  NOT NULL DEFAULT 0.000,
    po_rate                     NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    invoiced_rate               NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    rate_variance               NUMERIC(14, 4)  NOT NULL DEFAULT 0.0000,
    item_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    discount_percent            NUMERIC(6, 2)   NOT NULL DEFAULT 0.00,
    discount_amount             NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    taxable_amount              NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    gst_rate                    NUMERIC(6, 2)   NOT NULL DEFAULT 18.00,
    cgst_rate                   NUMERIC(6, 2)   NOT NULL DEFAULT 9.00,
    cgst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    sgst_rate                   NUMERIC(6, 2)   NOT NULL DEFAULT 9.00,
    sgst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    igst_rate                   NUMERIC(6, 2)   NOT NULL DEFAULT 0.00,
    igst_amount                 NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    total_item_amount           NUMERIC(14, 2)  NOT NULL DEFAULT 0.00,
    batch_no                    VARCHAR(100),
    remarks                     VARCHAR(250),
    is_active                   BOOLEAN         NOT NULL DEFAULT TRUE,
    -- Mandatory 7 Audit & Context Columns
    comp_id                     BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_company(comp_id),
    branch_id                   BIGINT          NOT NULL DEFAULT 1001 REFERENCES tbl_org_branch(branch_id),
    fyear_id                    BIGINT,
    created_by                  BIGINT          NOT NULL,
    created_date                TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by                  BIGINT,
    updated_date                TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pur_invoice_item_invoice ON tbl_pur_invoice_item (invoice_id, is_active);
CREATE INDEX IF NOT EXISTS idx_pur_invoice_item_item ON tbl_pur_invoice_item (item_id);
CREATE INDEX IF NOT EXISTS idx_pur_invoice_item_po_item ON tbl_pur_invoice_item (po_item_id);
CREATE INDEX IF NOT EXISTS idx_pur_invoice_item_grn_item ON tbl_pur_invoice_item (grn_item_id);
